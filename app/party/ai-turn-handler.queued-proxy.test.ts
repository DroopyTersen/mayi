import { describe, expect, it } from "bun:test";

import {
  executeFallbackTurnWithAdapter,
  QueuedAIGameAdapterProxy,
  type QueuedAIGameActionExecutor,
} from "./ai-turn-handler";
import { convertAgentTestStateToStoredState } from "./agent-state.converter";
import { executeStoredGameAction } from "./game-action-executor";
import { PartyGameAdapter, type PlayerMapping, type StoredGameState } from "./party-game-adapter";
import type { AgentTestPlayer, AgentTestState } from "./agent-state.types";
import type { GameAction } from "./protocol.types";
import { GameEngine } from "../../core/engine/game-engine";
import { createTestCard } from "../../core/engine/test.fixtures";

function cards(prefix: string) {
  return [
    createTestCard("3", "hearts", `${prefix}-3H`),
    createTestCard("4", "hearts", `${prefix}-4H`),
    createTestCard("5", "hearts", `${prefix}-5H`),
    createTestCard("6", "hearts", `${prefix}-6H`),
    createTestCard("7", "hearts", `${prefix}-7H`),
    createTestCard("8", "hearts", `${prefix}-8H`),
    createTestCard("9", "hearts", `${prefix}-9H`),
    createTestCard("10", "hearts", `${prefix}-10H`),
    createTestCard("J", "hearts", `${prefix}-JH`),
    createTestCard("Q", "hearts", `${prefix}-QH`),
    createTestCard("K", "hearts", `${prefix}-KH`),
  ];
}

function createQueuedExecutor(
  getStoredState: () => StoredGameState,
  setStoredState: (state: StoredGameState) => void,
  lobbyPlayerId: string,
  executedActions: GameAction[] = []
): QueuedAIGameActionExecutor {
  return {
    getSnapshot: async () => PartyGameAdapter.fromStoredState(getStoredState()).getSnapshot(),
    execute: async (action) => {
      executedActions.push(action);
      const result = await executeStoredGameAction({
        roomPhase: "playing",
        callerPlayerId: lobbyPlayerId,
        action,
        getState: async () => getStoredState(),
        setState: async (state) => setStoredState(state),
      });

      if (result.ok) {
        return { ok: true, snapshot: result.snapshot };
      }

      const latestSnapshot = PartyGameAdapter.fromStoredState(getStoredState()).getSnapshot();
      return {
        ok: false,
        snapshot: {
          ...latestSnapshot,
          lastError: result.outboundMessages[0].error,
        },
        error: result.outboundMessages[0].error,
      };
    },
  };
}

describe("QueuedAIGameAdapterProxy", () => {
  it("applies an AI action to the latest stored state instead of a stale adapter snapshot", async () => {
    const aiHand = cards("ai");
    const humanHand = cards("human");
    const thirdHand = cards("third");
    const players: AgentTestPlayer[] = [
      {
        id: "ai-0",
        name: "AI",
        isAI: true,
        aiModelId: "default:grok",
        hand: aiHand,
        isDown: false,
      },
      {
        id: "human-1",
        name: "Human",
        isAI: false,
        hand: humanHand,
        isDown: false,
      },
      {
        id: "human-2",
        name: "Other",
        isAI: false,
        hand: thirdHand,
        isDown: false,
      },
    ];

    const state: AgentTestState = {
      players,
      roundNumber: 1,
      stock: [createTestCard("A", "spades", "stock-A")],
      discard: [createTestCard("2", "clubs", "discard-2C")],
      table: [],
      turn: {
        currentPlayerIndex: 0,
        hasDrawn: true,
        phase: "awaitingDiscard",
      },
    };

    let storedState = convertAgentTestStateToStoredState(state, "queued-ai-test");
    const staleSnapshot = PartyGameAdapter.fromStoredState(storedState).getSnapshot();
    const aiEngineId = staleSnapshot.players[0]!.id;
    const humanEngineId = staleSnapshot.players[1]!.id;
    const reversedHumanHand = [...humanHand].reverse().map((card) => card.id);

    const reorderResult = await executeStoredGameAction({
      roomPhase: "playing",
      callerPlayerId: "human-1",
      action: { type: "REORDER_HAND", cardIds: reversedHumanHand },
      getState: async () => storedState,
      setState: async (state) => {
        storedState = state;
      },
    });
    expect(reorderResult.ok).toBe(true);

    const proxy = new QueuedAIGameAdapterProxy(
      createQueuedExecutor(
        () => storedState,
        (state) => {
          storedState = state;
        },
        "ai-0"
      ),
      {
        aiLobbyId: "ai-0",
        aiEngineId,
      }
    );

    const result = await proxy.discardCard(1);
    expect(result.lastError).toBeNull();

    const finalSnapshot = PartyGameAdapter.fromStoredState(storedState).getSnapshot();
    const finalHuman = finalSnapshot.players.find((player) => player.id === humanEngineId)!;
    const finalAI = finalSnapshot.players.find((player) => player.id === aiEngineId)!;

    expect(finalHuman.hand.map((card) => card.id)).toEqual(reversedHumanHand);
    expect(finalAI.hand.map((card) => card.id)).not.toContain(aiHand[0]!.id);
  });

  it("sends AI May-I allow responses through the queued executor", async () => {
    const engine = GameEngine.createGame({
      playerNames: ["AI", "Caller", "Other"],
    });
    const initialSnapshot = engine.getSnapshot();
    const aiEngineId = initialSnapshot.awaitingPlayerId;
    const callerEngineId = initialSnapshot.players.find((player) => player.id !== aiEngineId)!.id;

    engine.callMayI(callerEngineId);

    const playerMappings: PlayerMapping[] = initialSnapshot.players.map((player, index) => ({
      lobbyId: index === 0 ? "ai-0" : `human-${index}`,
      engineId: player.id,
      name: player.name,
      isAI: player.id === aiEngineId,
      aiModelId: player.id === aiEngineId ? "default:grok" : undefined,
    }));

    let storedState: StoredGameState = {
      roomId: "queued-ai-mayi-test",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      activityLog: [],
      playerMappings,
      engineSnapshot: engine.toJSON(),
    };
    const aiMapping = playerMappings.find((mapping) => mapping.engineId === aiEngineId)!;
    const executedActions: GameAction[] = [];

    const proxy = new QueuedAIGameAdapterProxy(
      createQueuedExecutor(
        () => storedState,
        (state) => {
          storedState = state;
        },
        aiMapping.lobbyId,
        executedActions
      ),
      {
        aiLobbyId: aiMapping.lobbyId,
        aiEngineId,
      }
    );

    const result = await proxy.allowMayI(aiEngineId);

    expect(result.lastError).toBeNull();
    expect(executedActions).toEqual([{ type: "ALLOW_MAY_I" }]);
  });

  it("runs fallback turns through the queued executor one action at a time", async () => {
    const state: AgentTestState = {
      players: [
        {
          id: "ai-0",
          name: "AI",
          isAI: true,
          aiModelId: "default:grok",
          hand: cards("ai-fallback"),
          isDown: false,
        },
        {
          id: "human-1",
          name: "Human",
          isAI: false,
          hand: cards("human-fallback"),
          isDown: false,
        },
        {
          id: "human-2",
          name: "Other",
          isAI: false,
          hand: cards("other-fallback"),
          isDown: false,
        },
      ],
      roundNumber: 1,
      stock: [createTestCard("A", "spades", "fallback-stock-A")],
      discard: [createTestCard("2", "clubs", "fallback-discard-2C")],
      table: [],
      turn: {
        currentPlayerIndex: 0,
        hasDrawn: false,
        phase: "awaitingDraw",
      },
    };

    let storedState = convertAgentTestStateToStoredState(state, "queued-ai-fallback-test");
    const aiEngineId = PartyGameAdapter.fromStoredState(storedState).getSnapshot().players[0]!.id;
    const executedActions: GameAction[] = [];
    const proxy = new QueuedAIGameAdapterProxy(
      createQueuedExecutor(
        () => storedState,
        (nextState) => {
          storedState = nextState;
        },
        "ai-0",
        executedActions
      ),
      {
        aiLobbyId: "ai-0",
        aiEngineId,
      }
    );

    const result = await executeFallbackTurnWithAdapter(proxy, aiEngineId, {
      phaseDelayMs: 0,
    });

    expect(result.success).toBe(true);
    expect(result.usedFallback).toBe(true);
    expect(executedActions.map((action) => action.type)).toEqual([
      "DRAW_FROM_STOCK",
      "SKIP",
      "DISCARD",
    ]);
  });
});
