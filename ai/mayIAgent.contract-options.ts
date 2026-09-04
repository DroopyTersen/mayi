import type { Card } from "../core/card/card.types";
import { formatCardText } from "../core/card/card-text.utils";
import type { Contract } from "../core/engine/contracts";
import type { Meld } from "../core/meld/meld.types";
import { findLayDownCandidates } from "./mayIAgent.contract-candidates";
import { findProtectedFutureLayoffs } from "./mayIAgent.future-layoffs";

export const AI_CONTRACT_OPTIONS_VERSION = "distinct-contract-options-v1";
export const AI_NEUTRAL_CONTRACT_HINT_VERSION = "neutral-contract-hint-v1";
export type AITacticalPresentation =
  | "contract-options"
  | "contract-options-reversed"
  | "neutral-contract-hint";

export function getAITacticalPresentationVersion(mode: AITacticalPresentation): string {
  return mode === "neutral-contract-hint"
    ? AI_NEUTRAL_CONTRACT_HINT_VERSION
    : AI_CONTRACT_OPTIONS_VERSION;
}

/** Derived facts only: no hidden hands, stock order, outcomes or evaluator IDs. */
export function renderContractOptions(input: {
  hand: Card[];
  contract: Contract;
  playerId: string;
  table: readonly Meld[];
  meldNumbers: ReadonlyMap<string, number>;
  order?: "reversed";
}): string[] {
  const candidates = findLayDownCandidates({ ...input, limit: 3, distinctResidualHands: true });
  if (candidates.length === 0) return [];
  const cards = new Map(input.hand.map((card) => [card.id, card]));
  const lines = [
    "CONTRACT OPTIONS (engine-validated; up to 3 distinct leftover hands):",
    "  Enumeration order is not strategic ranking; other legal contracts may exist.",
  ];
  // Reorder only after admission: this diagnostic never changes candidate supply.
  const displayed = input.order === "reversed" ? candidates.toReversed() : candidates;
  displayed.forEach((candidate, index) => {
    const remaining = candidate.remainingCardIds.flatMap((id) => {
      const card = cards.get(id);
      return card === undefined ? [] : [formatCardText(card)];
    });
    lines.push(`  Option ${index + 1}: lay_down melds ${JSON.stringify(candidate.positionGroups)}; leaves ${remaining.length} cards before any discard: ${remaining.join(" ") || "none (empties your hand)"}.`);
    if (remaining.length === 0 || input.contract.roundNumber === 6) return;
    const fits = findProtectedFutureLayoffs({ ...input, remainingCardIds: candidate.remainingCardIds });
    const descriptions = fits.protectedCards.flatMap((fit) => {
      const card = cards.get(fit.cardId);
      const number = input.meldNumbers.get(fit.meldId);
      return card === undefined || number === undefined ? [] : [`${formatCardText(card)} → meld ${number}`];
    });
    lines.push(`    Individual later-turn fits on existing public melds: ${descriptions.join("; ") || "none"}.`);
  });
  lines.push("  Future fits are not guaranteed: they are individual checks on the current table, not a joint sequence or a prediction that you will get another turn. These options do not amend the house rules.", "");
  return lines;
}
