/**
 * LLM-friendly game state output
 *
 * Shared utility for rendering game state as text for LLM consumption.
 * Used by both CLI harness (stdout) and AI agent (user message).
 *
 * Key principle: Only show information the specified player is allowed to see.
 * This means showing their hand but not other players' hands.
 */

import type { Card } from "../../core/card/card.types";
import type { Meld } from "../../core/meld/meld.types";
import type { Player } from "../../core/engine/engine.types";
import type { PersistedGameState, DecisionPhase } from "./cli.types";
import { renderCard, renderNumberedHand } from "./cli.renderer";
import { readActionLog } from "./cli.persistence";

/**
 * Render game state as text for LLM consumption.
 *
 * @param state - Current game state
 * @param playerId - ID of the player viewing the state (only their hand is shown)
 * @returns Text representation of the game state
 */
export function outputGameStateForLLM(
  state: PersistedGameState,
  playerId: string
): string {
  const lines: string[] = [];
  const player = state.players.find((p) => p.id === playerId);

  if (!player) {
    return `ERROR: Player ${playerId} not found in game state`;
  }

  // Header
  lines.push("═".repeat(66));
  lines.push(centerText(`MAY I? — Round ${state.currentRound} of 6`, 66));
  lines.push(centerText(formatContract(state.contract), 66));
  if (state.currentRound === 6) {
    lines.push(centerText("⚠️  Must lay down ALL cards to win!", 66));
  }
  lines.push("═".repeat(66));
  lines.push("");

  // Players (card counts only, not hands - only show own score)
  lines.push("PLAYERS");
  for (let i = 0; i < state.players.length; i++) {
    const p = state.players[i]!;
    const isCurrentTurn = i === state.currentPlayerIndex;
    const isYou = p.id === playerId;
    const indicator = isCurrentTurn ? "→ " : "  ";
    const youLabel = isYou ? " (you)" : "";
    const downStatus = p.isDown ? " ✓ DOWN" : "";
    // Only show cumulative score for own player - showing for others could be misleading
    const scoreStr = isYou && p.totalScore > 0 ? ` (${p.totalScore} pts)` : "";
    lines.push(
      `${indicator}${p.name}${youLabel}: ${p.hand.length} cards${downStatus}${scoreStr}`
    );
  }
  lines.push("");

  // Table (melds)
  lines.push("TABLE");
  if (state.table.length === 0) {
    lines.push("  (no melds yet)");
  } else {
    const meldsByOwner = groupMeldsByOwner(state.table, state.players);
    let meldNumber = 1;
    for (const [ownerId, melds] of Object.entries(meldsByOwner)) {
      const owner = state.players.find((p) => p.id === ownerId);
      const ownerName = owner?.name ?? "Unknown";
      lines.push(`  ${ownerName}'s melds:`);
      for (const meld of melds) {
        const typeLabel = meld.type === "set" ? "Set" : "Run";
        const cardsStr = meld.cards.map(renderCard).join(" ");
        lines.push(`    [${meldNumber}] ${typeLabel}: ${cardsStr}`);
        meldNumber++;
      }
    }
  }
  lines.push("");

  // Discard and stock
  const topDiscard = state.discard[0];
  const discardStr = topDiscard ? renderCard(topDiscard) : "(empty)";
  const discardCount = state.discard.length;
  lines.push(
    `DISCARD: ${discardStr} (${discardCount} in pile) | STOCK: ${state.stock.length} cards`
  );
  lines.push("");
  lines.push("─".repeat(66));
  lines.push("");

  // Phase-specific context
  const awaitingPlayer = state.players.find(
    (p) => p.id === state.harness.awaitingPlayerId
  );
  const isYourTurn = state.harness.awaitingPlayerId === playerId;

  switch (state.harness.phase) {
    case "AWAITING_DRAW":
      if (isYourTurn) {
        lines.push("YOUR TURN — You need to draw a card");
      } else {
        lines.push(`Waiting for ${awaitingPlayer?.name} to draw`);
      }
      break;

    case "AWAITING_ACTION":
      if (isYourTurn) {
        lines.push("YOUR TURN — You have drawn, now you can act");
        if (!player.isDown) {
          lines.push(`Contract needed: ${formatContract(state.contract)}`);
        }
      } else {
        lines.push(`Waiting for ${awaitingPlayer?.name} to act`);
      }
      break;

    case "AWAITING_DISCARD":
      if (isYourTurn) {
        lines.push("YOUR TURN — You must discard a card");
      } else {
        lines.push(`Waiting for ${awaitingPlayer?.name} to discard`);
      }
      break;

    case "MAY_I_WINDOW": {
      const ctx = state.harness.mayIContext!;
      if (isYourTurn) {
        lines.push(`MAY I WINDOW — Your decision for ${renderCard(ctx.discardedCard)}`);
        if (ctx.claimants.length > 0) {
          const claimantNames = ctx.claimants
            .map((id) => state.players.find((p) => p.id === id)?.name)
            .join(", ");
          lines.push(`Already claimed by: ${claimantNames}`);
        }
      } else {
        lines.push(
          `MAY I WINDOW — Waiting for ${awaitingPlayer?.name} to decide on ${renderCard(ctx.discardedCard)}`
        );
      }
      break;
    }

    case "ROUND_END":
      lines.push("ROUND COMPLETE");
      renderRoundScores(lines, state);
      break;

    case "GAME_END":
      lines.push("GAME OVER");
      renderFinalScores(lines, state);
      break;
  }

  lines.push("");

  // Your hand (only if you're a player in the game)
  lines.push(`YOUR HAND (${player.hand.length} cards):`);
  lines.push(`  ${renderNumberedHand(player.hand)}`);
  lines.push("");

  lines.push("─".repeat(66));

  // Available commands (only if it's your turn)
  if (isYourTurn) {
    const commands = getAvailableCommandsForPhase(state.harness.phase, player);
    lines.push("");
    lines.push(`AVAILABLE ACTIONS: ${commands.join(" | ")}`);
  }

  lines.push("");

  // Recent action log (last 10 actions from current turn)
  const actionLog = readActionLog(state.gameId);
  const recentActions = actionLog
    .filter((entry) => entry.round === state.currentRound)
    .slice(-10);

  if (recentActions.length > 0) {
    lines.push("RECENT ACTIONS:");
    for (const entry of recentActions) {
      const isYou = entry.playerId === playerId;
      const name = isYou ? "You" : entry.playerName;
      const details = entry.details ? ` ${entry.details}` : "";
      lines.push(`  ${name} ${entry.action}${details}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// --- Helper functions ---

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

function centerText(text: string, width: number): string {
  const padding = Math.max(0, Math.floor((width - text.length) / 2));
  return " ".repeat(padding) + text;
}

function groupMeldsByOwner(
  melds: Meld[],
  players: Player[]
): Record<string, Meld[]> {
  const result: Record<string, Meld[]> = {};
  for (const meld of melds) {
    if (!result[meld.ownerId]) {
      result[meld.ownerId] = [];
    }
    result[meld.ownerId]!.push(meld);
  }
  return result;
}

function getAvailableCommandsForPhase(
  phase: DecisionPhase,
  player: Player
): string[] {
  switch (phase) {
    case "AWAITING_DRAW":
      // Down players auto-draw, so no commands needed
      return player.isDown ? [] : ["draw_from_stock", "draw_from_discard"];

    case "AWAITING_ACTION":
      if (player.isDown) {
        return ["lay_off", "discard"];
      }
      return ["lay_down", "swap_joker", "discard"];

    case "AWAITING_DISCARD":
      return ["discard"];

    case "MAY_I_WINDOW":
      return player.isDown ? ["pass"] : ["call_may_i", "pass"];

    case "ROUND_END":
      return ["continue"];

    case "GAME_END":
      return [];

    default:
      return [];
  }
}

function renderRoundScores(lines: string[], state: PersistedGameState): void {
  const lastRecord = state.roundHistory[state.roundHistory.length - 1];
  if (!lastRecord) return;

  lines.push("");
  const winner = state.players.find((p) => p.id === lastRecord.winnerId);
  lines.push(`${winner?.name ?? "Unknown"} went out!`);
  lines.push("");

  for (const player of state.players) {
    const score = lastRecord.scores[player.id] ?? 0;
    const indicator = player.id === lastRecord.winnerId ? " ⭐" : "";
    lines.push(`  ${player.name}: ${score} points${indicator}`);
  }
  lines.push("");
  lines.push("STANDINGS:");
  const sorted = [...state.players].sort((a, b) => a.totalScore - b.totalScore);
  for (let i = 0; i < sorted.length; i++) {
    lines.push(`  ${i + 1}. ${sorted[i]!.name} — ${sorted[i]!.totalScore} points`);
  }
}

function renderFinalScores(lines: string[], state: PersistedGameState): void {
  const sorted = [...state.players].sort((a, b) => a.totalScore - b.totalScore);
  const winner = sorted[0]!;

  lines.push("");
  lines.push("FINAL STANDINGS:");
  lines.push("");
  const medals = ["🥇", "🥈", "🥉"];
  for (let i = 0; i < sorted.length; i++) {
    const medal = medals[i] ?? `${i + 1}.`;
    lines.push(`  ${medal} ${sorted[i]!.name} — ${sorted[i]!.totalScore} points`);
  }
  lines.push("");
  lines.push(`${winner.name} wins!`);
}
