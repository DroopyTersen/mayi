import { describe, expect, it } from "bun:test";
import { PartyGameAdapter, type StoredGameState } from "./party-game-adapter";
import { GameActionQueue } from "./game-action-queue";
import { submitQueuedGameAction } from "./queued-game-action";
import type { HumanPlayerInfo } from "./protocol.types";

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
    roomId: "queued-action-test-room",
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

function requireRevision(state: StoredGameState): number {
  if (state.revision === undefined) {
    throw new Error("Expected saved state revision");
  }
  return state.revision;
}

describe("submitQueuedGameAction", () => {
  it("applies concurrent queued actions to the latest committed state in order", async () => {
    const queue = new GameActionQueue();
    let storedState = createStoredGameState();
    const callerPlayerId = getAwaitingLobbyPlayerId(storedState);
    const savedRevisions: number[] = [];

    const first = submitQueuedGameAction({
      queue,
      getRoomPhase: async () => "playing",
      callerPlayerId,
      action: { type: "DRAW_FROM_STOCK" },
      getState: async () => storedState,
      setState: async (nextState) => {
        savedRevisions.push(requireRevision(nextState));
        storedState = nextState;
      },
    });
    const second = submitQueuedGameAction({
      queue,
      getRoomPhase: async () => "playing",
      callerPlayerId,
      action: { type: "SKIP" },
      getState: async () => storedState,
      setState: async (nextState) => {
        savedRevisions.push(requireRevision(nextState));
        storedState = nextState;
      },
    });

    const [firstResult, secondResult] = await Promise.all([first, second]);
    const finalSnapshot = PartyGameAdapter.fromStoredState(storedState).getSnapshot();

    expect(firstResult.ok).toBe(true);
    expect(secondResult.ok).toBe(true);
    expect(firstResult.revisionAfter).toBe(1);
    expect(secondResult.revisionBefore).toBe(1);
    expect(secondResult.revisionAfter).toBe(2);
    expect(savedRevisions).toEqual([1, 2]);
    expect(finalSnapshot.turnPhase).toBe("AWAITING_DISCARD");
  });
});
