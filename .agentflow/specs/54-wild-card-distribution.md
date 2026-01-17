# Spec: #54 - Verify wild card distribution is statistically random

**Date:** 2026-01-17
**Type:** Bug verification
**Approach:** Pragmatic (Claude)

## Overview

Create statistical verification tests to confirm the shuffle/deal algorithm produces random wild card distribution. One-time verification task.

## Files to Create

| File | Purpose |
|------|---------|
| `core/card/card.distribution.test.ts` | Statistical verification test for wild card distribution |

## Implementation

Single test file with:
1. Monte Carlo simulation (10,000+ iterations)
2. Inline chi-squared test with Wilson-Hilferty p-value approximation
3. Two tests: uniform distribution + no positional bias
4. Pass criteria: p-value > 0.01 (99% confidence)

## Key Functions

```typescript
// Wilson-Hilferty approximation for chi-squared p-value
function chiSquaredPValue(chiSquared: number, df: number): number

// Standard normal CDF approximation (Abramowitz-Stegun)
function normalCDF(z: number): number

// Monte Carlo simulation
function simulateDeals(iterations: number, players: number, cardsPerPlayer: number): number[]
```

## Verification

```bash
bun run typecheck
bun test core/card/card.distribution.test.ts
bun run build
```
