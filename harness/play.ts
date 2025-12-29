#!/usr/bin/env bun
/**
 * May I? CLI Harness - Entry Point
 *
 * A command-line interface for Claude to play and test the game.
 * Each command is self-contained: run, execute one action, exit.
 *
 * Usage:
 *   bun harness/play.ts new                    # Start new game
 *   bun harness/play.ts status                 # Show current state
 *   bun harness/play.ts status --json          # Show state as JSON
 *   bun harness/play.ts draw stock             # Draw from stock
 *   bun harness/play.ts draw discard           # Draw from discard
 *   bun harness/play.ts laydown "1,2,3" "4,5,6,7"  # Lay down melds
 *   bun harness/play.ts skip                   # Skip laying down
 *   bun harness/play.ts discard 5              # Discard card at position 5
 *   bun harness/play.ts layoff 3 1             # Lay off card 3 to meld 1
 *   bun harness/play.ts mayi                   # Call May I
 *   bun harness/play.ts take                   # Current player takes discard
 *   bun harness/play.ts pass                   # Pass on May I
 *   bun harness/play.ts continue               # Continue to next round
 *   bun harness/play.ts log                    # Show action log
 */

import { Orchestrator } from "./orchestrator";
import { readActionLog, savedGameExists } from "./orchestrator.persistence";
import { renderStatus, renderStatusJson, renderLog } from "./harness.render";
import type { PersistedGameState } from "./harness.types";

// --- Main entry point ---

const args = process.argv.slice(2);
const command = args[0]?.toLowerCase();

// Check for interactive mode
if (args.includes("--interactive") || args.includes("-i")) {
  // Spawn the interactive CLI
  const proc = Bun.spawn(["bun", "harness/interactive.ts"], {
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  await proc.exited;
  process.exit(0);
}

if (!command || command === "help" || command === "--help") {
  printHelp();
  process.exit(0);
}

const orchestrator = new Orchestrator();

try {
  switch (command) {
    case "new":
      handleNew();
      break;
    case "status":
      handleStatus(args.includes("--json"));
      break;
    case "draw":
      handleDraw(args[1]);
      break;
    case "laydown":
      handleLaydown(args.slice(1));
      break;
    case "skip":
      handleSkip();
      break;
    case "discard":
      handleDiscard(args[1]);
      break;
    case "layoff":
      handleLayoff(args[1], args[2]);
      break;
    case "mayi":
      handleMayI();
      break;
    case "pass":
      handlePass();
      break;
    case "continue":
      handleContinue();
      break;
    case "swap":
      handleSwap(args[1], args[2], args[3]);
      break;
    case "log":
      handleLog(args[1]);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.error('Run "bun harness/play.ts help" for usage.');
      process.exit(1);
  }
} catch (error) {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

// --- Command handlers ---

function handleNew(): void {
  const players: [string, string, string] = ["Alice", "Bob", "Carol"];
  orchestrator.newGame(players);
  const state = orchestrator.getPersistedState();

  console.log(`New game started! Game ID: ${state.gameId}`);
  console.log(`Players: ${players.join(", ")}`);
  console.log("");
  console.log(renderStatus(state));
}

function handleStatus(asJson: boolean): void {
  orchestrator.loadGame();
  const state = orchestrator.getPersistedState();

  if (asJson) {
    console.log(renderStatusJson(state));
  } else {
    console.log(renderStatus(state));
  }
}

function handleDraw(source?: string): void {
  orchestrator.loadGame();

  if (source === "stock") {
    const result = orchestrator.drawFromStock();
    if (!result.success) {
      throw new Error(result.message);
    }
    console.log(result.message);
  } else if (source === "discard") {
    const result = orchestrator.drawFromDiscard();
    if (!result.success) {
      throw new Error(result.message);
    }
    console.log(result.message);
  } else {
    throw new Error('Specify source: "draw stock" or "draw discard"');
  }

  console.log("");
  console.log(renderStatus(orchestrator.getPersistedState()));
}

function handleLaydown(meldArgs: string[]): void {
  orchestrator.loadGame();

  if (meldArgs.length === 0) {
    throw new Error('Specify melds: laydown "1,2,3" "4,5,6,7"');
  }

  // Parse meld arguments
  const meldGroups: number[][] = [];
  for (const arg of meldArgs) {
    const positions = arg.split(",").map((s) => parseInt(s.trim(), 10));
    if (positions.some(isNaN)) {
      throw new Error(`Invalid positions in: ${arg}`);
    }
    meldGroups.push(positions);
  }

  const result = orchestrator.layDown(meldGroups);
  if (!result.success) {
    throw new Error(result.message);
  }

  console.log(result.message);
  console.log("");
  console.log(renderStatus(orchestrator.getPersistedState()));
}

function handleSkip(): void {
  orchestrator.loadGame();

  const result = orchestrator.skip();
  if (!result.success) {
    throw new Error(result.message);
  }

  console.log(result.message);
  console.log("");
  console.log(renderStatus(orchestrator.getPersistedState()));
}

function handleDiscard(positionStr?: string): void {
  orchestrator.loadGame();

  if (!positionStr) {
    throw new Error("Specify position: discard <position>");
  }

  const position = parseInt(positionStr, 10);
  if (isNaN(position)) {
    throw new Error(`Invalid position: ${positionStr}`);
  }

  const result = orchestrator.discardCard(position);
  if (!result.success) {
    throw new Error(result.message);
  }

  console.log(result.message);
  console.log("");
  console.log(renderStatus(orchestrator.getPersistedState()));
}

function handleLayoff(cardPosStr?: string, meldNumStr?: string): void {
  orchestrator.loadGame();

  if (!cardPosStr || !meldNumStr) {
    throw new Error("Specify: layoff <card-position> <meld-number>");
  }

  const cardPos = parseInt(cardPosStr, 10);
  const meldNum = parseInt(meldNumStr, 10);
  if (isNaN(cardPos) || isNaN(meldNum)) {
    throw new Error("Positions must be numbers");
  }

  const result = orchestrator.layOff(cardPos, meldNum);
  if (!result.success) {
    throw new Error(result.message);
  }

  console.log(result.message);
  console.log("");
  console.log(renderStatus(orchestrator.getPersistedState()));
}

function handleMayI(): void {
  orchestrator.loadGame();

  const result = orchestrator.callMayI();
  if (!result.success) {
    throw new Error(result.message);
  }

  console.log(result.message);
  console.log("");
  console.log(renderStatus(orchestrator.getPersistedState()));
}

function handlePass(): void {
  orchestrator.loadGame();

  const result = orchestrator.pass();
  if (!result.success) {
    throw new Error(result.message);
  }

  console.log(result.message);
  console.log("");
  console.log(renderStatus(orchestrator.getPersistedState()));
}

function handleContinue(): void {
  orchestrator.loadGame();

  const result = orchestrator.continue();
  if (!result.success) {
    throw new Error(result.message);
  }

  console.log(result.message);
  console.log("");
  console.log(renderStatus(orchestrator.getPersistedState()));
}

function handleSwap(meldNumStr?: string, jokerPosStr?: string, cardPosStr?: string): void {
  orchestrator.loadGame();

  if (!meldNumStr || !jokerPosStr || !cardPosStr) {
    throw new Error("Specify: swap <meld-number> <joker-position> <card-position>");
  }

  const meldNum = parseInt(meldNumStr, 10);
  const jokerPos = parseInt(jokerPosStr, 10);
  const cardPos = parseInt(cardPosStr, 10);
  if (isNaN(meldNum) || isNaN(jokerPos) || isNaN(cardPos)) {
    throw new Error("All arguments must be numbers");
  }

  const result = orchestrator.swap(meldNum, jokerPos, cardPos);
  if (!result.success) {
    throw new Error(result.message);
  }

  console.log(result.message);
  console.log("");
  console.log(renderStatus(orchestrator.getPersistedState()));
}

function handleLog(tailArg?: string): void {
  const entries = readActionLog();
  const tail = tailArg ? parseInt(tailArg, 10) : undefined;
  console.log(renderLog(entries, tail));
}

function printHelp(): void {
  console.log(`
May I? CLI Harness

Usage: bun harness/play.ts <command> [options]

Modes:
  --interactive, -i           Start interactive human-friendly mode
  (default)                   Command mode for AI agents

Commands (command mode):
  new                         Start a new 3-player game
  status                      Show current game state
  status --json               Show state as JSON

  draw stock                  Draw from stock pile
  draw discard                Draw from discard pile

  laydown "1,2,3" "4,5,6,7"   Lay down melds (card positions)
  skip                        Skip laying down
  discard <position>          Discard card at position

  layoff <card> <meld>        Lay off card to meld (not in Round 6)
  swap <meld> <pos> <card>    Swap card for Joker in run (not in Round 6)

  mayi                        Call May I (non-current player)
  pass                        Pass on May I

  continue                    Continue to next round
  log [n]                     Show action log (last n entries)

Examples:
  bun harness/play.ts new
  bun harness/play.ts draw stock
  bun harness/play.ts laydown "1,2,3" "4,5,6,7"
  bun harness/play.ts discard 5
  bun harness/play.ts log 10
  bun harness/play.ts --interactive     # Start interactive mode
`);
}
