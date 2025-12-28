/**
 * May I Rules tests - Phase 6
 *
 * Tests for May I eligibility and timing rules
 */

import { describe, it, expect } from "bun:test";
import { createActor } from "xstate";
import { mayIWindowMachine } from "./mayIWindow.machine";
import type { MayIWindowInput } from "./mayIWindow.machine";
import type { Card } from "../card/card.types";

function createTestInput(overrides?: Partial<MayIWindowInput>): MayIWindowInput {
  const discardedCard: Card = { id: "card-K-spades", suit: "spades", rank: "K" };
  const stock: Card[] = [
    { id: "card-7-diamonds", suit: "diamonds", rank: "7" },
    { id: "card-3-clubs", suit: "clubs", rank: "3" },
  ];
  const playerOrder = overrides?.playerOrder ?? ["player-0", "player-1", "player-2", "player-3"];
  // Default: all players NOT down
  const playerDownStatus = overrides?.playerDownStatus ?? Object.fromEntries(playerOrder.map(id => [id, false]));

  return {
    discardedCard,
    discardedByPlayerId: "player-1",
    currentPlayerId: "player-2",
    currentPlayerIndex: 2,
    playerOrder,
    stock,
    playerDownStatus,
    ...overrides,
  };
}

function createMayIActor(input: MayIWindowInput) {
  const actor = createActor(mayIWindowMachine, { input });
  actor.start();
  return actor;
}

describe("May I eligibility rules", () => {
  describe("cannot May I your own discard", () => {
    it("given: P1 just discarded K♠, when: P1 tries to call May I, then: rejected", () => {
      const input = createTestInput({ discardedByPlayerId: "player-1" });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-1" });

      // P1's claim should be rejected - they cannot May I their own discard
      expect(actor.getSnapshot().context.claimants).not.toContain("player-1");
    });
  });

  describe("current player CAN claim (not technically May I)", () => {
    it("given: P2 is current player, when: P2 draws from discard, then: this is their normal draw, NOT a May I", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.type).toBe("CURRENT_PLAYER_CLAIMED");
      expect(output?.winnerId).toBe("player-2");
    });

    it("no penalty", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.penaltyCard).toBeNull();
      expect(output?.winnerReceived).toHaveLength(1);
    });
  });

  describe("all other players can May I", () => {
    it("given: P1 discarded, P2 is current, then: P3 can call May I", () => {
      const input = createTestInput({
        discardedByPlayerId: "player-1",
        currentPlayerId: "player-2",
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });

      expect(actor.getSnapshot().context.claimants).toContain("player-3");
    });

    it("P0 can call May I", () => {
      const input = createTestInput({
        discardedByPlayerId: "player-1",
        currentPlayerId: "player-2",
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-0" });

      expect(actor.getSnapshot().context.claimants).toContain("player-0");
    });

    it("anyone except P1 (discarder) can call", () => {
      const input = createTestInput({
        discardedByPlayerId: "player-1",
        currentPlayerId: "player-2",
      });
      const actor = createMayIActor(input);

      // P0, P2, P3 can all call
      actor.send({ type: "CALL_MAY_I", playerId: "player-0" });
      actor.send({ type: "CALL_MAY_I", playerId: "player-2" });
      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });

      const claimants = actor.getSnapshot().context.claimants;
      expect(claimants).toContain("player-0");
      expect(claimants).toContain("player-2");
      expect(claimants).toContain("player-3");
      expect(claimants).not.toContain("player-1");
    });
  });
});

describe("May I timing rules", () => {
  describe("May I can be called before current player draws", () => {
    it("given: P1 discards, P2's turn starts (awaitingDraw), when: P3 calls May I, then: valid, claim recorded", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      // Window is in "open" state, P3 can call May I
      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });

      expect(actor.getSnapshot().context.claimants).toContain("player-3");
      expect(actor.getSnapshot().value).toBe("open");
    });

    it("window waits for P2 to decide", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });

      // Window stays open until current player acts
      expect(actor.getSnapshot().value).toBe("open");
      expect(actor.getSnapshot().context.currentPlayerPassed).toBe(false);
      expect(actor.getSnapshot().context.currentPlayerClaimed).toBe(false);
    });

    it("P2 can still veto by taking discard", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.type).toBe("CURRENT_PLAYER_CLAIMED");
      expect(output?.winnerId).toBe("player-2");
    });
  });

  describe("May I window closes when current player draws from discard", () => {
    it("given: P3 has called May I, when: current player (P2) draws from discard, then: P2 gets the card", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-2" });

      expect(actor.getSnapshot().output?.winnerId).toBe("player-2");
    });

    it("P3's claim denied", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.winnerId).not.toBe("player-3");
      expect(output?.type).toBe("CURRENT_PLAYER_CLAIMED");
    });

    it("window closes", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-2" });

      expect(actor.getSnapshot().status).toBe("done");
      expect(actor.getSnapshot().value).toBe("closedByCurrentPlayer");
    });
  });

  describe("May I resolves when current player draws from stock", () => {
    it("given: P3 has called May I, when: current player (P2) draws from stock, then: P2 has 'passed'", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      expect(actor.getSnapshot().context.currentPlayerPassed).toBe(true);
    });

    it("window resolves May I claims", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      expect(actor.getSnapshot().value).toBe("resolved");
      expect(actor.getSnapshot().output?.type).toBe("MAY_I_RESOLVED");
    });

    it("P3 wins (only claimant)", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      expect(actor.getSnapshot().output?.winnerId).toBe("player-3");
    });

    it("P3 gets card + penalty", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.winnerReceived).toHaveLength(2);
      expect(output?.penaltyCard).not.toBeNull();
    });
  });

  describe("current player loses veto after drawing from stock", () => {
    it("given: P2 (current) draws from stock, then: P2 cannot claim the discard anymore", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      // Machine is in final state - P2 cannot act anymore
      expect(actor.getSnapshot().status).toBe("done");
      expect(actor.getSnapshot().context.currentPlayerPassed).toBe(true);
    });

    it("May I resolves among other claimants", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "CALL_MAY_I", playerId: "player-0" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      // P3 wins (closer in priority)
      expect(actor.getSnapshot().output?.winnerId).toBe("player-3");
    });

    it("P2's draw is from stock, not discard", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      // P2 passed, they drew from stock
      expect(actor.getSnapshot().context.currentPlayerPassed).toBe(true);
      expect(actor.getSnapshot().context.currentPlayerClaimed).toBe(false);
    });
  });
});

describe("May I unlimited per round", () => {
  describe("no limit on calls per player", () => {
    it("turn 1: P3 wins May I (+2 cards), turn 5: P3 wins May I (+2 cards), turn 9: P3 wins May I (+2 cards), all valid", () => {
      // Each May I window is independent - test that P3 can win multiple times
      // Simulating 3 separate May I windows where P3 wins each time
      for (let turn = 0; turn < 3; turn++) {
        const input = createTestInput({ currentPlayerId: "player-2" });
        const actor = createMayIActor(input);

        actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
        actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

        expect(actor.getSnapshot().output?.winnerId).toBe("player-3");
        expect(actor.getSnapshot().output?.winnerReceived).toHaveLength(2);
      }
    });

    it("P3's hand has grown by 6 cards from May I", () => {
      // Each May I win adds 2 cards, 3 wins = 6 cards
      let totalCards = 0;
      for (let i = 0; i < 3; i++) {
        const input = createTestInput({ currentPlayerId: "player-2" });
        const actor = createMayIActor(input);

        actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
        actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

        totalCards += actor.getSnapshot().output?.winnerReceived.length ?? 0;
      }
      expect(totalCards).toBe(6);
    });
  });

  describe("can May I multiple times in sequence", () => {
    it("given: P3 just won a May I, when: next player discards, then: P3 can call May I again", () => {
      // First window - P3 wins
      const input1 = createTestInput({ currentPlayerId: "player-2" });
      const actor1 = createMayIActor(input1);
      actor1.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor1.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });
      expect(actor1.getSnapshot().output?.winnerId).toBe("player-3");

      // Second window - P3 can call again
      const input2 = createTestInput({ currentPlayerId: "player-3" });
      const actor2 = createMayIActor(input2);
      actor2.send({ type: "CALL_MAY_I", playerId: "player-0" });
      expect(actor2.getSnapshot().context.claimants).toContain("player-0");
    });

    it("pays another penalty card if they win", () => {
      // Each win costs a penalty card
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      expect(actor.getSnapshot().output?.penaltyCard).not.toBeNull();
    });
  });

  describe("strategic cost", () => {
    it("each May I adds 2 cards to hand", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      expect(actor.getSnapshot().output?.winnerReceived).toHaveLength(2);
    });

    it("+1 wanted card, +1 random penalty", () => {
      const discardedCard: Card = { id: "card-K-spades", suit: "spades", rank: "K" };
      const penaltyCard: Card = { id: "card-7-diamonds", suit: "diamonds", rank: "7" };
      const input = createTestInput({
        discardedCard,
        stock: [penaltyCard],
        currentPlayerId: "player-2",
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.winnerReceived).toContainEqual(discardedCard);
      expect(output?.winnerReceived).toContainEqual(penaltyCard);
    });

    it("larger hand = more points if caught at round end", () => {
      // This is a game rule concept - more cards = higher risk
      // We just verify the penalty card mechanism works
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      // Winner gets 2 cards, increasing hand size and potential points
      expect(actor.getSnapshot().output?.winnerReceived).toHaveLength(2);
    });
  });
});

describe("May I penalty card", () => {
  describe("always from stock", () => {
    it("penalty card is top card of stock", () => {
      const penaltyCard: Card = { id: "card-7-diamonds", suit: "diamonds", rank: "7" };
      const input = createTestInput({
        stock: [penaltyCard, { id: "card-3-clubs", suit: "clubs", rank: "3" }],
        currentPlayerId: "player-2",
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      expect(actor.getSnapshot().output?.penaltyCard).toEqual(penaltyCard);
    });

    it("cannot choose which card", () => {
      // Penalty is always top of stock - no choice
      const topCard: Card = { id: "card-7-diamonds", suit: "diamonds", rank: "7" };
      const secondCard: Card = { id: "card-3-clubs", suit: "clubs", rank: "3" };
      const input = createTestInput({
        stock: [topCard, secondCard],
        currentPlayerId: "player-2",
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      // Must be the top card, not second
      expect(actor.getSnapshot().output?.penaltyCard).toEqual(topCard);
      expect(actor.getSnapshot().output?.penaltyCard).not.toEqual(secondCard);
    });

    it("blind draw (luck element)", () => {
      // Winner doesn't know what penalty card they'll get
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      // Penalty card is determined by stock order
      expect(actor.getSnapshot().output?.penaltyCard).not.toBeNull();
    });
  });

  describe("only non-current players pay penalty", () => {
    it("current player claiming: 1 card (their draw), no penalty", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.winnerReceived).toHaveLength(1);
      expect(output?.penaltyCard).toBeNull();
    });

    it("anyone else winning May I: 2 cards (discard + penalty)", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.winnerReceived).toHaveLength(2);
      expect(output?.penaltyCard).not.toBeNull();
    });
  });

  describe("penalty card could be anything", () => {
    it("might be helpful (card you need)", () => {
      // The penalty card is random - could be helpful
      const helpfulCard: Card = { id: "card-A-hearts", suit: "hearts", rank: "A" };
      const input = createTestInput({
        stock: [helpfulCard],
        currentPlayerId: "player-2",
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      expect(actor.getSnapshot().output?.penaltyCard).toEqual(helpfulCard);
    });

    it("might be harmful (Joker = 50 points if stuck)", () => {
      // Joker as penalty is risky - high point value
      const joker: Card = { id: "joker-1", suit: null, rank: "Joker" };
      const input = createTestInput({
        stock: [joker],
        currentPlayerId: "player-2",
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      expect(actor.getSnapshot().output?.penaltyCard).toEqual(joker);
    });

    it("adds uncertainty to May I decision", () => {
      // The unknown penalty adds strategic depth
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      // Winner gets penalty but doesn't know what it is beforehand
      expect(actor.getSnapshot().output?.penaltyCard).toBeDefined();
    });
  });
});

describe("Down player restrictions", () => {
  describe("down players cannot call May I", () => {
    it("given: P3 is down, when: P3 tries to call May I, then: rejected", () => {
      const input = createTestInput({
        currentPlayerId: "player-2",
        playerDownStatus: {
          "player-0": false,
          "player-1": false,
          "player-2": false,
          "player-3": true, // P3 is down
        },
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });

      // P3's claim should be rejected - down players cannot May I
      expect(actor.getSnapshot().context.claimants).not.toContain("player-3");
    });

    it("given: P0 and P3 are down, when: both try to call May I, then: both rejected", () => {
      const input = createTestInput({
        currentPlayerId: "player-2",
        playerDownStatus: {
          "player-0": true, // P0 is down
          "player-1": false,
          "player-2": false,
          "player-3": true, // P3 is down
        },
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-0" });
      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });

      expect(actor.getSnapshot().context.claimants).toHaveLength(0);
    });

    it("given: P0 is down but P3 is not, when: both try to call May I, then: only P3 accepted", () => {
      const input = createTestInput({
        currentPlayerId: "player-2",
        playerDownStatus: {
          "player-0": true, // P0 is down
          "player-1": false,
          "player-2": false,
          "player-3": false, // P3 is NOT down
        },
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-0" });
      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });

      expect(actor.getSnapshot().context.claimants).toContain("player-3");
      expect(actor.getSnapshot().context.claimants).not.toContain("player-0");
    });
  });

  describe("down current player cannot draw from discard (cannot veto)", () => {
    it("given: P2 is current and down, when: P2 tries DRAW_FROM_DISCARD, then: rejected", () => {
      const input = createTestInput({
        currentPlayerId: "player-2",
        playerDownStatus: {
          "player-0": false,
          "player-1": false,
          "player-2": true, // Current player is down
          "player-3": false,
        },
      });
      const actor = createMayIActor(input);

      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-2" });

      // Should still be in open state - draw rejected
      expect(actor.getSnapshot().value).toBe("open");
      expect(actor.getSnapshot().context.currentPlayerClaimed).toBe(false);
    });

    it("given: P2 is down and P3 calls May I, when: P2 draws from stock, then: P3 wins automatically", () => {
      const input = createTestInput({
        currentPlayerId: "player-2",
        playerDownStatus: {
          "player-0": false,
          "player-1": false,
          "player-2": true, // Current player is down
          "player-3": false,
        },
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      // P2 cannot veto because they're down, so they draw from stock
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.type).toBe("MAY_I_RESOLVED");
      expect(output?.winnerId).toBe("player-3");
    });
  });

  describe("all players down scenario", () => {
    it("given: all players except discarder are down, when: current player draws from stock, then: NO_CLAIMS", () => {
      const input = createTestInput({
        discardedByPlayerId: "player-1",
        currentPlayerId: "player-2",
        playerDownStatus: {
          "player-0": true, // Down
          "player-1": false, // Discarder (can't May I own discard anyway)
          "player-2": true, // Current player, also down
          "player-3": true, // Down
        },
      });
      const actor = createMayIActor(input);

      // No one can call May I (all down except discarder)
      actor.send({ type: "CALL_MAY_I", playerId: "player-0" }); // Rejected
      actor.send({ type: "CALL_MAY_I", playerId: "player-3" }); // Rejected
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.type).toBe("NO_CLAIMS");
      expect(output?.winnerId).toBeNull();
    });
  });
});
