/**
 * RoundMachine May I tests - New Interactive Resolution
 *
 * These tests verify the new round-level May I implementation where:
 * - May I is a persistent opportunity (not a turn-level window)
 * - When someone calls May I, players ahead are prompted one-by-one
 * - Interactive resolution with ALLOW_MAY_I and CLAIM_MAY_I events
 *
 * TDD: These tests are written FIRST and should FAIL until implementation.
 */

import { describe, it, expect } from "bun:test";
import { createActor } from "xstate";
import { roundMachine } from "./round.machine";
import type { RoundInput, PredefinedRoundState } from "./round.machine";
import type { Player } from "./engine.types";
import type { Card } from "../card/card.types";

/**
 * Helper to create test players
 */
function createTestPlayers(count: number): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `player-${i}`,
    name: `Player ${i}`,
    hand: [],
    isDown: false,
    totalScore: 0,
  }));
}

/**
 * Helper to create a round actor with predefined state
 */
function createRoundActor(input: RoundInput) {
  const actor = createActor(roundMachine, { input });
  actor.start();
  return actor;
}

/**
 * Create a predefined state for May I testing.
 * Sets up 4 players with simple hands, stock, and discard.
 */
function createMayITestState(overrides?: {
  playerDownStatus?: boolean[];
  discardCard?: Card;
}): PredefinedRoundState {
  const discardCard = overrides?.discardCard ?? {
    id: "discard-K-S",
    suit: "spades" as const,
    rank: "K" as const,
  };

  return {
    hands: [
      // Player 0 (dealer, doesn't play first)
      [
        { id: "p0-card-1", suit: "hearts" as const, rank: "5" as const },
        { id: "p0-card-2", suit: "hearts" as const, rank: "6" as const },
        { id: "p0-card-3", suit: "hearts" as const, rank: "7" as const },
      ],
      // Player 1 (current player, first to play)
      [
        { id: "p1-card-1", suit: "diamonds" as const, rank: "5" as const },
        { id: "p1-card-2", suit: "diamonds" as const, rank: "6" as const },
        { id: "p1-card-3", suit: "diamonds" as const, rank: "7" as const },
      ],
      // Player 2
      [
        { id: "p2-card-1", suit: "clubs" as const, rank: "5" as const },
        { id: "p2-card-2", suit: "clubs" as const, rank: "6" as const },
        { id: "p2-card-3", suit: "clubs" as const, rank: "7" as const },
      ],
      // Player 3
      [
        { id: "p3-card-1", suit: "spades" as const, rank: "5" as const },
        { id: "p3-card-2", suit: "spades" as const, rank: "6" as const },
        { id: "p3-card-3", suit: "spades" as const, rank: "7" as const },
      ],
    ],
    stock: [
      { id: "stock-1", suit: "hearts" as const, rank: "A" as const },
      { id: "stock-2", suit: "diamonds" as const, rank: "A" as const },
      { id: "stock-3", suit: "clubs" as const, rank: "A" as const },
    ],
    discard: [discardCard],
    playerDownStatus: overrides?.playerDownStatus ?? [false, false, false, false],
  };
}

/**
 * Get the round context from an actor
 */
function getContext(actor: ReturnType<typeof createRoundActor>) {
  return actor.getSnapshot().context;
}

/**
 * Get the current state value (including nested states)
 */
function getStateValue(actor: ReturnType<typeof createRoundActor>) {
  return actor.getSnapshot().value;
}

/**
 * Get the invoked TurnMachine snapshot (from the RoundMachine persisted snapshot)
 */
function getTurnSnapshot(actor: ReturnType<typeof createRoundActor>) {
  return (actor.getPersistedSnapshot() as any).children.turn.snapshot as {
    value: string;
    context: {
      playerId: string;
      hand: Card[];
      stock: Card[];
      discard: Card[];
      hasDrawn: boolean;
    };
  };
}

describe("RoundMachine - May I Resolution", () => {
  describe("CALL_MAY_I starts resolution", () => {
    it("CALL_MAY_I transitions round to resolvingMayI state when discard is exposed", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 0,
        predefinedState: createMayITestState(),
      };
      const actor = createRoundActor(input);

      // Player 1 is current, Player 2 calls May I
      actor.send({ type: "CALL_MAY_I", playerId: "player-2" });

      // Should be in resolvingMayI state (compound state with substates)
      const stateValue = getStateValue(actor) as { active: object };
      expect(stateValue.active).toHaveProperty("resolvingMayI");
    });

    it("mayIResolution context is initialized with caller and card", () => {
      const discardCard: Card = { id: "discard-Q-H", suit: "hearts", rank: "Q" };
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 0,
        predefinedState: createMayITestState({ discardCard }),
      };
      const actor = createRoundActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });

      const ctx = getContext(actor);
      expect(ctx.mayIResolution).not.toBeNull();
      expect(ctx.mayIResolution?.originalCaller).toBe("player-3");
      expect(ctx.mayIResolution?.cardBeingClaimed).toEqual(discardCard);
    });

    it("playersToCheck contains players ahead of caller in priority order", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 0,
        predefinedState: createMayITestState(),
      };
      const actor = createRoundActor(input);

      // Player 1 is current. Player 3 calls May I.
      // Players ahead of player-3: player-1 (current), player-2
      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });

      const ctx = getContext(actor);
      // Priority order: closest to current player in turn order
      // player-2 is between player-1 (current) and player-3 (caller)
      expect(ctx.mayIResolution?.playersToCheck).toContain("player-2");
      // Current player is also ahead if they haven't drawn from stock
      expect(ctx.mayIResolution?.playersToCheck).toContain("player-1");
    });
  });

  describe("Resolution skips ineligible players", () => {
    it("skips players who are down", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 0,
        predefinedState: createMayITestState({
          playerDownStatus: [false, false, true, false], // player-2 is down
        }),
      };
      const actor = createRoundActor(input);

      // Player 3 calls May I. Player 2 is down, should be skipped.
      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });

      const ctx = getContext(actor);
      // Player 2 should not be in playersToCheck (they're down)
      expect(ctx.mayIResolution?.playersToCheck).not.toContain("player-2");
    });

    it("skips current player if they already drew from stock", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 0,
        predefinedState: createMayITestState(),
      };
      const actor = createRoundActor(input);

      // Current player (player-1) draws from stock first
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-1" });

      // Then player-3 calls May I
      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });

      const ctx = getContext(actor);
      // player-1 should not be in playersToCheck (they drew from stock)
      expect(ctx.mayIResolution?.playersToCheck).not.toContain("player-1");
    });

    it("auto-resolves to caller when all ahead are ineligible", () => {
      const discardCard: Card = { id: "discard-K-S", suit: "spades", rank: "K" };
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 0,
        predefinedState: {
          ...createMayITestState({
            playerDownStatus: [false, true, true, false], // player-1 and player-2 are down
          }),
          discard: [discardCard],
        },
      };
      const actor = createRoundActor(input);

      // Dealer is 0, so current player is player-1, but player-1 is down
      // Player-3 calls May I. Players ahead: player-1 (down), player-2 (down)
      // All ahead are ineligible, so caller auto-wins
      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });

      // Resolution completes immediately, so check effects:
      // - Back in playing state
      // - Caller received the discard + penalty card
      const ctx = getContext(actor);
      expect(getStateValue(actor)).toEqual({ active: "playing" });

      const player3 = ctx.players.find((p) => p.id === "player-3");
      expect(player3?.hand).toContainEqual(discardCard);
    });
  });

  describe("ALLOW_MAY_I advances resolution", () => {
    it("ALLOW_MAY_I from prompted player advances to next player", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 0,
        predefinedState: createMayITestState(),
      };
      const actor = createRoundActor(input);

      // Player 3 calls May I
      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });

      // First player to be prompted (let's say player-2)
      const ctxBefore = getContext(actor);
      const firstPrompted = ctxBefore.mayIResolution?.playerBeingPrompted;
      if (!firstPrompted) {
        throw new Error("Expected a prompted player after CALL_MAY_I");
      }

      // That player allows
      actor.send({ type: "ALLOW_MAY_I", playerId: firstPrompted });

      const ctxAfter = getContext(actor);
      // Should have advanced
      expect(ctxAfter.mayIResolution?.playersWhoAllowed).toContain(firstPrompted);
      expect(ctxAfter.mayIResolution?.currentPromptIndex).toBeGreaterThan(
        ctxBefore.mayIResolution?.currentPromptIndex ?? 0
      );
    });

    it("when all ahead allow, original caller wins", () => {
      const discardCard: Card = { id: "discard-K", suit: "spades", rank: "K" };
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(3), // Simpler: 3 players
        dealerIndex: 0,
        predefinedState: {
          hands: [
            [{ id: "p0-1", suit: "hearts", rank: "5" }],
            [{ id: "p1-1", suit: "diamonds", rank: "5" }],
            [{ id: "p2-1", suit: "clubs", rank: "5" }],
          ],
          stock: [{ id: "stock-1", suit: "spades", rank: "A" }],
          discard: [discardCard],
          playerDownStatus: [false, false, false],
        },
      };
      const actor = createRoundActor(input);

      // Player 1 is current, Player 2 calls May I
      // Only player-1 is ahead of player-2
      actor.send({ type: "CALL_MAY_I", playerId: "player-2" });

      // Player 1 allows
      actor.send({ type: "ALLOW_MAY_I", playerId: "player-1" });

      // Resolution completes when all allow, check effects:
      const ctx = getContext(actor);
      expect(getStateValue(actor)).toEqual({ active: "playing" });

      // Caller (player-2) received the discard
      const player2 = ctx.players.find((p) => p.id === "player-2");
      expect(player2?.hand).toContainEqual(discardCard);
    });
  });

  describe("CLAIM_MAY_I blocks caller", () => {
    it("CLAIM_MAY_I from prompted player ends resolution with claimer as winner", () => {
      const discardCard: Card = { id: "discard-K-S", suit: "spades", rank: "K" };
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 0,
        predefinedState: {
          ...createMayITestState(),
          discard: [discardCard],
        },
      };
      const actor = createRoundActor(input);

      // Player 3 calls May I
      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });

      // First prompted player claims instead (should be player-1, the current player)
      const ctx = getContext(actor);
      const prompted = ctx.mayIResolution?.playerBeingPrompted;
      if (!prompted) {
        throw new Error("Expected a prompted player after CALL_MAY_I");
      }
      expect(prompted).toBe("player-1"); // current player is first in line
      actor.send({ type: "CLAIM_MAY_I", playerId: prompted });

      // Resolution completes, claimer received the card
      const ctxAfter = getContext(actor);
      expect(getStateValue(actor)).toEqual({ active: "playing" });

      // Claimer is the current player - their hand lives in the invoked TurnMachine during the turn
      const turnAfter = getTurnSnapshot(actor);
      expect(turnAfter.context.playerId).toBe(prompted);
      expect(turnAfter.context.hand).toContainEqual(discardCard);
    });

    it("blocked caller gets nothing", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(3),
        dealerIndex: 0,
        predefinedState: {
          hands: [
            [{ id: "p0-1", suit: "hearts", rank: "5" }],
            [{ id: "p1-1", suit: "diamonds", rank: "5" }],
            [{ id: "p2-1", suit: "clubs", rank: "5" }],
          ],
          stock: [{ id: "stock-1", suit: "spades", rank: "A" }],
          discard: [{ id: "discard-K", suit: "spades", rank: "K" }],
          playerDownStatus: [false, false, false],
        },
      };
      const actor = createRoundActor(input);

      // Player 2 calls May I
      actor.send({ type: "CALL_MAY_I", playerId: "player-2" });

      // Player 1 (current) claims
      actor.send({ type: "CLAIM_MAY_I", playerId: "player-1" });

      // Player 2 (caller) should not receive any cards
      const player2 = getContext(actor).players.find((p) => p.id === "player-2");
      expect(player2?.hand.length).toBe(1); // Original hand, no additions
    });
  });

  describe("Winner receives cards", () => {
    it("winner gets discard + penalty card from stock", () => {
      const discardCard: Card = { id: "discard-K", suit: "spades", rank: "K" };
      const penaltyCard: Card = { id: "stock-1", suit: "hearts", rank: "A" };

      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(3),
        dealerIndex: 0,
        predefinedState: {
          hands: [
            [{ id: "p0-1", suit: "hearts", rank: "5" }],
            [{ id: "p1-1", suit: "diamonds", rank: "5" }],
            [{ id: "p2-1", suit: "clubs", rank: "5" }],
          ],
          stock: [penaltyCard, { id: "stock-2", suit: "diamonds", rank: "A" }],
          discard: [discardCard],
          playerDownStatus: [false, false, false],
        },
      };
      const actor = createRoundActor(input);

      // Player 2 calls May I, player 1 allows
      actor.send({ type: "CALL_MAY_I", playerId: "player-2" });
      actor.send({ type: "ALLOW_MAY_I", playerId: "player-1" });

      // Player 2 wins, should have the cards
      const player2 = getContext(actor).players.find((p) => p.id === "player-2");
      expect(player2?.hand).toContainEqual(discardCard);
      expect(player2?.hand).toContainEqual(penaltyCard);
    });

    it("stock is reduced by one (penalty card)", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(3),
        dealerIndex: 0,
        predefinedState: {
          hands: [
            [{ id: "p0-1", suit: "hearts", rank: "5" }],
            [{ id: "p1-1", suit: "diamonds", rank: "5" }],
            [{ id: "p2-1", suit: "clubs", rank: "5" }],
          ],
          stock: [
            { id: "stock-1", suit: "hearts", rank: "A" },
            { id: "stock-2", suit: "diamonds", rank: "A" },
          ],
          discard: [{ id: "discard-K", suit: "spades", rank: "K" }],
          playerDownStatus: [false, false, false],
        },
      };
      const actor = createRoundActor(input);
      const initialStockLength = getContext(actor).stock.length;

      actor.send({ type: "CALL_MAY_I", playerId: "player-2" });
      actor.send({ type: "ALLOW_MAY_I", playerId: "player-1" });

      expect(getContext(actor).stock.length).toBe(initialStockLength - 1);
    });

    it("discard pile loses the claimed card", () => {
      const discardCard: Card = { id: "discard-K", suit: "spades", rank: "K" };
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(3),
        dealerIndex: 0,
        predefinedState: {
          hands: [
            [{ id: "p0-1", suit: "hearts", rank: "5" }],
            [{ id: "p1-1", suit: "diamonds", rank: "5" }],
            [{ id: "p2-1", suit: "clubs", rank: "5" }],
          ],
          stock: [{ id: "stock-1", suit: "hearts", rank: "A" }],
          discard: [discardCard],
          playerDownStatus: [false, false, false],
        },
      };
      const actor = createRoundActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-2" });
      actor.send({ type: "ALLOW_MAY_I", playerId: "player-1" });

      const discard = getContext(actor).discard;
      expect(discard.find((c) => c.id === discardCard.id)).toBeUndefined();
    });
  });

  describe("Current player claiming during resolution", () => {
    it("current player CLAIM_MAY_I acts as DRAW_FROM_DISCARD (no penalty)", () => {
      const discardCard: Card = { id: "discard-K", suit: "spades", rank: "K" };
      const penaltyCard: Card = { id: "stock-1", suit: "hearts", rank: "A" };
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(3),
        dealerIndex: 0,
        predefinedState: {
          hands: [
            [{ id: "p0-1", suit: "hearts", rank: "5" }],
            [{ id: "p1-1", suit: "diamonds", rank: "5" }],
            [{ id: "p2-1", suit: "clubs", rank: "5" }],
          ],
          stock: [
            penaltyCard,
            { id: "stock-2", suit: "diamonds", rank: "A" },
          ],
          discard: [discardCard],
          playerDownStatus: [false, false, false],
        },
      };
      const actor = createRoundActor(input);
      const initialStockLength = getContext(actor).stock.length;

      // Player 2 calls May I, current player (player-1) claims
      actor.send({ type: "CALL_MAY_I", playerId: "player-2" });
      actor.send({ type: "CLAIM_MAY_I", playerId: "player-1" });

      // Resolution completes, current player gets the discard (no penalty)
      const ctx = getContext(actor);
      const turnAfter = getTurnSnapshot(actor);
      expect(turnAfter.context.playerId).toBe("player-1");
      expect(turnAfter.context.hand).toContainEqual(discardCard);

      // Stock should NOT be reduced (current player doesn't get penalty card)
      expect(ctx.stock.length).toBe(initialStockLength);

      // Player-1 should NOT have the penalty card (only the discard)
      expect(turnAfter.context.hand).not.toContainEqual(penaltyCard);
    });

    it("turn continues from drawn state after current player claims", () => {
      const discardCard: Card = { id: "discard-K", suit: "spades", rank: "K" };
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(3),
        dealerIndex: 0,
        predefinedState: {
          hands: [
            [{ id: "p0-1", suit: "hearts", rank: "5" }],
            [{ id: "p1-1", suit: "diamonds", rank: "5" }],
            [{ id: "p2-1", suit: "clubs", rank: "5" }],
          ],
          stock: [{ id: "stock-1", suit: "hearts", rank: "A" }],
          discard: [discardCard],
          playerDownStatus: [false, false, false],
        },
      };
      const actor = createRoundActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-2" });
      actor.send({ type: "CLAIM_MAY_I", playerId: "player-1" });

      // Should be back in playing state
      expect(getStateValue(actor)).toEqual({ active: "playing" });

      // Current player (player-1) should have the claimed card
      const turnAfter = getTurnSnapshot(actor);
      expect(turnAfter.context.playerId).toBe("player-1");
      expect(turnAfter.context.hand).toContainEqual(discardCard);

      // The round should track that current player has drawn (for May I purposes)
      expect(getContext(actor).discardClaimed).toBe(true);
    });
  });

  describe("CALL_MAY_I rejection", () => {
    it("rejects CALL_MAY_I when resolution already in progress", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 0,
        predefinedState: createMayITestState(),
      };
      const actor = createRoundActor(input);

      // Player 2 calls May I first
      actor.send({ type: "CALL_MAY_I", playerId: "player-2" });
      const callerAfterFirst = getContext(actor).mayIResolution?.originalCaller;

      // Player 3 tries to call May I while resolution in progress
      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });

      // Original caller should still be player-2
      expect(getContext(actor).mayIResolution?.originalCaller).toBe(callerAfterFirst);
    });

    it("rejects CALL_MAY_I when discard already claimed this turn", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(3),
        dealerIndex: 0,
        predefinedState: {
          hands: [
            [{ id: "p0-1", suit: "hearts", rank: "5" }],
            [{ id: "p1-1", suit: "diamonds", rank: "5" }],
            [{ id: "p2-1", suit: "clubs", rank: "5" }],
          ],
          stock: [{ id: "stock-1", suit: "hearts", rank: "A" }],
          discard: [{ id: "discard-K", suit: "spades", rank: "K" }],
          playerDownStatus: [false, false, false],
        },
      };
      const actor = createRoundActor(input);

      // Current player draws from discard (claims it)
      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-1" });

      // Player 2 tries to call May I - should be rejected (discard already claimed)
      actor.send({ type: "CALL_MAY_I", playerId: "player-2" });

      // No resolution should be started
      expect(getContext(actor).mayIResolution).toBeNull();
    });

    it("rejects CALL_MAY_I from down player", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 0,
        predefinedState: createMayITestState({
          playerDownStatus: [false, false, true, false], // player-2 is down
        }),
      };
      const actor = createRoundActor(input);

      // Player 2 (who is down) tries to call May I
      actor.send({ type: "CALL_MAY_I", playerId: "player-2" });

      // No resolution should be started (down player can't call May I)
      expect(getContext(actor).mayIResolution).toBeNull();
    });

    it("rejects CALL_MAY_I from player who discarded the card", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(3),
        dealerIndex: 0,
        predefinedState: {
          hands: [
            [{ id: "p0-1", suit: "hearts", rank: "5" }],
            [
              { id: "p1-1", suit: "diamonds", rank: "5" },
              { id: "p1-2", suit: "diamonds", rank: "6" },
            ],
            [{ id: "p2-1", suit: "clubs", rank: "5" }],
          ],
          stock: [{ id: "stock-1", suit: "hearts", rank: "A" }],
          discard: [{ id: "discard-K", suit: "spades", rank: "K" }],
          playerDownStatus: [false, false, false],
        },
      };
      const actor = createRoundActor(input);

      // Complete player-1's turn (draw, skip, discard)
      actor.send({ type: "DRAW_FROM_DISCARD" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: "p1-1" });

      // Now player-2 is current, player-1 discarded the top card
      // Player-1 tries to call May I on their own discard
      actor.send({ type: "CALL_MAY_I", playerId: "player-1" });

      // No resolution should be started (can't claim your own discard)
      expect(getContext(actor).mayIResolution).toBeNull();
    });
  });

  describe("Resolution state machine flow", () => {
    it("state transitions: playing -> resolvingMayI -> playing", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(3),
        dealerIndex: 0,
        predefinedState: {
          hands: [
            [{ id: "p0-1", suit: "hearts", rank: "5" }],
            [{ id: "p1-1", suit: "diamonds", rank: "5" }],
            [{ id: "p2-1", suit: "clubs", rank: "5" }],
          ],
          stock: [{ id: "stock-1", suit: "hearts", rank: "A" }],
          discard: [{ id: "discard-K", suit: "spades", rank: "K" }],
          playerDownStatus: [false, false, false],
        },
      };
      const actor = createRoundActor(input);

      // Initially in playing state
      expect(getStateValue(actor)).toEqual({ active: "playing" });

      // Call May I -> transitions to resolvingMayI (compound state)
      actor.send({ type: "CALL_MAY_I", playerId: "player-2" });
      const stateAfterCall = getStateValue(actor) as { active: object };
      expect(stateAfterCall.active).toHaveProperty("resolvingMayI");

      // Allow -> resolution completes, back to playing
      actor.send({ type: "ALLOW_MAY_I", playerId: "player-1" });
      expect(getStateValue(actor)).toEqual({ active: "playing" });
    });

    it("discardClaimed is set after resolution", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(3),
        dealerIndex: 0,
        predefinedState: {
          hands: [
            [{ id: "p0-1", suit: "hearts", rank: "5" }],
            [{ id: "p1-1", suit: "diamonds", rank: "5" }],
            [{ id: "p2-1", suit: "clubs", rank: "5" }],
          ],
          stock: [{ id: "stock-1", suit: "hearts", rank: "A" }],
          discard: [{ id: "discard-K", suit: "spades", rank: "K" }],
          playerDownStatus: [false, false, false],
        },
      };
      const actor = createRoundActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-2" });
      actor.send({ type: "ALLOW_MAY_I", playerId: "player-1" });

      // discardClaimed should be true now
      expect(getContext(actor).discardClaimed).toBe(true);
    });

    it("discardClaimed resets when current player discards", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(3),
        dealerIndex: 0,
        predefinedState: {
          hands: [
            [{ id: "p0-1", suit: "hearts", rank: "5" }],
            [
              { id: "p1-1", suit: "diamonds", rank: "5" },
              { id: "p1-2", suit: "diamonds", rank: "6" },
            ],
            [{ id: "p2-1", suit: "clubs", rank: "5" }],
          ],
          stock: [
            { id: "stock-1", suit: "hearts", rank: "A" },
            { id: "stock-2", suit: "hearts", rank: "2" },
          ],
          discard: [{ id: "discard-K", suit: "spades", rank: "K" }],
          playerDownStatus: [false, false, false],
        },
      };
      const actor = createRoundActor(input);

      // Player 2 wins May I
      actor.send({ type: "CALL_MAY_I", playerId: "player-2" });
      actor.send({ type: "ALLOW_MAY_I", playerId: "player-1" });
      expect(getContext(actor).discardClaimed).toBe(true);

      // Current player (player-1) completes their turn
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: "p1-1" });

      // New discard is exposed, discardClaimed should reset
      expect(getContext(actor).discardClaimed).toBe(false);
    });
  });
});

describe("RoundMachine - May I Edge Cases", () => {
  describe("Empty stock during penalty", () => {
    it("handles empty stock when granting penalty card", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(3),
        dealerIndex: 0,
        predefinedState: {
          hands: [
            [{ id: "p0-1", suit: "hearts", rank: "5" }],
            [{ id: "p1-1", suit: "diamonds", rank: "5" }],
            [{ id: "p2-1", suit: "clubs", rank: "5" }],
          ],
          stock: [], // Empty stock!
          discard: [{ id: "discard-K", suit: "spades", rank: "K" }],
          playerDownStatus: [false, false, false],
        },
      };
      const actor = createRoundActor(input);

      // Player 2 calls May I with empty stock
      actor.send({ type: "CALL_MAY_I", playerId: "player-2" });
      actor.send({ type: "ALLOW_MAY_I", playerId: "player-1" });

      // Winner gets the discard but no penalty card
      const player2 = getContext(actor).players.find((p) => p.id === "player-2");
      expect(player2?.hand.find((c) => c.id === "discard-K")).toBeDefined();
      // Hand should only have original + discard (no penalty)
      expect(player2?.hand.length).toBe(2); // 1 original + 1 discard
    });
  });

  describe("May I timing relative to draw", () => {
    it("May I can be called BEFORE current player draws", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(3),
        dealerIndex: 0,
        predefinedState: {
          hands: [
            [{ id: "p0-1", suit: "hearts", rank: "5" }],
            [{ id: "p1-1", suit: "diamonds", rank: "5" }],
            [{ id: "p2-1", suit: "clubs", rank: "5" }],
          ],
          stock: [{ id: "stock-1", suit: "hearts", rank: "A" }],
          discard: [{ id: "discard-K", suit: "spades", rank: "K" }],
          playerDownStatus: [false, false, false],
        },
      };
      const actor = createRoundActor(input);

      // Player 2 calls May I before player 1 has drawn
      actor.send({ type: "CALL_MAY_I", playerId: "player-2" });

      // Resolution should start
      expect(getContext(actor).mayIResolution).not.toBeNull();
    });

    it("May I can be called AFTER current player draws from stock", () => {
      const discardCard: Card = { id: "discard-K", suit: "spades", rank: "K" };
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(3),
        dealerIndex: 0,
        predefinedState: {
          hands: [
            [{ id: "p0-1", suit: "hearts", rank: "5" }],
            [{ id: "p1-1", suit: "diamonds", rank: "5" }],
            [{ id: "p2-1", suit: "clubs", rank: "5" }],
          ],
          stock: [
            { id: "stock-1", suit: "hearts", rank: "A" },
            { id: "stock-2", suit: "diamonds", rank: "A" },
          ],
          discard: [discardCard],
          playerDownStatus: [false, false, false],
        },
      };
      const actor = createRoundActor(input);

      // Current player (player-1) draws from stock
      actor.send({ type: "DRAW_FROM_STOCK" });

      // Player 2 calls May I after current player drew from stock
      // With current player out of line (drew from stock), there are no players
      // ahead of player-2 in a 3-player game, so caller auto-wins
      actor.send({ type: "CALL_MAY_I", playerId: "player-2" });

      // Resolution completes immediately (no one to check), caller wins
      const ctx = getContext(actor);
      const player2 = ctx.players.find((p) => p.id === "player-2");
      expect(player2?.hand).toContainEqual(discardCard);
    });

    it("penalty card comes from remaining stock after current player's stock draw (no duplication)", () => {
      const drawnCard: Card = { id: "stock-drawn", suit: "hearts", rank: "A" };
      const penaltyCard: Card = { id: "stock-penalty", suit: "diamonds", rank: "K" };
      const discardCard: Card = { id: "discard-Q", suit: "spades", rank: "Q" };

      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(3),
        dealerIndex: 0, // player-1 is current
        predefinedState: {
          hands: [[], [], []],
          stock: [drawnCard, penaltyCard],
          discard: [discardCard],
          playerDownStatus: [false, false, false],
        },
      };
      const actor = createRoundActor(input);

      // Current player draws from stock (takes drawnCard)
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-1" });

      // Another player calls May I after the stock draw
      // In a 3-player game, current player is now out of line, so this auto-resolves.
      actor.send({ type: "CALL_MAY_I", playerId: "player-2" });

      const ctxAfter = getContext(actor);
      const player2 = ctxAfter.players.find((p) => p.id === "player-2");

      // Winner gets discard + penalty card (NOT the card already drawn by current player)
      expect(player2?.hand).toContainEqual(discardCard);
      expect(player2?.hand).toContainEqual(penaltyCard);
      expect(player2?.hand).not.toContainEqual(drawnCard);

      // Current player's turn state should still reflect having drawn (and still holding drawnCard)
      const turnAfter = getTurnSnapshot(actor);
      expect(turnAfter.value).toBe("drawn");
      expect(turnAfter.context.hasDrawn).toBe(true);
      expect(turnAfter.context.hand).toContainEqual(drawnCard);
    });
  });

  describe("Multiple players in resolution", () => {
    it("prompts players in priority order (current player first, then in turn order)", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(5),
        dealerIndex: 0,
        predefinedState: {
          hands: Array(5)
            .fill(null)
            .map((_, i) => [{ id: `p${i}-1`, suit: "hearts" as const, rank: "5" as const }]),
          stock: [{ id: "stock-1", suit: "hearts", rank: "A" }],
          discard: [{ id: "discard-K", suit: "spades", rank: "K" }],
          playerDownStatus: [false, false, false, false, false],
        },
      };
      const actor = createRoundActor(input);

      // Player 1 is current. Player 4 calls May I.
      // Players ahead in turn order: player-1 (current), player-2, player-3
      // Current player is first in line until they draw from stock
      actor.send({ type: "CALL_MAY_I", playerId: "player-4" });

      const ctx = getContext(actor);
      // player-1 (current) should be prompted first - they're first in line
      expect(ctx.mayIResolution?.playerBeingPrompted).toBe("player-1");
    });

    it("each ALLOW advances to next in line", () => {
      const discardCard: Card = { id: "discard-K", suit: "spades", rank: "K" };
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(5),
        dealerIndex: 0,
        predefinedState: {
          hands: Array(5)
            .fill(null)
            .map((_, i) => [{ id: `p${i}-1`, suit: "hearts" as const, rank: "5" as const }]),
          stock: [{ id: "stock-1", suit: "hearts", rank: "A" }],
          discard: [discardCard],
          playerDownStatus: [false, false, false, false, false],
        },
      };
      const actor = createRoundActor(input);

      // Player 4 calls May I (players 1, 2, 3 are ahead)
      actor.send({ type: "CALL_MAY_I", playerId: "player-4" });

      // Player 1 (current) allows - advances to player-2
      actor.send({ type: "ALLOW_MAY_I", playerId: "player-1" });
      expect(getContext(actor).mayIResolution?.playerBeingPrompted).toBe("player-2");

      // Player 2 allows - advances to player-3
      actor.send({ type: "ALLOW_MAY_I", playerId: "player-2" });
      expect(getContext(actor).mayIResolution?.playerBeingPrompted).toBe("player-3");

      // Player 3 allows - all allowed, caller (player-4) wins
      // Resolution completes immediately, so check effects
      actor.send({ type: "ALLOW_MAY_I", playerId: "player-3" });

      const player4 = getContext(actor).players.find((p) => p.id === "player-4");
      expect(player4?.hand).toContainEqual(discardCard);
    });
  });
});
