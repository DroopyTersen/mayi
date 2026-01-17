# Tech Design: Action Unavailability Hints (Info Icon with Popover)

**Issue:** #37 - Lay Off button missing after drawing when already down
**Type:** Enhancement (UX clarity)
**Date:** 2026-01-16
**Selected Approach:** Option C - Info Icon with Popover

## Problem Summary

Users are confused when actions are unavailable but not visible. The UI shows/hides buttons based on availability, but provides no explanation for WHY an action is unavailable. This leads users to think there's a bug when the behavior is actually correct per house rules.

## Selected Approach

Add a small info icon (ⓘ) next to the action bar. Clicking it shows a popover listing currently unavailable actions with explanations.

**Visual (when clicked):**
```
[Discard] ⓘ
          ↓ (on click)
┌─────────────────────────────────┐
│ Unavailable this turn:          │
│ • Lay Off - available next turn │
│ • Swap Joker - already down     │
└─────────────────────────────────┘
```

## Design Decisions

### 1. Hint Derivation Strategy

**Approach:** Create a new function `getUnavailabilityHints()` that:
- Takes the same inputs as `getAvailableActions()` (snapshot + playerId)
- Returns a list of `{action: string, reason: string}` tuples
- Only includes actions that are conceptually relevant but currently blocked

**Key insight:** Don't return hints for actions that are NEVER available in the current context (e.g., "Lay Off" when not down yet isn't a hint - it's expected). Only return hints when:
- The player has "unlocked" the action in some way (e.g., has laid down)
- The action is temporarily blocked (e.g., same turn as laying down)

### 2. Hint Categories Based on House Rules

| Action | When to Show Hint | Reason Text |
|--------|-------------------|-------------|
| Lay Off | Player is down AND laidDownThisTurn | "Lay off available next turn" |
| Lay Off | Player is NOT down AND hasDrawn | "Lay down contract first" |
| Swap Joker | Player is down AND runs with jokers exist | "Can only swap before laying down" |
| Draw Discard | Player is down AND AWAITING_DRAW | "Must draw from stock when down" |

### 3. No Hint Scenarios

Don't show hints when:
- Not your turn (you're just waiting)
- Round 6 special rules apply (lay off doesn't exist)
- Action is genuinely available (canLayOff: true)
- Action is fundamentally inapplicable (no runs with jokers on table)

## Technical Design

### Files to Create

| File | Purpose |
|------|---------|
| `core/engine/game-engine.hints.ts` | Hint derivation logic |
| `core/engine/game-engine.hints.test.ts` | Unit tests for hint logic |
| `app/ui/action-bar/ActionInfoButton.tsx` | Info icon + popover component |
| `app/ui/action-bar/ActionInfoButton.test.tsx` | Component tests |

### Files to Modify

| File | Changes |
|------|---------|
| `core/engine/game-engine.availability.ts` | Export helper types |
| `core/engine/game-engine.types.ts` | Add `UnavailabilityHint` type |
| `app/ui/action-bar/ActionBar.tsx` | Add ActionInfoButton |

### Interface Design

```typescript
// core/engine/game-engine.hints.ts

export interface UnavailabilityHint {
  /** Action name (human-readable) */
  action: string;
  /** Why it's unavailable (short, clear) */
  reason: string;
}

/**
 * Get hints explaining why certain actions are unavailable.
 *
 * Only returns hints for actions that are:
 * 1. Conceptually available to the player (they've "unlocked" it)
 * 2. Temporarily blocked due to house rules
 *
 * Does NOT return hints for:
 * - Actions the player hasn't unlocked yet (e.g., lay off before being down)
 * - Actions during May I resolution (different UI)
 * - Not your turn scenarios
 */
export function getUnavailabilityHints(
  snapshot: GameSnapshot,
  playerId: string
): UnavailabilityHint[];
```

### Hint Logic (pseudo-code)

```typescript
function getUnavailabilityHints(snapshot, playerId): UnavailabilityHint[] {
  const hints: UnavailabilityHint[] = [];
  const player = snapshot.players.find(p => p.id === playerId);
  const isYourTurn = snapshot.awaitingPlayerId === playerId;
  const isRound6 = snapshot.currentRound === 6;

  // Only show hints during your turn
  if (!isYourTurn || snapshot.phase !== "ROUND_ACTIVE") {
    return [];
  }

  // Hint: Lay Off blocked because laid down this turn
  if (player.isDown && snapshot.laidDownThisTurn && !isRound6 && snapshot.table.length > 0) {
    hints.push({
      action: "Lay Off",
      reason: "Available next turn"
    });
  }

  // Hint: Lay Off blocked because not down yet (only after drawing)
  if (!player.isDown && snapshot.hasDrawn && !isRound6) {
    hints.push({
      action: "Lay Off",
      reason: "Lay down contract first"
    });
  }

  // Hint: Swap Joker blocked because already down
  if (player.isDown && !isRound6 && hasRunWithJoker(snapshot.table)) {
    hints.push({
      action: "Swap Joker",
      reason: "Only before laying down"
    });
  }

  // Hint: Draw Discard blocked because down
  if (player.isDown && snapshot.turnPhase === "AWAITING_DRAW") {
    hints.push({
      action: "Pick Up Discard",
      reason: "Must draw from stock when down"
    });
  }

  return hints;
}
```

### Component Design

```tsx
// app/ui/action-bar/ActionInfoButton.tsx
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "~/shadcn/components/ui/popover";
import { Button } from "~/shadcn/components/ui/button";
import type { UnavailabilityHint } from "core/engine/game-engine.hints";

interface ActionInfoButtonProps {
  hints: UnavailabilityHint[];
}

export function ActionInfoButton({ hints }: ActionInfoButtonProps) {
  // Don't render if no hints
  if (hints.length === 0) {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Info className="h-4 w-4 text-muted-foreground" />
          <span className="sr-only">Action hints</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <div className="space-y-2">
          <p className="text-sm font-medium">Unavailable this turn:</p>
          <ul className="text-sm text-muted-foreground space-y-1">
            {hints.map((hint, i) => (
              <li key={i}>• {hint.action} — {hint.reason}</li>
            ))}
          </ul>
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

## Implementation Sequence

1. **Add shadcn Popover component**
   ```bash
   bunx shadcn@latest add popover
   ```

2. **Create hint derivation logic** (`game-engine.hints.ts`)
   - Define `UnavailabilityHint` interface
   - Implement `getUnavailabilityHints()` function
   - Helper: `hasRunWithJoker(table: Meld[])`

3. **Write comprehensive unit tests** (`game-engine.hints.test.ts`)
   - Test each hint scenario
   - Test no-hint scenarios
   - Test Round 6 special cases
   - Test May I resolution (no hints)

4. **Create ActionInfoButton component**
   - Info icon with popover
   - Only renders when hints exist

5. **Integrate into ActionBar**
   - Import and use `getUnavailabilityHints`
   - Add ActionInfoButton to UI

6. **Add component story** for visual testing

## Test Plan (TDD)

### Unit Tests for `getUnavailabilityHints`

```typescript
describe("getUnavailabilityHints", () => {
  describe("Lay Off hints", () => {
    it("returns 'available next turn' when down and laidDownThisTurn", () => {});
    it("returns 'lay down contract first' when not down and has drawn", () => {});
    it("returns no hint when canLayOff is true", () => {});
    it("returns no hint in Round 6", () => {});
  });

  describe("Swap Joker hints", () => {
    it("returns hint when down and runs with jokers exist", () => {});
    it("returns no hint when not down", () => {});
    it("returns no hint when no runs with jokers", () => {});
    it("returns no hint in Round 6", () => {});
  });

  describe("Draw Discard hints", () => {
    it("returns hint when down and awaiting draw", () => {});
    it("returns no hint when not down", () => {});
    it("returns no hint when not awaiting draw", () => {});
  });

  describe("No hints scenarios", () => {
    it("returns empty when not your turn", () => {});
    it("returns empty during May I resolution", () => {});
    it("returns empty during ROUND_END", () => {});
    it("returns empty during GAME_END", () => {});
  });
});
```

### Integration/UI Tests

| Step | Action | Expected |
|------|--------|----------|
| 1 | Play to point where you lay down | Lay down successful |
| 2 | Check for info icon | Icon appears in action bar |
| 3 | Click info icon | Popover shows "Lay Off — Available next turn" |
| 4 | End turn, start next turn | Info icon gone (can lay off now) |

## Verification Steps

| Step | Command | Expected |
|------|---------|----------|
| Type check | `bun run typecheck` | No errors |
| Unit tests | `bun test core/engine/game-engine.hints.test.ts` | All pass |
| All tests | `bun test` | All pass |
| Build | `bun run build` | Success |
| Dev server | `bun run dev` | Loads without errors |
| Manual test | Play through game | Hints appear correctly |

## Dependencies

- shadcn/ui Popover component (needs to be added)
- lucide-react Info icon (already available)

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Mobile tap behavior for popover | Test on mobile, may need touch-friendly trigger |
| Popover positioning on small screens | shadcn handles this, but verify |
| Too many hints cluttering UI | Design limits hints to relevant scenarios only |
