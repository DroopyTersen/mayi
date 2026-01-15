# Bug #40: Phone screen sleep during AI turn causes round transition loop

**Type:** bug
**Priority:** high
**Status:** Fix Implemented - Needs Validation
**Code Review Score:** 95/100 PASS
**Branch:** [bug/40-phone-sleep-ai-turn-loop](https://github.com/DroopyTersen/mayi/tree/bug/40-phone-sleep-ai-turn-loop)

## Description

When playing on mobile (deployed environment) with 1 human vs 2 AI players, if the phone screen turns off for ~60 seconds while waiting for an AI player's turn at round end, the round completion gets stuck in a loop.

## Steps to Reproduce

1. Start a game with 1 human + 2 AI players on mobile (deployed Claude environment)
2. Play until near end of round 1, where an AI player has 1 card left and it's their turn
3. Set phone down and let screen turn off (~60 seconds)
4. Pick phone back up and observe

## Expected Behavior

After AI completes their turn and goes out, round should transition cleanly to round 2 with new hands.

## Actual Behavior

1. Briefly shows "Still waiting for AI player one"
2. "Round complete" dialog opens with countdown
3. After countdown, instead of transitioning to round 2, returns to round 1's end state
4. Shows "waiting for AI player one" again (~5 seconds)
5. "Round complete" dialog reopens
6. Cycle repeats indefinitely

**Critical finding:** Refreshing the browser does NOT fix the issue - still shows round 1 with AI Player One's turn and 1 card. This confirms the **server state is stuck**, not just client sync issues.

---

## Update (2026-01-15)

Repro appears to be **not disconnect-dependent**:

- In a separate run, round 1 completed normally (no visible disconnect), the round-end countdown overlay appeared, then the overlay closed and gameplay remained stuck in round 1.

This suggests the “phone sleep / reconnect” hypothesis is at most a trigger, not the root cause. The server appears to be **persisting (or re-persisting) a stale round 1 state after round end**.

## Root Cause Analysis

### Updated Hypothesis: AI Persistence Merge Reverts Round Transitions

The most likely cause is the **AI persistence merge** in `AITurnCoordinator` discarding the round transition when an AI action ends the round.

When the AI executes tools, `AITurnCoordinator` persists after each tool via `onPersist`:

- `app/party/ai-turn-coordinator.ts` (around lines 185-195): `onPersist` loads `freshState` from storage and then calls `mergeAIStatePreservingOtherPlayerHands(freshState, adapter.getStoredState(), aiPlayer.engineId)` before saving.

`mergeAIStatePreservingOtherPlayerHands` currently does this:

```ts
// app/party/party-game-adapter.ts (around lines 127-135)
if (freshRoundNumber !== aiRoundNumber) {
  return freshState;
}
```

When an AI discard causes an immediate round transition (round 1 → round 2), the adapter’s state is already round 2, but the “fresh” state loaded from storage is still round 1 (pre-persist). The merge then returns the stale round 1 `freshState`, effectively **undoing the round transition**.

That matches both symptoms:

- **Loop**: AI ends round → ROUND_ENDED is broadcast → state snaps back to “AI’s turn in round 1” → AI runs again → repeat.
- **No-disconnect repro**: the same rollback can happen even with a stable connection, as long as the round transition is triggered during AI persistence.

### Previous Hypothesis (Possibly Secondary): Missing AI Resume on Reconnect

The bug may also occur because **AI turns are client-initiated but NOT re-triggered on WebSocket reconnection**.

When a client disconnects (phone sleep), any in-flight AI turn may be abandoned. Upon reconnection, `handleJoin` in `mayi-room.ts` sends the current game state to the client BUT does NOT call `executeAITurnsIfNeeded()`. This leaves the game stuck with the AI player's turn never completing.

### Additional Evidence: Client Reconnect Path

The client already resyncs by re-sending `JOIN` after reconnect:

- `app/routes/game.$roomId.tsx` (around lines 154-167): `handleReconnect()` sends `{ type: "JOIN", ... }` via `usePartyConnection({ onReconnect })`.

So `handleJoin` is the most reliable server-side hook to “nudge” the room forward after a mobile sleep / WebSocket reconnect.

### Evidence

In `app/party/mayi-room.ts`, `executeAITurnsIfNeeded()` is called:
- Line 516: After `handleStartGame`
- Line 876: After `handleGameAction` (only if phase is `ROUND_ACTIVE`)
- Lines 719, 754: After agent state injection
- Line 1255: After May-I resolution

**Missing location:** `handleJoin` (lines 328-346) - when a player reconnects during a game in progress.

```typescript
// Current code - sends state but doesn't resume AI turns:
if (roomPhase === "playing") {
  const gameState = await this.getGameState();
  if (gameState) {
    const adapter = PartyGameAdapter.fromStoredState(gameState);
    // ... sends GAME_STARTED to client ...
  }
  // BUG: No call to executeAITurnsIfNeeded() here!
}
```

---

## Fix

### Proposed Fix (Updated): Don’t Roll Back New-Round State During AI Persist

Adjust `mergeAIStatePreservingOtherPlayerHands` so that when the round numbers differ, it keeps the **newer** round state (typically the AI’s), rather than always returning `freshState`.

At minimum:

- If `aiRoundNumber > freshRoundNumber` → return `aiState`
- If `freshRoundNumber > aiRoundNumber` → return `freshState` (defensive)

This should prevent the “AI ended the round but persist reverted it” behavior.

✅ **Implemented:** `app/party/party-game-adapter.ts` now prefers the newer round when `freshRoundNumber !== aiRoundNumber`.

### Proposed Fix (Secondary): Resume AI Turns on Reconnect

**Approach:** Resume AI turns on reconnect

Add a call to `executeAITurnsIfNeeded()` in `handleJoin` after sending `GAME_STARTED` to reconnecting clients:

```typescript
// In handleJoin, after sending GAME_STARTED (around line 345):
if (roomPhase === "playing") {
  const gameState = await this.getGameState();
  if (gameState) {
    const adapter = PartyGameAdapter.fromStoredState(gameState);
    const playerView = adapter.getPlayerView(playerId);
    const activityLog = adapter.getRecentActivityLog(10);
    if (playerView) {
      conn.send(
        JSON.stringify({
          type: "GAME_STARTED",
          state: playerView,
          activityLog,
        } satisfies ServerMessage)
      );
    }

    // FIX: Resume AI turns if one was interrupted by disconnect
    await this.executeAITurnsIfNeeded();
  }
}
```

### Why This Is Safe

1. **No duplicate executions:** The `AITurnCoordinator` has a `running` flag guard (`if (this.running) return;`) that prevents concurrent AI turn loops
2. **Idempotent:** If it's not an AI's turn, `executeAITurnsIfNeeded()` simply returns early
3. **Existing pattern:** This is the same pattern used elsewhere in the codebase

### Optional Hardening (Follow-ups)

- **Don’t block JOIN on a long AI turn:** Consider triggering AI resume in a non-blocking way (e.g., `ctx.waitUntil` / equivalent) so reconnect UX stays snappy even if the AI call is slow.
- **Phase-aware resume:** If reconnect can happen during `RESOLVING_MAY_I`, resuming via `executeAITurnsIfNeeded()` may not produce the same May-I prompt/resolution broadcasts as the dedicated May-I flow. A safer approach is:
  - If `snapshot.phase === "ROUND_ACTIVE"` → resume with `executeAITurnsIfNeeded()`
  - If `snapshot.phase === "RESOLVING_MAY_I"` and the prompted player is AI → resume with `executeAIMayIResponseIfNeeded()` (and/or re-broadcast the prompt for the reconnecting client)

---

## Files Changed

- `app/party/mayi-room.ts` - 4 lines added (3 comment + 1 code)

### Change Summary

```typescript
// Resume AI turns if one was interrupted by a client disconnect.
// This handles the case where the phone sleeps during an AI turn -
// without this, the AI turn would never complete and the game would be stuck.
await this.executeAITurnsIfNeeded();
```

---

## Verification

- Typecheck: PASS
- Tests: 2195 PASS (0 fail, 6 skip)
- Build: PASS

---

## Testing Plan

1. Unit test: Mock scenario where game state shows AI's turn, verify `executeAITurnsIfNeeded()` is called on join
2. Manual test: Play 1v2 AI game, let phone sleep during AI turn, verify game resumes correctly on wake

### Notes on Automated Testing

`MayIRoom` depends on `partyserver`, which imports `cloudflare:workers` at runtime. This means a straightforward `bun test` unit test that instantiates `MayIRoom` likely requires either:

- A Workers-compatible test harness (e.g., Miniflare / Wrangler dev-style integration tests), or
- Module mocking for `partyserver`/`cloudflare:workers` to exercise `handleJoin` in isolation.

### Repro Test (Unit)

Added a regression test that reproduces the rollback bug and now passes with the merge fix:

- `app/party/bug-40-round-transition-regression.test.ts`

---

## History

| Date | Column | Actor | Notes |
|------|--------|-------|-------|
| 2026-01-14 | New | Human | Created - reported from mobile testing |
| 2026-01-14 | Refinement | Agent | Root cause identified - missing AI turn resume on reconnect |
| 2026-01-14 | Implementation | Agent | Fix implemented, code review 95/100 PASS |
