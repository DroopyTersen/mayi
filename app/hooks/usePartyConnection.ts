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
  const pongTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasConnectedRef = useRef(false);
  const lastSocketRef = useRef<PartySocket | null>(null);

  // Update status and notify callback
  const updateStatus = useCallback((status: ConnectionStatus) => {
    setConnectionStatus(status);
    onStatusChange?.(status);
  }, [onStatusChange]);

  const clearPongTimeout = useCallback(() => {
    if (!pongTimeoutRef.current) return;
    clearTimeout(pongTimeoutRef.current);
    pongTimeoutRef.current = null;
  }, []);

  // Stop heartbeat (used on close/error/forced reconnect)
  const stopHeartbeat = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    clearPongTimeout();
  }, [clearPongTimeout]);

  // Force reconnect
  const forceReconnect = useCallback(() => {
    if (!socket) return;
    stopHeartbeat();
    machineRef.current.onReconnecting();
    updateStatus("reconnecting");
    socket.reconnect();
  }, [socket, stopHeartbeat, updateStatus]);

  const armPongTimeout = useCallback(() => {
    if (pongTimeoutRef.current) return;
    pongTimeoutRef.current = setTimeout(() => {
      pongTimeoutRef.current = null;
      // If we're still open but not receiving PONGs, treat it as zombie.
      if (socket?.readyState === WebSocket.OPEN) {
        console.log("[usePartyConnection] PONG timeout - forcing reconnect");
        forceReconnect();
      }
    }, config.pongTimeoutMs);
  }, [config.pongTimeoutMs, forceReconnect, socket]);

  // Send PING message (and arm PONG timeout)
  const sendPing = useCallback(() => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    // If we're already waiting on a PONG, don't send additional pings; the
    // outstanding timeout will force a reconnect if needed.
    if (pongTimeoutRef.current) return;
    socket.send(JSON.stringify({ type: "PING" } as ClientMessage));
    machineRef.current.onPing();
    armPongTimeout();
  }, [armPongTimeout, socket]);

  // Start heartbeat
  const startHeartbeat = useCallback(() => {
    // Clear any existing intervals
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    clearPongTimeout();

    // Send pings at regular intervals
    pingIntervalRef.current = setInterval(() => {
      sendPing();
    }, config.pingIntervalMs);
  }, [clearPongTimeout, config.pingIntervalMs, sendPing]);

  // Handle incoming messages (looking for PONG)
  const handleMessage = useCallback((event: MessageEvent) => {
    if (typeof event.data !== "string") return;

    try {
      const msg = JSON.parse(event.data) as ServerMessage;
      if (msg.type === "PONG") {
        machineRef.current.onPong();
        clearPongTimeout();
      }
    } catch {
      // Ignore parse errors - not our message
    }
  }, [clearPongTimeout]);

  // Main effect: attach listeners to socket
  useEffect(() => {
    // If the PartySocket instance changes (e.g. room changes), treat it as a
    // fresh connection rather than a reconnect of the previous socket.
    if (socket !== lastSocketRef.current) {
      lastSocketRef.current = socket;
      machineRef.current = createConnectionStateMachine();
      wasConnectedRef.current = false;
      stopHeartbeat();
    }

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

      // Send initial ping immediately to establish baseline and start PONG timer
      sendPing();
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

  // Proactive liveness checks to reduce "stale but looks connected" windows,
  // especially when returning from background or after network transitions.
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const maybeProbe = () => {
      if (!socket) return;
      if (socket.readyState === WebSocket.OPEN) {
        sendPing();
        return;
      }
      if (connectionStatus === "disconnected") {
        forceReconnect();
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        maybeProbe();
      }
    };

    window.addEventListener("focus", maybeProbe);
    window.addEventListener("online", maybeProbe);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("focus", maybeProbe);
      window.removeEventListener("online", maybeProbe);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [connectionStatus, forceReconnect, sendPing, socket]);

  return {
    connectionStatus,
    sendPing,
    forceReconnect,
  };
}
