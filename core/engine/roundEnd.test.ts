import { describe, it, expect } from "bun:test";
import { createActor } from "xstate";
import { turnMachine, type TurnOutput } from "./turn.machine";
import type { RoundNumber, RoundRecord } from "./engine.types";
import type { Card } from "../card/card.types";
import type { Meld } from "../meld/meld.types";
import {
  processRoundEnd,
  type RoundEndInput,
  type RoundEndResult,
} from "./roundEnd.engine";

/**
 * Phase 4: Round End Tests
 *
 * Tests for round end processing - triggering, scoring, transitions.
 */

let cardId = 0;
function card(rank: Card["rank"], suit: Card["suit"] = "hearts"): Card {
  return { id: `card-${cardId++}`, suit, rank };
}

function joker(): Card {
  return { id: `joker-${cardId++}`, suit: null, rank: "Joker" };
}

function createMeld(type: "set" | "run", cards: Card[], ownerId: string = "player-1"): Meld {
  return {
    id: `meld-${Math.random()}`,
    type,
    cards,
    ownerId,
  };
}

/**
 * Helper to determine if a round should end based on turn output
 */
function shouldRoundEnd(turnOutput: TurnOutput): boolean {
  return turnOutput.wentOut === true;
}

describe("round end trigger", () => {
  describe("triggered by going out", () => {
    it("when any player goes out, round ends immediately", () => {
      // When a turn ends with wentOut: true, the round should end
      const drawnCard = card("5", "spades");
      const input = {
        playerId: "player-1",
        hand: [],
        stock: [drawnCard],
        discard: [card("2", "diamonds")],
        roundNumber: 1 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")])],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: drawnCard.id });

      const output = actor.getSnapshot().output!;
      expect(shouldRoundEnd(output)).toBe(true);
    });

    it("no more turns for remaining players", () => {
      // When wentOut is true, no other players get turns
      // This is enforced by the round machine (not turn machine)
      // Here we verify that wentOut signals the end
      const drawnCard = card("A", "clubs");
      const input = {
        playerId: "player-2",
        hand: [],
        stock: [drawnCard],
        discard: [card("K", "diamonds")],
        roundNumber: 3 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [createMeld("set", [card("7", "clubs"), card("7", "diamonds"), card("7", "hearts")])],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: drawnCard.id });

      // When wentOut is true, round machine should not give turns to remaining players
      expect(actor.getSnapshot().output?.wentOut).toBe(true);
      expect(actor.getSnapshot().output?.hand).toEqual([]);
    });

    it("current turn completes (wentOut state), then round ends", () => {
      // Turn machine reaches wentOut state (final), then round processes end
      const drawnCard = card("9", "hearts");
      const input = {
        playerId: "player-1",
        hand: [],
        stock: [drawnCard],
        discard: [card("Q", "spades")],
        roundNumber: 2 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [createMeld("set", [card("K", "clubs"), card("K", "diamonds"), card("K", "hearts")])],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: drawnCard.id });

      // Turn is complete (status: done) and in wentOut state
      expect(actor.getSnapshot().status).toBe("done");
      expect(actor.getSnapshot().value).toBe("wentOut");
    });

    it("doesn't matter whose turn it was", () => {
      // Any player can go out and trigger round end
      const players = ["player-1", "player-2", "player-3", "player-4"];

      for (const playerId of players) {
        const drawnCard = card("4", "diamonds");
        const input = {
          playerId,
          hand: [],
          stock: [drawnCard],
          discard: [card("J", "clubs")],
          roundNumber: 4 as RoundNumber,
          isDown: true,
          laidDownThisTurn: false,
          table: [createMeld("set", [card("8", "clubs"), card("8", "diamonds"), card("8", "hearts")])],
        };

        const actor = createActor(turnMachine, { input });
        actor.start();
        actor.send({ type: "DRAW_FROM_STOCK" });
        actor.send({ type: "SKIP_LAY_DOWN" });
        actor.send({ type: "DISCARD", cardId: drawnCard.id });

        expect(actor.getSnapshot().output?.wentOut).toBe(true);
        expect(actor.getSnapshot().output?.playerId).toBe(playerId);
      }
    });
  });

  describe("not triggered by other events", () => {
    it("normal turn completion does not end round", () => {
      // Turn ends with cards in hand - round continues
      const input = {
        playerId: "player-1",
        hand: [card("5", "hearts"), card("6", "diamonds")],
        stock: [card("A", "clubs")],
        discard: [card("K", "spades")],
        roundNumber: 1 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")])],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: input.hand[0]!.id });

      const output = actor.getSnapshot().output!;
      expect(shouldRoundEnd(output)).toBe(false);
      expect(output.hand.length).toBeGreaterThan(0);
    });

    it("laying down does not end round", () => {
      // Player lays down contract but still has cards - round continues
      const three1 = card("3", "clubs");
      const three2 = card("3", "diamonds");
      const three3 = card("3", "hearts");
      const four1 = card("4", "clubs");
      const four2 = card("4", "diamonds");
      const four3 = card("4", "hearts");
      const extraCard = card("K", "spades");

      const input = {
        playerId: "player-1",
        hand: [three1, three2, three3, four1, four2, four3, extraCard],
        stock: [card("A", "clubs")],
        discard: [card("Q", "hearts")],
        roundNumber: 1 as RoundNumber,
        isDown: false,
        laidDownThisTurn: false,
        table: [],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set", cardIds: [three1.id, three2.id, three3.id] },
          { type: "set", cardIds: [four1.id, four2.id, four3.id] },
        ],
      });

      // Player is now down but still has cards
      expect(actor.getSnapshot().context.isDown).toBe(true);
      expect(actor.getSnapshot().context.hand.length).toBeGreaterThan(0);

      // Complete turn with discard
      actor.send({ type: "DISCARD", cardId: extraCard.id });

      const output = actor.getSnapshot().output!;
      expect(shouldRoundEnd(output)).toBe(false);
    });

    it("laying off (with cards remaining) does not end round", () => {
      // Player lays off a card but still has more - round continues
      const cardToLayOff = card("3", "spades");
      const extraCard1 = card("K", "hearts");
      const extraCard2 = card("Q", "diamonds");

      const existingSet = createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")]);

      const input = {
        playerId: "player-1",
        hand: [cardToLayOff, extraCard1, extraCard2],
        stock: [card("A", "clubs")],
        discard: [card("J", "spades")],
        roundNumber: 2 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [existingSet],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      // LAY_OFF happens in drawn state (before SKIP_LAY_DOWN)
      actor.send({ type: "LAY_OFF", cardId: cardToLayOff.id, meldId: existingSet.id });

      // Still has cards after lay off: 3 original + 1 draw - 1 layoff = 3
      expect(actor.getSnapshot().context.hand.length).toBe(3);

      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: extraCard1.id });

      const output = actor.getSnapshot().output!;
      expect(shouldRoundEnd(output)).toBe(false);
      expect(output.hand.length).toBe(2); // 3 - 1 discard = 2
    });

    it("only going out (0 cards) ends round", () => {
      // Compare: with cards vs without cards
      const drawnCard = card("7", "clubs");

      // Case 1: Player with 1 card draws and discards - goes out
      const goOutInput = {
        playerId: "player-1",
        hand: [],
        stock: [drawnCard],
        discard: [card("2", "diamonds")],
        roundNumber: 1 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [createMeld("set", [card("K", "clubs"), card("K", "diamonds"), card("K", "hearts")])],
      };

      const goOutActor = createActor(turnMachine, { input: goOutInput });
      goOutActor.start();
      goOutActor.send({ type: "DRAW_FROM_STOCK" });
      goOutActor.send({ type: "SKIP_LAY_DOWN" });
      goOutActor.send({ type: "DISCARD", cardId: drawnCard.id });

      expect(goOutActor.getSnapshot().output?.wentOut).toBe(true);
      expect(goOutActor.getSnapshot().output?.hand.length).toBe(0);

      // Case 2: Player with multiple cards - does not go out
      const extraCard = card("9", "hearts");
      const stayInput = {
        playerId: "player-2",
        hand: [extraCard],
        stock: [card("8", "spades")],
        discard: [card("2", "diamonds")],
        roundNumber: 1 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [createMeld("set", [card("K", "clubs"), card("K", "diamonds"), card("K", "hearts")])],
      };

      const stayActor = createActor(turnMachine, { input: stayInput });
      stayActor.start();
      stayActor.send({ type: "DRAW_FROM_STOCK" });
      stayActor.send({ type: "SKIP_LAY_DOWN" });
      stayActor.send({ type: "DISCARD", cardId: extraCard.id });

      expect(stayActor.getSnapshot().output?.wentOut).toBe(false);
      expect(stayActor.getSnapshot().output?.hand.length).toBe(1);
    });
  });
});

describe("round end processing", () => {
  describe("sequence of operations", () => {
    it("1. Identify winner (player who went out)", () => {
      // The winner is the player who went out (empty hand)
      const input: RoundEndInput = {
        roundNumber: 1 as RoundNumber,
        winnerId: "player-2",
        players: [
          { id: "player-1", hand: [card("K", "hearts"), card("Q", "spades")] },
          { id: "player-2", hand: [] }, // winner
          { id: "player-3", hand: [card("5", "diamonds")] },
        ],
        previousRoundHistory: [],
        previousTotalScores: { "player-1": 0, "player-2": 0, "player-3": 0 },
      };

      const result = processRoundEnd(input);

      expect(result.roundRecord.winnerId).toBe("player-2");
    });

    it("2. Calculate each player's hand score", () => {
      // Each player's hand is scored based on card values
      const input: RoundEndInput = {
        roundNumber: 2 as RoundNumber,
        winnerId: "player-1",
        players: [
          { id: "player-1", hand: [] }, // winner
          { id: "player-2", hand: [card("K", "hearts"), card("Q", "spades")] }, // 10 + 10 = 20
          { id: "player-3", hand: [card("5", "diamonds"), card("3", "clubs")] }, // 5 + 3 = 8
        ],
        previousRoundHistory: [],
        previousTotalScores: { "player-1": 0, "player-2": 0, "player-3": 0 },
      };

      const result = processRoundEnd(input);

      expect(result.roundRecord.scores["player-1"]).toBe(0); // winner
      expect(result.roundRecord.scores["player-2"]).toBe(20);
      expect(result.roundRecord.scores["player-3"]).toBe(8);
    });

    it("3. Create RoundRecord", () => {
      // A RoundRecord is created with roundNumber, scores, winnerId
      const input: RoundEndInput = {
        roundNumber: 3 as RoundNumber,
        winnerId: "player-1",
        players: [
          { id: "player-1", hand: [] },
          { id: "player-2", hand: [card("A", "hearts")] }, // 15
        ],
        previousRoundHistory: [],
        previousTotalScores: { "player-1": 0, "player-2": 0 },
      };

      const result = processRoundEnd(input);

      const record = result.roundRecord;
      expect(record.roundNumber).toBe(3);
      expect(record.winnerId).toBe("player-1");
      expect(record.scores).toEqual({ "player-1": 0, "player-2": 15 });
    });

    it("4. Update total scores", () => {
      // Total scores are accumulated from previous totals + round scores
      const input: RoundEndInput = {
        roundNumber: 2 as RoundNumber,
        winnerId: "player-1",
        players: [
          { id: "player-1", hand: [] },
          { id: "player-2", hand: [card("10", "hearts")] }, // 10
        ],
        previousRoundHistory: [],
        previousTotalScores: { "player-1": 50, "player-2": 30 }, // from previous rounds
      };

      const result = processRoundEnd(input);

      expect(result.updatedTotalScores["player-1"]).toBe(50 + 0); // winner
      expect(result.updatedTotalScores["player-2"]).toBe(30 + 10);
    });

    it("5. Add record to roundHistory", () => {
      // The new record is appended to round history
      const existingRecord: RoundRecord = {
        roundNumber: 1,
        winnerId: "player-2",
        scores: { "player-1": 25, "player-2": 0 },
      };

      const input: RoundEndInput = {
        roundNumber: 2 as RoundNumber,
        winnerId: "player-1",
        players: [
          { id: "player-1", hand: [] },
          { id: "player-2", hand: [card("7", "clubs")] }, // 5
        ],
        previousRoundHistory: [existingRecord],
        previousTotalScores: { "player-1": 25, "player-2": 0 },
      };

      const result = processRoundEnd(input);

      expect(result.updatedRoundHistory.length).toBe(2);
      expect(result.updatedRoundHistory[0]).toEqual(existingRecord);
      expect(result.updatedRoundHistory[1]!.roundNumber).toBe(2);
    });

    it("6. Determine next action (next round or game end)", () => {
      // After rounds 1-5: continue to next round
      // After round 6: game ends
      const inputRound5: RoundEndInput = {
        roundNumber: 5 as RoundNumber,
        winnerId: "player-1",
        players: [
          { id: "player-1", hand: [] },
          { id: "player-2", hand: [card("2", "hearts")] },
        ],
        previousRoundHistory: [],
        previousTotalScores: { "player-1": 0, "player-2": 0 },
      };

      const resultRound5 = processRoundEnd(inputRound5);
      expect(resultRound5.nextAction).toBe("nextRound");

      const inputRound6: RoundEndInput = {
        roundNumber: 6 as RoundNumber,
        winnerId: "player-1",
        players: [
          { id: "player-1", hand: [] },
          { id: "player-2", hand: [card("2", "hearts")] },
        ],
        previousRoundHistory: [],
        previousTotalScores: { "player-1": 0, "player-2": 0 },
      };

      const resultRound6 = processRoundEnd(inputRound6);
      expect(resultRound6.nextAction).toBe("gameEnd");
    });
  });

  describe("all players scored", () => {
    it.todo("winner scores 0", () => {});
    it.todo("all other players score their hand values", () => {});
    it.todo("no player skipped", () => {});
  });
});

describe("RoundRecord", () => {
  describe("structure", () => {
    it.todo("roundNumber: 1-6", () => {});
    it.todo("scores: map of playerId → round score", () => {});
    it.todo("winnerId: player who went out", () => {});
  });

  describe("storage in roundHistory", () => {
    it.todo("roundHistory starts as empty array", () => {});
    it.todo("each round adds one RoundRecord", () => {});
    it.todo("after round 1: roundHistory.length === 1", () => {});
    it.todo("after round 6: roundHistory.length === 6", () => {});
    it.todo("records in order by round number", () => {});
  });

  describe("reconstructing game from history", () => {
    it.todo("can calculate any player's score at any point", () => {});
    it.todo("can identify who won each round", () => {});
    it.todo("full audit trail of game", () => {});
  });
});

describe("round transition - to next round", () => {
  describe("when rounds 1-5 end", () => {
    it.todo("given: round N ends (where N < 6)", () => {});
    it.todo("then: game continues to round N+1", () => {});
    it.todo("and: currentRound increments", () => {});
  });

  describe("state reset for new round", () => {
    it.todo("all players' isDown reset to false", () => {});
    it.todo("all players' hands cleared", () => {});
    it.todo("table cleared (no melds)", () => {});
    it.todo("turnState reset", () => {});
  });

  describe("dealer rotation", () => {
    it.todo("dealerIndex advances by 1 (clockwise/left)", () => {});
    it.todo("wraps around: if dealer was last player, becomes first", () => {});
    it.todo("example: 4 players, dealer 2 → dealer 3 → dealer 0 → dealer 1", () => {});
  });

  describe("first player", () => {
    it.todo("currentPlayerIndex = (dealerIndex + 1) % playerCount", () => {});
    it.todo("first player is left of dealer", () => {});
  });

  describe("new deck and deal", () => {
    it.todo("new deck created (appropriate for player count)", () => {});
    it.todo("deck shuffled", () => {});
    it.todo("11 cards dealt to each player", () => {});
    it.todo("one card flipped to start discard pile", () => {});
    it.todo("remaining cards become stock", () => {});
  });

  describe("scores preserved", () => {
    it.todo("totalScore for each player unchanged by round transition", () => {});
    it.todo("only roundHistory updated", () => {});
  });
});

describe("round transition - to game end", () => {
  describe("after round 6", () => {
    it.todo("given: round 6 ends", () => {});
    it.todo("then: game does not continue to round 7", () => {});
    it.todo("and: game phase becomes 'gameEnd'", () => {});
  });

  describe("game end state", () => {
    it.todo("final scores calculated (already done via accumulation)", () => {});
    it.todo("winner(s) determined", () => {});
    it.todo("game is complete", () => {});
    it.todo("no more actions possible", () => {});
  });
});

describe("state reset details", () => {
  describe("player state reset", () => {
    it.todo("isDown: false (every player)", () => {});
    it.todo("hand: new 11 cards from deal", () => {});
    it.todo("totalScore: preserved (NOT reset)", () => {});
    it.todo("laidDownThisTurn: false", () => {});
  });

  describe("game state reset", () => {
    it.todo("table: [] (empty, no melds)", () => {});
    it.todo("stock: shuffled deck minus dealt cards minus 1 discard", () => {});
    it.todo("discard: [1 flipped card]", () => {});
    it.todo("currentRound: previous + 1", () => {});
    it.todo("dealerIndex: (previous + 1) % playerCount", () => {});
    it.todo("currentPlayerIndex: (new dealerIndex + 1) % playerCount", () => {});
  });
});
