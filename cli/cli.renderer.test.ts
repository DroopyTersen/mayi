import { describe, it, expect } from "bun:test";
import { renderCard, renderHand, renderNumberedHand, renderGameState } from "./cli.renderer";
import type { Card } from "../core/card/card.types";
import { createInitialGameState } from "../core/engine/engine.types";

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
  it("displays cards in order", () => {
    const hand = [
      card("3", "hearts"),
      card("5", "diamonds"),
      card("9", "clubs"),
    ];
    const result = renderHand(hand);
    expect(result.indexOf("3♥")).toBeLessThan(result.indexOf("5♦"));
    expect(result.indexOf("5♦")).toBeLessThan(result.indexOf("9♣"));
  });

  it("separates cards with spaces", () => {
    const hand = [card("3", "hearts"), card("5", "diamonds")];
    expect(renderHand(hand)).toBe("3♥ 5♦");
  });

  it("example: '3♥ 5♦ 9♣ J♠ Joker'", () => {
    const hand = [
      card("3", "hearts"),
      card("5", "diamonds"),
      card("9", "clubs"),
      card("J", "spades"),
      joker(),
    ];
    expect(renderHand(hand)).toBe("3♥ 5♦ 9♣ J♠ Joker");
  });
});

describe("renderNumberedHand (for selection)", () => {
  it("displays position numbers with cards", () => {
    const hand = [card("3", "hearts"), card("5", "diamonds")];
    const result = renderNumberedHand(hand);
    expect(result).toContain("1:");
    expect(result).toContain("2:");
    expect(result).toContain("3♥");
    expect(result).toContain("5♦");
  });

  it("example: '1:3♥ 2:5♦ 3:9♣ 4:J♠ 5:Joker'", () => {
    const hand = [
      card("3", "hearts"),
      card("5", "diamonds"),
      card("9", "clubs"),
      card("J", "spades"),
      joker(),
    ];
    expect(renderNumberedHand(hand)).toBe("1:3♥ 2:5♦ 3:9♣ 4:J♠ 5:Joker");
  });

  it("positions are 1-indexed for human readability", () => {
    const hand = [card("A", "spades")];
    const result = renderNumberedHand(hand);
    expect(result).toBe("1:A♠");
    expect(result).not.toContain("0:");
  });
});

describe("renderGameState", () => {
  it("shows current round", () => {
    const state = createInitialGameState({
      playerNames: ["Alice", "Bob", "Carol"],
    });
    const result = renderGameState(state);
    expect(result).toContain("Round 1 of 6");
  });

  it("shows all players with card counts", () => {
    const state = createInitialGameState({
      playerNames: ["Alice", "Bob", "Carol"],
    });
    state.players[0]!.hand = [card("3"), card("5")];
    state.players[1]!.hand = [card("7"), card("9"), card("J")];
    state.players[2]!.hand = [card("K")];

    const result = renderGameState(state);
    expect(result).toContain("Alice: 2 cards");
    expect(result).toContain("Bob: 3 cards");
    expect(result).toContain("Carol: 1 cards");
  });

  it("shows current player indicator", () => {
    const state = createInitialGameState({
      playerNames: ["Alice", "Bob", "Carol"],
      dealerIndex: 0,
    });
    // Current player is index 1 (Bob)
    const result = renderGameState(state);
    expect(result).toContain("→ Bob");
    expect(result).not.toContain("→ Alice");
    expect(result).not.toContain("→ Carol");
  });

  it("shows discard pile top card", () => {
    const state = createInitialGameState({
      playerNames: ["Alice", "Bob", "Carol"],
    });
    state.discard = [card("K", "clubs"), card("5", "hearts")];

    const result = renderGameState(state);
    expect(result).toContain("DISCARD: K♣");
  });

  it("shows stock pile count", () => {
    const state = createInitialGameState({
      playerNames: ["Alice", "Bob", "Carol"],
    });
    state.stock = [card("3"), card("5"), card("7"), card("9"), card("J")];

    const result = renderGameState(state);
    expect(result).toContain("STOCK: 5 cards");
  });

  it("shows current player's hand", () => {
    const state = createInitialGameState({
      playerNames: ["Alice", "Bob", "Carol"],
      dealerIndex: 0,
    });
    // Current player is Bob (index 1)
    state.players[1]!.hand = [card("3", "hearts"), card("K", "spades"), joker()];

    const result = renderGameState(state);
    expect(result).toContain("Your hand: 3♥ K♠ Joker");
  });
});
