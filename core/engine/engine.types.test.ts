import { describe, it, expect } from "bun:test";
import {
  createInitialGameState,
  type GameState,
  type Player,
  type TurnState,
} from "./engine.types";

describe("GameState structure", () => {
  it.todo("gameId is a non-empty string", () => {});

  it.todo("currentRound is 1-6", () => {});

  it.todo("players is an array of Player objects", () => {});

  it.todo("currentPlayerIndex is valid index into players array", () => {});

  it.todo("dealerIndex is valid index into players array", () => {});

  it.todo("stock is an array of Cards", () => {});

  it.todo("discard is an array of Cards (top card is index 0)", () => {});

  it.todo("table is an array of Melds (empty initially)", () => {});
});

describe("Player structure", () => {
  it.todo("id is a non-empty string", () => {});

  it.todo("name is a non-empty string", () => {});

  it.todo("hand is an array of Cards", () => {});

  it.todo("isDown is a boolean (false initially)", () => {});

  it.todo("totalScore is a number (0 initially)", () => {});
});

describe("TurnState structure", () => {
  it.todo("hasDrawn is a boolean", () => {});

  it.todo("hasLaidDown is a boolean (for later phases)", () => {});

  it.todo("laidDownThisTurn is a boolean (for later phases)", () => {});
});

describe("createInitialGameState", () => {
  it.todo("creates game with 3-8 players", () => {});

  it.todo("sets currentRound to 1", () => {});

  it.todo("sets dealerIndex to 0 (or random)", () => {});

  it.todo("sets currentPlayerIndex to 1 (left of dealer)", () => {});

  it.todo(
    "initializes all players with empty hands, isDown: false, totalScore: 0",
    () => {}
  );

  it.todo("stock and discard are empty (deal happens separately)", () => {});

  it.todo("table is empty array", () => {});

  it.todo("throws error for fewer than 3 players", () => {});

  it.todo("throws error for more than 8 players", () => {});
});
