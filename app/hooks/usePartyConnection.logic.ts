/**
 * Connection state machine logic for usePartyConnection hook
 *
 * This module contains the pure logic for managing connection state,
 * separated from React hooks for easier testing.
 */

import type { ConnectionStatus } from "~/ui/lobby/lobby.types";

/** Full connection state */
export interface ConnectionState {
  /** Current connection status */
  status: ConnectionStatus;
  /** Timestamp when connection was established */
  connectedAt: number | null;
  /** Timestamp when disconnection occurred */
  disconnectedAt: number | null;
  /** Timestamp of last successful PONG received */
  lastPongAt: number | null;
  /** Number of reconnection attempts since last successful connection */
  reconnectAttempts: number;
}

/** Configuration for heartbeat behavior */
export interface HeartbeatConfig {
  /** How often to send PING messages (ms) */
  pingIntervalMs: number;
  /** How long to wait for PONG before considering connection dead (ms) */
  pongTimeoutMs: number;
  /** How long to wait before attempting reconnect (ms) */
  reconnectDelayMs: number;
}

/** Default heartbeat configuration */
export const DEFAULT_HEARTBEAT_CONFIG: HeartbeatConfig = {
  pingIntervalMs: 30000,    // 30 seconds between pings
  pongTimeoutMs: 45000,     // 45 seconds to receive pong (1.5x ping interval)
  reconnectDelayMs: 2000,   // 2 seconds before reconnect attempt
};

/** Connection state machine for managing WebSocket connection health */
export interface ConnectionStateMachine {
  /** Get current state */
  getState(): ConnectionState;

  /** Called when WebSocket connection opens */
  onOpen(): void;

  /** Called when WebSocket connection closes */
  onClose(): void;

  /** Called when starting a reconnection attempt */
  onReconnecting(): void;

  /** Called when PONG message is received */
  onPong(): void;

  /** Check if heartbeat has timed out (zombie connection) */
  isHeartbeatTimedOut(timeoutMs: number): boolean;

  /** Set lastPongAt manually (for testing) */
  setLastPongAt(timestamp: number): void;
}

/** Create a new connection state machine */
export function createConnectionStateMachine(): ConnectionStateMachine {
  let state: ConnectionState = {
    status: "connecting",
    connectedAt: null,
    disconnectedAt: null,
    lastPongAt: null,
    reconnectAttempts: 0,
  };

  return {
    getState() {
      return { ...state };
    },

    onOpen() {
      state = {
        ...state,
        status: "connected",
        connectedAt: Date.now(),
        disconnectedAt: null,
      };
    },

    onClose() {
      state = {
        ...state,
        status: "disconnected",
        disconnectedAt: Date.now(),
      };
    },

    onReconnecting() {
      state = {
        ...state,
        status: "reconnecting",
        reconnectAttempts: state.reconnectAttempts + 1,
      };
    },

    onPong() {
      state = {
        ...state,
        lastPongAt: Date.now(),
        reconnectAttempts: 0, // Reset on successful heartbeat
      };
    },

    isHeartbeatTimedOut(timeoutMs: number) {
      // If we've never received a PONG, don't consider it timed out
      // (the connection may still be establishing)
      if (state.lastPongAt === null) {
        return false;
      }

      const elapsed = Date.now() - state.lastPongAt;
      return elapsed > timeoutMs;
    },

    setLastPongAt(timestamp: number) {
      state = {
        ...state,
        lastPongAt: timestamp,
      };
    },
  };
}
