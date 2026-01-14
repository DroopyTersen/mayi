# Bug #34: Lay Down causes card duplication and loss

**GitHub Issue:** [#34](https://github.com/DroopyTersen/mayi/issues/34)
**Status:** Investigation complete, fix pending
**Priority:** High
**Platform:** Mobile (iPhone) - Vaul drawer

## Summary

When attempting to lay down a contract on mobile, cards can duplicate uncontrollably (8x K♦ reported) and cards disappear from hand. This is a UI state management bug, NOT an engine bug.

## Reproduction Scenario

- Round 2 contract: 1 set + 1 run
- Hand: 7♠, K♠, 4♦, 6♦, 10♦, K♦, K♦, 5♣, 6♣, 7♣, K♦, 3♣, 2♦
- User attempts:
  - Set: K♠, K♦, K♦
  - Run: 2♦, 5♣, 6♣, 7♣ (2♦ fills 4♣ position as wild)
- First lay down attempt fails, 5♣ disappears from visible hand
- Second attempt: K♦ multiplies to 8 copies in Set 1 area

## Root Cause Analysis

### Confirmed: UI State Persistence Bug

**File:** `app/ui/lay-down-view/LayDownView.tsx` (line 42)

```typescript
const [stagedMelds, setStagedMelds] = useState<StagedMeld[]>(initialStagedMelds ?? defaultMelds);
```

This `useState` only initializes on mount. The ResponsiveDrawer (Vaul/Radix) keeps content mounted for smooth animations.

**Result:**
- When drawer closes and reopens, state persists
- Cards staged in previous attempt remain staged
- Cards appear "missing" from hand (filtered by `stagedCardIds`)

### Platform Difference

| Platform | Component | Behavior |
|----------|-----------|----------|
| Desktop | Dialog | Unmounts on close → state resets ✅ |
| Mobile | Vaul Drawer | Stays mounted → state persists 🐛 |

### K♦ 8x Duplication: Not Reproduced

Possible causes still under investigation:
- Race condition with rapid mobile tapping
- Touch event double-firing
- Some interaction pattern not yet replicated

## Engine Verification

**Test:** `core/engine/laydown.test.ts` - commit `6266856`

The engine correctly handles this exact scenario:
- 2 as wild at START of run (filling 4♣ position)
- Round 2 contract validation passes
- **This is NOT an engine bug**

## Proposed Fix

### Option A: Force remount via key prop

```typescript
// LayDownDrawer.tsx
<LayDownView
  key={open ? "open" : "closed"}
  hand={hand}
  contract={contract}
  ...
/>
```

### Option B: Reset state via useEffect

```typescript
// LayDownView.tsx
useEffect(() => {
  if (open) {
    setStagedMelds(initialStagedMelds ?? defaultMelds);
  }
}, [open]);
```

## Key Files

- `app/ui/lay-down-view/LayDownView.tsx` - state management issue
- `app/ui/lay-down-view/LayDownDrawer.tsx` - wrapper that doesn't force remount
- `core/engine/laydown.test.ts` - added test case proving engine works

## Next Steps

1. Implement fix (Option A or B)
2. Test on actual mobile device
3. Get exact reproduction steps from Jane for the 8x duplication
4. Consider e2e tests for lay down flow

## Current Fix Attempt (In Progress)

- `app/ui/lay-down-view/LayDownDrawer.tsx` now forces `LayDownView` to remount on `open` transitions (and contract changes), which resets staged UI state even when Vaul keeps the drawer mounted.
- `app/ui/lay-down-view/LayDownView.tsx` adds a defensive “already staged” guard to prevent the same `card.id` from being staged multiple times under rapid taps/double-fired events.

## Related

- Commit `6266856`: test(#34): add lay down test for wild at start of run

## Additional Findings (Code Read)

### Why the first attempt “fails” but state still changes

In `app/ui/game-view/GameView.tsx`, `handleLayDown` immediately closes the drawer after emitting the `"layDown"` action:

```ts
onAction?.("layDown", { ... });
setActiveDrawer(null);
```

If the engine later rejects the laydown (invalid melds, race with game state, etc.), the UI has already closed. On mobile, reopening the drawer reuses the mounted `LayDownView`, so the previously staged cards still affect `availableCards` (making cards appear to “disappear” from hand).

### Plausible UI-only path to “8x K♦”

Even without any engine duplication, the UI can stage the same card multiple times under rapid input:

- `LayDownView.handleCardClick` finds the card from `availableCards` and then appends it into the active meld inside a functional `setStagedMelds` update.
- There is no guard inside the state update to prevent adding a `card.id` that’s already staged.
- With fast tapping / touch quirks (or click events firing more than once before React re-renders), multiple queued updates can append the same `card` repeatedly, producing duplicated visuals in the staged meld area.

### Notes on the proposed fixes

- Option B (“reset state via `useEffect`”) is the most direct fix for the persistence bug, but `LayDownView` currently doesn’t receive `open`; either pass `open` down from `LayDownDrawer` or reset in the drawer layer.
- Option A (“force remount via `key`”) can work, but avoid a `Date.now()` key that changes on every render while open; prefer a stable “open instance” key that only changes on `false -> true`.

## Suggested Manual Replication Steps

These are “recipes” to try reproducing both the missing-cards behavior and the reported staged-card duplication on demand.

### Setup (ensure you’re on the buggy codepath)

- Test on an actual iPhone, or set the viewport to `<768px` so `ResponsiveDrawer` uses the Vaul drawer path.
- Desktop width typically won’t reproduce persistence because the Dialog path unmounts on close.

### Recipe A: Reliable “cards disappear after reopen” via engine rejection

Goal: create a laydown that passes the UI’s *length-only* checks but should be rejected by the engine, then reopen the drawer.

1. In a real game where Lay Down is availablectionBar-available, open Lay Down (mobile drawer).
1. In a real game where Lay Down is available, open Lay Down (mobile drawer).
2. Stage melds that satisfy the UI checks but are engine-invalid:
   - For a Set: choose 3 cards that are not all the same rank.
   - For a Run: choose 4 cards that aren’t a valid run (no valid wild substitution).
3. Tap **Lay Down** (button should be enabled because UI only checks `>=3` / `>=4`).
4. Engine rejects; the game state doesn’t change, but `GameView` closes the drawer immediately after emitting `"layDown"`.
5. Reopen Lay Down; previously staged cards may still be staged (on mobile), making them appear “missing” from the hand list.

### Recipe B: Reliable persistence check via Cancel/Swipe-close

Goal: demonstrate that closing the drawer does not reset `LayDownView` state on mobile.

1. Open Lay Down (mobile drawer).
2. Stage 1–2 cards.
3. Close via **Cancel** or swipe down to dismiss.
4. Reopen Lay Down; staged cards may still be staged and therefore filtered out of the visible hand.

### Recipe C: Attempt to force “8x K♦” style duplication (rapid input)

Hypothesis: multiple taps are processed before React re-renders and removes the card from `availableCards`, and there’s no de-dupe guard inside the state updater.

1. Open Lay Down on a slower device (or with CPU throttling if available).
2. Pick a single card in the hand and try:
   - rapid double/triple taps, and/or
   - two-finger near-simultaneous taps on the same card.
3. Watch the staged meld area for the same card appearing multiple times.
4. If using Safari remote debugging, inspect the staged elements and compare `data-card-id` on duplicates:
   - same `card.id` repeated strongly suggests a UI-only rapid-tap duplication path
   - different ids suggests multiple physical copies from multi-deck (expected) rather than duplication

### Recipe D: Contract/round transition with persisted state

Goal: see stale staged state carry across contract changes.

1. Open Lay Down in one round/contract, stage any card, then close.
2. Advance to the next round/contract (or otherwise change contract).
3. Open Lay Down again and check for:
   - staged cards carrying over,
   - incorrect number/type of staging slots,
   - “missing” hand cards due to stale `stagedCardIds`.

### Storybook Harness

- `app/ui/lay-down-view/LayDownBug34Repro.story.tsx` provides a Vaul-based repro harness (no media query dependency).
- Story route: `/storybook/bug-34-lay-down`
