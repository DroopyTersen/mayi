import { describe, it, expect } from "bun:test";
import { advanceTurn, applyTurnOutput } from "./game.loop";
import { createInitialGameState } from "./engine.types";
import type { Card } from "../card/card.types";
import type { TurnOutput } from "./turn.machine";

// Helper to create test cards
let cardId = 0;
function card(rank: Card["rank"], suit: Card["suit"] = "hearts"): Card {
  return { id: `card-${cardId++}`, suit, rank };
}

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
    it("next player sees updated stock (card removed if drawn from stock)", () => {
      const stockCard1 = card("K");
      const stockCard2 = card("Q");
      const state = createInitialGameState({
        playerNames: ["Alice", "Bob", "Carol"],
      });
      state.stock = [stockCard1, stockCard2];
      state.players[1]!.hand = [card("3"), card("5")];

      // Simulate turn output where player drew from stock
      const output: TurnOutput = {
        playerId: "player-1",
        hand: [card("3"), card("5"), stockCard1], // drew stockCard1
        stock: [stockCard2], // one card removed
        discard: [],
      };

      const updatedState = applyTurnOutput(state, output);
      expect(updatedState.stock).toEqual([stockCard2]);
      expect(updatedState.stock.length).toBe(1);
    });

    it("next player sees updated discard (new card on top)", () => {
      const existingDiscard = card("8");
      const discardedCard = card("3");
      const state = createInitialGameState({
        playerNames: ["Alice", "Bob", "Carol"],
      });
      state.discard = [existingDiscard];

      const output: TurnOutput = {
        playerId: "player-1",
        hand: [card("5")],
        stock: [],
        discard: [discardedCard, existingDiscard], // new card on top
      };

      const updatedState = applyTurnOutput(state, output);
      expect(updatedState.discard[0]).toEqual(discardedCard);
      expect(updatedState.discard[1]).toEqual(existingDiscard);
    });

    it("next player sees previous player's hand size changed", () => {
      const state = createInitialGameState({
        playerNames: ["Alice", "Bob", "Carol"],
      });
      state.players[1]!.hand = [card("3"), card("5"), card("7")];
      expect(state.players[1]!.hand.length).toBe(3);

      // After draw and discard, hand size stays same (draw 1, discard 1)
      const output: TurnOutput = {
        playerId: "player-1",
        hand: [card("3"), card("5"), card("K")], // discarded 7, drew K
        stock: [],
        discard: [],
      };

      const updatedState = applyTurnOutput(state, output);
      expect(updatedState.players[1]!.hand.length).toBe(3);
    });

    it("game state is consistent across turns", () => {
      const state = createInitialGameState({
        playerNames: ["Alice", "Bob", "Carol"],
      });
      const stockCards = [card("K"), card("Q"), card("J")];
      state.stock = [...stockCards];
      state.players[1]!.hand = [card("3"), card("5")];
      state.discard = [card("8")];

      // Player 1 draws from stock, discards a card
      const output: TurnOutput = {
        playerId: "player-1",
        hand: [card("5"), stockCards[0]!], // kept 5, drew K, discarded 3
        stock: [stockCards[1]!, stockCards[2]!],
        discard: [card("3"), card("8")],
      };

      const afterTurn = applyTurnOutput(state, output);
      const afterAdvance = advanceTurn(afterTurn);

      // Verify consistency
      expect(afterAdvance.stock.length).toBe(2);
      expect(afterAdvance.discard.length).toBe(2);
      expect(afterAdvance.players[1]!.hand.length).toBe(2);
      expect(afterAdvance.currentPlayerIndex).toBe(2); // Advanced to next player
    });
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
