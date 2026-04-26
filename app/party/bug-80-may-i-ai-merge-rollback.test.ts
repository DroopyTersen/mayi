/**
 * Regression test for a May-I / AI persistence race.
 *
 * Scenario:
 * 1. AI turn starts from state A.
 * 2. Human calls May-I and the prompted AI allows it, producing fresh state B.
 * 3. The AI turn later persists a stale state A' through the merge helper.
 *
 * The merge must preserve both sides of the race:
 * - the May-I card grants and logs from fresh state B
 * - the AI activity from stale state A'
 */

import { describe, expect, it } from "bun:test";
import {
  PartyGameAdapter,
  mergeAIStatePreservingOtherPlayerHands,
  type StoredGameState,
} from "./party-game-adapter";
import { executeGameAction } from "./game-actions";
import type { AIPlayerInfo, HumanPlayerInfo } from "./protocol.types";

function setPlayerDown(state: StoredGameState, engineId: string): StoredGameState {
  const snapshot = JSON.parse(state.engineSnapshot);
  const players = snapshot.children?.round?.snapshot?.context?.players;

  if (Array.isArray(players)) {
    const player = players.find((p: { id: string }) => p.id === engineId);
    if (player) {
      player.isDown = true;
    }
  }

  const turnContext = snapshot.children?.round?.snapshot?.children?.turn?.snapshot?.context;
  if (turnContext?.playerId === engineId) {
    turnContext.isDown = true;
  }

  return {
    ...state,
    engineSnapshot: JSON.stringify(snapshot),
  };
}

function removeCardsFromPiles(
  state: StoredGameState,
  cardIds: string[]
): StoredGameState {
  const ids = new Set(cardIds);
  const snapshot = JSON.parse(state.engineSnapshot);
  const roundContext = snapshot.children?.round?.snapshot?.context;
  const turnContext = snapshot.children?.round?.snapshot?.children?.turn?.snapshot?.context;

  if (roundContext) {
    if (Array.isArray(roundContext.stock)) {
      roundContext.stock = roundContext.stock.filter(
        (card: { id: string }) => !ids.has(card.id)
      );
    }
    if (Array.isArray(roundContext.discard)) {
      roundContext.discard = roundContext.discard.filter(
        (card: { id: string }) => !ids.has(card.id)
      );
    }
  }

  if (turnContext) {
    if (Array.isArray(turnContext.stock)) {
      turnContext.stock = turnContext.stock.filter(
        (card: { id: string }) => !ids.has(card.id)
      );
    }
    if (Array.isArray(turnContext.discard)) {
      turnContext.discard = turnContext.discard.filter(
        (card: { id: string }) => !ids.has(card.id)
      );
    }
  }

  return {
    ...state,
    engineSnapshot: JSON.stringify(snapshot),
  };
}

function cloneStoredState(state: StoredGameState): StoredGameState {
  return {
    ...state,
    playerMappings: state.playerMappings.map((mapping) => ({ ...mapping })),
    activityLog: state.activityLog.map((entry) => ({ ...entry })),
  };
}

function handIds(state: StoredGameState, engineId: string): string[] {
  const adapter = PartyGameAdapter.fromStoredState(state);
  const player = adapter.getSnapshot().players.find((p) => p.id === engineId);
  return player?.hand.map((card) => card.id) ?? [];
}

describe("Bug #80 - May-I result survives stale AI merge", () => {
  it("preserves resolved May-I cards and activity when stale AI state is merged", () => {
    const humanPlayers: HumanPlayerInfo[] = [
      {
        playerId: "andrew",
        name: "Andrew",
        isConnected: true,
        disconnectedAt: null,
      },
    ];
    const aiPlayers: AIPlayerInfo[] = [
      {
        playerId: "hannah",
        name: "Hannah",
        modelId: "default:grok",
        modelDisplayName: "Grok",
      },
      {
        playerId: "carter",
        name: "Carter",
        modelId: "default:grok",
        modelDisplayName: "Grok",
      },
    ];

    const baseAdapter = PartyGameAdapter.createFromLobby({
      roomId: "may-i-ai-merge-rollback",
      humanPlayers,
      aiPlayers,
      startingRound: 1,
    });
    const mappings = baseAdapter.getAllPlayerMappings();
    const andrew = mappings.find((mapping) => mapping.lobbyId === "andrew");
    const hannah = mappings.find((mapping) => mapping.lobbyId === "hannah");
    const carter = mappings.find((mapping) => mapping.lobbyId === "carter");

    if (!andrew || !hannah || !carter) {
      throw new Error("Expected Andrew, Hannah, and Carter mappings");
    }

    // Carter is down, so only current-player Hannah is prompted to allow Andrew's May-I.
    const staleStateAtAIStart = setPlayerDown(
      baseAdapter.getStoredState(),
      carter.engineId
    );

    const freshAdapter = PartyGameAdapter.fromStoredState(
      cloneStoredState(staleStateAtAIStart)
    );
    const beforeMayIHand = handIds(
      freshAdapter.getStoredState(),
      andrew.engineId
    );

    const callResult = executeGameAction(freshAdapter, andrew.lobbyId, {
      type: "CALL_MAY_I",
    });
    expect(callResult.success).toBe(true);

    const allowResult = executeGameAction(freshAdapter, hannah.lobbyId, {
      type: "ALLOW_MAY_I",
    });
    expect(allowResult.success).toBe(true);

    const freshStateAfterMayI = {
      ...freshAdapter.getStoredState(),
      revision: 11,
    };
    const afterMayIHand = handIds(freshStateAfterMayI, andrew.engineId);
    const grantedCardIds = afterMayIHand.filter(
      (cardId) => !beforeMayIHand.includes(cardId)
    );
    expect(grantedCardIds).toHaveLength(2);

    // Simulate Hannah's stale AI turn saving later. The cards are removed from
    // stale piles to model an AI state that no longer duplicates the fresh
    // May-I hand, so this exercises the successful merge path.
    const staleAIStateAfterTurn: StoredGameState = {
      ...removeCardsFromPiles(cloneStoredState(staleStateAtAIStart), grantedCardIds),
      revision: 10,
      activityLog: [
        ...staleStateAtAIStart.activityLog,
        {
          // Real stale adapters can reuse log ids because each adapter starts
          // its counter from the same base activity length.
          id: "log-2",
          timestamp: new Date().toISOString(),
          roundNumber: 1,
          turnNumber: 1,
          playerId: hannah.lobbyId,
          playerName: "Hannah",
          action: "laid down contract",
        },
      ],
    };

    const mergedState = mergeAIStatePreservingOtherPlayerHands(
      freshStateAfterMayI,
      staleAIStateAfterTurn,
      hannah.engineId
    );
    expect(mergedState.revision).toBe(11);

    const mergedAndrewHand = handIds(mergedState, andrew.engineId);
    for (const cardId of grantedCardIds) {
      expect(mergedAndrewHand).toContain(cardId);
    }

    const mergedActivity = mergedState.activityLog.map((entry) => ({
      playerName: entry.playerName,
      action: entry.action,
      details: entry.details,
    }));
    const mergedActivityIds = mergedState.activityLog.map((entry) => entry.id);
    expect(new Set(mergedActivityIds).size).toBe(mergedActivityIds.length);

    expect(mergedActivity).toContainEqual(
      expect.objectContaining({
        playerName: "Andrew",
        action: "called May I",
      })
    );
    expect(mergedActivity).toContainEqual(
      expect.objectContaining({
        playerName: "Hannah",
        action: "allowed May I",
      })
    );
    expect(mergedActivity).toContainEqual(
      expect.objectContaining({
        playerName: "Andrew",
        action: "took the May I card",
      })
    );
    expect(mergedActivity).toContainEqual(
      expect.objectContaining({
        playerName: "Hannah",
        action: "laid down contract",
      })
    );
  });
});
