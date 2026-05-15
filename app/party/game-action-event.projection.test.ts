import { describe, expect, it } from "bun:test";
import type { GameSnapshot } from "../../core/engine/game-engine.types";
import { PartyGameAdapter, type PlayerMapping } from "./party-game-adapter";
import {
  projectGameEndedMessage,
  projectMayINotificationMessage,
  projectMayIPromptMessage,
  projectPlayerViewMessages,
  projectRoundEndedMessage,
} from "./game-action-event.projection";
import type { HumanPlayerInfo } from "./protocol.types";

function human(playerId: string, name: string): HumanPlayerInfo {
  return {
    playerId,
    name,
    isConnected: true,
    disconnectedAt: null,
  };
}

function createAdapter(): PartyGameAdapter {
  return PartyGameAdapter.createFromLobby({
    roomId: "projection-test-room",
    humanPlayers: [
      human("human-1", "Alice"),
      human("human-2", "Bob"),
      human("human-3", "Carol"),
    ],
    aiPlayers: [],
    startingRound: 1,
  });
}

function callMayIFromNonCurrentPlayer(adapter: PartyGameAdapter): {
  callerId: string;
  promptedId: string;
} {
  const awaitingId = adapter.getAwaitingLobbyPlayerId();
  const caller = adapter
    .getAllPlayerMappings()
    .find((mapping) => mapping.lobbyId !== awaitingId);
  if (!caller) {
    throw new Error("Expected non-current caller");
  }

  adapter.callMayI(caller.lobbyId);
  const mayIContext = adapter.getSnapshot().mayIContext;
  if (!mayIContext?.playerBeingPrompted) {
    throw new Error("Expected May-I prompt");
  }

  const prompted = adapter
    .getAllPlayerMappings()
    .find((mapping) => mapping.engineId === mayIContext.playerBeingPrompted);
  if (!prompted) {
    throw new Error("Expected prompted mapping");
  }

  return { callerId: caller.lobbyId, promptedId: prompted.lobbyId };
}

describe("game action event projection", () => {
  it("projects per-player state messages with private hands and activity log", () => {
    const adapter = createAdapter();
    const messages = projectPlayerViewMessages({
      adapter,
      messageType: "GAME_STATE",
      recipientPlayerIds: ["human-1", "human-2"],
    });

    expect(messages).toHaveLength(2);
    expect(messages.map((message) => message.recipient)).toEqual([
      { playerId: "human-1" },
      { playerId: "human-2" },
    ]);

    const first = messages[0]?.message;
    expect(first?.type).toBe("GAME_STATE");
    if (first?.type !== "GAME_STATE") {
      throw new Error("Expected GAME_STATE");
    }
    expect(first.activityLog).toEqual(adapter.getRecentActivityLog(10));
    expect(first.state.yourHand).toHaveLength(11);
    expect(first.state.opponents[0]).not.toHaveProperty("hand");
  });

  it("projects a May-I prompt only to the prompted player", () => {
    const adapter = createAdapter();
    const { callerId, promptedId } = callMayIFromNonCurrentPlayer(adapter);

    const message = projectMayIPromptMessage(adapter);

    expect(message?.recipient).toEqual({ playerId: promptedId });
    expect(message?.message.type).toBe("MAY_I_PROMPT");
    if (message?.message.type !== "MAY_I_PROMPT") {
      throw new Error("Expected MAY_I_PROMPT");
    }
    const mayIContext = adapter.getSnapshot().mayIContext;
    if (!mayIContext) {
      throw new Error("Expected May-I context");
    }
    expect(message.message.callerId).toBe(callerId);
    expect(message.message.card).toEqual(mayIContext.cardBeingClaimed);
  });

  it("projects a May-I notification for all connected players", () => {
    const adapter = createAdapter();
    const { callerId } = callMayIFromNonCurrentPlayer(adapter);

    const message = projectMayINotificationMessage(adapter);

    expect(message?.recipient).toBe("all");
    expect(message?.message.type).toBe("MAY_I_NOTIFICATION");
    if (message?.message.type !== "MAY_I_NOTIFICATION") {
      throw new Error("Expected MAY_I_NOTIFICATION");
    }
    expect(message.message.callerId).toBe(callerId);
  });

  it("projects round-ended messages with round summary details", () => {
    const adapter = createAdapter();
    const snapshotBefore = adapter.getSnapshot();
    const winnerMapping = adapter.getAllPlayerMappings()[0] as PlayerMapping;
    const roundEndSnapshot: GameSnapshot = {
      ...snapshotBefore,
      players: snapshotBefore.players.map((player) => ({
        ...player,
        hand: player.id === winnerMapping.engineId ? [] : player.hand,
      })),
    };

    const message = projectRoundEndedMessage({
      adapter,
      completedRoundNumber: 1,
      snapshotBefore: roundEndSnapshot,
    });

    expect(message.recipient).toBe("all");
    expect(message.message.type).toBe("ROUND_ENDED");
    if (message.message.type !== "ROUND_ENDED") {
      throw new Error("Expected ROUND_ENDED");
    }
    expect(message.message.roundNumber).toBe(1);
    expect(message.message.playerNames[winnerMapping.lobbyId]).toBe(winnerMapping.name);
    expect(message.message.summary.winnerId).toBe(winnerMapping.lobbyId);
  });

  it("projects game-ended messages with final scores and winner", () => {
    const adapter = createAdapter();
    const message = projectGameEndedMessage(adapter);
    const mappings = adapter.getAllPlayerMappings();

    expect(message.recipient).toBe("all");
    expect(message.message.type).toBe("GAME_ENDED");
    if (message.message.type !== "GAME_ENDED") {
      throw new Error("Expected GAME_ENDED");
    }
    expect(Object.keys(message.message.finalScores).sort()).toEqual(
      mappings.map((mapping) => mapping.lobbyId).sort()
    );
    expect(mappings.map((mapping) => mapping.lobbyId)).toContain(message.message.winnerId);
  });
});
