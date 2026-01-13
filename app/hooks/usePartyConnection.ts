/**
 * usePartyConnection hook
 *
 * Manages WebSocket connection with:
 * - Connection status tracking (connecting, connected, disconnected, reconnecting)
 * - Heartbeat mechanism (PING/PONG) to detect zombie connections
 * - Automatic state resync on reconnect
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type PartySocket from "partysocket";
import type { ConnectionStatus } from "~/ui/lobby/lobby.types";
import type { ServerMessage, ClientMessage } from "~/party/protocol.types";
import {
  createConnectionStateMachine,
  DEFAULT_HEARTBEAT_CONFIG,
  type ConnectionStateMachine,
  type HeartbeatConfig,
} from "./usePartyConnection.logic";

export interface UsePartyConnectionOptions {
  /** The PartySocket instance to manage */
  socket: PartySocket | null;

  /** Heartbeat configuration (optional, uses defaults if not provided) */
  heartbeatConfig?: Partial<HeartbeatConfig>;

  /** Callback when connection state changes */
  onStatusChange?: (status: ConnectionStatus) => void;

  /** Callback when reconnection succeeds (should trigger state resync) */
  onReconnect?: () => void;
}

export interface UsePartyConnectionResult {
  /** Current connection status */
  connectionStatus: ConnectionStatus;

  /** Send a PING message manually (for testing) */
  sendPing: () => void;

  /** Force a reconnect attempt */
  forceReconnect: () => void;
}

export function usePartyConnection(options: UsePartyConnectionOptions): UsePartyConnectionResult {
  const { socket, heartbeatConfig: customConfig, onStatusChange, onReconnect } = options;

  const config: HeartbeatConfig = {
    ...DEFAULT_HEARTBEAT_CONFIG,
    ...customConfig,
  };

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const machineRef = useRef<ConnectionStateMachine>(createConnectionStateMachine());
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wasConnectedRef = useRef(false);

  // Update status and notify callback
  const updateStatus = useCallback((status: ConnectionStatus) => {
    setConnectionStatus(status);
    onStatusChange?.(status);
  }, [onStatusChange]);

  // Send PING message
  const sendPing = useCallback(() => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "PING" } as ClientMessage));
  }, [socket]);

  // Force reconnect
  const forceReconnect = useCallback(() => {
    if (!socket) return;
    machineRef.current.onReconnecting();
    updateStatus("reconnecting");
    socket.reconnect();
  }, [socket, updateStatus]);

  // Start heartbeat
  const startHeartbeat = useCallback(() => {
    // Clear any existing intervals
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    if (heartbeatCheckRef.current) {
      clearInterval(heartbeatCheckRef.current);
    }

    // Send pings at regular intervals
    pingIntervalRef.current = setInterval(() => {
      sendPing();
    }, config.pingIntervalMs);

    // Check for heartbeat timeout (zombie connection detection)
    heartbeatCheckRef.current = setInterval(() => {
      if (machineRef.current.isHeartbeatTimedOut(config.pongTimeoutMs)) {
        console.log("[usePartyConnection] Heartbeat timeout - forcing reconnect");
        forceReconnect();
      }
    }, config.pingIntervalMs / 2); // Check twice per ping interval
  }, [config.pingIntervalMs, config.pongTimeoutMs, sendPing, forceReconnect]);

  // Stop heartbeat
  const stopHeartbeat = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (heartbeatCheckRef.current) {
      clearInterval(heartbeatCheckRef.current);
      heartbeatCheckRef.current = null;
    }
  }, []);

  // Handle incoming messages (looking for PONG)
  const handleMessage = useCallback((event: MessageEvent) => {
    if (typeof event.data !== "string") return;

    try {
      const msg = JSON.parse(event.data) as ServerMessage;
      if (msg.type === "PONG") {
        machineRef.current.onPong();
      }
    } catch {
      // Ignore parse errors - not our message
    }
  }, []);

  // Main effect: attach listeners to socket
  useEffect(() => {
    if (!socket) {
      // No socket yet, stay in connecting state
      updateStatus("connecting");
      return;
    }

    const handleOpen = () => {
      machineRef.current.onOpen();
      updateStatus("connected");

      // If we were previously connected, this is a reconnect
      if (wasConnectedRef.current) {
        console.log("[usePartyConnection] Reconnected - triggering state resync");
        onReconnect?.();
      }
      wasConnectedRef.current = true;

      // Start heartbeat on connection
      startHeartbeat();

      // Send initial ping to get baseline
      setTimeout(sendPing, 100);
    };

    const handleClose = () => {
      machineRef.current.onClose();
      updateStatus("disconnected");
      stopHeartbeat();

      // PartySocket handles reconnection automatically, but we track the state
      setTimeout(() => {
        if (socket.readyState === WebSocket.CONNECTING) {
          machineRef.current.onReconnecting();
          updateStatus("reconnecting");
        }
      }, config.reconnectDelayMs);
    };

    const handleError = () => {
      // Treat errors like disconnect from UI perspective
      machineRef.current.onClose();
      updateStatus("disconnected");
      stopHeartbeat();
    };

    // Attach listeners
    socket.addEventListener("open", handleOpen);
    socket.addEventListener("close", handleClose);
    socket.addEventListener("error", handleError);
    socket.addEventListener("message", handleMessage);

    // Check current state in case socket is already open
    if (socket.readyState === WebSocket.OPEN) {
      handleOpen();
    } else if (socket.readyState === WebSocket.CONNECTING) {
      updateStatus("connecting");
    } else if (socket.readyState === WebSocket.CLOSED) {
      updateStatus("disconnected");
    }

    return () => {
      socket.removeEventListener("open", handleOpen);
      socket.removeEventListener("close", handleClose);
      socket.removeEventListener("error", handleError);
      socket.removeEventListener("message", handleMessage);
      stopHeartbeat();
    };
  }, [socket, updateStatus, onReconnect, startHeartbeat, stopHeartbeat, sendPing, handleMessage, config.reconnectDelayMs]);

  return {
    connectionStatus,
    sendPing,
    forceReconnect,
  };
}
