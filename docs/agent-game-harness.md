# Agent Game Harness

A CLI harness that allows Claude (or any agent) to play May I? via command line. State persists to the filesystem between commands, enabling turn-by-turn gameplay.

> **Looking for human-friendly play?** See [Interactive Mode](interactive-mode.md) for numbered menus and visual feedback.

## Quick Start

```bash
# Start a new 3-player game (returns a 6-character game ID)
bun cli/play.ts new
# Output: Started new game: abc123

# Start with more players (3-8 supported)
bun cli/play.ts new --players 5

# Start at a specific round (useful for testing)
bun cli/play.ts new --round 6
# Output: Started new game: abc123 (starting at Round 6)

# List saved games
bun cli/play.ts list

# View current game state (use the game ID from above)
bun cli/play.ts abc123 status

# Take actions based on the current phase
bun cli/play.ts abc123 draw stock
bun cli/play.ts abc123 discard 3

# View action history
bun cli/play.ts abc123 log
```

## Architecture

The harness is designed for non-interactive CLI usage:
- Each command invocation is self-contained (load state, execute, save state, exit)
- Multiple concurrent games supported, each with a unique 6-character game ID
- State persists to `.data/<game-id>/game-state.json`
- Action log persists to `.data/<game-id>/game-log.jsonl`
- No stdin required after command starts

### Files

| File | Purpose |
|------|---------|
| `cli/play.ts` | CLI entry point with command handlers |
| `cli/shared/cli.types.ts` | Type definitions for CLI persistence and logs |
| `cli/shared/cli.persistence.ts` | Multi-game persistence (save/load/list) |
| `cli/shared/cli-game-adapter.ts` | CLI adapter (maps CLI inputs → engine) |
| `core/engine/game-engine.ts` | Thin wrapper around XState machines |
| `cli/harness/harness.state.ts` | State accessors |
| `cli/harness/harness.render.ts` | Display rendering (text and JSON) |

## Game Phases

The harness uses the engine snapshot fields `phase` and `turnPhase`:

### `phase` (EnginePhase)

| phase | Description | Common Commands |
|-------|-------------|-----------------|
| `ROUND_ACTIVE` | Normal turn flow (see `turnPhase`) | `draw`, `laydown`, `layoff`, `swap`, `skip`, `discard`, `mayi` |
| `RESOLVING_MAY_I` | May I resolution in progress | `allow`, `claim` |
| `ROUND_END` | Round scoring/transition (auto-advances) | `status` |
| `GAME_END` | Game over | `new`, `status` |

### `turnPhase` (only when `phase === "ROUND_ACTIVE"`)

| turnPhase | Description | Common Commands |
|----------|-------------|-----------------|
| `AWAITING_DRAW` | Current player must draw | `draw stock`, `draw discard` |
| `AWAITING_ACTION` | Player has drawn, can act | `laydown`, `layoff`, `swap`, `skip`, `discard` |
| `AWAITING_DISCARD` | Player must discard | `discard <position>` |

## Commands Reference

### Game Management

```bash
# Start new game with 3 players (default)
# Returns a 6-character game ID (e.g., "abc123")
bun cli/play.ts new

# Start with more players (3-8 supported)
# Player names: Haiku, GPT-5 Mini, Gemini Flash, Grok, Llama, Mistral, DeepSeek, Qwen
bun cli/play.ts new --players 5

# Start at a specific round (1-6) - useful for testing
# Previous rounds are fabricated with zero scores
bun cli/play.ts new --round 6

# Combine options
bun cli/play.ts new --players 4 --round 6

# List all saved games (excludes completed games)
bun cli/play.ts list

# View help
bun cli/play.ts help
```

All commands below require the game ID as the first argument.

### Status Commands

```bash
# Human-readable status
bun cli/play.ts abc123 status

# JSON status (for programmatic parsing)
bun cli/play.ts abc123 status --json

# View action log (all actions)
bun cli/play.ts abc123 log

# View last N actions
bun cli/play.ts abc123 log 10
```

### Draw Phase

```bash
# Draw from stock pile
bun cli/play.ts abc123 draw stock

# Draw from discard pile (if current player)
bun cli/play.ts abc123 draw discard
```

### Action Phase

After drawing, if not yet "down" (laid down contract):

```bash
# Lay down contract - positions are 1-indexed from your hand
# Round 1 requires 2 sets
bun cli/play.ts abc123 laydown "1,2,3" "4,5,6"

# Round 2 requires 1 set + 1 run
bun cli/play.ts abc123 laydown "1,2,3" "4,5,6,7"

# Skip laying down (proceed to discard)
bun cli/play.ts abc123 skip
```

After laying down (when "down"):

```bash
# Lay off a card onto an existing meld
# layoff <hand-position> <meld-number> [start|end]
bun cli/play.ts abc123 layoff 3 1

# For wild cards (2s and Jokers) on runs that can extend both ends,
# you can specify the position (start=prepend, end=append):
bun cli/play.ts abc123 layoff 2 1 start  # prepend to run
bun cli/play.ts abc123 layoff 2 1 end    # append to run (default if omitted)

# Swap a joker from a run (Phase 7 feature)
# swap <meld-number> <joker-position> <hand-position>
bun cli/play.ts abc123 swap 2 4 7

# Skip laying off
bun cli/play.ts abc123 skip
```

### Discard Phase

```bash
# Discard card at position (1-indexed)
bun cli/play.ts abc123 discard 5
```

### May I Window

There is no separate “May I window” phase. May I is resolved at the round level.

To initiate a May I claim for the exposed discard:

```bash
# Call May I as a specific player
bun cli/play.ts abc123 mayi player-2
```

If accepted, the engine enters `phase = RESOLVING_MAY_I` and prompts higher-priority players (in order). For each prompt, respond with:

```bash
bun cli/play.ts abc123 allow
bun cli/play.ts abc123 claim
```

### Round/Game Transitions

```bash
# Start new game after game ends
bun cli/play.ts new
```

Round transitions are automatic; there is no `continue` command.

## Status Output

### Human-Readable Format

```
══════════════════════════════════════════════════════════════════
                      MAY I? — Round 1 of 6
                              2 sets
══════════════════════════════════════════════════════════════════

PLAYERS
→ Alice: 10 cards ✓ DOWN
  Bob: 11 cards
  Carol: 11 cards

TABLE
  Alice's melds:
    [1] Set: 10♠ 10♠ 10♥
    [2] Set: Q♥ Q♣ Joker

DISCARD: 8♣ (4 in pile) | STOCK: 66 cards

──────────────────────────────────────────────────────────────────

It's Alice's turn — drawn, can act

Your hand (10 cards):
  1:4♥ 2:3♣ 3:7♣ 4:5♥ 5:A♣ 6:9♠ 7:2♦ 8:9♥ 9:J♣ 10:7♠

──────────────────────────────────────────────────────────────────

COMMANDS: layoff <card> <meld> | skip
```

### JSON Format

```bash
bun cli/play.ts abc123 status --json
```

Returns structured JSON with:
- `round`, `contract`, `phase`, `turnPhase`
- `awaitingPlayer` with hand details
- `players` array with card counts and scores
- `table` with melds
- `availableCommands`
- `mayIContext` (when `phase === "RESOLVING_MAY_I"`)

## Action Log

The action log (`.data/<game-id>/game-log.jsonl`) records all game actions:

```
[12:35:20 PM] R1 T1: System GAME_STARTED — Players: Alice, Bob, Carol
[12:35:24 PM] R1 T1: Bob drew from stock — 2♥
[12:35:28 PM] R1 T1: Carol called May I — 8♣
[12:35:30 PM] R1 T1: Bob allowed May I
[12:35:30 PM] R1 T1: Carol won May I — 8♣ (+ penalty)
```

## May I Resolution

The discard is exposed from the moment the previous player discards it until someone claims it.

When a player calls May I, the engine settles it immediately by prompting players ahead of the caller in priority order:
- Each prompted player chooses `allow` or `claim`
- If anyone claims, they win (blocking the caller)
- If everyone allows, the original caller wins

Penalty:
- Current player claiming via `claim` (before drawing from stock) takes the discard as their normal draw (no penalty)
- Any other winner receives the discard + 1 penalty card from stock

## Round Contracts

| Round | Contract |
|-------|----------|
| 1 | 2 sets |
| 2 | 1 set + 1 run |
| 3 | 2 runs |
| 4 | 3 sets |
| 5 | 2 sets + 1 run |
| 6 | 1 set + 2 runs (no discard to go out) |

## Important Notes for AI Agents

### Card Positions Shift During Layoffs

When you lay off a card, the remaining cards in your hand shift positions. **Always check the current hand positions after each layoff before laying off another card.**

Example:
```
Hand: 1:K♥ 2:10♣ 3:9♦ 4:7♠ 5:5♣
After: layoff 2 3  (lays off 10♣)
Hand: 1:K♥ 2:9♦ 3:7♠ 4:5♣  ← positions shifted!
```

### Run Commands One at a Time

Don't chain layoff commands with `&&` because:
1. Card positions change after each layoff
2. If the first command fails, subsequent commands may run with wrong phase

**Good:**
```bash
bun cli/play.ts abc123 layoff 3 1
# Check output, note new positions
bun cli/play.ts abc123 layoff 2 4
```

**Bad:**
```bash
bun cli/play.ts abc123 layoff 3 1 && bun cli/play.ts abc123 layoff 2 4  # Positions may be wrong!
```

### Multiple Layoffs Per Turn

You can lay off multiple cards in a single turn before calling `skip`. The harness stays in `AWAITING_ACTION` phase after each layoff until you explicitly `skip`.

### Phase Awareness

Always check the "COMMANDS:" line in the output to know what actions are valid. Common errors:
- Trying to `layoff` when in `AWAITING_DISCARD` phase (you already skipped)
- Trying to `draw` when already drawn (`AWAITING_ACTION` phase)
- Trying to `laydown` when already down (use `layoff` instead)

## Testing Strategy

Use the harness to test game scenarios:

1. **Basic flow**: Draw, skip, discard, advance turns
2. **May I claims**: Test priority resolution with multiple claimants
3. **Laying down**: Test contract validation for each round
4. **Layoffs**: Test adding cards to existing melds
5. **Joker swaps**: Test swapping jokers from runs
6. **Going out**: Test round completion and scoring
7. **Round 6**: Test no-discard-to-go-out rule

## Custom Test States

You can create games with specific card arrangements for testing edge cases. This bypasses random dealing and lets you set up exact scenarios.

### Creating a Test State

1. **Examine an existing save file** to understand the format:
   ```bash
   cat .data/<existing-game-id>/game-state.json | head -100
   ```

2. **Create a new game directory**:
   ```bash
   mkdir -p .data/my-test
   ```

3. **Create the state file** at `.data/my-test/game-state.json` with your desired state

4. **Load and play**:
   ```bash
   bun cli/play.ts my-test status
   bun cli/play.ts my-test draw stock
   # ... continue playing
   ```

### Save File Structure

The save file contains a nested XState snapshot:

```
game-state.json
├── version: "3.0"
├── gameId, createdAt, updatedAt
└── engineSnapshot
    ├── value: "playing"
    ├── context: { players, currentRound, ... }
    └── children.round.snapshot
        ├── context: { players with hands, stock, discard, table, ... }
        └── children.turn.snapshot
            ├── value: "awaitingDraw" | "awaitingAction" | "awaitingDiscard"
            └── context: { hand, stock, discard, table, hasDrawn, isDown, ... }
```

### Consistency Requirements

When crafting a state, data must be consistent across levels:
- Turn context's `hand`, `stock`, `discard`, `table` must match round context
- `playerDownStatus` must match each player's `isDown` flag
- Card IDs must be unique across all cards

### Card Format

```json
{
  "id": "card-42",
  "suit": "spades",
  "rank": "K"
}
```

- `suit`: `"hearts"` | `"diamonds"` | `"clubs"` | `"spades"` | `null` (for Joker)
- `rank`: `"2"`-`"10"` | `"J"` | `"Q"` | `"K"` | `"A"` | `"Joker"`

### Meld Format

```json
{
  "id": "meld-player-0-0",
  "type": "run",
  "cards": [/* Card[] */],
  "ownerId": "player-0"
}
```

### Complete Example: Wild Lay-off Test

This example sets up a scenario where player-0 is down, has a wild card (2♣) and a 3♠, and there's a run (5♠-8♠) on the table. Perfect for testing wild card lay-off position selection.

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
                "id": "player-0", "name": "Alice",
                "hand": [
                  { "id": "card-wild", "suit": "clubs", "rank": "2" },
                  { "id": "card-3s", "suit": "spades", "rank": "3" }
                ],
                "isDown": true, "totalScore": 0
              },
              {
                "id": "player-1", "name": "Bob",
                "hand": [
                  { "id": "card-b1", "suit": "diamonds", "rank": "5" },
                  { "id": "card-b2", "suit": "diamonds", "rank": "6" }
                ],
                "isDown": false, "totalScore": 0
              },
              {
                "id": "player-2", "name": "Carol",
                "hand": [
                  { "id": "card-c1", "suit": "hearts", "rank": "K" },
                  { "id": "card-c2", "suit": "diamonds", "rank": "K" }
                ],
                "isDown": false, "totalScore": 0
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
                "id": "meld-player-0-0", "type": "set",
                "cards": [
                  { "id": "card-t1", "suit": "hearts", "rank": "Q" },
                  { "id": "card-t2", "suit": "diamonds", "rank": "Q" },
                  { "id": "card-t3", "suit": "clubs", "rank": "Q" }
                ],
                "ownerId": "player-0"
              },
              {
                "id": "meld-player-0-1", "type": "set",
                "cards": [
                  { "id": "card-t4", "suit": "hearts", "rank": "J" },
                  { "id": "card-t5", "suit": "diamonds", "rank": "J" },
                  { "id": "card-t6", "suit": "spades", "rank": "J" }
                ],
                "ownerId": "player-0"
              },
              {
                "id": "meld-player-0-2", "type": "run",
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
                      "id": "meld-player-0-0", "type": "set",
                      "cards": [
                        { "id": "card-t1", "suit": "hearts", "rank": "Q" },
                        { "id": "card-t2", "suit": "diamonds", "rank": "Q" },
                        { "id": "card-t3", "suit": "clubs", "rank": "Q" }
                      ],
                      "ownerId": "player-0"
                    },
                    {
                      "id": "meld-player-0-1", "type": "set",
                      "cards": [
                        { "id": "card-t4", "suit": "hearts", "rank": "J" },
                        { "id": "card-t5", "suit": "diamonds", "rank": "J" },
                        { "id": "card-t6", "suit": "spades", "rank": "J" }
                      ],
                      "ownerId": "player-0"
                    },
                    {
                      "id": "meld-player-0-2", "type": "run",
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

**Usage:**
```bash
mkdir -p .data/wild-test
# Save the JSON above to .data/wild-test/game-state.json

bun cli/play.ts wild-test status
bun cli/play.ts wild-test draw stock
bun cli/play.ts wild-test layoff 1 3 start   # Lay off 2♣ at START (becomes 4♠)
bun cli/play.ts wild-test layoff 1 3         # Lay off 3♠ (becomes 3♠)
```
