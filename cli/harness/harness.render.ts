/**
 * Rendering utilities for the May I? CLI harness
 *
 * Displays GameEngine state and available commands.
 */

import type { Player } from "../../core/engine/engine.types";
import type { Meld } from "../../core/meld/meld.types";
import type { GameSnapshot } from "../../core/engine/game-engine.types";
import type { AvailableCommands, ActionLogEntry } from "../shared/cli.types";
import { renderCard, renderNumberedHand } from "../shared/cli.renderer";
import { getAwaitingPlayer, getCurrentPlayer } from "./harness.state";
import { identifyJokerPositions } from "../../core/meld/meld.joker";
import { getNumberedMelds } from "../shared/cli-meld-numbering";
import {
  getPlayersWhoCanCallMayI,
  getLaydownCommandHint,
} from "../../core/engine/game-engine.availability";

/**
 * Render the full game status for display
 */
export function renderStatus(state: GameSnapshot): string {
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

  if (state.lastError) {
    lines.push(`ERROR: ${state.lastError}`);
    lines.push("");
  }

  // Players (scores omitted during play to avoid confusion with hand values)
  lines.push("PLAYERS");
  for (let i = 0; i < state.players.length; i++) {
    const player = state.players[i]!;
    const isCurrentTurn = i === state.currentPlayerIndex;
    const indicator = isCurrentTurn ? "→ " : "  ";
    const downStatus = player.isDown ? " ✓ DOWN" : "";
    lines.push(`${indicator}${player.name}: ${player.hand.length} cards${downStatus}`);
  }
  lines.push("");

  // Table (melds)
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
  const discardCount = state.discard.length;
  lines.push(`DISCARD: ${discardStr} (${discardCount} in pile) | STOCK: ${state.stock.length} cards`);
  lines.push("");
  lines.push("─".repeat(66));
  lines.push("");

  const awaitingPlayer = getAwaitingPlayer(state);
  if (!awaitingPlayer) {
    lines.push("ERROR: No awaiting player found");
    return lines.join("\n");
  }

  // Phase-specific context
  if (state.phase === "ROUND_ACTIVE") {
    switch (state.turnPhase) {
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
    }
  } else if (state.phase === "RESOLVING_MAY_I") {
    const ctx = state.mayIContext;
    if (!ctx) {
      lines.push("ERROR: Engine is RESOLVING_MAY_I but mayIContext is null");
      return lines.join("\n");
    }

    const caller = state.players.find((p) => p.id === ctx.originalCaller);
    lines.push(`MAY I? — ${awaitingPlayer.name}'s decision`);
    lines.push("");
    lines.push(`Caller: ${caller?.name ?? ctx.originalCaller}`);
    lines.push(`Card: ${renderCard(ctx.cardBeingClaimed)}`);
    lines.push("");
    lines.push(`${awaitingPlayer.name}'s hand (${awaitingPlayer.hand.length} cards):`);
    lines.push(`  ${renderNumberedHand(awaitingPlayer.hand)}`);
  } else if (state.phase === "ROUND_END") {
    lines.push("ROUND COMPLETE");
    lines.push("");
    renderRoundScores(lines, state);
  } else if (state.phase === "GAME_END") {
    lines.push("GAME OVER");
    lines.push("");
    renderFinalScores(lines, state);
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
export function renderStatusJson(state: GameSnapshot): string {
  const awaitingPlayer = getAwaitingPlayer(state);
  const currentPlayer = getCurrentPlayer(state);
  const commands = getAvailableCommands(state);

  const output = {
    round: state.currentRound,
    contract: formatContract(state.contract),
    phase: state.phase,
    turnPhase: state.turnPhase,
    lastError: state.lastError,
    awaitingPlayer: awaitingPlayer
      ? {
          id: awaitingPlayer.id,
          name: awaitingPlayer.name,
          handSize: awaitingPlayer.hand.length,
          hand: awaitingPlayer.hand.map((c, i) => ({
            position: i + 1,
            card: renderCard(c),
            id: c.id,
          })),
          isDown: awaitingPlayer.isDown,
        }
      : null,
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
    table: getNumberedMelds(state.table, state.players).map(({ meldNumber, meld }) => ({
      number: meldNumber,
      type: meld.type,
      cards: meld.cards.map(renderCard).join(" "),
      ownerId: meld.ownerId,
    })),
    availableCommands: commands.commands,
    mayIEligiblePlayerIds: commands.mayIEligiblePlayerIds ?? [],
    mayIContext: state.mayIContext
      ? {
          originalCaller: state.mayIContext.originalCaller,
          cardBeingClaimed: renderCard(state.mayIContext.cardBeingClaimed),
          playersToCheck: state.mayIContext.playersToCheck,
          playerBeingPrompted: state.mayIContext.playerBeingPrompted,
          playersWhoAllowed: state.mayIContext.playersWhoAllowed,
          winner: state.mayIContext.winner,
          outcome: state.mayIContext.outcome,
        }
      : null,
  };

  return JSON.stringify(output, null, 2);
}

/**
 * Get available commands for current phase
 */
export function getAvailableCommands(state: GameSnapshot): AvailableCommands {
  const awaitingPlayer = getAwaitingPlayer(state);
  const mayIEligiblePlayers = getPlayersWhoCanCallMayI(state);

  if (state.phase === "ROUND_ACTIVE") {
    switch (state.turnPhase) {
      case "AWAITING_DRAW":
        return {
          phase: "AWAITING_DRAW",
          description: `${awaitingPlayer?.name} to draw`,
          commands: ["draw stock", "draw discard"],
          mayIEligiblePlayerIds: mayIEligiblePlayers,
        };

      case "AWAITING_ACTION": {
        const commands: string[] = [];

        if (awaitingPlayer && !awaitingPlayer.isDown) {
          // Use dynamic laydown hint based on contract
          commands.push(getLaydownCommandHint(state.contract));

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
          mayIEligiblePlayerIds: mayIEligiblePlayers,
        };
      }

      case "AWAITING_DISCARD":
        return {
          phase: "AWAITING_DISCARD",
          description: `${awaitingPlayer?.name} to discard`,
          commands: ["discard <position>"],
          // No May I during discard phase - once they discard it's a new card
        };
    }
  }

  if (state.phase === "RESOLVING_MAY_I") {
    return {
      phase: "RESOLVING_MAY_I",
      description: `${awaitingPlayer?.name} to allow or claim`,
      commands: ["allow", "claim"],
    };
  }

  if (state.phase === "ROUND_END") {
    return {
      phase: "ROUND_END",
      description: "Round complete",
      commands: ["status"],
    };
  }

  if (state.phase === "GAME_END") {
    return {
      phase: "GAME_END",
      description: "Game over",
      commands: ["new"],
    };
  }

  return {
    // Fallback shouldn't happen, but keeps rendering resilient
    phase: "GAME_END",
    description: "Unknown phase",
    commands: [],
  };
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

function findSwappableJokers(state: GameSnapshot): Array<{ meldIndex: number; jokerPos: number }> {
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

function renderRoundScores(lines: string[], state: GameSnapshot): void {
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

function renderFinalScores(lines: string[], state: GameSnapshot): void {
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

