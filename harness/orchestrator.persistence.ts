/**
 * Persistence layer for the May I? orchestrator
 *
 * Handles saving and loading XState snapshots for game state persistence.
 * Maintains backward compatibility with v1.0 PersistedGameState format.
 */

import type { Snapshot } from "xstate";
import type { ActionLogEntry, OrchestratorSnapshot, PersistedGameState, MayIContext } from "./harness.types";
import type { GameContext } from "../core/engine/game.machine";
import type { RoundContext } from "../core/engine/round.machine";
import type { TurnContext } from "../core/engine/turn.machine";
import type { RoundNumber } from "../core/engine/engine.types";
import { CONTRACTS } from "../core/engine/contracts";

const STATE_FILE = "harness/game-state.json";
const LOG_FILE = "harness/game-log.jsonl";

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
    throw new Error("No game in progress. Run 'bun harness/play.ts new' to start a new game.");
  }

  const content = require("fs").readFileSync(STATE_FILE, "utf-8");
  const data = JSON.parse(content);

  // Check version and handle accordingly
  if (data.version === "1.0") {
    // Legacy format - convert to orchestrator snapshot
    return convertV1ToOrchestratorSnapshot(data as PersistedGameState);
  }

  if (data.version === "2.0") {
    return data as OrchestratorSnapshot;
  }

  throw new Error(`Unsupported state version: ${data.version}`);
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

/**
 * Convert v1.0 PersistedGameState to OrchestratorSnapshot
 *
 * This enables backward compatibility with existing game saves.
 * The conversion reconstructs the XState machine state from the flat v1.0 format.
 */
function convertV1ToOrchestratorSnapshot(v1: PersistedGameState): OrchestratorSnapshot {
  // Determine orchestrator phase from v1 harness phase
  let phase: OrchestratorSnapshot["phase"];
  switch (v1.harness.phase) {
    case "AWAITING_DRAW":
    case "AWAITING_ACTION":
    case "AWAITING_DISCARD":
      phase = "ROUND_ACTIVE";
      break;
    case "MAY_I_WINDOW":
      phase = "MAY_I_WINDOW";
      break;
    case "ROUND_END":
      phase = "ROUND_END";
      break;
    case "GAME_END":
      phase = "GAME_END";
      break;
    default:
      phase = "IDLE";
  }

  // Build a reconstructed game context that can be used to restore state
  // This is a simplified snapshot that the orchestrator can use to recreate actors
  const gameContext: GameContext = {
    gameId: v1.gameId,
    players: v1.players,
    currentRound: v1.currentRound as 1 | 2 | 3 | 4 | 5 | 6 | 7,
    dealerIndex: v1.dealerIndex,
    roundHistory: v1.roundHistory,
    winners: [],
    lastError: null,
  };

  // For v1 compatibility, we store the reconstructed state
  // The orchestrator will need to handle this specially when restoring
  const gameSnapshot = {
    _v1Compat: true,
    gameContext,
    roundState: {
      stock: v1.stock,
      discard: v1.discard,
      table: v1.table,
      currentPlayerIndex: v1.currentPlayerIndex,
    },
    harnessPhase: v1.harness.phase,
    awaitingPlayerId: v1.harness.awaitingPlayerId,
  };

  return {
    version: "2.0",
    gameId: v1.gameId,
    createdAt: v1.createdAt,
    updatedAt: v1.updatedAt,
    phase,
    gameSnapshot,
    turnNumber: v1.harness.turnNumber,
    mayIContext: v1.harness.mayIContext,
  };
}

/**
 * Convert OrchestratorSnapshot back to v1.0 PersistedGameState for rendering
 *
 * This is used by the rendering layer which expects the v1 format.
 * It extracts state from the XState snapshot into the flat v1 format.
 */
export function snapshotToPersistedState(
  snapshot: OrchestratorSnapshot,
  gameContext: GameContext,
  roundContext: RoundContext | null
): PersistedGameState {
  // If roundContext is provided, use it; otherwise use gameContext players
  const players = roundContext?.players ?? gameContext.players;
  const stock = roundContext?.stock ?? [];
  const discard = roundContext?.discard ?? [];
  const table = roundContext?.table ?? [];
  const currentPlayerIndex = roundContext?.currentPlayerIndex ?? 0;

  // Map orchestrator phase to harness phase
  let harnessPhase: PersistedGameState["harness"]["phase"];
  switch (snapshot.phase) {
    case "IDLE":
    case "GAME_SETUP":
      harnessPhase = "AWAITING_DRAW";
      break;
    case "ROUND_ACTIVE":
      // We need more context to determine exact phase
      // Default to AWAITING_DRAW, caller should override
      harnessPhase = "AWAITING_DRAW";
      break;
    case "MAY_I_WINDOW":
      harnessPhase = "MAY_I_WINDOW";
      break;
    case "ROUND_END":
      harnessPhase = "ROUND_END";
      break;
    case "GAME_END":
      harnessPhase = "GAME_END";
      break;
    default:
      harnessPhase = "AWAITING_DRAW";
  }

  return {
    version: "1.0",
    gameId: snapshot.gameId,
    seed: null,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
    currentRound: gameContext.currentRound as RoundNumber,
    contract: CONTRACTS[gameContext.currentRound as RoundNumber],
    players,
    currentPlayerIndex,
    dealerIndex: gameContext.dealerIndex,
    stock,
    discard,
    table,
    roundHistory: gameContext.roundHistory,
    harness: {
      phase: harnessPhase,
      awaitingPlayerId: players[currentPlayerIndex]?.id ?? "",
      mayIContext: snapshot.mayIContext,
      turnNumber: snapshot.turnNumber,
    },
  };
}
