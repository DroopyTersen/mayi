#!/usr/bin/env bun
/**
 * May I? Interactive CLI
 *
 * A human-friendly interactive terminal game for May I?
 * Uses numbered menus and conversation-style output.
 */

import * as readline from "readline";
import { Orchestrator } from "./orchestrator";
import { renderCard, renderHand, renderNumberedHand } from "../cli/cli.renderer";
import type { GameStateView } from "./orchestrator";
import type { Player } from "../core/engine/engine.types";
import type { Card } from "../core/card/card.types";
import type { Meld } from "../core/meld/meld.types";
import { canLayOffToSet, canLayOffToRun } from "../core/engine/layoff";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const orchestrator = new Orchestrator();

// Player 0 is always the human player ("You")
const HUMAN_PLAYER_ID = "player-0";

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

function clearScreen(): void {
  console.clear();
}

function printHeader(state: GameStateView): void {
  console.log("═".repeat(66));
  console.log(centerText(`MAY I? — Round ${state.currentRound} of 6`, 66));
  console.log(centerText(formatContract(state.contract), 66));
  if (state.currentRound === 6) {
    console.log(centerText("⚠️  No discard to go out this round!", 66));
  }
  console.log("═".repeat(66));
  console.log("");
}

function printPlayers(state: GameStateView): void {
  console.log("PLAYERS");
  for (let i = 0; i < state.players.length; i++) {
    const player = state.players[i]!;
    const isCurrentTurn = i === state.currentPlayerIndex;
    const indicator = isCurrentTurn ? "→ " : "  ";
    const name = i === 0 ? "You" : player.name;
    const downStatus = player.isDown ? " ✓ DOWN" : "";
    const scoreStr = player.totalScore > 0 ? ` (${player.totalScore} pts)` : "";
    console.log(`${indicator}${name}: ${player.hand.length} cards${downStatus}${scoreStr}`);
  }
  console.log("");
}

function printTable(state: GameStateView): void {
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

function printDiscard(state: GameStateView): void {
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

function printGameView(state: GameStateView): void {
  clearScreen();
  printHeader(state);
  printPlayers(state);
  printTable(state);
  printDiscard(state);
  printDivider();
  console.log("");
}

function getHumanPlayer(state: GameStateView): Player {
  return state.players.find((p) => p.id === HUMAN_PLAYER_ID)!;
}

async function handleHumanDraw(state: GameStateView): Promise<void> {
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
    const result = orchestrator.drawFromStock();
    console.log("");
    console.log(`You drew the ${getDrawnCard(state)} from the stock.`);
  } else if (choice === 2 && state.discard.length > 0) {
    const result = orchestrator.drawFromDiscard();
    console.log("");
    console.log(`You took the ${renderCard(state.discard[0]!)} from the discard.`);
  } else if (choice === 3) {
    await handleOrganizeHand(state);
  }
}

function getDrawnCard(state: GameStateView): string {
  // The card that was just drawn is the last card in the player's hand
  const human = getHumanPlayer(orchestrator.getStateView());
  return renderCard(human.hand[human.hand.length - 1]!);
}

async function handleHumanAction(state: GameStateView): Promise<void> {
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
      await handleDiscard(state);
      break;
    case "swap":
      await handleSwap(state);
      break;
  }
}

async function handleLaydown(state: GameStateView): Promise<void> {
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

  const result = orchestrator.layDown(meldGroups);
  if (result.success) {
    console.log("");
    console.log("You laid down your contract!");
  } else {
    console.log("");
    console.log(`Error: ${result.message}`);
    await prompt("Press Enter to continue...");
  }
}

async function handleLayoff(state: GameStateView): Promise<void> {
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

  const result = orchestrator.layOff(cardPos, meldNum);
  if (result.success) {
    console.log("");
    console.log(result.message);
  } else {
    console.log("");
    console.log(`Error: ${result.message}`);
    await prompt("Press Enter to continue...");
  }
}

async function handleDiscard(state: GameStateView): Promise<void> {
  const human = getHumanPlayer(state);
  console.log("");
  printHand(human, true);
  console.log("");

  const pos = await promptNumber(`Discard which card? (1-${human.hand.length}) `, 1, human.hand.length);
  const card = human.hand[pos - 1]!;

  const result = orchestrator.discardCard(pos);
  if (result.success) {
    console.log("");
    console.log(`You discarded ${renderCard(card)}.`);
  } else {
    console.log("");
    console.log(`Error: ${result.message}`);
  }
}

async function handleSwap(state: GameStateView): Promise<void> {
  const human = getHumanPlayer(state);
  console.log("");
  printHand(human, true);
  console.log("");

  const cardPos = await promptNumber(`Which card will replace the Joker? (1-${human.hand.length}) `, 1, human.hand.length);

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

  const result = orchestrator.swap(meldNum, jokerIdx + 1, cardPos);
  if (result.success) {
    console.log("");
    console.log(`Swapped! You gave ${renderCard(human.hand[cardPos - 1]!)} and took the Joker.`);
  } else {
    console.log("");
    console.log(`Error: ${result.message}`);
    await prompt("Press Enter to continue...");
  }
}

async function handleOrganizeHand(state: GameStateView): Promise<void> {
  // For now, just show the hand - full organization can be added later
  const human = getHumanPlayer(state);
  console.log("");
  console.log("Your hand: " + renderHand(human.hand));
  console.log("");
  await prompt("Press Enter to continue...");
}

async function handleMayIWindow(state: GameStateView): Promise<void> {
  const ctx = state.mayIContext!;
  const awaitingPlayer = state.players.find((p) => p.id === state.awaitingPlayerId)!;

  if (awaitingPlayer.id === HUMAN_PLAYER_ID) {
    // Human player's turn in May I window
    const isCurrentPlayer = ctx.currentPlayerId === HUMAN_PLAYER_ID;
    console.log("");

    if (isCurrentPlayer && !ctx.currentPlayerPassed) {
      // Human is current player, can take or pass
      console.log(`Do you want the ${renderCard(ctx.discardedCard)}?`);
      console.log("");
      console.log("  1. Yes, take it");
      console.log("  2. No, draw from the stock instead");
      console.log("");

      const choice = await promptNumber("> ", 1, 2);
      if (choice === 1) {
        orchestrator.take();
        console.log("");
        console.log(`You took the ${renderCard(ctx.discardedCard)}.`);
      } else {
        orchestrator.pass();
        console.log("");
        console.log(`You passed on the ${renderCard(ctx.discardedCard)}.`);
      }
    } else {
      // Human can call May I or pass
      console.log(`May I? (${renderCard(ctx.discardedCard)} + penalty card)`);
      console.log("");
      console.log("  1. Yes, May I!");
      console.log("  2. No thanks");
      console.log("");

      const choice = await promptNumber("> ", 1, 2);
      if (choice === 1) {
        orchestrator.callMayI();
        console.log("");
        console.log(`You called "May I!" and took the ${renderCard(ctx.discardedCard)}.`);
      } else {
        orchestrator.pass();
        console.log("");
        console.log("You passed.");
      }
    }
  } else {
    // AI player's turn in May I window - auto-play (always pass for simplicity)
    console.log("");
    console.log(`${awaitingPlayer.name} passed.`);
    orchestrator.pass();
  }
}

async function handleAITurn(state: GameStateView): Promise<void> {
  const currentPlayer = state.players[state.currentPlayerIndex]!;
  console.log("");
  console.log(`${currentPlayer.name}'s turn...`);

  // Simple AI: draw from stock, skip, discard first card
  if (state.phase === "AWAITING_DRAW") {
    orchestrator.drawFromStock();
    const updatedState = orchestrator.getStateView();

    // Handle May I window if opened
    while (updatedState.phase === "MAY_I_WINDOW") {
      await handleMayIWindow(orchestrator.getStateView());
    }
  }

  const afterDraw = orchestrator.getStateView();
  if (afterDraw.phase === "AWAITING_ACTION") {
    orchestrator.skip();
  }

  const afterSkip = orchestrator.getStateView();
  if (afterSkip.phase === "AWAITING_DISCARD") {
    const player = afterSkip.players[afterSkip.currentPlayerIndex]!;
    const discardedCard = player.hand[0]!;
    orchestrator.discardCard(1);
    console.log(`${currentPlayer.name} drew from stock. Discarded ${renderCard(discardedCard)}.`);
  }
}

async function handleRoundEnd(state: GameStateView): Promise<void> {
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

  orchestrator.continue();
}

async function handleGameEnd(state: GameStateView): Promise<void> {
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
  // For now, human is always player 0, with AI opponents
  orchestrator.newGame(["You", "Alice", "Bob"]);
  console.log("");
  console.log("Starting a new game of May I?");
  console.log("You're playing against Alice and Bob.");
  console.log("");
  await prompt("Press Enter to begin...");
}

async function gameLoop(): Promise<void> {
  while (true) {
    const state = orchestrator.getStateView();

    printGameView(state);

    const isHumanTurn = state.awaitingPlayerId === HUMAN_PLAYER_ID;

    switch (state.phase) {
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

      case "MAY_I_WINDOW":
        await handleMayIWindow(state);
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

  await startNewGame();
  await gameLoop();
}

main().catch((err) => {
  console.error("Error:", err);
  rl.close();
  process.exit(1);
});
