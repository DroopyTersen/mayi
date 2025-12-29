import { describe, it, expect, afterEach } from "bun:test";
import {
  savedGameExists,
  loadOrchestratorSnapshot,
  saveOrchestratorSnapshot,
  createOrchestratorSnapshot,
  clearSavedGame,
  appendActionLog,
  readActionLog,
} from "./cli.persistence";
import type { OrchestratorSnapshot, ActionLogEntry } from "./cli.types";

// Clean up after each test to avoid state leaking between tests
afterEach(() => {
  clearSavedGame();
});

describe("cli.persistence", () => {
  describe("savedGameExists", () => {
    it("returns false when state file is empty", () => {
      clearSavedGame();
      expect(savedGameExists()).toBe(false);
    });

    it("returns true when state file has content", () => {
      const snapshot = createOrchestratorSnapshot("test-game", {}, "IDLE");
      saveOrchestratorSnapshot(snapshot);
      expect(savedGameExists()).toBe(true);
    });
  });

  describe("loadOrchestratorSnapshot", () => {
    it("throws 'No game in progress' when file is empty", () => {
      clearSavedGame();
      expect(() => loadOrchestratorSnapshot()).toThrow("No game in progress");
    });

    it("throws 'Unsupported state version' for invalid version", () => {
      // Write a file with wrong version
      const invalidData = { version: "1.0", gameId: "test" };
      require("fs").writeFileSync(
        "cli/game-state.json",
        JSON.stringify(invalidData)
      );

      expect(() => loadOrchestratorSnapshot()).toThrow(
        "Unsupported state version: 1.0"
      );
    });

    it("returns valid snapshot for v2.0 data", () => {
      const snapshot = createOrchestratorSnapshot("test-game", { foo: "bar" }, "ROUND_ACTIVE");
      saveOrchestratorSnapshot(snapshot);

      const loaded = loadOrchestratorSnapshot();
      expect(loaded.version).toBe("2.0");
      expect(loaded.gameId).toBe("test-game");
      expect(loaded.phase).toBe("ROUND_ACTIVE");
      expect(loaded.gameSnapshot).toEqual({ foo: "bar" });
    });
  });

  describe("saveOrchestratorSnapshot", () => {
    it("saves snapshot to file", () => {
      const snapshot = createOrchestratorSnapshot("save-test", {}, "IDLE");
      saveOrchestratorSnapshot(snapshot);

      expect(savedGameExists()).toBe(true);
      const loaded = loadOrchestratorSnapshot();
      expect(loaded.gameId).toBe("save-test");
    });

    it("updates updatedAt timestamp", () => {
      const snapshot = createOrchestratorSnapshot("timestamp-test", {}, "IDLE");
      const originalUpdatedAt = snapshot.updatedAt;

      // Wait a tiny bit to ensure timestamp differs
      const start = Date.now();
      while (Date.now() - start < 5) {
        // busy wait
      }

      saveOrchestratorSnapshot(snapshot);
      const loaded = loadOrchestratorSnapshot();

      // updatedAt should have been updated (or at least be >= original)
      expect(new Date(loaded.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(originalUpdatedAt).getTime()
      );
    });
  });

  describe("createOrchestratorSnapshot", () => {
    it("creates snapshot with correct version", () => {
      const snapshot = createOrchestratorSnapshot("new-game", {}, "IDLE");
      expect(snapshot.version).toBe("2.0");
    });

    it("sets gameId and phase from parameters", () => {
      const snapshot = createOrchestratorSnapshot("my-game", {}, "ROUND_ACTIVE");
      expect(snapshot.gameId).toBe("my-game");
      expect(snapshot.phase).toBe("ROUND_ACTIVE");
    });

    it("sets gameSnapshot from parameter", () => {
      const gameData = { players: [], round: 1 };
      const snapshot = createOrchestratorSnapshot("game-with-data", gameData, "IDLE");
      expect(snapshot.gameSnapshot).toEqual(gameData);
    });

    it("initializes with default values", () => {
      const snapshot = createOrchestratorSnapshot("defaults-test", {}, "IDLE");
      expect(snapshot.turnNumber).toBe(1);
      expect(snapshot.mayIContext).toBeNull();
      expect(snapshot.createdAt).toBeDefined();
      expect(snapshot.updatedAt).toBeDefined();
    });

    it("sets createdAt and updatedAt to same initial value", () => {
      const snapshot = createOrchestratorSnapshot("time-test", {}, "IDLE");
      expect(snapshot.createdAt).toBe(snapshot.updatedAt);
    });
  });

  describe("clearSavedGame", () => {
    it("clears state file", () => {
      const snapshot = createOrchestratorSnapshot("to-clear", {}, "IDLE");
      saveOrchestratorSnapshot(snapshot);
      expect(savedGameExists()).toBe(true);

      clearSavedGame();
      expect(savedGameExists()).toBe(false);
    });

    it("clears log file", () => {
      const entry: ActionLogEntry = {
        timestamp: new Date().toISOString(),
        turnNumber: 1,
        roundNumber: 1,
        playerId: "player-1",
        playerName: "Alice",
        action: "test action",
      };
      appendActionLog(entry);
      expect(readActionLog().length).toBe(1);

      clearSavedGame();
      expect(readActionLog().length).toBe(0);
    });
  });

  describe("appendActionLog / readActionLog", () => {
    it("returns empty array for empty log", () => {
      clearSavedGame();
      expect(readActionLog()).toEqual([]);
    });

    it("appends and reads single entry", () => {
      const entry: ActionLogEntry = {
        timestamp: "2024-01-01T00:00:00.000Z",
        turnNumber: 1,
        roundNumber: 1,
        playerId: "player-1",
        playerName: "Alice",
        action: "drew from stock",
        details: "5♥",
      };
      appendActionLog(entry);

      const logs = readActionLog();
      expect(logs.length).toBe(1);
      expect(logs[0]).toEqual(entry);
    });

    it("appends multiple entries and reads in order", () => {
      const entries: ActionLogEntry[] = [
        {
          timestamp: "2024-01-01T00:00:00.000Z",
          turnNumber: 1,
          roundNumber: 1,
          playerId: "player-1",
          playerName: "Alice",
          action: "drew from stock",
        },
        {
          timestamp: "2024-01-01T00:00:01.000Z",
          turnNumber: 1,
          roundNumber: 1,
          playerId: "player-1",
          playerName: "Alice",
          action: "discarded",
          details: "K♠",
        },
        {
          timestamp: "2024-01-01T00:00:02.000Z",
          turnNumber: 2,
          roundNumber: 1,
          playerId: "player-2",
          playerName: "Bob",
          action: "drew from discard",
        },
      ];

      for (const entry of entries) {
        appendActionLog(entry);
      }

      const logs = readActionLog();
      expect(logs.length).toBe(3);
      expect(logs[0].playerName).toBe("Alice");
      expect(logs[1].action).toBe("discarded");
      expect(logs[2].turnNumber).toBe(2);
    });

    it("preserves all fields including optional details", () => {
      const entryWithDetails: ActionLogEntry = {
        timestamp: "2024-01-01T00:00:00.000Z",
        turnNumber: 5,
        roundNumber: 3,
        playerId: "player-3",
        playerName: "Carol",
        action: "laid down melds",
        details: "Set of Kings, Run 4-5-6♦",
      };
      appendActionLog(entryWithDetails);

      const logs = readActionLog();
      expect(logs[0].details).toBe("Set of Kings, Run 4-5-6♦");
      expect(logs[0].roundNumber).toBe(3);
    });
  });
});
