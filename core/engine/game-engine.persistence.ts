export const GAME_ENGINE_PERSISTENCE_VERSION = "game-engine/xstate-v1";

export interface GameEnginePersistedState {
  version: typeof GAME_ENGINE_PERSISTENCE_VERSION;
  snapshot: unknown;
}

export function createGameEnginePersistedState(
  snapshot: unknown
): GameEnginePersistedState {
  return {
    version: GAME_ENGINE_PERSISTENCE_VERSION,
    snapshot,
  };
}

export function stringifyGameEnginePersistedState(snapshot: unknown): string {
  const state = isGameEnginePersistedState(snapshot)
    ? snapshot
    : createGameEnginePersistedState(snapshot);
  return JSON.stringify(state);
}

export function parseGameEnginePersistedState(persistedState: unknown): unknown {
  if (typeof persistedState === "string") {
    return parseGameEnginePersistedState(JSON.parse(persistedState));
  }

  if (!isRecord(persistedState)) {
    return persistedState;
  }

  if (isGameEnginePersistedState(persistedState)) {
    return persistedState.snapshot;
  }

  if ("version" in persistedState && "snapshot" in persistedState) {
    throw new Error(
      `Unsupported game engine persistence version: ${String(
        persistedState.version
      )}`
    );
  }

  return persistedState;
}

export function isGameEnginePersistedState(
  value: unknown
): value is GameEnginePersistedState {
  return (
    isRecord(value) &&
    value.version === GAME_ENGINE_PERSISTENCE_VERSION &&
    "snapshot" in value
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
