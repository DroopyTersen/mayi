/**
 * Persistence layer for the May I? CLI
 *
 * Supports multiple concurrent games stored in .data/<game-id>/ directories.
 */

import * as fs from "node:fs";
import type { ActionLogEntry, CliGameSave } from "./cli.types";
import type { AIPlayerConfig } from "../../ai/aiPlayer.types";
import { GameEngine } from "../../core/engine/game-engine";
import { generateRoomId } from "../../core/room/room-id.utils";

const DATA_DIR = ".data";

/**
 * Get the directory path for a specific game
 */
function getGameDir(gameId: string): string {
  return `${DATA_DIR}/${gameId}`;
}

/**
 * Get the state file path for a specific game
 */
function getStateFilePath(gameId: string): string {
  return `${getGameDir(gameId)}/game-state.json`;
}

/**
 * Get the log file path for a specific game
 */
function getLogFilePath(gameId: string): string {
  return `${getGameDir(gameId)}/game-log.jsonl`;
}

/**
 * Generate a new 6-character game ID
 */
export function generateGameId(): string {
  return generateRoomId();
}

/**
 * Ensure the data directory exists for a game
 */
function ensureGameDir(gameId: string): void {
  const dir = getGameDir(gameId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Check if a saved game exists
 */
export function savedGameExists(gameId: string): boolean {
  const stateFile = getStateFilePath(gameId);
  return fs.existsSync(stateFile) && fs.statSync(stateFile).size > 0;
}

/**
 * Game summary for listing available games
 */
export interface GameSummary {
  id: string;
  createdAt: string;
  updatedAt: string;
  currentRound: number;
  isComplete: boolean;
  playerNames: string[];
}

/**
 * List all saved games with their metadata
 * Returns games sorted by most recently updated first
 * Excludes completed games by default
 */
export function listSavedGames(includeCompleted: boolean = false): GameSummary[] {
  if (!fs.existsSync(DATA_DIR)) {
    return [];
  }

  const entries = fs.readdirSync(DATA_DIR, { withFileTypes: true });
  const games: GameSummary[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const gameId = entry.name;
    const stateFile = getStateFilePath(gameId);

    if (!fs.existsSync(stateFile)) continue;

    try {
      const content = fs.readFileSync(stateFile, "utf-8");
      const data = JSON.parse(content) as { version?: string };

      // v3.0: GameEngine-backed save
      if (data.version === "3.0") {
        const save = data as CliGameSave;
        const engine = GameEngine.fromPersistedSnapshot(
          save.engineSnapshot as unknown as ReturnType<GameEngine["getPersistedSnapshot"]>,
          save.gameId,
          save.createdAt
        );
        const snapshot = engine.getSnapshot();
        engine.stop();

        const isComplete = snapshot.phase === "GAME_END";
        if (!includeCompleted && isComplete) continue;

        games.push({
          id: gameId,
          createdAt: save.createdAt,
          updatedAt: save.updatedAt,
          currentRound: snapshot.currentRound,
          isComplete,
          playerNames: snapshot.players.map((p) => p.name),
        });
        continue;
      }
    } catch (error) {
      // Log warning for corrupted games, but don't fail the listing
      console.error(`Warning: Could not load game ${gameId}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
  }

  // Sort by most recently updated first
  games.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return games;
}

/**
 * Load saved GameEngine-backed game state for a specific game
 */
export function loadGameSave(gameId: string): CliGameSave {
  const stateFile = getStateFilePath(gameId);

  if (!fs.existsSync(stateFile) || fs.statSync(stateFile).size === 0) {
    throw new Error(`No game found with ID: ${gameId}`);
  }

  const content = fs.readFileSync(stateFile, "utf-8");
  const data = JSON.parse(content);

  if (data.version !== "3.0") {
    throw new Error(`Unsupported state version: ${data.version}`);
  }

  return data as CliGameSave;
}

/**
 * Save GameEngine-backed game state to file
 */
export function saveGameSave(gameId: string, save: CliGameSave): void {
  ensureGameDir(gameId);
  save.updatedAt = new Date().toISOString();
  const content = JSON.stringify(save, null, 2);
  fs.writeFileSync(getStateFilePath(gameId), content);
}

/**
 * Append an entry to the action log
 */
export function appendActionLog(gameId: string, entry: ActionLogEntry): void {
  ensureGameDir(gameId);
  const line = JSON.stringify(entry) + "\n";
  fs.appendFileSync(getLogFilePath(gameId), line);
}

/**
 * Read the action log for a specific game
 */
export function readActionLog(gameId: string): ActionLogEntry[] {
  const logFile = getLogFilePath(gameId);

  if (!fs.existsSync(logFile) || fs.statSync(logFile).size === 0) {
    return [];
  }

  const content = fs.readFileSync(logFile, "utf-8");
  const lines = content.trim().split("\n").filter((l: string) => l.length > 0);
  return lines.map((line: string) => JSON.parse(line) as ActionLogEntry);
}

/**
 * Get the AI players config file path for a specific game
 */
function getAIPlayersFilePath(gameId: string): string {
  return `${getGameDir(gameId)}/ai-players.json`;
}

/**
 * Persisted AI player config with player ID mapping
 */
export interface PersistedAIPlayer {
  playerId: string;
  config: AIPlayerConfig;
}

/**
 * Save AI player configurations for a game
 */
export function saveAIPlayerConfigs(gameId: string, players: PersistedAIPlayer[]): void {
  ensureGameDir(gameId);
  const content = JSON.stringify(players, null, 2);
  fs.writeFileSync(getAIPlayersFilePath(gameId), content);
}

/**
 * Load AI player configurations for a game
 * Returns empty array if no config file exists
 */
export function loadAIPlayerConfigs(gameId: string): PersistedAIPlayer[] {
  const filePath = getAIPlayersFilePath(gameId);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const content = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(content) as PersistedAIPlayer[];
}

/**
 * Format a date string for friendly display
 */
export function formatGameDate(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
