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
| `cli/shared/cli.types.ts` | Type definitions for persisted state |
| `cli/shared/cli.persistence.ts` | Multi-game persistence (save/load/list) |
| `cli/harness/harness.state.ts` | State accessors |
| `cli/harness/harness.render.ts` | Display rendering (text and JSON) |
| `cli/harness/orchestrator.ts` | Game state management and command execution |

## Game Phases

The harness tracks which player needs to act and what actions are available:

| Phase | Description | Available Commands |
|-------|-------------|-------------------|
| `AWAITING_DRAW` | Current player must draw | `draw stock`, `draw discard` |
| `AWAITING_ACTION` | Player has drawn, can act | `laydown`, `layoff`, `swap`, `skip` |
| `AWAITING_DISCARD` | Player must discard | `discard <position>` |
| `MAY_I_WINDOW` | Waiting for May I responses | `mayi`, `pass` |
| `ROUND_END` | Round complete | `continue` |
| `GAME_END` | Game over | `new` |

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
# layoff <hand-position> <meld-number>
bun cli/play.ts abc123 layoff 3 1

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

When someone draws from stock, a May I window opens for the discarded card:

```bash
# Non-current player can call May I
bun cli/play.ts abc123 mayi

# Pass on claiming the card
bun cli/play.ts abc123 pass
```

Note: The current player's "veto" is choosing `draw discard` instead of `draw stock` at the start of their turn. Once they draw from stock, the May I window opens and they have already passed on the discard.

### Round/Game Transitions

```bash
# Continue to next round after round ends
bun cli/play.ts abc123 continue

# Start new game after game ends
bun cli/play.ts new
```

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
- `round`, `contract`, `phase`
- `awaitingPlayer` with hand details
- `players` array with card counts and scores
- `table` with melds
- `availableCommands`
- `mayIContext` (when in May I window)

## Action Log

The action log (`.data/<game-id>/game-log.jsonl`) records all game actions:

```
[12:35:20 PM] R1 T0: System GAME_STARTED — Players: Alice, Bob, Carol
[12:35:24 PM] R1 T1: Bob drew from stock — 2♥
[12:35:28 PM] R1 T1: Carol passed on May I — 2♦
[12:35:32 PM] R1 T1: Alice called May I — 2♦
[12:35:32 PM] R1 T1: Alice won May I — 2♦ + penalty card
```

## May I Resolution

When a player draws from stock:
1. A May I window opens for the top discard
2. Each non-current player (in turn order) can call "May I" or pass
3. If anyone called May I:
   - Highest priority claimant (closest to current player) wins
   - Winner receives the discard + 1 penalty card from stock
4. If no claims, the window closes and play continues

Note: The current player vetoes by drawing from discard at turn start, not during the May I window.

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
