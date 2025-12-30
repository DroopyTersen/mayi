/**
 * Types for Lobby UI components.
 * These match the wire protocol from specs/web-app-phase-02.plan.md
 */

/** Connection status for the WebSocket */
export type ConnectionStatus = "connecting" | "connected" | "disconnected";

/** Join status for the player */
export type JoinStatus = "unjoined" | "joining" | "joined";

/** Player info as sent from server */
export interface PlayerInfo {
  playerId: string;
  name: string;
  isConnected: boolean;
  disconnectedAt: number | null; // timestamp for "disconnected Xm ago"
}

/** Props for lobby view state */
export interface LobbyState {
  connectionStatus: ConnectionStatus;
  joinStatus: JoinStatus;
  players: PlayerInfo[];
  currentPlayerId: string | null;
  roomId: string;
}
