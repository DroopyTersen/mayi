#!/usr/bin/env bun
/**
 * May I? CLI - Entry Point
 *
 * A command-line interface for Claude to play and test the game.
 * Each command is self-contained: run, execute one action, exit.
 *
 * Usage:
 *   bun cli/play.ts new                         # Start new game
 *   bun cli/play.ts <game-id> status            # Show current state
 *   bun cli/play.ts <game-id> status --json     # Show state as JSON
 *   bun cli/play.ts <game-id> draw stock        # Draw from stock
 *   bun cli/play.ts <game-id> draw discard      # Draw from discard
 *   bun cli/play.ts <game-id> laydown "1,2,3" "4,5,6,7"  # Lay down melds
 *   bun cli/play.ts <game-id> skip              # Skip laying down
 *   bun cli/play.ts <game-id> discard 5         # Discard card at position 5
 *   bun cli/play.ts <game-id> layoff 3 1        # Lay off card 3 to meld 1
 *   bun cli/play.ts <game-id> mayi              # Call May I
 *   bun cli/play.ts <game-id> pass              # Pass on May I
 *   bun cli/play.ts <game-id> continue          # Continue to next round
 *   bun cli/play.ts <game-id> log               # Show action log
 */

import { Orchestrator } from "./harness/orchestrator";
import { readActionLog, listSavedGames, formatGameDate } from "./shared/cli.persistence";
import { renderStatus, renderStatusJson, renderLog } from "./harness/harness.render";
import { generatePlayerNames } from "./shared/cli.players";
import type { PersistedGameState } from "./shared/cli.types";
import type { RoundNumber } from "../core/engine/engine.types";

// --- Main entry point ---

const args = process.argv.slice(2);

// Check for interactive mode
if (args.includes("--interactive") || args.includes("-i")) {
  // Spawn the interactive CLI
  const proc = Bun.spawn(["bun", "cli/interactive/interactive.ts"], {
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  await proc.exited;
  process.exit(0);
}

// Check for help
if (args.length === 0 || args[0] === "help" || args[0] === "--help") {
  printHelp();
  process.exit(0);
}

// Check for 'new' command (special case - no game ID needed)
if (args[0]?.toLowerCase() === "new") {
  handleNew();
  process.exit(0);
}

// Check for 'list' command (list saved games)
if (args[0]?.toLowerCase() === "list") {
  handleList();
  process.exit(0);
}

// All other commands require: <game-id> <command> [args]
const gameId = args[0];
const command = args[1]?.toLowerCase();

if (!gameId || !command) {
  console.error("Usage: bun cli/play.ts <game-id> <command> [args]");
  console.error('Run "bun cli/play.ts help" for usage.');
  process.exit(1);
}

const orchestrator = new Orchestrator();

try {
  switch (command) {
    case "status":
      handleStatus(gameId, args.includes("--json"));
      break;
    case "draw":
      handleDraw(gameId, args[2]);
      break;
    case "laydown":
      handleLaydown(gameId, args.slice(2));
      break;
    case "skip":
      handleSkip(gameId);
      break;
    case "discard":
      handleDiscard(gameId, args[2]);
      break;
    case "layoff":
      handleLayoff(gameId, args[2], args[3]);
      break;
    case "mayi":
      handleMayI(gameId);
      break;
    case "pass":
      handlePass(gameId);
      break;
    case "continue":
      handleContinue(gameId);
      break;
    case "swap":
      handleSwap(gameId, args[2], args[3], args[4]);
      break;
    case "log":
      handleLog(gameId, args[2]);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.error('Run "bun cli/play.ts help" for usage.');
      process.exit(1);
  }
} catch (error) {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

// --- Command handlers ---

function handleNew(): void {
  const orchestrator = new Orchestrator();

  // Parse --players flag (default: 3)
  const playersIdx = args.indexOf("--players");
  let playerCount = 3;
  if (playersIdx !== -1) {
    const playersArg = args[playersIdx + 1];
    if (playersArg === undefined) {
      console.error("Error: --players requires a value (3-8)");
      process.exit(1);
    }
    const parsed = parseInt(playersArg, 10);
    if (parsed >= 3 && parsed <= 8) {
      playerCount = parsed;
    } else {
      console.error("Error: Player count must be between 3 and 8");
      process.exit(1);
    }
  }

  // Parse --round flag (default: 1)
  const roundIdx = args.indexOf("--round");
  let startingRound: RoundNumber = 1;
  if (roundIdx !== -1) {
    const roundArg = args[roundIdx + 1];
    if (roundArg === undefined) {
      console.error("Error: --round requires a value (1-6)");
      process.exit(1);
    }
    const parsed = parseInt(roundArg, 10);
    if (parsed >= 1 && parsed <= 6) {
      startingRound = parsed as RoundNumber;
    } else {
      console.error("Error: Round must be between 1 and 6");
      process.exit(1);
    }
  }

  const players = generatePlayerNames(playerCount, false);
  orchestrator.newGame(players, startingRound);
  const state = orchestrator.getPersistedState();

  console.log("");
  console.log(`  Game ID: ${state.gameId}`);
  console.log("");
  const roundMsg = startingRound > 1 ? ` (starting at Round ${startingRound})` : "";
  console.log(`New game started! Players: ${players.join(", ")}${roundMsg}`);
  console.log("");
  console.log(renderStatus(state));
}

function handleList(): void {
  const games = listSavedGames();

  if (games.length === 0) {
    console.log("No saved games found.");
    console.log('Run "bun cli/play.ts new" to start a new game.');
    return;
  }

  console.log("Saved games:");
  console.log("");
  for (const game of games) {
    const dateStr = formatGameDate(game.updatedAt);
    console.log(`  ${game.id}  Round ${game.currentRound}/6  (${dateStr})`);
  }
  console.log("");
  console.log('Use "bun cli/play.ts <game-id> status" to view a game.');
}

function handleStatus(gameId: string, asJson: boolean): void {
  orchestrator.loadGame(gameId);
  const state = orchestrator.getPersistedState();

  if (asJson) {
    console.log(renderStatusJson(state));
  } else {
    console.log(`Game: ${gameId}`);
    console.log("");
    console.log(renderStatus(state));
  }
}

function handleDraw(gameId: string, source?: string): void {
  orchestrator.loadGame(gameId);

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
  console.log(`Game: ${gameId}`);
  console.log("");
  console.log(renderStatus(orchestrator.getPersistedState()));
}

function handleLaydown(gameId: string, meldArgs: string[]): void {
  orchestrator.loadGame(gameId);

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
  console.log(`Game: ${gameId}`);
  console.log("");
  console.log(renderStatus(orchestrator.getPersistedState()));
}

function handleSkip(gameId: string): void {
  orchestrator.loadGame(gameId);

  const result = orchestrator.skip();
  if (!result.success) {
    throw new Error(result.message);
  }

  console.log(result.message);
  console.log("");
  console.log(`Game: ${gameId}`);
  console.log("");
  console.log(renderStatus(orchestrator.getPersistedState()));
}

function handleDiscard(gameId: string, positionStr?: string): void {
  orchestrator.loadGame(gameId);

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
  console.log(`Game: ${gameId}`);
  console.log("");
  console.log(renderStatus(orchestrator.getPersistedState()));
}

function handleLayoff(gameId: string, cardPosStr?: string, meldNumStr?: string): void {
  orchestrator.loadGame(gameId);

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
  console.log(`Game: ${gameId}`);
  console.log("");
  console.log(renderStatus(orchestrator.getPersistedState()));
}

function handleMayI(gameId: string): void {
  orchestrator.loadGame(gameId);

  const result = orchestrator.callMayI();
  if (!result.success) {
    throw new Error(result.message);
  }

  console.log(result.message);
  console.log("");
  console.log(`Game: ${gameId}`);
  console.log("");
  console.log(renderStatus(orchestrator.getPersistedState()));
}

function handlePass(gameId: string): void {
  orchestrator.loadGame(gameId);

  const result = orchestrator.pass();
  if (!result.success) {
    throw new Error(result.message);
  }

  console.log(result.message);
  console.log("");
  console.log(`Game: ${gameId}`);
  console.log("");
  console.log(renderStatus(orchestrator.getPersistedState()));
}

function handleContinue(gameId: string): void {
  orchestrator.loadGame(gameId);

  const result = orchestrator.continue();
  if (!result.success) {
    throw new Error(result.message);
  }

  console.log(result.message);
  console.log("");
  console.log(`Game: ${gameId}`);
  console.log("");
  console.log(renderStatus(orchestrator.getPersistedState()));
}

function handleSwap(gameId: string, meldNumStr?: string, jokerPosStr?: string, cardPosStr?: string): void {
  orchestrator.loadGame(gameId);

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
  console.log(`Game: ${gameId}`);
  console.log("");
  console.log(renderStatus(orchestrator.getPersistedState()));
}

function handleLog(gameId: string, tailArg?: string): void {
  const entries = readActionLog(gameId);
  const tail = tailArg ? parseInt(tailArg, 10) : undefined;
  console.log(`Game: ${gameId}`);
  console.log("");
  console.log(renderLog(entries, tail));
}

function printHelp(): void {
  console.log(`
May I? CLI

Usage: bun cli/play.ts <command> [options]

Modes:
  --interactive, -i           Start interactive human-friendly mode
  (default)                   Command mode for AI agents

Game Management:
  new                         Start a new 3-player game
  new --players <3-8>         Start game with N players
  new --round <1-6>           Start game at specific round
  list                        List all saved games

Commands (require game ID):
  <game-id> status            Show current game state
  <game-id> status --json     Show state as JSON

  <game-id> draw stock        Draw from stock pile
  <game-id> draw discard      Draw from discard pile

  <game-id> laydown "1,2,3" "4,5,6,7"   Lay down melds (card positions)
  <game-id> skip              Skip laying down
  <game-id> discard <pos>     Discard card at position

  <game-id> layoff <card> <meld>        Lay off card to meld
  <game-id> swap <meld> <pos> <card>    Swap card for Joker in run

  <game-id> mayi              Call May I (non-current player)
  <game-id> pass              Pass on May I

  <game-id> continue          Continue to next round
  <game-id> log [n]           Show action log (last n entries)

Examples:
  bun cli/play.ts new
  bun cli/play.ts new --players 5
  bun cli/play.ts new --players 4 --round 6
  bun cli/play.ts list
  bun cli/play.ts a1b2c3 status
  bun cli/play.ts a1b2c3 draw stock
  bun cli/play.ts a1b2c3 laydown "1,2,3" "4,5,6,7"
  bun cli/play.ts a1b2c3 discard 5
  bun cli/play.ts --interactive
`);
}
