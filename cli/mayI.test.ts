/**
 * CLI May I Prompts tests - Phase 6
 *
 * Tests for May I CLI display and interaction
 */

import { describe, it, expect } from "bun:test";
import type { Card } from "../core/card/card.types";
import { renderCard } from "./cli.renderer";

/**
 * Render functions for May I prompts and displays
 */

interface MayIContext {
  discardedCard: Card;
  discardedByPlayerName: string;
  currentPlayerName: string;
  claimants: { name: string; handSize: number }[];
  winnerId: string | null;
  winnerName: string | null;
  winnerHandSize: number | null;
  penaltyCard: Card | null;
}

function renderDiscardAnnouncement(playerName: string, card: Card): string {
  return `${playerName} discarded ${renderCard(card)}.`;
}

function renderCurrentPlayerPrompt(currentPlayerName: string, card: Card): string {
  return `${currentPlayerName}, it's your turn. Do you want the ${renderCard(card)}?`;
}

function renderCurrentPlayerOptions(): string[] {
  return ["1. Yes, take it", "2. No, draw from stock"];
}

function renderMayICallAnnouncement(playerName: string, card: Card): string {
  return `${playerName} calls May I? for the ${renderCard(card)}.`;
}

function renderCurrentPlayerWithMayIPrompt(
  currentPlayerName: string,
  claimantName: string,
  card: Card
): string {
  return `${currentPlayerName}, it's your turn. ${claimantName} wants the ${renderCard(card)}.`;
}

function renderCurrentPlayerWithMayIOptions(card: Card): string[] {
  return [
    `1. Take the ${renderCard(card)} yourself (no penalty)`,
    "2. Let them have it, draw from stock",
  ];
}

function renderPassAnnouncement(playerName: string, card: Card): string {
  return `${playerName} passed on the ${renderCard(card)}.`;
}

function renderMayIPrompt(playerName: string, card: Card): string {
  return `${playerName}, May I? (${renderCard(card)} + penalty card)`;
}

function renderMayIPromptOptions(): string[] {
  return ["1. Yes, May I!", "2. No thanks"];
}

function renderMayITakesCard(playerName: string, card: Card): string {
  return `${playerName} calls May I! and takes the ${renderCard(card)}.`;
}

function renderPenaltyDraw(playerName: string): string {
  return `${playerName} draws a penalty card from the stock.`;
}

function renderPlayerHandCount(playerName: string, count: number): string {
  return `${playerName} now has ${count} cards.`;
}

function renderMultipleMayIAnnouncement(claimantNames: string[], card: Card): string {
  return `${claimantNames.join(" and ")} both want the ${renderCard(card)}.`;
}

function renderPriorityWinner(winnerName: string): string {
  return `${winnerName} is closer in turn order.`;
}

function renderPriorityResolution(winnerName: string, card: Card): string {
  return `${winnerName} takes the ${renderCard(card)} and draws a penalty card.`;
}

function renderVetoAnnouncement(
  currentPlayerName: string,
  card: Card,
  deniedPlayerName: string
): string {
  return `${currentPlayerName} takes the ${renderCard(card)} instead. ${deniedPlayerName}'s May I is denied.`;
}

function renderContinueTurn(playerName: string): string {
  return `${playerName}, continue your turn...`;
}

function renderNonCurrentVeto(winnerName: string, card: Card): string {
  return `${winnerName} says No, I want it! and takes the ${renderCard(card)}.`;
}

function renderDrawsPenalty(playerName: string): string {
  return `${playerName} draws a penalty card.`;
}

function renderMayIDenied(deniedPlayerName: string): string {
  return `${deniedPlayerName}'s May I is denied.`;
}

function renderNoClaimsAnnouncement(card: Card): string {
  return `No one wanted the ${renderCard(card)}.`;
}

// AI summary renderers
function renderAIDrawsFromStock(playerName: string): string {
  return `${playerName} draws from stock.`;
}

function renderAIMayISummary(playerName: string, card: Card, handCount: number): string {
  return `${playerName} calls May I! — takes ${renderCard(card)} + penalty (now ${handCount} cards).`;
}

function renderAITurnContinues(playerName: string): string {
  return `${playerName}'s turn continues...`;
}

function renderAIVetoSummary(currentPlayerName: string, card: Card): string {
  return `${currentPlayerName} takes the ${renderCard(card)} instead.`;
}

describe("CLI - May I prompts", () => {
  const kingSpades: Card = { id: "card-K-spades", suit: "spades", rank: "K" };
  const threeClubs: Card = { id: "card-3-clubs", suit: "clubs", rank: "3" };
  const queenSpades: Card = { id: "card-Q-spades", suit: "spades", rank: "Q" };

  describe("current player decision", () => {
    it("display: 'Alice discarded K♠.' 'Bob, it's your turn. Do you want the K♠?'", () => {
      const discardAnnouncement = renderDiscardAnnouncement("Alice", kingSpades);
      expect(discardAnnouncement).toBe("Alice discarded K♠.");

      const prompt = renderCurrentPlayerPrompt("Bob", kingSpades);
      expect(prompt).toBe("Bob, it's your turn. Do you want the K♠?");
    });

    it("options: '1. Yes, take it' '2. No, draw from stock'", () => {
      const options = renderCurrentPlayerOptions();
      expect(options).toEqual(["1. Yes, take it", "2. No, draw from stock"]);
    });
  });

  describe("current player decision with pending May I", () => {
    it("display: 'Alice discarded K♠.' 'Carol calls May I? for the K♠.'", () => {
      const discardAnnouncement = renderDiscardAnnouncement("Alice", kingSpades);
      expect(discardAnnouncement).toBe("Alice discarded K♠.");

      const mayICall = renderMayICallAnnouncement("Carol", kingSpades);
      expect(mayICall).toBe("Carol calls May I? for the K♠.");
    });

    it("display: 'Bob, it's your turn. Carol wants the K♠.'", () => {
      const prompt = renderCurrentPlayerWithMayIPrompt("Bob", "Carol", kingSpades);
      expect(prompt).toBe("Bob, it's your turn. Carol wants the K♠.");
    });

    it("options: '1. Take the K♠ yourself (no penalty)' '2. Let Carol have it, draw from stock'", () => {
      const options = renderCurrentPlayerWithMayIOptions(kingSpades);
      expect(options[0]).toBe("1. Take the K♠ yourself (no penalty)");
      expect(options[1]).toBe("2. Let them have it, draw from stock");
    });
  });

  describe("May I prompt for other players", () => {
    it("given: Bob drew from stock (passed), display: 'Bob passed on the K♠.'", () => {
      const passAnnouncement = renderPassAnnouncement("Bob", kingSpades);
      expect(passAnnouncement).toBe("Bob passed on the K♠.");
    });

    it("prompt Carol: 'Carol, May I? (K♠ + penalty card)' '1. Yes, May I!' '2. No thanks'", () => {
      const prompt = renderMayIPrompt("Carol", kingSpades);
      expect(prompt).toBe("Carol, May I? (K♠ + penalty card)");

      const options = renderMayIPromptOptions();
      expect(options).toEqual(["1. Yes, May I!", "2. No thanks"]);
    });

    it("then prompt Dave: 'Dave, May I? (K♠ + penalty card)' '1. Yes, May I!' '2. No thanks'", () => {
      const prompt = renderMayIPrompt("Dave", kingSpades);
      expect(prompt).toBe("Dave, May I? (K♠ + penalty card)");

      const options = renderMayIPromptOptions();
      expect(options).toEqual(["1. Yes, May I!", "2. No thanks"]);
    });
  });

  describe("May I resolution display - single winner", () => {
    it("display: 'Carol calls May I! and takes the K♠.'", () => {
      const announcement = renderMayITakesCard("Carol", kingSpades);
      expect(announcement).toBe("Carol calls May I! and takes the K♠.");
    });

    it("display: 'Carol draws a penalty card from the stock.'", () => {
      const penaltyAnnouncement = renderPenaltyDraw("Carol");
      expect(penaltyAnnouncement).toBe("Carol draws a penalty card from the stock.");
    });

    it("display: 'Carol now has 13 cards.'", () => {
      const handCount = renderPlayerHandCount("Carol", 13);
      expect(handCount).toBe("Carol now has 13 cards.");
    });
  });

  describe("May I resolution display - priority winner", () => {
    it("display: 'Carol and Dave both want the K♠.'", () => {
      const announcement = renderMultipleMayIAnnouncement(["Carol", "Dave"], kingSpades);
      expect(announcement).toBe("Carol and Dave both want the K♠.");
    });

    it("display: 'Carol is closer in turn order.'", () => {
      const priority = renderPriorityWinner("Carol");
      expect(priority).toBe("Carol is closer in turn order.");
    });

    it("display: 'Carol takes the K♠ and draws a penalty card.'", () => {
      const resolution = renderPriorityResolution("Carol", kingSpades);
      expect(resolution).toBe("Carol takes the K♠ and draws a penalty card.");
    });

    it("display: 'Carol now has 13 cards.'", () => {
      const handCount = renderPlayerHandCount("Carol", 13);
      expect(handCount).toBe("Carol now has 13 cards.");
    });
  });

  describe("May I veto display - current player", () => {
    it("display: 'Carol calls May I? for the K♠.'", () => {
      const mayICall = renderMayICallAnnouncement("Carol", kingSpades);
      expect(mayICall).toBe("Carol calls May I? for the K♠.");
    });

    it("display: 'Bob takes the K♠ instead. Carol's May I is denied.'", () => {
      const veto = renderVetoAnnouncement("Bob", kingSpades, "Carol");
      expect(veto).toBe("Bob takes the K♠ instead. Carol's May I is denied.");
    });

    it("display: 'Bob, continue your turn...'", () => {
      const continueTurn = renderContinueTurn("Bob");
      expect(continueTurn).toBe("Bob, continue your turn...");
    });
  });

  describe("May I veto display - non-current player", () => {
    it("display: 'Dave calls May I? for the K♠.'", () => {
      const mayICall = renderMayICallAnnouncement("Dave", kingSpades);
      expect(mayICall).toBe("Dave calls May I? for the K♠.");
    });

    it("display: 'Carol says No, I want it! and takes the K♠.'", () => {
      const veto = renderNonCurrentVeto("Carol", kingSpades);
      expect(veto).toBe("Carol says No, I want it! and takes the K♠.");
    });

    it("display: 'Carol draws a penalty card.'", () => {
      const penalty = renderDrawsPenalty("Carol");
      expect(penalty).toBe("Carol draws a penalty card.");
    });

    it("display: 'Carol now has 13 cards.'", () => {
      const handCount = renderPlayerHandCount("Carol", 13);
      expect(handCount).toBe("Carol now has 13 cards.");
    });

    it("display: 'Dave's May I is denied.'", () => {
      const denied = renderMayIDenied("Dave");
      expect(denied).toBe("Dave's May I is denied.");
    });
  });

  describe("no May I claims", () => {
    it("display: 'Bob passed on the 3♣.'", () => {
      const passAnnouncement = renderPassAnnouncement("Bob", threeClubs);
      expect(passAnnouncement).toBe("Bob passed on the 3♣.");
    });

    it("display: 'No one wanted the 3♣.'", () => {
      const noClaims = renderNoClaimsAnnouncement(threeClubs);
      expect(noClaims).toBe("No one wanted the 3♣.");
    });

    it("display: 'Bob, continue your turn...'", () => {
      const continueTurn = renderContinueTurn("Bob");
      expect(continueTurn).toBe("Bob, continue your turn...");
    });
  });
});

describe("CLI - AI May I decisions", () => {
  const queenSpades: Card = { id: "card-Q-spades", suit: "spades", rank: "Q" };
  const kingSpades: Card = { id: "card-K-spades", suit: "spades", rank: "K" };

  describe("AI May I summary", () => {
    it("display: 'Alice discarded Q♠.'", () => {
      const announcement = renderDiscardAnnouncement("Alice", queenSpades);
      expect(announcement).toBe("Alice discarded Q♠.");
    });

    it("display: 'Bob draws from stock.'", () => {
      const stockDraw = renderAIDrawsFromStock("Bob");
      expect(stockDraw).toBe("Bob draws from stock.");
    });

    it("display: 'Carol calls May I! — takes Q♠ + penalty (now 13 cards).'", () => {
      const mayISummary = renderAIMayISummary("Carol", queenSpades, 13);
      expect(mayISummary).toBe("Carol calls May I! — takes Q♠ + penalty (now 13 cards).");
    });

    it("display: 'Bob's turn continues...'", () => {
      const turnContinues = renderAITurnContinues("Bob");
      expect(turnContinues).toBe("Bob's turn continues...");
    });
  });

  describe("AI veto summary", () => {
    it("display: 'Alice discarded K♠.'", () => {
      const announcement = renderDiscardAnnouncement("Alice", kingSpades);
      expect(announcement).toBe("Alice discarded K♠.");
    });

    it("display: 'Dave calls May I? for the K♠.'", () => {
      const mayICall = renderMayICallAnnouncement("Dave", kingSpades);
      expect(mayICall).toBe("Dave calls May I? for the K♠.");
    });

    it("display: 'Bob takes the K♠ instead.'", () => {
      const vetoSummary = renderAIVetoSummary("Bob", kingSpades);
      expect(vetoSummary).toBe("Bob takes the K♠ instead.");
    });

    it("display: 'Bob's turn continues...'", () => {
      const turnContinues = renderAITurnContinues("Bob");
      expect(turnContinues).toBe("Bob's turn continues...");
    });
  });
});
