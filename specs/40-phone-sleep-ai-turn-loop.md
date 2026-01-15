# Spec: #40 - Phone screen sleep during AI turn causes round transition loop

## Problem

When a mobile client disconnects (phone sleep) during an AI player's turn, the AI turn is abandoned and never resumes on reconnection. This leaves the game stuck in an infinite loop.

## Root Cause

`handleJoin` in `app/party/mayi-room.ts` sends game state to reconnecting clients but does NOT call `executeAITurnsIfNeeded()`.

## Solution

Add `executeAITurnsIfNeeded()` call in `handleJoin` after sending `GAME_STARTED` to reconnecting clients.

## Implementation

### File: `app/party/mayi-room.ts`

**Location:** Inside `handleJoin`, after the `conn.send(GAME_STARTED)` block (around line 345)

**Change:**
```typescript
// After sending GAME_STARTED to reconnecting client:
if (playerView) {
  conn.send(
    JSON.stringify({
      type: "GAME_STARTED",
      state: playerView,
      activityLog,
    } satisfies ServerMessage)
  );
}

// ADD THIS: Resume AI turns if interrupted by disconnect
await this.executeAITurnsIfNeeded();
```

## Safety

1. `AITurnCoordinator` has `running` flag guard - prevents duplicate executions
2. `executeAITurnsIfNeeded()` is idempotent - returns early if not AI's turn
3. Same pattern already used in 4+ other locations in same file

## Testing

1. Verify `executeAITurnsIfNeeded()` is called during reconnect when game is in progress
2. Manual test: 1v2 AI game, sleep phone during AI turn, verify resume on wake
