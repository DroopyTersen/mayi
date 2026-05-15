import { describe, expect, it } from "bun:test";
import { GameEngine } from "./game-engine";
import {
  GAME_ENGINE_PERSISTENCE_VERSION,
  parseGameEnginePersistedState,
  stringifyGameEnginePersistedState,
} from "./game-engine.persistence";

describe("game engine persistence", () => {
  it("serializes engine state behind a versioned persistence envelope", () => {
    const engine = GameEngine.createGame({
      gameId: "persistence-test",
      playerNames: ["Alice", "Bob", "Carol"],
    });

    const persistedState = engine.getPersistedState();

    expect(persistedState.version).toBe(GAME_ENGINE_PERSISTENCE_VERSION);
    expect(persistedState.snapshot).toBeDefined();
    expect(JSON.stringify(persistedState)).toContain("player-0");
  });

  it("uses the versioned envelope for JSON round trips", () => {
    const engine = GameEngine.createGame({
      gameId: "persistence-test",
      playerNames: ["Alice", "Bob", "Carol"],
    });

    const json = engine.toJSON();
    const parsed = JSON.parse(json) as { version?: string };
    const restored = GameEngine.fromJSON(json, "restored-game");

    expect(parsed.version).toBe(GAME_ENGINE_PERSISTENCE_VERSION);
    expect(restored.getSnapshot().gameId).toBe("restored-game");
    expect(restored.getSnapshot().players).toHaveLength(3);
  });

  it("restores legacy raw XState persisted snapshots", () => {
    const engine = GameEngine.createGame({
      gameId: "legacy-persistence-test",
      playerNames: ["Alice", "Bob", "Carol"],
    });

    const legacyRawSnapshot = engine.getPersistedSnapshot();
    const restored = GameEngine.fromPersistedState(
      legacyRawSnapshot,
      "restored-legacy"
    );

    expect(restored.getSnapshot().gameId).toBe("restored-legacy");
    expect(restored.getSnapshot().players).toHaveLength(3);
  });

  it("unwraps versioned states from object or string inputs", () => {
    const engine = GameEngine.createGame({
      gameId: "unwrap-persistence-test",
      playerNames: ["Alice", "Bob", "Carol"],
    });
    const rawSnapshot = engine.getPersistedSnapshot();
    const json = stringifyGameEnginePersistedState(rawSnapshot);

    expect(parseGameEnginePersistedState(engine.getPersistedState())).toEqual(
      rawSnapshot
    );
    expect(parseGameEnginePersistedState(json)).toEqual(rawSnapshot);
  });
});
