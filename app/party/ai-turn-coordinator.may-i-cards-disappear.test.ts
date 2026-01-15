/**
 * Bug #41 regression test: May-I cards disappear when turn cycles back to human.
 *
 * Hypothesis: During an AI turn, a concurrent CALL_MAY_I can update storage with
 * new cards for the human player while the AI coordinator continues with a
 * stale in-memory adapter. When the AI turn advances to the human, the newly
 * spawned TurnMachine can be initialized with a stale hand. Our merge function
 * patches round-level hands but does not patch the active TurnMachine hand,
 * so when the human becomes current player their hand view can lose the May-I cards.
 */

import { describe, it, expect } from "bun:test";
import {
  AITurnCoordinator,
  type AITurnCoordinatorDeps,
} from "./ai-turn-coordinator";
import {
  PartyGameAdapter,
  type StoredGameState,
  type PlayerMapping,
} from "./party-game-adapter";
import { executeGameAction } from "./game-actions";
import type { AITurnResult } from "./ai-turn-handler";

function createTestGameState(playerNames: string[]): StoredGameState {
  const { GameEngine } = require("../../core/engine/game-engine");
  const engine = GameEngine.createGame({ playerNames });
  const snapshot = engine.getSnapshot();
  const now = new Date().toISOString();

  const playerMappings: PlayerMapping[] = snapshot.players.map((p: any, i: number) => ({
    engineId: p.id,
    lobbyId: `lobby-${i + 1}`,
    name: playerNames[i],
    isAI: i > 0,
    aiModelId: i > 0 ? "default:fallback" : undefined,
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

function getRoundHandIds(state: StoredGameState, engineId: string): string[] {
  const snapshot = JSON.parse(state.engineSnapshot);
  const players = snapshot.children?.round?.snapshot?.context?.players;
  const player = players?.find((p: { id: string }) => p.id === engineId);
  return (player?.hand ?? []).map((c: { id: string }) => c.id);
}

function getTurnHandIds(state: StoredGameState): string[] | null {
  const snapshot = JSON.parse(state.engineSnapshot);
  const turnContext = snapshot.children?.round?.snapshot?.children?.turn?.snapshot?.context;
  if (!turnContext?.hand) return null;
  return turnContext.hand.map((c: { id: string }) => c.id);
}

function setPlayersDown(
  state: StoredGameState,
  engineIds: string[]
): StoredGameState {
  const snapshot = JSON.parse(state.engineSnapshot);
  const players = snapshot.children?.round?.snapshot?.context?.players;
  if (Array.isArray(players)) {
    for (const p of players) {
      if (engineIds.includes(p.id)) {
        p.isDown = true;
      }
    }
  }

  // If the current turn actor exists for one of these players, keep it consistent.
  const turnContext = snapshot.children?.round?.snapshot?.children?.turn?.snapshot?.context;
  if (turnContext?.playerId && engineIds.includes(turnContext.playerId)) {
    turnContext.isDown = true;
  }

  return {
    ...state,
    engineSnapshot: JSON.stringify(snapshot),
  };
}

describe("Bug #41 - May-I cards disappear", () => {
  it("keeps May-I cards when turn cycles back to human", async () => {
    // Setup: 1 human + 2 AI. We'll force both AIs to be "down" so May-I auto-resolves.
    let storedState: StoredGameState | null = createTestGameState([
      "Human",
      "AI-Alice",
      "AI-Bob",
    ]);

    // Engine IDs are deterministic: player-0, player-1, player-2 (join order)
    storedState = setPlayersDown(storedState, ["player-1", "player-2"]);

    const initialAdapter = PartyGameAdapter.fromStoredState(storedState);
    const humanMapping = initialAdapter.getAllPlayerMappings().find((m) => !m.isAI)!;
    const humanEngineId = humanMapping.engineId;

    let mayICardIds: string[] = [];
    let onAIThinkingCalls = 0;

    const deps: AITurnCoordinatorDeps = {
      getState: async () => storedState,
      setState: async (state) => {
        storedState = state;
      },
      broadcast: async () => {},
      executeAITurn: async ({ adapter, aiPlayerId, onPersist }): Promise<AITurnResult> => {
        // Simple deterministic AI turn: draw -> skip -> discard first card.
        let snap = adapter.getSnapshot();

        if (snap.turnPhase === "AWAITING_DRAW") {
          adapter.drawFromStock(aiPlayerId);
          await onPersist?.();
          snap = adapter.getSnapshot();
        }

        if (snap.turnPhase === "AWAITING_ACTION") {
          adapter.skip(aiPlayerId);
          await onPersist?.();
          snap = adapter.getSnapshot();
        }

        if (snap.turnPhase === "AWAITING_DISCARD") {
          const mapping = adapter.getPlayerMapping(aiPlayerId);
          const engineId = mapping?.engineId;
          const player = snap.players.find((p: any) => p.id === engineId);
          const cardToDiscard = player?.hand?.[0];
          if (cardToDiscard) {
            adapter.discard(aiPlayerId, cardToDiscard.id);
            await onPersist?.();
          }
        }

        return {
          success: true,
          actions: ["draw_from_stock", "skip", "discard"],
          usedFallback: true,
        };
      },
      createAdapter: PartyGameAdapter.fromStoredState,
      env: {},
      thinkingDelayMs: 0,
      interTurnDelayMs: 0,
      toolDelayMs: 0,
      debug: false,
    };

    const coordinator = new AITurnCoordinator(deps);

    await coordinator.executeAITurnsIfNeeded({
      onAIThinking: () => {
        onAIThinkingCalls += 1;

        // Simulate human clicking May-I during the SECOND AI thinking window.
        // Turn order in a fresh game starts at player-1, then player-2, then player-0.
        if (onAIThinkingCalls !== 2) return;

        // MayIRoom would attempt to abort the AI turn on CALL_MAY_I; at this point
        // the coordinator hasn't created an AbortController yet, so abort is a no-op.
        coordinator.abortCurrentTurn();

        const beforeAdapter = PartyGameAdapter.fromStoredState(storedState!);
        const beforeHand = getRoundHandIds(beforeAdapter.getStoredState(), humanEngineId);

        const result = executeGameAction(beforeAdapter, humanMapping.lobbyId, {
          type: "CALL_MAY_I",
        });
        expect(result.success).toBe(true);

        storedState = beforeAdapter.getStoredState();

        const afterHand = getRoundHandIds(storedState!, humanEngineId);
        mayICardIds = afterHand.filter((id) => !beforeHand.includes(id));

        // Caller should receive claimed discard + penalty card.
        expect(mayICardIds.length).toBe(2);
      },
    });

    expect(mayICardIds.length).toBe(2);

    const finalState = storedState!;
    const finalAdapter = PartyGameAdapter.fromStoredState(finalState);

    // Sanity: round-level hand should still contain May-I cards (merge preserved them).
    const roundHandIds = getRoundHandIds(finalState, humanEngineId);
    for (const id of mayICardIds) {
      expect(roundHandIds).toContain(id);
    }

    // Bug: when human becomes current player, PlayerView uses TurnMachine hand,
    // which can be stale and omit the May-I cards.
    const view = finalAdapter.getPlayerView(humanMapping.lobbyId)!;
    const viewHandIds = view.yourHand.map((c) => c.id);
    const turnHandIds = getTurnHandIds(finalState);

    // Regression assertions: May-I cards must be present in the human view/turn hand.
    for (const id of mayICardIds) {
      expect(viewHandIds).toContain(id);
      // Keep this assertion to make the discrepancy obvious in failures.
      if (turnHandIds) expect(turnHandIds).toContain(id);
    }
  });
});
