/**
 * Regression coverage for May-I cards disappearing after a concurrent AI turn.
 *
 * The old coordinator wrote a stale AI adapter snapshot at the end of a turn.
 * If a human May-I changed storage while that AI was thinking, the final stale
 * write could remove the human's newly acquired cards. The unified action
 * pipeline prevents this by ignoring adapter-local mutations unless they are
 * submitted as queued GameActions.
 */

import { describe, expect, it } from "bun:test";

import { GameEngine } from "../../core/engine/game-engine";
import {
  parseGameEnginePersistedState,
  stringifyGameEnginePersistedState,
} from "../../core/engine/game-engine.persistence";
import { AITurnCoordinator, type AITurnCoordinatorDeps } from "./ai-turn-coordinator";
import { executeStoredGameAction } from "./game-action-executor";
import { PartyGameAdapter, type PlayerMapping, type StoredGameState } from "./party-game-adapter";

function createTestGameState(playerNames: string[]): StoredGameState {
  const engine = GameEngine.createGame({ playerNames });
  const snapshot = engine.getSnapshot();
  const now = new Date().toISOString();

  const playerMappings: PlayerMapping[] = snapshot.players.map((player, index) => ({
    engineId: player.id,
    lobbyId: `lobby-${index + 1}`,
    name: playerNames[index]!,
    isAI: index > 0,
    aiModelId: index > 0 ? "default:grok" : undefined,
  }));

  return {
    engineSnapshot: engine.toJSON(),
    playerMappings,
    roomId: "test-room",
    createdAt: now,
    updatedAt: now,
    activityLog: [],
  };
}

function setPlayersDown(state: StoredGameState, engineIds: string[]): StoredGameState {
  const snapshot = parseGameEnginePersistedState(state.engineSnapshot) as any;
  const players = snapshot.children?.round?.snapshot?.context?.players;
  if (Array.isArray(players)) {
    for (const player of players) {
      if (engineIds.includes(player.id)) {
        player.isDown = true;
      }
    }
  }

  const turnContext = snapshot.children?.round?.snapshot?.children?.turn?.snapshot?.context;
  if (turnContext?.playerId && engineIds.includes(turnContext.playerId)) {
    turnContext.isDown = true;
  }

  return {
    ...state,
    engineSnapshot: stringifyGameEnginePersistedState(snapshot),
  };
}

function getRoundHandIds(state: StoredGameState, engineId: string): string[] {
  const snapshot = parseGameEnginePersistedState(state.engineSnapshot) as any;
  const players = snapshot.children?.round?.snapshot?.context?.players;
  const player = players?.find((candidate: { id: string }) => candidate.id === engineId);
  return (player?.hand ?? []).map((card: { id: string }) => card.id);
}

async function executeQueuedAction(
  storedStateRef: { current: StoredGameState | null },
  playerId: string,
  action: Parameters<AITurnCoordinatorDeps["executeAIAction"]>[1]
) {
  const result = await executeStoredGameAction({
    roomPhase: "playing",
    callerPlayerId: playerId,
    action,
    getState: async () => storedStateRef.current,
    setState: async (state) => {
      storedStateRef.current = state;
    },
  });

  if (!result.ok) {
    const latestState = storedStateRef.current;
    if (!latestState) {
      throw new Error(result.outboundMessages[0].message);
    }
    return {
      ok: false as const,
      snapshot: PartyGameAdapter.fromStoredState(latestState).getSnapshot(),
      error: result.outboundMessages[0].error,
    };
  }

  return {
    ok: true as const,
    snapshot: result.snapshot,
  };
}

describe("Bug #41 - May-I cards disappear", () => {
  it("does not let stale AI adapter mutations remove human May-I cards", async () => {
    let initialState = createTestGameState(["Human", "AI-Alice", "AI-Bob"]);
    initialState = setPlayersDown(initialState, ["player-1", "player-2"]);

    const storedState = { current: initialState as StoredGameState | null };
    const initialAdapter = PartyGameAdapter.fromStoredState(initialState);
    const humanMapping = initialAdapter.getAllPlayerMappings().find((mapping) => !mapping.isAI)!;
    const humanHandBefore = getRoundHandIds(initialState, humanMapping.engineId);

    let aiTurnChecks = 0;
    let mayICardIds: string[] = [];

    const deps: AITurnCoordinatorDeps = {
      getState: async () => storedState.current,
      executeAIAction: (playerId, action) => executeQueuedAction(storedState, playerId, action),
      executeAITurn: async ({ adapter, aiPlayerId }) => {
        const mayIResult = await executeQueuedAction(storedState, humanMapping.lobbyId, {
          type: "CALL_MAY_I",
        });
        expect(mayIResult.ok).toBe(true);

        const handAfterMayI = getRoundHandIds(storedState.current!, humanMapping.engineId);
        mayICardIds = handAfterMayI.filter((id) => !humanHandBefore.includes(id));
        expect(mayICardIds.length).toBe(2);

        // Mutate the stale adapter the way the old implementation did. The
        // coordinator must not persist this local state at turn completion.
        const staleSnapshot = adapter.getSnapshot();
        if (staleSnapshot.awaitingPlayerId === adapter.getPlayerMapping(aiPlayerId)?.engineId) {
          adapter.drawFromStock(aiPlayerId);
        }

        return { success: true, actions: ["stale-adapter-draw"] };
      },
      isAIPlayerTurn: (adapter) => {
        if (aiTurnChecks++ > 0) return null;
        const awaitingLobbyId = adapter.getAwaitingLobbyPlayerId();
        if (!awaitingLobbyId) return null;
        const mapping = adapter.getPlayerMapping(awaitingLobbyId);
        return mapping?.isAI ? mapping : null;
      },
      createAdapter: PartyGameAdapter.fromStoredState,
      env: {} as AITurnCoordinatorDeps["env"],
      thinkingDelayMs: 0,
      interTurnDelayMs: 0,
    };

    const coordinator = new AITurnCoordinator(deps);
    await coordinator.executeAITurnsIfNeeded();

    const finalState = storedState.current!;
    const finalHandIds = getRoundHandIds(finalState, humanMapping.engineId);
    const finalView = PartyGameAdapter.fromStoredState(finalState).getPlayerView(
      humanMapping.lobbyId
    )!;

    for (const id of mayICardIds) {
      expect(finalHandIds).toContain(id);
      expect(finalView.yourHand.map((card) => card.id)).toContain(id);
    }
  });
});
