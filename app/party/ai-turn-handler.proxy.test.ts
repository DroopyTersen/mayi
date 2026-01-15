import { describe, it, expect } from "bun:test";

import { AIGameAdapterProxy } from "./ai-turn-handler";
import { PartyGameAdapter, type PlayerMapping, type StoredGameState } from "./party-game-adapter";
import { convertAgentTestStateToStoredState } from "./agent-state.converter";
import type { AgentTestState } from "./agent-state.types";
import { createTestCard, createTestHand } from "../../core/engine/test.fixtures";
import { GameEngine } from "../../core/engine/game-engine";

function createAdapterFromState(state: AgentTestState): PartyGameAdapter {
  const stored = convertAgentTestStateToStoredState(state, "test-room");
  return PartyGameAdapter.fromStoredState(stored);
}

function createBasePlayers(hand0: AgentTestState["players"][0]["hand"]) {
  return [
    {
      id: "ai-0",
      name: "AI-0",
      isAI: true,
      aiModelId: "default:grok",
      hand: hand0,
      isDown: false,
    },
    {
      id: "ai-1",
      name: "AI-1",
      isAI: true,
      aiModelId: "default:grok",
      hand: createTestHand([
        { rank: "3", suit: "spades" },
        { rank: "4", suit: "spades" },
        { rank: "5", suit: "spades" },
        { rank: "6", suit: "spades" },
        { rank: "7", suit: "spades" },
        { rank: "8", suit: "spades" },
        { rank: "9", suit: "spades" },
        { rank: "10", suit: "spades" },
        { rank: "J", suit: "spades" },
        { rank: "Q", suit: "spades" },
        { rank: "K", suit: "spades" },
      ]),
      isDown: false,
    },
    {
      id: "ai-2",
      name: "AI-2",
      isAI: true,
      aiModelId: "default:grok",
      hand: createTestHand([
        { rank: "3", suit: "clubs" },
        { rank: "4", suit: "clubs" },
        { rank: "5", suit: "clubs" },
        { rank: "6", suit: "clubs" },
        { rank: "7", suit: "clubs" },
        { rank: "8", suit: "clubs" },
        { rank: "9", suit: "clubs" },
        { rank: "10", suit: "clubs" },
        { rank: "J", suit: "clubs" },
        { rank: "Q", suit: "clubs" },
        { rank: "K", suit: "clubs" },
      ]),
      isDown: false,
    },
  ] as AgentTestState["players"];
}

function createMayIResolutionAdapter() {
  const engine = GameEngine.createGame({
    playerNames: ["AI-0", "Player-1", "Player-2"],
  });

  const initialSnapshot = engine.getSnapshot();
  const currentEngineId = initialSnapshot.awaitingPlayerId;
  const callerIndex = (initialSnapshot.currentPlayerIndex + 1) % initialSnapshot.players.length;
  const callerEngineId = initialSnapshot.players[callerIndex]?.id;
  if (!callerEngineId) {
    throw new Error("Expected a May-I caller");
  }

  engine.callMayI(callerEngineId);

  const resolvingSnapshot = engine.getSnapshot();
  if (resolvingSnapshot.phase !== "RESOLVING_MAY_I" || !resolvingSnapshot.mayIContext) {
    throw new Error("Expected May-I resolution state");
  }

  const playerMappings: PlayerMapping[] = initialSnapshot.players.map((player, index) => ({
    lobbyId: `lobby-${index}`,
    engineId: player.id,
    name: player.name,
    isAI: player.id === currentEngineId,
    aiModelId: player.id === currentEngineId ? "default:grok" : undefined,
  }));

  const storedState: StoredGameState = {
    roomId: "test-room",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    activityLog: [],
    playerMappings,
    engineSnapshot: engine.toJSON(),
  };

  const adapter = PartyGameAdapter.fromStoredState(storedState);
  const aiMapping = playerMappings.find((mapping) => mapping.engineId === currentEngineId);
  const callerMapping = playerMappings.find((mapping) => mapping.engineId === callerEngineId);
  if (!aiMapping || !callerMapping) {
    throw new Error("Expected AI and caller mappings");
  }

  return {
    adapter,
    proxy: new AIGameAdapterProxy(adapter, aiMapping.lobbyId),
    aiLobbyId: aiMapping.lobbyId,
    callerLobbyId: callerMapping.lobbyId,
  };
}

describe("AIGameAdapterProxy", () => {
  it("returns the current snapshot", () => {
    const state: AgentTestState = {
      players: createBasePlayers(
        createTestHand([
          { rank: "3", suit: "hearts" },
          { rank: "4", suit: "hearts" },
          { rank: "5", suit: "hearts" },
          { rank: "6", suit: "hearts" },
          { rank: "7", suit: "hearts" },
          { rank: "8", suit: "hearts" },
          { rank: "9", suit: "hearts" },
          { rank: "10", suit: "hearts" },
          { rank: "J", suit: "hearts" },
          { rank: "Q", suit: "hearts" },
          { rank: "K", suit: "hearts" },
        ])
      ),
      roundNumber: 1,
      stock: [createTestCard("A", "spades", "stock-1")],
      discard: [createTestCard("2", "clubs", "discard-1")],
      table: [],
      turn: {
        currentPlayerIndex: 0,
        hasDrawn: false,
        phase: "awaitingDraw",
      },
    };

    const adapter = createAdapterFromState(state);
    const proxy = new AIGameAdapterProxy(adapter, "ai-0");

    expect(proxy.getSnapshot().gameId).toBe(adapter.getSnapshot().gameId);
  });

  it("draws from stock and updates hand", () => {
    const hand = createTestHand([
      { rank: "3", suit: "hearts" },
      { rank: "4", suit: "hearts" },
      { rank: "5", suit: "hearts" },
      { rank: "6", suit: "hearts" },
      { rank: "7", suit: "hearts" },
      { rank: "8", suit: "hearts" },
      { rank: "9", suit: "hearts" },
      { rank: "10", suit: "hearts" },
      { rank: "J", suit: "hearts" },
      { rank: "Q", suit: "hearts" },
      { rank: "K", suit: "hearts" },
    ]);

    const state: AgentTestState = {
      players: createBasePlayers(hand),
      roundNumber: 1,
      stock: [createTestCard("A", "spades", "stock-1")],
      discard: [createTestCard("2", "clubs", "discard-1")],
      table: [],
      turn: {
        currentPlayerIndex: 0,
        hasDrawn: false,
        phase: "awaitingDraw",
      },
    };

    const adapter = createAdapterFromState(state);
    const proxy = new AIGameAdapterProxy(adapter, "ai-0");
    const before = adapter.getSnapshot();
    const result = proxy.drawFromStock();
    const mapping = adapter.getPlayerMapping("ai-0")!;
    const playerBefore = before.players.find((p) => p.id === mapping.engineId)!;
    const playerAfter = result.players.find((p) => p.id === mapping.engineId)!;

    expect(result.hasDrawn).toBe(true);
    expect(result.stock.length).toBe(before.stock.length - 1);
    expect(playerAfter.hand.length).toBe(playerBefore.hand.length + 1);
  });

  it("draws from discard and updates hand", () => {
    const hand = createTestHand([
      { rank: "3", suit: "hearts" },
      { rank: "4", suit: "hearts" },
      { rank: "5", suit: "hearts" },
      { rank: "6", suit: "hearts" },
      { rank: "7", suit: "hearts" },
      { rank: "8", suit: "hearts" },
      { rank: "9", suit: "hearts" },
      { rank: "10", suit: "hearts" },
      { rank: "J", suit: "hearts" },
      { rank: "Q", suit: "hearts" },
      { rank: "K", suit: "hearts" },
    ]);

    const state: AgentTestState = {
      players: createBasePlayers(hand),
      roundNumber: 1,
      stock: [createTestCard("A", "spades", "stock-1")],
      discard: [createTestCard("2", "clubs", "discard-1")],
      table: [],
      turn: {
        currentPlayerIndex: 0,
        hasDrawn: false,
        phase: "awaitingDraw",
      },
    };

    const adapter = createAdapterFromState(state);
    const proxy = new AIGameAdapterProxy(adapter, "ai-0");
    const before = adapter.getSnapshot();
    const result = proxy.drawFromDiscard();
    const mapping = adapter.getPlayerMapping("ai-0")!;
    const playerBefore = before.players.find((p) => p.id === mapping.engineId)!;
    const playerAfter = result.players.find((p) => p.id === mapping.engineId)!;

    expect(result.hasDrawn).toBe(true);
    expect(result.discard.length).toBe(before.discard.length - 1);
    expect(playerAfter.hand.length).toBe(playerBefore.hand.length + 1);
  });

  it("skips to discard phase after drawing", () => {
    const hand = [
      createTestCard("Q", "spades", "p0-Q-S"),
      createTestCard("9", "clubs", "p0-9-C"),
    ];

    const state: AgentTestState = {
      players: createBasePlayers(hand),
      roundNumber: 1,
      stock: [createTestCard("A", "spades", "stock-1")],
      discard: [createTestCard("2", "clubs", "discard-1")],
      table: [],
      turn: {
        currentPlayerIndex: 0,
        hasDrawn: true,
        drawSource: "stock",
        phase: "awaitingAction",
      },
    };

    const adapter = createAdapterFromState(state);
    const proxy = new AIGameAdapterProxy(adapter, "ai-0");
    const result = proxy.skip();

    expect(result.turnPhase).toBe("AWAITING_DISCARD");
  });

  it("lays down melds from hand positions", () => {
    const hand = [
      createTestCard("K", "hearts", "p0-K-H"),
      createTestCard("K", "diamonds", "p0-K-D"),
      createTestCard("K", "spades", "p0-K-S"),
      createTestCard("5", "clubs", "p0-5-C"),
      createTestCard("6", "clubs", "p0-6-C"),
      createTestCard("7", "clubs", "p0-7-C"),
      createTestCard("8", "clubs", "p0-8-C"),
      createTestCard("9", "hearts", "p0-9-H"),
      createTestCard("10", "hearts", "p0-10-H"),
      createTestCard("J", "hearts", "p0-J-H"),
      createTestCard("Q", "hearts", "p0-Q-H"),
    ];

    const state: AgentTestState = {
      players: createBasePlayers(hand),
      roundNumber: 2,
      stock: [createTestCard("A", "spades", "stock-1")],
      discard: [createTestCard("2", "clubs", "discard-1")],
      table: [],
      turn: {
        currentPlayerIndex: 0,
        hasDrawn: true,
        drawSource: "stock",
        phase: "awaitingAction",
      },
    };

    const adapter = createAdapterFromState(state);
    const proxy = new AIGameAdapterProxy(adapter, "ai-0");
    const result = proxy.layDown([
      [1, 2, 3],
      [4, 5, 6, 7],
    ]);

    expect(result.table.length).toBe(2);
    expect(result.turnPhase).toBe("AWAITING_DISCARD");
  });

  it("lays off a card to a set meld", () => {
    const hand = [
      createTestCard("Q", "spades", "p0-Q-S"),
      createTestCard("9", "clubs", "p0-9-C"),
    ];

    const state: AgentTestState = {
      players: createBasePlayers(hand).map((player, index) =>
        index === 0 ? { ...player, isDown: true } : player
      ),
      roundNumber: 1,
      stock: [createTestCard("A", "spades", "stock-1")],
      discard: [createTestCard("2", "clubs", "discard-1")],
      table: [
        {
          id: "meld-1",
          type: "set",
          ownerId: "ai-0",
          cards: [
            createTestCard("Q", "hearts", "table-Q-H"),
            createTestCard("Q", "diamonds", "table-Q-D"),
            createTestCard("Q", "clubs", "table-Q-C"),
          ],
        },
      ],
      turn: {
        currentPlayerIndex: 0,
        hasDrawn: true,
        drawSource: "stock",
        phase: "awaitingAction",
      },
    };

    const adapter = createAdapterFromState(state);
    const proxy = new AIGameAdapterProxy(adapter, "ai-0");
    const result = proxy.layOff(1, 1);

    expect(result.table[0]?.cards.length).toBe(4);
    expect(result.turnPhase).toBe("AWAITING_ACTION");
  });

  it("swaps a joker in a run by position", () => {
    const swapCard = createTestCard("6", "spades", "p0-6-S");
    const jokerCard = createTestCard("Joker", null, "table-joker");

    const state: AgentTestState = {
      players: createBasePlayers([swapCard]),
      roundNumber: 1,
      stock: [createTestCard("A", "spades", "stock-1")],
      discard: [createTestCard("2", "clubs", "discard-1")],
      table: [
        {
          id: "meld-1",
          type: "run",
          ownerId: "ai-1",
          cards: [
            createTestCard("5", "spades", "table-5"),
            jokerCard,
            createTestCard("7", "spades", "table-7"),
            createTestCard("8", "spades", "table-8"),
          ],
        },
      ],
      turn: {
        currentPlayerIndex: 0,
        hasDrawn: true,
        drawSource: "stock",
        phase: "awaitingAction",
      },
    };

    const adapter = createAdapterFromState(state);
    const proxy = new AIGameAdapterProxy(adapter, "ai-0");
    const result = proxy.swap(1, 2, 1);
    const mapping = adapter.getPlayerMapping("ai-0")!;
    const playerAfter = result.players.find((p) => p.id === mapping.engineId)!;

    expect(result.table[0]?.cards[1]?.id).toBe("p0-6-S");
    expect(playerAfter.hand.some((card) => card.id === "table-joker")).toBe(true);
  });

  it("discards a card by hand position", () => {
    const hand = [
      createTestCard("Q", "spades", "p0-Q-S"),
      createTestCard("9", "clubs", "p0-9-C"),
    ];

    const state: AgentTestState = {
      players: createBasePlayers(hand),
      roundNumber: 1,
      stock: [createTestCard("A", "spades", "stock-1")],
      discard: [createTestCard("2", "clubs", "discard-1")],
      table: [],
      turn: {
        currentPlayerIndex: 0,
        hasDrawn: true,
        drawSource: "stock",
        phase: "awaitingAction",
      },
    };

    const adapter = createAdapterFromState(state);
    const proxy = new AIGameAdapterProxy(adapter, "ai-0");
    const before = adapter.getSnapshot();
    const result = proxy.discardCard(1);

    expect(result.discard.length).toBe(before.discard.length + 1);
  });

  it("allows May-I and logs resolution", () => {
    const { adapter, proxy, aiLobbyId, callerLobbyId } = createMayIResolutionAdapter();

    const result = proxy.allowMayI(aiLobbyId);

    expect(result.phase).toBe("ROUND_ACTIVE");

    const actions = adapter.getRecentActivityLog(10);
    expect(actions.some((entry) => entry.action === "allowed May I" && entry.playerId === aiLobbyId))
      .toBe(true);
    expect(actions.some((entry) => entry.action === "took the May I card" && entry.playerId === callerLobbyId))
      .toBe(true);
  });

  it("claims May-I and logs the claim", () => {
    const { adapter, proxy, aiLobbyId } = createMayIResolutionAdapter();

    const result = proxy.claimMayI(aiLobbyId);

    expect(result.phase).toBe("ROUND_ACTIVE");

    const actions = adapter.getRecentActivityLog(10);
    expect(actions.some((entry) => entry.action === "claimed May I" && entry.playerId === aiLobbyId))
      .toBe(true);
    expect(actions.some((entry) => entry.action === "took the May I card" && entry.playerId === aiLobbyId))
      .toBe(true);
  });
});
