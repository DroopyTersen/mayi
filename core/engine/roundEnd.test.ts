import { describe, it, expect } from "bun:test";
import { createActor } from "xstate";
import { turnMachine, type TurnOutput } from "./turn.machine";
import type { RoundNumber, RoundRecord } from "./engine.types";
import type { Card } from "../card/card.types";
import type { Meld } from "../meld/meld.types";
import {
  processRoundEnd,
  setupNextRound,
  processGameEnd,
  type RoundEndInput,
  type RoundEndResult,
  type NextRoundInput,
  type NextRoundState,
  type GameEndInput,
  type GameEndResult,
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
    it("winner scores 0", () => {
      const input: RoundEndInput = {
        roundNumber: 1 as RoundNumber,
        winnerId: "player-1",
        players: [
          { id: "player-1", hand: [] }, // Winner
          { id: "player-2", hand: [card("K", "hearts")] },
          { id: "player-3", hand: [card("A", "spades")] },
        ],
        previousRoundHistory: [],
        previousTotalScores: { "player-1": 0, "player-2": 0, "player-3": 0 },
      };

      const result = processRoundEnd(input);
      expect(result.roundRecord.scores["player-1"]).toBe(0);
    });

    it("all other players score their hand values", () => {
      const input: RoundEndInput = {
        roundNumber: 1 as RoundNumber,
        winnerId: "player-1",
        players: [
          { id: "player-1", hand: [] }, // Winner - 0
          { id: "player-2", hand: [card("K", "hearts"), card("5", "diamonds")] }, // 10 + 5 = 15
          { id: "player-3", hand: [card("A", "spades"), card("Joker", null)] }, // 15 + 50 = 65
        ],
        previousRoundHistory: [],
        previousTotalScores: { "player-1": 0, "player-2": 0, "player-3": 0 },
      };

      const result = processRoundEnd(input);
      expect(result.roundRecord.scores["player-2"]).toBe(15);
      expect(result.roundRecord.scores["player-3"]).toBe(65);
    });

    it("no player skipped", () => {
      const input: RoundEndInput = {
        roundNumber: 1 as RoundNumber,
        winnerId: "player-1",
        players: [
          { id: "player-1", hand: [] },
          { id: "player-2", hand: [card("K", "hearts")] },
          { id: "player-3", hand: [card("A", "spades")] },
          { id: "player-4", hand: [card("5", "clubs")] },
        ],
        previousRoundHistory: [],
        previousTotalScores: { "player-1": 0, "player-2": 0, "player-3": 0, "player-4": 0 },
      };

      const result = processRoundEnd(input);
      // All 4 players should have a score entry
      expect(Object.keys(result.roundRecord.scores)).toHaveLength(4);
      expect(result.roundRecord.scores["player-1"]).toBeDefined();
      expect(result.roundRecord.scores["player-2"]).toBeDefined();
      expect(result.roundRecord.scores["player-3"]).toBeDefined();
      expect(result.roundRecord.scores["player-4"]).toBeDefined();
    });
  });
});

describe("RoundRecord", () => {
  describe("structure", () => {
    it("roundNumber: 1-6", () => {
      // RoundRecord contains the round number
      const input: RoundEndInput = {
        roundNumber: 4 as RoundNumber,
        winnerId: "player-1",
        players: [
          { id: "player-1", hand: [] },
          { id: "player-2", hand: [card("5", "hearts")] },
        ],
        previousRoundHistory: [],
        previousTotalScores: { "player-1": 0, "player-2": 0 },
      };

      const result = processRoundEnd(input);
      expect(result.roundRecord.roundNumber).toBe(4);
    });

    it("scores: map of playerId → round score", () => {
      // RoundRecord contains scores for all players
      const input: RoundEndInput = {
        roundNumber: 1 as RoundNumber,
        winnerId: "player-1",
        players: [
          { id: "player-1", hand: [] },
          { id: "player-2", hand: [card("K", "hearts")] }, // 10
          { id: "player-3", hand: [card("A", "spades")] }, // 15
        ],
        previousRoundHistory: [],
        previousTotalScores: { "player-1": 0, "player-2": 0, "player-3": 0 },
      };

      const result = processRoundEnd(input);
      expect(result.roundRecord.scores).toEqual({
        "player-1": 0,
        "player-2": 10,
        "player-3": 15,
      });
    });

    it("winnerId: player who went out", () => {
      // RoundRecord contains the winner's ID
      const input: RoundEndInput = {
        roundNumber: 2 as RoundNumber,
        winnerId: "player-3",
        players: [
          { id: "player-1", hand: [card("7", "clubs")] },
          { id: "player-2", hand: [card("8", "diamonds")] },
          { id: "player-3", hand: [] },
        ],
        previousRoundHistory: [],
        previousTotalScores: { "player-1": 0, "player-2": 0, "player-3": 0 },
      };

      const result = processRoundEnd(input);
      expect(result.roundRecord.winnerId).toBe("player-3");
    });
  });

  describe("storage in roundHistory", () => {
    it("roundHistory starts as empty array", () => {
      // Initial game has no round history
      const input: RoundEndInput = {
        roundNumber: 1 as RoundNumber,
        winnerId: "player-1",
        players: [
          { id: "player-1", hand: [] },
          { id: "player-2", hand: [card("3", "hearts")] },
        ],
        previousRoundHistory: [], // starts empty
        previousTotalScores: { "player-1": 0, "player-2": 0 },
      };

      // After first round, history has one record
      const result = processRoundEnd(input);
      expect(result.updatedRoundHistory.length).toBe(1);
    });

    it("each round adds one RoundRecord", () => {
      // Processing a round adds exactly one record
      const existingRecords: RoundRecord[] = [
        { roundNumber: 1, winnerId: "player-1", scores: { "player-1": 0, "player-2": 15 } },
        { roundNumber: 2, winnerId: "player-2", scores: { "player-1": 20, "player-2": 0 } },
      ];

      const input: RoundEndInput = {
        roundNumber: 3 as RoundNumber,
        winnerId: "player-1",
        players: [
          { id: "player-1", hand: [] },
          { id: "player-2", hand: [card("Q", "spades")] },
        ],
        previousRoundHistory: existingRecords,
        previousTotalScores: { "player-1": 20, "player-2": 15 },
      };

      const result = processRoundEnd(input);
      expect(result.updatedRoundHistory.length).toBe(3); // was 2, now 3
    });

    it("after round 1: roundHistory.length === 1", () => {
      const input: RoundEndInput = {
        roundNumber: 1 as RoundNumber,
        winnerId: "player-1",
        players: [
          { id: "player-1", hand: [] },
          { id: "player-2", hand: [card("4", "clubs")] },
        ],
        previousRoundHistory: [],
        previousTotalScores: { "player-1": 0, "player-2": 0 },
      };

      const result = processRoundEnd(input);
      expect(result.updatedRoundHistory.length).toBe(1);
      expect(result.updatedRoundHistory[0]!.roundNumber).toBe(1);
    });

    it("after round 6: roundHistory.length === 6", () => {
      // Simulate 5 previous rounds
      const previousRecords: RoundRecord[] = [
        { roundNumber: 1, winnerId: "player-1", scores: { "player-1": 0, "player-2": 10 } },
        { roundNumber: 2, winnerId: "player-2", scores: { "player-1": 15, "player-2": 0 } },
        { roundNumber: 3, winnerId: "player-1", scores: { "player-1": 0, "player-2": 20 } },
        { roundNumber: 4, winnerId: "player-2", scores: { "player-1": 25, "player-2": 0 } },
        { roundNumber: 5, winnerId: "player-1", scores: { "player-1": 0, "player-2": 30 } },
      ];

      const input: RoundEndInput = {
        roundNumber: 6 as RoundNumber,
        winnerId: "player-2",
        players: [
          { id: "player-1", hand: [card("J", "hearts")] }, // 10
          { id: "player-2", hand: [] },
        ],
        previousRoundHistory: previousRecords,
        previousTotalScores: { "player-1": 40, "player-2": 60 },
      };

      const result = processRoundEnd(input);
      expect(result.updatedRoundHistory.length).toBe(6);
    });

    it("records in order by round number", () => {
      // Records should be appended in order
      const previousRecords: RoundRecord[] = [
        { roundNumber: 1, winnerId: "player-1", scores: { "player-1": 0, "player-2": 10 } },
        { roundNumber: 2, winnerId: "player-2", scores: { "player-1": 15, "player-2": 0 } },
      ];

      const input: RoundEndInput = {
        roundNumber: 3 as RoundNumber,
        winnerId: "player-1",
        players: [
          { id: "player-1", hand: [] },
          { id: "player-2", hand: [card("6", "diamonds")] },
        ],
        previousRoundHistory: previousRecords,
        previousTotalScores: { "player-1": 15, "player-2": 10 },
      };

      const result = processRoundEnd(input);
      expect(result.updatedRoundHistory[0]!.roundNumber).toBe(1);
      expect(result.updatedRoundHistory[1]!.roundNumber).toBe(2);
      expect(result.updatedRoundHistory[2]!.roundNumber).toBe(3);
    });
  });

  describe("reconstructing game from history", () => {
    const gameHistory: RoundRecord[] = [
      { roundNumber: 1, winnerId: "player-1", scores: { "player-1": 0, "player-2": 25, "player-3": 15 } },
      { roundNumber: 2, winnerId: "player-2", scores: { "player-1": 30, "player-2": 0, "player-3": 20 } },
      { roundNumber: 3, winnerId: "player-3", scores: { "player-1": 10, "player-2": 35, "player-3": 0 } },
    ];

    it("can calculate any player's score at any point", () => {
      // After round 1
      const afterRound1 = gameHistory.slice(0, 1);
      const p1ScoreR1 = afterRound1.reduce((sum, r) => sum + (r.scores["player-1"] ?? 0), 0);
      expect(p1ScoreR1).toBe(0);

      // After round 2
      const afterRound2 = gameHistory.slice(0, 2);
      const p1ScoreR2 = afterRound2.reduce((sum, r) => sum + (r.scores["player-1"] ?? 0), 0);
      expect(p1ScoreR2).toBe(30); // 0 + 30

      // After round 3
      const afterRound3 = gameHistory.slice(0, 3);
      const p1ScoreR3 = afterRound3.reduce((sum, r) => sum + (r.scores["player-1"] ?? 0), 0);
      expect(p1ScoreR3).toBe(40); // 0 + 30 + 10
    });

    it("can identify who won each round", () => {
      expect(gameHistory[0]!.winnerId).toBe("player-1");
      expect(gameHistory[1]!.winnerId).toBe("player-2");
      expect(gameHistory[2]!.winnerId).toBe("player-3");
    });

    it("full audit trail of game", () => {
      // Can verify total scores for all players
      const totalScores = gameHistory.reduce(
        (acc, round) => {
          for (const [playerId, score] of Object.entries(round.scores)) {
            acc[playerId] = (acc[playerId] ?? 0) + score;
          }
          return acc;
        },
        {} as Record<string, number>
      );

      expect(totalScores["player-1"]).toBe(40); // 0 + 30 + 10
      expect(totalScores["player-2"]).toBe(60); // 25 + 0 + 35
      expect(totalScores["player-3"]).toBe(35); // 15 + 20 + 0

      // Can verify number of wins per player
      const winCounts = gameHistory.reduce(
        (acc, round) => {
          acc[round.winnerId] = (acc[round.winnerId] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      expect(winCounts["player-1"]).toBe(1);
      expect(winCounts["player-2"]).toBe(1);
      expect(winCounts["player-3"]).toBe(1);
    });
  });
});

describe("round transition - to next round", () => {
  describe("when rounds 1-5 end", () => {
    it("given: round N ends (where N < 6)", () => {
      // Rounds 1-5 trigger next round setup
      for (const roundNum of [1, 2, 3, 4, 5] as RoundNumber[]) {
        const input: NextRoundInput = {
          previousRound: roundNum,
          playerIds: ["player-1", "player-2"],
          previousDealerIndex: 0,
        };

        const result = setupNextRound(input);
        expect(result.currentRound).toBe((roundNum + 1) as RoundNumber);
      }
    });

    it("then: game continues to round N+1", () => {
      const input: NextRoundInput = {
        previousRound: 3 as RoundNumber,
        playerIds: ["player-1", "player-2", "player-3"],
        previousDealerIndex: 1,
      };

      const result = setupNextRound(input);
      expect(result.currentRound).toBe(4);
    });

    it("and: currentRound increments", () => {
      const input: NextRoundInput = {
        previousRound: 2 as RoundNumber,
        playerIds: ["player-1", "player-2"],
        previousDealerIndex: 0,
      };

      const result = setupNextRound(input);
      expect(result.currentRound).toBe(3);
    });
  });

  describe("state reset for new round", () => {
    it("all players' isDown reset to false", () => {
      const input: NextRoundInput = {
        previousRound: 1 as RoundNumber,
        playerIds: ["player-1", "player-2", "player-3"],
        previousDealerIndex: 0,
      };

      const result = setupNextRound(input);
      for (const playerId of input.playerIds) {
        expect(result.playerStates[playerId]!.isDown).toBe(false);
      }
    });

    it("all players' hands cleared", () => {
      // Players get new hands (11 cards each), not empty
      const input: NextRoundInput = {
        previousRound: 1 as RoundNumber,
        playerIds: ["player-1", "player-2"],
        previousDealerIndex: 0,
      };

      const result = setupNextRound(input);
      for (const playerId of input.playerIds) {
        expect(result.playerStates[playerId]!.hand.length).toBe(11);
      }
    });

    it("table cleared (no melds)", () => {
      const input: NextRoundInput = {
        previousRound: 2 as RoundNumber,
        playerIds: ["player-1", "player-2"],
        previousDealerIndex: 1,
      };

      const result = setupNextRound(input);
      expect(result.table).toEqual([]);
    });

    it("turnState reset", () => {
      // laidDownThisTurn should be false for all players
      const input: NextRoundInput = {
        previousRound: 3 as RoundNumber,
        playerIds: ["player-1", "player-2", "player-3"],
        previousDealerIndex: 2,
      };

      const result = setupNextRound(input);
      for (const playerId of input.playerIds) {
        expect(result.playerStates[playerId]!.laidDownThisTurn).toBe(false);
      }
    });
  });

  describe("dealer rotation", () => {
    it("dealerIndex advances by 1 (clockwise/left)", () => {
      const input: NextRoundInput = {
        previousRound: 1 as RoundNumber,
        playerIds: ["player-1", "player-2", "player-3", "player-4"],
        previousDealerIndex: 0,
      };

      const result = setupNextRound(input);
      expect(result.dealerIndex).toBe(1);
    });

    it("wraps around: if dealer was last player, becomes first", () => {
      const input: NextRoundInput = {
        previousRound: 2 as RoundNumber,
        playerIds: ["player-1", "player-2", "player-3", "player-4"],
        previousDealerIndex: 3, // last player
      };

      const result = setupNextRound(input);
      expect(result.dealerIndex).toBe(0); // wraps to first
    });

    it("example: 4 players, dealer 2 → dealer 3 → dealer 0 → dealer 1", () => {
      const playerIds = ["p0", "p1", "p2", "p3"];

      // dealer 2 → dealer 3
      let result = setupNextRound({
        previousRound: 1 as RoundNumber,
        playerIds,
        previousDealerIndex: 2,
      });
      expect(result.dealerIndex).toBe(3);

      // dealer 3 → dealer 0
      result = setupNextRound({
        previousRound: 2 as RoundNumber,
        playerIds,
        previousDealerIndex: 3,
      });
      expect(result.dealerIndex).toBe(0);

      // dealer 0 → dealer 1
      result = setupNextRound({
        previousRound: 3 as RoundNumber,
        playerIds,
        previousDealerIndex: 0,
      });
      expect(result.dealerIndex).toBe(1);
    });
  });

  describe("first player", () => {
    it("currentPlayerIndex = (dealerIndex + 1) % playerCount", () => {
      const input: NextRoundInput = {
        previousRound: 1 as RoundNumber,
        playerIds: ["player-1", "player-2", "player-3", "player-4"],
        previousDealerIndex: 1, // new dealer will be 2
      };

      const result = setupNextRound(input);
      // new dealer is 2, so first player is (2 + 1) % 4 = 3
      expect(result.currentPlayerIndex).toBe(3);
    });

    it("first player is left of dealer", () => {
      // With dealer at index 3 (4 players), first player wraps to 0
      const input: NextRoundInput = {
        previousRound: 2 as RoundNumber,
        playerIds: ["player-1", "player-2", "player-3", "player-4"],
        previousDealerIndex: 2, // new dealer will be 3
      };

      const result = setupNextRound(input);
      expect(result.dealerIndex).toBe(3);
      expect(result.currentPlayerIndex).toBe(0); // left of dealer 3
    });
  });

  describe("new deck and deal", () => {
    it("new deck created (appropriate for player count)", () => {
      // 2-4 players: 2 decks (108 cards)
      // 5-6 players: 3 decks (162 cards)
      const input2Players: NextRoundInput = {
        previousRound: 1 as RoundNumber,
        playerIds: ["player-1", "player-2"],
        previousDealerIndex: 0,
      };
      const result2 = setupNextRound(input2Players);
      // 2 players * 11 cards + 1 discard + stock = 108 total
      const totalCards2 =
        Object.values(result2.playerStates).reduce((sum, p) => sum + p.hand.length, 0) +
        result2.discard.length +
        result2.stock.length;
      expect(totalCards2).toBe(108);

      const input5Players: NextRoundInput = {
        previousRound: 1 as RoundNumber,
        playerIds: ["p1", "p2", "p3", "p4", "p5"],
        previousDealerIndex: 0,
      };
      const result5 = setupNextRound(input5Players);
      const totalCards5 =
        Object.values(result5.playerStates).reduce((sum, p) => sum + p.hand.length, 0) +
        result5.discard.length +
        result5.stock.length;
      expect(totalCards5).toBe(162);
    });

    it("deck shuffled", () => {
      // Run twice with same input - hands should be different (probabilistically)
      const input: NextRoundInput = {
        previousRound: 1 as RoundNumber,
        playerIds: ["player-1", "player-2"],
        previousDealerIndex: 0,
      };

      const result1 = setupNextRound(input);
      const result2 = setupNextRound(input);

      // Hands should differ (extremely unlikely to be same after shuffle)
      const hand1Ids = result1.playerStates["player-1"]!.hand.map((c) => c.id).join(",");
      const hand2Ids = result2.playerStates["player-1"]!.hand.map((c) => c.id).join(",");
      expect(hand1Ids).not.toBe(hand2Ids);
    });

    it("11 cards dealt to each player", () => {
      const input: NextRoundInput = {
        previousRound: 3 as RoundNumber,
        playerIds: ["player-1", "player-2", "player-3"],
        previousDealerIndex: 1,
      };

      const result = setupNextRound(input);
      for (const playerId of input.playerIds) {
        expect(result.playerStates[playerId]!.hand.length).toBe(11);
      }
    });

    it("one card flipped to start discard pile", () => {
      const input: NextRoundInput = {
        previousRound: 4 as RoundNumber,
        playerIds: ["player-1", "player-2"],
        previousDealerIndex: 0,
      };

      const result = setupNextRound(input);
      expect(result.discard.length).toBe(1);
    });

    it("remaining cards become stock", () => {
      const input: NextRoundInput = {
        previousRound: 5 as RoundNumber,
        playerIds: ["player-1", "player-2", "player-3"],
        previousDealerIndex: 2,
      };

      const result = setupNextRound(input);
      // 108 cards - (3 players * 11 cards) - 1 discard = 74
      expect(result.stock.length).toBe(108 - 33 - 1);
    });
  });

  describe("scores preserved", () => {
    it("totalScore for each player unchanged by round transition", () => {
      // setupNextRound doesn't modify scores - that's handled separately
      // This test verifies the function doesn't include score modification
      const input: NextRoundInput = {
        previousRound: 2 as RoundNumber,
        playerIds: ["player-1", "player-2"],
        previousDealerIndex: 0,
      };

      const result = setupNextRound(input);
      // Result shouldn't have totalScores - those are preserved externally
      expect(result).not.toHaveProperty("totalScores");
    });

    it("only roundHistory updated", () => {
      // setupNextRound doesn't modify round history either
      const input: NextRoundInput = {
        previousRound: 3 as RoundNumber,
        playerIds: ["player-1", "player-2"],
        previousDealerIndex: 1,
      };

      const result = setupNextRound(input);
      expect(result).not.toHaveProperty("roundHistory");
    });
  });
});

describe("round transition - to game end", () => {
  describe("after round 6", () => {
    it("given: round 6 ends", () => {
      // processRoundEnd returns gameEnd as nextAction for round 6
      const input: RoundEndInput = {
        roundNumber: 6 as RoundNumber,
        winnerId: "player-1",
        players: [
          { id: "player-1", hand: [] },
          { id: "player-2", hand: [card("K", "hearts")] },
        ],
        previousRoundHistory: [],
        previousTotalScores: { "player-1": 50, "player-2": 75 },
      };

      const result = processRoundEnd(input);
      expect(result.nextAction).toBe("gameEnd");
    });

    it("then: game does not continue to round 7", () => {
      // After round 6, processRoundEnd signals game end, not next round
      const input: RoundEndInput = {
        roundNumber: 6 as RoundNumber,
        winnerId: "player-2",
        players: [
          { id: "player-1", hand: [card("5", "clubs")] },
          { id: "player-2", hand: [] },
        ],
        previousRoundHistory: [],
        previousTotalScores: { "player-1": 100, "player-2": 80 },
      };

      const result = processRoundEnd(input);
      expect(result.nextAction).not.toBe("nextRound");
      expect(result.nextAction).toBe("gameEnd");
    });

    it("and: game phase becomes 'gameEnd'", () => {
      // processGameEnd returns phase: 'gameEnd'
      const input: GameEndInput = {
        finalScores: { "player-1": 120, "player-2": 95, "player-3": 110 },
        roundHistory: [
          { roundNumber: 1, winnerId: "player-1", scores: { "player-1": 0, "player-2": 25, "player-3": 30 } },
          { roundNumber: 2, winnerId: "player-2", scores: { "player-1": 20, "player-2": 0, "player-3": 15 } },
          { roundNumber: 3, winnerId: "player-3", scores: { "player-1": 15, "player-2": 20, "player-3": 0 } },
          { roundNumber: 4, winnerId: "player-1", scores: { "player-1": 0, "player-2": 10, "player-3": 25 } },
          { roundNumber: 5, winnerId: "player-2", scores: { "player-1": 35, "player-2": 0, "player-3": 20 } },
          { roundNumber: 6, winnerId: "player-3", scores: { "player-1": 50, "player-2": 40, "player-3": 0 } },
        ],
      };

      const result = processGameEnd(input);
      expect(result.phase).toBe("gameEnd");
    });
  });

  describe("game end state", () => {
    it("final scores calculated (already done via accumulation)", () => {
      // Final scores come from accumulated totals, not recalculated
      const input: GameEndInput = {
        finalScores: { "player-1": 85, "player-2": 120 },
        roundHistory: [],
      };

      const result = processGameEnd(input);
      expect(result.finalScores).toEqual({ "player-1": 85, "player-2": 120 });
    });

    it("winner(s) determined", () => {
      // Winner is player(s) with lowest score
      const input: GameEndInput = {
        finalScores: { "player-1": 150, "player-2": 95, "player-3": 130 },
        roundHistory: [],
      };

      const result = processGameEnd(input);
      expect(result.winners).toEqual(["player-2"]);
    });

    it("game is complete", () => {
      // isComplete is true
      const input: GameEndInput = {
        finalScores: { "player-1": 100, "player-2": 100 },
        roundHistory: [],
      };

      const result = processGameEnd(input);
      expect(result.isComplete).toBe(true);
    });

    it("no more actions possible", () => {
      // allowedActions is empty
      const input: GameEndInput = {
        finalScores: { "player-1": 75, "player-2": 80 },
        roundHistory: [],
      };

      const result = processGameEnd(input);
      expect(result.allowedActions).toEqual([]);
    });
  });
});

describe("state reset details", () => {
  describe("player state reset", () => {
    it("isDown: false (every player)", () => {
      const input: NextRoundInput = {
        previousRound: 2 as RoundNumber,
        playerIds: ["player-1", "player-2", "player-3", "player-4"],
        previousDealerIndex: 1,
      };

      const result = setupNextRound(input);

      for (const playerId of input.playerIds) {
        expect(result.playerStates[playerId]!.isDown).toBe(false);
      }
    });

    it("hand: new 11 cards from deal", () => {
      const input: NextRoundInput = {
        previousRound: 3 as RoundNumber,
        playerIds: ["player-1", "player-2"],
        previousDealerIndex: 0,
      };

      const result = setupNextRound(input);

      for (const playerId of input.playerIds) {
        expect(result.playerStates[playerId]!.hand.length).toBe(11);
        // Each card should be a valid card object
        for (const card of result.playerStates[playerId]!.hand) {
          expect(card).toHaveProperty("id");
          expect(card).toHaveProperty("rank");
        }
      }
    });

    it("totalScore: preserved (NOT reset)", () => {
      // setupNextRound doesn't touch scores - they're managed externally
      // This verifies the function doesn't modify or include scores
      const input: NextRoundInput = {
        previousRound: 4 as RoundNumber,
        playerIds: ["player-1", "player-2"],
        previousDealerIndex: 1,
      };

      const result = setupNextRound(input);

      // Result should not contain totalScore - scores preserved separately
      expect(result).not.toHaveProperty("totalScores");
      expect(result.playerStates["player-1"]).not.toHaveProperty("totalScore");
    });

    it("laidDownThisTurn: false", () => {
      const input: NextRoundInput = {
        previousRound: 5 as RoundNumber,
        playerIds: ["player-1", "player-2", "player-3"],
        previousDealerIndex: 2,
      };

      const result = setupNextRound(input);

      for (const playerId of input.playerIds) {
        expect(result.playerStates[playerId]!.laidDownThisTurn).toBe(false);
      }
    });
  });

  describe("game state reset", () => {
    it("table: [] (empty, no melds)", () => {
      const input: NextRoundInput = {
        previousRound: 1 as RoundNumber,
        playerIds: ["player-1", "player-2"],
        previousDealerIndex: 0,
      };

      const result = setupNextRound(input);
      expect(result.table).toEqual([]);
    });

    it("stock: shuffled deck minus dealt cards minus 1 discard", () => {
      const input: NextRoundInput = {
        previousRound: 2 as RoundNumber,
        playerIds: ["player-1", "player-2", "player-3", "player-4"],
        previousDealerIndex: 1,
      };

      const result = setupNextRound(input);

      // 4 players = 2 decks = 108 cards
      // 4 players * 11 cards = 44 dealt
      // 1 discard card
      // Stock should be 108 - 44 - 1 = 63
      expect(result.stock.length).toBe(63);
    });

    it("discard: [1 flipped card]", () => {
      const input: NextRoundInput = {
        previousRound: 3 as RoundNumber,
        playerIds: ["player-1", "player-2"],
        previousDealerIndex: 0,
      };

      const result = setupNextRound(input);
      expect(result.discard.length).toBe(1);
      expect(result.discard[0]).toHaveProperty("id");
      expect(result.discard[0]).toHaveProperty("rank");
    });

    it("currentRound: previous + 1", () => {
      for (const prevRound of [1, 2, 3, 4, 5] as RoundNumber[]) {
        const input: NextRoundInput = {
          previousRound: prevRound,
          playerIds: ["player-1", "player-2"],
          previousDealerIndex: 0,
        };

        const result = setupNextRound(input);
        expect(result.currentRound).toBe((prevRound + 1) as RoundNumber);
      }
    });

    it("dealerIndex: (previous + 1) % playerCount", () => {
      // Test wrap around with 4 players
      const playerIds = ["p0", "p1", "p2", "p3"];

      for (let prevDealer = 0; prevDealer < 4; prevDealer++) {
        const input: NextRoundInput = {
          previousRound: 1 as RoundNumber,
          playerIds,
          previousDealerIndex: prevDealer,
        };

        const result = setupNextRound(input);
        expect(result.dealerIndex).toBe((prevDealer + 1) % 4);
      }
    });

    it("currentPlayerIndex: (new dealerIndex + 1) % playerCount", () => {
      const playerIds = ["p0", "p1", "p2", "p3"];

      // Previous dealer 2 -> new dealer 3 -> first player 0
      const input: NextRoundInput = {
        previousRound: 1 as RoundNumber,
        playerIds,
        previousDealerIndex: 2,
      };

      const result = setupNextRound(input);
      expect(result.dealerIndex).toBe(3);
      expect(result.currentPlayerIndex).toBe(0); // (3 + 1) % 4 = 0
    });
  });
});
