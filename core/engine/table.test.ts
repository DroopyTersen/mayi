import { describe, it, expect } from "bun:test";
import { createActor } from "xstate";
import { createInitialGameState } from "./engine.types";
import { applyTurnOutput, setupRound, advanceTurn } from "./game.loop";
import { turnMachine } from "./turn.machine";
import type { Card } from "../card/card.types";
import type { Meld } from "../meld/meld.types";

function card(rank: Card["rank"], suit: Card["suit"]): Card {
  return { id: `${rank}-${suit}-${Math.random()}`, rank, suit };
}

function createMeld(ownerId: string, cards: Card[], type: "set" | "run"): Meld {
  return {
    id: `meld-${Math.random()}`,
    type,
    cards,
    ownerId,
  };
}

describe("GameState - table management", () => {
  describe("initial state", () => {
    it("table is empty array at start of round", () => {
      const state = createInitialGameState({
        playerNames: ["Alice", "Bob", "Carol"],
      });
      expect(state.table).toEqual([]);
      expect(state.table.length).toBe(0);
    });

    it("no melds exist before anyone lays down", () => {
      const state = createInitialGameState({
        playerNames: ["Alice", "Bob", "Carol"],
      });
      const readyState = setupRound(state);
      expect(readyState.table).toEqual([]);
      expect(readyState.table.length).toBe(0);
    });
  });

  describe("after first player lays down", () => {
    it("table contains that player's melds", () => {
      const state = createInitialGameState({
        playerNames: ["Alice", "Bob", "Carol"],
      });
      const readyState = setupRound(state);

      // Create melds for player 1 (Bob, left of dealer)
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");

      const meld1 = createMeld("player-1", [nineC, nineD, nineH], "set");
      const meld2 = createMeld("player-1", [kingC, kingD, kingH], "set");

      const output = {
        playerId: "player-1",
        hand: readyState.players[1]!.hand.slice(6), // Remaining cards
        stock: readyState.stock.slice(1),
        discard: [readyState.players[1]!.hand[6]!, ...readyState.discard],
        isDown: true,
        table: [meld1, meld2],
      };

      const afterTurn = applyTurnOutput(readyState, output);
      expect(afterTurn.table.length).toBe(2);
      expect(afterTurn.table).toContain(meld1);
      expect(afterTurn.table).toContain(meld2);
    });

    it("melds have correct ownerId", () => {
      const state = createInitialGameState({
        playerNames: ["Alice", "Bob", "Carol"],
      });
      const readyState = setupRound(state);

      const meld = createMeld("player-1", [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")], "set");

      const output = {
        playerId: "player-1",
        hand: [],
        stock: readyState.stock,
        discard: readyState.discard,
        isDown: true,
        table: [meld],
      };

      const afterTurn = applyTurnOutput(readyState, output);
      expect(afterTurn.table[0]!.ownerId).toBe("player-1");
    });

    it("melds have unique ids", () => {
      const state = createInitialGameState({
        playerNames: ["Alice", "Bob", "Carol"],
      });
      const readyState = setupRound(state);

      const meld1 = createMeld("player-1", [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")], "set");
      const meld2 = createMeld("player-1", [card("K", "clubs"), card("K", "diamonds"), card("K", "hearts")], "set");

      const output = {
        playerId: "player-1",
        hand: [],
        stock: readyState.stock,
        discard: readyState.discard,
        isDown: true,
        table: [meld1, meld2],
      };

      const afterTurn = applyTurnOutput(readyState, output);
      expect(afterTurn.table[0]!.id).not.toBe(afterTurn.table[1]!.id);
    });
  });

  describe("after multiple players lay down", () => {
    it("table contains melds from all players who are down", () => {
      const state = createInitialGameState({
        playerNames: ["Alice", "Bob", "Carol"],
      });
      const readyState = setupRound(state);

      // Player 1 lays down
      const meld1 = createMeld("player-1", [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")], "set");
      const output1 = {
        playerId: "player-1",
        hand: [],
        stock: readyState.stock,
        discard: readyState.discard,
        isDown: true,
        table: [meld1],
      };

      let current = applyTurnOutput(readyState, output1);
      current = advanceTurn(current);

      // Player 2 lays down (their melds are added to existing table)
      const meld2 = createMeld("player-2", [card("K", "clubs"), card("K", "diamonds"), card("K", "hearts")], "set");
      const output2 = {
        playerId: "player-2",
        hand: [],
        stock: current.stock,
        discard: current.discard,
        isDown: true,
        table: [...current.table, meld2], // Include existing melds + new ones
      };

      const afterTurn = applyTurnOutput(current, output2);
      expect(afterTurn.table.length).toBe(2);
      expect(afterTurn.table.some(m => m.ownerId === "player-1")).toBe(true);
      expect(afterTurn.table.some(m => m.ownerId === "player-2")).toBe(true);
    });

    it("melds keep their ownerId", () => {
      const state = createInitialGameState({
        playerNames: ["Alice", "Bob", "Carol"],
      });
      const readyState = setupRound(state);

      const meld1 = createMeld("player-1", [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")], "set");
      const output1 = {
        playerId: "player-1",
        hand: [],
        stock: readyState.stock,
        discard: readyState.discard,
        isDown: true,
        table: [meld1],
      };

      let current = applyTurnOutput(readyState, output1);
      current = advanceTurn(current);

      const meld2 = createMeld("player-2", [card("K", "clubs"), card("K", "diamonds"), card("K", "hearts")], "set");
      const output2 = {
        playerId: "player-2",
        hand: [],
        stock: current.stock,
        discard: current.discard,
        isDown: true,
        table: [...current.table, meld2],
      };

      const afterTurn = applyTurnOutput(current, output2);
      const player1Meld = afterTurn.table.find(m => m.ownerId === "player-1");
      const player2Meld = afterTurn.table.find(m => m.ownerId === "player-2");

      expect(player1Meld).toBeDefined();
      expect(player2Meld).toBeDefined();
      expect(player1Meld!.ownerId).toBe("player-1");
      expect(player2Meld!.ownerId).toBe("player-2");
    });

    it("melds are distinguishable by id", () => {
      const state = createInitialGameState({
        playerNames: ["Alice", "Bob", "Carol"],
      });
      const readyState = setupRound(state);

      const meld1 = createMeld("player-1", [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")], "set");
      const meld2 = createMeld("player-2", [card("K", "clubs"), card("K", "diamonds"), card("K", "hearts")], "set");

      const output = {
        playerId: "player-1",
        hand: [],
        stock: readyState.stock,
        discard: readyState.discard,
        isDown: true,
        table: [meld1, meld2],
      };

      const afterTurn = applyTurnOutput(readyState, output);
      const ids = afterTurn.table.map(m => m.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });

    it("table grows as more players lay down", () => {
      const state = createInitialGameState({
        playerNames: ["Alice", "Bob", "Carol"],
      });
      const readyState = setupRound(state);

      // Initially empty
      expect(readyState.table.length).toBe(0);

      // Player 1 lays down 2 melds
      const meld1a = createMeld("player-1", [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")], "set");
      const meld1b = createMeld("player-1", [card("K", "clubs"), card("K", "diamonds"), card("K", "hearts")], "set");
      const output1 = {
        playerId: "player-1",
        hand: [],
        stock: readyState.stock,
        discard: readyState.discard,
        isDown: true,
        table: [meld1a, meld1b],
      };

      let current = applyTurnOutput(readyState, output1);
      expect(current.table.length).toBe(2);

      current = advanceTurn(current);

      // Player 2 lays down 2 more melds
      const meld2a = createMeld("player-2", [card("Q", "clubs"), card("Q", "diamonds"), card("Q", "hearts")], "set");
      const meld2b = createMeld("player-2", [card("J", "clubs"), card("J", "diamonds"), card("J", "hearts")], "set");
      const output2 = {
        playerId: "player-2",
        hand: [],
        stock: current.stock,
        discard: current.discard,
        isDown: true,
        table: [...current.table, meld2a, meld2b],
      };

      current = applyTurnOutput(current, output2);
      expect(current.table.length).toBe(4);
    });
  });

  describe("table persistence across turns", () => {
    it("table melds persist when turn advances", () => {
      const state = createInitialGameState({
        playerNames: ["Alice", "Bob", "Carol"],
      });
      const readyState = setupRound(state);

      const meld = createMeld("player-1", [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")], "set");
      const output = {
        playerId: "player-1",
        hand: [],
        stock: readyState.stock,
        discard: readyState.discard,
        isDown: true,
        table: [meld],
      };

      const afterTurn = applyTurnOutput(readyState, output);
      expect(afterTurn.table.length).toBe(1);

      const nextTurn = advanceTurn(afterTurn);
      expect(nextTurn.table.length).toBe(1);
      expect(nextTurn.table[0]).toBe(meld);
    });

    it("table melds persist after discards", () => {
      const state = createInitialGameState({
        playerNames: ["Alice", "Bob", "Carol"],
      });
      const readyState = setupRound(state);

      const meld = createMeld("player-1", [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")], "set");
      const output1 = {
        playerId: "player-1",
        hand: readyState.players[1]!.hand.slice(3),
        stock: readyState.stock.slice(1),
        discard: [card("5", "hearts"), ...readyState.discard],
        isDown: true,
        table: [meld],
      };

      const afterLay = applyTurnOutput(readyState, output1);
      expect(afterLay.table.length).toBe(1);

      // Next turn, player doesn't lay down (just draws and discards)
      const afterAdvance = advanceTurn(afterLay);
      const output2 = {
        playerId: "player-2",
        hand: afterAdvance.players[2]!.hand,
        stock: afterAdvance.stock.slice(1),
        discard: [card("7", "spades"), ...afterAdvance.discard],
        isDown: false,
        table: afterAdvance.table, // Table unchanged
      };

      const afterDiscard = applyTurnOutput(afterAdvance, output2);
      expect(afterDiscard.table.length).toBe(1);
      expect(afterDiscard.table[0]).toBe(meld);
    });

    it("table only changes when someone lays down (or lays off in Phase 4)", () => {
      const state = createInitialGameState({
        playerNames: ["Alice", "Bob", "Carol"],
      });
      const readyState = setupRound(state);

      // Player 1 lays down
      const meld = createMeld("player-1", [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")], "set");
      const output1 = {
        playerId: "player-1",
        hand: [],
        stock: readyState.stock,
        discard: readyState.discard,
        isDown: true,
        table: [meld],
      };

      let current = applyTurnOutput(readyState, output1);
      const tableBefore = current.table;

      // Advance turn 3 times without anyone laying down
      for (let i = 0; i < 3; i++) {
        current = advanceTurn(current);
        const playerIndex = current.currentPlayerIndex;
        const output = {
          playerId: current.players[playerIndex]!.id,
          hand: current.players[playerIndex]!.hand,
          stock: current.stock.slice(1),
          discard: [card("3", "clubs"), ...current.discard],
          isDown: current.players[playerIndex]!.isDown,
          table: current.table, // Unchanged
        };
        current = applyTurnOutput(current, output);
      }

      expect(current.table).toBe(tableBefore);
      expect(current.table.length).toBe(1);
    });
  });
});

describe("GameState - isDown tracking", () => {
  describe("initial state", () => {
    it("all players start with isDown: false", () => {
      const state = createInitialGameState({
        playerNames: ["Alice", "Bob", "Carol", "Dave"],
      });
      for (const player of state.players) {
        expect(player.isDown).toBe(false);
      }
    });

    it("at start of each round, isDown resets to false", () => {
      const state = createInitialGameState({
        playerNames: ["Alice", "Bob", "Carol"],
      });
      const readyState = setupRound(state);
      for (const player of readyState.players) {
        expect(player.isDown).toBe(false);
      }
    });
  });

  describe("after laying down", () => {
    it("only the player who laid down has isDown: true", () => {
      const state = createInitialGameState({
        playerNames: ["Alice", "Bob", "Carol"],
      });
      const readyState = setupRound(state);

      const output = {
        playerId: "player-1",
        hand: [],
        stock: readyState.stock,
        discard: readyState.discard,
        isDown: true,
        table: [createMeld("player-1", [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")], "set")],
      };

      const afterTurn = applyTurnOutput(readyState, output);
      expect(afterTurn.players[1]!.isDown).toBe(true);
    });

    it("other players remain isDown: false", () => {
      const state = createInitialGameState({
        playerNames: ["Alice", "Bob", "Carol"],
      });
      const readyState = setupRound(state);

      const output = {
        playerId: "player-1",
        hand: [],
        stock: readyState.stock,
        discard: readyState.discard,
        isDown: true,
        table: [createMeld("player-1", [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")], "set")],
      };

      const afterTurn = applyTurnOutput(readyState, output);
      expect(afterTurn.players[0]!.isDown).toBe(false); // Alice (dealer)
      expect(afterTurn.players[2]!.isDown).toBe(false); // Carol
    });

    it("isDown persists across that player's future turns", () => {
      const state = createInitialGameState({
        playerNames: ["Alice", "Bob", "Carol"],
      });
      const readyState = setupRound(state);

      // Player 1 lays down
      const output1 = {
        playerId: "player-1",
        hand: [],
        stock: readyState.stock,
        discard: readyState.discard,
        isDown: true,
        table: [createMeld("player-1", [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")], "set")],
      };

      let current = applyTurnOutput(readyState, output1);
      expect(current.players[1]!.isDown).toBe(true);

      // Advance through all players back to player 1
      for (let i = 0; i < 3; i++) {
        current = advanceTurn(current);
        const playerIndex = current.currentPlayerIndex;
        const player = current.players[playerIndex]!;
        const output = {
          playerId: player.id,
          hand: player.hand,
          stock: current.stock.slice(1),
          discard: [card("5", "clubs"), ...current.discard],
          isDown: player.isDown, // Maintain their isDown state
          table: current.table,
        };
        current = applyTurnOutput(current, output);
      }

      // Player 1 still down
      expect(current.players[1]!.isDown).toBe(true);
    });
  });

  describe("multiple players down", () => {
    it("each player's isDown tracked independently", () => {
      const state = createInitialGameState({
        playerNames: ["Alice", "Bob", "Carol"],
      });
      const readyState = setupRound(state);

      // Player 1 lays down
      const output1 = {
        playerId: "player-1",
        hand: [],
        stock: readyState.stock,
        discard: readyState.discard,
        isDown: true,
        table: [createMeld("player-1", [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")], "set")],
      };

      let current = applyTurnOutput(readyState, output1);
      current = advanceTurn(current);

      // Player 2 lays down too
      const output2 = {
        playerId: "player-2",
        hand: [],
        stock: current.stock,
        discard: current.discard,
        isDown: true,
        table: [...current.table, createMeld("player-2", [card("K", "clubs"), card("K", "diamonds"), card("K", "hearts")], "set")],
      };

      current = applyTurnOutput(current, output2);

      expect(current.players[1]!.isDown).toBe(true); // Bob
      expect(current.players[2]!.isDown).toBe(true); // Carol
      expect(current.players[0]!.isDown).toBe(false); // Alice (dealer, hasn't had turn)
    });

    it("player A down, player B not down is valid state", () => {
      const state = createInitialGameState({
        playerNames: ["Alice", "Bob", "Carol"],
      });
      const readyState = setupRound(state);

      // Player 1 lays down
      const output1 = {
        playerId: "player-1",
        hand: [],
        stock: readyState.stock,
        discard: readyState.discard,
        isDown: true,
        table: [createMeld("player-1", [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")], "set")],
      };

      let current = applyTurnOutput(readyState, output1);
      current = advanceTurn(current);

      // Player 2 doesn't lay down (just draws and discards)
      const output2 = {
        playerId: "player-2",
        hand: current.players[2]!.hand,
        stock: current.stock.slice(1),
        discard: [card("5", "hearts"), ...current.discard],
        isDown: false,
        table: current.table,
      };

      current = applyTurnOutput(current, output2);

      expect(current.players[1]!.isDown).toBe(true);
      expect(current.players[2]!.isDown).toBe(false);
    });

    it("eventually all players might be down", () => {
      const state = createInitialGameState({
        playerNames: ["Alice", "Bob", "Carol"],
      });
      const readyState = setupRound(state);

      let current = readyState;

      // All 3 players lay down on their turns
      for (let i = 0; i < 3; i++) {
        const playerIndex = current.currentPlayerIndex;
        const playerId = current.players[playerIndex]!.id;

        const output = {
          playerId,
          hand: [],
          stock: current.stock.slice(1),
          discard: [card("5", "hearts"), ...current.discard],
          isDown: true,
          table: [...current.table, createMeld(playerId, [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")], "set")],
        };

        current = applyTurnOutput(current, output);
        current = advanceTurn(current);
      }

      for (const player of current.players) {
        expect(player.isDown).toBe(true);
      }
    });
  });

  describe("round transition", () => {
    it("when round ends, all isDown should reset for next round", () => {
      // Use setupNextRound to verify isDown resets
      const { setupNextRound } = require("./roundEnd.engine");

      // Setup: Round 1 ends, players were down
      const result = setupNextRound({
        previousRound: 1,
        playerIds: ["Alice", "Bob", "Carol"],
        previousDealerIndex: 0,
      });

      // All players should have isDown: false at start of new round
      expect(result.playerStates["Alice"]?.isDown).toBe(false);
      expect(result.playerStates["Bob"]?.isDown).toBe(false);
      expect(result.playerStates["Carol"]?.isDown).toBe(false);

      // Also verify laidDownThisTurn is reset
      expect(result.playerStates["Alice"]?.laidDownThisTurn).toBe(false);
      expect(result.playerStates["Bob"]?.laidDownThisTurn).toBe(false);
      expect(result.playerStates["Carol"]?.laidDownThisTurn).toBe(false);
    });
  });
});
