/**
 * Contract definitions for May I? card game
 *
 * Each round has a specific contract that must be met to lay down.
 */

import type { RoundNumber } from "./engine.types";
import type { Meld } from "../meld/meld.types";
import { isValidSet, isValidRun } from "../meld/meld.validation";
import { getRunBounds } from "../meld/meld.bounds";

/**
 * A contract specifies the required melds to lay down in a round
 */
export interface Contract {
  roundNumber: RoundNumber;
  sets: number;
  runs: number;
}

/**
 * Contract requirements for each of the 6 rounds
 *
 * From house rules:
 * - Round 1: 2 sets
 * - Round 2: 1 set + 1 run
 * - Round 3: 2 runs
 * - Round 4: 3 sets
 * - Round 5: 2 sets + 1 run
 * - Round 6: 1 set + 2 runs (no discard round)
 */
export const CONTRACTS: Record<RoundNumber, Contract> = {
  1: { roundNumber: 1, sets: 2, runs: 0 },
  2: { roundNumber: 2, sets: 1, runs: 1 },
  3: { roundNumber: 3, sets: 0, runs: 2 },
  4: { roundNumber: 4, sets: 3, runs: 0 },
  5: { roundNumber: 5, sets: 2, runs: 1 },
  6: { roundNumber: 6, sets: 1, runs: 2 },
};

/**
 * Get the contract for a specific round
 *
 * @param round - Round number (1-6)
 * @returns The contract for that round, or null if invalid round
 */
export function getContractForRound(round: number): Contract | null {
  if (round < 1 || round > 6 || !Number.isInteger(round)) {
    return null;
  }
  return CONTRACTS[round as RoundNumber];
}

/**
 * Calculate the minimum number of cards required to meet a contract
 *
 * Sets require minimum 3 cards each
 * Runs require minimum 4 cards each
 */
export function getMinimumCardsForContract(contract: Contract): number {
  const setCards = contract.sets * 3;
  const runCards = contract.runs * 4;
  return setCards + runCards;
}

/**
 * Result of contract validation
 */
export interface ContractValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate that proposed melds meet the contract requirements
 *
 * Checks:
 * - Correct number of sets
 * - Correct number of runs
 * - Each meld's declared type matches its actual cards
 *
 * Note: Individual meld validity (wild ratios, card counts) is also checked.
 */
export function validateContractMelds(
  contract: Contract,
  melds: Meld[]
): ContractValidationResult {
  const sets = melds.filter((m) => m.type === "set");
  const runs = melds.filter((m) => m.type === "run");

  if (sets.length !== contract.sets) {
    return {
      valid: false,
      error: `Contract requires ${contract.sets} set(s), but got ${sets.length}`,
    };
  }

  if (runs.length !== contract.runs) {
    return {
      valid: false,
      error: `Contract requires ${contract.runs} run(s), but got ${runs.length}`,
    };
  }

  // Verify each meld's declared type matches its actual cards
  for (const meld of melds) {
    if (meld.type === "set") {
      if (!isValidSet(meld.cards)) {
        return {
          valid: false,
          error: `Meld declared as set is invalid`,
        };
      }
    } else if (meld.type === "run") {
      if (!isValidRun(meld.cards)) {
        return {
          valid: false,
          error: `Meld declared as run is invalid`,
        };
      }
    }
  }

  // Check for duplicate card usage across melds (by cardId)
  const seenCardIds = new Set<string>();
  for (const meld of melds) {
    for (const card of meld.cards) {
      if (seenCardIds.has(card.id)) {
        return {
          valid: false,
          error: `Card ${card.id} appears in multiple melds (duplicate card usage)`,
        };
      }
      seenCardIds.add(card.id);
    }
  }

  // Check same-suit run gap rule when there are 2+ runs
  if (runs.length >= 2) {
    const gapResult = validateSameSuitRunGap(runs);
    if (!gapResult.valid) {
      return gapResult;
    }
  }

  return { valid: true };
}

/**
 * Validates the same-suit run gap rule for contracts with 2+ runs.
 *
 * When two runs share the same suit, there must be a gap of at least 2 cards
 * between them. This prevents players from splitting what could be a single
 * longer run into two separate runs to satisfy the contract.
 *
 * Valid: 3♠-6♠ and 9♠-Q♠ (gap of 7♠-8♠ = 2 cards)
 * Invalid: 3♠-6♠ and 8♠-J♠ (gap of only 7♠ = 1 card)
 * Invalid: 3♠-6♠ and 7♠-10♠ (adjacent, gap = 0)
 * Invalid: 3♠-6♠ and 5♠-8♠ (overlapping, gap < 0)
 *
 * @param runs - Array of run melds to check
 * @returns Validation result
 */
function validateSameSuitRunGap(runs: Meld[]): ContractValidationResult {
  // Group runs by suit
  const runsBySuit = new Map<string, Array<{ meld: Meld; lowValue: number; highValue: number }>>();

  for (const run of runs) {
    const bounds = getRunBounds(run.cards);
    if (!bounds) {
      // All-wild run - skip (cannot determine suit)
      continue;
    }

    const suitKey = bounds.suit ?? "unknown";
    const existing = runsBySuit.get(suitKey) ?? [];
    existing.push({ meld: run, lowValue: bounds.lowValue, highValue: bounds.highValue });
    runsBySuit.set(suitKey, existing);
  }

  // Check each suit that has 2+ runs
  for (const [suit, suitRuns] of runsBySuit) {
    if (suitRuns.length < 2) {
      continue;
    }

    // Check all pairs of runs in this suit
    for (let i = 0; i < suitRuns.length; i++) {
      for (let j = i + 1; j < suitRuns.length; j++) {
        const run1 = suitRuns[i]!;
        const run2 = suitRuns[j]!;

        // Calculate gap: the number of ranks between the runs
        // gap = max(low1, low2) - min(high1, high2) - 1
        const lower = run1.highValue < run2.highValue ? run1 : run2;
        const upper = run1.highValue < run2.highValue ? run2 : run1;
        const gap = upper.lowValue - lower.highValue - 1;

        if (gap < 2) {
          let errorDescription: string;
          if (gap < 0) {
            errorDescription = "overlap";
          } else if (gap === 0) {
            errorDescription = "are adjacent (no gap)";
          } else {
            errorDescription = "have only 1 card gap";
          }

          return {
            valid: false,
            error: `Same-suit runs of ${suit} ${errorDescription}. Runs of the same suit must have a gap of at least 2 cards between them.`,
          };
        }
      }
    }
  }

  return { valid: true };
}
