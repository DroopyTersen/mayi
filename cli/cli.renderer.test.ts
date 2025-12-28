import { describe, it, expect } from "bun:test";
import { renderCard } from "./cli.renderer";
import type { Card } from "../core/card/card.types";

// Helper to create test cards
function card(rank: Card["rank"], suit: Card["suit"] = "hearts"): Card {
  return { id: "test-card", suit, rank };
}

function joker(): Card {
  return { id: "test-joker", suit: null, rank: "Joker" };
}

describe("renderCard", () => {
  it("renders 9H as '9♥'", () => {
    expect(renderCard(card("9", "hearts"))).toBe("9♥");
  });

  it("renders 10D as '10♦'", () => {
    expect(renderCard(card("10", "diamonds"))).toBe("10♦");
  });

  it("renders JS as 'J♠'", () => {
    expect(renderCard(card("J", "spades"))).toBe("J♠");
  });

  it("renders QC as 'Q♣'", () => {
    expect(renderCard(card("Q", "clubs"))).toBe("Q♣");
  });

  it("renders KH as 'K♥'", () => {
    expect(renderCard(card("K", "hearts"))).toBe("K♥");
  });

  it("renders AD as 'A♦'", () => {
    expect(renderCard(card("A", "diamonds"))).toBe("A♦");
  });

  it("renders 2S as '2♠'", () => {
    expect(renderCard(card("2", "spades"))).toBe("2♠");
  });

  it("renders Joker as 'Joker'", () => {
    expect(renderCard(joker())).toBe("Joker");
  });

  it("uses unicode suit symbols", () => {
    expect(renderCard(card("5", "hearts"))).toContain("♥");
    expect(renderCard(card("5", "diamonds"))).toContain("♦");
    expect(renderCard(card("5", "clubs"))).toContain("♣");
    expect(renderCard(card("5", "spades"))).toContain("♠");
  });
});

describe("renderHand", () => {
  it.todo("displays cards in order", () => {});

  it.todo("separates cards with spaces", () => {});

  it.todo("example: '3\u2665 5\u2666 9\u2663 J\u2660 Joker'", () => {});
});

describe("renderNumberedHand (for selection)", () => {
  it.todo("displays position numbers with cards", () => {});

  it.todo(
    "example: '1:3\u2665 2:5\u2666 3:9\u2663 4:J\u2660 5:Joker'",
    () => {}
  );

  it.todo("positions are 1-indexed for human readability", () => {});
});

describe("renderGameState", () => {
  it.todo("shows current round", () => {});

  it.todo("shows all players with card counts", () => {});

  it.todo("shows current player indicator", () => {});

  it.todo("shows discard pile top card", () => {});

  it.todo("shows stock pile count", () => {});

  it.todo("shows current player's hand", () => {});
});
