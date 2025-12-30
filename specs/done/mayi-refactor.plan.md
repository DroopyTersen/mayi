# May I Refactor Plan

## Overview

This document describes a fundamental refactor of how "May I" works in the game engine. The current implementation models May I as a **phase/window** that opens and closes during a turn. The new implementation models May I as a **persistent opportunity** with **interactive resolution** at the round level.

## Problem Statement

### Current Implementation Issues

1. **Conceptual Mismatch**: The current implementation creates a "May I Window" phase that opens when the current player draws from stock. But in the actual game, May I is always available whenever a discard is "exposed" - not just during a specific window.

2. **Over-Engineering**: The current implementation has:
   - A dedicated 280-line `MayIWindowMachine`
   - Complex invoke/onDone/sendTo patterns between turn and May I machines
   - A separate phase in the turn state machine
   - Priority resolution that happens passively (collect claims, resolve later)

3. **Missing Interactive Resolution**: When someone calls May I, players ahead of them in priority should be **prompted** to allow or claim. The current implementation doesn't support this - it just collects claims passively.

4. **Timing Restrictions**: The current implementation only allows May I calls after the current player draws from stock. But the rules allow May I at any point during a turn while the discard is exposed.

### The Real Game Rules

From the house rules (updated during this discussion):

**When is a discard "exposed"?**
- From the moment the previous player discards it
- Until someone claims it (current player draws from discard, or May I winner)

**When can you call May I?**
- BEFORE the current player draws - yes
- AFTER the current player draws from stock - yes
- AFTER the current player draws from discard - no (they claimed it)
- AFTER the current player discards - no (new turn, new exposed card)

**Who is "in line" for the discard?**
- Current player is first in line - but loses spot after drawing from stock
- Then players in turn order after the current player
- **Down players are NOT in line at all** - can't claim AND can't block

**What happens when someone calls May I?**
The matter is settled immediately by checking players ahead of them in line:
- If that player is not in line (down, or current player who drew from stock) → skip
- If that player IS in line → prompt them: "Allow or claim?"
  - If they allow → continue to next player
  - If they claim → they win (caller loses)
- If no one ahead claims → original caller wins

---

## New Architecture

### Key Design Decisions

1. **May I is a round-level concern** - not a turn-level concern
   - It affects multiple players (not just current player)
   - The winner's hand gets updated (a round-level operation)
   - Priority is based on turn order (a round-level concept)

2. **Interactive resolution** - when someone calls May I, we prompt players ahead
   - Each eligible player is asked: "Allow or claim?"
   - This is async - humans may take time to respond
   - AI players respond programmatically

3. **No separate May I machine** - handled inline in round machine
   - Simpler architecture
   - Fewer files to maintain
   - Clearer mental model

4. **Turn machine is simplified** - no May I knowledge
   - Just handles draw/play/discard phases
   - Doesn't know about May I window

5. **Current player claiming during resolution** - treated as DRAW_FROM_DISCARD
   - Forwarded to turn machine
   - No penalty for current player
   - Turn machine updates its state normally

### State Machine Structure

```
RoundMachine
├── dealing (entry: deal cards)
├── active
│   ├── playing (invokes TurnMachine)
│   │   └── on CALL_MAY_I → resolvingMayI
│   └── resolvingMayI
│       ├── checkingNextPlayer (always transitions)
│       ├── waitingForResponse (waits for ALLOW/CLAIM)
│       └── resolved (final)
│           └── onDone → playing (grant cards to winner)
└── scoring (final)
```

### Event Flow

```
1. Carol sends CALL_MAY_I
   ↓
2. Round machine validates (discard exposed, Carol eligible)
   ↓
3. Round machine enters "resolvingMayI" state
   ↓
4. Compute playersToCheck: [Bob, Alice] (in priority order, filtered)
   ↓
5. Check Bob:
   - Is Bob in line? (not down, hasn't passed if current player)
   - If no → skip to next
   - If yes → enter waitingForResponse, prompt Bob
   ↓
6. Bob responds:
   - ALLOW_MAY_I → check next player (Alice)
   - CLAIM_MAY_I → Bob wins, Carol loses
   ↓
7. Check Alice:
   - Same logic...
   ↓
8. All players checked, no one claimed:
   - Carol wins (original caller)
   ↓
9. Grant cards to winner:
   - Winner gets discard + penalty card from stock
   - Update hands, piles
   ↓
10. Return to "playing" state
    - Turn continues where it left off
```

### Special Case: Current Player Claiming

If Bob is the current player, hasn't drawn yet, and chooses CLAIM_MAY_I:
- This is equivalent to Bob drawing from discard
- Forward `DRAW_FROM_DISCARD` to turn machine
- Turn machine updates: `hasDrawn = true`, card added to hand
- No penalty for Bob
- Resolution ends with `outcome: 'current_player_claimed'`

---

## Context Structure

### Round Machine Context Additions

```typescript
interface RoundContext {
  // ... existing fields ...

  /**
   * Tracks an active May I resolution.
   * null when no resolution in progress.
   */
  mayIResolution: MayIResolution | null;

  /**
   * Whether the exposed discard has been claimed this turn.
   * Reset to false when current player discards (new card exposed).
   */
  discardClaimed: boolean;
}

interface MayIResolution {
  /** Player who initiated the May I call */
  originalCaller: string;

  /** The card being claimed (snapshot) */
  cardBeingClaimed: Card;

  /** Players ahead of caller to check, in priority order */
  playersToCheck: string[];

  /** Index into playersToCheck */
  currentPromptIndex: number;

  /** Player currently being prompted (null if between checks) */
  playerBeingPrompted: string | null;

  /** Players who explicitly allowed */
  playersWhoAllowed: string[];

  /** The winner (set when resolution completes) */
  winner: string | null;

  /** How resolution ended */
  outcome: 'caller_won' | 'blocked' | 'current_player_claimed' | null;
}
```

### Game State View for UI/CLI/AI

```typescript
interface GameStateView {
  // ... existing fields ...

  mayIResolution: {
    caller: { id: string; name: string };
    card: Card;
    awaitingResponse: { id: string; name: string } | null;
    playersWhoAllowed: { id: string; name: string }[];
    availableActions: ('allow' | 'claim')[];
  } | null;
}
```

---

## Test Files Inventory

### Dedicated May I Test Files (~5,040 lines total)

These files test the current May I window implementation and will need significant changes:

| File | Lines | Impact | Recommendation |
|------|-------|--------|----------------|
| `core/engine/mayIWindow.test.ts` | 1,035 | **DELETE** | Tests the `mayIWindowMachine` which we're removing entirely |
| `core/engine/mayIPriority.test.ts` | 282 | **DELETE** | Priority logic moves to round machine; rewrite tests there |
| `core/engine/mayIActions.test.ts` | 381 | **DELETE** | Tests window actions; new actions will be in round machine |
| `core/engine/mayIRules.test.ts` | 625 | **SALVAGE** | Eligibility rules still apply; adapt tests for new architecture |
| `core/engine/mayIIntegration.test.ts` | 1,035 | **REWRITE** | End-to-end scenarios still valuable; rewrite for interactive flow |
| `core/engine/turnMachine.mayI.test.ts` | 318 | **DELETE** | Turn machine no longer knows about May I |
| `core/engine/roundMachine.mayI.test.ts` | 614 | **REWRITE** | May I now lives here; heavily modify or rewrite |
| `core/engine/turn.mayI.integration.test.ts` | 750 | **DELETE** | Turn machine integration for May I no longer relevant |

### Files with May I References (~14 references each)

These files test other functionality but include May I scenarios:

| File | Lines | May I Refs | Impact |
|------|-------|------------|--------|
| `cli/harness/orchestrator.test.ts` | 673 | ~14 | **UPDATE** - Update for new `allowMayI()`, `claimMayI()` methods |
| `ai/mayIAgent.llm.test.ts` | 501 | Many | **UPDATE** - Update for new tools and phases |
| `core/engine/game-engine.round.test.ts` | - | Some | **UPDATE** - May I integration scenarios |
| `core/engine/machine.hierarchy.test.ts` | - | Some | **UPDATE** - Remove May I window from hierarchy |
| `core/engine/xstate-persistence.test.ts` | - | Some | **UPDATE** - May I state shape changes |
| `core/engine/game-engine.test.ts` | - | Some | **REVIEW** - May need minor updates |
| `core/engine/game-engine.xstate.test.ts` | - | Some | **REVIEW** - May need minor updates |

### Test Strategy Summary

| Action | Files | Lines Affected |
|--------|-------|----------------|
| **DELETE** | 5 files | ~2,766 lines |
| **REWRITE** | 2 files | ~1,649 lines |
| **SALVAGE** | 1 file | ~625 lines |
| **UPDATE** | 5+ files | Partial updates |

---

## Files to Change

### Delete Entirely

| File | Lines | Reason |
|------|-------|--------|
| `core/engine/mayIWindow.machine.ts` | 280 | No longer needed |
| `core/engine/mayIWindow.test.ts` | 1,035 | Tests for deleted machine |
| `core/engine/mayIPriority.test.ts` | 282 | Priority logic moves to round machine |
| `core/engine/mayIActions.test.ts` | 381 | Tests window actions we're removing |
| `core/engine/turnMachine.mayI.test.ts` | 318 | Turn machine no longer knows May I |
| `core/engine/turn.mayI.integration.test.ts` | 750 | Turn-level May I integration obsolete |

### Heavy Modifications

| File | Changes |
|------|---------|
| `core/engine/round.machine.ts` | Add `resolvingMayI` states, May I context, resolution logic |
| `core/engine/turn.machine.ts` | Remove ~150 lines of May I window logic |
| `cli/harness/orchestrator.ts` | Update May I handling for new architecture |
| `cli/interactive/interactive.ts` | Update May I prompts for interactive resolution |
| `ai/mayIAgent.tools.ts` | Update tool definitions for new events |

### Light Modifications

| File | Changes |
|------|---------|
| `core/engine/game.machine.ts` | Update event forwarding (may simplify) |
| `core/engine/engine.types.ts` | Add MayIResolution type |
| `cli/shared/cli.llm-output.ts` | Update state formatting for May I |
| `docs/house-rules.md` | Already updated |
| `docs/xstate-engine.md` | Update architecture docs |

### New Tests Needed

| File | Purpose |
|------|---------|
| `core/engine/round.mayI.test.ts` | New round-level May I tests |
| Integration tests | End-to-end May I resolution scenarios |

---

## Downstream Impact

### 1. CLI Harness Mode

**Current:**
- `mayi` command calls `orchestrator.callMayI()`
- `pass` command calls `orchestrator.pass()`
- May I window cycles through players automatically

**New:**
- `mayi` command triggers resolution
- New commands: `allow`, `claim` for responding to prompts
- Harness needs to show who is being prompted
- JSON output needs `mayIResolution` field

**Commands to Add:**
```bash
bun cli/play.ts <gameId> allow   # Allow the May I caller to have it
bun cli/play.ts <gameId> claim   # Claim it yourself instead
```

### 2. CLI Interactive Mode

**Current:**
- Shows "May I? (card + penalty)" prompt
- Options: "Yes, May I!" / "No thanks"

**New:**
- Two different prompts:
  1. **Calling May I**: "Call May I for [card]?" → Yes/No
  2. **Responding to May I**: "[Player] wants [card]. Allow or claim?" → Allow/Claim

**UI Mockup - Calling:**
```
The Q♠ is available. Call May I?
(You'll get Q♠ + 1 penalty card)

  1. Yes, call May I!
  2. No thanks
```

**UI Mockup - Responding:**
```
Carol called May I for Q♠

  1. Allow (Carol gets Q♠ + penalty)
  2. Claim instead (you get Q♠ + penalty)
```

### 3. AI Agent

**Current:**
- Tools: `call_may_i`, `pass`
- Phase: `MAY_I_WINDOW`
- AI decides whether to call May I

**New:**
- Tools: `call_may_i`, `allow_may_i`, `claim_may_i`
- Phases: `MAY_I_AVAILABLE`, `MAY_I_RESPONDING`
- AI needs to handle two scenarios:
  1. Deciding to initiate a May I call
  2. Responding to someone else's May I call

**Tool Definitions:**
```typescript
call_may_i: tool({
  description: "Call May I to claim the exposed discard card. You'll get the card + 1 penalty card.",
  // Available when: discard exposed, you're eligible, no resolution in progress
}),

allow_may_i: tool({
  description: "Allow another player's May I claim. They get the card.",
  // Available when: you're being prompted during resolution
}),

claim_may_i: tool({
  description: "Claim the card instead of allowing the May I. You get the card + penalty.",
  // Available when: you're being prompted during resolution
}),
```

**Phase Detection Updates:**
```typescript
function getAvailableToolNames(state: GameStateView): string[] {
  if (state.mayIResolution?.awaitingResponse?.id === playerId) {
    // Being prompted to respond
    return ['allow_may_i', 'claim_may_i'];
  }

  if (canCallMayI(state, playerId)) {
    // Can initiate May I (discard exposed, eligible, no resolution)
    return [...turnTools, 'call_may_i'];
  }

  return turnTools;
}
```

### 4. Web App (Future)

The new architecture naturally supports the web app UX:

**Modal for responding player:**
```
┌─────────────────────────────────────────────────────┐
│  Carol wants to May I the Q♠                        │
│                                                     │
│  [ Allow ]              [ Claim Instead ]           │
│                                                     │
│  If you claim, you get Q♠ + 1 penalty card          │
└─────────────────────────────────────────────────────┘
```

**Status for other players:**
```
May I in progress...
Carol called May I for Q♠
Waiting for Alice...
```

---

## Implementation Plan

> **⚠️ TDD APPROACH REQUIRED**
>
> This refactor MUST be implemented using Test-Driven Development:
> 1. Write failing tests FIRST that describe the new behavior
> 2. Implement the minimum code to make tests pass
> 3. Refactor while keeping tests green
>
> For each task, the pattern is: **Test → Implement → Refactor**

### Phase 1: Core Engine Changes (TDD)

#### 1.1 Setup and Types
- [ ] **1.1.1** Add `MayIResolution` type to `engine.types.ts`
- [ ] **1.1.2** Delete obsolete test files (they test the old architecture):
  - `core/engine/mayIWindow.test.ts` (1,035 lines)
  - `core/engine/mayIPriority.test.ts` (282 lines)
  - `core/engine/mayIActions.test.ts` (381 lines)
  - `core/engine/turnMachine.mayI.test.ts` (318 lines)
  - `core/engine/turn.mayI.integration.test.ts` (750 lines)

#### 1.2 Round Machine May I (TDD - write tests first!)
- [ ] **1.2.1** Write failing test: "CALL_MAY_I starts resolution when discard exposed"
- [ ] **1.2.2** Write failing test: "Resolution skips players who are down"
- [ ] **1.2.3** Write failing test: "Resolution skips current player if they drew from stock"
- [ ] **1.2.4** Write failing test: "ALLOW_MAY_I advances to next player"
- [ ] **1.2.5** Write failing test: "CLAIM_MAY_I ends resolution with blocker as winner"
- [ ] **1.2.6** Write failing test: "Original caller wins when all ahead allow"
- [ ] **1.2.7** Write failing test: "Winner receives discard + penalty card"
- [ ] **1.2.8** Write failing test: "Current player CLAIM_MAY_I forwards to turn machine as DRAW_FROM_DISCARD"
- [ ] **1.2.9** Write failing test: "CALL_MAY_I rejected when resolution in progress"
- [ ] **1.2.10** Write failing test: "CALL_MAY_I rejected when discard already claimed"
- [ ] **1.2.11** Implement `resolvingMayI` states in `round.machine.ts` to make tests pass

#### 1.3 Turn Machine Simplification
- [ ] **1.3.1** Write failing test: "DRAW_FROM_STOCK just draws (no May I window)"
- [ ] **1.3.2** Remove May I logic from `turn.machine.ts`:
  - Remove `mayIWindowMachine` import and actor
  - Remove `mayIWindow` state
  - Remove May I context fields (`mayIResult`, `mayIDiscardTop`)
  - Remove May I guards (`shouldOpenMayIWindow`, etc.)
  - Simplify `DRAW_FROM_STOCK` transition
- [ ] **1.3.3** Verify existing turn tests still pass (non-May I functionality)

#### 1.4 Cleanup
- [ ] **1.4.1** Delete `mayIWindow.machine.ts`
- [ ] **1.4.2** Update `game.machine.ts` event forwarding for new events

#### 1.5 Integration Tests (Rewrite)
- [ ] **1.5.1** Rewrite `roundMachine.mayI.test.ts` for new interactive flow
- [ ] **1.5.2** Rewrite `mayIIntegration.test.ts` for end-to-end scenarios:
  - Carol calls May I, Alice allows, Carol wins
  - Carol calls May I, Alice claims, Alice wins
  - Carol calls May I, all ahead are down, Carol auto-wins
  - Current player claims during resolution
  - Multiple rounds with May I interactions
- [ ] **1.5.3** Salvage applicable tests from `mayIRules.test.ts` (eligibility logic)

### Phase 2: Orchestrator Updates (TDD)

#### 2.1 Core Methods
- [ ] **2.1.1** Write failing test: "callMayI() triggers resolution"
- [ ] **2.1.2** Write failing test: "allowMayI() advances resolution"
- [ ] **2.1.3** Write failing test: "claimMayI() ends resolution with claimer winning"
- [ ] **2.1.4** Write failing test: "getStateView() includes mayIResolution when active"
- [ ] **2.1.5** Implement methods in `orchestrator.ts`
- [ ] **2.1.6** Update existing `orchestrator.test.ts` May I tests

#### 2.2 CLI Commands
- [ ] **2.2.1** Add `allow` command to `play.ts`
- [ ] **2.2.2** Add `claim` command to `play.ts`
- [ ] **2.2.3** Update help text and command validation

### Phase 3: Interactive Mode Updates

- [ ] **3.1** Update `interactive.ts` May I handling
  - Separate "call May I" prompt from "respond to May I" prompt
  - Show resolution progress ("Waiting for Alice...")
  - Handle being prompted during someone else's turn
- [ ] **3.2** Update game state display
  - Show May I resolution status
  - Show who is being prompted
- [ ] **3.3** Test manually with interactive mode

### Phase 4: AI Agent Updates (TDD)

#### 4.1 Tools
- [ ] **4.1.1** Write failing test: "allow_may_i tool available when being prompted"
- [ ] **4.1.2** Write failing test: "claim_may_i tool available when being prompted"
- [ ] **4.1.3** Write failing test: "call_may_i tool available when discard exposed"
- [ ] **4.1.4** Implement new tools in `mayIAgent.tools.ts`
- [ ] **4.1.5** Update tool filtering in `mayIAgent.ts`

#### 4.2 State Formatting
- [ ] **4.2.1** Update `cli.llm-output.ts` for May I resolution state
- [ ] **4.2.2** Show who is being prompted in LLM output
- [ ] **4.2.3** Show available actions for prompted player

#### 4.3 Strategy Prompts
- [ ] **4.3.1** Update `mayIAgent.prompt.ts` with allow/claim decision examples
- [ ] **4.3.2** Update existing `mayIAgent.llm.test.ts` for new flow

### Phase 5: Documentation Updates

- [ ] **5.1** Update `xstate-engine.md`
  - New architecture diagram (remove May I window machine)
  - Add round-level May I section
  - Update event flow documentation
- [ ] **5.2** Update `agent-game-harness.md`
  - New commands (`allow`, `claim`)
  - Updated phases (`MAY_I_RESPONDING` vs `MAY_I_AVAILABLE`)
  - Example command flows
- [ ] **5.3** Update `interactive-mode.md`
  - New May I prompt types
  - Response flow diagrams

### Phase 6: Final Verification

- [ ] **6.1** Run full test suite: `bun test`
- [ ] **6.2** Manual testing: CLI harness mode with AI agent
- [ ] **6.3** Manual testing: CLI interactive mode with human
- [ ] **6.4** Verify no regressions in non-May I functionality

---

## Open Questions

1. **Stock empty during penalty**: What if stock is empty when granting penalty card? Current implementation handles this but needs to be preserved.

2. **Reshuffle during May I**: If stock needs reshuffling during resolution, how do we handle it?

3. **Multiple May I calls in one turn**: Can Carol call May I, win, then call May I again for the same exposed discard? (Probably no - the discard is claimed after first win)

4. **Web sockets**: The web app will need real-time updates for May I prompts. The state structure supports this, but implementation details TBD.

---

## Success Criteria

1. **Correctness**: May I behavior matches house rules exactly
2. **Simplicity**: Fewer lines of code, clearer architecture
3. **Interactivity**: Players are prompted and can respond
4. **Compatibility**: All three interfaces work (harness, interactive, AI)
5. **Testability**: Comprehensive test coverage for new flow

---

## Implementation Progress (Updated: 2024-12-30)

### Status Summary

**Core Engine Work: COMPLETE**
- XState machines fully refactored (round.machine.ts, turn.machine.ts, game.machine.ts)
- All core May I resolution logic implemented and tested (27 new tests)
- Old May I window architecture completely removed

**CLI/AI/Docs Work: SUPERSEDED**
- ~~Orchestrator, interactive mode, AI agent, and docs still need updates~~
- **See `specs/orchestrator-refactor.plan.md`** - the orchestrator will be deleted and replaced with a thin CLI adapter
- That plan handles all remaining CLI/AI/docs work with a cleaner architecture

### Completed Tasks

#### Phase 1: Core Engine Changes

**1.1 Setup and Types - COMPLETE**
- [x] Added `MayIResolution` interface to `core/engine/engine.types.ts` (lines 83-105)
- [x] Deleted obsolete test files:
  - `core/engine/mayIWindow.test.ts`
  - `core/engine/mayIPriority.test.ts`
  - `core/engine/mayIActions.test.ts`
  - `core/engine/turnMachine.mayI.test.ts`
  - `core/engine/turn.mayI.integration.test.ts`

**1.2 Round Machine May I - COMPLETE**
- [x] Created comprehensive test file: `core/engine/roundMachine.mayI.test.ts` (~500 lines, 27 tests)
- [x] Implemented `resolvingMayI` compound state in `round.machine.ts` with:
  - `checkingNextPlayer` - evaluates next player in priority order
  - `waitingForResponse` - waits for ALLOW_MAY_I or CLAIM_MAY_I
  - `resolved` - grants cards to winner, returns to playing
- [x] Added context fields: `mayIResolution`, `discardClaimed`, `currentPlayerHasDrawnFromStock`
- [x] Implemented guards: `canCallMayI`, `isPlayerBeingPrompted`, `hasMorePlayersToCheck`, `noPlayersToCheck`, `isCurrentPlayerClaiming`
- [x] Implemented actions: `initializeMayIResolution`, `advanceMayIResolution`, `blockMayIResolution`, `currentPlayerClaimsMayI`, `grantMayICardsToWinner`, `clearMayIResolution`
- [x] Helper function: `getPlayersAheadOfCaller()` for priority calculation

**1.3 Turn Machine Simplification - COMPLETE**
- [x] Removed `mayIWindow` state entirely from `turn.machine.ts`
- [x] Removed `mayIWindowMachine` import and actor
- [x] Removed guards: `shouldOpenMayIWindow`, `shouldOpenMayIWindowAsPlayer`
- [x] Removed context fields: `mayIResult`, `mayIDiscardTop`
- [x] Simplified `DRAW_FROM_STOCK` to go directly to `drawn` state (no window)

**1.4 Cleanup - COMPLETE**
- [x] Deleted `core/engine/mayIWindow.machine.ts`
- [x] Updated `game.machine.ts` event forwarding to include `ALLOW_MAY_I` and `CLAIM_MAY_I`
- [x] Added `allowMayI()` and `claimMayI()` methods to `GameEngine` class
- [x] Updated `game-engine.types.ts`:
  - Changed `MAY_I_WINDOW` to `RESOLVING_MAY_I` in `EnginePhase`
  - Updated `MayIContext` interface to match new resolution model
- [x] Updated `extractGameSnapshot()` in `game-engine.ts` to detect `RESOLVING_MAY_I` phase
- [x] Added 4 new tests in `game-engine.xstate.test.ts` for May I resolution methods

**Test Status:**
- All 1782 tests pass, 26 skipped (old May I tests marked with TODO)
- New round machine May I tests: 27 passing
- New game engine May I tests: 4 passing

### Remaining Tasks

> **⚠️ SUPERSEDED BY ORCHESTRATOR REFACTOR**
>
> The remaining CLI/AI/docs work in this plan has been **superseded** by `specs/orchestrator-refactor.plan.md`.
>
> That plan takes a more aggressive approach: instead of patching the orchestrator, it will be **deleted entirely** and replaced with a thin CLI adapter that wraps `GameEngine`. This is the right approach because the orchestrator currently duplicates game rules that should only live in the XState machines.
>
> **Do not work on Phases 2-6 below.** Follow `specs/orchestrator-refactor.plan.md` instead.

#### Phase 2-6: SUPERSEDED

See `specs/orchestrator-refactor.plan.md` which covers:
- **Phase 1**: Fix remaining engine/rule mismatches vs `docs/house-rules.md`
- **Phase 2**: Ensure May I in engine matches house rules exactly
- **Phase 3**: Make `GameEngine` a thin, complete wrapper for CLI
- **Phase 4**: Replace `cli/harness/orchestrator.ts` with a CLI adapter (DELETE orchestrator)
- **Phase 5**: CLI command surface (new May I flow with `allow`/`claim`)
- **Phase 6**: Interactive mode updates
- **Phase 7**: AI agent tooling updates
- **Phase 8**: Docs + CLAUDE.md updates
- **Phase 9**: Tests + verification

The orchestrator refactor plan explicitly states: **"you don't patch orchestrator.ts — you remove it."**

### Files with MAY_I_WINDOW References (Need Updates)

Found via grep - these files still use the old phase name:

**CLI Harness:**
- `cli/harness/orchestrator.ts` - ~6 references
- `cli/harness/orchestrator.test.ts` - ~8 references
- `cli/harness/harness.render.ts` - ~4 references

**CLI Interactive:**
- `cli/interactive/interactive.ts` - ~3 references

**AI Agent:**
- `ai/mayIAgent.llm.test.ts` - ~5 references
- `ai/mayIAgent.prompt.ts` - ~7 references
- `ai/mayIAgent.tools.ts` - ~1 reference

**CLI Shared:**
- `cli/shared/cli.llm-output.ts` - ~2 references

**Documentation:**
- `docs/agent-game-harness.md`
- `docs/orchestrator.md`
- Various spec files in `specs/`

### Key Architecture Notes for Resuming

1. **XState machines are complete** - The core engine (`round.machine.ts`, `turn.machine.ts`, `game.machine.ts`) fully implements the new May I resolution model. All tests pass.

2. **Orchestrator will be DELETED** - Per `specs/orchestrator-refactor.plan.md`, the CLI harness orchestrator will be replaced with a thin CLI adapter that wraps `GameEngine`. Do not patch `orchestrator.ts` - it will be removed.

3. **Phase naming** - Changed from `MAY_I_WINDOW` to `RESOLVING_MAY_I` everywhere in engine types. CLI types updated but not all consuming code (will be cleaned up during orchestrator refactor).

4. **New MayIContext structure** - Now tracks `originalCaller`, `playersToCheck`, `currentPromptIndex`, `playerBeingPrompted`, `playersWhoAllowed`, `winner`, `outcome` instead of old fields.

5. **Current player is first in line** - Until they draw from stock, then they lose priority. This is tracked by `currentPlayerHasDrawnFromStock` in round context.

6. **Down players skip entirely** - Both in calling May I AND in blocking. The `getPlayersAheadOfCaller()` function filters them out.

7. **Tests to unskip later** - Several tests in `machine.hierarchy.test.ts` and other files are skipped with TODO markers. They test old May I window behavior and should be reviewed/rewritten once orchestrator refactor is complete.

8. **Relationship to orchestrator refactor** - This plan (mayi-refactor) completed the core engine work. The orchestrator refactor plan (`specs/orchestrator-refactor.plan.md`) handles all remaining CLI/AI/docs work and takes a more comprehensive approach that ensures house rules are the single source of truth.

---

## 2025-12-30 Checkpoint (House Rules + Engine Consistency)

### What was done

- Added `core/engine/house-rules.test.ts` with two new regression tests:
  - `HR-2`: scoring values match `docs/house-rules.md` (2=20, Joker=50, A=15, J/Q/K=10, 3-10 face value)
  - `HR-11`: reshuffle preserves the exposed discard (`discard[0]` stays exposed)
- Updated `core/engine/round.machine.ts` to make those tests pass:
  - Round scoring now uses `calculateHandScore()` (removed local `getCardValue()` logic that mis-scored 2s)
  - `reshuffleStock` now treats `discard[0]` as the exposed top discard and shuffles `discard.slice(1)` into stock

### Tests run (passed)

- `bun test core/engine/house-rules.test.ts`
- `bun test core/engine/roundMachine.mayI.test.ts`

### Environment note

Commands print `/opt/homebrew/Library/Homebrew/cmd/shellenv.sh: line 18: /bin/ps: Operation not permitted` in this sandbox. Tests still ran/passed, but output can look suspicious.
