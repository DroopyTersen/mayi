import type { Player } from "../core/engine/engine.types";
import type { GameSnapshot } from "../core/engine/game-engine.types";
import { formatCardText } from "../core/card/card-text.utils";
import { getNumberedMelds } from "../core/meld/meld-numbering";
import { canSwapJokerWithCard } from "../core/meld/meld.joker";

/**
 * Small, deterministic hints for the decisions the agent can make immediately.
 * This is deliberately not a general hand solver.
 */
export function getJokerSwapHints(state: GameSnapshot, player: Player): string[] {
  if (
    state.phase !== "ROUND_ACTIVE" ||
    state.turnPhase !== "AWAITING_ACTION" ||
    state.awaitingPlayerId !== player.id ||
    player.isDown ||
    state.currentRound === 6
  ) {
    return [];
  }

  const hints: string[] = [];
  for (const { meldNumber, meld } of getNumberedMelds(state.table, state.players)) {
    for (let jokerIndex = 0; jokerIndex < meld.cards.length; jokerIndex++) {
      const jokerCard = meld.cards[jokerIndex];
      if (jokerCard?.rank !== "Joker") continue;

      for (let handIndex = 0; handIndex < player.hand.length; handIndex++) {
        const handCard = player.hand[handIndex];
        if (!handCard || !canSwapJokerWithCard(meld, jokerCard, handCard)) {
          continue;
        }

        hints.push(
          `CALL swap_joker before discarding: meld ${meldNumber}, Joker position ${jokerIndex + 1}, hand position ${handIndex + 1} (${formatCardText(handCard)}). The Joker enters your hand; immediately re-check lay_down.`,
        );
      }
    }
  }

  return hints;
}
