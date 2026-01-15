# Bug #44: Multiple May-I clicks deal duplicate cards repeatedly (engine + UI)

**Type:** bug
**Priority:** critical
**Status:** New

## Description

Clicking the "May I?" button multiple times causes duplicate cards to be dealt repeatedly. Each click gives the same two cards (the discard + penalty card), resulting in impossible hand sizes (25+ cards).

### Two Issues

**1. Game Engine Bug (CRITICAL)**
The engine allows multiple May-I requests to be processed, dealing the same cards repeatedly:
- Click May-I → get Q♠ + 4♣
- Click May-I again → get Q♠ + 4♣ again
- Repeat → end up with 25 cards (impossible)

This suggests the engine isn't properly:
- Tracking pending May-I requests
- Preventing duplicate May-I processing
- Validating that cards being dealt still exist in stock/discard

**2. UI Feedback Issue (Secondary)**
After clicking May-I, the button remains clickable with no indication that:
- A request is pending
- Other players are reviewing the request
- The user should wait

---

## Steps to Reproduce

1. Start a game where another player discards
2. Click the "May I?" button
3. Before the request is processed, click the button again (repeatedly)
4. Observe: same two cards dealt each time
5. Result: hand contains far more cards than should be possible

**Expected:**
- Engine: May-I request is idempotent; clicking multiple times has no additional effect
- UI: Button shows "Waiting..." or similar after first click, preventing additional clicks

**Actual:**
- Engine: Each click processes a full May-I, dealing duplicate cards
- UI: Button remains active and clickable indefinitely

---

## Implementation Approach (TDD Required)

**IMPORTANT:** This bug MUST be approached with strict TDD.

**Priority order:**
1. **Game Engine first** — Write a failing test that reproduces the duplicate May-I processing. The engine should be idempotent — multiple May-I requests from the same player for the same discard should have no additional effect.
2. **UI second** — After the engine is fixed, add UI feedback (disable button, show waiting state).

Do NOT attempt any fix until we have a failing test that demonstrates the engine bug. The test should show that calling May-I multiple times results in duplicate cards being dealt.

---

## Root Cause Hypotheses

1. **No pending request tracking** — Engine may not track that a May-I request is already pending for a player
2. **No idempotency check** — `CALL_MAY_I` action may process every call without checking if already called
3. **Race condition** — Multiple WebSocket messages processed before state update completes
4. **Missing guard in state machine** — XState machine may allow multiple May-I transitions

---

## Relevant Files (to investigate)

| File | Purpose | Relevance |
|------|---------|-----------|
| `core/engine/round.machine.ts` | XState machine for round management | May-I state transitions and guards |
| `app/party/game-actions.ts` | Game action execution | Handles CALL_MAY_I action |
| `app/party/mayi-room.ts` | PartyKit WebSocket room handler | May-I resolution orchestration |
| `app/ui/may-i-button/` | May-I button component | UI feedback and disable state |

---

## Acceptance Criteria

- [ ] Failing test reproduces duplicate May-I card dealing
- [ ] Engine rejects duplicate May-I requests from same player for same discard
- [ ] Multiple rapid clicks result in exactly one May-I request processed
- [ ] UI button shows waiting/pending state after first click
- [ ] Impossible hand sizes (>14 cards without valid May-I wins) cannot occur
- [ ] All existing May-I tests continue to pass

---

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Rapid double-click on May-I | Only one request processed |
| Click May-I, timeout, click again for new discard | Second request is valid (new discard) |
| Multiple players click May-I for same discard | Each player gets one request (normal priority resolution) |
| Network lag causes delayed button response | Still only one request processed |

---

## History

| Date | Column | Actor | Notes |
|------|--------|-------|-------|
| 2026-01-15 | New | Human | Created |
