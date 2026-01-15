import type {
  AddAIPlayerMessage,
  RemoveAIPlayerMessage,
  SetStartingRoundMessage,
  HumanPlayerInfo,
} from "./protocol.types";
import {
  addAIPlayer,
  removeAIPlayer,
  setStartingRound,
  isAvatarIdTaken,
  type LobbyState,
} from "./mayi-room.lobby";

export type LobbyActionErrorCode =
  | "AVATAR_TAKEN"
  | "MAX_PLAYERS"
  | "PLAYER_NOT_FOUND"
  | "INVALID_ROUND";

export interface LobbyActionError {
  error: LobbyActionErrorCode;
  message: string;
}

export type LobbyActionResult =
  | { ok: true; lobbyState: LobbyState }
  | { ok: false; error: LobbyActionError };

export function applyAddAIPlayerAction(args: {
  lobbyState: LobbyState;
  humanPlayers: HumanPlayerInfo[];
  humanPlayerCount: number;
  message: AddAIPlayerMessage;
}): LobbyActionResult {
  const avatarId = args.message.avatarId?.trim();
  if (avatarId) {
    if (
      isAvatarIdTaken(avatarId, {
        humanPlayers: args.humanPlayers,
        aiPlayers: args.lobbyState.aiPlayers,
      })
    ) {
      return {
        ok: false,
        error: {
          error: "AVATAR_TAKEN",
          message: "That character is already taken in this lobby",
        },
      };
    }
  }

  const newState = addAIPlayer(
    args.lobbyState,
    args.humanPlayerCount,
    args.message.name,
    args.message.modelId,
    avatarId || undefined
  );

  if (!newState) {
    return {
      ok: false,
      error: {
        error: "MAX_PLAYERS",
        message: "Cannot add more players (max 8)",
      },
    };
  }

  return { ok: true, lobbyState: newState };
}

export function applyRemoveAIPlayerAction(args: {
  lobbyState: LobbyState;
  message: RemoveAIPlayerMessage;
}): LobbyActionResult {
  const newState = removeAIPlayer(args.lobbyState, args.message.playerId);
  if (!newState) {
    return {
      ok: false,
      error: {
        error: "PLAYER_NOT_FOUND",
        message: "AI player not found",
      },
    };
  }

  return { ok: true, lobbyState: newState };
}

export function applySetStartingRoundAction(args: {
  lobbyState: LobbyState;
  message: SetStartingRoundMessage;
}): LobbyActionResult {
  const newState = setStartingRound(args.lobbyState, args.message.round);
  if (!newState) {
    return {
      ok: false,
      error: {
        error: "INVALID_ROUND",
        message: "Invalid round number (must be 1-6)",
      },
    };
  }

  return { ok: true, lobbyState: newState };
}
