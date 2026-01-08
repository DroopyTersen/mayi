# May-I Race Condition Fix

**Date**: 2026-01-01
**Status**: Complete

## Problem Statement

When a human player calls "May I?" during an AI player's turn, the game state gets corrupted because:
1. The AI turn continues executing in the background
2. The May-I handler modifies game state
3. When the AI turn completes, it overwrites the May-I state with stale data

Additionally, AI players never responded to May-I prompts when asked if they want the discard.

## Solution Architecture

### Core Approach: Abort + Persist

1. **AbortController pattern**: AI turns can be interrupted mid-execution via `AbortSignal`
2. **Immediate persistence**: State is saved after each AI action (draw, lay off, discard) via `onPersist` callback
3. **Clean abort handling**: When May-I is called, the current AI turn aborts gracefully

### Key Components

#### 1. AITurnCoordinator (`app/party/ai-turn-coordinator.ts`)
New class that manages AI turn execution with abort support:
- Encapsulates `AbortController` lifecycle
- Handles chained AI turns (multiple AIs in a row)
- Provides `abortCurrentTurn()` method for May-I interruption
- Calls `onPersist` after each tool execution
- Uses dependency injection for testability

#### 2. ExecuteTurnConfig Updates (`ai/mayIAgent.ts`)
Added two new optional parameters:
- `abortSignal?: AbortSignal` - Passed to Vercel AI SDK's `generateText()`
- `onPersist?: () => Promise<void>` - Called after each tool execution

#### 3. MayIRoom Integration (`app/party/mayi-room.ts`)
- Created `AITurnCoordinator` instance as class member
- Modified `CALL_MAY_I` handler to call `abortCurrentTurn()` before processing
- Added `executeAIMayIResponseIfNeeded()` for AI May-I responses
- Updated `executeAITurnsIfNeeded()` to delegate to coordinator

### Files Modified

| File | Changes |
|------|---------|
| `ai/mayIAgent.ts` | Added `abortSignal` and `onPersist` to config types |
| `app/party/ai-turn-handler.ts` | Thread abort params through to agent |
| `app/party/ai-turn-coordinator.ts` | **New file** - Coordinator class with tests |
| `app/party/ai-turn-coordinator.test.ts` | **New file** - 11 unit tests |
| `app/party/mayi-room.ts` | Integrated coordinator, added abort on May-I |

## Testing

### Unit Tests (11 new tests)
All passing in `ai-turn-coordinator.test.ts`:
- Exit immediately if not AI's turn
- Execute AI turn when appropriate
- Abort when `abortCurrentTurn()` called mid-turn
- Call `onPersist` after each tool execution
- Exit loop cleanly on abort without throwing
- Clean up `AbortController` on completion
- Broadcast after each persist
- Handle chained AI turns
- Respect `MAX_CHAINED_TURNS` limit (8)
- Safe to call `abortCurrentTurn()` when no turn running

### E2E Testing Results
- AI turns execute correctly (draw, lay off, discard)
- Game state persists between turns without corruption
- No crashes during normal gameplay
- Turn order is correct
- AI players lay down contracts and lay off cards successfully

### Manual May-I Testing
Manual testing of the May-I abort is difficult because AI turns complete very quickly (~1 second). The May-I button only appears briefly between a player's discard and the next player's draw. The abort/persist functionality is verified via unit tests.

## Quality Metrics

- **TypeScript**: No errors
- **Tests**: 1986 passing (including 11 new)
- **E2E**: Game plays correctly without crashes

## Known Issues (Unrelated)

Several UI bugs were discovered during E2E testing and documented in `specs/2026-01-01-gameplay-issues.md`:
- **Critical**: Discard modal selects wrong card (Issue 8)
- Minor: Card selection counter persists incorrectly
- Minor: Activity log shows internal IDs vs display names

## Future Considerations

1. **AI May-I responses**: The `executeAIMayIResponseIfNeeded()` method is implemented but needs testing when a human calls May-I and AI is asked
2. **May-I timing window**: Consider adding a configurable delay after discards to give humans more time to click May-I
3. **Discard selection bug**: Issue 8 is game-breaking and should be fixed before further testing
