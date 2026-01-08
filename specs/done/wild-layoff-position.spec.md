# Wild Card Lay-Off Position Selection

## Problem Statement

When laying off a **wild card** (2 or Joker) onto a run, the player currently has no way to specify whether the wild should extend the run at the **start** (low end) or **end** (high end). The system always appends to the high end, which can prevent strategic plays.

### Example Scenario

```
Current run on table: 5♠ 6♠ 7♠ 8♠
Player's hand: 3♠, 2♣ (wild)

Player wants to:
1. Lay off the 2♣ as a 4♠ (extending the LOW end)
2. Then lay off their 3♠

Desired result: 3♠ [2♣→4♠] 5♠ 6♠ 7♠ 8♠

Current behavior:
- System always appends → 2♣ becomes 9♠
- Player cannot lay off their 3♠ (no room at low end)
- Result: 5♠ 6♠ 7♠ 8♠ [2♣→9♠]
```

This limitation prevents valid strategic plays and doesn't match how the physical card game works.

---

## Current Implementation Analysis

### What Exists

1. **`getRunInsertPosition()` in `core/engine/layoff.ts:250-308`**
   - Returns `"low" | "high" | null`
   - For wilds that fit both ends, defaults to `"high"` (line 302-304)
   - **This function is never actually called**

2. **`layOff` action in `core/engine/turn.machine.ts:563-588`**
   - Always appends cards: `[...meld.cards, card]`
   - Comment acknowledges: "more sophisticated positioning can be added"

3. **LAY_OFF event type** (`turn.machine.ts:80`)
   ```typescript
   { type: "LAY_OFF"; playerId?: string; cardId: string; meldId: string }
   ```
   - No position parameter

4. **Wire protocol** (`app/party/protocol.types.ts:137`)
   ```typescript
   z.object({ type: z.literal("LAY_OFF"), cardId: z.string(), meldId: z.string() })
   ```
   - No position parameter

5. **CLI adapter** (`cli/shared/cli-game-adapter.ts:147`)
   ```typescript
   layOff(cardPosition: number, meldNumber: number): GameSnapshot
   ```
   - No position parameter

### Key Insight

The validation logic already knows which ends a card can fit (`canLayOffToRun` calculates `fitsLow` and `fitsHigh`). The gap is:
1. Not exposing this choice to the user
2. Not using the position when inserting the card

---

## Proposed Solution

### Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Position naming | `"start" \| "end"` | More intuitive than "low/high" |
| Default behavior | `"end"` | Backward compatible (current behavior) |
| Natural cards | Auto-determined | Can only fit one end, no choice needed |
| When to prompt | Wild fits both ends | Only case where choice matters |

### Position Semantics

- **`"start"`** = prepend to run (low end, smaller rank)
- **`"end"`** = append to run (high end, larger rank)

For a run like `5♠ 6♠ 7♠ 8♠`:
- `"start"` → wild becomes 4♠, placed before the 5
- `"end"` → wild becomes 9♠, placed after the 8

---

## Implementation Plan

### Phase 1: Core Engine Changes

#### 1.1 Update LAY_OFF Event Type
**File:** `core/engine/turn.machine.ts`

```typescript
// Before
| { type: "LAY_OFF"; playerId?: string; cardId: string; meldId: string }

// After
| { type: "LAY_OFF"; playerId?: string; cardId: string; meldId: string; position?: "start" | "end" }
```

#### 1.2 Update `layOff` Action
**File:** `core/engine/turn.machine.ts` (lines 563-588)

```typescript
layOff: assign({
  // ... hand update unchanged ...
  table: ({ context, event }) => {
    if (event.type !== "LAY_OFF") return context.table;

    const card = context.hand.find((c) => c.id === event.cardId);
    if (!card) return context.table;

    return context.table.map((meld) => {
      if (meld.id !== event.meldId) return meld;

      if (meld.type === "set") {
        // Sets: order doesn't matter
        return { ...meld, cards: [...meld.cards, card] };
      } else {
        // Runs: determine position
        const insertPosition = resolveRunInsertPosition(card, meld, event.position);
        if (insertPosition === "start") {
          return { ...meld, cards: [card, ...meld.cards] };
        } else {
          return { ...meld, cards: [...meld.cards, card] };
        }
      }
    });
  },
}),
```

#### 1.3 Add Position Resolution Logic
**File:** `core/engine/layoff.ts`

```typescript
/**
 * Resolves the insert position for a card being laid off to a run.
 *
 * @param card - The card being laid off
 * @param meld - The target run
 * @param requestedPosition - User's requested position (optional)
 * @returns "start" | "end"
 *
 * Logic:
 * - Natural cards: auto-determined (can only fit one end)
 * - Wilds with requested position: use requested (if valid)
 * - Wilds without requested position: default to "end"
 */
export function resolveRunInsertPosition(
  card: Card,
  meld: Meld,
  requestedPosition?: "start" | "end"
): "start" | "end" {
  const autoPosition = getRunInsertPosition(card, meld);

  // Natural card or wild that only fits one end
  if (!isWild(card) || autoPosition === "low" || autoPosition === "high") {
    // Map internal "low"/"high" to external "start"/"end"
    return autoPosition === "low" ? "start" : "end";
  }

  // Wild that fits both ends
  if (requestedPosition) {
    return requestedPosition;
  }

  // Default to "end" for backward compatibility
  return "end";
}
```

#### 1.4 Update GameEngine Public API
**File:** `core/engine/game-engine.ts`

```typescript
// Before
layOff(playerId: string, cardId: string, meldId: string): GameSnapshot

// After
layOff(playerId: string, cardId: string, meldId: string, position?: "start" | "end"): GameSnapshot
```

#### 1.5 Add Helper to Check if Position Choice is Needed
**File:** `core/engine/layoff.ts`

```typescript
/**
 * Checks if a wild card can be laid off at both ends of a run,
 * meaning the user should be prompted to choose a position.
 */
export function needsPositionChoice(card: Card, meld: Meld): boolean {
  if (!isWild(card)) return false;
  if (meld.type !== "run") return false;

  const bounds = getRunBounds(meld.cards);
  if (!bounds) return false;

  const canExtendStart = bounds.lowValue > 3;
  const canExtendEnd = bounds.highValue < 14;

  return canExtendStart && canExtendEnd;
}
```

### Phase 2: Wire Protocol Changes

**File:** `app/party/protocol.types.ts`

```typescript
// Before
z.object({ type: z.literal("LAY_OFF"), cardId: z.string(), meldId: z.string() }),

// After
z.object({
  type: z.literal("LAY_OFF"),
  cardId: z.string(),
  meldId: z.string(),
  position: z.enum(["start", "end"]).optional()
}),
```

**File:** `app/party/game-actions.ts`

Update the LAY_OFF handler to pass position to engine.

### Phase 3: CLI Changes

#### 3.1 Agent Harness
**File:** `cli/play.ts`

```bash
# Current
bun cli/play.ts <game-id> layoff <card-position> <meld-number>

# Proposed (optional 4th arg)
bun cli/play.ts <game-id> layoff <card-position> <meld-number> [start|end]
```

When position is omitted:
- If wild can fit both ends → default to "end"
- AI agents can specify position explicitly

#### 3.2 Interactive CLI
**File:** `cli/interactive/interactive.ts`

When laying off a wild that can fit both ends, prompt:

```
Your 2♣ can extend this run at either end:
  - As 4♠ at the START (before 5♠)
  - As 9♠ at the END (after 8♠)

Where do you want to place it? [s]tart / [e]nd:
```

#### 3.3 CLI Adapter
**File:** `cli/shared/cli-game-adapter.ts`

```typescript
// Before
layOff(cardPosition: number, meldNumber: number): GameSnapshot

// After
layOff(cardPosition: number, meldNumber: number, position?: "start" | "end"): GameSnapshot
```

### Phase 4: Web App Changes

#### 4.1 LayOffView Component
**File:** `app/ui/lay-off-view/LayOffView.tsx`

Current behavior: User clicks a card, then clicks a meld.

New behavior for wilds that fit both ends:
1. User selects a wild card from hand
2. For runs where the wild fits both ends, show **clickable zones** on both sides
3. User clicks the left side (start) or right side (end) of the run
4. That determines the position

Visual approach:
```
            ↓ click here for START
    [+] [5♠] [6♠] [7♠] [8♠] [+]
                              ↑ click here for END
```

The `[+]` zones only appear when:
- The selected card is wild
- The wild can extend at that end

#### 4.2 Callback Signature
```typescript
// Before
onLayOff: (cardId: string, meldId: string) => void

// After
onLayOff: (cardId: string, meldId: string, position?: "start" | "end") => void
```

---

## Test Cases to Add

### Core Engine Tests

```typescript
describe("wild lay-off position", () => {
  it("should prepend wild to run when position is 'start'", () => {
    // Run: 5♠ 6♠ 7♠ 8♠
    // Lay off 2♣ with position: "start"
    // Result: [2♣] 5♠ 6♠ 7♠ 8♠ (2♣ acts as 4♠)
  });

  it("should append wild to run when position is 'end'", () => {
    // Run: 5♠ 6♠ 7♠ 8♠
    // Lay off 2♣ with position: "end"
    // Result: 5♠ 6♠ 7♠ 8♠ [2♣] (2♣ acts as 9♠)
  });

  it("should default to 'end' when position not specified for wild", () => {
    // Backward compatibility
  });

  it("should auto-determine position for natural cards", () => {
    // Natural 4♠ can only go at start
    // Natural 9♠ can only go at end
  });

  it("should ignore position parameter for natural cards", () => {
    // Even if position: "end" is passed for 4♠, it should go at start
  });

  it("should handle wild at boundary (run starts at 3)", () => {
    // Run: 3♠ 4♠ 5♠ 6♠
    // Wild can only go at end (nothing below 3)
  });

  it("should handle wild at boundary (run ends at Ace)", () => {
    // Run: J♠ Q♠ K♠ A♠
    // Wild can only go at start (nothing above Ace)
  });
});

describe("needsPositionChoice", () => {
  it("returns true for wild that fits both ends", () => {});
  it("returns false for wild that fits only one end", () => {});
  it("returns false for natural cards", () => {});
  it("returns false for sets", () => {});
});
```

### CLI Tests

```typescript
describe("CLI layoff with position", () => {
  it("accepts optional position argument", () => {});
  it("defaults to 'end' when position omitted", () => {});
  it("interactive mode prompts when wild fits both ends", () => {});
});
```

---

## Files to Modify (Summary)

| File | Change Type | Priority |
|------|-------------|----------|
| `core/engine/layoff.ts` | Add `resolveRunInsertPosition`, `needsPositionChoice` | P0 |
| `core/engine/turn.machine.ts` | Update LAY_OFF event type and action | P0 |
| `core/engine/game-engine.ts` | Update `layOff()` method signature | P0 |
| `core/engine/layoff.test.ts` | Add position-related tests | P0 |
| `app/party/protocol.types.ts` | Add optional position to schema | P1 |
| `app/party/game-actions.ts` | Pass position to engine | P1 |
| `cli/shared/cli-game-adapter.ts` | Add position parameter | P1 |
| `cli/play.ts` | Accept position as CLI arg | P2 |
| `cli/interactive/interactive.ts` | Prompt for position | P2 |
| `app/ui/lay-off-view/LayOffView.tsx` | Add clickable zones UI | P2 |
| `docs/agent-game-harness.md` | Document new CLI syntax | P3 |

---

## Migration / Backward Compatibility

- **No breaking changes**: Position is optional everywhere
- **Default behavior preserved**: Omitting position = "end" (current behavior)
- **API versioning**: Not needed (additive change only)

---

## Open Questions

1. **GO_OUT action**: The `GO_OUT` event also performs lay-offs via `finalLayOffs: LayOffSpec[]`. Should `LayOffSpec` include position?
   - Current type: `{ cardId: string; meldId: string }`
   - Recommendation: Yes, add optional position for consistency

2. **Activity log**: Should the log entry include which end was chosen?
   - Example: "Player laid off 2♣ → meld 3 (as 4♠ at start)"
   - Recommendation: Yes, for clarity

3. **AI players**: How should AI agents decide which end to use?
   - The AI already has full visibility into melds
   - It can calculate which end enables more plays
   - Recommendation: Let AI specify position explicitly when calling layoff

---

## Appendix: Position Calculation Details

### How Runs Determine Card Positions

A run's bounds are calculated from the **first natural card** as an anchor:

```typescript
// From meld.joker.ts
const startValue = anchorValue - anchorPosition;

// Example: Run [Joker, 6♠, 7♠, 8♠]
// First natural: 6♠ at index 1, value 6
// Start value: 6 - 1 = 5
// Joker at index 0: acts as rank (5 + 0) = 5♠
```

When a wild is **prepended** (start):
- It becomes index 0
- All other cards shift right
- Its rank = old startValue - 1

When a wild is **appended** (end):
- It becomes the last index
- Its rank = old endValue + 1

### Rank Value Boundaries

- Minimum: 3 (value 3)
- Maximum: Ace (value 14)
- 2s are wild (never in a run as their natural rank)
