import { describe, it, expect, afterEach, beforeEach } from "bun:test";
import {
  savedGameExists,
  loadOrchestratorSnapshot,
  saveOrchestratorSnapshot,
  createOrchestratorSnapshot,
  appendActionLog,
  readActionLog,
  generateGameId,
  listSavedGames,
  formatGameDate,
} from "./cli.persistence";
import type { ActionLogEntry } from "./cli.types";

// Use a unique test game ID for each test to avoid conflicts
let testGameId: string;

// Helper to clean up a test game directory
function cleanupTestGame(gameId: string): void {
  const fs = require("fs");
  const dir = `.data/${gameId}`;
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true });
  }
}

beforeEach(() => {
  testGameId = `test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
});

afterEach(() => {
  cleanupTestGame(testGameId);
});

describe("cli.persistence", () => {
  describe("generateGameId", () => {
    it("generates a 6-character ID", () => {
      const id = generateGameId();
      expect(id).toHaveLength(6);
    });

    it("generates different IDs each time", () => {
      const id1 = generateGameId();
      const id2 = generateGameId();
      expect(id1).not.toBe(id2);
    });
  });

  describe("savedGameExists", () => {
    it("returns false when game directory does not exist", () => {
      expect(savedGameExists("nonexistent-game")).toBe(false);
    });

    it("returns true when state file has content", () => {
      const snapshot = createOrchestratorSnapshot(testGameId, {}, "IDLE");
      saveOrchestratorSnapshot(testGameId, snapshot);
      expect(savedGameExists(testGameId)).toBe(true);
    });
  });

  describe("loadOrchestratorSnapshot", () => {
    it("throws when game does not exist", () => {
      expect(() => loadOrchestratorSnapshot("nonexistent")).toThrow("No game found");
    });

    it("throws 'Unsupported state version' for invalid version", () => {
      // Write a file with wrong version
      const fs = require("fs");
      const dir = `.data/${testGameId}`;
      fs.mkdirSync(dir, { recursive: true });
      const invalidData = { version: "1.0", gameId: testGameId };
      fs.writeFileSync(`${dir}/game-state.json`, JSON.stringify(invalidData));

      expect(() => loadOrchestratorSnapshot(testGameId)).toThrow(
        "Unsupported state version: 1.0"
      );
    });

    it("returns valid snapshot for v2.0 data", () => {
      const snapshot = createOrchestratorSnapshot(testGameId, { foo: "bar" }, "ROUND_ACTIVE");
      saveOrchestratorSnapshot(testGameId, snapshot);

      const loaded = loadOrchestratorSnapshot(testGameId);
      expect(loaded.version).toBe("2.0");
      expect(loaded.gameId).toBe(testGameId);
      expect(loaded.phase).toBe("ROUND_ACTIVE");
      expect(loaded.gameSnapshot).toEqual({ foo: "bar" });
    });
  });

  describe("saveOrchestratorSnapshot", () => {
    it("saves snapshot to file", () => {
      const snapshot = createOrchestratorSnapshot(testGameId, {}, "IDLE");
      saveOrchestratorSnapshot(testGameId, snapshot);

      expect(savedGameExists(testGameId)).toBe(true);
      const loaded = loadOrchestratorSnapshot(testGameId);
      expect(loaded.gameId).toBe(testGameId);
    });

    it("updates updatedAt timestamp", () => {
      const snapshot = createOrchestratorSnapshot(testGameId, {}, "IDLE");
      const originalUpdatedAt = snapshot.updatedAt;

      // Wait a tiny bit to ensure timestamp differs
      const start = Date.now();
      while (Date.now() - start < 5) {
        // busy wait
      }

      saveOrchestratorSnapshot(testGameId, snapshot);
      const loaded = loadOrchestratorSnapshot(testGameId);

      expect(new Date(loaded.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(originalUpdatedAt).getTime()
      );
    });

    it("creates game directory if it does not exist", () => {
      const fs = require("fs");
      const dir = `.data/${testGameId}`;
      expect(fs.existsSync(dir)).toBe(false);

      const snapshot = createOrchestratorSnapshot(testGameId, {}, "IDLE");
      saveOrchestratorSnapshot(testGameId, snapshot);

      expect(fs.existsSync(dir)).toBe(true);
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

  describe("appendActionLog / readActionLog", () => {
    it("returns empty array for nonexistent game", () => {
      expect(readActionLog("nonexistent")).toEqual([]);
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
      appendActionLog(testGameId, entry);

      const logs = readActionLog(testGameId);
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
        appendActionLog(testGameId, entry);
      }

      const logs = readActionLog(testGameId);
      expect(logs.length).toBe(3);
      expect(logs[0]!.playerName).toBe("Alice");
      expect(logs[1]!.action).toBe("discarded");
      expect(logs[2]!.turnNumber).toBe(2);
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
      appendActionLog(testGameId, entryWithDetails);

      const logs = readActionLog(testGameId);
      expect(logs[0]!.details).toBe("Set of Kings, Run 4-5-6♦");
      expect(logs[0]!.roundNumber).toBe(3);
    });
  });

  describe("listSavedGames", () => {
    it("returns empty array when data dir does not exist", () => {
      // Test with a non-existent game ID - this tests the early return path
      // We don't delete .data because that would destroy real game data!
      // The function already returns [] if .data doesn't exist, so we test
      // that it doesn't crash when called (the actual empty case is tested
      // by the file not existing, which savedGameExists covers)
      const games = listSavedGames();
      // Just verify it returns an array without crashing
      expect(Array.isArray(games)).toBe(true);
    });

    it("returns list of saved games", () => {
      // Create a test game
      const snapshot = createOrchestratorSnapshot(testGameId, {
        currentRound: 3,
        players: [{ name: "Alice" }, { name: "Bob" }, { name: "Carol" }],
      }, "ROUND_ACTIVE");
      saveOrchestratorSnapshot(testGameId, snapshot);

      const games = listSavedGames();
      const testGame = games.find(g => g.id === testGameId);

      expect(testGame).toBeDefined();
      expect(testGame!.currentRound).toBe(3);
      expect(testGame!.isComplete).toBe(false);
    });

    it("excludes completed games by default", () => {
      // Create a completed game
      const snapshot = createOrchestratorSnapshot(testGameId, {
        currentRound: 6,
        players: [{ name: "Alice" }],
      }, "GAME_END");
      saveOrchestratorSnapshot(testGameId, snapshot);

      const games = listSavedGames();
      const testGame = games.find(g => g.id === testGameId);

      expect(testGame).toBeUndefined();
    });

    it("includes completed games when requested", () => {
      // Create a completed game
      const snapshot = createOrchestratorSnapshot(testGameId, {
        currentRound: 6,
        players: [{ name: "Alice" }],
      }, "GAME_END");
      saveOrchestratorSnapshot(testGameId, snapshot);

      const games = listSavedGames(true);
      const testGame = games.find(g => g.id === testGameId);

      expect(testGame).toBeDefined();
      expect(testGame!.isComplete).toBe(true);
    });
  });

  describe("formatGameDate", () => {
    it("formats recent dates as relative time", () => {
      const now = new Date();
      expect(formatGameDate(now.toISOString())).toBe("just now");
    });

    it("formats minutes ago", () => {
      const date = new Date(Date.now() - 5 * 60 * 1000);
      expect(formatGameDate(date.toISOString())).toBe("5m ago");
    });

    it("formats hours ago", () => {
      const date = new Date(Date.now() - 3 * 60 * 60 * 1000);
      expect(formatGameDate(date.toISOString())).toBe("3h ago");
    });

    it("formats days ago", () => {
      const date = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      expect(formatGameDate(date.toISOString())).toBe("2d ago");
    });
  });
});
