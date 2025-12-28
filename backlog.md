# May I? — Backlog

> Last updated: [Ralph updates this timestamp with each commit]

Run `bun run typecheck` to verify your types are correct. In test file we can be lazy with typescript hacks like foo.bar!, but in real source could we should always code like a senior Typescript engineer. Strict types, no any's. No hacks like !.

## Phase 1 Tasks (Card Foundation)

> Card types, deck creation, shuffle, deal, meld validation

- [x] Card utility functions (`isWild`, `isNatural`, `getPointValue`)
- [x] Deck creation (`createDeck`)
- [x] Shuffle function (`shuffle`)
- [x] Deal function (`deal`)
- [x] Review specs/phase1-tests.md and scaffold out all tests (72 todo tests in meld.validation.test.ts)
- [x] Helper functions: `countWildsAndNaturals`, `wildsOutnumberNaturals`
- [x] Set validation (`isValidSet`)
- [x] Run validation (`isValidRun`)
- [x] Rank ordering utilities (`getRankValue`) — needed for run validation
- [x] Joker position identification (`identifyJokerPositions`, `canSwapJokerWithCard`)
- [x] Run extension helpers (`canExtendRun`, `canExtendSet`)
- [x] Hand scoring (`calculateHandScore`)

---

## Phase 2 Tasks (Minimal Playable Turn)

> GameState, Player, TurnState types; stripped-down TurnMachine; hand reordering; basic CLI rendering

- [x] Review specs/phase-2-tests.md and scaffold out all tests (149 todo tests)
- [x] Implement `GameState`, `Player`, `TurnState` types (`core/engine/engine.types.ts`)
- [x] Implement `createInitialGameState` function

### Engine Types (25 tests in engine.types.test.ts)

- [x] Implement `GameState structure` tests (8 tests)
- [x] Implement `Player structure` tests (5 tests)
- [x] Implement `TurnState structure` tests (3 tests)
- [x] Implement `createInitialGameState` tests (9 tests)

### TurnMachine (47 tests in turn.machine.test.ts)

- [x] Create TurnMachine XState machine
- [x] Implement TurnMachine initial state tests (5 tests)
- [x] Implement DRAW_FROM_STOCK command (7 tests)
- [x] Implement DRAW_FROM_DISCARD command (10 tests)
- [x] Implement DISCARD command (13 tests)
- [x] Implement invalid command handling (6 tests)
- [x] Implement turn output (5 tests)
- [x] Fix typecheck errors

### Hand Reordering (28 tests in hand.reordering.test.ts)

- [x] Implement REORDER_HAND command basic functionality (5 tests)
- [x] Ensure REORDER_HAND works in any turn state (5 tests)
- [x] Implement sort by rank functionality (3 tests)
- [x] Implement sort by suit functionality (3 tests)
- [x] Implement move single card functionality (3 tests)
- [x] Implement validation for reorder command (6 tests)
- [x] Handle edge cases (3 tests)
- [x] Fix typecheck errors

### Game Loop (17 tests in game.loop.test.ts)

- [x] Fix typecheck errors
- [x] Implement turn advancement (4 tests)
- [x] Implement state transfer between turns (4 tests)
- [x] Implement initial game setup (4 tests)
- [x] Implement multiple consecutive turns (5 tests)
- [x] Fix typecheck errors

### CLI Renderer (21 tests in cli.renderer.test.ts)

Review specs/command-line-interface.md

- [x] Implement `renderCard` function (9 tests)
- [x] Implement `renderHand` function (3 tests)
- [x] Implement `renderNumberedHand` function (3 tests)
- [x] Implement `renderGameState` function (6 tests)
- [x] Fix typecheck errors

### CLI Input (11 tests in cli.input.test.ts)

- [x] Implement `parseDrawCommand` function (3 tests)
- [x] Implement `parseDiscardCommand` function (4 tests)
- [x] Implement `parseReorderCommand` function (4 tests)
- [x] Fix typecheck errors

### Overall Rule Verification

- [x] Review the /specs/house-rules.md and make sure everything we've implemented is valid according to the rules.

---

## Phase 3 Tasks (Contracts + Laying Down)

> Break down when Phase 2 is complete

- [x] Fix typecheck errors
- [x] Review specs/phase-3-tests.md and scaffold out all tests (283 todo tests)

### Contract Definitions (30 tests in contracts.test.ts)

- [x] Implement CONTRACTS constant (8 tests)
- [x] Implement getContractForRound function (2 tests)
- [x] Implement minimum cards per contract calculation (6 tests)
- [x] Implement validateContract function - correct number of melds (12 tests)
- [x] Implement meld type verification (4 tests)
- [x] Implement card usage validation (3 tests)
- [x] Fix typecheck errors

### Lay Down Command (95 tests in laydown.test.ts)
- [x] Implement drawn state structure (3 tests)
- [x] Implement proceeding without laying down (4 tests)
- [x] Implement LAY_DOWN preconditions (5 tests)
- [x] Implement successful lay down - Round 1 (7 tests)
- [x] Implement successful lay down - Round 2 (4 tests)
- [x] Implement successful lay down - Round 3 (3 tests)
- [x] Implement successful lay down - Round 4 (3 tests)
- [x] Implement successful lay down - Round 5 (2 tests)
- [x] Implement successful lay down - Round 6 (2 tests)
- [x] Fix typecheck errors
- [x] Implement melds with wilds validation (7 tests)
- [x] Implement larger than minimum melds (5 tests)
- [x] Implement card removal from hand (5 tests)
- [x] Implement meld ownership (3 tests)
- [x] Implement wrong number of melds rejection (5 tests)
- [x] Implement invalid individual melds rejection (8 tests)
- [x] Implement card not in hand rejection (4 tests)
- [x] Implement duplicate card usage rejection (2 tests)
- [x] Fix typecheck errors
- [x] Implement already down rejection (3 tests)
- [x] Implement auto-transition to awaitingDiscard (3 tests)
- [x] Implement turn end after laying down (2 tests)
- [ ] Implement cannot lay off on same turn (3 tests) — requires Phase 4 (LAY_OFF command)
- [x] Implement cannot lay down again (2 tests)
- [x] Implement discard after laying down (4 tests)
- [x] Implement turn output reflects lay down (3 tests)
- [x] Fix typecheck errors

### Table Management (17 tests in table.test.ts)

- [x] Fix typecheck errors
- [x] Implement table initial state (2 tests)
- [x] Implement table after first player lays down (3 tests)
- [x] Implement table after multiple players lay down (4 tests)
- [x] Implement table persistence across turns (3 tests)
- [x] Fix typecheck errors
- [x] Implement isDown initial state (2 tests)
- [x] Implement isDown after laying down (3 tests)
- [x] Implement multiple players down tracking (3 tests)
- [ ] Implement round transition isDown reset (1 test) — requires Phase 4+ (round transitions)
- [x] Fix typecheck errors

### Guards (39 tests in guards.test.ts)

- [x] Implement notDownYet guard (3 tests)
- [x] Implement meetsContract guard - round 1 (5 tests)
- [x] Implement meetsContract guard - round 2 (5 tests)
- [x] Fix typecheck errors
- [x] Implement meetsContract guard - round 3 (3 tests)
- [x] Implement meetsContract guard - round 4 (3 tests)
- [x] Implement meetsContract guard - round 5 (3 tests)
- [x] Implement meetsContract guard - round 6 (3 tests)
- [x] Fix typecheck errors
- [x] Implement validMelds guard (5 tests)
- [x] Implement wildsNotOutnumbered guard (4 tests)
- [x] Implement canLayDown composite guard (3 tests)
- [x] Fix typecheck errors

### Lay Down Actions (17 tests in laydown.actions.test.ts)

- [x] Implement hand modification (5 tests)
- [x] Implement table modification (5 tests)
- [x] Implement player state modification (2 tests)
- [x] Implement meld creation (4 tests)
- [x] Fix typecheck errors

### Integration Tests (58 tests in laydown.integration.test.ts)

- [x] Implement round 1 successful lay down flow (8 tests)
- [x] Implement round 2 lay down with wilds (4 tests)
- [x] Implement player chooses not to lay down (7 tests)
- [x] Implement player cannot lay down - missing cards (5 tests)
- [x] Implement multiple turns with lay down (7 tests)
- [x] Fix typecheck errors
- [x] Implement edge case: laying down maximum cards (4 tests)
- [x] Implement edge case: laying down leaves exactly 1 card (5 tests)
- [x] Implement edge case: contract validation prevents over-laying (4 tests)
- [x] Implement edge case: wilds across multiple melds (5 tests)
- [x] Implement edge case: concentrated wilds invalid (5 tests)
- [x] Implement edge case: same rank from multiple decks (4 tests)
- [x] Fix typecheck errors

### CLI Lay Down (19 tests in cli.laydown.test.ts)

> Review specs/command-line-ux.md and make sure we've implemented everything we need to for the cli gameplay

- [x] Implement parseLayDownInput card selection syntax (6 tests)
- [x] Implement meld type inference (3 tests)
- [x] Implement input validation (4 tests)
- [x] Fix typecheck errors
- [x] Implement alternative syntaxes (1 test)
- [x] Implement lay down confirmation flow (5 tests)
- [x] Fix typecheck errors

---

## Phase 4 Tasks (Laying Off + Going Out + Scoring)

> 664 todo tests scaffolded across 6 test files

- [x] Review specs/phase-4-tests.md and scaffold out all tests
- [x] Fix typecheck errors

### Layoff Command (91 tests in layoff.test.ts)

- [x] Implement canLayOffCard guard preconditions (4 tests)
- [x] Implement laying off to sets (6 tests)
- [x] Implement laying off to sets - wild ratio edge cases (6 tests)
- [x] Implement laying off to runs (8 tests)
- [x] Implement run extension boundaries (8 tests)
- [x] Implement laying off to runs - wild ratio edge cases (7 tests)
- [x] Implement card ownership for lay off (5 tests)
- [x] Implement meld ownership - anyone can add to any meld (4 tests)
- [x] Implement LAY_OFF action - successful lay off to set (6 tests)
- [x] Implement LAY_OFF action - successful lay off to run (10 tests)
- [x] Implement multiple lay offs in one turn (7 tests)
- [ ] Implement state transitions after lay off (4 tests)
- [ ] Implement LAY_OFF rejection - player state (7 tests)
- [ ] Implement LAY_OFF rejection - invalid card (2 tests)
- [ ] Implement LAY_OFF rejection - invalid meld (2 tests)
- [ ] Implement LAY_OFF rejection - card doesn't fit (4 tests)
- [ ] Implement LAY_OFF rejection - wild ratio (2 tests)
- [ ] Fix typecheck errors

### Going Out (176 tests in goingOut.test.ts)

- [ ] Implement going out general rules - definition (4 tests)
- [ ] Implement going out general rules - must be down (4 tests)
- [ ] Implement going out general rules - paths to going out (5 tests)
- [ ] Implement going out rounds 1-5 - via discard (4 tests)
- [ ] Implement going out rounds 1-5 - via lay off (5 tests)
- [ ] Implement going out rounds 1-5 - sequence via discard (4 tests)
- [ ] Implement going out rounds 1-5 - sequence via lay off (3 tests)
- [ ] Implement going out rounds 1-5 - player choice (4 tests)
- [ ] Implement going out rounds 1-5 - wentOut trigger (4 tests)
- [ ] Implement round 6 special rules - normal turns still have discard (4 tests)
- [ ] Implement round 6 special rules - cannot discard to go out (4 tests)
- [ ] Implement round 6 special rules - must lay off (4 tests)
- [ ] Implement round 6 special rules - cannot discard last card (4 tests)
- [ ] Implement round 6 special rules - stuck with unlayable card (7 tests)
- [ ] Implement round 6 special rules - normal turn with discard (6 tests)
- [ ] Implement round 6 special rules - discard allowed with 2+ cards (3 tests)
- [ ] Implement GO_OUT command (8 tests)
- [ ] Implement GO_OUT with multiple lay offs (4 tests)
- [ ] Implement GO_OUT rejected scenarios (5 tests)
- [ ] Implement round 6 stuck scenarios (17 tests)
- [ ] Implement not down scenarios (14 tests)
- [ ] Implement going out on lay down turn (18 tests)
- [ ] Implement going out turn output (8 tests)
- [ ] Fix typecheck errors

### Scoring (97 tests in scoring.test.ts)

- [ ] Implement calculateHandScore - empty hand (2 tests)
- [ ] Implement calculateHandScore - number cards (8 tests)
- [ ] Implement calculateHandScore - face cards (4 tests)
- [ ] Implement calculateHandScore - aces (3 tests)
- [ ] Implement calculateHandScore - wild cards (5 tests)
- [ ] Implement calculateHandScore - mixed hand totals (8 tests)
- [ ] Implement calculateHandScore - realistic hands (5 tests)
- [ ] Implement calculateHandScore - worst case hands (5 tests)
- [ ] Implement calculateHandScore - edge cases (3 tests)
- [ ] Implement calculateRoundScores (11 tests)
- [ ] Implement updateTotalScores (14 tests)
- [ ] Implement determineWinner (21 tests)
- [ ] Fix typecheck errors

### Round End (64 tests in roundEnd.test.ts)

- [ ] Implement round end trigger (7 tests)
- [ ] Implement round end processing (6 tests)
- [ ] Implement RoundRecord (8 tests)
- [ ] Implement round transition - to next round (14 tests)
- [ ] Implement round transition - to game end (6 tests)
- [ ] Implement state reset details (10 tests)
- [ ] Fix typecheck errors

### Turn Machine Phase 4 Additions (97 tests in turn.machine.phase4.test.ts)

- [ ] Implement drawn state with lay off (12 tests)
- [ ] Implement wentOut state (13 tests)
- [ ] Implement turnComplete vs wentOut (9 tests)
- [ ] Implement round 6 specific behavior (24 tests)
- [ ] Implement going out detection (12 tests)
- [ ] Implement player not down behavior (11 tests)
- [ ] Fix typecheck errors

### Phase 4 Integration Tests (139 tests in phase4.integration.test.ts)

- [ ] Implement complete lay off turn flow (21 tests)
- [ ] Implement going out scenarios - rounds 1-5 (21 tests)
- [ ] Implement going out scenarios - round 6 (31 tests)
- [ ] Implement scoring integration (19 tests)
- [ ] Implement edge cases (17 tests)
- [ ] Fix typecheck errors

### Phase 3 Deferred Tests (4 tests)

> These tests were deferred from Phase 3 because they require Phase 4 functionality

- [ ] Implement cannot lay off on same turn (3 tests in laydown.test.ts)
- [ ] Implement round transition isDown reset (1 test in table.test.ts)

---

## Phase 5 Tasks (Full Game Loop)

> Break down when Phase 4 is complete
> Review specs/command-line-ux.md and make sure we've implemented everything we need to for the cli gameplay

- [ ] Review specs/phase-5-tests.md and and scaffold out all of those tests. Add tasks for PHase 5, centered around the tests.

> IMPORTANT: Make sure to verify the game works as expected by playing through it manually using the CLI app. You can have multiple players and you can play manually against yourself.

---

## Phase 6 Tasks (May I Mechanic)

> Break down when Phase 5 is complete

- [ ] Review specs/phase-6-tests.md and and scaffold out all of those tests. Add tasks for Phase 6, centered around the tests.

---

## Phase 7 Tasks (Joker Swapping)

> Break down when Phase 6 is complete

- [ ] Review specs/phase-7-tests.md and and scaffold out all of those tests. Add tasks for Phase 7, centered around the tests.

---

## Discovered Tasks

> Tasks found during implementation that don't fit current phase

_(none yet)_

---

## Questions

> Spec clarifications needed

_(none yet)_

---

## Completed Phases

- **Phase 1** (Card Foundation) — v0.1.0
- **Phase 2** (Minimal Playable Turn) — v0.2.0

---

## Notes

- All specs are in `/specs` folder — READ THEM before implementing
- Tests use Bun's built-in test runner
- Commit after each completed task
- Tag releases at phase completion: `v0.1.0`, `v0.2.0`, etc.
