import { describe, it, expect } from "bun:test";

describe("basic turn loop", () => {
  describe("turn advancement", () => {
    it.todo("after turn completes, currentPlayerIndex advances", () => {});

    it.todo("advances clockwise (index + 1, wrapping)", () => {});

    it.todo("with 4 players: 0 -> 1 -> 2 -> 3 -> 0", () => {});

    it.todo("dealer index doesn't change during round", () => {});
  });

  describe("state transfer between turns", () => {
    it.todo(
      "next player sees updated stock (card removed if drawn from stock)",
      () => {}
    );

    it.todo("next player sees updated discard (new card on top)", () => {});

    it.todo("next player sees previous player's hand size changed", () => {});

    it.todo("game state is consistent across turns", () => {});
  });

  describe("initial game setup", () => {
    it.todo("after deal, each player has 11 cards", () => {});

    it.todo("stock has remaining cards", () => {});

    it.todo("discard has 1 card (flipped from stock)", () => {});

    it.todo("first player is left of dealer (dealerIndex + 1)", () => {});
  });
});

describe("multiple consecutive turns", () => {
  it.todo(
    "player 1 draws and discards, then player 2's turn starts",
    () => {}
  );

  it.todo(
    "player 2 draws and discards, then player 3's turn starts",
    () => {}
  );

  it.todo(
    "full rotation: all players take one turn, back to player 1",
    () => {}
  );

  it.todo("stock depletes correctly over multiple draws", () => {});

  it.todo("discard grows correctly over multiple discards", () => {});
});
