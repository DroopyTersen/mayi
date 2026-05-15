import { describe, expect, it } from "bun:test";
import { PartyGameAdapter, type StoredGameState } from "./party-game-adapter";
import { executeStoredGameAction } from "./game-action-executor";
import type { HumanPlayerInfo } from "./protocol.types";
import {
  parseGameEnginePersistedState,
  stringifyGameEnginePersistedState,
} from "../../core/engine/game-engine.persistence";

function human(playerId: string, name: string): HumanPlayerInfo {
  return {
    playerId,
    name,
    isConnected: true,
    disconnectedAt: null,
  };
}

function createStoredGameState(): StoredGameState {
  const adapter = PartyGameAdapter.createFromLobby({
    roomId: "executor-test-room",
    humanPlayers: [
      human("human-1", "Alice"),
      human("human-2", "Bob"),
      human("human-3", "Carol"),
    ],
    aiPlayers: [],
    startingRound: 1,
  });

  return adapter.getStoredState();
}

function getAwaitingLobbyPlayerId(state: StoredGameState): string {
  const adapter = PartyGameAdapter.fromStoredState(state);
  const awaiting = adapter.getAwaitingLobbyPlayerId();
  if (!awaiting) {
    throw new Error("Expected awaiting lobby player");
  }
  return awaiting;
}

function reorderActionForAwaitingPlayer(state: StoredGameState) {
  const adapter = PartyGameAdapter.fromStoredState(state);
  const awaiting = adapter.getAwaitingLobbyPlayerId();
  if (!awaiting) {
    throw new Error("Expected awaiting lobby player");
  }
  const view = adapter.getPlayerView(awaiting);
  if (!view) {
    throw new Error("Expected player view");
  }
  return {
    callerPlayerId: awaiting,
    action: {
      type: "REORDER_HAND" as const,
      cardIds: view.yourHand.map((card) => card.id),
    },
  };
}

function corruptHandDiscardOverlap(state: StoredGameState): StoredGameState {
  const snapshot = parseGameEnginePersistedState(state.engineSnapshot) as any;
  const roundSnapshot = snapshot.children?.round?.snapshot;
  const roundContext = roundSnapshot?.context;

  if (!roundContext || !Array.isArray(roundContext.players)) {
    throw new Error("Expected round context players");
  }

  const playerWithCards = roundContext.players.find(
    (player: { hand?: unknown[] }) =>
      Array.isArray(player.hand) && player.hand.length > 0
  );
  if (!playerWithCards || !Array.isArray(playerWithCards.hand)) {
    throw new Error("Expected round hand");
  }

  const duplicateCard = playerWithCards.hand[0];
  roundContext.discard = [duplicateCard, ...(roundContext.discard ?? [])];

  return {
    ...state,
    engineSnapshot: stringifyGameEnginePersistedState(snapshot),
  };
}

describe("executeStoredGameAction", () => {
  it("loads latest state, saves successful actions, and increments revision", async () => {
    let storedState = createStoredGameState();
    const callerPlayerId = getAwaitingLobbyPlayerId(storedState);
    const savedStates: StoredGameState[] = [];

    const first = await executeStoredGameAction({
      roomPhase: "playing",
      callerPlayerId,
      action: { type: "DRAW_FROM_STOCK" },
      getState: async () => storedState,
      setState: async (nextState) => {
        savedStates.push(nextState);
        storedState = nextState;
      },
    });

    expect(first.ok).toBe(true);
    expect(first.revisionBefore).toBe(0);
    expect(first.revisionAfter).toBe(1);
    expect(storedState.revision).toBe(1);

    const second = await executeStoredGameAction({
      roomPhase: "playing",
      callerPlayerId,
      action: { type: "SKIP" },
      getState: async () => storedState,
      setState: async (nextState) => {
        savedStates.push(nextState);
        storedState = nextState;
      },
    });

    expect(second.ok).toBe(true);
    expect(second.revisionBefore).toBe(1);
    expect(second.revisionAfter).toBe(2);
    expect(storedState.revision).toBe(2);
    expect(savedStates).toHaveLength(2);
  });

  it("does not save rejected actions", async () => {
    const storedState = createStoredGameState();
    const callerPlayerId = "human-1" === getAwaitingLobbyPlayerId(storedState)
      ? "human-2"
      : "human-1";
    let saveCount = 0;

    const result = await executeStoredGameAction({
      roomPhase: "playing",
      callerPlayerId,
      action: { type: "DRAW_FROM_STOCK" },
      getState: async () => storedState,
      setState: async () => {
        saveCount += 1;
      },
    });

    expect(result.ok).toBe(false);
    expect(result.outboundMessages[0]?.type).toBe("ERROR");
    expect(saveCount).toBe(0);
  });

  it("does not save when the resulting state violates card invariants", async () => {
    const storedState = corruptHandDiscardOverlap(createStoredGameState());
    const { callerPlayerId, action } = reorderActionForAwaitingPlayer(storedState);
    let saveCount = 0;

    const result = await executeStoredGameAction({
      roomPhase: "playing",
      callerPlayerId,
      action,
      getState: async () => storedState,
      setState: async () => {
        saveCount += 1;
      },
    });

    expect(result.ok).toBe(false);
    expect(result.outboundMessages[0]?.type).toBe("ERROR");
    expect(result.outboundMessages[0]?.error).toBe("CARD_INVARIANT_VIOLATION");
    expect(saveCount).toBe(0);
  });
});
