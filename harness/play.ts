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

import type { Card } from "../core/card/card.types";
import type { Meld } from "../core/meld/meld.types";
import type { PersistedGameState, CommandResult, MayIContext } from "./harness.types";
import {
  loadGameState,
  saveGameState,
  createNewGame,
  appendActionLog,
  readActionLog,
  getCurrentPlayer,
  getAwaitingPlayer,
  getPlayerById,
  advanceToNextPlayer,
  setupNewRound,
  gameExists,
} from "./harness.state";
import { renderStatus, renderStatusJson, renderLog, getAvailableCommands } from "./harness.render";
import { renderCard } from "../cli/cli.renderer";
import { parseLayDownInput, inferMeldTypes } from "../cli/cli.laydown";
import { isValidSet, isValidRun } from "../core/meld/meld.validation";
import { validateContractMelds, CONTRACTS } from "../core/engine/contracts";
import { canLayOffToSet, canLayOffToRun, getRunInsertPosition } from "../core/engine/layoff";
import { canSwapJokerWithCard, identifyJokerPositions } from "../core/meld/meld.joker";
import { calculateHandScore } from "../core/scoring/scoring";

// --- Main entry point ---

const args = process.argv.slice(2);
const command = args[0]?.toLowerCase();

if (!command || command === "help" || command === "--help") {
  printHelp();
  process.exit(0);
}

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
    case "take":
      handleTake();
      break;
    case "pass":
      handlePass();
      break;
    case "continue":
      handleContinue();
      break;
    case "stuck":
      handleStuck();
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
  const state = createNewGame(players);
  console.log(`New game started! Game ID: ${state.gameId}`);
  console.log(`Players: ${players.join(", ")}`);
  console.log("");
  console.log(renderStatus(state));
}

function handleStatus(asJson: boolean): void {
  const state = loadGameState();
  if (asJson) {
    console.log(renderStatusJson(state));
  } else {
    console.log(renderStatus(state));
  }
}

function handleDraw(source?: string): void {
  const state = loadGameState();
  requirePhase(state, "AWAITING_DRAW");

  const player = getAwaitingPlayer(state)!;

  if (source === "stock") {
    if (state.stock.length === 0) {
      throw new Error("Stock is empty!");
    }
    const card = state.stock.shift()!;
    player.hand.push(card);

    logAction(state, player.id, player.name, "drew from stock", renderCard(card));

    // After drawing from stock, May I window opens for the discard
    if (state.discard.length > 0) {
      openMayIWindow(state);
    } else {
      state.harness.phase = "AWAITING_ACTION";
    }

    saveGameState(state);
    console.log(`${player.name} drew ${renderCard(card)} from stock.`);
    console.log("");
    console.log(renderStatus(state));

  } else if (source === "discard") {
    if (state.discard.length === 0) {
      throw new Error("Discard pile is empty!");
    }
    // DOWN players cannot draw from discard (per house rules section 5)
    if (player.isDown) {
      throw new Error(
        "You cannot draw from discard when you are down. Down players may only draw from stock."
      );
    }
    const card = state.discard.shift()!;
    player.hand.push(card);

    logAction(state, player.id, player.name, "drew from discard", renderCard(card));

    state.harness.phase = "AWAITING_ACTION";
    saveGameState(state);

    console.log(`${player.name} took ${renderCard(card)} from discard.`);
    console.log("");
    console.log(renderStatus(state));

  } else {
    throw new Error('Specify source: "draw stock" or "draw discard"');
  }
}

function handleLaydown(meldArgs: string[]): void {
  const state = loadGameState();
  requirePhase(state, "AWAITING_ACTION");

  const player = getAwaitingPlayer(state)!;
  if (player.isDown) {
    throw new Error("Already laid down this round. Use 'layoff' to add cards to melds.");
  }

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

  // Validate positions are in range
  for (const group of meldGroups) {
    for (const pos of group) {
      if (pos < 1 || pos > player.hand.length) {
        throw new Error(`Position ${pos} is out of range (1-${player.hand.length})`);
      }
    }
  }

  // Check for duplicate positions
  const allPositions = meldGroups.flat();
  const uniquePositions = new Set(allPositions);
  if (uniquePositions.size !== allPositions.length) {
    throw new Error("Duplicate card positions in melds");
  }

  // Build melds from positions
  const melds: Meld[] = [];
  for (const group of meldGroups) {
    const cards = group.map((pos) => player.hand[pos - 1]!);

    // Infer meld type
    const nonWildCards = cards.filter((c) => c.rank !== "Joker" && c.rank !== "2");
    let meldType: "set" | "run";
    if (nonWildCards.length === 0) {
      meldType = "set"; // All wilds, default to set
    } else {
      const firstRank = nonWildCards[0]!.rank;
      const allSameRank = nonWildCards.every((c) => c.rank === firstRank);
      meldType = allSameRank ? "set" : "run";
    }

    // Validate the meld
    if (meldType === "set" && !isValidSet(cards)) {
      throw new Error(`Invalid set: ${cards.map(renderCard).join(" ")}`);
    }
    if (meldType === "run" && !isValidRun(cards)) {
      throw new Error(`Invalid run: ${cards.map(renderCard).join(" ")}`);
    }

    melds.push({
      id: `meld-${crypto.randomUUID().slice(0, 8)}`,
      type: meldType,
      cards,
      ownerId: player.id,
    });
  }

  // Validate contract
  const contract = CONTRACTS[state.currentRound];
  const validation = validateContractMelds(contract, melds);
  if (!validation.valid) {
    throw new Error(`Contract not met: ${validation.error}`);
  }

  // Remove cards from hand and add melds to table
  const usedCardIds = new Set(melds.flatMap((m) => m.cards.map((c) => c.id)));
  player.hand = player.hand.filter((c) => !usedCardIds.has(c.id));
  state.table.push(...melds);
  player.isDown = true;

  logAction(state, player.id, player.name, "laid down contract", melds.map((m) => `${m.type}: ${m.cards.map(renderCard).join(" ")}`).join(", "));

  // Check if player went out (hand empty)
  if (player.hand.length === 0) {
    handleWentOut(state, player.id);
  } else {
    state.harness.phase = "AWAITING_DISCARD";
  }

  saveGameState(state);
  console.log(`${player.name} laid down their contract!`);
  for (const meld of melds) {
    console.log(`  ${meld.type}: ${meld.cards.map(renderCard).join(" ")}`);
  }
  console.log("");
  console.log(renderStatus(state));
}

function handleSkip(): void {
  const state = loadGameState();
  requirePhase(state, "AWAITING_ACTION");

  const player = getAwaitingPlayer(state)!;
  logAction(state, player.id, player.name, "skipped laying down");

  state.harness.phase = "AWAITING_DISCARD";
  saveGameState(state);

  console.log(`${player.name} skipped laying down.`);
  console.log("");
  console.log(renderStatus(state));
}

function handleDiscard(positionStr?: string): void {
  const state = loadGameState();
  requirePhase(state, "AWAITING_DISCARD");

  if (!positionStr) {
    throw new Error("Specify position: discard <position>");
  }

  const position = parseInt(positionStr, 10);
  if (isNaN(position)) {
    throw new Error(`Invalid position: ${positionStr}`);
  }

  const player = getAwaitingPlayer(state)!;
  if (position < 1 || position > player.hand.length) {
    throw new Error(`Position ${position} is out of range (1-${player.hand.length})`);
  }

  // Round 6: Cannot discard to go out if down
  if (state.currentRound === 6 && player.isDown && player.hand.length === 1) {
    throw new Error("Round 6: Cannot discard last card when down. Use 'layoff' to play cards or 'stuck' if you can't.");
  }

  const card = player.hand.splice(position - 1, 1)[0]!;
  state.discard.unshift(card);

  logAction(state, player.id, player.name, "discarded", renderCard(card));

  // Check if player went out
  if (player.hand.length === 0) {
    handleWentOut(state, player.id);
  } else {
    // Advance to next player
    advanceToNextPlayer(state);
  }

  saveGameState(state);
  console.log(`${player.name} discarded ${renderCard(card)}.`);
  console.log("");
  console.log(renderStatus(state));
}

function handleLayoff(cardPosStr?: string, meldNumStr?: string): void {
  const state = loadGameState();
  requirePhase(state, "AWAITING_ACTION");

  if (!cardPosStr || !meldNumStr) {
    throw new Error("Specify: layoff <card-position> <meld-number>");
  }

  const cardPos = parseInt(cardPosStr, 10);
  const meldNum = parseInt(meldNumStr, 10);
  if (isNaN(cardPos) || isNaN(meldNum)) {
    throw new Error("Positions must be numbers");
  }

  const player = getAwaitingPlayer(state)!;
  if (!player.isDown) {
    throw new Error("Must lay down contract before laying off cards");
  }

  if (cardPos < 1 || cardPos > player.hand.length) {
    throw new Error(`Card position ${cardPos} is out of range (1-${player.hand.length})`);
  }
  if (meldNum < 1 || meldNum > state.table.length) {
    throw new Error(`Meld number ${meldNum} is out of range (1-${state.table.length})`);
  }

  const card = player.hand[cardPos - 1]!;
  const meld = state.table[meldNum - 1]!;

  // Check if card can be laid off to meld
  let canLayOff = false;
  if (meld.type === "set") {
    canLayOff = canLayOffToSet(card, meld);
  } else {
    canLayOff = canLayOffToRun(card, meld);
  }

  if (!canLayOff) {
    throw new Error(`${renderCard(card)} cannot be added to that ${meld.type}`);
  }

  // Remove from hand and add to meld in correct position
  player.hand.splice(cardPos - 1, 1);
  if (meld.type === "run") {
    const insertPos = getRunInsertPosition(card, meld);
    if (insertPos === "low") {
      meld.cards.unshift(card);
    } else {
      meld.cards.push(card);
    }
  } else {
    meld.cards.push(card);
  }

  logAction(state, player.id, player.name, "laid off", `${renderCard(card)} to meld ${meldNum}`);

  // Check if player went out
  if (player.hand.length === 0) {
    handleWentOut(state, player.id);
  }
  // Stay in AWAITING_ACTION to allow more layoffs

  saveGameState(state);
  console.log(`${player.name} laid off ${renderCard(card)} to meld ${meldNum}.`);
  console.log("");
  console.log(renderStatus(state));
}

function handleMayI(): void {
  const state = loadGameState();
  requirePhase(state, "MAY_I_WINDOW");

  const ctx = state.harness.mayIContext!;
  const player = getAwaitingPlayer(state)!;

  if (player.id === ctx.currentPlayerId) {
    throw new Error("Current player should use 'take' or 'pass', not 'mayi'");
  }

  // DOWN players cannot call May I (per house rules section 7)
  if (player.isDown) {
    throw new Error(
      "You cannot call May I when you are down. Down players cannot draw from the discard pile."
    );
  }

  // Add player to claimants
  ctx.claimants.push(player.id);
  logAction(state, player.id, player.name, "called May I", renderCard(ctx.discardedCard));

  // Move to next player in May I queue
  advanceMayIWindow(state);

  saveGameState(state);
  console.log(`${player.name} called "May I!" for ${renderCard(ctx.discardedCard)}.`);
  console.log("");
  console.log(renderStatus(state));
}

function handleTake(): void {
  const state = loadGameState();
  requirePhase(state, "MAY_I_WINDOW");

  const ctx = state.harness.mayIContext!;
  const player = getAwaitingPlayer(state)!;

  if (player.id !== ctx.currentPlayerId) {
    throw new Error("Only the current player can 'take'. Other players should use 'mayi'.");
  }

  // Current player takes the discard (no penalty)
  const card = state.discard.shift()!;
  player.hand.push(card);

  logAction(state, player.id, player.name, "took discard (vetoed May I)", renderCard(card));

  // Close May I window and proceed to action phase
  state.harness.mayIContext = null;
  state.harness.phase = "AWAITING_ACTION";
  state.harness.awaitingPlayerId = player.id;

  saveGameState(state);
  console.log(`${player.name} took ${renderCard(card)} from discard (vetoing any May I claims).`);
  console.log("");
  console.log(renderStatus(state));
}

function handlePass(): void {
  const state = loadGameState();
  requirePhase(state, "MAY_I_WINDOW");

  const ctx = state.harness.mayIContext!;
  const player = getAwaitingPlayer(state)!;

  logAction(state, player.id, player.name, "passed on May I", renderCard(ctx.discardedCard));

  if (player.id === ctx.currentPlayerId) {
    ctx.currentPlayerPassed = true;
  }

  // Move to next player in May I queue
  advanceMayIWindow(state);

  saveGameState(state);
  console.log(`${player.name} passed.`);
  console.log("");
  console.log(renderStatus(state));
}

function handleContinue(): void {
  const state = loadGameState();
  requirePhase(state, "ROUND_END");

  if (state.currentRound >= 6) {
    state.harness.phase = "GAME_END";
    saveGameState(state);
    console.log("Game complete!");
    console.log("");
    console.log(renderStatus(state));
    return;
  }

  setupNewRound(state);
  logAction(state, "system", "System", "started round", `Round ${state.currentRound}`);

  saveGameState(state);
  console.log(`Starting Round ${state.currentRound}...`);
  console.log("");
  console.log(renderStatus(state));
}

function handleStuck(): void {
  const state = loadGameState();

  if (state.currentRound !== 6) {
    throw new Error("'stuck' command only valid in Round 6");
  }

  const player = getAwaitingPlayer(state)!;
  if (!player.isDown) {
    throw new Error("Must be down to use 'stuck'");
  }
  if (player.hand.length !== 1) {
    throw new Error("Can only use 'stuck' when you have exactly 1 card left");
  }

  logAction(state, player.id, player.name, "ended turn stuck", `with ${renderCard(player.hand[0]!)}`);

  // End turn without discarding
  advanceToNextPlayer(state);

  saveGameState(state);
  console.log(`${player.name} is stuck with ${renderCard(player.hand[0]!)} and ends their turn.`);
  console.log("");
  console.log(renderStatus(state));
}

function handleSwap(meldNumStr?: string, jokerPosStr?: string, cardPosStr?: string): void {
  const state = loadGameState();
  requirePhase(state, "AWAITING_ACTION");

  if (!meldNumStr || !jokerPosStr || !cardPosStr) {
    throw new Error("Specify: swap <meld-number> <joker-position> <card-position>");
  }

  const meldNum = parseInt(meldNumStr, 10);
  const jokerPos = parseInt(jokerPosStr, 10);
  const cardPos = parseInt(cardPosStr, 10);
  if (isNaN(meldNum) || isNaN(jokerPos) || isNaN(cardPos)) {
    throw new Error("All arguments must be numbers");
  }

  const player = getAwaitingPlayer(state)!;

  // Per house rules: can only swap if NOT down yet
  if (player.isDown) {
    throw new Error("Cannot swap Jokers after laying down. You must swap before laying down your contract.");
  }

  if (meldNum < 1 || meldNum > state.table.length) {
    throw new Error(`Meld number ${meldNum} is out of range (1-${state.table.length})`);
  }
  if (cardPos < 1 || cardPos > player.hand.length) {
    throw new Error(`Card position ${cardPos} is out of range (1-${player.hand.length})`);
  }

  const meld = state.table[meldNum - 1]!;
  const swapCard = player.hand[cardPos - 1]!;

  // Check meld is a run
  if (meld.type !== "run") {
    throw new Error("Joker swapping only works on runs, not sets");
  }

  // Find the joker at the specified position
  const positions = identifyJokerPositions(meld);
  const jokerPosition = positions.find((p) => p.positionIndex === jokerPos - 1);
  if (!jokerPosition) {
    throw new Error(`No swappable Joker at position ${jokerPos} in meld ${meldNum}`);
  }

  if (!jokerPosition.isJoker) {
    throw new Error("Only Jokers can be swapped, not 2s (wild but not Joker)");
  }

  // Check if the swap card fits
  if (!canSwapJokerWithCard(meld, jokerPosition.wildCard, swapCard)) {
    throw new Error(
      `${renderCard(swapCard)} cannot replace Joker at position ${jokerPos}. ` +
      `Need ${jokerPosition.actingAsRank}${jokerPosition.actingAsSuit}`
    );
  }

  // Perform the swap
  const jokerCard = jokerPosition.wildCard;

  // Replace joker in meld with swap card
  const jokerIndex = meld.cards.findIndex((c) => c.id === jokerCard.id);
  meld.cards[jokerIndex] = swapCard;

  // Remove swap card from hand and add joker
  player.hand.splice(cardPos - 1, 1);
  player.hand.push(jokerCard);

  logAction(state, player.id, player.name, "swapped Joker", `${renderCard(swapCard)} for Joker from meld ${meldNum}`);

  // Stay in AWAITING_ACTION to allow more actions (like another swap or laydown)
  saveGameState(state);
  console.log(`${player.name} swapped ${renderCard(swapCard)} for Joker from meld ${meldNum}!`);
  console.log(`  Joker added to hand.`);
  console.log("");
  console.log(renderStatus(state));
}

function handleLog(tailArg?: string): void {
  const entries = readActionLog();
  const tail = tailArg ? parseInt(tailArg, 10) : undefined;
  console.log(renderLog(entries, tail));
}

// --- Helper functions ---

function requirePhase(state: PersistedGameState, expected: string): void {
  if (state.harness.phase !== expected) {
    const available = getAvailableCommands(state);
    throw new Error(
      `Invalid command for current phase. Expected: ${expected}, Current: ${state.harness.phase}\n` +
      `Available commands: ${available.commands.join(" | ")}`
    );
  }
}

function logAction(
  state: PersistedGameState,
  playerId: string,
  playerName: string,
  action: string,
  details?: string
): void {
  appendActionLog({
    timestamp: new Date().toISOString(),
    turnNumber: state.harness.turnNumber,
    roundNumber: state.currentRound,
    playerId,
    playerName,
    action,
    details,
  });
}

function openMayIWindow(state: PersistedGameState): void {
  const currentPlayer = getCurrentPlayer(state);
  const discardedCard = state.discard[0]!;

  // Build priority order: all players except current, starting from next player
  const awaitingResponseFrom: string[] = [];
  for (let i = 1; i < state.players.length; i++) {
    const idx = (state.currentPlayerIndex + i) % state.players.length;
    awaitingResponseFrom.push(state.players[idx]!.id);
  }

  state.harness.mayIContext = {
    discardedCard,
    discardedByPlayerId: state.players[(state.currentPlayerIndex - 1 + state.players.length) % state.players.length]!.id,
    currentPlayerId: currentPlayer.id,
    currentPlayerIndex: state.currentPlayerIndex,
    awaitingResponseFrom,
    claimants: [],
    currentPlayerPassed: true, // Current player already drew from stock
  };

  // First in queue is next player (who can take or pass)
  state.harness.phase = "MAY_I_WINDOW";
  state.harness.awaitingPlayerId = awaitingResponseFrom[0]!;
}

function advanceMayIWindow(state: PersistedGameState): void {
  const ctx = state.harness.mayIContext!;

  // Remove current player from awaiting list
  ctx.awaitingResponseFrom.shift();

  if (ctx.awaitingResponseFrom.length === 0) {
    // Everyone has responded - resolve
    resolveMayIWindow(state);
  } else {
    // Move to next player
    state.harness.awaitingPlayerId = ctx.awaitingResponseFrom[0]!;
  }
}

function resolveMayIWindow(state: PersistedGameState): void {
  const ctx = state.harness.mayIContext!;

  if (ctx.claimants.length > 0) {
    // First claimant wins (already in priority order)
    const winnerId = ctx.claimants[0]!;
    const winner = getPlayerById(state, winnerId)!;

    // Winner gets the discard + penalty card from stock
    const discardCard = state.discard.shift()!;
    winner.hand.push(discardCard);

    if (state.stock.length > 0) {
      const penaltyCard = state.stock.shift()!;
      winner.hand.push(penaltyCard);
      logAction(state, winnerId, winner.name, "won May I", `${renderCard(discardCard)} + penalty ${renderCard(penaltyCard)}`);
    } else {
      logAction(state, winnerId, winner.name, "won May I", `${renderCard(discardCard)} (no penalty - stock empty)`);
    }
  } else {
    logAction(state, "system", "System", "May I window closed", "no claims");
  }

  // Close window and proceed to current player's action phase
  state.harness.mayIContext = null;
  state.harness.phase = "AWAITING_ACTION";
  state.harness.awaitingPlayerId = state.players[state.currentPlayerIndex]!.id;
}

function handleWentOut(state: PersistedGameState, winnerId: string): void {
  const winner = getPlayerById(state, winnerId)!;

  logAction(state, winnerId, winner.name, "went out!", "");

  // Calculate scores for all players
  const scores: Record<string, number> = {};
  for (const player of state.players) {
    if (player.id === winnerId) {
      scores[player.id] = 0;
    } else {
      scores[player.id] = calculateHandScore(player.hand);
    }
    // Update total score
    player.totalScore += scores[player.id]!;
  }

  // Add round record
  state.roundHistory.push({
    roundNumber: state.currentRound,
    scores,
    winnerId,
  });

  state.harness.phase = "ROUND_END";
  state.harness.mayIContext = null;
}

function printHelp(): void {
  console.log(`
May I? CLI Harness

Usage: bun harness/play.ts <command> [options]

Commands:
  new                         Start a new 3-player game
  status                      Show current game state
  status --json               Show state as JSON

  draw stock                  Draw from stock pile
  draw discard                Draw from discard pile

  laydown "1,2,3" "4,5,6,7"   Lay down melds (card positions)
  skip                        Skip laying down
  discard <position>          Discard card at position

  layoff <card> <meld>        Lay off card to meld
  swap <meld> <pos> <card>    Swap card for Joker in run (before laying down)
  stuck                       End turn stuck (Round 6 only)

  mayi                        Call May I (non-current player)
  take                        Take discard (current player in May I window)
  pass                        Pass on May I

  continue                    Continue to next round
  log [n]                     Show action log (last n entries)

Examples:
  bun harness/play.ts new
  bun harness/play.ts draw stock
  bun harness/play.ts laydown "1,2,3" "4,5,6,7"
  bun harness/play.ts discard 5
  bun harness/play.ts log 10
`);
}
