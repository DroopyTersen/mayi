# May I? — Backlog

> Last updated: [Ralph updates this timestamp with each commit]

## Current Phase: 1 — Card Foundation

**Phase Goal:** Pure functions for cards, deck creation, shuffle, deal, and meld validation. No state machines yet.

**Verification:** Unit tests cover all card/meld validation edge cases.

---

## Phase 1 Tasks

### Types & Utilities

- [ ] Create `core/card/types.ts` with `Suit`, `Rank`, `Card` types per TechDesign.md
- [ ] Create `core/card/utils.ts` with `isWild()`, `isNatural()`, `getPointValue()` functions
- [ ] Write tests for card utility functions in `core/card/utils.test.ts`

### Deck Operations

- [ ] Create `core/card/deck.ts` with `createDeck()` function (configurable deck/joker count)
- [ ] Implement `shuffle()` function using Fisher-Yates
- [ ] Implement `deal()` function (distribute cards to players)
- [ ] Write tests for deck operations in `core/card/deck.test.ts`

### Meld Validation

- [ ] Create `core/meld/types.ts` with `Meld`, `Contract` types
- [ ] Create `core/meld/validation.ts` with `isValidSet()` function
- [ ] Implement `isValidRun()` function with consecutive rank checking
- [ ] Implement wild card ratio validation (wilds ≤ naturals)
- [ ] Create `CONTRACTS` constant with all 6 round contracts
- [ ] Write comprehensive meld validation tests in `core/meld/validation.test.ts`

### Project Setup

- [ ] Initialize bun project with `bun init`
- [ ] Configure TypeScript
- [ ] Set up test runner
- [ ] Create folder structure (`core/card`, `core/meld`, `core/engine`)
- [ ] Create `core/index.ts` with public exports

---

## Phase 2 Tasks (Minimal Playable Turn)

> Break down when Phase 1 is complete

- [ ] _Pending Phase 1 completion_

---

## Phase 3 Tasks (Contracts + Laying Down)

> Break down when Phase 2 is complete

- [ ] _Pending Phase 2 completion_

---

## Phase 4 Tasks (Laying Off + Going Out + Scoring)

> Break down when Phase 3 is complete

- [ ] _Pending Phase 3 completion_

---

## Phase 5 Tasks (Full Game Loop)

> Break down when Phase 4 is complete

- [ ] _Pending Phase 4 completion_

---

## Phase 6 Tasks (May I Mechanic)

> Break down when Phase 5 is complete

- [ ] _Pending Phase 5 completion_

---

## Phase 7 Tasks (Joker Swapping)

> Break down when Phase 6 is complete

- [ ] _Pending Phase 6 completion_

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
