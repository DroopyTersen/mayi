# Hydrate Agent Harness with Predefined Game State

## Problem Statement

When developing and testing gameplay features via the CLI agent harness, it's often necessary to validate behavior in very specific game scenarios. Currently, the only way to reach these scenarios is to:

1. Start a new game from round 1
2. Play through many turns (often with random chance)
3. Hope the desired conditions arise naturally

This is **slow, unreliable, and frustrating** for feature development.

### Example: Testing Wild Card Lay-off Position (specs/wild-layoff-position.spec.md)

To test whether a wild card can be laid off at the start vs end of a run, you need:
- A player who is already "down" (has laid down their contract)
- A run on the table that can be extended at both ends (e.g., 5♠ 6♠ 7♠ 8♠)
- A wild card (2 or Joker) in the player's hand
- It to be that player's turn, in the AWAITING_ACTION phase

Getting to this state naturally requires playing through multiple turns with luck involved.

---

## Solution: Use Existing Save File Format

**No new code needed.** The infrastructure already exists:

1. Games are persisted to `.data/<gameId>/game-state.json`
2. `GameEngine.fromPersistedSnapshot()` hydrates from these files
3. `bun cli/play.ts <gameId> status` loads any saved game

### Approach

Manually create (or have Claude create) a valid save file with the desired game state:

```bash
# 1. Create a game state file
mkdir -p .data/test-wild-layoff
# (create game-state.json with desired state)

# 2. Load and play from that state
bun cli/play.ts test-wild-layoff status
bun cli/play.ts test-wild-layoff draw stock
bun cli/play.ts test-wild-layoff layoff 1 1 start
```

---

## Save File Format

**File:** `.data/<gameId>/game-state.json`

```json
{
  "version": "3.0",
  "gameId": "<gameId>",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "engineSnapshot": { /* XState persisted snapshot */ }
}
```

### Engine Snapshot Structure

The `engineSnapshot` is an XState persisted snapshot with nested actor hierarchy:

```
engineSnapshot
├── status: "active"
├── value: "playing"
├── context: { gameId, players, currentRound, dealerIndex, ... }
└── children
    └── round
        └── snapshot
            ├── value: { active: "playing" }
            ├── context: { roundNumber, contract, players, stock, discard, table, ... }
            └── children
                └── turn
                    └── snapshot
                        ├── value: "awaitingDraw" | "awaitingAction" | "awaitingDiscard"
                        └── context: { playerId, hand, stock, discard, table, ... }
```

### Key Fields to Customize

| Level | Field | Purpose |
|-------|-------|---------|
| Game | `context.currentRound` | Round number (1-6) |
| Game | `context.players[].totalScore` | Cumulative scores |
| Round | `context.players[].hand` | Cards in each player's hand |
| Round | `context.players[].isDown` | Whether player has laid down |
| Round | `context.stock` | Cards in stock pile |
| Round | `context.discard` | Discard pile (top card first) |
| Round | `context.table` | Melds on the table |
| Round | `context.currentPlayerIndex` | Whose turn it is |
| Turn | `snapshot.value` | Turn phase: `awaitingDraw`, `awaitingAction`, `awaitingDiscard` |
| Turn | `context.hand` | Current player's hand (must match round) |
| Turn | `context.hasDrawn` | Whether player has drawn this turn |
| Turn | `context.isDown` | Current player's down status |
| Turn | `context.laidDownThisTurn` | Whether they laid down this turn |

### Card Format

```json
{
  "id": "card-42",
  "suit": "spades",     // "hearts" | "diamonds" | "clubs" | "spades" | null (for Joker)
  "rank": "K"           // "2"-"10" | "J" | "Q" | "K" | "A" | "Joker"
}
```

### Meld Format

```json
{
  "id": "meld-player-0-0",
  "type": "run",        // "run" | "set"
  "cards": [ /* Card[] */ ],
  "ownerId": "player-0"
}
```

---

## Example: Wild Lay-off Test State

Create `.data/wild-test/game-state.json`:

```json
{
  "version": "3.0",
  "gameId": "wild-test",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "engineSnapshot": {
    "status": "active",
    "value": "playing",
    "historyValue": {},
    "context": {
      "gameId": "",
      "players": [
        { "id": "player-0", "name": "Alice", "hand": [], "isDown": true, "totalScore": 0 },
        { "id": "player-1", "name": "Bob", "hand": [], "isDown": false, "totalScore": 0 },
        { "id": "player-2", "name": "Carol", "hand": [], "isDown": false, "totalScore": 0 }
      ],
      "currentRound": 1,
      "dealerIndex": 2,
      "roundHistory": [],
      "winners": [],
      "lastError": null
    },
    "children": {
      "round": {
        "snapshot": {
          "status": "active",
          "value": { "active": "playing" },
          "historyValue": {},
          "context": {
            "roundNumber": 1,
            "contract": { "roundNumber": 1, "sets": 2, "runs": 0 },
            "players": [
              {
                "id": "player-0",
                "name": "Alice",
                "hand": [
                  { "id": "card-wild", "suit": "clubs", "rank": "2" },
                  { "id": "card-3s", "suit": "spades", "rank": "3" }
                ],
                "isDown": true,
                "totalScore": 0
              },
              {
                "id": "player-1",
                "name": "Bob",
                "hand": [
                  { "id": "card-b1", "suit": "diamonds", "rank": "5" },
                  { "id": "card-b2", "suit": "diamonds", "rank": "6" }
                ],
                "isDown": false,
                "totalScore": 0
              },
              {
                "id": "player-2",
                "name": "Carol",
                "hand": [
                  { "id": "card-c1", "suit": "hearts", "rank": "K" },
                  { "id": "card-c2", "suit": "diamonds", "rank": "K" }
                ],
                "isDown": false,
                "totalScore": 0
              }
            ],
            "currentPlayerIndex": 0,
            "dealerIndex": 2,
            "stock": [
              { "id": "card-s1", "suit": "hearts", "rank": "10" },
              { "id": "card-s2", "suit": "hearts", "rank": "J" },
              { "id": "card-s3", "suit": "hearts", "rank": "Q" }
            ],
            "discard": [
              { "id": "card-d1", "suit": "clubs", "rank": "4" }
            ],
            "table": [
              {
                "id": "meld-player-0-0",
                "type": "set",
                "cards": [
                  { "id": "card-t1", "suit": "hearts", "rank": "Q" },
                  { "id": "card-t2", "suit": "diamonds", "rank": "Q" },
                  { "id": "card-t3", "suit": "clubs", "rank": "Q" }
                ],
                "ownerId": "player-0"
              },
              {
                "id": "meld-player-0-1",
                "type": "set",
                "cards": [
                  { "id": "card-t4", "suit": "hearts", "rank": "J" },
                  { "id": "card-t5", "suit": "diamonds", "rank": "J" },
                  { "id": "card-t6", "suit": "spades", "rank": "J" }
                ],
                "ownerId": "player-0"
              },
              {
                "id": "meld-player-0-2",
                "type": "run",
                "cards": [
                  { "id": "card-t7", "suit": "spades", "rank": "5" },
                  { "id": "card-t8", "suit": "spades", "rank": "6" },
                  { "id": "card-t9", "suit": "spades", "rank": "7" },
                  { "id": "card-t10", "suit": "spades", "rank": "8" }
                ],
                "ownerId": "player-0"
              }
            ],
            "winnerPlayerId": null,
            "turnNumber": 5,
            "lastDiscardedByPlayerId": "player-2",
            "predefinedState": null,
            "mayIResolution": null,
            "discardClaimed": false,
            "currentPlayerHasDrawnFromStock": false
          },
          "children": {
            "turn": {
              "snapshot": {
                "status": "active",
                "value": "awaitingDraw",
                "historyValue": {},
                "context": {
                  "playerId": "player-0",
                  "hand": [
                    { "id": "card-wild", "suit": "clubs", "rank": "2" },
                    { "id": "card-3s", "suit": "spades", "rank": "3" }
                  ],
                  "stock": [
                    { "id": "card-s1", "suit": "hearts", "rank": "10" },
                    { "id": "card-s2", "suit": "hearts", "rank": "J" },
                    { "id": "card-s3", "suit": "hearts", "rank": "Q" }
                  ],
                  "discard": [
                    { "id": "card-d1", "suit": "clubs", "rank": "4" }
                  ],
                  "hasDrawn": false,
                  "roundNumber": 1,
                  "isDown": true,
                  "laidDownThisTurn": false,
                  "table": [
                    {
                      "id": "meld-player-0-0",
                      "type": "set",
                      "cards": [
                        { "id": "card-t1", "suit": "hearts", "rank": "Q" },
                        { "id": "card-t2", "suit": "diamonds", "rank": "Q" },
                        { "id": "card-t3", "suit": "clubs", "rank": "Q" }
                      ],
                      "ownerId": "player-0"
                    },
                    {
                      "id": "meld-player-0-1",
                      "type": "set",
                      "cards": [
                        { "id": "card-t4", "suit": "hearts", "rank": "J" },
                        { "id": "card-t5", "suit": "diamonds", "rank": "J" },
                        { "id": "card-t6", "suit": "spades", "rank": "J" }
                      ],
                      "ownerId": "player-0"
                    },
                    {
                      "id": "meld-player-0-2",
                      "type": "run",
                      "cards": [
                        { "id": "card-t7", "suit": "spades", "rank": "5" },
                        { "id": "card-t8", "suit": "spades", "rank": "6" },
                        { "id": "card-t9", "suit": "spades", "rank": "7" },
                        { "id": "card-t10", "suit": "spades", "rank": "8" }
                      ],
                      "ownerId": "player-0"
                    }
                  ],
                  "lastError": null,
                  "playerOrder": ["player-0", "player-1", "player-2"],
                  "playerDownStatus": {
                    "player-0": true,
                    "player-1": false,
                    "player-2": false
                  },
                  "lastDiscardedByPlayerId": "player-2"
                },
                "children": {}
              },
              "src": "turnMachine",
              "syncSnapshot": false
            }
          }
        },
        "src": "roundMachine",
        "syncSnapshot": false
      }
    }
  }
}
```

### Usage

```bash
# View the state
bun cli/play.ts wild-test status

# Play through the scenario
bun cli/play.ts wild-test draw stock
bun cli/play.ts wild-test layoff 1 3 start   # Lay off 2♣ to run at START (becomes 4♠)
bun cli/play.ts wild-test layoff 1 3         # Lay off 3♠ to run (becomes 3♠ at start)
```

---

## Consistency Requirements

When crafting a state file, ensure consistency across all three levels:

1. **Round.context.players[i].hand** must match **Turn.context.hand** for the current player
2. **Round.context.stock** must match **Turn.context.stock**
3. **Round.context.discard** must match **Turn.context.discard**
4. **Round.context.table** must match **Turn.context.table**
5. **Round.context.players[i].isDown** must match **Turn.context.isDown** for current player
6. **Round.context.currentPlayerIndex** determines which player's turn it is
7. **Turn.context.playerDownStatus** must match each player's `isDown` status
8. **Card IDs must be unique** across all cards in the game

---

## Integration with Claude/AI Harness

The mayi-harness skill can be updated to instruct Claude how to:

1. Read an existing save file to understand the format
2. Modify the save file to create a desired scenario
3. Create a new save file from scratch for testing

### Example Prompt for Claude

> Create a game state file at `.data/test-mayi/game-state.json` where:
> - It's player-1's turn
> - Player-0 has already gone down with two sets
> - There's a King on the discard pile
> - Player-1 has two Kings in hand (can call May I if another player draws from stock)

Claude would generate the appropriate JSON file, and then the test can proceed:

```bash
bun cli/play.ts test-mayi status
bun cli/play.ts test-mayi draw stock    # Opens May I window
bun cli/play.ts test-mayi mayi player-1 # Player 1 calls May I
```

---

## Validation (Optional Enhancement)

Could add a CLI command to validate a hand-crafted state file:

```bash
bun cli/play.ts validate <gameId>
```

This would check:
- All required fields are present
- Card IDs are unique
- State is consistent across levels
- Melds are valid (correct set/run structure)

---

## Files to Update

### P0: Documentation Updates (Required)

#### 1. `.claude/skills/mayi-harness/SKILL.md`

Add a section teaching Claude how to create test states:

```markdown
## Creating Test Scenarios

You can create custom game states for testing by writing directly to the save file format.

### How to Create a Test State

1. **Copy the template**: Read an existing save file from `.data/<gameId>/game-state.json` to understand the structure
2. **Create your state directory**: `mkdir -p .data/my-test-scenario`
3. **Write the state file**: Create `.data/my-test-scenario/game-state.json` with your desired state
4. **Load and play**: `bun cli/play.ts my-test-scenario status`

### Key Fields to Customize

When crafting a test state, pay attention to:
- `turnPhase`: Set to `awaitingDraw`, `awaitingAction`, or `awaitingDiscard`
- `isDown`: Set to `true` for players who have laid down
- `table`: Add melds to test lay-off scenarios
- `hand`: Give specific cards to test specific situations

### Consistency Rules

Data must be consistent across all three levels (game → round → turn):
- The turn context's `hand`, `stock`, `discard`, `table` must match the round context
- `playerDownStatus` must match each player's `isDown` flag
- Card IDs must be unique across all cards

See `specs/hydrate-agent-harness.spec.md` for full format documentation.
```

#### 2. `docs/agent-game-harness.md`

Add a new section at the end:

```markdown
## Custom Test States

You can create games with specific card arrangements for testing edge cases.

### Creating a Test State

1. Examine an existing save file to understand the format:
   ```bash
   cat .data/<existing-game-id>/game-state.json | head -100
   ```

2. Create a new game directory:
   ```bash
   mkdir -p .data/my-test
   ```

3. Create `.data/my-test/game-state.json` with your desired state (see format below)

4. Load and play:
   ```bash
   bun cli/play.ts my-test status
   ```

### Save File Format

See `specs/hydrate-agent-harness.spec.md` for complete format documentation including:
- XState snapshot structure
- Card and meld formats
- Consistency requirements
- Example state for wild card testing
```

#### 3. `CLAUDE.md` (project root)

Add to the "Game CLI" section:

```markdown
## Testing with Custom States

For testing specific scenarios, you can create a game state file directly:

```bash
# Create test directory and state file
mkdir -p .data/my-test
# Write game-state.json with desired state (see specs/hydrate-agent-harness.spec.md)

# Load and play
bun cli/play.ts my-test status
```

This bypasses the random dealing and lets you test exact card configurations.
```

### P2: Optional Enhancements

| File | Change | Priority |
|------|--------|----------|
| `cli/play.ts` | Add `validate` command | P2 |
| `cli/shared/cli-scenario-validator.ts` | Validation logic (new file) | P2 |

---

## Summary

**No new engine code needed.** The approach is:

1. The save file format is already defined and working
2. Claude (or a developer) can manually create valid state files
3. Load them with existing `bun cli/play.ts <gameId> status`
4. Document the format and teach Claude how to use it

This leverages existing infrastructure with zero implementation risk.
