# May I? — Backlog

> Last updated: [Ralph updates this timestamp with each commit]

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
- [ ] Create TurnMachine XState machine
- [ ] Implement TurnMachine initial state tests (5 tests)
- [ ] Implement DRAW_FROM_STOCK command (7 tests)
- [ ] Implement DRAW_FROM_DISCARD command (10 tests)
- [ ] Implement DISCARD command (13 tests)
- [ ] Implement invalid command handling (7 tests)
- [ ] Implement turn output (5 tests)

### Hand Reordering (28 tests in hand.reordering.test.ts)
- [ ] Implement REORDER_HAND command basic functionality (5 tests)
- [ ] Ensure REORDER_HAND works in any turn state (5 tests)
- [ ] Implement sort by rank functionality (3 tests)
- [ ] Implement sort by suit functionality (3 tests)
- [ ] Implement move single card functionality (3 tests)
- [ ] Implement validation for reorder command (6 tests)
- [ ] Handle edge cases (3 tests)

### Game Loop (17 tests in game.loop.test.ts)
- [ ] Implement turn advancement (4 tests)
- [ ] Implement state transfer between turns (4 tests)
- [ ] Implement initial game setup (4 tests)
- [ ] Implement multiple consecutive turns (5 tests)

### CLI Renderer (21 tests in cli.renderer.test.ts)
- [ ] Implement `renderCard` function (9 tests)
- [ ] Implement `renderHand` function (3 tests)
- [ ] Implement `renderNumberedHand` function (3 tests)
- [ ] Implement `renderGameState` function (6 tests)

### CLI Input (11 tests in cli.input.test.ts)
- [ ] Implement `parseDrawCommand` function (3 tests)
- [ ] Implement `parseDiscardCommand` function (4 tests)
- [ ] Implement `parseReorderCommand` function (4 tests)

---

## Phase 3 Tasks (Contracts + Laying Down)

> Break down when Phase 2 is complete

- [ ] Look at what we did for /specs/phase1-tests.md and /specs/phase2-tests.md, and do research to create a similar file, /specs/phase3-tests.md
- [ ] Review specs/phase3-tests.md and and scaffold out all of those tests. Add tasks for PHase 3, centered around the tests.

---

## Phase 4 Tasks (Laying Off + Going Out + Scoring)

> Break down when Phase 3 is complete

- [ ] Look at what we did for /specs/phase1-tests.md and /specs/phase2-tests.md, and do research to create a similar file, /specs/phase4-tests.md
- [ ] Review specs/phase4-tests.md and and scaffold out all of those tests. Add tasks for PHase 4, centered around the tests.

---

## Phase 5 Tasks (Full Game Loop)

> Break down when Phase 4 is complete

- [ ] Look at what we did for /specs/phase1-tests.md and /specs/phase2-tests.md, and do research to create a similar file, /specs/phase5-tests.md
- [ ] Review specs/phase5-tests.md and and scaffold out all of those tests. Add tasks for PHase 5, centered around the tests.

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
