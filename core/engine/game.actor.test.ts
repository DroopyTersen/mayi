/**
 * Unit tests for game.actor.ts
 *
 * Tests the game actor factory functions:
 * - createGameActor
 * - getSerializableState
 * - restoreGameActor
 */

import { describe, it, expect } from "bun:test";
import {
  createGameActor,
  getSerializableState,
  restoreGameActor,
  type SerializableGameState,
} from "./game.actor";

describe("createGameActor", () => {
  it("creates an actor in setup state", () => {
    const actor = createGameActor();
    const snapshot = actor.getSnapshot();

    expect(snapshot.value).toBe("setup");
    expect(snapshot.context.players).toEqual([]);

    actor.stop();
  });

  it("adds players when playerNames provided", () => {
    const actor = createGameActor({
      playerNames: ["Alice", "Bob", "Carol"],
    });
    const snapshot = actor.getSnapshot();

    expect(snapshot.value).toBe("setup");
    expect(snapshot.context.players).toHaveLength(3);
    expect(snapshot.context.players.map((p) => p.name)).toEqual(["Alice", "Bob", "Carol"]);

    actor.stop();
  });

  it("auto-starts game when autoStart is true and enough players", () => {
    const actor = createGameActor({
      playerNames: ["Alice", "Bob", "Carol"],
      autoStart: true,
    });
    const snapshot = actor.getSnapshot();

    expect(snapshot.value).toBe("playing");

    actor.stop();
  });

  it("does not auto-start with fewer than 3 players", () => {
    const actor = createGameActor({
      playerNames: ["Alice", "Bob"],
      autoStart: true,
    });
    const snapshot = actor.getSnapshot();

    expect(snapshot.value).toBe("setup");

    actor.stop();
  });

  it("respects startingRound option", () => {
    const actor = createGameActor({
      playerNames: ["Alice", "Bob", "Carol"],
      autoStart: true,
      startingRound: 3,
    });
    const snapshot = actor.getSnapshot();

    expect(snapshot.context.currentRound).toBe(3);

    actor.stop();
  });
});

describe("getSerializableState", () => {
  it("serializes setup state correctly", () => {
    const actor = createGameActor({
      playerNames: ["Alice", "Bob", "Carol"],
    });

    const state = getSerializableState(actor);

    expect(state.version).toBe("3.0");
    expect(state.machineState).toBe("setup");
    expect(state.players).toHaveLength(3);
    expect(state.currentRound).toBe(1);

    actor.stop();
  });

  it("serializes playing state with turn info", () => {
    const actor = createGameActor({
      playerNames: ["Alice", "Bob", "Carol"],
      autoStart: true,
    });

    const state = getSerializableState(actor);

    expect(state.machineState).toBe("playing");
    expect(state.turnPhase).toBe("awaitingDraw");
    expect(state.hasDrawn).toBe(false);
    expect(state.stock.length).toBeGreaterThan(0);
    expect(state.discard.length).toBeGreaterThan(0);

    actor.stop();
  });

  it("serializes after draw action", () => {
    const actor = createGameActor({
      playerNames: ["Alice", "Bob", "Carol"],
      autoStart: true,
    });

    actor.send({ type: "DRAW_FROM_STOCK" });

    const state = getSerializableState(actor);

    expect(state.hasDrawn).toBe(true);
    // After draw, should be in drawn or awaitingDiscard state
    expect(["drawn", "awaitingDiscard"]).toContain(state.turnPhase);

    actor.stop();
  });
});

describe("restoreGameActor", () => {
  it("restores game from setup state", () => {
    // Create a game in setup
    const original = createGameActor({
      playerNames: ["Alice", "Bob", "Carol"],
    });
    const originalState = getSerializableState(original);
    original.stop();

    // Restore it
    const restored = restoreGameActor(originalState);
    const restoredSnapshot = restored.getSnapshot();

    expect(restoredSnapshot.value).toBe("setup");
    expect(restoredSnapshot.context.players).toHaveLength(3);
    expect(restoredSnapshot.context.players.map((p) => p.name)).toEqual(["Alice", "Bob", "Carol"]);

    restored.stop();
  });

  it("restores game from gameEnd state", () => {
    // Create a minimal gameEnd state
    const gameEndState: SerializableGameState = {
      version: "3.0",
      gameId: "test-game",
      currentRound: 6 as const,
      dealerIndex: 0,
      roundHistory: [
        { roundNumber: 1, scores: { p1: 0, p2: 50 }, winnerId: "p1" },
        { roundNumber: 2, scores: { p1: 0, p2: 30 }, winnerId: "p1" },
        { roundNumber: 3, scores: { p1: 0, p2: 40 }, winnerId: "p1" },
        { roundNumber: 4, scores: { p1: 0, p2: 20 }, winnerId: "p1" },
        { roundNumber: 5, scores: { p1: 0, p2: 35 }, winnerId: "p1" },
        { roundNumber: 6, scores: { p1: 0, p2: 25 }, winnerId: "p1" },
      ],
      machineState: "gameEnd",
      players: [
        { id: "p1", name: "Alice", hand: [], isDown: true, totalScore: 0 },
        { id: "p2", name: "Bob", hand: [], isDown: true, totalScore: 200 },
      ],
      currentPlayerIndex: 0,
      stock: [],
      discard: [],
      table: [],
      turnPhase: "turnComplete",
      hasDrawn: false,
      laidDownThisTurn: false,
      mayIWindow: null,
    };

    const restored = restoreGameActor(gameEndState);
    const snapshot = restored.getSnapshot();

    expect(snapshot.value).toBe("gameEnd");
    expect(snapshot.context.currentRound).toBe(6);
    expect(snapshot.context.roundHistory).toHaveLength(6);

    restored.stop();
  });

  it("throws when attempting to restore playing state", () => {
    const playingState: SerializableGameState = {
      version: "3.0",
      gameId: "test-game",
      currentRound: 1 as const,
      dealerIndex: 0,
      roundHistory: [],
      machineState: "playing",
      players: [
        { id: "p1", name: "Alice", hand: [], isDown: false, totalScore: 0 },
        { id: "p2", name: "Bob", hand: [], isDown: false, totalScore: 0 },
        { id: "p3", name: "Carol", hand: [], isDown: false, totalScore: 0 },
      ],
      currentPlayerIndex: 0,
      stock: [],
      discard: [],
      table: [],
      turnPhase: "awaitingDraw",
      hasDrawn: false,
      laidDownThisTurn: false,
      mayIWindow: null,
    };

    expect(() => restoreGameActor(playingState)).toThrow("Cannot restore game in 'playing' state");
  });

  it("restored actor can receive events", () => {
    // Create a game in setup and restore it
    const original = createGameActor({
      playerNames: ["Alice", "Bob"],
    });
    const originalState = getSerializableState(original);
    original.stop();

    const restored = restoreGameActor(originalState);

    // Should be able to add a player
    restored.send({ type: "ADD_PLAYER", name: "Carol" });
    const snapshot = restored.getSnapshot();

    expect(snapshot.context.players).toHaveLength(3);
    expect(snapshot.context.players[2]!.name).toBe("Carol");

    restored.stop();
  });

  it("preserves player scores through restoration", () => {
    const stateWithScores: SerializableGameState = {
      version: "3.0",
      gameId: "test-game",
      currentRound: 3 as const,
      dealerIndex: 2,
      roundHistory: [
        { roundNumber: 1, scores: { p1: 0, p2: 45 }, winnerId: "p1" },
        { roundNumber: 2, scores: { p1: 30, p2: 0 }, winnerId: "p2" },
      ],
      machineState: "setup", // Pretend we're between rounds for restoration
      players: [
        { id: "p1", name: "Alice", hand: [], isDown: false, totalScore: 30 },
        { id: "p2", name: "Bob", hand: [], isDown: false, totalScore: 45 },
      ],
      currentPlayerIndex: 0,
      stock: [],
      discard: [],
      table: [],
      turnPhase: "awaitingDraw",
      hasDrawn: false,
      laidDownThisTurn: false,
      mayIWindow: null,
    };

    const restored = restoreGameActor(stateWithScores);
    const snapshot = restored.getSnapshot();

    expect(snapshot.context.players[0]!.totalScore).toBe(30);
    expect(snapshot.context.players[1]!.totalScore).toBe(45);
    expect(snapshot.context.roundHistory).toHaveLength(2);

    restored.stop();
  });
});
