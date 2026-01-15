/**
 * Bug #44 regression test: Multiple May-I clicks can deal duplicate cards.
 *
 * Theory: During an AI turn, we merge a stale AI snapshot with a fresh snapshot
 * (e.g. after a human CALL_MAY_I). The merge preserves non-current players'
 * hands but can accidentally resurrect stock/discard + discardClaimed from the
 * stale AI state. That makes the same discard + penalty card claimable again,
 * so repeated CALL_MAY_I grants the same two card IDs multiple times.
 */

import { describe, it, expect } from "bun:test";
import {
  PartyGameAdapter,
  mergeAIStatePreservingOtherPlayerHands,
  type StoredGameState,
} from "./party-game-adapter";
import { executeGameAction } from "./game-actions";
import type { AIPlayerInfo, HumanPlayerInfo } from "./protocol.types";

function setPlayersDown(state: StoredGameState, engineIds: string[]): StoredGameState {
  const snapshot = JSON.parse(state.engineSnapshot);
  const players = snapshot.children?.round?.snapshot?.context?.players;
  if (Array.isArray(players)) {
    for (const p of players) {
      if (engineIds.includes(p.id)) {
        p.isDown = true;
      }
    }
  }

  // Keep the current turn actor consistent if it belongs to one of these players.
  const turnContext = snapshot.children?.round?.snapshot?.children?.turn?.snapshot?.context;
  if (turnContext?.playerId && engineIds.includes(turnContext.playerId)) {
    turnContext.isDown = true;
  }

  return {
    ...state,
    engineSnapshot: JSON.stringify(snapshot),
  };
}

function countIds(ids: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const id of ids) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

describe("Bug #44 - Multiple May-I clicks deal duplicate cards", () => {
  it("does not allow the same discard + penalty card to be granted twice after a stale AI merge", () => {
    const humanPlayers: HumanPlayerInfo[] = [
      { playerId: "human-1", name: "Human", isConnected: true, disconnectedAt: null },
    ];
    const aiPlayers: AIPlayerInfo[] = [
      { playerId: "ai-1", name: "AI-1", modelId: "default:claude", modelDisplayName: "Claude" },
      { playerId: "ai-2", name: "AI-2", modelId: "default:claude", modelDisplayName: "Claude" },
    ];

    // Start a 3-player game where it's an AI's turn.
    const baseAdapter = PartyGameAdapter.createFromLobby({
      roomId: "test-room",
      humanPlayers,
      aiPlayers,
      startingRound: 1,
    });

    const mappings = baseAdapter.getAllPlayerMappings();
    const human = mappings.find((m) => !m.isAI);
    if (!human) throw new Error("Expected a human player mapping");

    // Force all AIs to be down so CALL_MAY_I auto-resolves (no prompts needed).
    const aiEngineIds = mappings.filter((m) => m.isAI).map((m) => m.engineId);
    const staleAIState = setPlayersDown(baseAdapter.getStoredState(), aiEngineIds);

    const staleAdapter = PartyGameAdapter.fromStoredState(staleAIState);
    const currentPlayerEngineId = staleAdapter.getSnapshot().awaitingPlayerId;
    const currentPlayerMapping = staleAdapter
      .getAllPlayerMappings()
      .find((m) => m.engineId === currentPlayerEngineId);
    expect(currentPlayerMapping?.isAI).toBe(true);

    // First CALL_MAY_I (human) — should grant exactly 2 cards (discard + penalty).
    const adapterAfterFirstClick = PartyGameAdapter.fromStoredState(staleAIState);
    const beforeFirst = adapterAfterFirstClick.getSnapshot();
    const humanBeforeFirst = beforeFirst.players.find((p) => p.id === human.engineId);
    if (!humanBeforeFirst) throw new Error("Expected human player in snapshot");
    const humanHandBeforeFirst = humanBeforeFirst.hand.map((c) => c.id);

    const firstResult = executeGameAction(adapterAfterFirstClick, human.lobbyId, {
      type: "CALL_MAY_I",
    });
    expect(firstResult.success).toBe(true);

    const afterFirst = adapterAfterFirstClick.getSnapshot();
    const humanAfterFirst = afterFirst.players.find((p) => p.id === human.engineId);
    if (!humanAfterFirst) throw new Error("Expected human player after first call");

    const humanHandAfterFirst = humanAfterFirst.hand.map((c) => c.id);
    expect(humanHandAfterFirst.length).toBe(humanHandBeforeFirst.length + 2);

    const firstGrantedIds = humanHandAfterFirst.filter((id) => !humanHandBeforeFirst.includes(id));
    expect(firstGrantedIds.length).toBe(2);

    const freshStateAfterFirstClick = adapterAfterFirstClick.getStoredState();

    // Simulate the AI coordinator persisting a stale snapshot after the May-I:
    // this merge should NOT resurrect already-claimed cards/piles.
    const mergedState = mergeAIStatePreservingOtherPlayerHands(
      freshStateAfterFirstClick,
      staleAIState,
      currentPlayerEngineId
    );

    // Second CALL_MAY_I (human) should be a no-op for the same discard.
    const adapterAfterSecondClick = PartyGameAdapter.fromStoredState(mergedState);
    const beforeSecond = adapterAfterSecondClick.getSnapshot();
    const humanBeforeSecond = beforeSecond.players.find((p) => p.id === human.engineId);
    if (!humanBeforeSecond) throw new Error("Expected human player before second call");

    const secondResult = executeGameAction(adapterAfterSecondClick, human.lobbyId, {
      type: "CALL_MAY_I",
    });
    expect(secondResult.success).toBe(true);

    const afterSecond = adapterAfterSecondClick.getSnapshot();
    const humanAfterSecond = afterSecond.players.find((p) => p.id === human.engineId);
    if (!humanAfterSecond) throw new Error("Expected human player after second call");

    const humanHandAfterSecond = humanAfterSecond.hand.map((c) => c.id);

    // Desired behavior: idempotent for the same discard — no additional cards.
    expect(humanHandAfterSecond.length).toBe(humanHandAfterFirst.length);

    // And specifically: the two cards granted by the first call should not be duplicated by ID.
    const counts = countIds(humanHandAfterSecond);
    for (const id of firstGrantedIds) {
      expect(counts.get(id)).toBe(1);
    }
  });
});

