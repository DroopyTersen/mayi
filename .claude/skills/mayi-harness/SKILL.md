---
name: mayi-harness
description: Play the May I? card game via CLI harness. Use when playing May I?, testing the game, running the harness, simulating gameplay, or when the user asks to play cards.
allowed-tools: Read, Bash, Glob, Grep
---

# May I? Game Harness

You are playing the May I? card game through a CLI harness. This is an interactive, turn-based card game.

## Required Reading

Before playing, you MUST read these files to understand the rules and strategy:

1. **Game Rules**: `docs/house-rules.md` - Complete rules for May I? including contracts, wild cards, May I? claims, and Round 6 special rules.

2. **Strategy Guide**: `docs/game-strategy.md` - Strategic principles including hand planning, discard strategy, May I? decision framework, and round-specific notes.

3. **Harness Commands**: `docs/agent-game-harness.md` - CLI command reference for the harness.

## Quick Command Reference

```bash
# Game management
bun cli/play.ts new                      # Start new game (returns game ID)
bun cli/play.ts new --players 5          # Start game with 5 players (3-8)
bun cli/play.ts new --round 6            # Start game at specific round (1-6)
bun cli/play.ts list                     # List saved games

# All other commands require game ID (shown when game starts)
bun cli/play.ts abc123 status            # View current state
bun cli/play.ts abc123 draw stock        # Draw from stock
bun cli/play.ts abc123 draw discard      # Draw from discard (if not down)
bun cli/play.ts abc123 laydown "1,2,3" "4,5,6,7"  # Lay down melds
bun cli/play.ts abc123 skip              # Skip laying down
bun cli/play.ts abc123 discard 5         # Discard card at position
bun cli/play.ts abc123 layoff 3 1        # Lay off card to meld
bun cli/play.ts abc123 mayi              # Call May I
bun cli/play.ts abc123 pass              # Pass on May I
bun cli/play.ts abc123 continue          # Next round
bun cli/play.ts abc123 log               # View action log
```

## Gameplay Loop

1. Read `status` to see current game state
2. Identify which player is awaiting action and what phase they're in
3. Execute the appropriate command based on the phase
4. Repeat until game ends

## Key Rules to Remember

- **Draw first**: Every turn starts with a draw (stock or discard)
- **Going down is priority #1**: Getting caught with cards when someone goes out is catastrophic
- **Down players cannot May I**: Once you've laid down, you can only draw from stock
- **Round 6 is different**: Must use ALL cards to lay down, no discard to go out
- **Wild ratio**: When laying down, wilds cannot outnumber naturals (this doesn't apply to layoffs)

## Playing as Multiple Players

When testing, you control all players. Make reasonable decisions for each player based on their hand and the game state. Consider what a human player would do given the information visible to that player.

## Creating Test Scenarios

You can create custom game states for testing specific scenarios by writing directly to the save file format. This bypasses random dealing and lets you test exact card configurations.

### How to Create a Test State

1. **Read an existing save file** to understand the structure:
   ```bash
   cat .data/<existing-game-id>/game-state.json
   ```

2. **Create your state directory**:
   ```bash
   mkdir -p .data/my-test-scenario
   ```

3. **Write the state file**: Create `.data/my-test-scenario/game-state.json` with your desired state

4. **Load and play**:
   ```bash
   bun cli/play.ts my-test-scenario status
   ```

### Key Fields to Customize

The save file contains a nested XState snapshot (game → round → turn). Key fields:

| Level | Field | Purpose |
|-------|-------|---------|
| Turn | `snapshot.value` | Turn phase: `awaitingDraw`, `awaitingAction`, `awaitingDiscard` |
| Turn | `context.hand` | Current player's cards |
| Turn | `context.hasDrawn` | Whether player has drawn this turn |
| Turn | `context.isDown` | Current player's down status |
| Round | `context.players[].hand` | All players' hands |
| Round | `context.players[].isDown` | Which players have laid down |
| Round | `context.table` | Melds on the table |
| Round | `context.stock` | Stock pile cards |
| Round | `context.discard` | Discard pile (top card first) |

### Consistency Rules

Data must be consistent across all three levels:
- Turn context's `hand`, `stock`, `discard`, `table` must match the round context
- `playerDownStatus` must match each player's `isDown` flag
- Card IDs must be unique across all cards in the game

### Example: Testing Wild Lay-off

To test laying off a wild card to a run at start vs end:

```json
{
  "version": "3.0",
  "gameId": "wild-test",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "engineSnapshot": {
    "status": "active",
    "value": "playing",
    ...
  }
}
```

See `specs/hydrate-agent-harness.spec.md` for the complete example and full format documentation.
