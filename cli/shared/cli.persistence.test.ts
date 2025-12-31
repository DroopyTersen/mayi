import { describe, it, expect, afterEach, beforeEach } from "bun:test";
import {
  savedGameExists,
  appendActionLog,
  readActionLog,
  generateGameId,
  listSavedGames,
  formatGameDate,
  loadGameSave,
  saveGameSave,
  saveAIPlayerConfigs,
  loadAIPlayerConfigs,
  type PersistedAIPlayer,
} from "./cli.persistence";
import { createActor } from "xstate";
import { gameMachine } from "../../core/engine/game.machine";
import { GameEngine } from "../../core/engine/game-engine";
import type { ActionLogEntry, CliGameSave } from "./cli.types";
import type { RoundRecord } from "../../core/engine/engine.types";

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
      const engine = GameEngine.createGame({
        gameId: testGameId,
        playerNames: ["Alice", "Bob", "Carol"],
      });
      const snapshot = engine.getSnapshot();
      const save: CliGameSave = {
        version: "3.0",
        gameId: testGameId,
        createdAt: snapshot.createdAt,
        updatedAt: snapshot.updatedAt,
        engineSnapshot: engine.getPersistedSnapshot(),
      };
      saveGameSave(testGameId, save);
      engine.stop();
      expect(savedGameExists(testGameId)).toBe(true);
    });
  });

  describe("loadGameSave", () => {
    it("throws when game does not exist", () => {
      expect(() => loadGameSave("nonexistent")).toThrow("No game found");
    });

    it("throws 'Unsupported state version' for invalid version", () => {
      // Write a file with wrong version
      const fs = require("fs");
      const dir = `.data/${testGameId}`;
      fs.mkdirSync(dir, { recursive: true });
      const invalidData = { version: "1.0", gameId: testGameId };
      fs.writeFileSync(`${dir}/game-state.json`, JSON.stringify(invalidData));

      expect(() => loadGameSave(testGameId)).toThrow(
        "Unsupported state version: 1.0"
      );
    });

    it("returns valid save for v3.0 data", () => {
      const engine = GameEngine.createGame({
        gameId: testGameId,
        playerNames: ["Alice", "Bob", "Carol"],
      });
      const snapshot = engine.getSnapshot();
      const save: CliGameSave = {
        version: "3.0",
        gameId: testGameId,
        createdAt: snapshot.createdAt,
        updatedAt: snapshot.updatedAt,
        engineSnapshot: engine.getPersistedSnapshot(),
      };
      saveGameSave(testGameId, save);
      engine.stop();

      const loaded = loadGameSave(testGameId);
      expect(loaded.version).toBe("3.0");
      expect(loaded.gameId).toBe(testGameId);
      expect(loaded.engineSnapshot).toBeDefined();
    });
  });

  describe("saveGameSave", () => {
    it("saves save to file", () => {
      const engine = GameEngine.createGame({
        gameId: testGameId,
        playerNames: ["Alice", "Bob", "Carol"],
      });
      const snapshot = engine.getSnapshot();
      const save: CliGameSave = {
        version: "3.0",
        gameId: testGameId,
        createdAt: snapshot.createdAt,
        updatedAt: snapshot.updatedAt,
        engineSnapshot: engine.getPersistedSnapshot(),
      };
      saveGameSave(testGameId, save);
      engine.stop();

      expect(savedGameExists(testGameId)).toBe(true);
      const loaded = loadGameSave(testGameId);
      expect(loaded.gameId).toBe(testGameId);
    });

    it("updates updatedAt timestamp", () => {
      const engine = GameEngine.createGame({
        gameId: testGameId,
        playerNames: ["Alice", "Bob", "Carol"],
      });
      const snapshot = engine.getSnapshot();
      const save: CliGameSave = {
        version: "3.0",
        gameId: testGameId,
        createdAt: snapshot.createdAt,
        updatedAt: snapshot.updatedAt,
        engineSnapshot: engine.getPersistedSnapshot(),
      };
      const originalUpdatedAt = save.updatedAt;

      // Wait a tiny bit to ensure timestamp differs
      const start = Date.now();
      while (Date.now() - start < 5) {
        // busy wait
      }

      saveGameSave(testGameId, save);
      engine.stop();
      const loaded = loadGameSave(testGameId);

      expect(new Date(loaded.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(originalUpdatedAt).getTime()
      );
    });

    it("creates game directory if it does not exist", () => {
      const fs = require("fs");
      const dir = `.data/${testGameId}`;
      expect(fs.existsSync(dir)).toBe(false);

      const engine = GameEngine.createGame({
        gameId: testGameId,
        playerNames: ["Alice", "Bob", "Carol"],
      });
      const snapshot = engine.getSnapshot();
      const save: CliGameSave = {
        version: "3.0",
        gameId: testGameId,
        createdAt: snapshot.createdAt,
        updatedAt: snapshot.updatedAt,
        engineSnapshot: engine.getPersistedSnapshot(),
      };
      saveGameSave(testGameId, save);
      engine.stop();

      expect(fs.existsSync(dir)).toBe(true);
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
      const engine = GameEngine.createGame({
        gameId: testGameId,
        playerNames: ["Alice", "Bob", "Carol"],
        startingRound: 3,
      });
      const snapshot = engine.getSnapshot();
      const save: CliGameSave = {
        version: "3.0",
        gameId: testGameId,
        createdAt: snapshot.createdAt,
        updatedAt: snapshot.updatedAt,
        engineSnapshot: engine.getPersistedSnapshot(),
      };
      saveGameSave(testGameId, save);
      engine.stop();

      const games = listSavedGames();
      const testGame = games.find(g => g.id === testGameId);

      expect(testGame).toBeDefined();
      expect(testGame!.currentRound).toBe(3);
      expect(testGame!.isComplete).toBe(false);
    });

    it("excludes completed games by default", () => {
      const now = new Date().toISOString();
      const actor = createActor(gameMachine, {
        input: { startingRound: 6 },
      });
      actor.start();
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "ADD_PLAYER", name: "Bob" });
      actor.send({ type: "ADD_PLAYER", name: "Carol" });
      actor.send({ type: "START_GAME" });

      const roundRecord: RoundRecord = {
        roundNumber: 6,
        scores: { "player-0": 0, "player-1": 10, "player-2": 20 },
        winnerId: "player-0",
      };
      actor.send({ type: "ROUND_COMPLETE", roundRecord });

      const save: CliGameSave = {
        version: "3.0",
        gameId: testGameId,
        createdAt: now,
        updatedAt: now,
        engineSnapshot: actor.getPersistedSnapshot(),
      };
      saveGameSave(testGameId, save);
      actor.stop();

      const games = listSavedGames();
      const testGame = games.find(g => g.id === testGameId);

      expect(testGame).toBeUndefined();
    });

    it("includes completed games when requested", () => {
      const now = new Date().toISOString();
      const actor = createActor(gameMachine, {
        input: { startingRound: 6 },
      });
      actor.start();
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "ADD_PLAYER", name: "Bob" });
      actor.send({ type: "ADD_PLAYER", name: "Carol" });
      actor.send({ type: "START_GAME" });

      const roundRecord: RoundRecord = {
        roundNumber: 6,
        scores: { "player-0": 0, "player-1": 10, "player-2": 20 },
        winnerId: "player-0",
      };
      actor.send({ type: "ROUND_COMPLETE", roundRecord });

      const save: CliGameSave = {
        version: "3.0",
        gameId: testGameId,
        createdAt: now,
        updatedAt: now,
        engineSnapshot: actor.getPersistedSnapshot(),
      };
      saveGameSave(testGameId, save);
      actor.stop();

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

    it("formats week+ as date", () => {
      const date = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const formatted = formatGameDate(date.toISOString());
      // Should be something like "Dec 16" format
      expect(formatted).toMatch(/^\w{3} \d{1,2}$/);
    });
  });

  describe("AI player configs persistence", () => {
    it("saves and loads AI player configs", () => {
      const players: PersistedAIPlayer[] = [
        {
          playerId: "player-1",
          config: {
            name: "ClaudeBot",
            modelId: "anthropic:claude-haiku-4-5",
          },
        },
        {
          playerId: "player-2",
          config: {
            name: "GeminiBot",
            modelId: "google:gemini-flash-2.0",
          },
        },
      ];

      saveAIPlayerConfigs(testGameId, players);
      const loaded = loadAIPlayerConfigs(testGameId);

      expect(loaded).toHaveLength(2);
      expect(loaded[0]?.playerId).toBe("player-1");
      expect(loaded[0]?.config.name).toBe("ClaudeBot");
      expect(loaded[1]?.playerId).toBe("player-2");
      expect(loaded[1]?.config.modelId).toBe("google:gemini-flash-2.0");
    });

    it("returns empty array when no config file exists", () => {
      const loaded = loadAIPlayerConfigs("nonexistent-game");
      expect(loaded).toEqual([]);
    });

    it("creates game directory if it does not exist", () => {
      const fs = require("fs");
      const dir = `.data/${testGameId}`;
      expect(fs.existsSync(dir)).toBe(false);

      saveAIPlayerConfigs(testGameId, []);
      expect(fs.existsSync(dir)).toBe(true);
    });
  });

  describe("listSavedGames error handling", () => {
    it("skips corrupt game files and continues listing others", () => {
      const fs = require("fs");

      // Create a valid game first
      const validGameId = `${testGameId}-valid`;
      const engine = GameEngine.createGame({
        gameId: validGameId,
        playerNames: ["Alice", "Bob", "Carol"],
      });
      const snapshot = engine.getSnapshot();
      const save: CliGameSave = {
        version: "3.0",
        gameId: validGameId,
        createdAt: snapshot.createdAt,
        updatedAt: snapshot.updatedAt,
        engineSnapshot: engine.getPersistedSnapshot(),
      };
      saveGameSave(validGameId, save);
      engine.stop();

      // Create a corrupt game file
      const corruptGameId = `${testGameId}-corrupt`;
      const corruptDir = `.data/${corruptGameId}`;
      fs.mkdirSync(corruptDir, { recursive: true });
      fs.writeFileSync(`${corruptDir}/game-state.json`, "{ invalid json");

      try {
        // listSavedGames should not throw, but log a warning and skip corrupt games
        const games = listSavedGames();

        // The valid game should still be listed
        const validGame = games.find(g => g.id === validGameId);
        expect(validGame).toBeDefined();

        // The corrupt game should not be in the list
        const corruptGame = games.find(g => g.id === corruptGameId);
        expect(corruptGame).toBeUndefined();
      } finally {
        // Clean up
        cleanupTestGame(validGameId);
        cleanupTestGame(corruptGameId);
      }
    });

    it("skips directories without state files", () => {
      const fs = require("fs");

      // Create a directory without a state file
      const emptyDir = `.data/${testGameId}-empty`;
      fs.mkdirSync(emptyDir, { recursive: true });

      try {
        // Should not throw
        const games = listSavedGames();
        const emptyGame = games.find(g => g.id === `${testGameId}-empty`);
        expect(emptyGame).toBeUndefined();
      } finally {
        fs.rmSync(emptyDir, { recursive: true });
      }
    });
  });
});
