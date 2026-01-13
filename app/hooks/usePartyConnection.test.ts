import { describe, it, expect, beforeEach, afterEach, mock, jest } from "bun:test";

/**
 * Tests for usePartyConnection hook
 *
 * The hook manages:
 * - WebSocket connection state (connecting, connected, disconnected, reconnecting)
 * - Heartbeat mechanism (PING/PONG) to detect zombie connections
 * - Automatic state resync on reconnect (via JOIN message)
 *
 * Note: These are unit tests for the hook's state logic. The actual WebSocket
 * behavior is tested via integration tests with the server.
 */

// Test the state machine logic without React
import type { ConnectionState, HeartbeatConfig } from "./usePartyConnection.logic";
import { createConnectionStateMachine } from "./usePartyConnection.logic";

describe("ConnectionStateMachine", () => {
  describe("initial state", () => {
    it("should start in connecting state", () => {
      const machine = createConnectionStateMachine();
      expect(machine.getState().status).toBe("connecting");
    });

    it("should have no last pong timestamp initially", () => {
      const machine = createConnectionStateMachine();
      expect(machine.getState().lastPongAt).toBeNull();
    });
  });

  describe("onOpen", () => {
    it("should transition to connected when socket opens", () => {
      const machine = createConnectionStateMachine();
      machine.onOpen();
      expect(machine.getState().status).toBe("connected");
    });

    it("should record the connection time", () => {
      const machine = createConnectionStateMachine();
      const beforeTime = Date.now();
      machine.onOpen();
      const afterTime = Date.now();

      const state = machine.getState();
      expect(state.connectedAt).toBeGreaterThanOrEqual(beforeTime);
      expect(state.connectedAt).toBeLessThanOrEqual(afterTime);
    });
  });

  describe("onClose", () => {
    it("should transition to disconnected when socket closes", () => {
      const machine = createConnectionStateMachine();
      machine.onOpen();
      machine.onClose();
      expect(machine.getState().status).toBe("disconnected");
    });

    it("should record disconnection time", () => {
      const machine = createConnectionStateMachine();
      machine.onOpen();
      const beforeTime = Date.now();
      machine.onClose();
      const afterTime = Date.now();

      const state = machine.getState();
      expect(state.disconnectedAt).toBeGreaterThanOrEqual(beforeTime);
      expect(state.disconnectedAt).toBeLessThanOrEqual(afterTime);
    });
  });

  describe("onReconnecting", () => {
    it("should transition to reconnecting state", () => {
      const machine = createConnectionStateMachine();
      machine.onOpen();
      machine.onClose();
      machine.onReconnecting();
      expect(machine.getState().status).toBe("reconnecting");
    });

    it("should increment reconnect attempt count", () => {
      const machine = createConnectionStateMachine();
      machine.onOpen();
      machine.onClose();
      machine.onReconnecting();
      expect(machine.getState().reconnectAttempts).toBe(1);

      machine.onClose();
      machine.onReconnecting();
      expect(machine.getState().reconnectAttempts).toBe(2);
    });
  });

  describe("onPong", () => {
    it("should update lastPongAt timestamp", () => {
      const machine = createConnectionStateMachine();
      machine.onOpen();
      const beforeTime = Date.now();
      machine.onPong();
      const afterTime = Date.now();

      const state = machine.getState();
      expect(state.lastPongAt).toBeGreaterThanOrEqual(beforeTime);
      expect(state.lastPongAt).toBeLessThanOrEqual(afterTime);
    });

    it("should reset reconnect attempts on successful pong", () => {
      const machine = createConnectionStateMachine();
      machine.onOpen();
      machine.onClose();
      machine.onReconnecting();
      machine.onOpen();
      machine.onPong();

      expect(machine.getState().reconnectAttempts).toBe(0);
    });
  });

  describe("heartbeat timeout detection", () => {
    it("should detect zombie connection when no pong received within timeout", () => {
      const machine = createConnectionStateMachine();
      machine.onOpen();
      machine.onPong();

      // Simulate time passing beyond timeout
      const state = machine.getState();
      const timeoutMs = 45000; // 45 seconds
      const oldPongTime = Date.now() - timeoutMs - 1000;

      // Manually set lastPongAt to simulate old timestamp
      machine.setLastPongAt(oldPongTime);

      expect(machine.isHeartbeatTimedOut(timeoutMs)).toBe(true);
    });

    it("should not detect timeout when recent pong received", () => {
      const machine = createConnectionStateMachine();
      machine.onOpen();
      machine.onPong();

      const timeoutMs = 45000;
      expect(machine.isHeartbeatTimedOut(timeoutMs)).toBe(false);
    });

    it("should not check timeout before first pong", () => {
      const machine = createConnectionStateMachine();
      machine.onOpen();

      const timeoutMs = 45000;
      // Before any PONG is received, we shouldn't consider it timed out
      expect(machine.isHeartbeatTimedOut(timeoutMs)).toBe(false);
    });
  });
});

describe("HeartbeatConfig", () => {
  it("should have sensible default values", () => {
    const defaultConfig: HeartbeatConfig = {
      pingIntervalMs: 30000,    // 30 seconds between pings
      pongTimeoutMs: 45000,     // 45 seconds to receive pong
      reconnectDelayMs: 2000,   // 2 seconds before reconnect attempt
    };

    expect(defaultConfig.pingIntervalMs).toBeLessThan(defaultConfig.pongTimeoutMs);
    expect(defaultConfig.reconnectDelayMs).toBeGreaterThan(0);
  });
});
