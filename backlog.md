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

- [ ] Review the /specs/house-rules.md and make sure everything we've implemented is valid according to the rules.

---

## Phase 3 Tasks (Contracts + Laying Down)

> Break down when Phase 2 is complete

- [ ] Fix typecheck errors
- [ ] Review specs/phase-3-tests.md and and scaffold out all of those tests. Add tasks for PHase 3, centered around the tests.

---

## Phase 4 Tasks (Laying Off + Going Out + Scoring)

> Break down when Phase 3 is complete

- [ ] Review specs/phase-4-tests.md and and scaffold out all of those tests. Add tasks for PHase 4, centered around the tests.

---

## Phase 5 Tasks (Full Game Loop)

> Break down when Phase 4 is complete

- [ ] Review specs/phase-5-tests.md and and scaffold out all of those tests. Add tasks for PHase 5, centered around the tests.

> IMPORTANT: Make sure to verify the game works as expected by playing through it manually using the CLI app. You can have multiple players and you can play manually against yourself.

---

## Phase 6 Tasks (May I Mechanic)

> Break down when Phase 5 is complete

- [ ] Look at what we did for /specs/phase1-tests.md and /specs/phase2.md, and do research to create a similar file, /specs/phase6-tests.md
- [ ] Review specs/phase6-tests.md and and scaffold out all of those tests. Add tasks for PHase 6, centered around the tests.

---

## Phase 7 Tasks (Joker Swapping)

> Break down when Phase 6 is complete

- [ ] Look at what we did for /specs/phase1-tests.md and /specs/phase2.md, and do research to create a similar file, /specs/phase7-tests.md
- [ ] Review specs/phase7-tests.md and and scaffold out all of those tests. Add tasks for PHase 7, centered around the tests.

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

---

## Notes

- All specs are in `/specs` folder — READ THEM before implementing
- Tests use Bun's built-in test runner
- Commit after each completed task
- Tag releases at phase completion: `v0.1.0`, `v0.2.0`, etc.
