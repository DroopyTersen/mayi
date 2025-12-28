import { describe, it, expect } from "bun:test";
import { calculateHandScore } from "../scoring/scoring";
import {
  calculateRoundScores,
  updateTotalScores,
  determineWinner,
} from "./scoring.engine";
import type { Card } from "../card/card.types";

/**
 * Phase 4: Scoring Tests
 *
 * Tests for scoring functions - calculating hand scores, round scores, and total scores.
 */

let cardId = 0;
function card(rank: Card["rank"], suit: Card["suit"] = "hearts"): Card {
  return { id: `card-${cardId++}`, suit, rank };
}

function joker(): Card {
  return { id: `joker-${cardId++}`, suit: null, rank: "Joker" };
}

describe("calculateHandScore", () => {
  describe("empty hand", () => {
    it("returns 0 for empty hand", () => {
      expect(calculateHandScore([])).toBe(0);
    });

    it("player who went out always scores 0", () => {
      // When a player goes out, they have 0 cards, so their score is 0
      const emptyHand: Card[] = [];
      expect(calculateHandScore(emptyHand)).toBe(0);
    });
  });

  describe("number cards (3-10)", () => {
    it("3♥ = 3 points", () => {
      expect(calculateHandScore([card("3", "hearts")])).toBe(3);
    });

    it("4♦ = 4 points", () => {
      expect(calculateHandScore([card("4", "diamonds")])).toBe(4);
    });

    it("5♣ = 5 points", () => {
      expect(calculateHandScore([card("5", "clubs")])).toBe(5);
    });

    it("6♠ = 6 points", () => {
      expect(calculateHandScore([card("6", "spades")])).toBe(6);
    });

    it("7♥ = 7 points", () => {
      expect(calculateHandScore([card("7", "hearts")])).toBe(7);
    });

    it("8♦ = 8 points", () => {
      expect(calculateHandScore([card("8", "diamonds")])).toBe(8);
    });

    it("9♣ = 9 points", () => {
      expect(calculateHandScore([card("9", "clubs")])).toBe(9);
    });

    it("10♠ = 10 points", () => {
      expect(calculateHandScore([card("10", "spades")])).toBe(10);
    });
  });

  describe("face cards", () => {
    it("J♥ = 10 points", () => {
      expect(calculateHandScore([card("J", "hearts")])).toBe(10);
    });

    it("Q♦ = 10 points", () => {
      expect(calculateHandScore([card("Q", "diamonds")])).toBe(10);
    });

    it("K♣ = 10 points", () => {
      expect(calculateHandScore([card("K", "clubs")])).toBe(10);
    });

    it("J + Q + K = 30 points", () => {
      expect(calculateHandScore([card("J"), card("Q"), card("K")])).toBe(30);
    });
  });

  describe("aces", () => {
    it("A♠ = 15 points", () => {
      expect(calculateHandScore([card("A", "spades")])).toBe(15);
    });

    it("A♥ = 15 points", () => {
      expect(calculateHandScore([card("A", "hearts")])).toBe(15);
    });

    it("A + A = 30 points", () => {
      expect(calculateHandScore([card("A", "spades"), card("A", "hearts")])).toBe(30);
    });
  });

  describe("wild cards", () => {
    it("2♥ = 2 points (wild but low value)", () => {
      expect(calculateHandScore([card("2", "hearts")])).toBe(2);
    });

    it("2♦ = 2 points", () => {
      expect(calculateHandScore([card("2", "diamonds")])).toBe(2);
    });

    it("2♣ = 2 points", () => {
      expect(calculateHandScore([card("2", "clubs")])).toBe(2);
    });

    it("2♠ = 2 points", () => {
      expect(calculateHandScore([card("2", "spades")])).toBe(2);
    });

    it("Joker = 50 points (high risk!)", () => {
      expect(calculateHandScore([joker()])).toBe(50);
    });
  });

  describe("mixed hand totals", () => {
    it("(3♥) = 3", () => {
      expect(calculateHandScore([card("3", "hearts")])).toBe(3);
    });

    it("(3♥, 4♦) = 7", () => {
      expect(calculateHandScore([card("3", "hearts"), card("4", "diamonds")])).toBe(7);
    });

    it("(3♥, 4♦, 5♣) = 12", () => {
      expect(calculateHandScore([card("3", "hearts"), card("4", "diamonds"), card("5", "clubs")])).toBe(12);
    });

    it("(J♥, Q♦, K♣) = 30", () => {
      expect(calculateHandScore([card("J", "hearts"), card("Q", "diamonds"), card("K", "clubs")])).toBe(30);
    });

    it("(A♠, A♥) = 30", () => {
      expect(calculateHandScore([card("A", "spades"), card("A", "hearts")])).toBe(30);
    });

    it("(Joker) = 50", () => {
      expect(calculateHandScore([joker()])).toBe(50);
    });

    it("(Joker, Joker) = 100", () => {
      expect(calculateHandScore([joker(), joker()])).toBe(100);
    });

    it("(2♣, 2♦, 2♥, 2♠) = 8 (all wilds but low total)", () => {
      expect(calculateHandScore([
        card("2", "clubs"),
        card("2", "diamonds"),
        card("2", "hearts"),
        card("2", "spades"),
      ])).toBe(8);
    });
  });

  describe("realistic end-of-round hands", () => {
    it("(3♥, 5♦, 9♣, J♠) = 3 + 5 + 9 + 10 = 27", () => {
      expect(calculateHandScore([
        card("3", "hearts"),
        card("5", "diamonds"),
        card("9", "clubs"),
        card("J", "spades"),
      ])).toBe(27);
    });

    it("(A♦, K♥, Q♠, Joker) = 15 + 10 + 10 + 50 = 85", () => {
      expect(calculateHandScore([
        card("A", "diamonds"),
        card("K", "hearts"),
        card("Q", "spades"),
        joker(),
      ])).toBe(85);
    });

    it("(7♥, 8♥, 9♥, 10♥) = 7 + 8 + 9 + 10 = 34 (almost a run!)", () => {
      expect(calculateHandScore([
        card("7", "hearts"),
        card("8", "hearts"),
        card("9", "hearts"),
        card("10", "hearts"),
      ])).toBe(34);
    });

    it("(K♠, K♥, K♦) = 30 (almost a set!)", () => {
      expect(calculateHandScore([
        card("K", "spades"),
        card("K", "hearts"),
        card("K", "diamonds"),
      ])).toBe(30);
    });

    it("(2♣, 2♦, 2♥) = 6 (wilds but cheap to hold)", () => {
      expect(calculateHandScore([
        card("2", "clubs"),
        card("2", "diamonds"),
        card("2", "hearts"),
      ])).toBe(6);
    });
  });

  describe("worst case hands", () => {
    it("single Joker = 50", () => {
      expect(calculateHandScore([joker()])).toBe(50);
    });

    it("two Jokers = 100", () => {
      expect(calculateHandScore([joker(), joker()])).toBe(100);
    });

    it("three Jokers = 150", () => {
      expect(calculateHandScore([joker(), joker(), joker()])).toBe(150);
    });

    it("Joker + Joker + A + A = 50 + 50 + 15 + 15 = 130", () => {
      expect(calculateHandScore([
        joker(),
        joker(),
        card("A", "spades"),
        card("A", "hearts"),
      ])).toBe(130);
    });

    it("11 Jokers = 550 (theoretical maximum per round)", () => {
      const jokers = Array.from({ length: 11 }, () => joker());
      expect(calculateHandScore(jokers)).toBe(550);
    });
  });

  describe("edge cases", () => {
    it("single card hand", () => {
      expect(calculateHandScore([card("5")])).toBe(5);
    });

    it("hand with all same card type", () => {
      // All 8s
      expect(calculateHandScore([
        card("8", "hearts"),
        card("8", "diamonds"),
        card("8", "clubs"),
        card("8", "spades"),
      ])).toBe(32);
    });

    it("hand with one of each point value", () => {
      // 3 (3 pts), J (10 pts), A (15 pts), Joker (50 pts), 2 (2 pts) = 80
      expect(calculateHandScore([
        card("3"),
        card("J"),
        card("A"),
        joker(),
        card("2"),
      ])).toBe(80);
    });
  });
});

describe("calculateRoundScores", () => {
  describe("basic scoring", () => {
    it("given: player 1 went out, player 2 has cards, player 3 has cards", () => {
      const players = [
        { id: "p1", hand: [] }, // went out
        { id: "p2", hand: [card("5"), card("J")] }, // 5 + 10 = 15
        { id: "p3", hand: [card("A"), card("K")] }, // 15 + 10 = 25
      ];
      const scores = calculateRoundScores(players, "p1");
      expect(scores.p1).toBe(0);
      expect(scores.p2).toBe(15);
      expect(scores.p3).toBe(25);
    });

    it("then: returns { p1: 0, p2: <hand score>, p3: <hand score> }", () => {
      const players = [
        { id: "p1", hand: [] },
        { id: "p2", hand: [card("3")] }, // 3
        { id: "p3", hand: [card("4")] }, // 4
      ];
      const scores = calculateRoundScores(players, "p1");
      expect(scores).toEqual({ p1: 0, p2: 3, p3: 4 });
    });
  });

  describe("structure", () => {
    it("returns object/map of playerId → score", () => {
      const players = [
        { id: "alice", hand: [] },
        { id: "bob", hand: [card("5")] },
      ];
      const scores = calculateRoundScores(players, "alice");
      expect(typeof scores).toBe("object");
      expect("alice" in scores).toBe(true);
      expect("bob" in scores).toBe(true);
    });

    it("includes all players in the game", () => {
      const players = [
        { id: "p1", hand: [] },
        { id: "p2", hand: [card("3")] },
        { id: "p3", hand: [card("4")] },
        { id: "p4", hand: [card("5")] },
      ];
      const scores = calculateRoundScores(players, "p1");
      expect(Object.keys(scores)).toHaveLength(4);
      expect(Object.keys(scores).sort()).toEqual(["p1", "p2", "p3", "p4"]);
    });

    it("winner (went out) always has score 0", () => {
      const players = [
        { id: "winner", hand: [] },
        { id: "loser1", hand: [card("K")] },
        { id: "loser2", hand: [card("A")] },
      ];
      const scores = calculateRoundScores(players, "winner");
      expect(scores.winner).toBe(0);
    });

    it("losers have score = sum of card values in hand", () => {
      const players = [
        { id: "winner", hand: [] },
        { id: "loser", hand: [card("3"), card("4"), card("5")] }, // 12
      ];
      const scores = calculateRoundScores(players, "winner");
      expect(scores.loser).toBe(12);
    });
  });

  describe("multi-player scenarios", () => {
    it("3 players, p1 went out, p2 has 20 pts, p3 has 65 pts", () => {
      const players = [
        { id: "p1", hand: [] },
        { id: "p2", hand: [card("10"), card("10")] }, // 20
        { id: "p3", hand: [card("A"), joker()] }, // 15 + 50 = 65
      ];
      const scores = calculateRoundScores(players, "p1");
      expect(scores).toEqual({ p1: 0, p2: 20, p3: 65 });
    });

    it("4 players, p3 went out, p1 has 3 pts, p2 has 20 pts, p4 has 115 pts", () => {
      const players = [
        { id: "p1", hand: [card("3")] }, // 3
        { id: "p2", hand: [card("J"), card("K")] }, // 20
        { id: "p3", hand: [] },
        { id: "p4", hand: [card("A"), joker(), joker()] }, // 15 + 50 + 50 = 115
      ];
      const scores = calculateRoundScores(players, "p3");
      expect(scores).toEqual({ p1: 3, p2: 20, p3: 0, p4: 115 });
    });
  });

  describe("all players included", () => {
    it("every player has an entry in result", () => {
      const players = [
        { id: "a", hand: [] },
        { id: "b", hand: [card("3")] },
        { id: "c", hand: [card("4")] },
      ];
      const scores = calculateRoundScores(players, "a");
      expect("a" in scores).toBe(true);
      expect("b" in scores).toBe(true);
      expect("c" in scores).toBe(true);
    });

    it("no missing players", () => {
      const players = [
        { id: "p1", hand: [] },
        { id: "p2", hand: [card("5")] },
        { id: "p3", hand: [card("6")] },
      ];
      const scores = calculateRoundScores(players, "p1");
      expect(Object.keys(scores)).toHaveLength(3);
    });

    it("no duplicate entries", () => {
      const players = [
        { id: "p1", hand: [] },
        { id: "p2", hand: [card("3")] },
      ];
      const scores = calculateRoundScores(players, "p1");
      expect(Object.keys(scores)).toEqual(["p1", "p2"]);
    });

    it("no extra players", () => {
      const players = [
        { id: "only-p1", hand: [] },
        { id: "only-p2", hand: [card("3")] },
      ];
      const scores = calculateRoundScores(players, "only-p1");
      expect(Object.keys(scores)).toHaveLength(2);
      expect(Object.keys(scores).sort()).toEqual(["only-p1", "only-p2"]);
    });
  });
});

describe("updateTotalScores", () => {
  describe("first round (starting from 0)", () => {
    it("given: all players start with totalScore: 0", () => {
      const totalScores = { p1: 0, p2: 0, p3: 0 };
      const roundScores = { p1: 0, p2: 25, p3: 40 };
      const updated = updateTotalScores(totalScores, roundScores);
      expect(updated.p1).toBe(0);
    });

    it("and: round scores are { p1: 0, p2: 25, p3: 40 }", () => {
      const totalScores = { p1: 0, p2: 0, p3: 0 };
      const roundScores = { p1: 0, p2: 25, p3: 40 };
      const updated = updateTotalScores(totalScores, roundScores);
      expect(updated.p2).toBe(25);
      expect(updated.p3).toBe(40);
    });

    it("when: updateTotalScores called", () => {
      const totalScores = { p1: 0, p2: 0, p3: 0 };
      const roundScores = { p1: 0, p2: 25, p3: 40 };
      const updated = updateTotalScores(totalScores, roundScores);
      expect(typeof updated).toBe("object");
    });

    it("then: total scores = { p1: 0, p2: 25, p3: 40 }", () => {
      const totalScores = { p1: 0, p2: 0, p3: 0 };
      const roundScores = { p1: 0, p2: 25, p3: 40 };
      const updated = updateTotalScores(totalScores, roundScores);
      expect(updated).toEqual({ p1: 0, p2: 25, p3: 40 });
    });
  });

  describe("subsequent rounds (accumulation)", () => {
    it("given: total scores are { p1: 10, p2: 50, p3: 30 }", () => {
      const totalScores = { p1: 10, p2: 50, p3: 30 };
      const roundScores = { p1: 0, p2: 15, p3: 25 };
      const updated = updateTotalScores(totalScores, roundScores);
      expect(updated.p1).toBe(10);
    });

    it("and: round scores are { p1: 0, p2: 15, p3: 25 }", () => {
      const totalScores = { p1: 10, p2: 50, p3: 30 };
      const roundScores = { p1: 0, p2: 15, p3: 25 };
      const updated = updateTotalScores(totalScores, roundScores);
      expect(updated.p2).toBe(65);
    });

    it("when: updateTotalScores called", () => {
      const totalScores = { p1: 10, p2: 50, p3: 30 };
      const roundScores = { p1: 0, p2: 15, p3: 25 };
      const updated = updateTotalScores(totalScores, roundScores);
      expect(updated).toBeDefined();
    });

    it("then: total scores = { p1: 10, p2: 65, p3: 55 }", () => {
      const totalScores = { p1: 10, p2: 50, p3: 30 };
      const roundScores = { p1: 0, p2: 15, p3: 25 };
      const updated = updateTotalScores(totalScores, roundScores);
      expect(updated).toEqual({ p1: 10, p2: 65, p3: 55 });
    });
  });

  describe("accumulation over multiple rounds", () => {
    it("round 1: { p1: 0, p2: 30, p3: 45 } → totals: { p1: 0, p2: 30, p3: 45 }", () => {
      const totals = { p1: 0, p2: 0, p3: 0 };
      const round1 = { p1: 0, p2: 30, p3: 45 };
      expect(updateTotalScores(totals, round1)).toEqual({ p1: 0, p2: 30, p3: 45 });
    });

    it("round 2: { p1: 25, p2: 0, p3: 60 } → totals: { p1: 25, p2: 30, p3: 105 }", () => {
      const totals = { p1: 0, p2: 30, p3: 45 };
      const round2 = { p1: 25, p2: 0, p3: 60 };
      expect(updateTotalScores(totals, round2)).toEqual({ p1: 25, p2: 30, p3: 105 });
    });

    it("round 3: { p1: 15, p2: 40, p3: 0 } → totals: { p1: 40, p2: 70, p3: 105 }", () => {
      const totals = { p1: 25, p2: 30, p3: 105 };
      const round3 = { p1: 15, p2: 40, p3: 0 };
      expect(updateTotalScores(totals, round3)).toEqual({ p1: 40, p2: 70, p3: 105 });
    });

    it("round 4: { p1: 0, p2: 20, p3: 35 } → totals: { p1: 40, p2: 90, p3: 140 }", () => {
      const totals = { p1: 40, p2: 70, p3: 105 };
      const round4 = { p1: 0, p2: 20, p3: 35 };
      expect(updateTotalScores(totals, round4)).toEqual({ p1: 40, p2: 90, p3: 140 });
    });

    it("round 5: { p1: 50, p2: 0, p3: 10 } → totals: { p1: 90, p2: 90, p3: 150 }", () => {
      const totals = { p1: 40, p2: 90, p3: 140 };
      const round5 = { p1: 50, p2: 0, p3: 10 };
      expect(updateTotalScores(totals, round5)).toEqual({ p1: 90, p2: 90, p3: 150 });
    });

    it("round 6: { p1: 0, p2: 30, p3: 25 } → totals: { p1: 90, p2: 120, p3: 175 }", () => {
      const totals = { p1: 90, p2: 90, p3: 150 };
      const round6 = { p1: 0, p2: 30, p3: 25 };
      expect(updateTotalScores(totals, round6)).toEqual({ p1: 90, p2: 120, p3: 175 });
    });
  });

  describe("player scores only increase", () => {
    it("scores can only go up (or stay same if went out)", () => {
      const totals = { p1: 50 };
      const round = { p1: 0 }; // went out
      expect(updateTotalScores(totals, round).p1).toBe(50);
    });

    it("no mechanism to reduce total score", () => {
      const totals = { p1: 100 };
      const round = { p1: 0 };
      expect(updateTotalScores(totals, round).p1).toBe(100);
    });

    it("going out = 0 points added, not subtraction", () => {
      const totals = { p1: 75, p2: 100 };
      const round = { p1: 0, p2: 25 };
      const updated = updateTotalScores(totals, round);
      expect(updated.p1).toBe(75); // unchanged
      expect(updated.p2).toBe(125); // increased
    });
  });
});

describe("determineWinner", () => {
  describe("single winner (lowest score)", () => {
    it("given: final scores { p1: 120, p2: 85, p3: 200 }", () => {
      const scores = { p1: 120, p2: 85, p3: 200 };
      const winners = determineWinner(scores);
      expect(winners).toContain("p2");
    });

    it("then: winners = [p2]", () => {
      const scores = { p1: 120, p2: 85, p3: 200 };
      const winners = determineWinner(scores);
      expect(winners).toEqual(["p2"]);
    });

    it("and: p2 has lowest score (85)", () => {
      const scores: Record<string, number> = { p1: 120, p2: 85, p3: 200 };
      const winners = determineWinner(scores);
      expect(winners).toHaveLength(1);
      expect(scores[winners[0]!]).toBe(85);
    });
  });

  describe("clear winner examples", () => {
    it("{ p1: 0, p2: 100, p3: 200 } → winner: [p1]", () => {
      expect(determineWinner({ p1: 0, p2: 100, p3: 200 })).toEqual(["p1"]);
    });

    it("{ p1: 50, p2: 51, p3: 52 } → winner: [p1]", () => {
      expect(determineWinner({ p1: 50, p2: 51, p3: 52 })).toEqual(["p1"]);
    });

    it("{ p1: 300, p2: 150, p3: 299 } → winner: [p2]", () => {
      expect(determineWinner({ p1: 300, p2: 150, p3: 299 })).toEqual(["p2"]);
    });
  });

  describe("two-way tie - both win", () => {
    it("given: final scores { p1: 100, p2: 100, p3: 150 }", () => {
      const scores = { p1: 100, p2: 100, p3: 150 };
      const winners = determineWinner(scores);
      expect(winners).toHaveLength(2);
    });

    it("then: winners = [p1, p2]", () => {
      const scores = { p1: 100, p2: 100, p3: 150 };
      const winners = determineWinner(scores);
      expect(winners.sort()).toEqual(["p1", "p2"]);
    });

    it("and: both tied for lowest", () => {
      const scores: Record<string, number> = { p1: 100, p2: 100, p3: 150 };
      const winners = determineWinner(scores);
      expect(scores[winners[0]!]).toBe(100);
      expect(scores[winners[1]!]).toBe(100);
    });

    it("and: both are considered winners", () => {
      const scores = { p1: 100, p2: 100, p3: 150 };
      const winners = determineWinner(scores);
      expect(winners).toContain("p1");
      expect(winners).toContain("p2");
      expect(winners).not.toContain("p3");
    });
  });

  describe("three-way tie - all win", () => {
    it("given: final scores { p1: 80, p2: 80, p3: 80 }", () => {
      const scores = { p1: 80, p2: 80, p3: 80 };
      const winners = determineWinner(scores);
      expect(winners).toHaveLength(3);
    });

    it("then: winners = [p1, p2, p3]", () => {
      const scores = { p1: 80, p2: 80, p3: 80 };
      const winners = determineWinner(scores);
      expect(winners.sort()).toEqual(["p1", "p2", "p3"]);
    });

    it("and: all three win", () => {
      const scores = { p1: 80, p2: 80, p3: 80 };
      const winners = determineWinner(scores);
      expect(winners).toContain("p1");
      expect(winners).toContain("p2");
      expect(winners).toContain("p3");
    });
  });

  describe("tie not for first place", () => {
    it("given: final scores { p1: 50, p2: 100, p3: 100 }", () => {
      const scores = { p1: 50, p2: 100, p3: 100 };
      const winners = determineWinner(scores);
      expect(winners).toEqual(["p1"]);
    });

    it("then: winners = [p1]", () => {
      const scores = { p1: 50, p2: 100, p3: 100 };
      const winners = determineWinner(scores);
      expect(winners).toHaveLength(1);
    });

    it("and: p2 and p3 tied for second place", () => {
      const scores = { p1: 50, p2: 100, p3: 100 };
      const winners = determineWinner(scores);
      expect(winners).not.toContain("p2");
      expect(winners).not.toContain("p3");
    });

    it("and: only p1 is winner", () => {
      const scores = { p1: 50, p2: 100, p3: 100 };
      const winners = determineWinner(scores);
      expect(winners).toEqual(["p1"]);
    });
  });

  describe("perfect game - zero total", () => {
    it("given: player went out all 6 rounds", () => {
      const scores = { p1: 0, p2: 150, p3: 200 };
      const winners = determineWinner(scores);
      expect(winners).toContain("p1");
    });

    it("then: total score = 0", () => {
      const scores: Record<string, number> = { p1: 0, p2: 150, p3: 200 };
      const winners = determineWinner(scores);
      expect(scores[winners[0]!]).toBe(0);
    });

    it("and: this is the best possible score", () => {
      const scores = { p1: 0, p2: 0, p3: 200 };
      const winners = determineWinner(scores);
      expect(winners.sort()).toEqual(["p1", "p2"]);
    });

    it("and: guaranteed winner (or co-winner if tied)", () => {
      const scores = { p1: 0, p2: 0, p3: 0 };
      const winners = determineWinner(scores);
      expect(winners).toHaveLength(3);
    });
  });

  describe("return type", () => {
    it("always returns array of player IDs", () => {
      const scores = { p1: 100, p2: 50 };
      const winners = determineWinner(scores);
      expect(Array.isArray(winners)).toBe(true);
    });

    it("array length >= 1", () => {
      const scores = { p1: 100, p2: 50 };
      const winners = determineWinner(scores);
      expect(winners.length).toBeGreaterThanOrEqual(1);
    });

    it("single winner: array of 1", () => {
      const scores = { p1: 100, p2: 50 };
      const winners = determineWinner(scores);
      expect(winners).toHaveLength(1);
    });

    it("tie: array of 2+", () => {
      const scores = { p1: 50, p2: 50 };
      const winners = determineWinner(scores);
      expect(winners.length).toBeGreaterThanOrEqual(2);
    });
  });
});
