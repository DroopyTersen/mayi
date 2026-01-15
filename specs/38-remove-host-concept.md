# Spec: Remove Host Concept

## Issue
#38 - Remove host concept - treat all human players as equal owners

## Overview
Remove the "host" concept from the game lobby. Currently, only the first player to join (the "host") can start the game, add/remove AI players, and change game settings. After this change, any joined human player can perform these actions.

## Changes

### 1. Server: mayi-room.ts

**Current (lines ~454-481):**
```typescript
// Verify caller is the host (first player)
const callerPlayerId = conn.state?.playerId;
// ...
const storedPlayers = await this.getStoredPlayers();
const sortedPlayers = [...storedPlayers].sort((a, b) => a.joinedAt - b.joinedAt);
const hostPlayerId = sortedPlayers[0]?.playerId;

if (callerPlayerId !== hostPlayerId) {
  conn.send(JSON.stringify({
    type: "ERROR",
    error: "NOT_HOST",
    message: "Only the host can start the game",
  }));
  return;
}
```

**After:** Remove the host validation block. Keep the "game already started" guard.

### 2. Client: game.$roomId.tsx

**Remove:**
```typescript
const isHost = useMemo(() => {
  if (!currentPlayerId || players.length === 0) return false;
  return players[0]?.playerId === currentPlayerId;
}, [currentPlayerId, players]);
```

**Update LobbyView usage:**
```diff
- <LobbyView isHost={isHost} ... />
+ <LobbyView ... />
```

### 3. UI: LobbyView.tsx

**Remove from props:**
```diff
interface LobbyViewProps {
-  isHost?: boolean;
   isJoined: boolean;
   // ...
}
```

**Update conditional rendering:**
```diff
- {isHost && onAddAIPlayer && (
+ {isJoined && onAddAIPlayer && (
    <AddAIPlayerDialog ... />
  )}

- {isHost && onStartGame && (
+ {isJoined && onStartGame && (
    <StartGameButton ... />
  )}

- {isHost && gameSettings && onSetStartingRound && (
+ {isJoined && gameSettings && onSetStartingRound && (
    // settings UI
  )}

- {isJoined && !isHost && (
-   <p>Waiting for the host to start the game...</p>
- )}
```

## Behavior Preservation

- Game start still requires >= 3 players (unchanged)
- AI add/remove works the same (unchanged)
- Game settings work the same (unchanged)
- Player ordering remains stable via `joinedAt` (unchanged)

## Edge Cases

| Scenario | Expected |
|----------|----------|
| Simultaneous START_GAME | First succeeds, second gets "Game has already started" |
| Simultaneous AI add | Both succeed (unless max players reached) |
| < 3 players | Start button disabled (existing validation) |

## Verification

```bash
bun run typecheck
bun test
bun run build
```

Manual testing:
1. Join lobby as 2 human players
2. Verify both see Add AI, Settings, Start Game buttons
3. Both try to start - verify graceful handling
