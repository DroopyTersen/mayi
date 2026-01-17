# Spec: Run Meld Normalization (#51)

## Problem
When laying down a run, cards are stored in selection order instead of ascending order.

## Root Cause
The `layDown` action in `turn.machine.ts` builds melds directly from card IDs without calling `normalizeRunCards`. The validation in `guards.ts` uses normalization but discards the result.

## Solution
Apply the same normalization pattern from `guards.ts` (lines 100-108) in the `layDown` action:

```typescript
// For runs, normalize card order (allows selection in any order)
let finalCards = cards;
if (proposal.type === "run") {
  const normalized = normalizeRunCards(cards);
  if (normalized.success) {
    finalCards = normalized.cards;
  }
}
```

## Files to Modify
- `core/engine/turn.machine.ts` - Add normalization in `layDown.table` action

## TDD Plan
1. Write failing test: `layDown` with [9♠, 7♠, 8♠, 10♠] stores as [7♠, 8♠, 9♠, 10♠]
2. Write failing test: wilds placed in correct gap positions
3. Implement fix
4. Verify all tests pass
