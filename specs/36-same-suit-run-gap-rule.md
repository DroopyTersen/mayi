# Spec: Same-suit Run Gap Rule Validation

**Issue:** #36
**Date:** 2026-01-16
**Status:** Ready for Implementation

## Overview

When a contract requires 2 runs and both runs are of the same suit, there must be a gap of at least 2 cards between them. This prevents players from splitting what could be a single longer run into two separate runs to satisfy the contract.

## Technical Approach

Selected: Blend of Codex Design + Clean Architecture naming

### Files to Create

- `core/meld/meld.bounds.ts` — Shared `getRunBounds()` utility
- `core/meld/meld.bounds.test.ts` — Unit tests for bounds calculation

### Files to Modify

- `core/engine/contracts.ts` — Add `validateSameSuitRunGap()`, call from `validateContractMelds()`
- `core/engine/contracts.test.ts` — TDD test suite for gap rule
- `core/engine/layoff.ts` — Replace local `getRunBounds()` with import from shared module

### Interface

```typescript
// core/meld/meld.bounds.ts

export interface RunBounds {
  lowValue: number;   // Lowest rank value (3-14, A=14)
  highValue: number;  // Highest rank value
  suit: Card["suit"]; // The run's suit
}

export function getRunBounds(cards: Card[]): RunBounds | null;
```

### Gap Rule Logic

For each pair of same-suit runs:
1. Get bounds using `getRunBounds()`
2. Calculate gap: `max(low1, low2) - min(high1, high2) - 1`
3. Require gap >= 2

### Test Coverage

- Bounds calculation with naturals, wilds at start/middle, all-wilds
- Gap rule valid/invalid scenarios
- Regression tests for layoff functionality
