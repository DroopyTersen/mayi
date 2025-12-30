#!/usr/bin/env bun
/**
 * May I? CLI - Entry Point
 *
 * Command mode (agent harness):
 *   bun cli/play.ts new
 *   bun cli/play.ts <game-id> status [--json]
 *   bun cli/play.ts <game-id> <command> [...args]
 *
 * Interactive mode (human):
 *   bun cli/play.ts --interactive
 */

import { CliGameAdapter } from "./shared/cli-game-adapter";
import { readActionLog, listSavedGames, formatGameDate } from "./shared/cli.persistence";
import { renderStatus, renderStatusJson, renderLog } from "./harness/harness.render";
import { generatePlayerNames } from "./shared/cli.players";
import type { RoundNumber } from "../core/engine/engine.types";

const args = process.argv.slice(2);

// Interactive mode
if (args.includes("--interactive") || args.includes("-i")) {
  const proc = Bun.spawn(["bun", "cli/interactive/interactive.ts"], {
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  await proc.exited;
  process.exit(0);
}

// Help
if (args.length === 0 || args[0] === "help" || args[0] === "--help") {
  printHelp();
  process.exit(0);
}

// New game (no game ID required)
if (args[0]?.toLowerCase() === "new") {
  handleNew();
  process.exit(0);
}

// List games
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

const game = new CliGameAdapter();

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
    case "swap":
      handleSwap(gameId, args[2], args[3], args[4]);
      break;
    case "mayi":
      handleMayI(gameId, args[2]);
      break;
    case "allow":
      handleAllow(gameId);
      break;
    case "claim":
      handleClaim(gameId);
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

// ─────────────────────────────────────────────────────────────────────────────
// Command handlers
// ─────────────────────────────────────────────────────────────────────────────

function handleNew(): void {
  const adapter = new CliGameAdapter();

  // Parse --players flag (default: 3)
  const playersIdx = args.indexOf("--players");
  let playerCount = 3;
  if (playersIdx !== -1) {
    const playersArg = args[playersIdx + 1];
    if (playersArg === undefined) {
      throw new Error("--players requires a value (3-8)");
    }
    const parsed = parseInt(playersArg, 10);
    if (parsed >= 3 && parsed <= 8) {
      playerCount = parsed;
    } else {
      throw new Error("Player count must be between 3 and 8");
    }
  }

  // Parse --round flag (default: 1)
  const roundIdx = args.indexOf("--round");
  let startingRound: RoundNumber = 1;
  if (roundIdx !== -1) {
    const roundArg = args[roundIdx + 1];
    if (roundArg === undefined) {
      throw new Error("--round requires a value (1-6)");
    }
    const parsed = parseInt(roundArg, 10);
    if (parsed >= 1 && parsed <= 6) {
      startingRound = parsed as RoundNumber;
    } else {
      throw new Error("Round must be between 1 and 6");
    }
  }

  const players = generatePlayerNames(playerCount, false);
  const state = adapter.newGame({ playerNames: players, startingRound });

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
  const state = game.loadGame(gameId);

  if (asJson) {
    console.log(renderStatusJson(state));
    return;
  }

  console.log(`Game: ${gameId}`);
  console.log("");
  console.log(renderStatus(state));
}

function handleDraw(gameId: string, source?: string): void {
  game.loadGame(gameId);

  const after =
    source === "stock"
      ? game.drawFromStock()
      : source === "discard"
        ? game.drawFromDiscard()
        : null;

  if (!after) {
    throw new Error('Specify source: "draw stock" or "draw discard"');
  }
  if (after.lastError) {
    throw new Error(after.lastError);
  }

  console.log("");
  console.log(`Game: ${gameId}`);
  console.log("");
  console.log(renderStatus(game.getSnapshot()));
}

function handleLaydown(gameId: string, meldArgs: string[]): void {
  game.loadGame(gameId);

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

  const after = game.layDown(meldGroups);
  if (after.lastError) {
    throw new Error(after.lastError);
  }

  console.log("");
  console.log(`Game: ${gameId}`);
  console.log("");
  console.log(renderStatus(game.getSnapshot()));
}

function handleSkip(gameId: string): void {
  game.loadGame(gameId);

  const after = game.skip();
  if (after.lastError) {
    throw new Error(after.lastError);
  }

  console.log("");
  console.log(`Game: ${gameId}`);
  console.log("");
  console.log(renderStatus(game.getSnapshot()));
}

function handleDiscard(gameId: string, positionStr?: string): void {
  game.loadGame(gameId);

  if (!positionStr) {
    throw new Error("Specify position: discard <position>");
  }

  const position = parseInt(positionStr, 10);
  if (isNaN(position)) {
    throw new Error(`Invalid position: ${positionStr}`);
  }

  const after = game.discardCard(position);
  if (after.lastError) {
    throw new Error(after.lastError);
  }

  console.log("");
  console.log(`Game: ${gameId}`);
  console.log("");
  console.log(renderStatus(game.getSnapshot()));
}

function handleLayoff(gameId: string, cardPosStr?: string, meldNumStr?: string): void {
  game.loadGame(gameId);

  if (!cardPosStr || !meldNumStr) {
    throw new Error("Specify: layoff <card-position> <meld-number>");
  }

  const cardPos = parseInt(cardPosStr, 10);
  const meldNum = parseInt(meldNumStr, 10);
  if (isNaN(cardPos) || isNaN(meldNum)) {
    throw new Error("Positions must be numbers");
  }

  const after = game.layOff(cardPos, meldNum);
  if (after.lastError) {
    throw new Error(after.lastError);
  }

  console.log("");
  console.log(`Game: ${gameId}`);
  console.log("");
  console.log(renderStatus(game.getSnapshot()));
}

function handleSwap(gameId: string, meldNumStr?: string, jokerPosStr?: string, cardPosStr?: string): void {
  game.loadGame(gameId);

  if (!meldNumStr || !jokerPosStr || !cardPosStr) {
    throw new Error("Specify: swap <meld-number> <joker-position> <card-position>");
  }

  const meldNum = parseInt(meldNumStr, 10);
  const jokerPos = parseInt(jokerPosStr, 10);
  const cardPos = parseInt(cardPosStr, 10);
  if (isNaN(meldNum) || isNaN(jokerPos) || isNaN(cardPos)) {
    throw new Error("All arguments must be numbers");
  }

  const after = game.swap(meldNum, jokerPos, cardPos);
  if (after.lastError) {
    throw new Error(after.lastError);
  }

  console.log("");
  console.log(`Game: ${gameId}`);
  console.log("");
  console.log(renderStatus(game.getSnapshot()));
}

function handleMayI(gameId: string, callerId?: string): void {
  game.loadGame(gameId);

  if (!callerId) {
    throw new Error("Specify caller: mayi <player-id>");
  }

  const after = game.callMayI(callerId);
  if (after.lastError) {
    throw new Error(after.lastError);
  }

  console.log("");
  console.log(`Game: ${gameId}`);
  console.log("");
  console.log(renderStatus(game.getSnapshot()));
}

function handleAllow(gameId: string): void {
  game.loadGame(gameId);

  const after = game.allowMayI();
  if (after.lastError) {
    throw new Error(after.lastError);
  }

  console.log("");
  console.log(`Game: ${gameId}`);
  console.log("");
  console.log(renderStatus(game.getSnapshot()));
}

function handleClaim(gameId: string): void {
  game.loadGame(gameId);

  const after = game.claimMayI();
  if (after.lastError) {
    throw new Error(after.lastError);
  }

  console.log("");
  console.log(`Game: ${gameId}`);
  console.log("");
  console.log(renderStatus(game.getSnapshot()));
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
  <game-id> skip              Skip laying down / laying off
  <game-id> discard <pos>     Discard card at position

  <game-id> layoff <card> <meld>        Lay off card to meld
  <game-id> swap <meld> <pos> <card>    Swap card for Joker in run

  <game-id> mayi <player-id>  Call "May I?" as the specified player
  <game-id> allow             Allow the caller (when prompted)
  <game-id> claim             Claim the discard yourself (when prompted)

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
  bun cli/play.ts a1b2c3 mayi player-2
  bun cli/play.ts --interactive
`);
}

