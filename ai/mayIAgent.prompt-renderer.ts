/**
 * LLM-friendly May I? game state renderer.
 *
 * Only shows information the specified player is allowed to see:
 * - Their full hand
 * - Other players' card counts, not their cards
 */

import type { Player } from "../core/engine/engine.types";
import type { GameSnapshot } from "../core/engine/game-engine.types";
import type { Card } from "../core/card/card.types";
import { formatCardText } from "../core/card/card-text.utils";
import { getNumberedMelds } from "../core/meld/meld-numbering";
import { getJokerSwapHints } from "./mayIAgent.tactics";
import { getAvailableToolNames } from "./mayIAgent.tool-availability";

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
  /** Optional action log entries. If omitted, RECENT ACTIONS is omitted. */
  actionLog?: ActionLogEntry[];
}

/**
 * Render game state as text for LLM consumption.
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

  lines.push("PLAYERS");
  for (let i = 0; i < state.players.length; i++) {
    const p = state.players[i]!;
    const isCurrentTurn = i === state.currentPlayerIndex;
    const isYou = p.id === playerId;
    const indicator = isCurrentTurn ? "→ " : "  ";
    const youLabel = isYou ? " (you)" : "";
    const downStatus = p.isDown ? " ✓ DOWN" : "";
    const scoreStr = ` (${p.totalScore} pts)`;
    lines.push(
      `${indicator}${p.name}${youLabel}: ${p.hand.length} cards${downStatus}${scoreStr}`
    );
  }
  lines.push("");

  lines.push("TABLE");
  if (state.table.length === 0) {
    lines.push("  (no melds yet)");
  } else {
    for (const { meldNumber, meld, owner } of getNumberedMelds(
      state.table,
      state.players
    )) {
      const ownerName = owner?.name ?? "Unknown";
      const typeLabel = meld.type === "set" ? "Set" : "Run";
      const cardsStr = meld.cards.map(formatCardText).join(" ");
      lines.push(`  [${meldNumber}] ${ownerName} — ${typeLabel}: ${cardsStr}`);
    }
  }
  lines.push("");

  const topDiscard = state.discard[0];
  const discardStr = topDiscard ? formatCardText(topDiscard) : "(empty)";
  lines.push(
    `DISCARD: ${discardStr} (${state.discard.length} in pile) | STOCK: ${state.stock.length} cards`
  );
  lines.push("");
  lines.push("─".repeat(66));
  lines.push("");

  const awaitingPlayer = state.players.find((p) => p.id === state.awaitingPlayerId);
  const isYourDecision = state.awaitingPlayerId === playerId;

  if (state.phase === "ROUND_ACTIVE") {
    if (state.turnPhase === "AWAITING_DRAW") {
      lines.push(
        isYourDecision
          ? "YOUR TURN — You need to draw a card"
          : `Waiting for ${awaitingPlayer?.name} to draw`
      );
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
      lines.push(
        isYourDecision
          ? "YOUR TURN — You must discard a card"
          : `Waiting for ${awaitingPlayer?.name} to discard`
      );
    }
  } else if (state.phase === "RESOLVING_MAY_I") {
    const ctx = state.mayIContext;
    const caller = ctx
      ? state.players.find((p) => p.id === ctx.originalCaller)
      : null;
    if (isYourDecision) {
      lines.push(
        `MAY I? — Your decision for ${
          ctx ? formatCardText(ctx.cardBeingClaimed) : "(unknown card)"
        }`
      );
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

  lines.push(`YOUR HAND (${player.hand.length} cards):`);
  lines.push(`  ${renderNumberedHand(player.hand)}`);
  lines.push("");

  if (
    state.currentRound === 6 &&
    state.phase === "ROUND_ACTIVE" &&
    state.turnPhase === "AWAITING_ACTION" &&
    isYourDecision
  ) {
    lines.push(
      `HAND 6 CHECK: Before discarding, partition all ${player.hand.length} numbered cards into exactly 1 set and 2 runs.`,
    );
    lines.push(
      "Use every card exactly once; a valid lay_down wins immediately. Melds may exceed their minimum size.",
    );
    lines.push("");
  }

  const jokerSwapHints = getJokerSwapHints(state, player);
  if (jokerSwapHints.length > 0) {
    lines.push("TACTICAL OPPORTUNITIES:");
    for (const hint of jokerSwapHints) {
      lines.push(`  ${hint}`);
    }
    lines.push("");
  }

  if (isYourDecision) {
    const actions = getAvailableToolNames(state, player.id);
    if (actions.length > 0) {
      lines.push("─".repeat(66));
      lines.push("");
      lines.push(`AVAILABLE ACTIONS: ${actions.join(" | ")}`);
      lines.push("");
    }
  }

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

function renderNumberedHand(hand: Card[]): string {
  return hand
    .map((card, index) => `${index + 1}:${formatCardText(card)}`)
    .join(" | ");
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
