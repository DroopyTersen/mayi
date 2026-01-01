#!/usr/bin/env bun
/**
 * May I? Interactive CLI
 *
 * A human-friendly interactive terminal game for May I?
 * Uses numbered menus and conversation-style output.
 */

import * as readline from "readline";
import { CliGameAdapter } from "../shared/cli-game-adapter";
import { renderCard, renderHand, renderNumberedHand, renderHandGroupedBySuit } from "../shared/cli.renderer";
import type { GameSnapshot } from "../../core/engine/game-engine.types";
import type { Player, RoundNumber } from "../../core/engine/engine.types";
import type { Card } from "../../core/card/card.types";
import type { Meld } from "../../core/meld/meld.types";
import { canLayOffToSet, canLayOffToRun } from "../../core/engine/layoff";
import { canPlayerCallMayI } from "../../core/engine/game-engine.availability";
import { listSavedGames, readActionLog, formatGameDate, saveAIPlayerConfigs, loadAIPlayerConfigs } from "../shared/cli.persistence";
import { formatRecentActivity } from "../shared/cli.activity";
import { sortHandByRank, sortHandBySuit, moveCard } from "../../core/engine/hand.reordering";
import { AIPlayerRegistry, setupGameWithAI } from "../../ai/aiPlayer.registry";
import { executeAITurn } from "../../ai/mayIAgent";
import type { AIPlayerConfig } from "../../ai/aiPlayer.types";
import type { ModelId } from "../../ai/modelRegistry";
import type { DecisionPhase } from "../shared/cli.types";

// Track the current game ID for persistence
let currentGameId: string = "";

// AI player registry for the current game
// Enable devtools middleware to capture AI runs (view at http://localhost:4983)
const aiRegistry = new AIPlayerRegistry().enableDevTools();

/**
 * First names for AI players
 */
const AI_FIRST_NAMES = ["Alice", "Bob", "Charlie", "Diana", "Eve", "Frank", "Grace"];

/**
 * Available AI models for player selection
 */
const MODEL_OPTIONS: readonly { id: ModelId; name: string; provider: string }[] = [
  { id: "default:grok", name: "Grok", provider: "xAI" },
  { id: "default:claude", name: "Claude", provider: "Anthropic" },
  { id: "default:openai", name: "GPT", provider: "OpenAI" },
  { id: "default:gemini", name: "Gemini", provider: "Google" },
];

const DEFAULT_MODEL_INDEX = 0; // Grok is default (fastest)

/**
 * Get the display name for a model ID from MODEL_OPTIONS
 */
function getModelDisplayName(modelId: ModelId): string {
  const option = MODEL_OPTIONS.find((opt) => opt.id === modelId);
  return option?.name ?? "AI";
}

/**
 * Create AI player configs with random first names and model-based last names
 * Each player can have a different model
 */
function createAIPlayerConfigs(modelIds: ModelId[]): AIPlayerConfig[] {
  const shuffledNames = [...AI_FIRST_NAMES].sort(() => Math.random() - 0.5);

  return modelIds.map((modelId, index) => {
    const lastName = getModelDisplayName(modelId);
    const firstName = shuffledNames[index] ?? `Player${index + 1}`;
    return {
      name: `${firstName} ${lastName}`,
      modelId,
    };
  });
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const game = new CliGameAdapter();

// Player 0 is always the human player ("You")
const HUMAN_PLAYER_ID = "player-0";

function getDecisionPhase(state: GameSnapshot): DecisionPhase {
  if (state.phase === "RESOLVING_MAY_I") return "RESOLVING_MAY_I";
  if (state.phase === "GAME_END") return "GAME_END";
  if (state.phase === "ROUND_END") return "ROUND_END";
  return state.turnPhase;
}

async function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function promptNumber(question: string, min: number, max: number): Promise<number> {
  while (true) {
    const answer = await prompt(question);
    const num = parseInt(answer, 10);
    if (!isNaN(num) && num >= min && num <= max) {
      return num;
    }
    console.log(`Invalid choice. Please enter a number ${min}-${max}.`);
  }
}

/**
 * Prompt user to select an AI model for a player
 */
async function promptModelSelection(playerNumber: number): Promise<ModelId> {
  const defaultModel = MODEL_OPTIONS[DEFAULT_MODEL_INDEX];
  if (!defaultModel) {
    throw new Error("No default model configured");
  }

  console.log("");
  console.log(`Select model for AI Player ${playerNumber}:`);
  console.log("");
  for (let i = 0; i < MODEL_OPTIONS.length; i++) {
    const opt = MODEL_OPTIONS[i];
    if (!opt) continue;
    const defaultLabel = i === DEFAULT_MODEL_INDEX ? " ← default" : "";
    console.log(`  ${i + 1}. ${opt.name} (${opt.provider})${defaultLabel}`);
  }
  console.log("");

  const answer = await prompt("> ");
  const num = parseInt(answer, 10);

  // Valid selection
  if (!isNaN(num) && num >= 1 && num <= MODEL_OPTIONS.length) {
    const selected = MODEL_OPTIONS[num - 1];
    if (selected) {
      return selected.id;
    }
  }

  // Empty or invalid input = use default
  if (answer.trim() !== "") {
    console.log(`Invalid choice, using default (${defaultModel.name}).`);
  }
  return defaultModel.id;
}

function clearScreen(): void {
  console.clear();
}

function printHeader(state: GameSnapshot): void {
  console.log("═".repeat(66));
  console.log(centerText(`MAY I? — Round ${state.currentRound} of 6`, 66));
  console.log(centerText(formatContract(state.contract), 66));
  if (state.currentRound === 6) {
    console.log(centerText("⚠️  No discard to go out this round!", 66));
  }
  console.log("═".repeat(66));
  console.log("");
}

function printPlayers(state: GameSnapshot): void {
  console.log("PLAYERS");
  for (let i = 0; i < state.players.length; i++) {
    const player = state.players[i]!;
    const isCurrentTurn = i === state.currentPlayerIndex;
    const indicator = isCurrentTurn ? "→ " : "  ";
    const isHuman = i === 0;
    const name = isHuman ? "You" : player.name;
    const downStatus = player.isDown ? " ✓ DOWN" : "";
    // Only show cumulative score for human player - showing for others is confusing
    const scoreStr = isHuman && player.totalScore > 0 ? ` (${player.totalScore} pts)` : "";
    console.log(`${indicator}${name}: ${player.hand.length} cards${downStatus}${scoreStr}`);
  }
  console.log("");
}

function printTable(state: GameSnapshot): void {
  console.log("TABLE");
  if (state.table.length === 0) {
    console.log("  No melds yet.");
  } else {
    const meldsByOwner = groupMeldsByOwner(state.table, state.players);
    let meldNumber = 1;
    for (const [ownerId, melds] of Object.entries(meldsByOwner)) {
      const owner = state.players.find((p) => p.id === ownerId);
      const ownerName = owner?.id === HUMAN_PLAYER_ID ? "Your" : `${owner?.name}'s`;
      console.log(`  ${ownerName} melds:`);
      for (const meld of melds) {
        const typeLabel = meld.type === "set" ? "Set" : "Run";
        const cardsStr = meld.cards.map(renderCard).join(" ");
        console.log(`    [${meldNumber}] ${typeLabel}: ${cardsStr}`);
        meldNumber++;
      }
    }
  }
  console.log("");
}

function printRecentActivity(): void {
  const entries = readActionLog(currentGameId);
  const recentLines = formatRecentActivity(entries, 6);

  if (recentLines.length === 0) {
    return; // Don't show section if no activity yet
  }

  console.log("RECENT ACTIVITY");
  for (const line of recentLines) {
    console.log(`  ${line}`);
  }
  console.log("");
}

function printDiscard(state: GameSnapshot): void {
  const topDiscard = state.discard[0];
  const discardStr = topDiscard ? renderCard(topDiscard) : "(empty)";
  console.log(`DISCARD: ${discardStr} (${state.discard.length} in pile) | STOCK: ${state.stock.length} cards`);
  console.log("");
}

function printHand(player: Player, numbered: boolean = false): void {
  console.log(`Your hand: ${numbered ? renderNumberedHand(player.hand) : renderHand(player.hand)}`);
}

function printDivider(): void {
  console.log("─".repeat(66));
}

function centerText(text: string, width: number): string {
  const padding = Math.max(0, Math.floor((width - text.length) / 2));
  return " ".repeat(padding) + text;
}

function formatContract(contract: { sets: number; runs: number }): string {
  const parts: string[] = [];
  if (contract.sets > 0) {
    parts.push(`${contract.sets} set${contract.sets > 1 ? "s" : ""}`);
  }
  if (contract.runs > 0) {
    parts.push(`${contract.runs} run${contract.runs > 1 ? "s" : ""}`);
  }
  return parts.join(" + ");
}

function groupMeldsByOwner(melds: Meld[], players: Player[]): Record<string, Meld[]> {
  const result: Record<string, Meld[]> = {};
  for (const meld of melds) {
    if (!result[meld.ownerId]) {
      result[meld.ownerId] = [];
    }
    result[meld.ownerId]!.push(meld);
  }
  return result;
}

function printGameView(state: GameSnapshot): void {
  clearScreen();
  printHeader(state);
  printPlayers(state);
  printTable(state);
  printRecentActivity();
  printDiscard(state);
  // Always show the human player's hand
  const human = state.players.find((p) => p.id === HUMAN_PLAYER_ID);
  if (human) {
    console.log("");
    console.log(`YOUR HAND: ${renderHand(human.hand)}`);
  }
  printDivider();
  console.log("");
}

function getHumanPlayer(state: GameSnapshot): Player {
  return state.players.find((p) => p.id === HUMAN_PLAYER_ID)!;
}

async function handleHumanDraw(state: GameSnapshot): Promise<void> {
  const human = getHumanPlayer(state);
  printHand(human);
  console.log("");
  console.log("It's your turn. What would you like to do?");
  console.log("");
  console.log("  1. Draw from the stock pile");
  if (state.discard.length > 0 && !human.isDown) {
    console.log(`  2. Take the ${renderCard(state.discard[0]!)} from the discard`);
  }
  console.log("  ─────────────────────────────────");
  console.log("  3. Organize your hand");
  console.log("");

  const max = state.discard.length > 0 && !human.isDown ? 3 : 3;
  const choice = await promptNumber("> ", 1, max);

  if (choice === 1) {
    game.drawFromStock();
    console.log("");
    console.log(`You drew the ${getDrawnCard()} from the stock.`);
  } else if (choice === 2 && state.discard.length > 0) {
    const discardCard = state.discard[0]!; // Capture before drawing
    game.drawFromDiscard();
    console.log("");
    console.log(`You took the ${renderCard(discardCard)} from the discard.`);
  } else if (choice === 3) {
    await handleOrganizeHand(state);
  }
}

function getDrawnCard(): string {
  // The card that was just drawn is the last card in the player's hand
  const human = getHumanPlayer(game.getSnapshot());
  return renderCard(human.hand[human.hand.length - 1]!);
}

async function handleHumanAction(state: GameSnapshot): Promise<void> {
  const human = getHumanPlayer(state);
  printHand(human);
  console.log("");
  console.log("What would you like to do?");
  console.log("");

  const options: Array<{ num: number; label: string; action: string }> = [];
  let optNum = 1;

  if (!human.isDown) {
    options.push({ num: optNum++, label: "Lay down your contract", action: "laydown" });
    // Check for joker swaps
    const hasSwappableJokers = state.table.some(
      (m) => m.type === "run" && m.cards.some((c) => c.rank === "Joker")
    );
    if (hasSwappableJokers) {
      options.push({ num: optNum++, label: "Swap a Joker from a run on the table", action: "swap" });
    }
  }

  if (human.isDown) {
    options.push({ num: optNum++, label: "Lay off cards onto table melds", action: "layoff" });
  }

  options.push({ num: optNum++, label: "Discard a card to end your turn", action: "discard" });

  for (const opt of options) {
    console.log(`  ${opt.num}. ${opt.label}`);
  }

  console.log("  ─────────────────────────────────");
  const organizeNum = optNum;
  console.log(`  ${organizeNum}. Organize your hand`);
  console.log("");

  const choice = await promptNumber("> ", 1, organizeNum);

  if (choice === organizeNum) {
    await handleOrganizeHand(state);
    return;
  }

  const selected = options.find((o) => o.num === choice);
  if (!selected) return;

  switch (selected.action) {
    case "laydown":
      await handleLaydown(state);
      break;
    case "layoff":
      await handleLayoff(state);
      break;
    case "discard":
      {
        // If we're in AWAITING_ACTION, skip first to move to AWAITING_DISCARD
        const currentState = game.getSnapshot();
        if (getDecisionPhase(currentState) === "AWAITING_ACTION") {
          game.skip();
        }
        await handleDiscard(game.getSnapshot());
      }
      break;
    case "swap":
      await handleSwap(state);
      break;
  }
}

async function handleLaydown(state: GameSnapshot): Promise<void> {
  const human = getHumanPlayer(state);
  console.log("");
  console.log("You chose to lay down. Build your melds:");
  console.log("");
  printHand(human, true);
  console.log("");
  console.log(`Contract requires: ${formatContract(state.contract)}`);
  console.log("");

  const meldGroups: number[][] = [];

  // Collect sets
  for (let i = 0; i < state.contract.sets; i++) {
    console.log(`Enter cards for your SET ${i + 1} (e.g., "1 2 3"):`);
    const input = await prompt("> ");
    const positions = input.split(/[\s,]+/).map((s) => parseInt(s, 10));
    if (positions.some(isNaN)) {
      console.log("Invalid input. Please enter numbers separated by spaces.");
      i--;
      continue;
    }
    meldGroups.push(positions);
    console.log("");
  }

  // Collect runs
  for (let i = 0; i < state.contract.runs; i++) {
    console.log(`Enter cards for your RUN ${i + 1} (e.g., "4 5 6 7"):`);
    const input = await prompt("> ");
    const positions = input.split(/[\s,]+/).map((s) => parseInt(s, 10));
    if (positions.some(isNaN)) {
      console.log("Invalid input. Please enter numbers separated by spaces.");
      i--;
      continue;
    }
    meldGroups.push(positions);
    console.log("");
  }

  const after = game.layDown(meldGroups);
  if (!after.lastError) {
    console.log("");
    console.log("You laid down your contract!");
  } else {
    console.log("");
    console.log(`Error: ${after.lastError}`);
    await prompt("Press Enter to continue...");
  }
}

async function handleLayoff(state: GameSnapshot): Promise<void> {
  const human = getHumanPlayer(state);
  console.log("");
  printHand(human, true);
  console.log("");

  const cardPos = await promptNumber(`Lay off which card? (1-${human.hand.length}) `, 1, human.hand.length);
  const card = human.hand[cardPos - 1]!;

  console.log("");
  console.log(`You're laying off ${renderCard(card)}. Which meld?`);
  console.log("");

  // Show melds with fit indicators
  for (let i = 0; i < state.table.length; i++) {
    const meld = state.table[i]!;
    const owner = state.players.find((p) => p.id === meld.ownerId);
    const ownerName = owner?.id === HUMAN_PLAYER_ID ? "Your" : `${owner?.name}'s`;
    const typeLabel = meld.type === "set" ? "Set" : "Run";
    const cardsStr = meld.cards.map(renderCard).join(" ");
    const fits =
      meld.type === "set" ? canLayOffToSet(card, meld) : canLayOffToRun(card, meld);
    const fitIndicator = fits ? " ← fits here!" : "";
    console.log(`  [${i + 1}] ${ownerName} ${typeLabel}: ${cardsStr}${fitIndicator}`);
  }
  console.log("");

  const meldNum = await promptNumber(`> `, 1, state.table.length);

  const after = game.layOff(cardPos, meldNum);
  if (!after.lastError) {
    console.log("");
    console.log("Laid off.");
  } else {
    console.log("");
    console.log(`Error: ${after.lastError}`);
    await prompt("Press Enter to continue...");
  }
}

async function handleDiscard(state: GameSnapshot): Promise<void> {
  while (true) {
    // Get fresh state each iteration
    const currentState = game.getSnapshot();
    const human = getHumanPlayer(currentState);

    console.log("");
    printHand(human, true);
    console.log("");
    console.log("Discard a card to end your turn:");
    console.log("");
    console.log(`  1-${human.hand.length}. Select a card to discard`);
    console.log("  ─────────────────────────────────");
    console.log(`  ${human.hand.length + 1}. Organize your hand`);
    console.log("");

    const choice = await promptNumber("> ", 1, human.hand.length + 1);

    if (choice === human.hand.length + 1) {
      await handleOrganizeHand(currentState);
      continue;
    }

    const card = human.hand[choice - 1]!;
    const after = game.discardCard(choice);
    if (!after.lastError) {
      console.log("");
      console.log(`You discarded ${renderCard(card)}.`);
    } else {
      console.log("");
      console.log(`Error: ${after.lastError}`);
    }
    break;
  }
}

async function handleSwap(state: GameSnapshot): Promise<void> {
  const human = getHumanPlayer(state);
  console.log("");
  printHand(human, true);
  console.log("");

  const cardPos = await promptNumber(`Which card will replace the Joker? (1-${human.hand.length}) `, 1, human.hand.length);
  const cardToSwap = human.hand[cardPos - 1]!; // Capture before swap modifies hand

  console.log("");
  console.log("Runs with Jokers:");
  const jokerRuns: number[] = [];
  for (let i = 0; i < state.table.length; i++) {
    const meld = state.table[i]!;
    if (meld.type === "run" && meld.cards.some((c) => c.rank === "Joker")) {
      jokerRuns.push(i);
      const owner = state.players.find((p) => p.id === meld.ownerId);
      const ownerName = owner?.id === HUMAN_PLAYER_ID ? "Your" : `${owner?.name}'s`;
      const cardsStr = meld.cards.map(renderCard).join(" ");
      console.log(`  [${i + 1}] ${ownerName} Run: ${cardsStr}`);
    }
  }
  console.log("");

  const meldNum = await promptNumber(`Which run? `, 1, state.table.length);

  // Find joker position in the meld
  const meld = state.table[meldNum - 1]!;
  const jokerIdx = meld.cards.findIndex((c) => c.rank === "Joker");

  const after = game.swap(meldNum, jokerIdx + 1, cardPos);
  if (!after.lastError) {
    console.log("");
    console.log(`Swapped! You gave ${renderCard(cardToSwap)} and took the Joker.`);
  } else {
    console.log("");
    console.log(`Error: ${after.lastError}`);
    await prompt("Press Enter to continue...");
  }
}

async function handleOrganizeHand(_state: GameSnapshot): Promise<void> {
  while (true) {
    // Get fresh state each iteration
    const currentState = game.getSnapshot();
    const human = getHumanPlayer(currentState);

    console.log("");
    console.log("Your hand: " + renderHand(human.hand));
    console.log("");
    console.log("Organize your hand:");
    console.log("");
    console.log("  1. Sort by rank (3 4 5 ... 10 J Q K A, wilds at end)");
    console.log("  2. Sort by suit (♠ ♥ ♦ ♣, wilds at end)");
    console.log("  3. Move a card");
    console.log("  4. Done organizing");
    console.log("");

    const choice = await promptNumber("> ", 1, 4);

    if (choice === 1) {
      // Sort by rank
      const sorted = sortHandByRank(human.hand);
      game.reorderHand(HUMAN_PLAYER_ID, sorted.map((c) => c.id));
      console.log("");
      console.log("Hand sorted by rank.");
    } else if (choice === 2) {
      // Sort by suit
      const sorted = sortHandBySuit(human.hand);
      game.reorderHand(HUMAN_PLAYER_ID, sorted.map((c) => c.id));
      console.log("");
      console.log("Hand sorted by suit.");
      console.log("");
      console.log("Your hand: " + renderHandGroupedBySuit(sorted));
    } else if (choice === 3) {
      // Move a card
      console.log("");
      console.log("Your hand: " + renderNumberedHand(human.hand));
      console.log("");

      const fromPos = await promptNumber(`Move which card? (1-${human.hand.length}) `, 1, human.hand.length);
      const card = human.hand[fromPos - 1]!;

      const toPos = await promptNumber(`Move ${renderCard(card)} to which position? (1-${human.hand.length}) `, 1, human.hand.length);

      // moveCard uses 0-indexed positions
      const result = moveCard(human.hand, fromPos - 1, toPos - 1);
      if (result.success) {
        game.reorderHand(HUMAN_PLAYER_ID, result.hand.map((c) => c.id));
        console.log("");
        console.log(`Moved ${renderCard(card)} to position ${toPos}.`);
      } else {
        console.log("");
        console.log(`Error: ${result.error}`);
      }
    } else {
      // Done organizing
      break;
    }
  }
}

async function resolveMayIIfNeeded(): Promise<void> {
  while (game.getSnapshot().phase === "RESOLVING_MAY_I") {
    const state = game.getSnapshot();
    const ctx = state.mayIContext;
    const awaitingPlayer = state.players.find((p) => p.id === state.awaitingPlayerId);
    if (!ctx || !awaitingPlayer) {
      return;
    }

    if (awaitingPlayer.id === HUMAN_PLAYER_ID) {
      console.log("");
      console.log(`MAY I? — ${renderCard(ctx.cardBeingClaimed)}`);
      console.log("");
      console.log("  1. Allow");
      console.log("  2. Claim");
      console.log("");

      const choice = await promptNumber("> ", 1, 2);
      if (choice === 1) {
        game.allowMayI();
        console.log("");
        console.log("You allowed.");
      } else {
        game.claimMayI();
        console.log("");
        console.log("You claimed the discard.");
      }

      continue;
    }

    if (aiRegistry.isAI(awaitingPlayer.id)) {
      const result = await executeAITurn({
        game,
        playerId: awaitingPlayer.id,
        registry: aiRegistry,
        debug: false,
      });

      if (!result.success) {
        // Conservative fallback: allow
        game.allowMayI(awaitingPlayer.id);
      }
      continue;
    }

    // Non-AI fallback: allow
    game.allowMayI(awaitingPlayer.id);
  }
}

async function maybeOfferHumanMayI(state: GameSnapshot): Promise<void> {
  // UI-specific: only prompt during draw phase when it's not human's turn
  if (state.turnPhase !== "AWAITING_DRAW") return;
  if (state.awaitingPlayerId === HUMAN_PLAYER_ID) return;

  // Engine-level check for May I eligibility (phase, discard, not down, didn't discard)
  if (!canPlayerCallMayI(state, HUMAN_PLAYER_ID)) return;

  const topDiscard = state.discard[0];
  if (!topDiscard) return; // Satisfies TypeScript, already checked by canPlayerCallMayI

  console.log("");
  console.log(`May I? (${renderCard(topDiscard)} + penalty card)`);
  console.log("");
  console.log("  1. Yes, May I!");
  console.log("  2. No thanks");
  console.log("");

  const choice = await promptNumber("> ", 1, 2);
  if (choice !== 1) return;

  const before = game.getSnapshot();
  game.callMayI(HUMAN_PLAYER_ID);
  await resolveMayIIfNeeded();

  const after = game.getSnapshot();
  if (after.phase === "RESOLVING_MAY_I") {
    return;
  }

  const humanAfter = after.players.find((p) => p.id === HUMAN_PLAYER_ID);
  const humanBefore = before.players.find((p) => p.id === HUMAN_PLAYER_ID);
  if (humanBefore && humanAfter && humanAfter.hand.length > humanBefore.hand.length) {
    console.log("");
    console.log("✅ You won May I.");
  } else {
    console.log("");
    console.log("❌ You did not win May I.");
  }
}

async function handleAITurn(state: GameSnapshot): Promise<void> {
  let currentState = state;
  await maybeOfferHumanMayI(currentState);
  currentState = game.getSnapshot();

  const currentPlayer = currentState.players[currentState.currentPlayerIndex]!;
  console.log("");
  console.log(`${currentPlayer.name} is thinking...`);

  // Use the real AI agent if this player is registered
  if (aiRegistry.isAI(currentPlayer.id)) {
    const result = await executeAITurn({
      game,
      playerId: currentPlayer.id,
      registry: aiRegistry,
      debug: false,
    });

    if (!result.success) {
      console.log(`AI error: ${result.error}`);
      // Fallback to simple behavior
      await handleSimpleAITurn(state);
      return;
    }

    // Show what the AI did
    if (result.actions.length > 0) {
      const lastAction = result.actions[result.actions.length - 1];
      console.log(`${currentPlayer.name} completed their turn.`);
    }

    await resolveMayIIfNeeded();
  } else {
    // Fallback for non-AI players (shouldn't happen normally)
    await handleSimpleAITurn(state);
  }
}

/**
 * Simple fallback AI behavior (draw, skip, discard first card)
 */
async function handleSimpleAITurn(state: GameSnapshot): Promise<void> {
  const currentPlayer = state.players[state.currentPlayerIndex]!;

  if (getDecisionPhase(state) === "AWAITING_DRAW") {
    game.drawFromStock();
    await resolveMayIIfNeeded();
  }

  const afterDraw = game.getSnapshot();
  if (getDecisionPhase(afterDraw) === "AWAITING_ACTION") {
    game.skip();
  }

  const afterSkip = game.getSnapshot();
  if (getDecisionPhase(afterSkip) === "AWAITING_DISCARD") {
    const player = afterSkip.players[afterSkip.currentPlayerIndex]!;
    const discardedCard = player.hand[0]!;
    game.discardCard(1);
    console.log(`${currentPlayer.name} drew from stock. Discarded ${renderCard(discardedCard)}.`);
  }
}

async function handleRoundEnd(state: GameSnapshot): Promise<void> {
  const lastRecord = state.roundHistory[state.roundHistory.length - 1];
  if (!lastRecord) return;

  const winner = state.players.find((p) => p.id === lastRecord.winnerId);
  const winnerName = winner?.id === HUMAN_PLAYER_ID ? "You" : winner?.name;

  console.log("");
  console.log(`🎉 ${winnerName} ${winnerName === "You" ? "go" : "goes"} out!`);
  console.log("");
  printDivider();
  console.log("");
  console.log(`ROUND ${state.currentRound} COMPLETE`);
  console.log("");

  for (const player of state.players) {
    const score = lastRecord.scores[player.id] ?? 0;
    const name = player.id === HUMAN_PLAYER_ID ? "You" : player.name;
    const indicator = player.id === lastRecord.winnerId ? " ⭐ (went out)" : "";
    console.log(`  ${name}: ${score} points${indicator}`);
  }

  console.log("");
  printDivider();
  console.log("");
  console.log(`STANDINGS AFTER ROUND ${state.currentRound}`);
  console.log("");

  const sorted = [...state.players].sort((a, b) => a.totalScore - b.totalScore);
  for (let i = 0; i < sorted.length; i++) {
    const player = sorted[i]!;
    const name = player.id === HUMAN_PLAYER_ID ? "You" : player.name;
    console.log(`  ${i + 1}. ${name} — ${player.totalScore} points`);
  }

  console.log("");
  await prompt("Press Enter to continue to next round...");
}

async function handleGameEnd(state: GameSnapshot): Promise<void> {
  console.log("");
  console.log("═".repeat(66));
  console.log("");
  console.log(centerText("🏆 GAME OVER 🏆", 66));
  console.log("");
  console.log(centerText("FINAL STANDINGS", 66));
  console.log("");

  const sorted = [...state.players].sort((a, b) => a.totalScore - b.totalScore);
  const medals = ["🥇", "🥈", "🥉"];

  for (let i = 0; i < sorted.length; i++) {
    const player = sorted[i]!;
    const name = player.id === HUMAN_PLAYER_ID ? "You" : player.name;
    const medal = medals[i] ?? `${i + 1}.`;
    console.log(`  ${medal}  ${name} — ${player.totalScore} points`);
  }

  const winner = sorted[0]!;
  const winnerName = winner.id === HUMAN_PLAYER_ID ? "You win" : `${winner.name} wins`;
  console.log("");
  console.log(centerText(`${winnerName}! Congratulations!`, 66));
  console.log("");
  console.log("═".repeat(66));
  console.log("");

  console.log("  1. Play again");
  console.log("  2. Quit");
  console.log("");

  const choice = await promptNumber("> ", 1, 2);
  if (choice === 1) {
    await startNewGame();
  } else {
    console.log("");
    console.log("Thanks for playing!");
    rl.close();
    process.exit(0);
  }
}

async function startNewGame(): Promise<void> {
  // Ask for player count
  console.log("");
  console.log("How many players? (3-8, default: 3)");
  let playerCountAnswer = await prompt("> ");
  let playerCount = 3;
  if (playerCountAnswer.trim() !== "") {
    const parsed = parseInt(playerCountAnswer, 10);
    if (parsed >= 3 && parsed <= 8) {
      playerCount = parsed;
    }
  }

  // Ask for starting round
  console.log("");
  console.log("Start at which round? (1-6, default: 1)");
  const roundAnswer = await prompt("> ");
  let startingRound: RoundNumber = 1;
  if (roundAnswer.trim() !== "") {
    const parsed = parseInt(roundAnswer, 10);
    if (parsed >= 1 && parsed <= 6) {
      startingRound = parsed as RoundNumber;
    }
  }

  // Prompt for each AI player's model
  const aiCount = playerCount - 1;
  const modelIds: ModelId[] = [];
  for (let i = 0; i < aiCount; i++) {
    const modelId = await promptModelSelection(i + 1);
    modelIds.push(modelId);
  }

  // Create AI player configs with per-player models
  const aiPlayers = createAIPlayerConfigs(modelIds);

  // Setup game with human + AI players
  const playerNames = setupGameWithAI(
    { humanName: "You", aiPlayers },
    aiRegistry
  );

  const state = game.newGame({ playerNames, startingRound });
  currentGameId = state.gameId;

  // Persist AI player configs so they can be restored on resume
  const persistedAIPlayers = aiPlayers.map((config, index) => ({
    playerId: `player-${index + 1}`,
    config,
  }));
  saveAIPlayerConfigs(currentGameId, persistedAIPlayers);

  console.log("");
  const roundMsg = startingRound > 1 ? ` (starting at Round ${startingRound})` : "";
  console.log(`Starting a new game of May I?${roundMsg} (Game ID: ${currentGameId})`);
  const aiNames = aiPlayers.map((p) => p.name).join(", ");
  console.log(`You're playing against ${aiNames}.`);
  console.log("");
  await prompt("Press Enter to begin...");
}

async function resumeGame(gameId: string): Promise<void> {
  game.loadGame(gameId);
  currentGameId = gameId;
  const state = game.getSnapshot();
  console.log("");
  console.log(`Resuming game ${gameId} — Round ${state.currentRound} of 6`);

  // Restore AI player configs from persisted file
  const persistedAIPlayers = loadAIPlayerConfigs(gameId);

  if (persistedAIPlayers.length > 0) {
    // Auto-register AI players from saved configs
    aiRegistry.clear();
    for (const { playerId, config } of persistedAIPlayers) {
      aiRegistry.register(playerId, config);
    }
    const modelNames = persistedAIPlayers.map((p) => {
      const modelOpt = MODEL_OPTIONS.find((m) => m.id === p.config.modelId);
      return modelOpt?.name ?? p.config.modelId;
    });
    console.log(`AI players restored: ${modelNames.join(", ")}`);
  } else {
    // Legacy game without AI config - prompt user to select models
    const aiPlayerCount = state.players.length - 1;
    if (aiPlayerCount > 0) {
      console.log("");
      console.log("No saved AI config found. Select AI models for each player:");

      aiRegistry.clear();
      for (let i = 0; i < aiPlayerCount; i++) {
        const player = state.players[i + 1]!;
        const playerId = `player-${i + 1}`;

        console.log("");
        console.log(`${player.name}:`);
        for (let j = 0; j < MODEL_OPTIONS.length; j++) {
          const opt = MODEL_OPTIONS[j];
          if (!opt) continue;
          const defaultLabel = j === DEFAULT_MODEL_INDEX ? " ← default" : "";
          console.log(`  ${j + 1}. ${opt.name} (${opt.provider})${defaultLabel}`);
        }

        const answer = await prompt("> ");
        const num = parseInt(answer, 10);

        let modelId: ModelId;
        if (!isNaN(num) && num >= 1 && num <= MODEL_OPTIONS.length && MODEL_OPTIONS[num - 1]) {
          modelId = MODEL_OPTIONS[num - 1]!.id;
        } else {
          modelId = MODEL_OPTIONS[DEFAULT_MODEL_INDEX]!.id;
        }

        aiRegistry.register(playerId, { name: player.name, modelId });
      }

      // Save the configs for future resumes
      const newPersistedPlayers = Array.from({ length: aiPlayerCount }, (_, i) => ({
        playerId: `player-${i + 1}`,
        config: {
          name: state.players[i + 1]!.name,
          modelId: aiRegistry.getModelId(`player-${i + 1}`)!,
        },
      }));
      saveAIPlayerConfigs(gameId, newPersistedPlayers);
    }
  }

  console.log("");
  await prompt("Press Enter to continue...");
}

async function gameLoop(): Promise<void> {
  while (true) {
    const state = game.getSnapshot();

    printGameView(state);

    const isHumanTurn = state.awaitingPlayerId === HUMAN_PLAYER_ID;
    const phase = getDecisionPhase(state);

    switch (phase) {
      case "AWAITING_DRAW":
        if (isHumanTurn) {
          await handleHumanDraw(state);
        } else {
          await handleAITurn(state);
        }
        break;

      case "AWAITING_ACTION":
        if (isHumanTurn) {
          await handleHumanAction(state);
        } else {
          await handleAITurn(state);
        }
        break;

      case "AWAITING_DISCARD":
        if (isHumanTurn) {
          await handleDiscard(state);
        } else {
          await handleAITurn(state);
        }
        break;

      case "RESOLVING_MAY_I":
        await resolveMayIIfNeeded();
        break;

      case "ROUND_END":
        await handleRoundEnd(state);
        break;

      case "GAME_END":
        await handleGameEnd(state);
        break;
    }

    // Small delay between turns for readability
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

async function main(): Promise<void> {
  console.clear();
  console.log("");
  console.log("═".repeat(66));
  console.log(centerText("Welcome to May I?", 66));
  console.log("═".repeat(66));
  console.log("");
  console.log("May I? is a rummy-style card game where you collect sets and runs");
  console.log("to meet your contract each round. First player to go out wins the round.");
  console.log("Lowest total score after 6 rounds wins the game!");
  console.log("");

  const savedGames = listSavedGames();

  if (savedGames.length > 0) {
    console.log("Saved games found:");
    console.log("");
    for (let i = 0; i < savedGames.length; i++) {
      const game = savedGames[i]!;
      const dateStr = formatGameDate(game.updatedAt);
      console.log(`  ${i + 1}. ${game.id} — Round ${game.currentRound}/6 (${dateStr})`);
    }
    console.log("");
    console.log(`  ${savedGames.length + 1}. Start new game`);
    console.log("");

    const choice = await promptNumber("> ", 1, savedGames.length + 1);
    if (choice <= savedGames.length) {
      await resumeGame(savedGames[choice - 1]!.id);
    } else {
      await startNewGame();
    }
  } else {
    await startNewGame();
  }

  await gameLoop();
}

main().catch((err) => {
  console.error("Error:", err);
  rl.close();
  process.exit(1);
});
