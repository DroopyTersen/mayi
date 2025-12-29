/**
 * Rendering utilities for the May I? CLI harness
 *
 * Displays game state and available commands
 */

import type { Card } from "../../core/card/card.types";
import type { Meld } from "../../core/meld/meld.types";
import type { Player } from "../../core/engine/engine.types";
import type { PersistedGameState, AvailableCommands, ActionLogEntry } from "../shared/cli.types";
import { renderCard, renderHand, renderNumberedHand } from "../shared/cli.renderer";
import { getAwaitingPlayer, getCurrentPlayer } from "./harness.state";
import { identifyJokerPositions } from "../../core/meld/meld.joker";

/**
 * Render the full game status for display
 */
export function renderStatus(state: PersistedGameState): string {
  const lines: string[] = [];

  // Header
  lines.push("═".repeat(66));
  lines.push(centerText(`MAY I? — Round ${state.currentRound} of 6`, 66));
  lines.push(centerText(formatContract(state.contract), 66));
  if (state.currentRound === 6) {
    lines.push(centerText("⚠️  Must lay down ALL cards to win!", 66));
  }
  lines.push("═".repeat(66));
  lines.push("");

  // Players
  lines.push("PLAYERS");
  for (let i = 0; i < state.players.length; i++) {
    const player = state.players[i]!;
    const isCurrentTurn = i === state.currentPlayerIndex;
    const indicator = isCurrentTurn ? "→ " : "  ";
    const downStatus = player.isDown ? " ✓ DOWN" : "";
    const scoreStr = player.totalScore > 0 ? ` (${player.totalScore} pts)` : "";
    lines.push(`${indicator}${player.name}: ${player.hand.length} cards${downStatus}${scoreStr}`);
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
  lines.push(`DISCARD: ${discardStr} (${discardCount} in pile) | STOCK: ${state.stock.length} cards`);
  lines.push("");
  lines.push("─".repeat(66));
  lines.push("");

  // Current decision context
  const awaitingPlayer = getAwaitingPlayer(state);
  if (!awaitingPlayer) {
    lines.push("ERROR: No awaiting player found");
    return lines.join("\n");
  }

  // Show whose decision we need
  switch (state.harness.phase) {
    case "AWAITING_DRAW":
      lines.push(`It's ${awaitingPlayer.name}'s turn — needs to draw`);
      lines.push("");
      lines.push(`Your hand (${awaitingPlayer.hand.length} cards):`);
      lines.push(`  ${renderNumberedHand(awaitingPlayer.hand)}`);
      break;

    case "AWAITING_ACTION":
      lines.push(`It's ${awaitingPlayer.name}'s turn — drawn, can act`);
      lines.push("");
      lines.push(`Your hand (${awaitingPlayer.hand.length} cards):`);
      lines.push(`  ${renderNumberedHand(awaitingPlayer.hand)}`);
      if (!awaitingPlayer.isDown) {
        lines.push("");
        lines.push(`Contract needed: ${formatContract(state.contract)}`);
      }
      break;

    case "AWAITING_DISCARD":
      lines.push(`It's ${awaitingPlayer.name}'s turn — needs to discard`);
      lines.push("");
      lines.push(`Your hand (${awaitingPlayer.hand.length} cards):`);
      lines.push(`  ${renderNumberedHand(awaitingPlayer.hand)}`);
      break;

    case "MAY_I_WINDOW":
      const ctx = state.harness.mayIContext!;
      const respondingPlayer = awaitingPlayer;
      lines.push(`MAY I WINDOW — ${respondingPlayer.name}'s decision`);
      lines.push("");
      lines.push(`Available card: ${renderCard(ctx.discardedCard)}`);
      if (ctx.claimants.length > 0) {
        const claimantNames = ctx.claimants
          .map((id) => state.players.find((p) => p.id === id)?.name)
          .join(", ");
        lines.push(`Already claimed by: ${claimantNames}`);
      }
      lines.push("");
      lines.push(`${respondingPlayer.name}'s hand (${respondingPlayer.hand.length} cards):`);
      lines.push(`  ${renderNumberedHand(respondingPlayer.hand)}`);
      break;

    case "ROUND_END":
      lines.push("ROUND COMPLETE");
      lines.push("");
      renderRoundScores(lines, state);
      break;

    case "GAME_END":
      lines.push("GAME OVER");
      lines.push("");
      renderFinalScores(lines, state);
      break;
  }

  lines.push("");
  lines.push("─".repeat(66));

  // Available commands
  const commands = getAvailableCommands(state);
  lines.push("");
  lines.push(`COMMANDS: ${commands.commands.join(" | ")}`);
  lines.push("");

  return lines.join("\n");
}

/**
 * Render status as JSON
 */
export function renderStatusJson(state: PersistedGameState): string {
  const awaitingPlayer = getAwaitingPlayer(state);
  const currentPlayer = getCurrentPlayer(state);
  const commands = getAvailableCommands(state);

  const output = {
    round: state.currentRound,
    contract: formatContract(state.contract),
    phase: state.harness.phase,
    awaitingPlayer: awaitingPlayer ? {
      id: awaitingPlayer.id,
      name: awaitingPlayer.name,
      handSize: awaitingPlayer.hand.length,
      hand: awaitingPlayer.hand.map((c, i) => ({
        position: i + 1,
        card: renderCard(c),
        id: c.id,
      })),
      isDown: awaitingPlayer.isDown,
    } : null,
    currentPlayer: {
      id: currentPlayer.id,
      name: currentPlayer.name,
      index: state.currentPlayerIndex,
    },
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      cardCount: p.hand.length,
      isDown: p.isDown,
      totalScore: p.totalScore,
    })),
    topDiscard: state.discard[0] ? renderCard(state.discard[0]) : null,
    stockCount: state.stock.length,
    table: state.table.map((m, i) => ({
      number: i + 1,
      type: m.type,
      cards: m.cards.map(renderCard).join(" "),
      ownerId: m.ownerId,
    })),
    availableCommands: commands.commands,
    mayIContext: state.harness.mayIContext ? {
      discardedCard: renderCard(state.harness.mayIContext.discardedCard),
      claimants: state.harness.mayIContext.claimants,
      awaitingResponseFrom: state.harness.mayIContext.awaitingResponseFrom,
    } : null,
  };

  return JSON.stringify(output, null, 2);
}

/**
 * Get available commands for current phase
 */
export function getAvailableCommands(state: PersistedGameState): AvailableCommands {
  const awaitingPlayer = getAwaitingPlayer(state);

  switch (state.harness.phase) {
    case "AWAITING_DRAW":
      return {
        phase: "AWAITING_DRAW",
        description: `${awaitingPlayer?.name} to draw`,
        commands: ["draw stock", "draw discard"],
      };

    case "AWAITING_ACTION": {
      const commands: string[] = [];
      if (awaitingPlayer && !awaitingPlayer.isDown) {
        commands.push('laydown "<meld1>" "<meld2>"');

        // Check for joker swaps available (not in Round 6 - no melds on table)
        if (state.currentRound !== 6) {
          const swappableJokers = findSwappableJokers(state);
          if (swappableJokers.length > 0) {
            commands.push("swap <meld> <pos> <card>");
          }
        }
      }
      // Lay off is only available in Rounds 1-5 when player is down
      if (awaitingPlayer?.isDown && state.currentRound !== 6) {
        commands.push("layoff <card> <meld>");
      }
      commands.push("skip");
      return {
        phase: "AWAITING_ACTION",
        description: `${awaitingPlayer?.name} to act`,
        commands,
      };
    }

    case "AWAITING_DISCARD": {
      return {
        phase: "AWAITING_DISCARD",
        description: `${awaitingPlayer?.name} to discard`,
        commands: ["discard <position>"],
      };
    }

    case "MAY_I_WINDOW":
      const ctx = state.harness.mayIContext!;
      const isCurrentPlayer = awaitingPlayer?.id === ctx.currentPlayerId;
      if (isCurrentPlayer && !ctx.currentPlayerPassed) {
        return {
          phase: "MAY_I_WINDOW",
          description: `${awaitingPlayer?.name} (current player) may claim or pass`,
          commands: ["take", "pass"],
        };
      }
      return {
        phase: "MAY_I_WINDOW",
        description: `${awaitingPlayer?.name} may call May I or pass`,
        commands: ["mayi", "pass"],
      };

    case "ROUND_END":
      return {
        phase: "ROUND_END",
        description: "Round complete",
        commands: ["continue"],
      };

    case "GAME_END":
      return {
        phase: "GAME_END",
        description: "Game over",
        commands: ["new"],
      };

    default:
      return {
        phase: state.harness.phase,
        description: "Unknown phase",
        commands: [],
      };
  }
}

/**
 * Render the action log
 */
export function renderLog(entries: ActionLogEntry[], tail?: number): string {
  let toShow = entries;
  if (tail !== undefined && tail > 0) {
    toShow = entries.slice(-tail);
  }

  if (toShow.length === 0) {
    return "No actions recorded yet.";
  }

  const lines: string[] = [];
  for (const entry of toShow) {
    const time = new Date(entry.timestamp).toLocaleTimeString();
    const details = entry.details ? ` — ${entry.details}` : "";
    lines.push(`[${time}] R${entry.roundNumber} T${entry.turnNumber}: ${entry.playerName} ${entry.action}${details}`);
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

function findSwappableJokers(state: PersistedGameState): Array<{ meldIndex: number; jokerPos: number }> {
  const result: Array<{ meldIndex: number; jokerPos: number }> = [];
  for (let i = 0; i < state.table.length; i++) {
    const meld = state.table[i]!;
    if (meld.type === "run") {
      const positions = identifyJokerPositions(meld);
      for (const pos of positions) {
        if (pos.isJoker) {
          result.push({ meldIndex: i + 1, jokerPos: pos.positionIndex + 1 });
        }
      }
    }
  }
  return result;
}

function renderRoundScores(lines: string[], state: PersistedGameState): void {
  const lastRecord = state.roundHistory[state.roundHistory.length - 1];
  if (!lastRecord) return;

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
