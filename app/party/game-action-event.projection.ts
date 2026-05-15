import type { GameSnapshot } from "../../core/engine/game-engine.types";
import { captureRoundSummary } from "./round-summary.capture";
import type { PartyGameAdapter } from "./party-game-adapter";
import type { ServerMessage } from "./protocol.types";

export type ServerMessageRecipient = "all" | { playerId: string };

export interface ProjectedServerMessage {
  recipient: ServerMessageRecipient;
  message: ServerMessage;
}

export function projectPlayerViewMessages(input: {
  adapter: PartyGameAdapter;
  messageType: "GAME_STARTED" | "GAME_STATE";
  recipientPlayerIds: string[];
}): ProjectedServerMessage[] {
  const activityLog = input.adapter.getRecentActivityLog(10);
  const messages: ProjectedServerMessage[] = [];

  for (const playerId of input.recipientPlayerIds) {
    const playerView = input.adapter.getPlayerView(playerId);
    if (!playerView) continue;

    messages.push({
      recipient: { playerId },
      message: {
        type: input.messageType,
        state: playerView,
        activityLog,
      },
    });
  }

  return messages;
}

export function projectRoundEndedMessage(input: {
  adapter: PartyGameAdapter;
  completedRoundNumber: number;
  snapshotBefore: GameSnapshot;
}): ProjectedServerMessage {
  const latestRoundRecord = input.adapter
    .getSnapshot()
    .roundHistory.find((record) => record.roundNumber === input.completedRoundNumber);
  const summary = captureRoundSummary(
    input.snapshotBefore,
    input.adapter.getAllPlayerMappings(),
    latestRoundRecord?.winnerId
  );
  const snapshotAfter = input.adapter.getSnapshot();
  const scores: Record<string, number> = {};

  for (const mapping of input.adapter.getAllPlayerMappings()) {
    const player = snapshotAfter.players.find((candidate) => candidate.id === mapping.engineId);
    if (player) {
      scores[mapping.lobbyId] = player.totalScore;
    }
  }

  return {
    recipient: "all",
    message: {
      type: "ROUND_ENDED",
      roundNumber: input.completedRoundNumber,
      scores,
      playerNames: input.adapter.getPlayerNamesMap(),
      summary,
    },
  };
}

export function projectGameEndedMessage(adapter: PartyGameAdapter): ProjectedServerMessage {
  const snapshot = adapter.getSnapshot();
  const finalScores: Record<string, number> = {};
  let winnerId = "";
  let lowestScore = Infinity;

  for (const mapping of adapter.getAllPlayerMappings()) {
    const player = snapshot.players.find((candidate) => candidate.id === mapping.engineId);
    if (!player) continue;

    finalScores[mapping.lobbyId] = player.totalScore;
    if (player.totalScore < lowestScore) {
      lowestScore = player.totalScore;
      winnerId = mapping.lobbyId;
    }
  }

  return {
    recipient: "all",
    message: {
      type: "GAME_ENDED",
      finalScores,
      winnerId,
      playerNames: adapter.getPlayerNamesMap(),
    },
  };
}

export function projectMayIPromptMessage(
  adapter: PartyGameAdapter
): ProjectedServerMessage | null {
  const mayIContext = adapter.getSnapshot().mayIContext;
  if (!mayIContext?.playerBeingPrompted) return null;

  const callerMapping = adapter
    .getAllPlayerMappings()
    .find((mapping) => mapping.engineId === mayIContext.originalCaller);
  const promptedMapping = adapter
    .getAllPlayerMappings()
    .find((mapping) => mapping.engineId === mayIContext.playerBeingPrompted);
  if (!callerMapping || !promptedMapping) return null;

  return {
    recipient: { playerId: promptedMapping.lobbyId },
    message: {
      type: "MAY_I_PROMPT",
      callerId: callerMapping.lobbyId,
      callerName: callerMapping.name,
      card: mayIContext.cardBeingClaimed,
    },
  };
}

export function projectMayINotificationMessage(
  adapter: PartyGameAdapter
): ProjectedServerMessage | null {
  const mayIContext = adapter.getSnapshot().mayIContext;
  if (!mayIContext) return null;

  const callerMapping = adapter
    .getAllPlayerMappings()
    .find((mapping) => mapping.engineId === mayIContext.originalCaller);
  if (!callerMapping) return null;

  return {
    recipient: "all",
    message: {
      type: "MAY_I_NOTIFICATION",
      callerId: callerMapping.lobbyId,
      callerName: callerMapping.name,
      card: mayIContext.cardBeingClaimed,
    },
  };
}

export function projectMayIResolvedMessage(): ProjectedServerMessage {
  return {
    recipient: "all",
    message: {
      type: "MAY_I_RESOLVED",
      winnerId: null,
      outcome: "resolved",
    },
  };
}
