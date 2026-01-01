# GO_OUT Action Refactor Spec

## Summary

The `GO_OUT` action is unnecessary complexity. The turn machine already handles going out automatically via:
1. `handIsEmpty` guard after LAY_OFF actions
2. `canLayDownAndGoOut` guard for LAY_DOWN with all cards

This spec documents the refactoring needed to remove GO_OUT.

---

## Current State

### What GO_OUT Does

`GO_OUT` is an event in the turn machine that allows a player to lay off ALL remaining cards atomically:

```typescript
// turn.machine.ts:82
{ type: "GO_OUT"; playerId?: string; finalLayOffs: LayOffSpec[] }

// LayOffSpec (turn.machine.ts:65-68)
interface LayOffSpec {
  cardId: string;
  meldId: string;
}
```

### How It Works

1. **Guard** (`canGoOut`, lines 321-360): Simulates all lay-offs in sequence to validate they would all succeed
2. **Action** (`goOut`, lines 591-611): Applies all lay-offs at once, emptying the hand
3. **Transition**: Goes directly to `wentOut` state

### Why It's Unnecessary

The machine already handles going out automatically:

1. **After LAY_OFF** (lines 825-829):
   ```typescript
   always: {
     guard: "handIsEmpty",
     target: "wentOut",
   }
   ```
   If hand is empty after any LAY_OFF, player goes out automatically.

2. **LAY_DOWN with all cards** (lines 766-772):
   ```typescript
   {
     guard: "canLayDownAndGoOut",
     target: "wentOut",
     actions: ["layDown", "clearError"],
   }
   ```

### Not Exposed in Public API

There is NO `goOut()` method in `game-engine.ts`. Tests that use GO_OUT send events directly to the XState actor (internal API).

---

## Refactoring Plan

### Phase 1: Verify Behavior Equivalence

Before removing GO_OUT, verify that individual LAY_OFF actions produce the same outcome:

1. Write tests showing that:
   - Sequential LAY_OFF of all cards → `handIsEmpty` → `wentOut`
   - This is equivalent to GO_OUT behavior

2. Confirm edge cases:
   - What happens if one LAY_OFF in a sequence fails? (Player continues with remaining cards, can discard)
   - Is atomicity actually needed? (No - partial lay-off is fine, player isn't "stuck")

### Phase 2: Update Tests

Tests that use GO_OUT need to be rewritten to use individual LAY_OFF actions instead.

**Files with GO_OUT usage (by occurrence count):**

| File | Count | Notes |
|------|-------|-------|
| `core/engine/turn.machine.phase4.test.ts` | 19 | Heavy usage, needs most work |
| `core/engine/fullGame.test.ts` | 12 | Full game integration tests |
| `core/engine/roundMachine.test.ts` | 5 | Round-level tests |
| `core/engine/goingOut.test.ts` | 3 | Specific going-out scenarios |
| `core/engine/test.fixtures.ts` | 2 | Test helpers |
| `core/engine/roundTransition.test.ts` | 1 | Round transition tests |

### Phase 3: Remove GO_OUT from Machine

**File: `core/engine/turn.machine.ts`**

1. Remove from TurnEvent type (line 82):
   ```typescript
   // DELETE:
   | { type: "GO_OUT"; playerId?: string; finalLayOffs: LayOffSpec[] }
   ```

2. Remove LayOffSpec interface (lines 65-68):
   ```typescript
   // DELETE:
   export interface LayOffSpec {
     cardId: string;
     meldId: string;
   }
   ```

3. Remove `canGoOut` guard (lines 321-360)

4. Remove `goOut` action (lines 591-611)

5. Remove GO_OUT transition from `drawn` state (lines 802-806):
   ```typescript
   // DELETE:
   GO_OUT: {
     guard: "canGoOut",
     target: "wentOut",
     actions: ["goOut", "clearError"],
   },
   ```

### Phase 4: Update Forwarding in Parent Machines

**File: `core/engine/round.machine.ts`**

Check if GO_OUT is forwarded from round machine to turn machine. If so, remove the forwarding.

**File: `core/engine/game.machine.ts`**

Check if GO_OUT is forwarded from game machine. If so, remove.

### Phase 5: Update Documentation

**Files to update:**
- `docs/glossary.md` - Remove `goOut()` reference (line 82)
- `specs/tech-design.md` - Update if GO_OUT is mentioned
- Any other docs mentioning GO_OUT

---

## Test Strategy

### Tests to Add (Before Removal)

```typescript
describe("going out via sequential LAY_OFF", () => {
  it("should go out when all cards are laid off individually", () => {
    // Setup: player is down with 3 cards, all can be laid off
    // Action: LAY_OFF card 1, LAY_OFF card 2, LAY_OFF card 3
    // Assert: player is in wentOut state
  });

  it("should handle partial lay-off gracefully", () => {
    // Setup: player has 3 cards, only 2 can be laid off
    // Action: LAY_OFF card 1 (success), LAY_OFF card 2 (success), LAY_OFF card 3 (fails)
    // Assert: player still has 1 card, can discard to end turn
  });
});
```

### Tests to Rewrite

For each test using GO_OUT:
1. Replace `actor.send({ type: "GO_OUT", finalLayOffs: [...] })`
2. With sequential `actor.send({ type: "LAY_OFF", cardId, meldId })` for each card
3. Verify same end state

---

## Risk Assessment

### Low Risk
- GO_OUT is not in public API, only internal tests use it
- Automatic going-out via `handIsEmpty` is already working
- No external consumers to break

### Medium Risk
- ~68 occurrences across 15 files need updating
- Test files need careful rewriting to maintain coverage

### Mitigation
- Run full test suite after each phase
- Keep both paths working during transition (don't remove until tests pass)

---

## Open Questions

1. **Is atomicity ever needed?** - Can a player get into a state where partial lay-off leaves them worse off than not laying off at all?
   - Current assessment: No - they can always discard to end their turn

2. **Should we keep LayOffSpec for other purposes?** - It might be useful for future features
   - Current assessment: No - it's only used by GO_OUT

---

## Appendix: GO_OUT Occurrences by File

```
specs/wild-layoff-position.spec.md:1
specs/tech-design.md:2
specs/done/xstate-draft.md:2
specs/done/phase-4-tests.md:6
specs/done/initial_backlog.md:3
specs/done/implementation-plan.md:1
core/engine/goingOut.test.ts:3
core/engine/roundTransition.test.ts:1
core/engine/test.fixtures.ts:2
core/engine/turn.machine.ts:7
core/engine/game.machine.ts:2
core/engine/roundMachine.test.ts:5
core/engine/fullGame.test.ts:12
core/engine/turn.machine.phase4.test.ts:19
core/engine/round.machine.ts:2
```

Total: 68 occurrences across 15 files
