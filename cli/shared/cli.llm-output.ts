/**
 * LLM-friendly game state output
 *
 * Shared utility for rendering game state as text for LLM consumption.
 * Only shows information the specified player is allowed to see:
 * - Their full hand
 * - Other players' card counts (not their cards)
 */

import type { Player } from "../../core/engine/engine.types";
import type { GameSnapshot } from "../../core/engine/game-engine.types";
import { renderCard, renderNumberedHand } from "./cli.renderer";
import { getNumberedMelds } from "./cli-meld-numbering";

/** Action log entry for LLM context */
export interface ActionLogEntry {
  roundNumber: number;
  playerId: string;
  playerName: string;
  action: string;
  details?: string;
}

/** Options for LLM state output */
export interface LLMOutputOptions {
  /** Optional action log entries (if not provided, RECENT ACTIONS section is omitted) */
  actionLog?: ActionLogEntry[];
}

/**
 * Render game state as text for LLM consumption.
 *
 * @param state - The game snapshot
 * @param playerId - The player whose perspective to render
 * @param options - Optional configuration (action log, etc.)
 */
export function outputGameStateForLLM(
  state: GameSnapshot,
  playerId: string,
  options: LLMOutputOptions = {}
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

  if (state.lastError && state.awaitingPlayerId === playerId) {
    lines.push(`ERROR: ${state.lastError}`);
    lines.push("");
  }

  // Players (card counts only; only show own cumulative score)
  lines.push("PLAYERS");
  for (let i = 0; i < state.players.length; i++) {
    const p = state.players[i]!;
    const isCurrentTurn = i === state.currentPlayerIndex;
    const isYou = p.id === playerId;
    const indicator = isCurrentTurn ? "→ " : "  ";
    const youLabel = isYou ? " (you)" : "";
    const downStatus = p.isDown ? " ✓ DOWN" : "";
    const scoreStr = isYou && p.totalScore > 0 ? ` (${p.totalScore} pts)` : "";
    lines.push(`${indicator}${p.name}${youLabel}: ${p.hand.length} cards${downStatus}${scoreStr}`);
  }
  lines.push("");

  // Table (numbered melds; deterministic ordering)
  lines.push("TABLE");
  if (state.table.length === 0) {
    lines.push("  (no melds yet)");
  } else {
    for (const { meldNumber, meld, owner } of getNumberedMelds(state.table, state.players)) {
      const ownerName = owner?.name ?? "Unknown";
      const typeLabel = meld.type === "set" ? "Set" : "Run";
      const cardsStr = meld.cards.map(renderCard).join(" ");
      lines.push(`  [${meldNumber}] ${ownerName} — ${typeLabel}: ${cardsStr}`);
    }
  }
  lines.push("");

  // Discard and stock
  const topDiscard = state.discard[0];
  const discardStr = topDiscard ? renderCard(topDiscard) : "(empty)";
  lines.push(`DISCARD: ${discardStr} (${state.discard.length} in pile) | STOCK: ${state.stock.length} cards`);
  lines.push("");
  lines.push("─".repeat(66));
  lines.push("");

  const awaitingPlayer = state.players.find((p) => p.id === state.awaitingPlayerId);
  const isYourDecision = state.awaitingPlayerId === playerId;

  // Phase-specific context
  if (state.phase === "ROUND_ACTIVE") {
    if (state.turnPhase === "AWAITING_DRAW") {
      lines.push(isYourDecision ? "YOUR TURN — You need to draw a card" : `Waiting for ${awaitingPlayer?.name} to draw`);
    } else if (state.turnPhase === "AWAITING_ACTION") {
      if (isYourDecision) {
        lines.push("YOUR TURN — You have drawn, now you can act");
        if (!player.isDown) {
          lines.push(`Contract needed: ${formatContract(state.contract)}`);
        }
      } else {
        lines.push(`Waiting for ${awaitingPlayer?.name} to act`);
      }
    } else if (state.turnPhase === "AWAITING_DISCARD") {
      lines.push(isYourDecision ? "YOUR TURN — You must discard a card" : `Waiting for ${awaitingPlayer?.name} to discard`);
    }
  } else if (state.phase === "RESOLVING_MAY_I") {
    const ctx = state.mayIContext;
    const caller = ctx ? state.players.find((p) => p.id === ctx.originalCaller) : null;
    if (isYourDecision) {
      lines.push(`MAY I? — Your decision for ${ctx ? renderCard(ctx.cardBeingClaimed) : "(unknown card)"}`);
      if (caller) {
        lines.push(`Caller: ${caller.name}`);
      }
    } else {
      lines.push(`MAY I? — Waiting for ${awaitingPlayer?.name} to respond`);
    }
  } else if (state.phase === "ROUND_END") {
    lines.push("ROUND COMPLETE");
  } else if (state.phase === "GAME_END") {
    lines.push("GAME OVER");
  }

  lines.push("");

  // Your hand
  lines.push(`YOUR HAND (${player.hand.length} cards):`);
  lines.push(`  ${renderNumberedHand(player.hand)}`);
  lines.push("");

  // Available actions (only when the engine is awaiting this player)
  if (isYourDecision) {
    const actions = getAvailableActions(state, player);
    if (actions.length > 0) {
      lines.push("─".repeat(66));
      lines.push("");
      lines.push(`AVAILABLE ACTIONS: ${actions.join(" | ")}`);
      lines.push("");
    }
  }

  // Recent action log (last 10 actions from current round)
  // Only shown if action log is provided in options
  if (options.actionLog && options.actionLog.length > 0) {
    const recentActions = options.actionLog
      .filter((entry) => entry.roundNumber === state.currentRound)
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
  }

  return lines.join("\n");
}

function getAvailableActions(state: GameSnapshot, player: Player): string[] {
  if (state.phase === "RESOLVING_MAY_I") {
    return ["allow_may_i", "claim_may_i"];
  }

  if (state.phase !== "ROUND_ACTIVE") {
    return [];
  }

  switch (state.turnPhase) {
    case "AWAITING_DRAW":
      return player.isDown ? ["draw_from_stock"] : ["draw_from_stock", "draw_from_discard"];
    case "AWAITING_ACTION":
      return player.isDown ? ["lay_off", "discard"] : ["lay_down", "swap_joker", "discard"];
    case "AWAITING_DISCARD":
      return ["discard"];
  }
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

function centerText(text: string, width: number): string {
  const padding = Math.max(0, Math.floor((width - text.length) / 2));
  return " ".repeat(padding) + text;
}

