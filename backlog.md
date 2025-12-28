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
- [ ] Joker position identification (`identifyJokerPosition`, `canSwapJokerWithCard`)
- [ ] Run extension helpers (`canExtendRun`, `canExtendSet`)
- [ ] Hand scoring (`calculateHandScore`)

---

## Phase 2 Tasks (Minimal Playable Turn)

> Break down when Phase 1 is complete

- [ ] Review specs/phase2-tests.md and and scaffold out all of those tests. Add tasks for implementing Phase 2, centered around the tests.

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

_(none yet)_

---

## Notes

- All specs are in `/specs` folder — READ THEM before implementing
- Tests use Bun's built-in test runner
- Commit after each completed task
- Tag releases at phase completion: `v0.1.0`, `v0.2.0`, etc.
