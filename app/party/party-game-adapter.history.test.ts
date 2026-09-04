import { describe, expect, it } from "bun:test";
import { outputGameStateForLLM } from "../../ai/mayIAgent.prompt-renderer";
import { PartyGameAdapter } from "./party-game-adapter";
import { projectPlayerViewMessages } from "./game-action-event.projection";
import { createInitialLobbyState } from "./mayi-room.lobby";
import { handleJoinMessage } from "./mayi-room.message-handlers";
import { convertAgentTestStateToStoredState } from "./agent-state.converter";
import type { Card } from "../../core/card/card.types";
import { formatActivityLogEntries } from "../routes/game/game-room-session.logic";

function createHistory() {
  const humans = ["Alice", "Bob", "Carol"].map((name, index) => ({
    playerId: `human-${index}`,
    name,
    isConnected: true,
    disconnectedAt: null,
  }));
  const adapter = PartyGameAdapter.createFromLobby({
    roomId: "public-history-test",
    humanPlayers: humans,
    aiPlayers: [],
    startingRound: 2,
  });
  // Replay real actions, not a mock history source. The first public pickup
  // must survive many subsequent turns and the stored-state boundary.
  for (let turn = 0; turn < 15; turn++) {
    const lobbyId = adapter.getAwaitingLobbyPlayerId()!;
    const engineId = adapter.lobbyIdToEngineId(lobbyId)!;
    const before = adapter.getSnapshot();
    const afterDraw =
      turn === 0
        ? adapter.drawFromDiscard(lobbyId)!
        : adapter.drawFromStock(lobbyId)!;
    const originalIds = new Set(
      before.players.find((p) => p.id === engineId)!.hand.map((c) => c.id),
    );
    const drawn = afterDraw.players
      .find((p) => p.id === engineId)!
      .hand.find((c) => !originalIds.has(c.id))!;
    expect(drawn).toBeDefined();
    adapter.logDraw(
      lobbyId,
      before,
      afterDraw,
      turn === 0 ? "discard" : "stock",
    );
    const afterDiscard = adapter.discard(lobbyId, drawn.id)!;
    adapter.logDiscard(lobbyId, afterDraw, afterDiscard, drawn.id);
  }
  const stored = adapter.getStoredState();
  adapter.stop();
  // Previous-hand facts are retained in storage but must not enter this hand.
  stored.activityLog.unshift({
    id: "prior-hand",
    timestamp: "2026-01-01T00:00:00Z",
    roundNumber: 1,
    turnNumber: 1,
    playerId: "human-1",
    playerName: "Bob",
    action: "took from discard",
    details: "prior-hand-card",
  });
  return { adapter: PartyGameAdapter.fromStoredState(stored), humans };
}

describe("current-hand public activity", () => {
  it("records the actual cards laid down so public pickups can be accounted for", () => {
    const card = (
      id: string,
      rank: Card["rank"],
      suit: Card["suit"],
    ): Card => ({ id, rank, suit });
    const set = [
      card("7h", "7", "hearts"),
      card("7d", "7", "diamonds"),
      card("7c", "7", "clubs"),
    ];
    const run = [
      card("4s", "4", "spades"),
      card("5s", "5", "spades"),
      card("6s", "6", "spades"),
      card("7s", "7", "spades"),
    ];
    const adapter = PartyGameAdapter.fromStoredState(
      convertAgentTestStateToStoredState(
        {
          players: [
            {
              id: "alice",
              name: "Alice",
              isAI: false,
              isDown: false,
              hand: [
                ...set,
                ...run,
                card("qc", "Q", "clubs"),
                card("kc", "K", "clubs"),
                card("9h", "9", "hearts"),
                card("ac", "A", "clubs"),
                card("3d", "3", "diamonds"),
              ],
            },
            {
              id: "bob",
              name: "Bob",
              isAI: false,
              isDown: false,
              hand: [card("kh", "K", "hearts")],
            },
            {
              id: "carol",
              name: "Carol",
              isAI: false,
              isDown: false,
              hand: [card("kd", "K", "diamonds")],
            },
          ],
          roundNumber: 2,
          stock: [card("8c", "8", "clubs")],
          discard: [card("10c", "10", "clubs")],
          table: [],
          turn: {
            currentPlayerIndex: 0,
            hasDrawn: true,
            phase: "awaitingAction",
          },
        },
        "public-laydown-test",
      ),
    );
    try {
      const before = adapter.getSnapshot();
      const after = adapter.layDown("alice", [
        { type: "set", cardIds: set.map((c) => c.id) },
        { type: "run", cardIds: run.map((c) => c.id) },
      ])!;
      expect(after.players[0]?.isDown).toBe(true);
      adapter.logLayDown("alice", before, after);
      const entry = adapter
        .getCurrentRoundActivityLog()
        .find((e) => e.action === "laid down contract")!;
      expect(entry.details).toContain("7♥ 7♦ 7♣");
      expect(entry.details).toContain("4♠ 5♠ 6♠ 7♠");
      expect(entry.details).not.toContain("Q♣");
      expect(formatActivityLogEntries([entry])[0]?.message).toContain(
        "7♥ 7♦ 7♣",
      );
    } finally {
      adapter.stop();
    }
  });

  it("attributes a winning discard to the completed hand, not the next hand", () => {
    const card = (
      id: string,
      rank: Card["rank"],
      suit: Card["suit"],
    ): Card => ({ id, rank, suit });
    const adapter = PartyGameAdapter.fromStoredState(
      convertAgentTestStateToStoredState(
        {
          players: [
            {
              id: "alice",
              name: "Alice",
              isAI: false,
              isDown: true,
              hand: [card("last-card", "8", "diamonds")],
            },
            {
              id: "bob",
              name: "Bob",
              isAI: false,
              isDown: false,
              hand: [card("kh", "K", "hearts")],
            },
            {
              id: "carol",
              name: "Carol",
              isAI: false,
              isDown: false,
              hand: [card("kd", "K", "diamonds")],
            },
          ],
          roundNumber: 2,
          stock: [card("8c", "8", "clubs")],
          discard: [card("10c", "10", "clubs")],
          table: [],
          turn: {
            currentPlayerIndex: 0,
            hasDrawn: true,
            phase: "awaitingAction",
          },
        },
        "public-history-round-transition",
      ),
    );
    try {
      const before = adapter.getSnapshot();
      const after = adapter.discard("alice", "last-card")!;
      expect(after.currentRound).toBe(3);
      adapter.logDiscard("alice", before, after, "last-card");
      const entries = adapter
        .getStoredState()
        .activityLog.filter((entry) => entry.playerId === "alice");
      expect(entries.map((entry) => entry.action)).toEqual([
        "discarded",
        "went out!",
      ]);
      expect(entries[0]?.details).toBe("8♦");
      expect(
        entries.every(
          (entry) =>
            entry.roundNumber === 2 && entry.turnNumber === before.turnNumber,
        ),
      ).toBe(true);
      expect(adapter.getCurrentRoundActivityLog()).toEqual([]);
    } finally {
      adapter.stop();
    }
  });

  it("persists more than ten events, maps AI identities, and excludes other hands", () => {
    const { adapter } = createHistory();
    try {
      const history = adapter.getCurrentRoundActivityLog();
      expect(history).toHaveLength(30);
      expect(history[0]?.action).toBe("took from discard");
      expect(history.every((entry) => entry.roundNumber === 2)).toBe(true);
      expect(
        history
          .filter((entry) => entry.action === "drew from the draw pile")
          .every((entry) => entry.details === undefined),
      ).toBe(true);
      const aiHistory = adapter.getCurrentRoundActivityLogForEngine();
      expect(aiHistory).toHaveLength(history.length);
      expect(aiHistory.map((entry) => entry.details)).toEqual(
        history.map((entry) => entry.details),
      );
      expect(
        aiHistory.every((entry) => entry.playerId.startsWith("player-")),
      ).toBe(true);
      const rendered = outputGameStateForLLM(
        adapter.getSnapshot(),
        "player-0",
        { actionLog: aiHistory },
      );
      expect(rendered).toContain(`took from discard ${history[0]!.details}`);
      expect(rendered).not.toContain("prior-hand-card");
    } finally {
      adapter.stop();
    }
  });

  it("sends the same full public history to every player view", () => {
    const { adapter, humans } = createHistory();
    try {
      const messages = projectPlayerViewMessages({
        adapter,
        messageType: "GAME_STATE",
        recipientPlayerIds: humans.map((p) => p.playerId),
      });
      expect(messages).toHaveLength(3);
      for (const { message } of messages) {
        if (message.type !== "GAME_STATE")
          throw new Error("Expected player view");
        expect(message.activityLog).toHaveLength(30);
        expect(message.activityLog[0]?.action).toBe("took from discard");
        expect(
          message.state.opponents.every((opponent) => !("hand" in opponent)),
        ).toBe(true);
      }
    } finally {
      adapter.stop();
    }
  });

  it("restores the full current-hand history when reconnecting", () => {
    const { adapter, humans } = createHistory();
    try {
      const result = handleJoinMessage({
        message: { type: "JOIN", playerId: "human-0", playerName: "Alice" },
        state: {
          connectionId: "history-reconnect",
          now: 123,
          existingPlayer: null,
          humanPlayers: humans,
          lobbyState: createInitialLobbyState(),
          roomPhase: "playing",
          gameState: adapter.getStoredState(),
        },
      });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected reconnect");
      const started = result.afterBroadcastMessages.find(
        (message) => message.type === "GAME_STARTED",
      );
      expect(started?.type).toBe("GAME_STARTED");
      if (started?.type !== "GAME_STARTED")
        throw new Error("Expected game state");
      expect(started.activityLog).toHaveLength(30);
      expect(started.activityLog[0]?.action).toBe("took from discard");
    } finally {
      adapter.stop();
    }
  });
});
