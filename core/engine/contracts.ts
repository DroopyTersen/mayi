/**
 * Contract definitions for May I? card game
 *
 * Each round has a specific contract that must be met to lay down.
 */

import type { RoundNumber } from "./engine.types";
import type { Meld } from "../meld/meld.types";
import { isValidSet, isValidRun } from "../meld/meld.validation";

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

  return { valid: true };
}
