import { describe, it, expect } from "bun:test";
import {
  createInitialGameState,
  type GameState,
  type Player,
  type TurnState,
} from "./engine.types";

describe("GameState structure", () => {
  const gameState = createInitialGameState({
    playerNames: ["Alice", "Bob", "Carol"],
  });

  it("gameId is a non-empty string", () => {
    expect(typeof gameState.gameId).toBe("string");
    expect(gameState.gameId.length).toBeGreaterThan(0);
  });

  it("currentRound is 1-6", () => {
    expect(gameState.currentRound).toBeGreaterThanOrEqual(1);
    expect(gameState.currentRound).toBeLessThanOrEqual(6);
  });

  it("players is an array of Player objects", () => {
    expect(Array.isArray(gameState.players)).toBe(true);
    expect(gameState.players.length).toBe(3);
    for (const player of gameState.players) {
      expect(typeof player.id).toBe("string");
      expect(typeof player.name).toBe("string");
      expect(Array.isArray(player.hand)).toBe(true);
      expect(typeof player.isDown).toBe("boolean");
      expect(typeof player.totalScore).toBe("number");
    }
  });

  it("currentPlayerIndex is valid index into players array", () => {
    expect(gameState.currentPlayerIndex).toBeGreaterThanOrEqual(0);
    expect(gameState.currentPlayerIndex).toBeLessThan(gameState.players.length);
  });

  it("dealerIndex is valid index into players array", () => {
    expect(gameState.dealerIndex).toBeGreaterThanOrEqual(0);
    expect(gameState.dealerIndex).toBeLessThan(gameState.players.length);
  });

  it("stock is an array of Cards", () => {
    expect(Array.isArray(gameState.stock)).toBe(true);
  });

  it("discard is an array of Cards (top card is index 0)", () => {
    expect(Array.isArray(gameState.discard)).toBe(true);
  });

  it("table is an array of Melds (empty initially)", () => {
    expect(Array.isArray(gameState.table)).toBe(true);
    expect(gameState.table.length).toBe(0);
  });
});

describe("Player structure", () => {
  const gameState = createInitialGameState({
    playerNames: ["Alice", "Bob", "Carol"],
  });
  const player = gameState.players[0]!;

  it("id is a non-empty string", () => {
    expect(typeof player.id).toBe("string");
    expect(player.id.length).toBeGreaterThan(0);
  });

  it("name is a non-empty string", () => {
    expect(typeof player.name).toBe("string");
    expect(player.name.length).toBeGreaterThan(0);
    expect(player.name).toBe("Alice");
  });

  it("hand is an array of Cards", () => {
    expect(Array.isArray(player.hand)).toBe(true);
  });

  it("isDown is a boolean (false initially)", () => {
    expect(typeof player.isDown).toBe("boolean");
    expect(player.isDown).toBe(false);
  });

  it("totalScore is a number (0 initially)", () => {
    expect(typeof player.totalScore).toBe("number");
    expect(player.totalScore).toBe(0);
  });
});

describe("TurnState structure", () => {
  const gameState = createInitialGameState({
    playerNames: ["Alice", "Bob", "Carol"],
  });
  const turnState = gameState.turnState;

  it("hasDrawn is a boolean", () => {
    expect(typeof turnState.hasDrawn).toBe("boolean");
    expect(turnState.hasDrawn).toBe(false);
  });

  it("hasLaidDown is a boolean (for later phases)", () => {
    expect(typeof turnState.hasLaidDown).toBe("boolean");
    expect(turnState.hasLaidDown).toBe(false);
  });

  it("laidDownThisTurn is a boolean (for later phases)", () => {
    expect(typeof turnState.laidDownThisTurn).toBe("boolean");
    expect(turnState.laidDownThisTurn).toBe(false);
  });
});

describe("createInitialGameState", () => {
  it("creates game with 3-8 players", () => {
    // Test with 3 players (minimum)
    const game3 = createInitialGameState({
      playerNames: ["A", "B", "C"],
    });
    expect(game3.players.length).toBe(3);

    // Test with 8 players (maximum)
    const game8 = createInitialGameState({
      playerNames: ["A", "B", "C", "D", "E", "F", "G", "H"],
    });
    expect(game8.players.length).toBe(8);
  });

  it("sets currentRound to 1", () => {
    const game = createInitialGameState({
      playerNames: ["Alice", "Bob", "Carol"],
    });
    expect(game.currentRound).toBe(1);
  });

  it("sets dealerIndex to 0 by default", () => {
    const game = createInitialGameState({
      playerNames: ["Alice", "Bob", "Carol"],
    });
    expect(game.dealerIndex).toBe(0);
  });

  it("sets currentPlayerIndex to 1 (left of dealer)", () => {
    const game = createInitialGameState({
      playerNames: ["Alice", "Bob", "Carol"],
      dealerIndex: 0,
    });
    expect(game.currentPlayerIndex).toBe(1);

    // Test wrap-around: if dealer is last player, first player starts
    const game2 = createInitialGameState({
      playerNames: ["Alice", "Bob", "Carol"],
      dealerIndex: 2,
    });
    expect(game2.currentPlayerIndex).toBe(0);
  });

  it("initializes all players with empty hands, isDown: false, totalScore: 0", () => {
    const game = createInitialGameState({
      playerNames: ["Alice", "Bob", "Carol"],
    });
    for (const player of game.players) {
      expect(player.hand).toEqual([]);
      expect(player.isDown).toBe(false);
      expect(player.totalScore).toBe(0);
    }
  });

  it("stock and discard are empty (deal happens separately)", () => {
    const game = createInitialGameState({
      playerNames: ["Alice", "Bob", "Carol"],
    });
    expect(game.stock).toEqual([]);
    expect(game.discard).toEqual([]);
  });

  it("table is empty array", () => {
    const game = createInitialGameState({
      playerNames: ["Alice", "Bob", "Carol"],
    });
    expect(game.table).toEqual([]);
  });

  it("throws error for fewer than 3 players", () => {
    expect(() => {
      createInitialGameState({ playerNames: ["Alice", "Bob"] });
    }).toThrow("Game requires 3-8 players");

    expect(() => {
      createInitialGameState({ playerNames: ["Alice"] });
    }).toThrow("Game requires 3-8 players");

    expect(() => {
      createInitialGameState({ playerNames: [] });
    }).toThrow("Game requires 3-8 players");
  });

  it("throws error for more than 8 players", () => {
    expect(() => {
      createInitialGameState({
        playerNames: ["A", "B", "C", "D", "E", "F", "G", "H", "I"],
      });
    }).toThrow("Game requires 3-8 players");
  });
});
