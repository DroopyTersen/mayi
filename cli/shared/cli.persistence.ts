/**
 * Persistence layer for the May I? CLI
 *
 * Handles saving and loading XState snapshots for game state persistence.
 */

import type { ActionLogEntry, OrchestratorSnapshot } from "./cli.types";

const STATE_FILE = "cli/game-state.json";
const LOG_FILE = "cli/game-log.jsonl";

/**
 * Check if a saved game exists
 */
export function savedGameExists(): boolean {
  return Bun.file(STATE_FILE).size > 0;
}

/**
 * Load saved orchestrator snapshot
 */
export function loadOrchestratorSnapshot(): OrchestratorSnapshot {
  const file = Bun.file(STATE_FILE);
  if (file.size === 0) {
    throw new Error("No game in progress. Run 'bun cli/play.ts new' to start a new game.");
  }

  const content = require("fs").readFileSync(STATE_FILE, "utf-8");
  const data = JSON.parse(content);

  if (data.version !== "2.0") {
    throw new Error(`Unsupported state version: ${data.version}`);
  }

  return data as OrchestratorSnapshot;
}

/**
 * Save orchestrator snapshot to file
 */
export function saveOrchestratorSnapshot(snapshot: OrchestratorSnapshot): void {
  snapshot.updatedAt = new Date().toISOString();
  const content = JSON.stringify(snapshot, null, 2);
  require("fs").writeFileSync(STATE_FILE, content);
}

/**
 * Create a new orchestrator snapshot
 */
export function createOrchestratorSnapshot(
  gameId: string,
  gameSnapshot: unknown,
  phase: OrchestratorSnapshot["phase"]
): OrchestratorSnapshot {
  const now = new Date().toISOString();
  return {
    version: "2.0",
    gameId,
    createdAt: now,
    updatedAt: now,
    phase,
    gameSnapshot,
    turnNumber: 1,
    mayIContext: null,
  };
}

/**
 * Clear saved game state (for starting fresh)
 */
export function clearSavedGame(): void {
  require("fs").writeFileSync(STATE_FILE, "");
  require("fs").writeFileSync(LOG_FILE, "");
}

/**
 * Append an entry to the action log
 */
export function appendActionLog(entry: ActionLogEntry): void {
  const line = JSON.stringify(entry) + "\n";
  require("fs").appendFileSync(LOG_FILE, line);
}

/**
 * Read the action log
 */
export function readActionLog(): ActionLogEntry[] {
  const file = Bun.file(LOG_FILE);
  if (file.size === 0) {
    return [];
  }
  const content = require("fs").readFileSync(LOG_FILE, "utf-8");
  const lines = content.trim().split("\n").filter((l: string) => l.length > 0);
  return lines.map((line: string) => JSON.parse(line) as ActionLogEntry);
}

