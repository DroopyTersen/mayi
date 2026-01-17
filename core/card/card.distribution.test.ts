import { describe, it, expect } from "bun:test";
import { createDeck, shuffle, deal } from "./card.deck";
import { isWild } from "./card.utils";
import type { Card } from "./card.types";

/**
 * Statistical verification tests for wild card distribution.
 *
 * These tests verify that the shuffle/deal algorithm produces
 * statistically random wild card distribution using Monte Carlo
 * simulation and chi-squared goodness-of-fit testing.
 *
 * Wild cards = Jokers (4) + Twos (8) = 12 total in 2 decks
 * Expected distribution is uniform across player positions.
 */

// ============================================================================
// Statistical Helper Functions
// ============================================================================

/**
 * Approximation of the standard normal CDF using Abramowitz and Stegun formula.
 * This is accurate to about 4 decimal places.
 */
function normalCDF(z: number): number {
  // Handle extreme values
  if (z < -8) return 0;
  if (z > 8) return 1;

  // Constants for Abramowitz and Stegun approximation (7.1.26)
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = z < 0 ? -1 : 1;
  const absZ = Math.abs(z);

  const t = 1 / (1 + p * absZ);
  const y =
    1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absZ * absZ / 2);

  return 0.5 * (1 + sign * y);
}

/**
 * Calculate chi-squared p-value using Wilson-Hilferty approximation.
 * Returns the probability of observing a chi-squared value >= the given value.
 *
 * This approximation is accurate for df >= 3.
 */
function chiSquaredPValue(chiSquared: number, df: number): number {
  if (df < 1) {
    throw new Error("Degrees of freedom must be >= 1");
  }

  // Wilson-Hilferty approximation
  const h = 2 / (9 * df);
  const cube = Math.pow(chiSquared / df, 1 / 3);
  const z = (cube - (1 - h)) / Math.sqrt(h);

  // P(X² > χ²) = 1 - Φ(z)
  return 1 - normalCDF(z);
}

/**
 * Calculate chi-squared statistic for goodness-of-fit test.
 * Compares observed frequencies to expected frequencies.
 */
function chiSquaredStatistic(observed: number[], expected: number[]): number {
  if (observed.length !== expected.length) {
    throw new Error("Observed and expected arrays must have same length");
  }

  let chiSquared = 0;
  for (let i = 0; i < observed.length; i++) {
    const obs = observed[i] ?? 0;
    const exp = expected[i] ?? 0;
    if (exp > 0) {
      chiSquared += Math.pow(obs - exp, 2) / exp;
    }
  }

  return chiSquared;
}

// ============================================================================
// Simulation Functions
// ============================================================================

interface SimulationResult {
  /** Total wild cards received by each player position across all deals */
  wildCountsByPosition: number[];
  /** Total deals simulated */
  totalDeals: number;
  /** Total wild cards dealt (across all deals, all players) */
  totalWildsDealt: number;
}

/**
 * Simulate many deals and count wild cards received by each player position.
 */
function simulateDeals(
  iterations: number,
  playerCount: number
): SimulationResult {
  const wildCountsByPosition: number[] = Array(playerCount).fill(0);
  let totalWildsDealt = 0;

  for (let i = 0; i < iterations; i++) {
    // Create and shuffle deck (2 decks + 4 jokers for 4 players)
    const deck = createDeck({ deckCount: 2, jokerCount: 4 });
    const shuffled = shuffle(deck);
    const { hands } = deal(shuffled, playerCount);

    // Count wilds per player position
    for (let p = 0; p < playerCount; p++) {
      const hand = hands[p];
      if (hand) {
        const wildsInHand = hand.filter(isWild).length;
        wildCountsByPosition[p] = (wildCountsByPosition[p] ?? 0) + wildsInHand;
        totalWildsDealt += wildsInHand;
      }
    }
  }

  return {
    wildCountsByPosition,
    totalDeals: iterations,
    totalWildsDealt,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe("Wild Card Distribution", () => {
  // Number of iterations for Monte Carlo simulation
  // 10,000 provides good statistical power while keeping test runtime reasonable
  const ITERATIONS = 10_000;
  const PLAYER_COUNT = 4;

  // Significance level (α = 0.01 means 99% confidence)
  // We use a high confidence level to avoid false positives
  const SIGNIFICANCE_LEVEL = 0.01;

  describe("uniform distribution across players", () => {
    it("wild cards are evenly distributed across all player positions (chi-squared test, p > 0.01)", () => {
      const result = simulateDeals(ITERATIONS, PLAYER_COUNT);

      // Calculate expected value for each position
      // Total wilds dealt / number of positions = expected wilds per position
      const expectedPerPosition = result.totalWildsDealt / PLAYER_COUNT;
      const expected = Array(PLAYER_COUNT).fill(expectedPerPosition);

      // Calculate chi-squared statistic
      const chiSquared = chiSquaredStatistic(
        result.wildCountsByPosition,
        expected
      );

      // Degrees of freedom = number of categories - 1
      const df = PLAYER_COUNT - 1;

      // Calculate p-value
      const pValue = chiSquaredPValue(chiSquared, df);

      // Log results for visibility
      console.log("\n=== Wild Card Distribution Test ===");
      console.log(`Iterations: ${ITERATIONS}`);
      console.log(`Players: ${PLAYER_COUNT}`);
      console.log(`Total wilds dealt: ${result.totalWildsDealt}`);
      console.log(`Expected wilds per position: ${expectedPerPosition.toFixed(2)}`);
      console.log("\nWilds by position:");
      for (let i = 0; i < PLAYER_COUNT; i++) {
        const count = result.wildCountsByPosition[i] ?? 0;
        const pct = ((count / result.totalWildsDealt) * 100).toFixed(2);
        console.log(`  Player ${i + 1}: ${count} (${pct}%)`);
      }
      console.log(`\nChi-squared statistic: ${chiSquared.toFixed(4)}`);
      console.log(`Degrees of freedom: ${df}`);
      console.log(`P-value: ${pValue.toFixed(6)}`);
      console.log(
        `Significance level: ${SIGNIFICANCE_LEVEL} (${(1 - SIGNIFICANCE_LEVEL) * 100}% confidence)`
      );
      console.log(`Result: ${pValue > SIGNIFICANCE_LEVEL ? "PASS" : "FAIL"}`);
      console.log("===================================\n");

      // Test passes if p-value > significance level
      // This means we cannot reject the null hypothesis that distribution is uniform
      expect(pValue).toBeGreaterThan(SIGNIFICANCE_LEVEL);
    });
  });

  describe("no first-player position bias", () => {
    it("first player does not receive significantly more or fewer wild cards than average", () => {
      const result = simulateDeals(ITERATIONS, PLAYER_COUNT);

      // Calculate average wilds per position
      const averageWildsPerPosition = result.totalWildsDealt / PLAYER_COUNT;

      // First player's wild count
      const firstPlayerWilds = result.wildCountsByPosition[0] ?? 0;

      // Calculate percentage difference from average
      const percentDiff =
        ((firstPlayerWilds - averageWildsPerPosition) / averageWildsPerPosition) *
        100;

      console.log("\n=== First Player Bias Test ===");
      console.log(`First player wilds: ${firstPlayerWilds}`);
      console.log(`Average per position: ${averageWildsPerPosition.toFixed(2)}`);
      console.log(`Difference from average: ${percentDiff.toFixed(2)}%`);

      // Allow up to 5% deviation from average (reasonable for 10k iterations)
      // With 10,000 deals and ~6 wilds per deal distributed among 4 players,
      // we expect ~15,000 wilds per position, so 5% would be 750 cards difference
      const MAX_PERCENT_DEVIATION = 5;

      console.log(`Max allowed deviation: ±${MAX_PERCENT_DEVIATION}%`);
      console.log(
        `Result: ${Math.abs(percentDiff) <= MAX_PERCENT_DEVIATION ? "PASS" : "FAIL"}`
      );
      console.log("==============================\n");

      expect(Math.abs(percentDiff)).toBeLessThanOrEqual(MAX_PERCENT_DEVIATION);
    });
  });

  describe("multiple rounds do not introduce bias", () => {
    it("distribution remains uniform when simulating multiple consecutive rounds", () => {
      // Simulate deals representing multiple rounds (3 rounds × 1000 games)
      // This tests if any state carries over between deals
      const GAMES = 1000;
      const ROUNDS_PER_GAME = 3;

      const wildCountsByPosition: number[] = Array(PLAYER_COUNT).fill(0);
      let totalWildsDealt = 0;

      for (let game = 0; game < GAMES; game++) {
        for (let round = 0; round < ROUNDS_PER_GAME; round++) {
          const deck = createDeck({ deckCount: 2, jokerCount: 4 });
          const shuffled = shuffle(deck);
          const { hands } = deal(shuffled, PLAYER_COUNT);

          for (let p = 0; p < PLAYER_COUNT; p++) {
            const hand = hands[p];
            if (hand) {
              const wildsInHand = hand.filter(isWild).length;
              wildCountsByPosition[p] =
                (wildCountsByPosition[p] ?? 0) + wildsInHand;
              totalWildsDealt += wildsInHand;
            }
          }
        }
      }

      const expectedPerPosition = totalWildsDealt / PLAYER_COUNT;
      const expected = Array(PLAYER_COUNT).fill(expectedPerPosition);

      const chiSquared = chiSquaredStatistic(wildCountsByPosition, expected);
      const df = PLAYER_COUNT - 1;
      const pValue = chiSquaredPValue(chiSquared, df);

      console.log("\n=== Multiple Rounds Test ===");
      console.log(`Games: ${GAMES}, Rounds per game: ${ROUNDS_PER_GAME}`);
      console.log(`Total deals: ${GAMES * ROUNDS_PER_GAME}`);
      console.log(`Chi-squared: ${chiSquared.toFixed(4)}, p-value: ${pValue.toFixed(6)}`);
      console.log(`Result: ${pValue > SIGNIFICANCE_LEVEL ? "PASS" : "FAIL"}`);
      console.log("============================\n");

      expect(pValue).toBeGreaterThan(SIGNIFICANCE_LEVEL);
    });
  });
});
