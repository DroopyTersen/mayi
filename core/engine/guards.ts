/**
 * Guard functions for the lay down action in May I?
 *
 * These guards validate whether a player can lay down their cards.
 */

import type { Card } from "../card/card.types";
import type { Meld } from "../meld/meld.types";
import type { RoundNumber } from "./engine.types";
import { CONTRACTS, validateContractMelds } from "./contracts";
import { isValidSet, isValidRun, countWildsAndNaturals } from "../meld/meld.validation";

/**
 * Context needed for guard evaluation
 */
export interface GuardContext {
  isDown: boolean;
  hand: Card[];
  roundNumber: RoundNumber;
  playerId: string;
}

/**
 * Meld proposal structure
 */
export interface MeldProposal {
  type: "set" | "run";
  cardIds: string[];
}

/**
 * Returns true when player has not laid down yet this round
 */
export function notDownYet(isDown: boolean): boolean {
  return !isDown;
}

/**
 * Validates that the proposed melds meet the contract requirements for the round
 */
export function meetsContract(
  roundNumber: RoundNumber,
  melds: Meld[]
): boolean {
  const contract = CONTRACTS[roundNumber];
  const result = validateContractMelds(contract, melds);
  return result.valid;
}

/**
 * Validates that all proposed melds are individually valid (correct type and structure)
 */
export function validMelds(melds: Meld[]): boolean {
  for (const meld of melds) {
    if (meld.type === "set" && !isValidSet(meld.cards)) {
      return false;
    }
    if (meld.type === "run" && !isValidRun(meld.cards)) {
      return false;
    }
  }
  return true;
}

/**
 * Validates that wild cards don't outnumber natural cards in any meld
 */
export function wildsNotOutnumbered(melds: Meld[]): boolean {
  for (const meld of melds) {
    const { wilds, naturals } = countWildsAndNaturals(meld.cards);
    if (wilds > naturals) {
      return false;
    }
  }
  return true;
}

/**
 * Builds Meld objects from MeldProposals and hand cards
 * Returns null if any card is not found in hand
 */
export function buildMeldsFromProposals(
  proposals: MeldProposal[],
  hand: Card[],
  playerId: string
): Meld[] | null {
  const melds: Meld[] = [];

  for (const proposal of proposals) {
    const cards: Card[] = [];
    for (const cardId of proposal.cardIds) {
      const card = hand.find((c) => c.id === cardId);
      if (!card) return null; // Card not in hand
      cards.push(card);
    }
    melds.push({
      id: `meld-${crypto.randomUUID()}`,
      type: proposal.type,
      cards,
      ownerId: playerId,
    });
  }

  return melds;
}

/**
 * Composite guard that checks all lay down requirements:
 * - Player has not laid down yet this round
 * - All cards are in the player's hand
 * - All melds are valid (correct structure)
 * - Wild cards don't outnumber naturals in any meld
 * - Melds meet the contract requirements for the round
 */
export function canLayDown(
  context: GuardContext,
  proposals: MeldProposal[]
): boolean {
  // Cannot lay down if already down this round
  if (!notDownYet(context.isDown)) {
    return false;
  }

  // Build melds from proposals
  const melds = buildMeldsFromProposals(proposals, context.hand, context.playerId);
  if (!melds) {
    return false; // Some card not in hand
  }

  // Validate individual melds
  if (!validMelds(melds)) {
    return false;
  }

  // Validate wild card ratios (already checked in validMelds through isValidSet/isValidRun, but explicit check here)
  if (!wildsNotOutnumbered(melds)) {
    return false;
  }

  // Validate contract requirements
  if (!meetsContract(context.roundNumber, melds)) {
    return false;
  }

  return true;
}
