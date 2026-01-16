import type {
  AddAIPlayerMessage,
  ErrorMessage,
  GameAction,
  HumanPlayerInfo,
  JoinMessage,
  RemoveAIPlayerMessage,
  ServerMessage,
  SetStartingRoundMessage,
} from "./protocol.types";
import {
  upsertStoredPlayerOnJoin,
  type StoredPlayer,
} from "./mayi-room.presence";
import {
  canStartGame,
  isAvatarIdTaken,
  storedPlayersToHumanPlayerInfo,
  type LobbyState,
} from "./mayi-room.lobby";
import {
  applyAddAIPlayerAction,
  applyRemoveAIPlayerAction,
  applySetStartingRoundAction,
} from "./mayi-room.lobby-actions";
import { PartyGameAdapter, type StoredGameState } from "./party-game-adapter";
import { executeGameAction } from "./game-actions";

export type RoomPhase = "lobby" | "playing";

const MIN_NAME_LEN = 1;
const MAX_NAME_LEN = 24;
const MAX_PLAYER_ID_LEN = 64;

export interface JoinHandlerState {
  connectionId: string;
  now: number;
  existingPlayer: StoredPlayer | null;
  humanPlayers: HumanPlayerInfo[];
  lobbyState: LobbyState;
  roomPhase: RoomPhase;
  gameState: StoredGameState | null;
}

export interface JoinHandlerInput {
  message: JoinMessage;
  state: JoinHandlerState;
}

export type JoinSideEffect =
  | { type: "setConnectionState"; state: { playerId: string } }
  | { type: "broadcastPlayersAndLobby" };

export type JoinHandlerResult =
  | { ok: false; outboundMessages: [ErrorMessage]; sideEffects: [] }
  | {
      ok: true;
      nextState: {
        storedPlayerKey: string;
        storedPlayer: StoredPlayer;
      };
      outboundMessages: ServerMessage[];
      afterBroadcastMessages: ServerMessage[];
      sideEffects: JoinSideEffect[];
    };

export interface AddAIPlayerHandlerState {
  lobbyState: LobbyState;
  humanPlayers: HumanPlayerInfo[];
  humanPlayerCount: number;
}

export interface StartGameHandlerState {
  roomId: string;
  roomPhase: RoomPhase;
  callerPlayerId: string | null;
  lobbyState: LobbyState;
  storedPlayers: StoredPlayer[];
}

export interface GameActionHandlerState {
  roomPhase: RoomPhase;
  callerPlayerId: string | null;
  gameState: StoredGameState | null;
  action: GameAction;
}

export interface RemoveAIPlayerHandlerState {
  lobbyState: LobbyState;
}

export interface SetStartingRoundHandlerState {
  lobbyState: LobbyState;
}

export type LobbyActionSideEffect =
  | { type: "setLobbyState"; state: LobbyState }
  | { type: "broadcastLobbyState" };

export type LobbyActionHandlerResult =
  | { ok: false; outboundMessages: [ErrorMessage]; sideEffects: [] }
  | {
      ok: true;
      nextState: { lobbyState: LobbyState };
      outboundMessages: [];
      sideEffects: LobbyActionSideEffect[];
    };

export type StartGameSideEffect =
  | { type: "setGameState"; state: StoredGameState }
  | { type: "setRoomPhase"; phase: RoomPhase }
  | { type: "broadcastPlayerViews"; adapter: PartyGameAdapter }
  | { type: "executeAITurnsIfNeeded" };

export type GameActionSideEffect =
  | { type: "setGameState"; state: StoredGameState }
  | {
      type: "detectAndBroadcastTransitions";
      adapter: PartyGameAdapter;
      phaseBefore: string;
      roundBefore: number;
    }
  | { type: "broadcastMayIPrompt"; adapter: PartyGameAdapter }
  | { type: "executeAIMayIResponseIfNeeded"; adapter: PartyGameAdapter }
  | { type: "broadcastMayIResolved"; adapter: PartyGameAdapter }
  | { type: "broadcastGameState" }
  | { type: "executeAITurnsIfNeeded" };

export type StartGameHandlerResult =
  | { ok: false; outboundMessages: [ErrorMessage]; sideEffects: [] }
  | {
      ok: true;
      nextState: { gameState: StoredGameState; roomPhase: RoomPhase };
      outboundMessages: [];
      sideEffects: StartGameSideEffect[];
    };

export type GameActionHandlerResult =
  | { ok: false; outboundMessages: [ErrorMessage]; sideEffects: [] }
  | {
      ok: true;
      nextState: { gameState: StoredGameState };
      outboundMessages: [];
      sideEffects: GameActionSideEffect[];
    };

function buildErrorMessage(error: string, message: string): ErrorMessage {
  return { type: "ERROR", error, message };
}

export function handleJoinMessage(args: JoinHandlerInput): JoinHandlerResult {
  const playerId = args.message.playerId.trim();
  const playerName = args.message.playerName.trim();
  const avatarId = args.message.avatarId?.trim();
  const normalizedAvatarId = avatarId && avatarId.length > 0 ? avatarId : undefined;

  if (playerId.length < 1 || playerId.length > MAX_PLAYER_ID_LEN) {
    return {
      ok: false,
      outboundMessages: [buildErrorMessage("INVALID_MESSAGE", "Invalid playerId")],
      sideEffects: [],
    };
  }

  if (playerName.length < MIN_NAME_LEN || playerName.length > MAX_NAME_LEN) {
    return {
      ok: false,
      outboundMessages: [buildErrorMessage("INVALID_MESSAGE", "Invalid playerName")],
      sideEffects: [],
    };
  }

  if (normalizedAvatarId) {
    if (
      isAvatarIdTaken(normalizedAvatarId, {
        humanPlayers: args.state.humanPlayers,
        aiPlayers: args.state.lobbyState.aiPlayers,
        excludeHumanPlayerId: playerId,
      })
    ) {
      return {
        ok: false,
        outboundMessages: [
          buildErrorMessage("AVATAR_TAKEN", "That character is already taken in this lobby"),
        ],
        sideEffects: [],
      };
    }
  }

  const storedPlayer = upsertStoredPlayerOnJoin(args.state.existingPlayer, {
    playerId,
    playerName,
    avatarId: normalizedAvatarId,
    connectionId: args.state.connectionId,
    now: args.state.now,
  });

  const outboundMessages: ServerMessage[] = [
    {
      type: "JOINED",
      playerId,
      playerName: storedPlayer.name,
    },
  ];

  const afterBroadcastMessages: ServerMessage[] = [];
  if (args.state.roomPhase === "playing" && args.state.gameState) {
    const adapter = PartyGameAdapter.fromStoredState(args.state.gameState);
    const playerView = adapter.getPlayerView(playerId);
    const activityLog = adapter.getRecentActivityLog(10);
    if (playerView) {
      afterBroadcastMessages.push({
        type: "GAME_STARTED",
        state: playerView,
        activityLog,
      });
    }
  }

  return {
    ok: true,
    nextState: {
      storedPlayerKey: `player:${playerId}`,
      storedPlayer,
    },
    outboundMessages,
    afterBroadcastMessages,
    sideEffects: [
      { type: "setConnectionState", state: { playerId } },
      { type: "broadcastPlayersAndLobby" },
    ],
  };
}

export function handleAddAIPlayerMessage(args: {
  message: AddAIPlayerMessage;
  state: AddAIPlayerHandlerState;
}): LobbyActionHandlerResult {
  const result = applyAddAIPlayerAction({
    lobbyState: args.state.lobbyState,
    humanPlayers: args.state.humanPlayers,
    humanPlayerCount: args.state.humanPlayerCount,
    message: args.message,
  });

  if (!result.ok) {
    return {
      ok: false,
      outboundMessages: [buildErrorMessage(result.error.error, result.error.message)],
      sideEffects: [],
    };
  }

  return {
    ok: true,
    nextState: { lobbyState: result.lobbyState },
    outboundMessages: [],
    sideEffects: [
      { type: "setLobbyState", state: result.lobbyState },
      { type: "broadcastLobbyState" },
    ],
  };
}

export function handleRemoveAIPlayerMessage(args: {
  message: RemoveAIPlayerMessage;
  state: RemoveAIPlayerHandlerState;
}): LobbyActionHandlerResult {
  const result = applyRemoveAIPlayerAction({
    lobbyState: args.state.lobbyState,
    message: args.message,
  });

  if (!result.ok) {
    return {
      ok: false,
      outboundMessages: [buildErrorMessage(result.error.error, result.error.message)],
      sideEffects: [],
    };
  }

  return {
    ok: true,
    nextState: { lobbyState: result.lobbyState },
    outboundMessages: [],
    sideEffects: [
      { type: "setLobbyState", state: result.lobbyState },
      { type: "broadcastLobbyState" },
    ],
  };
}

export function handleSetStartingRoundMessage(args: {
  message: SetStartingRoundMessage;
  state: SetStartingRoundHandlerState;
}): LobbyActionHandlerResult {
  const result = applySetStartingRoundAction({
    lobbyState: args.state.lobbyState,
    message: args.message,
  });

  if (!result.ok) {
    return {
      ok: false,
      outboundMessages: [buildErrorMessage(result.error.error, result.error.message)],
      sideEffects: [],
    };
  }

  return {
    ok: true,
    nextState: { lobbyState: result.lobbyState },
    outboundMessages: [],
    sideEffects: [
      { type: "setLobbyState", state: result.lobbyState },
      { type: "broadcastLobbyState" },
    ],
  };
}

export function handleStartGameMessage(args: {
  state: StartGameHandlerState;
}): StartGameHandlerResult {
  if (args.state.roomPhase === "playing") {
    return {
      ok: false,
      outboundMessages: [
        buildErrorMessage("GAME_ALREADY_STARTED", "Game has already started"),
      ],
      sideEffects: [],
    };
  }

  if (!args.state.callerPlayerId) {
    return {
      ok: false,
      outboundMessages: [
        buildErrorMessage("NOT_JOINED", "You must join before starting the game"),
      ],
      sideEffects: [],
    };
  }

  const humanPlayers = storedPlayersToHumanPlayerInfo(args.state.storedPlayers);
  const humanCount = humanPlayers.length;
  const aiCount = args.state.lobbyState.aiPlayers.length;

  if (!canStartGame(humanCount, aiCount)) {
    return {
      ok: false,
      outboundMessages: [
        buildErrorMessage("INVALID_PLAYER_COUNT", "Need 3-8 players to start the game"),
      ],
      sideEffects: [],
    };
  }

  const adapter = PartyGameAdapter.createFromLobby({
    roomId: args.state.roomId,
    humanPlayers,
    aiPlayers: args.state.lobbyState.aiPlayers,
    startingRound: args.state.lobbyState.startingRound,
  });

  const gameState = adapter.getStoredState();

  return {
    ok: true,
    nextState: { gameState, roomPhase: "playing" },
    outboundMessages: [],
    sideEffects: [
      { type: "setGameState", state: gameState },
      { type: "setRoomPhase", phase: "playing" },
      { type: "broadcastPlayerViews", adapter },
      { type: "executeAITurnsIfNeeded" },
    ],
  };
}

export function handleGameActionMessage(args: {
  state: GameActionHandlerState;
}): GameActionHandlerResult {
  if (args.state.roomPhase !== "playing") {
    return {
      ok: false,
      outboundMessages: [
        buildErrorMessage("GAME_NOT_STARTED", "Game has not started yet"),
      ],
      sideEffects: [],
    };
  }

  if (!args.state.callerPlayerId) {
    return {
      ok: false,
      outboundMessages: [
        buildErrorMessage("NOT_JOINED", "You must join before performing actions"),
      ],
      sideEffects: [],
    };
  }

  if (!args.state.gameState) {
    return {
      ok: false,
      outboundMessages: [buildErrorMessage("GAME_NOT_FOUND", "Game state not found")],
      sideEffects: [],
    };
  }

  const adapter = PartyGameAdapter.fromStoredState(args.state.gameState);
  const snapshotBefore = adapter.getSnapshot();
  const phaseBefore = snapshotBefore.phase;
  const roundBefore = snapshotBefore.currentRound;

  const result = executeGameAction(
    adapter,
    args.state.callerPlayerId,
    args.state.action
  );

  if (!result.success) {
    const errorCode = result.error ?? "ACTION_FAILED";
    return {
      ok: false,
      outboundMessages: [
        buildErrorMessage(errorCode, `Action failed: ${result.error}`),
      ],
      sideEffects: [],
    };
  }

  const snapshotAfter = adapter.getSnapshot();
  const phaseAfter = snapshotAfter.phase;
  const gameState = adapter.getStoredState();

  const sideEffects: GameActionSideEffect[] = [
    { type: "setGameState", state: gameState },
  ];

  if (phaseBefore !== "RESOLVING_MAY_I" && phaseAfter === "RESOLVING_MAY_I") {
    sideEffects.push({ type: "broadcastMayIPrompt", adapter });
    sideEffects.push({ type: "executeAIMayIResponseIfNeeded", adapter });
  } else if (
    phaseBefore === "RESOLVING_MAY_I" &&
    phaseAfter === "RESOLVING_MAY_I"
  ) {
    sideEffects.push({ type: "broadcastMayIPrompt", adapter });
    sideEffects.push({ type: "executeAIMayIResponseIfNeeded", adapter });
  } else if (
    phaseBefore === "RESOLVING_MAY_I" &&
    phaseAfter !== "RESOLVING_MAY_I"
  ) {
    sideEffects.push({ type: "broadcastMayIResolved", adapter });
  }

  sideEffects.push({
    type: "detectAndBroadcastTransitions",
    adapter,
    phaseBefore,
    roundBefore,
  });
  sideEffects.push({ type: "broadcastGameState" });

  if (phaseAfter === "ROUND_ACTIVE") {
    sideEffects.push({ type: "executeAITurnsIfNeeded" });
  }

  return {
    ok: true,
    nextState: { gameState },
    outboundMessages: [],
    sideEffects,
  };
}
