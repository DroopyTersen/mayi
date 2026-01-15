/**
 * Types for Lobby UI components.
 * These match the wire protocol from specs/web-app-phase-02.plan.md and phase-03
 */

import type { RoundNumber } from "../../../core/engine/engine.types";
import type { AIPlayerInfo, AIModelId } from "~/party/protocol.types";

/** Connection status for the WebSocket */
export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "reconnecting";

/** Join status for the player */
export type JoinStatus = "unjoined" | "joining" | "joined";

/** Player info as sent from server */
export interface PlayerInfo {
  playerId: string;
  name: string;
  avatarId?: string;
  isConnected: boolean;
  disconnectedAt: number | null; // timestamp for "disconnected Xm ago"
}

/** Phase 3: Extended lobby state with AI players and game settings */
export interface LobbyGameSettings {
  aiPlayers: AIPlayerInfo[];
  startingRound: RoundNumber;
  canStart: boolean;
}

/** Props for lobby view state */
export interface LobbyState {
  connectionStatus: ConnectionStatus;
  joinStatus: JoinStatus;
  players: PlayerInfo[];
  currentPlayerId: string | null;
  roomId: string;
}

/** Re-export types for convenience */
export type { AIPlayerInfo, AIModelId, RoundNumber };
