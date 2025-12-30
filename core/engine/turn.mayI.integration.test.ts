/**
 * Turn Machine → May I Window Machine Integration Tests (TDD)
 *
 * These tests define the DESIRED behavior for turn→mayI integration.
 * They are written BEFORE implementation and should FAIL initially.
 *
 * The integration pattern:
 * 1. When current player sends DRAW_FROM_STOCK, turn enters mayIWindow state
 * 2. mayIWindowMachine is invoked to handle May I claims
 * 3. Other players can send CALL_MAY_I during the window
 * 4. Current player sends DRAW_FROM_STOCK again to close window (pass on discard)
 * 5. May I winner (if any) receives discarded card + penalty card
 * 6. Turn continues with current player in drawn state
 */

import { describe, it, expect } from "bun:test";
import { createActor } from "xstate";
import { turnMachine, type TurnInput, type TurnOutput } from "./turn.machine";
import type { Card } from "../card/card.types";

/**
 * Helper to create a Card
 */
function createCard(
  suit: Card["suit"],
  rank: Card["rank"],
  id?: string
): Card {
  return {
    id: id ?? `${rank}-${suit}-${Math.random()}`,
    rank,
    suit,
  };
}

/**
 * Helper to create TurnInput with May I support
 */
function createTurnInput(overrides?: Partial<TurnInput> & {
  playerOrder?: string[];
  playerDownStatus?: Record<string, boolean>;
  lastDiscardedByPlayerId?: string;
}): TurnInput & {
  playerOrder: string[];
  playerDownStatus: Record<string, boolean>;
  lastDiscardedByPlayerId: string;
} {
  const playerId = overrides?.playerId ?? "player-1";
  return {
    playerId,
    hand: overrides?.hand ?? [
      createCard("hearts", "4"),
      createCard("clubs", "3"),
      createCard("spades", "7"),
    ],
    stock: overrides?.stock ?? [
      createCard("diamonds", "K"),
      createCard("hearts", "Q"),
      createCard("clubs", "J"),
      createCard("spades", "10"),
    ],
    discard: overrides?.discard ?? [
      createCard("hearts", "8"),
      createCard("clubs", "9"),
    ],
    roundNumber: overrides?.roundNumber ?? 1,
    isDown: overrides?.isDown ?? false,
    laidDownThisTurn: overrides?.laidDownThisTurn ?? false,
    table: overrides?.table ?? [],
    // Extended fields for May I support
    playerOrder: overrides?.playerOrder ?? ["player-0", "player-1", "player-2"],
    playerDownStatus: overrides?.playerDownStatus ?? {
      "player-0": false,
      "player-1": false,
      "player-2": false,
    },
    // Who discarded the top card (previous player)
    lastDiscardedByPlayerId: overrides?.lastDiscardedByPlayerId ?? "player-0",
  };
}

describe("TurnMachine → MayIWindowMachine Integration", () => {
  describe("DRAW_FROM_STOCK triggers May I window", () => {
    it("transitions to mayIWindow state when drawing from stock", () => {
      const input = createTurnInput();
      const actor = createActor(turnMachine, { input }).start();

      actor.send({ type: "DRAW_FROM_STOCK" });

      // Should enter mayIWindow state (not directly to drawn)
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("mayIWindow");

      actor.stop();
    });

    it("invokes mayIWindowMachine in mayIWindow state", () => {
      const input = createTurnInput();
      const actor = createActor(turnMachine, { input }).start();

      actor.send({ type: "DRAW_FROM_STOCK" });

      // Check that mayIWindowMachine is invoked
      const persisted = actor.getPersistedSnapshot() as any;
      expect(persisted.children?.mayIWindow).toBeDefined();
      expect(persisted.children?.mayIWindow?.snapshot).toBeDefined();

      actor.stop();
    });

    it("mayIWindow machine receives correct input", () => {
      const input = createTurnInput({
        playerId: "player-1",
        discard: [createCard("hearts", "8", "discard-top")],
        playerOrder: ["player-0", "player-1", "player-2"],
      });
      const actor = createActor(turnMachine, { input }).start();

      actor.send({ type: "DRAW_FROM_STOCK" });

      // Access mayI window context through persisted snapshot
      const persisted = actor.getPersistedSnapshot() as any;
      const mayISnapshot = persisted.children?.mayIWindow?.snapshot;
      expect(mayISnapshot).toBeDefined();

      const mayIContext = mayISnapshot?.context;
      expect(mayIContext?.discardedCard?.id).toBe("discard-top");
      expect(mayIContext?.currentPlayerId).toBe("player-1");
      expect(mayIContext?.playerOrder).toEqual(["player-0", "player-1", "player-2"]);

      actor.stop();
    });
  });

  describe("DRAW_FROM_DISCARD bypasses May I window", () => {
    it("goes directly to drawn state when drawing from discard", () => {
      const input = createTurnInput({ isDown: false });
      const actor = createActor(turnMachine, { input }).start();

      actor.send({ type: "DRAW_FROM_DISCARD" });

      // Should go directly to drawn (no May I window)
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("drawn");

      actor.stop();
    });

    it("does not invoke mayIWindowMachine when drawing from discard", () => {
      const input = createTurnInput({ isDown: false });
      const actor = createActor(turnMachine, { input }).start();

      actor.send({ type: "DRAW_FROM_DISCARD" });

      const persisted = actor.getPersistedSnapshot() as any;
      expect(persisted.children?.mayIWindow).toBeUndefined();

      actor.stop();
    });
  });

  describe("May I claims during window", () => {
    it("CALL_MAY_I from non-current player is recorded", () => {
      const input = createTurnInput({
        playerId: "player-1",
        playerOrder: ["player-0", "player-1", "player-2"],
      });
      const actor = createActor(turnMachine, { input }).start();

      // Open May I window
      actor.send({ type: "DRAW_FROM_STOCK" });

      // Player 2 calls May I
      actor.send({ type: "CALL_MAY_I", playerId: "player-2" });

      // Check claimant is recorded
      const persisted = actor.getPersistedSnapshot() as any;
      const mayIContext = persisted.children?.mayIWindow?.snapshot?.context;
      expect(mayIContext?.claimants).toContain("player-2");

      actor.stop();
    });

    it("multiple players can call May I", () => {
      const input = createTurnInput({
        playerId: "player-1",
        playerOrder: ["player-0", "player-1", "player-2", "player-3"],
        playerDownStatus: {
          "player-0": false,
          "player-1": false,
          "player-2": false,
          "player-3": false,
        },
        // player-3 discarded, so player-0 and player-2 can both call May I
        lastDiscardedByPlayerId: "player-3",
      });
      const actor = createActor(turnMachine, { input }).start();

      // Open May I window
      actor.send({ type: "DRAW_FROM_STOCK" });

      // Multiple players call May I
      actor.send({ type: "CALL_MAY_I", playerId: "player-2" });
      actor.send({ type: "CALL_MAY_I", playerId: "player-0" });

      const persisted = actor.getPersistedSnapshot() as any;
      const mayIContext = persisted.children?.mayIWindow?.snapshot?.context;
      expect(mayIContext?.claimants).toContain("player-2");
      expect(mayIContext?.claimants).toContain("player-0");

      actor.stop();
    });

    it("down player cannot call May I", () => {
      const input = createTurnInput({
        playerId: "player-1",
        playerOrder: ["player-0", "player-1", "player-2"],
        playerDownStatus: {
          "player-0": false,
          "player-1": false,
          "player-2": true, // player-2 is down
        },
      });
      const actor = createActor(turnMachine, { input }).start();

      // Open May I window
      actor.send({ type: "DRAW_FROM_STOCK" });

      // Player 2 (down) tries to call May I - should be rejected
      actor.send({ type: "CALL_MAY_I", playerId: "player-2" });

      const persisted = actor.getPersistedSnapshot() as any;
      const mayIContext = persisted.children?.mayIWindow?.snapshot?.context;
      expect(mayIContext?.claimants).not.toContain("player-2");

      actor.stop();
    });
  });

  describe("Closing the May I window", () => {
    it("current player DRAW_FROM_STOCK closes window (pass on discard)", () => {
      const input = createTurnInput({ playerId: "player-1" });
      const actor = createActor(turnMachine, { input }).start();

      // Open May I window
      actor.send({ type: "DRAW_FROM_STOCK" });
      expect(actor.getSnapshot().value).toBe("mayIWindow");

      // Current player draws from stock again (closes window, passes on discard)
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-1" });

      // Should transition to drawn state
      expect(actor.getSnapshot().value).toBe("drawn");

      actor.stop();
    });

    it("current player DRAW_FROM_DISCARD claims the discard", () => {
      const input = createTurnInput({
        playerId: "player-1",
        isDown: false, // must not be down to draw from discard
      });
      const actor = createActor(turnMachine, { input }).start();

      // Open May I window
      actor.send({ type: "DRAW_FROM_STOCK" });

      // Current player claims discard
      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-1" });

      // Should transition to drawn state with discard in hand
      expect(actor.getSnapshot().value).toBe("drawn");
      const context = actor.getSnapshot().context;
      // Hand should have the original + drawn from stock + discard
      // Actually, this is complex - let's check that the draw happened
      expect(context.hasDrawn).toBe(true);

      actor.stop();
    });
  });

  describe("May I winner resolution", () => {
    it("winner receives discard card + penalty card", () => {
      const discardTop = createCard("hearts", "8", "discard-top");
      // Current player draws first card, so penalty is second card in stock
      const playerDrawCard = createCard("diamonds", "K", "player-draw");
      const penaltyCard = createCard("hearts", "Q", "penalty-card");
      const input = createTurnInput({
        playerId: "player-1",
        discard: [discardTop],
        stock: [playerDrawCard, penaltyCard, createCard("clubs", "J")],
        playerOrder: ["player-0", "player-1", "player-2"],
      });
      const actor = createActor(turnMachine, { input }).start();

      // Open May I window (player draws playerDrawCard from stock)
      actor.send({ type: "DRAW_FROM_STOCK" });

      // Player 2 calls May I
      actor.send({ type: "CALL_MAY_I", playerId: "player-2" });

      // Current player closes window
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-1" });

      // Turn should complete with handUpdates for May I winner
      // The TurnOutput should include the cards player-2 receives
      // Since turn continues, we need to check the output when turn completes

      // Verify turn reached drawn state
      expect(actor.getSnapshot().value).toBe("drawn");

      // Complete the turn to get output
      actor.send({ type: "SKIP_LAY_DOWN" });
      const context = actor.getSnapshot().context;
      const cardToDiscard = context.hand[0]!;
      actor.send({ type: "DISCARD", cardId: cardToDiscard.id });

      // Now check output
      const output = actor.getSnapshot().output as TurnOutput;
      expect(output).toBeDefined();

      // TurnOutput should have handUpdates for May I winner
      // This is a new field we need to add
      const handUpdates = (output as any).handUpdates;
      expect(handUpdates).toBeDefined();
      expect(handUpdates["player-2"]).toBeDefined();
      expect(handUpdates["player-2"].added).toContainEqual(
        expect.objectContaining({ id: "discard-top" })
      );
      expect(handUpdates["player-2"].added).toContainEqual(
        expect.objectContaining({ id: "penalty-card" })
      );

      actor.stop();
    });

    it("priority goes to player closest to current player", () => {
      const input = createTurnInput({
        playerId: "player-1",
        playerOrder: ["player-0", "player-1", "player-2", "player-3"],
        playerDownStatus: {
          "player-0": false,
          "player-1": false,
          "player-2": false,
          "player-3": false,
        },
      });
      const actor = createActor(turnMachine, { input }).start();

      // Open May I window
      actor.send({ type: "DRAW_FROM_STOCK" });

      // Player 0 and 3 both call May I
      // Player 2 is next after player 1, then player 3, then player 0
      // So if player-0 and player-3 call, player-3 should win (closer to current)
      // Wait, actually player-2 is next, then player-3, then player-0
      // So player-3 is closer than player-0
      actor.send({ type: "CALL_MAY_I", playerId: "player-0" });
      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });

      // Current player closes window
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-1" });

      // Complete turn
      actor.send({ type: "SKIP_LAY_DOWN" });
      const context = actor.getSnapshot().context;
      actor.send({ type: "DISCARD", cardId: context.hand[0]!.id });

      // Player 3 should be the winner (closer in turn order after player-1)
      const output = actor.getSnapshot().output as TurnOutput;
      const handUpdates = (output as any).handUpdates;
      expect(handUpdates["player-3"]).toBeDefined();
      expect(handUpdates["player-0"]).toBeUndefined();

      actor.stop();
    });

    it("no handUpdates when no one calls May I", () => {
      const input = createTurnInput({ playerId: "player-1" });
      const actor = createActor(turnMachine, { input }).start();

      // Open May I window
      actor.send({ type: "DRAW_FROM_STOCK" });

      // No one calls May I, current player closes window
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-1" });

      // Complete turn
      actor.send({ type: "SKIP_LAY_DOWN" });
      const context = actor.getSnapshot().context;
      actor.send({ type: "DISCARD", cardId: context.hand[0]!.id });

      const output = actor.getSnapshot().output as TurnOutput;
      const handUpdates = (output as any).handUpdates;
      // handUpdates should be empty or undefined
      expect(handUpdates === undefined || Object.keys(handUpdates).length === 0).toBe(true);

      actor.stop();
    });
  });

  describe("Turn continues after May I resolution", () => {
    it("current player proceeds to drawn state with stock card", () => {
      const stockTop = createCard("diamonds", "K", "stock-top");
      const input = createTurnInput({
        playerId: "player-1",
        hand: [createCard("hearts", "4")],
        stock: [stockTop, createCard("hearts", "Q")],
      });
      const actor = createActor(turnMachine, { input }).start();

      const handSizeBefore = actor.getSnapshot().context.hand.length;

      // Open May I window
      actor.send({ type: "DRAW_FROM_STOCK" });

      // Current player closes window (taking stock card)
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-1" });

      // Now in drawn state
      expect(actor.getSnapshot().value).toBe("drawn");

      // Hand should have increased by 1 (drew from stock)
      const handSizeAfter = actor.getSnapshot().context.hand.length;
      expect(handSizeAfter).toBe(handSizeBefore + 1);

      // Stock should have decreased
      const stockAfter = actor.getSnapshot().context.stock;
      expect(stockAfter.length).toBeLessThan(input.stock.length);

      actor.stop();
    });

    it("current player can complete normal turn flow after May I", () => {
      const input = createTurnInput({
        playerId: "player-1",
        hand: [
          createCard("hearts", "4"),
          createCard("clubs", "3"),
          createCard("spades", "7"),
        ],
      });
      const actor = createActor(turnMachine, { input }).start();

      // Draw from stock (opens May I window)
      actor.send({ type: "DRAW_FROM_STOCK" });

      // Close window (pass on discard)
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-1" });

      // Now complete normal turn
      expect(actor.getSnapshot().value).toBe("drawn");

      actor.send({ type: "SKIP_LAY_DOWN" });
      expect(actor.getSnapshot().value).toBe("awaitingDiscard");

      const cardId = actor.getSnapshot().context.hand[0]!.id;
      actor.send({ type: "DISCARD", cardId });

      expect(actor.getSnapshot().value).toBe("turnComplete");
      expect(actor.getSnapshot().status).toBe("done");

      actor.stop();
    });
  });

  describe("Stock and discard pile updates", () => {
    it("stock is updated after May I winner receives penalty card", () => {
      const input = createTurnInput({
        playerId: "player-1",
        stock: [
          createCard("diamonds", "K", "stock-1"),
          createCard("hearts", "Q", "stock-2"),
          createCard("clubs", "J", "stock-3"),
        ],
        playerOrder: ["player-0", "player-1", "player-2"],
      });
      const actor = createActor(turnMachine, { input }).start();

      const stockBefore = actor.getSnapshot().context.stock.length;

      // Open May I window
      actor.send({ type: "DRAW_FROM_STOCK" });

      // Player 2 calls May I
      actor.send({ type: "CALL_MAY_I", playerId: "player-2" });

      // Close window
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-1" });

      // Stock should be reduced by 2:
      // - 1 for current player's draw
      // - 1 for May I winner's penalty card
      const stockAfter = actor.getSnapshot().context.stock.length;
      expect(stockAfter).toBe(stockBefore - 2);

      actor.stop();
    });

    it("discard pile top card is removed when May I winner claims it", () => {
      const discardTop = createCard("hearts", "8", "discard-top");
      const input = createTurnInput({
        playerId: "player-1",
        discard: [discardTop, createCard("clubs", "9")],
        playerOrder: ["player-0", "player-1", "player-2"],
      });
      const actor = createActor(turnMachine, { input }).start();

      // Open May I window
      actor.send({ type: "DRAW_FROM_STOCK" });

      // Player 2 calls May I
      actor.send({ type: "CALL_MAY_I", playerId: "player-2" });

      // Close window
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-1" });

      // Discard top should be removed
      const discardAfter = actor.getSnapshot().context.discard;
      expect(discardAfter.find((c) => c.id === "discard-top")).toBeUndefined();

      actor.stop();
    });

    it("discard pile unchanged when no one calls May I", () => {
      const discardTop = createCard("hearts", "8", "discard-top");
      const input = createTurnInput({
        playerId: "player-1",
        discard: [discardTop, createCard("clubs", "9")],
      });
      const actor = createActor(turnMachine, { input }).start();

      // Open May I window
      actor.send({ type: "DRAW_FROM_STOCK" });

      // No claims, close window
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-1" });

      // Discard should be unchanged
      const discardAfter = actor.getSnapshot().context.discard;
      expect(discardAfter[0]?.id).toBe("discard-top");

      actor.stop();
    });
  });

  describe("TurnOutput with handUpdates", () => {
    it("output includes handUpdates field with May I winner cards", () => {
      const discardTop = createCard("hearts", "8", "discard-top");
      // Current player draws first card, penalty is second
      const playerDrawCard = createCard("diamonds", "K", "player-draw");
      const penaltyCard = createCard("clubs", "J", "penalty");
      const input = createTurnInput({
        playerId: "player-1",
        discard: [discardTop],
        stock: [playerDrawCard, penaltyCard, createCard("spades", "9")],
        playerOrder: ["player-0", "player-1", "player-2"],
      });
      const actor = createActor(turnMachine, { input }).start();

      // Open May I window, player-2 claims, close
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "CALL_MAY_I", playerId: "player-2" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-1" });

      // Complete turn
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: actor.getSnapshot().context.hand[0]!.id });

      const output = actor.getSnapshot().output as TurnOutput & {
        handUpdates?: Record<string, { added: Card[] }>;
      };

      // Verify output structure
      expect(output.handUpdates).toBeDefined();
      expect(output.handUpdates!["player-2"]).toBeDefined();
      expect(output.handUpdates!["player-2"]!.added.length).toBe(2);
    });

    it("handUpdates is empty object when no May I claims", () => {
      const input = createTurnInput({ playerId: "player-1" });
      const actor = createActor(turnMachine, { input }).start();

      // Draw, no May I claims, complete turn
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-1" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: actor.getSnapshot().context.hand[0]!.id });

      const output = actor.getSnapshot().output as TurnOutput & {
        handUpdates?: Record<string, { added: Card[] }>;
      };

      expect(
        output.handUpdates === undefined || Object.keys(output.handUpdates).length === 0
      ).toBe(true);
    });
  });

  describe("Edge cases", () => {
    it("handles empty discard pile (no May I available)", () => {
      const input = createTurnInput({
        playerId: "player-1",
        discard: [], // Empty discard
      });
      const actor = createActor(turnMachine, { input }).start();

      // Should still allow draw from stock
      actor.send({ type: "DRAW_FROM_STOCK" });

      // May I window opens but with no card to claim
      // Current player can close immediately
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-1" });

      expect(actor.getSnapshot().value).toBe("drawn");

      actor.stop();
    });

    it("handles stock running low during May I penalty", () => {
      const input = createTurnInput({
        playerId: "player-1",
        stock: [createCard("diamonds", "K")], // Only 1 card
        playerOrder: ["player-0", "player-1", "player-2"],
      });
      const actor = createActor(turnMachine, { input }).start();

      // Open May I window (draws the only stock card)
      actor.send({ type: "DRAW_FROM_STOCK" });

      // Player 2 calls May I
      actor.send({ type: "CALL_MAY_I", playerId: "player-2" });

      // Close window - May I winner should get discard but no penalty (stock empty)
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-1" });

      // Turn should still proceed
      expect(actor.getSnapshot().value).toBe("drawn");

      actor.stop();
    });

    it("current player who is down cannot draw from discard during May I", () => {
      const input = createTurnInput({
        playerId: "player-1",
        isDown: true, // Current player is down
        playerDownStatus: {
          "player-0": false,
          "player-1": true, // Must match isDown
          "player-2": false,
        },
      });
      const actor = createActor(turnMachine, { input }).start();

      // Open May I window
      actor.send({ type: "DRAW_FROM_STOCK" });

      // Try to draw from discard - should fail (player is down)
      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-1" });

      // Should still be in mayIWindow state
      expect(actor.getSnapshot().value).toBe("mayIWindow");

      actor.stop();
    });
  });
});

describe("TurnInput extensions for May I", () => {
  it("TurnInput accepts playerOrder field", () => {
    const input = createTurnInput({
      playerOrder: ["p0", "p1", "p2"],
    });
    expect(input.playerOrder).toEqual(["p0", "p1", "p2"]);
  });

  it("TurnInput accepts playerDownStatus field", () => {
    const input = createTurnInput({
      playerDownStatus: { p0: true, p1: false, p2: false },
    });
    expect(input.playerDownStatus).toEqual({ p0: true, p1: false, p2: false });
  });

  it("TurnInput accepts lastDiscardedByPlayerId field", () => {
    const input = createTurnInput({
      lastDiscardedByPlayerId: "player-0",
    });
    expect(input.lastDiscardedByPlayerId).toBe("player-0");
  });
});

describe("May I window receives correct discardedByPlayerId", () => {
  it("discardedByPlayerId should be the previous player who discarded, not the current player", () => {
    // Scenario: player-0 discarded, now it's player-1's turn
    // When player-1 draws from stock, the May I window should know that player-0 discarded
    const discardedCard = createCard("hearts", "8", "discard-top");
    const input = createTurnInput({
      playerId: "player-1", // Current player
      lastDiscardedByPlayerId: "player-0", // Previous player discarded the top card
      discard: [discardedCard, createCard("clubs", "9")],
      playerOrder: ["player-0", "player-1", "player-2"],
    });

    const actor = createActor(turnMachine, { input });
    actor.start();

    // Draw from stock to open May I window
    actor.send({ type: "DRAW_FROM_STOCK" });

    // Get the May I window's context
    const snapshot = actor.getSnapshot();
    expect(snapshot.value).toBe("mayIWindow");

    // The persisted snapshot contains the invoked May I window's context
    const persisted = actor.getPersistedSnapshot() as any;
    const mayIContext = persisted.children?.mayIWindow?.snapshot?.context;

    // The key assertion: discardedByPlayerId should be player-0 (who discarded)
    // NOT player-1 (the current player)
    expect(mayIContext.discardedByPlayerId).toBe("player-0");
    expect(mayIContext.currentPlayerId).toBe("player-1");
  });

  it("player cannot call May I on their own discard", () => {
    // player-0 discarded, now it's player-1's turn
    // player-0 should not be able to call May I on their own discard
    const discardedCard = createCard("hearts", "8", "discard-top");
    const input = createTurnInput({
      playerId: "player-1",
      lastDiscardedByPlayerId: "player-0",
      discard: [discardedCard],
      playerOrder: ["player-0", "player-1", "player-2"],
    });

    const actor = createActor(turnMachine, { input });
    actor.start();

    // Draw from stock to open May I window
    actor.send({ type: "DRAW_FROM_STOCK" });
    expect(actor.getSnapshot().value).toBe("mayIWindow");

    // player-0 tries to call May I on their own discard - should be rejected
    actor.send({ type: "CALL_MAY_I", playerId: "player-0" });

    // Check that player-0 is NOT in the claimants
    const persisted = actor.getPersistedSnapshot() as any;
    const mayIContext = persisted.children?.mayIWindow?.snapshot?.context;
    expect(mayIContext.claimants).not.toContain("player-0");
  });
});
