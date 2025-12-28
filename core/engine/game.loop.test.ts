import { describe, it, expect } from "bun:test";
import { advanceTurn } from "./game.loop";
import { createInitialGameState } from "./engine.types";

describe("basic turn loop", () => {
  describe("turn advancement", () => {
    it("after turn completes, currentPlayerIndex advances", () => {
      const state = createInitialGameState({
        playerNames: ["Alice", "Bob", "Carol"],
        dealerIndex: 0,
      });
      // First player is index 1 (left of dealer 0)
      expect(state.currentPlayerIndex).toBe(1);

      const nextState = advanceTurn(state);
      expect(nextState.currentPlayerIndex).toBe(2);
    });

    it("advances clockwise (index + 1, wrapping)", () => {
      const state = createInitialGameState({
        playerNames: ["Alice", "Bob", "Carol"],
        dealerIndex: 0,
      });
      // Start at player 1, advance to 2, then wrap to 0
      let current = state;
      current = advanceTurn(current); // 1 -> 2
      expect(current.currentPlayerIndex).toBe(2);
      current = advanceTurn(current); // 2 -> 0
      expect(current.currentPlayerIndex).toBe(0);
      current = advanceTurn(current); // 0 -> 1
      expect(current.currentPlayerIndex).toBe(1);
    });

    it("with 4 players: 0 -> 1 -> 2 -> 3 -> 0", () => {
      const state = createInitialGameState({
        playerNames: ["Alice", "Bob", "Carol", "Dave"],
        dealerIndex: 3, // So first player is index 0
      });
      expect(state.currentPlayerIndex).toBe(0);

      let current = state;
      current = advanceTurn(current);
      expect(current.currentPlayerIndex).toBe(1);
      current = advanceTurn(current);
      expect(current.currentPlayerIndex).toBe(2);
      current = advanceTurn(current);
      expect(current.currentPlayerIndex).toBe(3);
      current = advanceTurn(current);
      expect(current.currentPlayerIndex).toBe(0);
    });

    it("dealer index doesn't change during round", () => {
      const state = createInitialGameState({
        playerNames: ["Alice", "Bob", "Carol", "Dave"],
        dealerIndex: 2,
      });
      expect(state.dealerIndex).toBe(2);

      let current = state;
      for (let i = 0; i < 8; i++) {
        current = advanceTurn(current);
        expect(current.dealerIndex).toBe(2);
      }
    });
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
