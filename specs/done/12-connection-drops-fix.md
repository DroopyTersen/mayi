# Spec: Fix Intermittent Connection Drops (#12)

## Overview

Fix the bug where players see "Waiting for other players..." when it's actually their turn, caused by silent WebSocket disconnections that don't auto-recover state.

## Requirements Summary

**Must Have:**
- Connection status indicator visible during gameplay (GameView)
- Heartbeat mechanism (~30s interval) to detect zombie connections
- Auto-reconnect with state resync (re-send JOIN to get fresh state)
- Clear connection state transitions: Connected → Disconnected → Reconnecting → Connected

**Human Feedback:**
- Heartbeat is fine, nothing too aggressive
- Show connection indicator right away on disconnect
- Wait a few seconds before reconnect attempt
- Auto-resync should work "same as if I refreshed manually"

## Technical Design

### Decision

**Selected Approach:** Pragmatic Balance with Heartbeat

**Rationale:** Human requested heartbeat for zombie detection. The fix leverages existing server behavior (JOIN during gameplay sends fresh GAME_STARTED) while adding clear connection state feedback. Single `usePartyConnection` hook encapsulates all connection logic cleanly.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    game.$roomId.tsx                              │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                  usePartyConnection                        │  │
│  │  - WebSocket lifecycle (via PartySocket)                   │  │
│  │  - Heartbeat: PING every 30s, timeout after 10s           │  │
│  │  - Status: connecting → connected → disconnected →        │  │
│  │            reconnecting → connected                        │  │
│  │  - Auto-resync: re-send JOIN on every onopen              │  │
│  └───────────────────────────────────────────────────────────┘  │
│                           │                                      │
│                           ▼                                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   GameView                                  │  │
│  │  - Receives connectionStatus prop                          │  │
│  │  - Shows ConnectionBanner when not connected               │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Server                                    │
│  mayi-room.ts:                                                   │
│  - PING → respond with PONG                                      │
│  - JOIN during playing → sends GAME_STARTED with fresh state     │
└─────────────────────────────────────────────────────────────────┘
```

### Files to Create

| File | Purpose |
|------|---------|
| `app/hooks/usePartyConnection.ts` | Hook for WebSocket + heartbeat + status tracking |
| `app/hooks/usePartyConnection.test.ts` | Tests for the hook |
| `app/ui/connection-status/ConnectionBanner.tsx` | Non-intrusive banner shown when disconnected |

### Files to Modify

| File | Changes |
|------|---------|
| `app/ui/lobby/lobby.types.ts` | Add "reconnecting" to ConnectionStatus type |
| `app/party/protocol.types.ts` | Add PING/PONG message types |
| `app/party/mayi-room.ts` | Handle PING, respond with PONG |
| `app/routes/game.$roomId.tsx` | Use usePartyConnection hook, pass status to GameView |
| `app/ui/game-view/GameView.tsx` | Add connectionStatus prop, render ConnectionBanner |

### Implementation Sequence

1. **Protocol Layer**
   - Add PING to ClientMessage union in protocol.types.ts
   - Add PONG to ServerMessage union in protocol.types.ts
   - Handle PING in mayi-room.ts onMessage, respond with PONG

2. **Type Updates**
   - Add "reconnecting" to ConnectionStatus in lobby.types.ts

3. **Connection Hook**
   - Create usePartyConnection.ts with:
     - PartySocket wrapper
     - Heartbeat: send PING every 30s
     - Timeout: if no PONG in 10s, force reconnect
     - Status tracking: connecting/connected/disconnected/reconnecting
     - wasConnectedRef to detect reconnects vs first connect
     - onOpen callback: always called, used for resync (re-send JOIN)
     - onMessage callback: forwards messages to consumer
   - Create test file for the hook

4. **UI Components**
   - Create ConnectionBanner.tsx:
     - Only visible when status !== "connected"
     - Yellow for connecting/reconnecting, red for disconnected
     - Fixed position at top of screen, non-intrusive
     - Shows appropriate message and animated icon

5. **Integration**
   - Update game.$roomId.tsx:
     - Replace inline socket logic with usePartyConnection
     - handleResync: re-send JOIN with stored playerId/name
     - handleMessage: existing message switch statement
     - Render ConnectionBanner at top
     - Pass connectionStatus to GameView
   - Update GameView.tsx:
     - Add optional connectionStatus prop (for future use)

### Key Implementation Details

**Heartbeat Timing:**
- Interval: 30 seconds (not aggressive per human feedback)
- Timeout: 10 seconds for PONG response
- On timeout: force PartySocket reconnect

**Status Transitions:**
```
Initial:        connecting
Socket opens:   connected (start heartbeat)
Socket closes:  disconnected → reconnecting (PartySocket auto-reconnects)
Heartbeat miss: reconnecting (force reconnect)
Socket reopens: connected (resync via JOIN)
```

**State Resync:**
On every socket open (first connect or reconnect):
1. Check for stored player name
2. If exists, send JOIN message
3. Server responds with GAME_STARTED containing fresh PlayerView
4. Client updates gameState - user is back in sync

### Verification Steps

| Step | Command | Expected |
|------|---------|----------|
| Type check | `bun run typecheck` | No errors |
| Unit tests | `bun test` | All pass |
| Build | `bun run build` | Success |
| Manual: Disconnect | Disable network while playing | Banner shows "Disconnected" |
| Manual: Reconnect | Re-enable network | Banner shows "Reconnecting...", then disappears |
| Manual: State sync | Continue playing after reconnect | Game state is current |
| Manual: Heartbeat | Wait 30s+ connected | No unnecessary reconnects |
| Manual: Zombie | Kill server process | Client detects within 40s, reconnects |

### TDD Plan

- [ ] Write test: usePartyConnection returns correct initial status
- [ ] Write test: usePartyConnection calls onOpen when socket opens
- [ ] Write test: usePartyConnection calls onMessage for non-PONG messages
- [ ] Write test: usePartyConnection handles PONG (clears timeout)
- [ ] Write test: ConnectionBanner renders nothing when connected
- [ ] Write test: ConnectionBanner renders message when disconnected
- [ ] Write test: Server responds to PING with PONG

## Open Questions

None - requirements are clear from human feedback.

## Spec Metadata

- **Card:** #12
- **Branch:** bug/12-intermittent-connection-drops-shows-waiting-when-its-your-turn
- **Author:** Agent
- **Date:** 2026-01-12
