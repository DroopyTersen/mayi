import { describe, expect, it } from "bun:test";
import { PartyGameAdapter } from "../../app/party/party-game-adapter";
import { executeGameAction } from "../../app/party/game-actions";
import type { GameAction } from "../engine/game-action.command";
import { projectGameActionActivity } from "./game-action-activity";

describe("shared public action history", () => {
  it("matches the app log over real turns, May I resolution, and private draws", () => {
    const adapter = PartyGameAdapter.createFromLobby({
      roomId: "shared-history",
      humanPlayers: ["A", "B", "C"].map((name, index) => ({
        name,
        playerId: `human-${index}`,
        isConnected: true,
        disconnectedAt: null,
      })),
      aiPlayers: [],
      startingRound: 2,
    });
    const history: ReturnType<typeof projectGameActionActivity> = [];
    const play = (playerId: string, action: GameAction) => {
      const before = adapter.getSnapshot();
      const result = executeGameAction(adapter, playerId, action);
      expect(result.success).toBe(true);
      if (!result.success) throw new Error(result.error);
      history.push(
        ...projectGameActionActivity({
          playerId: adapter.lobbyIdToEngineId(playerId)!,
          action,
          before,
          after: result.snapshot,
        }),
      );
    };
    try {
      for (let turn = 0; turn < 12; turn++) {
        const lobbyId = adapter.getAwaitingLobbyPlayerId()!;
        const playerId = adapter.lobbyIdToEngineId(lobbyId)!;
        if (turn === 1) {
          const before = adapter.getSnapshot();
          const caller =
            before.players[(before.currentPlayerIndex + 1) % 3]!.id;
          play(adapter.engineIdToLobbyId(caller)!, { type: "CALL_MAY_I" });
          while (adapter.getSnapshot().phase === "RESOLVING_MAY_I") {
            play(adapter.getAwaitingLobbyPlayerId()!, { type: "ALLOW_MAY_I" });
          }
        }
        play(lobbyId, {
          type: turn === 0 ? "DRAW_FROM_DISCARD" : "DRAW_FROM_STOCK",
        });
        const hand = adapter
          .getSnapshot()
          .players.find((p) => p.id === playerId)!.hand;
        play(lobbyId, { type: "DISCARD", cardId: hand.at(-1)!.id });
      }
      const actual = adapter
        .getCurrentRoundActivityLogForEngine()
        .map(({ id: _id, timestamp: _timestamp, ...entry }) => entry);
      expect(history).toEqual(actual);
      expect(history.length).toBeGreaterThan(24);
      expect(
        history
          .filter((entry) => entry.action === "drew from the draw pile")
          .every((entry) => entry.details === undefined),
      ).toBe(true);
      expect(
        history.some((entry) => entry.action === "took the May I card"),
      ).toBe(true);
    } finally {
      adapter.stop();
    }
  });
});
