# Solution Design: Shared Card-State Invariants

## Summary

Duplicate-card detection exists today, but it is spread across tests, snapshot extraction, and PartyKit AI merge safety code. The invariant is important enough to be centralized.

The improvement is to create a shared card-state invariant module that can validate every physical card location in a snapshot or round state.

## The Issue

The game allows duplicate rank/suit values because it uses multiple decks. It does not allow duplicate physical card IDs. A card ID should not appear in more than one physical location.

Current duplicate handling is scattered:

- `GameEngine` logs duplicate IDs while extracting snapshots.
- PartyKit AI merge code refuses merged snapshots with hand duplicates or hand/pile overlap.
- Tests define local duplicate helper functions.
- Some bug tests manufacture corrupted persisted snapshots.

This makes it harder to answer simple questions:

- Is this state valid?
- Which card ID is duplicated?
- Which zones contain the duplicate?
- Should this action be rejected, logged, or allowed?

It also increases the chance that one path checks hands but misses table melds, while another checks stock/discard overlap but misses hand/table overlap.

## Why A Fix Is Better

A shared invariant checker gives one vocabulary for card corruption:

- `duplicateCardId`
- `handPileOverlap`
- `pilePileOverlap`
- `missingExpectedCard`
- `unexpectedCard`

It can be used consistently:

- in unit tests
- after engine commands
- before persisting PartyKit state
- during snapshot extraction for warnings
- in future repair tools for live corrupted rooms

The goal is not to crash the game whenever a bug exists. The goal is to make corruption detectable, diagnosable, and consistently handled at boundaries.

## What The Fix Looks Like

Create a pure module:

- `core/engine/card-state.invariants.ts`
- `core/engine/card-state.invariants.test.ts`

It should validate a normalized view of card zones:

```ts
interface CardZone {
  id: string;
  label: string;
  cards: Card[];
}

interface CardInvariantViolation {
  type: "duplicate-card-id" | "zone-overlap";
  cardId: string;
  zones: string[];
}

interface CardInvariantReport {
  ok: boolean;
  violations: CardInvariantViolation[];
}

function validateCardZones(zones: CardZone[]): CardInvariantReport;
```

Then add adapters:

```ts
function zonesFromGameSnapshot(snapshot: GameSnapshot): CardZone[];
function zonesFromRoundContext(context: RoundContext): CardZone[];
function zonesFromPersistedEngineSnapshot(snapshotJson: string): CardZone[];
```

## Options Considered

### Option 1: Minimal

Extract the existing `findDuplicateCardIds` helper from `GameEngine`.

Files:

| File | Change |
|------|--------|
| `core/engine/card-state.invariants.ts` | Export `findDuplicateCardIds`. |
| `core/engine/game-engine.ts` | Import helper instead of local function. |

Pros:

- Quick.
- Removes one duplicated helper.

Cons:

- Only reports IDs, not zones.
- Does not support PartyKit persisted snapshot validation well.

### Option 2: Clean

Create a complete invariant and repair subsystem.

Files:

| File | Change |
|------|--------|
| `core/engine/card-state.invariants.ts` | Full invariant reports. |
| `core/engine/card-state.repair.ts` | Optional repair strategies for corrupted rooms. |
| `app/party/state-validation.ts` | Validate before every save. |
| `cli/repair-game-state.ts` | Manual repair command for local/deployed snapshots. |

Pros:

- Best observability.
- Gives a path for repairing live corrupted rooms.

Cons:

- Repair policy can be tricky.
- More code than needed for prevention.

### Option 3: Pragmatic

Build invariant reporting now, skip automated repair.

Files:

| File | Change |
|------|--------|
| `core/engine/card-state.invariants.ts` | Shared zone validation and report formatting. |
| `core/engine/card-state.invariants.test.ts` | Unit tests for hands, piles, and table meld zones. |
| `core/engine/game-engine.ts` | Replace local duplicate warning helper. |
| `app/party/party-game-adapter.ts` | Replace merge-specific duplicate checks with shared validator. |
| `app/party/game-action-executor.ts` | Use validator before save once executor exists. |

Pros:

- Centralizes the invariant without solving repair yet.
- Improves logs and tests immediately.
- Supports later action pipeline and single-owner refactors.

Cons:

- Does not automatically fix existing corrupted rooms.
- Requires callers to decide whether to warn or reject.

## Recommendation

Use Option 3.

Prevention and diagnosis are the immediate needs. Automated repair should be designed separately because choosing which duplicate to remove is a game-rule decision, not a generic invariant decision.

## Coding Plan

### Phase 1: Add Failing Tests

Create `core/engine/card-state.invariants.test.ts`.

Test cases:

- No violations for a valid two-deck state with same rank/suit but different IDs.
- Duplicate physical card ID in two player hands is reported with both hand zones.
- Duplicate physical card ID in a hand and discard is reported with both zones.
- Duplicate physical card ID in stock and table meld is reported.
- Duplicate physical card ID inside the same hand is reported.
- Multiple violations are reported deterministically.

### Phase 2: Implement Zone Validator

Create `core/engine/card-state.invariants.ts`.

Suggested implementation:

```ts
export interface CardZone {
  id: string;
  label: string;
  cards: Card[];
}

export interface CardInvariantViolation {
  type: "duplicate-card-id";
  cardId: string;
  zones: string[];
}

export interface CardInvariantReport {
  ok: boolean;
  violations: CardInvariantViolation[];
}

export function validateCardZones(zones: CardZone[]): CardInvariantReport {
  const seen = new Map<string, string[]>();

  for (const zone of zones) {
    for (const card of zone.cards) {
      const existing = seen.get(card.id) ?? [];
      existing.push(zone.id);
      seen.set(card.id, existing);
    }
  }

  const violations = [...seen.entries()]
    .filter(([, zonesForCard]) => zonesForCard.length > 1)
    .map(([cardId, zonesForCard]) => ({
      type: "duplicate-card-id" as const,
      cardId,
      zones: zonesForCard,
    }));

  return { ok: violations.length === 0, violations };
}
```

Use zone IDs that are stable and useful in logs:

- `hand:player-0`
- `stock`
- `discard`
- `table:meld-3`

### Phase 3: Add Snapshot Zone Builders

Add helpers in the same file or a neighboring file:

```ts
export function zonesFromGameSnapshot(snapshot: GameSnapshot): CardZone[];
export function zonesFromRoundState(input: {
  players: Player[];
  stock: Card[];
  discard: Card[];
  table: Meld[];
}): CardZone[];
```

Keep persisted XState JSON parsing out of the core helper if possible. PartyKit can convert persisted snapshots into zones at its boundary.

### Phase 4: Replace GameEngine Duplicate Warning

In `core/engine/game-engine.ts`:

- Remove local `findDuplicateCardIds`.
- Build zones from the extracted snapshot fields.
- Log a structured invariant report.

Important: keep current behavior of not setting `lastError` from duplicate warnings. That behavior exists so users are not blocked by a corrupted room while trying to continue.

### Phase 5: Replace PartyKit Merge Checks

In `app/party/party-game-adapter.ts`:

- Replace manual hand duplicate and hand/pile overlap loops with `validateCardZones`.
- Keep current behavior: if merged state violates invariants, return fresh state.

This makes the merge helper smaller until the unified action pipeline removes it.

### Phase 6: Validate Before Save

Once `app/party/game-action-executor.ts` exists, validate state before `setState`.

Recommended policy:

- Engine command result violates invariants: reject save and send internal error to caller.
- Existing stored state already violates invariants before action: log violation and avoid making it worse.
- AI stale merge violates invariants: keep fresh state, as current code does.

## Verification Instructions

This work is mostly pure validation code, but it becomes a safety boundary for the engine and PartyKit. Verification must prove the checker is accurate, deterministic, and used consistently without changing existing gameplay behavior.

### Red Test Requirement

Before implementation, add failing tests for the shared invariant API.

Required red tests in `core/engine/card-state.invariants.test.ts`:

- Valid two-deck state with same rank/suit but different IDs returns `ok: true`.
- Same physical card ID in two player hands returns one violation with both hand zones.
- Same physical card ID in hand and discard returns one violation with hand and discard zones.
- Same physical card ID in stock and table meld returns one violation with stock and table zones.
- Same physical card ID duplicated inside one hand returns a violation for that hand zone.
- Multiple duplicate IDs return violations sorted deterministically.
- Empty zones and empty card arrays return `ok: true`.

These tests should fail because the module does not exist yet.

### Unit Tests

Required command:

```bash
bun test core/engine/card-state.invariants.test.ts
```

Required assertions:

- Zone IDs in violations are stable.
- Zone labels are available for logs but tests assert stable IDs.
- Duplicate rank/suit with different IDs is valid.
- Duplicate physical IDs are invalid.
- Table meld cards are included.
- Multiple zones for the same card are deduplicated or intentionally reported in a documented way.
- Report order is deterministic by card ID and zone ID.
- The validator does not mutate input zones or card arrays.

### Engine Integration Tests

Required commands:

```bash
bun test core/engine/game-engine.test.ts --test-name-pattern duplicate
bun test core/engine/game-engine.mayi-duplicate-repro.test.ts
bun test core/engine/game-engine.turn-discard-fallback-duplicate.test.ts
bun test core/engine/game-engine.duplicate-restore.test.ts
```

If test names change or the pattern misses coverage, run the full files:

```bash
bun test core/engine/game-engine.test.ts
bun test core/engine/game-engine.mayi-duplicate-repro.test.ts
bun test core/engine/game-engine.turn-discard-fallback-duplicate.test.ts
bun test core/engine/game-engine.duplicate-restore.test.ts
```

Required assertions:

- Existing corrupted-snapshot tests still log warnings and do not set `lastError`.
- Valid snapshots do not log duplicate warnings.
- Warning content includes card IDs and zones.
- `getSnapshot()` behavior remains compatible with existing UI consumers.
- Restore behavior is unchanged except for better diagnostic reporting.

### PartyKit Integration Tests

Required commands:

```bash
bun test app/party/party-game-adapter.merge.test.ts
bun test app/party/bug-44-may-i-duplicate-cards.test.ts
bun test app/party/game-actions.test.ts
```

Required assertions:

- AI merge still returns fresh state when merged state would duplicate a physical card ID.
- Hand/pile overlap is detected by the shared invariant checker, not by custom loops.
- Valid AI merge states still merge successfully.
- May-I duplicate regression tests still pass.
- Normal game actions are not rejected because of false-positive duplicate rank/suit checks.

### Executor/Save Boundary Tests

If the unified action executor exists, add:

```bash
bun test app/party/game-action-executor.test.ts --test-name-pattern invariant
```

Required scenarios:

- Valid action result saves.
- Invalid action result with duplicate card ID does not save.
- Existing stored state that is already corrupted is reported clearly.
- Caller receives a structured error for a newly corrupted action result.
- Logs include the invariant report.

### CLI Harness Tests

The invariant checker should be usable for custom-state debugging.

Recommended custom-state checks:

1. Create a valid `.data/invariant-valid/game-state.json`.
2. Run `bun cli/play.ts invariant-valid status --json`.
3. Confirm no duplicate warning.
4. Create a deliberately corrupted `.data/invariant-invalid/game-state.json` with one card ID in a hand and discard.
5. Run `bun cli/play.ts invariant-invalid status --json`.
6. Confirm the warning identifies the card ID and both zones.

If the CLI does not expose warnings in a machine-readable way, verify through console output or test-level spy-free log capture already used in existing duplicate tests.

### Web Manual Smoke

Run:

```bash
bun run dev
```

Manual scenarios:

- Start a normal three-player game and play through several turns. No invariant warnings should appear.
- Trigger May-I and claim/allow flows. No invariant warnings should appear.
- Reorder hands repeatedly. No invariant warnings should appear.
- If a dev-only state injection route can inject corrupted state, inject one duplicate card ID and confirm logs identify the zones.

### Code Search Verification

After adoption, run:

```bash
rg -n "findDuplicateCardIds|Duplicate card IDs|handPileOverlap|hasHandPileOverlap|hasStockDiscardOverlap" core app
```

Expected result:

- Duplicate detection in core/app imports the shared invariant module.
- Any remaining custom duplicate logic has a documented reason.
- Test-only local helpers are either removed or intentionally scoped.

### Release Gate

Before merge/deploy:

```bash
bun run typecheck
bun test
bun run build
```

Acceptance criteria:

- Invariant unit tests cover hands, stock, discard, and table melds.
- Existing duplicate regression tests still pass.
- Valid multi-deck duplicate rank/suit cards are not treated as invalid.
- PartyKit merge behavior is unchanged except for using shared reporting.

## Rollout Notes

This should land before or alongside the unified action pipeline. It gives the executor a reliable way to reject corrupted writes.

Do not add automated repair in this change. If repair is needed for live rooms, design it as an explicit operator/admin tool with logs showing exactly which card IDs were removed or moved.
