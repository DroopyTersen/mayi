/**
 * Pure lobby state management logic for Phase 3
 *
 * This file contains NO Durable Object / WebSocket code so we can unit test it
 * with Bun (TDD) without needing a Workers runtime.
 *
 * Follows the same pattern as mayi-room.presence.ts
 */

import { nanoid } from "nanoid";
import type { RoundNumber } from "../../core/engine/engine.types";
import type {
  AIPlayerInfo,
  AIModelId,
  HumanPlayerInfo,
  LobbyStatePayload,
} from "./protocol.types";
import { AI_MODEL_DISPLAY_NAMES } from "./protocol.types";
import type { StoredPlayer } from "./mayi-room.presence";

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 8;
export const DEFAULT_STARTING_ROUND: RoundNumber = 1;

// ═══════════════════════════════════════════════════════════════════════════
// Lobby State Types
// ═══════════════════════════════════════════════════════════════════════════

/** Internal lobby state stored in the room */
export interface LobbyState {
  aiPlayers: AIPlayerInfo[];
  startingRound: RoundNumber;
}

// ═══════════════════════════════════════════════════════════════════════════
// Pure State Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create initial lobby state
 */
export function createInitialLobbyState(): LobbyState {
  return {
    aiPlayers: [],
    startingRound: DEFAULT_STARTING_ROUND,
  };
}

/**
 * Add an AI player to the lobby
 * Returns new state or null if adding would exceed max players
 */
export function addAIPlayer(
  state: LobbyState,
  humanPlayerCount: number,
  name: string,
  modelId: AIModelId,
  avatarId?: string
): LobbyState | null {
  const totalPlayers = humanPlayerCount + state.aiPlayers.length;

  if (totalPlayers >= MAX_PLAYERS) {
    return null; // Cannot add more players
  }

  const aiPlayer: AIPlayerInfo = {
    playerId: `ai-${nanoid(8)}`,
    name: name.trim(),
    avatarId,
    modelId,
    modelDisplayName: AI_MODEL_DISPLAY_NAMES[modelId],
  };

  return {
    ...state,
    aiPlayers: [...state.aiPlayers, aiPlayer],
  };
}

/**
 * Remove an AI player from the lobby
 * Returns new state or null if player not found
 */
export function removeAIPlayer(
  state: LobbyState,
  playerId: string
): LobbyState | null {
  const index = state.aiPlayers.findIndex((p) => p.playerId === playerId);

  if (index === -1) {
    return null; // Player not found
  }

  return {
    ...state,
    aiPlayers: state.aiPlayers.filter((p) => p.playerId !== playerId),
  };
}

/**
 * Set the starting round
 * Returns new state or null if round is invalid
 */
export function setStartingRound(
  state: LobbyState,
  round: number
): LobbyState | null {
  if (round < 1 || round > 6 || !Number.isInteger(round)) {
    return null; // Invalid round
  }

  return {
    ...state,
    startingRound: round as RoundNumber,
  };
}

/**
 * Check if the game can be started
 */
export function canStartGame(
  humanPlayerCount: number,
  aiPlayerCount: number
): boolean {
  const total = humanPlayerCount + aiPlayerCount;
  return total >= MIN_PLAYERS && total <= MAX_PLAYERS;
}

/**
 * Check whether an avatarId is already used by any human or AI player in the lobby.
 *
 * Note: "taken" includes disconnected humans still present in the lobby snapshot
 * (until they expire), matching the UI behavior.
 */
export function isAvatarIdTaken(
  avatarId: string,
  args: {
    humanPlayers: HumanPlayerInfo[];
    aiPlayers: AIPlayerInfo[];
    excludeHumanPlayerId?: string;
  }
): boolean {
  const normalized = avatarId.trim();
  if (!normalized) return false;

  const takenByHuman = args.humanPlayers.some(
    (p) => p.avatarId === normalized && p.playerId !== args.excludeHumanPlayerId
  );
  const takenByAI = args.aiPlayers.some((p) => p.avatarId === normalized);

  return takenByHuman || takenByAI;
}

/**
 * Get total player count
 */
export function getTotalPlayerCount(
  humanPlayerCount: number,
  aiPlayerCount: number
): number {
  return humanPlayerCount + aiPlayerCount;
}

/**
 * Build the lobby state payload to send to clients
 */
export function buildLobbyStatePayload(
  humanPlayers: HumanPlayerInfo[],
  lobbyState: LobbyState
): LobbyStatePayload {
  const humanCount = humanPlayers.length;
  const aiCount = lobbyState.aiPlayers.length;

  return {
    players: humanPlayers,
    aiPlayers: lobbyState.aiPlayers,
    startingRound: lobbyState.startingRound,
    canStart: canStartGame(humanCount, aiCount),
  };
}

/**
 * Convert StoredPlayer array to HumanPlayerInfo array
 * (Used when building lobby state from storage entries)
 */
export function storedPlayersToHumanPlayerInfo(
  storedPlayers: StoredPlayer[]
): HumanPlayerInfo[] {
  return storedPlayers.map((p) => ({
    playerId: p.playerId,
    name: p.name,
    avatarId: p.avatarId,
    isConnected: p.isConnected,
    disconnectedAt: p.disconnectedAt,
  }));
}

/**
 * Build the ordered player names array for GameEngine.createGame()
 * Human players first (in order of join), then AI players
 */
export function buildPlayerNamesForGame(
  humanPlayers: HumanPlayerInfo[],
  aiPlayers: AIPlayerInfo[]
): string[] {
  const humanNames = humanPlayers.map((p) => p.name);
  const aiNames = aiPlayers.map((p) => p.name);
  return [...humanNames, ...aiNames];
}

/**
 * Build player ID to name mapping for the game
 * Used for looking up names when generating activity log, etc.
 */
export function buildPlayerIdToNameMap(
  humanPlayers: HumanPlayerInfo[],
  aiPlayers: AIPlayerInfo[]
): Map<string, string> {
  const map = new Map<string, string>();

  humanPlayers.forEach((p, index) => {
    // GameEngine assigns IDs as player-0, player-1, etc.
    map.set(`player-${index}`, p.name);
  });

  aiPlayers.forEach((p, index) => {
    // AI players continue the sequence
    map.set(`player-${humanPlayers.length + index}`, p.name);
  });

  return map;
}

/**
 * Get AI player info by engine player ID
 * (Engine uses player-0, player-1, etc. but we need the original AI config)
 */
export function getAIPlayerByEngineId(
  enginePlayerId: string,
  humanPlayerCount: number,
  aiPlayers: AIPlayerInfo[]
): AIPlayerInfo | null {
  // Parse the engine player ID (e.g., "player-3")
  const match = enginePlayerId.match(/^player-(\d+)$/);
  if (!match || !match[1]) return null;

  const index = parseInt(match[1], 10);
  const aiIndex = index - humanPlayerCount;

  if (aiIndex < 0 || aiIndex >= aiPlayers.length) {
    return null; // Not an AI player
  }

  const aiPlayer = aiPlayers[aiIndex];
  return aiPlayer ?? null;
}

/**
 * Check if an engine player ID is an AI player
 */
export function isAIPlayer(
  enginePlayerId: string,
  humanPlayerCount: number,
  aiPlayerCount: number
): boolean {
  const match = enginePlayerId.match(/^player-(\d+)$/);
  if (!match || !match[1]) return false;

  const index = parseInt(match[1], 10);
  return index >= humanPlayerCount && index < humanPlayerCount + aiPlayerCount;
}
