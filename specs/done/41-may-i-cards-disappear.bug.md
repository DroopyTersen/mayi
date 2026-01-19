# Bug #41: May-I cards disappear when turn cycles back to human player

**Type:** bug
**Priority:** high
**Status:** Tech Design (awaiting implementation)
**Branch:** [bug/41-may-i-cards-disappear](https://github.com/DroopyTersen/mayi/tree/bug/41-may-i-cards-disappear)

## Description

May-I cards disappear when turn cycles back to human player.

**Scenario:**
- Human player with 2 AI players (both AI already laid down)
- Human calls May-I, receives King + 9♦ penalty card
- Turn quickly cycles through AI players (since they're down)
- When turn returns to human (possibly while organizing hand), the May-I cards (King, 9♦) vanish from hand

**Likely cause:** State sync issue - server state may be overwriting client with stale data during rapid turn transitions, or hand organization conflicts with incoming state updates.

**Related:** May be related to #40 (phone sleep AI turn loop) - similar client reconnect/state sync issues.

---

## Steps to Reproduce

1. Start a game with 1 human + 2 AI players
2. Progress to a round where both AIs have already laid down
3. When it's an AI's turn and they discard, call May-I as the human
4. Win the May-I (receive discard + penalty card)
5. Watch AI turns cycle rapidly (since they're down, turns are fast: draw-skip-discard)
6. When turn returns to human: May-I cards have vanished from hand

**Expected:** May-I cards (claimed card + penalty card) remain in human's hand
**Actual:** May-I cards disappear after AI turn cycling

---

## Root Cause Analysis

The `mergeAIStatePreservingOtherPlayerHands` function is designed to preserve non-current player hands during AI turns. Potential failure points:

1. **Timing Issue:** May-I cards not fully persisted before first AI turn loads state
2. **Fallback Conditions:** Merge function returns stale state if:
   - Round numbers differ (could happen during transitions)
   - Player counts don't match
   - Invalid state structure
3. **Test Gap:** Merge function tests focus on reorder scenarios, not May-I card addition

---

## Findings (Confirmed)

### 1) Reproduced with a failing test (server-side snapshot inconsistency)

Added a repro test: `app/party/ai-turn-coordinator.may-i-cards-disappear.test.ts`.

- It simulates a human calling `CALL_MAY_I` **during the AI thinking callback** for the *last AI turn before the human becomes current* (the same “click May-I while AI is about to act” window from the report).
- The test currently fails with the same symptom: the May‑I cards are present in authoritative round state but missing from the human’s current-turn hand view.

Run it:

```bash
bun test app/party/ai-turn-coordinator.may-i-cards-disappear.test.ts
```

### 2) The underlying issue is *not* (only) round-level hand merge — it’s the active TurnMachine hand

Key observation from the failing test:

- After the May‑I call, the human’s **round-level** hand contains the claimed discard + penalty card.
- After the AI turn advances to the human and state is persisted via `mergeAIStatePreservingOtherPlayerHands`, the stored snapshot ends up with:
  - `round.snapshot.context.players[player-0].hand` **includes** the May‑I cards
  - `round.snapshot.children.turn.snapshot.context.hand` (current turn actor for player‑0) **does not**

This matters because `core/engine/game-engine.ts` overrides the *current player’s* hand with the TurnMachine’s hand when building the `GameSnapshot`/`PlayerView`:

- If the human is now the current player, their `PlayerView.yourHand` is sourced from `turnContext.hand`, not `roundContext.players[].hand`.
- So the UI shows the May‑I cards “disappearing” exactly when the turn cycles back to the human.

### 3) Why this happens in this specific scenario

The race is:

1. Coordinator loads state for AI’s upcoming turn and constructs an in-memory adapter.
2. Human calls `CALL_MAY_I` during the “AI thinking” window.
3. AI coordinator continues using the **stale adapter** (it does not reload mid-turn).
4. AI finishes and advances turn to the human, spawning a new TurnMachine for the human using the stale round-hand (missing May‑I cards).
5. Persistence merge patches round-level hands from storage, but **does not patch the active TurnMachine hand** → snapshot inconsistency → cards vanish in current-player view.

Contributing factor: `AITurnCoordinator.abortCurrentTurn()` is a no-op during the window before `AbortController` is created (it’s created after the thinking delay). The failing test simulates this.

---

## Proposed Solutions

### Option A (Recommended): Extend merge to also sync the active TurnMachine hand

Update `mergeAIStatePreservingOtherPlayerHands` in `app/party/party-game-adapter.ts` to patch the **turn actor snapshot** when it exists.

Idea:
- After producing `mergedPlayers`, detect the current turn actor’s `playerId` (from `aiSnapshot.children.round.snapshot.children.turn.snapshot.context.playerId`).
- If the turn actor exists and its `playerId` is **not** the AI player being persisted, overwrite `turn.snapshot.context.hand` (and likely `turn.snapshot.context.isDown`) to match the merged round hand for that `playerId`.

Why:
- Fixes the proven inconsistency: round-level hand has the cards but current-player view reads from TurnMachine.
- Addresses the bug even if AI abort timing remains imperfect.

### Option B: Make AI abort effective during the “thinking” window

In `app/party/ai-turn-coordinator.ts`, create the `AbortController` *before* `onAIThinking`/`thinkingDelayMs`, so `CALL_MAY_I` can reliably abort even if it arrives immediately after the AI indicator appears.

Why:
- Prevents the coordinator from continuing with a stale adapter after a `CALL_MAY_I` state mutation.
- Likely reduces other racey “AI kept going after interrupt” issues.

### Option C: Re-check state after thinking delay (stale adapter avoidance)

Right before executing `executeAITurn(...)`, re-load from storage and re-create the adapter if the snapshot has changed (or if phase is no longer `ROUND_ACTIVE`, or if May‑I is being resolved).

Why:
- Avoids running AI actions against an adapter created from stale state, even if abort doesn’t fire.
- More general protection for future “out-of-turn state mutation while AI is queued” cases.

## Relevant Files

| File | Purpose | Relevance |
|------|---------|-----------|
| `core/engine/round.machine.ts` | XState machine for round management | Contains `grantMayICardsToWinner` action (lines 388-458) that adds May-I cards to winner's hand |
| `app/party/ai-turn-coordinator.ts` | Coordinates AI turn execution | Uses `mergeAIStatePreservingOtherPlayerHands` to preserve non-current player hands during AI turns |
| `app/party/party-game-adapter.ts` | Adapter between PartyKit and game engine | Contains `mergeAIStatePreservingOtherPlayerHands` function for state merging |
| `app/party/mayi-room.ts` | PartyKit WebSocket room handler | Orchestrates game actions, May-I resolution, and AI turn execution (lines 840-877) |
| `app/party/game-actions.ts` | Game action execution | Handles CALL_MAY_I, ALLOW_MAY_I, CLAIM_MAY_I actions |
| `core/engine/game-engine.ts` | Snapshot/view derivation | Overrides current player hand with TurnMachine `turnContext.hand` (critical to the disappearance symptom) |

---

## Acceptance Criteria

- [ ] After winning May-I, cards remain in hand when turn returns to human player
- [ ] Cards persist even when AI players are "down" and cycle through turns rapidly
- [ ] Cards persist even if human is in "Organize" mode during AI turns
- [ ] A failing test reproduces the May-I card loss scenario before fix
- [ ] All existing merge/race condition tests continue to pass

---

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Human wins May-I, 2+ AIs down, rapid cycling | Cards persist |
| Human organizing hand during AI turns | Cards persist (added to end of organized hand) |
| Multiple May-I wins in succession | All cards persist |
| AI turn errors during cycling | Cards still persist (error recovery shouldn't lose cards) |

---

## Verification Approach

1. Write a failing test that reproduces the exact scenario
2. Test should grant May-I cards, then simulate rapid AI turn cycling
3. Assert human's hand still contains the May-I cards after cycling
4. If page refresh shows cards, bug is client-side; if not, server-side

Current status:
- `app/party/ai-turn-coordinator.may-i-cards-disappear.test.ts` reproduced the issue; it now passes after implementing Option A (sync TurnMachine hand during merge).

---

## History

| Date | Column | Actor | Notes |
|------|--------|-------|-------|
| 2026-01-14 | New | Human | Created |
| 2026-01-14 | Approved | Human | Ready for work |
| 2026-01-14 | Refinement | Agent | Branch created, starting exploration |
| 2026-01-14 | Tech Design | Agent | Requirements documented, ready for tech design |
