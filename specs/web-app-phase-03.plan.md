# Phase 3: Game Integration & Multiplayer Gameplay (MVP)

> **Status**: Planned
> **Depends on**: Phase 2 (Lobby Identity & Presence)
> **Estimated scope**: Major feature - multiple implementation sessions
>
> **Primary goal**: Transform the lobby into a fully playable multiplayer game with AI players, real-time state sync, and the complete May I? experience using the existing UI components.

---

## Executive Summary

Phase 3 bridges the lobby (Phase 2) with the core game engine to deliver a complete multiplayer web experience. Players can:

1. Add AI players to the lobby with model selection
2. Configure the starting round
3. Start the game when 3+ players are ready
4. Play through all 6 rounds with real-time state sync
5. Handle the May I? mechanic with blocking prompts
6. See AI players take turns server-side
7. Reconnect to games in progress

---

## Design Decisions (Explicit)

### Decision 1: No Host Concept

There is no distinguished "host" player. Any player can:
- Add AI players
- Remove AI players
- Change the starting round
- Click "Start Game"

**Why**: Simplifies UX for family games. Avoids "who's the host?" confusion.

### Decision 2: AI Model Selection via Dropdown

When adding an AI player, show a dropdown with available models:
- `xai:grok-4-1-fast-reasoning` (Grok - default)
- `anthropic:claude-haiku-4-5` (Claude)
- `openai:gpt-5-mini` (GPT)
- `gemini:gemini-3-flash-preview` (Gemini)

AI players get auto-generated names (e.g., "Claude the Cat", "Grok the Goat").

### Decision 3: Starting Round Selection

Any player can change the starting round (1-6) before the game starts. Default is Round 1.

Displayed in lobby as a dropdown or segmented control.

### Decision 4: Game Locked at Start

Once "Start Game" is clicked:
- No new players can join
- Lobby transitions to game view
- All players see the game board

**Future scope**: Spectator mode for late joiners.

### Decision 5: Server-Side AI Execution

AI turns are executed in the PartyKit room (Cloudflare Worker):
- Uses existing `executeAITurn()` from `ai/mayIAgent.ts`
- AIPlayerRegistry stored in room context
- Results broadcast to all clients as they happen

### Decision 6: Blocking May I Prompts

When a player calls "May I?":
- All eligible players (ahead in turn order, not down) see a modal
- Each must respond: "Allow" or "May I Instead!"
- No timeout - players must respond
- Resolves in turn order per game rules

### Decision 7: Full State Snapshots

WebSocket broadcasts full `PlayerView` snapshots on every state change:
- Simpler to implement and debug
- Each player sees their own hand, opponent card counts
- No need to reconstruct state from events

### Decision 8: Durable Object Persistence

Game state stored in PartyKit Durable Object storage:
- Key: `game-state` → serialized GameEngine snapshot
- Supports reconnection after tab close/refresh
- No external database needed for MVP

### Decision 9: Grace Period for Disconnects

When a player disconnects during gameplay:
- Wait 30 seconds for reconnection
- If still disconnected, auto-play their turn:
  - Draw from stock
  - Skip action phase
  - Discard first card in hand
- Player can reconnect and resume on their next turn

**Future scope**: Replace disconnected player with AI.

### Decision 10: Auto-Continue Between Rounds

When a round ends:
- Show brief score overlay (3-5 seconds)
- Auto-start next round
- No manual "Continue" button needed

### Decision 11: Activity Log Detail Level

Similar to CLI interactive mode:
- "Alice drew from stock"
- "Bob laid down (Set: 9♠9♥9♦, Run: 5♣6♣7♣8♣)"
- "Carol discarded K♣"
- "Dave called May I?"
- "Alice went out! Round 2 complete."

### Decision 12: ResponsiveDrawer for Actions

All action views (Lay Down, Lay Off, Discard, Swap Joker, Organize) use `ResponsiveDrawer`:
- Dialog on desktop (≥768px)
- Bottom sheet on mobile (<768px)
- Matches UX spec pattern

---

## Wire Protocol (Phase 3)

### Client → Server Messages

```typescript
type ClientMessage =
  // Lobby (Phase 2)
  | { type: "JOIN"; playerId: string; playerName: string }

  // Lobby (Phase 3 additions)
  | { type: "ADD_AI_PLAYER"; name: string; modelId: string }
  | { type: "REMOVE_AI_PLAYER"; playerId: string }
  | { type: "SET_STARTING_ROUND"; round: 1 | 2 | 3 | 4 | 5 | 6 }
  | { type: "START_GAME" }

  // Gameplay commands
  | { type: "GAME_ACTION"; action: GameAction };

type GameAction =
  | { type: "DRAW_FROM_STOCK" }
  | { type: "DRAW_FROM_DISCARD" }
  | { type: "LAY_DOWN"; melds: MeldSpec[] }
  | { type: "LAY_OFF"; cardId: string; meldId: string }
  | { type: "SWAP_JOKER"; meldId: string; jokerCardId: string; swapCardId: string }
  | { type: "DISCARD"; cardId: string }
  | { type: "SKIP" }
  | { type: "REORDER_HAND"; cardIds: string[] }
  | { type: "CALL_MAY_I" }
  | { type: "ALLOW_MAY_I" }
  | { type: "CLAIM_MAY_I" };

interface MeldSpec {
  type: "set" | "run";
  cardIds: string[];
}
```

### Server → Client Messages

```typescript
type ServerMessage =
  // Lobby (Phase 2)
  | { type: "CONNECTED"; roomId: string }
  | { type: "JOINED"; playerId: string; playerName: string }
  | { type: "PLAYERS"; players: PlayerInfo[] }
  | { type: "ERROR"; error: string; message: string }

  // Lobby (Phase 3 additions)
  | { type: "LOBBY_STATE"; lobbyState: LobbyState }
  | { type: "AI_PLAYER_ADDED"; player: AIPlayerInfo }
  | { type: "AI_PLAYER_REMOVED"; playerId: string }
  | { type: "STARTING_ROUND_CHANGED"; round: number }

  // Game state
  | { type: "GAME_STARTED"; initialState: PlayerView }
  | { type: "GAME_STATE"; state: PlayerView }
  | { type: "AI_THINKING"; playerId: string; playerName: string }
  | { type: "AI_DONE"; playerId: string }

  // May I prompts
  | { type: "MAY_I_PROMPT"; callerId: string; callerName: string; card: Card }
  | { type: "MAY_I_RESOLVED"; winnerId: string | null; outcome: string }

  // Round/Game transitions
  | { type: "ROUND_ENDED"; roundNumber: number; scores: Record<string, number> }
  | { type: "GAME_ENDED"; finalScores: Record<string, number>; winnerId: string };

interface LobbyState {
  players: PlayerInfo[];          // Human players
  aiPlayers: AIPlayerInfo[];      // AI players
  startingRound: number;          // 1-6
  canStart: boolean;              // true if 3+ total players
}

interface AIPlayerInfo {
  playerId: string;
  name: string;
  modelId: string;
  modelDisplayName: string;       // "Grok", "Claude", etc.
}
```

---

## Server Implementation

### Room State Shape

```typescript
interface RoomState {
  // Phase (lobby vs playing)
  phase: "lobby" | "playing";

  // Lobby state
  humanPlayers: Map<string, StoredPlayer>;  // From Phase 2
  aiPlayers: AIPlayerInfo[];
  startingRound: number;

  // Game state (when playing)
  gameEngine: GameEngine | null;
  aiRegistry: AIPlayerRegistry | null;

  // Disconnect tracking
  disconnectedPlayers: Map<string, { since: number; playerId: string }>;
}
```

### Key Server Handlers

#### `ADD_AI_PLAYER`
1. Validate: lobby phase, < 8 total players
2. Generate playerId: `ai-${nanoid(8)}`
3. Add to `aiPlayers` array
4. Broadcast `LOBBY_STATE` to all

#### `REMOVE_AI_PLAYER`
1. Validate: lobby phase, player exists
2. Remove from `aiPlayers` array
3. Broadcast `LOBBY_STATE` to all

#### `START_GAME`
1. Validate: lobby phase, 3+ total players
2. Create player list: humans + AI
3. Initialize `GameEngine.createGame({ players, startingRound })`
4. Initialize `AIPlayerRegistry` with AI configs
5. Set `phase = "playing"`
6. Persist game state to storage
7. Broadcast `GAME_STARTED` with each player's `PlayerView`

#### `GAME_ACTION`
1. Validate: playing phase, sender's turn (or May I eligible)
2. Execute action on `GameEngine`
3. Persist updated state
4. Broadcast `GAME_STATE` with updated `PlayerView` to each player
5. If AI's turn next, trigger AI execution

#### AI Turn Execution
```typescript
async function executeAIPlayerTurn(playerId: string) {
  broadcast({ type: "AI_THINKING", playerId, playerName });

  try {
    await executeAITurn({
      game: gameEngine,
      playerId,
      registry: aiRegistry,
      maxSteps: 10,
    });
  } catch (error) {
    // Fallback: draw, skip, discard first card
    handleSimpleAIFallback(playerId);
  }

  broadcast({ type: "AI_DONE", playerId });
  persistState();
  broadcastGameState();

  // Check if next player is also AI
  checkAndExecuteNextAI();
}
```

---

## Client Implementation

### Game Route State

```typescript
// app/routes/game.$roomId.tsx

interface GameRouteState {
  // Connection
  connectionStatus: "connecting" | "connected" | "disconnected";

  // Identity
  playerId: string | null;
  playerName: string | null;
  joinStatus: "unjoined" | "joining" | "joined";

  // Phase
  phase: "lobby" | "playing";

  // Lobby state
  lobbyState: LobbyState | null;

  // Game state (when playing)
  gameView: PlayerView | null;

  // UI state
  activeView: ActiveView | null;
  showNamePrompt: boolean;
  showMayIPrompt: MayIPromptData | null;
  aiThinking: string | null;  // playerId of thinking AI
}

type ActiveView =
  | { type: "lay-down" }
  | { type: "lay-off" }
  | { type: "discard" }
  | { type: "swap-joker" }
  | { type: "organize" };
```

### UI Component Integration

The game view composes existing UI components:

```tsx
function GameView({ gameView, playerId, onAction }: GameViewProps) {
  const isMyTurn = gameView.awaitingPlayerId === playerId;
  const myPlayer = gameView.players.find(p => p.id === playerId);

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <GameHeader
        round={gameView.currentRound}
        totalRounds={6}
        contract={gameView.contract}
      />

      {/* Main content - 2 column on desktop, stacked on mobile */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_300px] overflow-hidden">
        {/* Left: Table + Discard */}
        <div className="overflow-y-auto p-4">
          <TableDisplay
            melds={gameView.table}
            players={gameView.players}
            currentPlayerId={gameView.awaitingPlayerId}
          />
          <DiscardPileDisplay
            topCard={gameView.discardTop}
            interactiveLabel={getDiscardLabel(gameView, isMyTurn)}
            onClick={() => handleDiscardClick(gameView, isMyTurn)}
          />
        </div>

        {/* Right: Players + Activity */}
        <div className="border-l p-4 space-y-4">
          <PlayersTableDisplay
            players={gameView.players}
            currentPlayerId={gameView.awaitingPlayerId}
          />
          <ActivityLog entries={gameView.activityLog} />
        </div>
      </div>

      {/* Bottom: Hand + Actions */}
      <div className="border-t p-4">
        <HandDisplay
          cards={myPlayer.hand}
          selectedIds={selectedCards}
          onCardClick={handleCardClick}
        />
        <ActionBar
          phase={gameView.turnPhase}
          isYourTurn={isMyTurn}
          isDown={myPlayer.isDown}
          hasDrawn={gameView.hasDrawn}
          canMayI={canCallMayI(gameView, playerId)}
          onAction={handleAction}
        />
      </div>

      {/* Action modals */}
      <LayDownDrawer ... />
      <LayOffDrawer ... />
      <DiscardDrawer ... />
      <SwapJokerDrawer ... />
      <OrganizeDrawer ... />
      <MayIPromptDrawer ... />
    </div>
  );
}
```

### Lobby View Enhancements

Add to existing `LobbyView`:

```tsx
// New components needed:
<AddAIPlayerButton onClick={() => setShowAddAI(true)} />
<AddAIPlayerDialog
  open={showAddAI}
  onAdd={(name, modelId) => sendMessage({ type: "ADD_AI_PLAYER", name, modelId })}
/>

<AIPlayersList
  aiPlayers={lobbyState.aiPlayers}
  onRemove={(playerId) => sendMessage({ type: "REMOVE_AI_PLAYER", playerId })}
/>

<StartingRoundSelector
  value={lobbyState.startingRound}
  onChange={(round) => sendMessage({ type: "SET_STARTING_ROUND", round })}
/>

<StartGameButton
  disabled={!lobbyState.canStart}
  onClick={() => sendMessage({ type: "START_GAME" })}
/>
```

---

## Implementation Phases

### Phase 3.1: Lobby Enhancements
1. Add AI player button + dialog UI
2. AI player list with remove button
3. Starting round selector
4. Start game button (disabled until 3+ players)
5. Server handlers: ADD_AI_PLAYER, REMOVE_AI_PLAYER, SET_STARTING_ROUND

### Phase 3.2: Game Initialization
1. START_GAME handler creates GameEngine
2. Initialize AIPlayerRegistry with AI configs
3. Persist initial game state to Durable Object storage
4. Broadcast GAME_STARTED with player views
5. Client transitions from lobby view to game view

### Phase 3.3: Game View Layout
1. Implement main game view following UX spec
2. Integrate existing UI components (GameHeader, TableDisplay, HandDisplay, etc.)
3. Action bar with phase-appropriate buttons
4. Players panel with card counts and status
5. Activity log display

### Phase 3.4: Turn Flow (Human Players)
1. Draw phase: stock/discard buttons, DRAW_FROM_STOCK/DRAW_FROM_DISCARD actions
2. Action phase: Lay Down, Lay Off, Swap Joker, Skip
3. Discard phase: DiscardView in drawer
4. State sync after each action

### Phase 3.5: Action Views
1. LayDownView in ResponsiveDrawer
2. LayOffView in ResponsiveDrawer
3. DiscardView in ResponsiveDrawer
4. SwapJokerView in ResponsiveDrawer
5. OrganizeHandView in ResponsiveDrawer

### Phase 3.6: May I Mechanic
1. CALL_MAY_I client action
2. Server broadcasts MAY_I_PROMPT to eligible players
3. MayIRequestView in blocking modal
4. ALLOW_MAY_I and CLAIM_MAY_I actions
5. MAY_I_RESOLVED broadcast

### Phase 3.7: AI Player Turns
1. Server-side AI turn execution
2. AI_THINKING/AI_DONE broadcasts
3. Simple "thinking" indicator in UI
4. Fallback for AI failures
5. Chained AI turns (multiple AIs in a row)

### Phase 3.8: Round & Game Transitions
1. Round end detection
2. Score overlay display (3-5s)
3. Auto-continue to next round
4. Game end detection
5. Final scores display with winner

### Phase 3.9: Reconnection & Persistence
1. Game state persistence to DO storage on every change
2. Reconnection flow: load state, rejoin game
3. Disconnect grace period (30s)
4. Auto-play for disconnected players

---

## New UI Components Needed

### Lobby Components (Phase 3.1)

#### `AddAIPlayerDialog`
- Name input (auto-generated default)
- Model dropdown (Grok, Claude, GPT, Gemini)
- Add button

#### `AIPlayersList`
- List of AI players with model icon/name
- Remove button per AI

#### `StartingRoundSelector`
- Dropdown or segmented control (1-6)
- Shows current contract for selected round

#### `StartGameButton`
- Large primary button
- Shows player count: "Start Game (4 players)"
- Disabled state when < 3 players

### Game Components (Phase 3.3)

#### `GameView`
- Main game layout composing all existing components
- Responsive: stacked on mobile, 2-column on desktop

#### `AIThinkingIndicator`
- Small overlay/badge showing "AI is thinking..."
- Shows on current AI player

#### `RoundEndOverlay`
- Brief score display (3-5s)
- Shows round winner and points
- Auto-dismisses

#### `GameEndScreen`
- Final standings table
- Winner announcement
- "Play Again" and "Exit" buttons

---

## Data Flow Diagrams

### Start Game Flow
```
Human clicks "Start Game"
    ↓
Client sends: { type: "START_GAME" }
    ↓
Server validates: 3+ players, lobby phase
    ↓
Server creates: GameEngine.createGame({ players, startingRound })
Server creates: AIPlayerRegistry with AI configs
    ↓
Server persists: game state to DO storage
Server sets: phase = "playing"
    ↓
Server broadcasts: GAME_STARTED to each player
    (each gets their own PlayerView with their hand visible)
    ↓
Clients transition: lobby view → game view
    ↓
If first player is AI: server triggers executeAITurn()
```

### Human Turn Flow
```
Game state: awaiting human player X
    ↓
Client X sees: enabled action buttons
    ↓
Player clicks "Draw from Stock"
Client sends: { type: "GAME_ACTION", action: { type: "DRAW_FROM_STOCK" } }
    ↓
Server validates: player X's turn, draw phase
Server executes: gameEngine.drawFromStock(playerId)
Server persists: updated state
    ↓
Server broadcasts: GAME_STATE to all
    (each player gets updated PlayerView)
    ↓
Player clicks "Lay Down"
Client opens: LayDownView drawer
Player stages melds, clicks "Lay Down"
Client sends: { type: "GAME_ACTION", action: { type: "LAY_DOWN", melds: [...] } }
    ↓
Server validates & executes
Server broadcasts: updated state
    ↓
Player clicks "Discard" → selects card
Client sends: { type: "GAME_ACTION", action: { type: "DISCARD", cardId: "..." } }
    ↓
Server executes, advances to next player
Server broadcasts: updated state
    ↓
If next player is AI: server triggers AI turn
```

### May I Flow
```
Player A discards a card
Server broadcasts: GAME_STATE (card exposed for May I)
    ↓
Player B (not down, after A in turn order) clicks "May I?"
Client sends: { type: "GAME_ACTION", action: { type: "CALL_MAY_I" } }
    ↓
Server validates: B is eligible
Server broadcasts: MAY_I_PROMPT to eligible players ahead of B
    ↓
Player C sees MayIRequestView modal:
  "Player B wants the K♣. Allow or May I Instead?"
    ↓
Option 1: C clicks "Allow"
  Client sends: { type: "GAME_ACTION", action: { type: "ALLOW_MAY_I" } }
  Server checks next eligible player, or resolves if none left
    ↓
Option 2: C clicks "May I Instead!"
  Client sends: { type: "GAME_ACTION", action: { type: "CLAIM_MAY_I" } }
  Server resolves: C wins the May I
    ↓
Server broadcasts: MAY_I_RESOLVED { winnerId, outcome }
Server broadcasts: GAME_STATE (winner has card + penalty card)
```

---

## Testing Strategy

### Unit Testing Opportunities

While UI components are best tested via E2E, there are many pure-logic areas that benefit from traditional unit tests:

#### 1. Server Message Handlers (`app/party/mayi-room.ts`)

**File**: `app/party/mayi-room.handlers.test.ts`

Extract message handling logic into pure functions that can be unit tested:

```typescript
// Pure functions to test:
validateJoinMessage(message: unknown): { valid: true; data: JoinMessage } | { valid: false; error: string }
validateAddAIPlayerMessage(message: unknown): ...
validateGameActionMessage(message: unknown): ...
canStartGame(lobbyState: LobbyState): boolean
canPlayerAct(gameState: GameSnapshot, playerId: string, action: GameAction): boolean
```

**Test cases**:
- Invalid message shapes are rejected
- Name length validation (1-24 chars)
- Player ID validation (1-64 chars)
- Model ID validation (known models only)
- Game start requires 3+ players
- Actions validated against current game phase

#### 2. Lobby State Logic (`app/party/mayi-room.lobby.ts`)

**File**: `app/party/mayi-room.lobby.test.ts`

Pure functions for lobby state management:

```typescript
// Pure functions to test:
addAIPlayer(state: LobbyState, name: string, modelId: string): LobbyState
removeAIPlayer(state: LobbyState, playerId: string): LobbyState
setStartingRound(state: LobbyState, round: number): LobbyState
buildLobbyState(humanPlayers: StoredPlayer[], aiPlayers: AIPlayerInfo[], startingRound: number): LobbyState
canStartGame(state: LobbyState): boolean
getTotalPlayerCount(state: LobbyState): number
```

**Test cases**:
- Adding AI player increments count
- Removing AI player by ID
- Cannot add more than 8 total players
- Starting round must be 1-6
- canStartGame returns true at 3+ players
- AI player gets unique ID generated

#### 3. Game Action Validation (`app/party/game-actions.ts`)

**File**: `app/party/game-actions.test.ts`

Logic to determine if an action is valid for current state:

```typescript
// Pure functions to test:
isPlayersTurn(state: GameSnapshot, playerId: string): boolean
canDraw(state: GameSnapshot, playerId: string): boolean
canDrawFromDiscard(state: GameSnapshot, playerId: string): boolean
canLayDown(state: GameSnapshot, playerId: string): boolean
canLayOff(state: GameSnapshot, playerId: string): boolean
canDiscard(state: GameSnapshot, playerId: string): boolean
canCallMayI(state: GameSnapshot, playerId: string): boolean
canAllowMayI(state: GameSnapshot, playerId: string): boolean
canClaimMayI(state: GameSnapshot, playerId: string): boolean
getAvailableActions(state: GameSnapshot, playerId: string): GameAction[]
```

**Test cases**:
- Cannot draw when not your turn
- Cannot draw twice in one turn
- Cannot discard without drawing first
- Cannot lay off on same turn as lay down
- Cannot lay off if not down
- Can only call May I when discard exposed and not down
- May I prompt only shown to eligible players

#### 4. PlayerView Generation (`core/engine/game-engine.ts`)

Already exists: `getPlayerView(playerId)` - but can add more tests:

**Test cases**:
- Own hand is visible, opponents' hands are hidden
- Card counts are accurate for opponents
- Table melds visible to all
- Discard pile visible to all
- May I context visible when active
- Activity log filtered appropriately

#### 5. Activity Log Formatting (`app/party/activity-log.ts`)

**File**: `app/party/activity-log.test.ts`

Convert game state changes to human-readable log entries:

```typescript
// Pure functions to test:
formatDrawAction(playerId: string, playerName: string, source: "stock" | "discard"): string
formatLayDownAction(playerId: string, playerName: string, melds: Meld[]): string
formatDiscardAction(playerId: string, playerName: string, card: Card): string
formatMayIAction(callerId: string, callerName: string, card: Card): string
formatMayIResolution(winnerId: string, winnerName: string, outcome: string): string
formatRoundEnd(roundNumber: number, winnerId: string, winnerName: string): string
diffGameStates(before: GameSnapshot, after: GameSnapshot): ActivityLogEntry[]
```

**Test cases**:
- Draw from stock formats correctly
- Draw from discard includes card
- Lay down shows meld summary
- Discard shows card
- May I shows caller and card
- Round end shows winner

#### 6. Disconnect Handling (`app/party/disconnect-handler.ts`)

**File**: `app/party/disconnect-handler.test.ts`

Pure logic for disconnect grace period and auto-play:

```typescript
// Pure functions to test:
shouldAutoPlay(disconnectedAt: number, gracePeriodMs: number): boolean
generateAutoPlayActions(state: GameSnapshot, playerId: string): GameAction[]
```

**Test cases**:
- Auto-play triggers after grace period
- Auto-play: draws from stock
- Auto-play: skips action phase
- Auto-play: discards first card
- Reconnected player not auto-played

#### 7. AI Registry Operations (`ai/aiPlayer.registry.ts`)

Already has tests, but add Phase 3 scenarios:

**Additional test cases**:
- Register multiple AI players
- Clear registry on game start
- Get all AI player IDs
- Registry survives serialization (for DO persistence)

#### 8. Wire Protocol Types (`app/party/protocol.types.ts`)

Use Zod schemas and test them:

**File**: `app/party/protocol.test.ts`

```typescript
// Test schema validation:
clientMessageSchema.parse(...)
serverMessageSchema.parse(...)
```

**Test cases**:
- Valid messages pass validation
- Invalid messages throw with helpful errors
- Optional fields handled correctly
- Union types discriminate correctly

#### 9. Round/Game Transition Logic

**File**: `app/party/transitions.test.ts`

```typescript
// Pure functions to test:
shouldEndRound(state: GameSnapshot): boolean
shouldEndGame(state: GameSnapshot): boolean
calculateRoundScores(state: GameSnapshot): Record<string, number>
determineWinner(finalScores: Record<string, number>): string
```

**Test cases**:
- Round ends when player has 0 cards
- Game ends after Round 6
- Scores calculated from remaining cards
- Lowest score wins
- Tie-breaking rules

### Test File Organization

```
app/party/
├── mayi-room.ts                 # Main PartyServer class
├── mayi-room.handlers.ts        # Message handlers (extracted)
├── mayi-room.handlers.test.ts   # Handler tests
├── mayi-room.lobby.ts           # Lobby state management
├── mayi-room.lobby.test.ts      # Lobby tests
├── mayi-room.presence.ts        # Player presence (Phase 2)
├── mayi-room.presence.test.ts   # Presence tests (Phase 2)
├── game-actions.ts              # Action validation
├── game-actions.test.ts         # Action validation tests
├── activity-log.ts              # Log formatting
├── activity-log.test.ts         # Log formatting tests
├── disconnect-handler.ts        # Disconnect logic
├── disconnect-handler.test.ts   # Disconnect tests
├── protocol.types.ts            # Wire protocol types + Zod schemas
└── protocol.test.ts             # Protocol validation tests
```

### Integration Tests (Slower, Optional)

These test real interactions but skip the UI:

1. **WebSocket message flow**: Send messages to PartyServer, verify responses
2. **AI turn execution**: Full AI turn with mocked LLM (or real with `RUN_INTEGRATION_TESTS=1`)
3. **Full game simulation**: Programmatically play through a game

### Manual Testing Scenarios

1. **Basic game flow**: 2 humans + 1 AI, play through Round 1
2. **AI-heavy game**: 1 human + 3 AI, verify AI turns execute correctly
3. **May I mechanic**: Multiple eligible players, test priority resolution
4. **Reconnection**: Close tab mid-game, reopen, verify state restored
5. **Disconnect handling**: Disconnect during turn, verify auto-play after 30s
6. **Round transitions**: Complete multiple rounds, verify scoring
7. **Mobile experience**: Test all views on phone viewport

---

## Out of Scope (Future Backlog)

1. **Spectator mode**: Late joiners can watch but not play
2. **Replace disconnected with AI**: Option to convert disconnected human to AI
3. **AI action streaming**: Show AI "reasoning" (carefully, to not reveal hand)
4. **Turn timer**: Optional configurable turn time limit
5. **Rematch**: Quick restart with same players
6. **Chat**: In-game player chat
7. **Sound effects**: Card sounds, notifications
8. **Animations**: Card dealing, drawing, discarding animations

---

## Verification (End-to-End Testing with Claude Chrome Extension)

After implementation, use the Claude Chrome extension (`mcp__claude-in-chrome__*` tools) to perform comprehensive end-to-end testing. This tests real browser behavior, not just unit tests.

### Test Setup

1. **Start the dev server**: `bun run dev`
2. **Open multiple browser tabs** to simulate multiple players
3. **Use the Chrome extension** to control each tab and verify behavior

### Test Scenario 1: Multi-Human Lobby & Game Start

1. **Tab 1**: Navigate to `http://localhost:5173/game/test-e2e-1`
   - Enter name "Alice"
   - Verify: Alice appears in player list as connected

2. **Tab 2**: Navigate to same room URL
   - Enter name "Bob"
   - Verify: Both Alice and Bob appear in both tabs

3. **Tab 1**: Click "Add AI Player"
   - Enter name "Claude Bot"
   - Select "Claude" model from dropdown
   - Click "Add"
   - Verify: AI player appears in lobby list with model indicator

4. **Tab 1 or Tab 2**: Click "Start Game"
   - Verify: Both tabs transition to game view
   - Verify: Game header shows "Round 1 of 6 — 2 sets"
   - Verify: Each player sees their own hand (different cards)
   - Verify: One player is indicated as current turn

### Test Scenario 2: Human Turn Flow

1. **Current player's tab**: Verify action bar shows "Draw Stock" / "Draw Discard"
2. Click "Draw Stock"
   - Verify: Hand now has one more card
   - Verify: Action bar changes to show "Lay Down" / "Discard"
3. Click "Discard" → select a card → confirm
   - Verify: Card appears on discard pile
   - Verify: Turn advances to next player
   - Verify: Activity log shows the action

4. **Other player's tab**: Verify turn indicator moved
   - Verify: Their action bar is now enabled

### Test Scenario 3: AI Player Turn

1. Wait for AI player's turn
   - Verify: "AI is thinking..." indicator appears
   - Verify: After a few seconds, AI completes its turn
   - Verify: Activity log shows AI actions (drew, discarded)
   - Verify: Turn advances to next player

### Test Scenario 4: Lay Down Contract

1. When a player has cards that can form the contract:
   - Click "Lay Down"
   - Verify: ResponsiveDrawer opens with staging areas
   - Stage cards into Set 1 and Set 2 (Round 1)
   - Verify: Validation shows when melds are valid
   - Click "Lay Down" button
   - Verify: Melds appear on table display
   - Verify: Player is marked as "down" (✓)

### Test Scenario 5: May I Mechanic

1. Setup: Have a player discard a desirable card
2. **Non-current player tab**: Verify "May I?" button appears
3. Click "May I?"
   - Verify: Other eligible players see the May I prompt modal
4. **Prompted player**: Click "Allow" or "May I Instead!"
   - Verify: Resolution happens correctly
   - Verify: Winner gets card + penalty card
   - Verify: Activity log shows May I resolution

### Test Scenario 6: Round Transition

1. Play until one player goes out (discards with no cards left after lay down/lay off)
   - Verify: Round end overlay appears with scores
   - Verify: After 3-5 seconds, next round starts automatically
   - Verify: New cards dealt, contract updates

### Test Scenario 7: Reconnection

1. **Tab 1**: Close the tab (simulate disconnect)
2. Wait a few seconds
3. **Reopen Tab 1**: Navigate back to the same game URL
   - Verify: Automatically rejoins the game
   - Verify: Game state is restored (correct round, hand, table)
   - Verify: Can continue playing

### Test Scenario 8: Mobile Responsiveness

1. Use `resize_window` to set viewport to phone size (375x667)
2. Verify: Layout stacks vertically
3. Verify: ResponsiveDrawer shows as bottom sheet
4. Verify: Cards and buttons are touch-friendly size
5. Verify: Hand display shows appropriate card overlap

### UI Bug Checklist

During testing, watch for these common issues:

- [ ] Cards render correctly (suit colors, jokers, wilds)
- [ ] Selected cards show visual feedback
- [ ] Disabled buttons are properly grayed out
- [ ] Current player is highlighted in players table
- [ ] Activity log updates in real-time
- [ ] No console errors in browser
- [ ] No layout overflow or scroll issues
- [ ] Loading states show appropriately
- [ ] Error messages display when actions fail

### Test Data Notes

- Game ID `test-e2e-1` (or similar) for consistent testing
- Can use Round 6 start to test "go out without discard" rule
- Test with 3 players minimum, up to 8 for stress testing

---

## Definition of Done (Phase 3)

- [ ] Can add AI players with model selection in lobby
- [ ] Can remove AI players in lobby
- [ ] Can change starting round (1-6)
- [ ] Start Game button works when 3+ players
- [ ] Game view displays all relevant state (hand, table, players, discard)
- [ ] Human players can complete full turns (draw → action → discard)
- [ ] All action views work (Lay Down, Lay Off, Discard, Swap Joker, Organize)
- [ ] AI players take turns automatically (server-side)
- [ ] May I mechanic works with blocking prompts
- [ ] Rounds transition automatically with score display
- [ ] Game ends properly with final scores
- [ ] Reconnection restores game state
- [ ] Disconnect grace period + auto-play works
- [ ] Activity log shows game events
- [ ] Mobile-responsive layout matches UX spec
- [ ] End-to-end Chrome extension testing passes all scenarios

---

## References

- [Phase 2 Plan](./web-app-phase-02.plan.md) - Lobby implementation
- [UX Specification](./web-app-ux.md) - UI/UX design
- [UI Components Plan](./ui-components.plan.md) - Component inventory
- [Tech Design](./tech-design.md) - Architecture overview
- [House Rules](../docs/house-rules.md) - Game rules

---

_Document version: 1.0_
_Created: 2024-12-30_
