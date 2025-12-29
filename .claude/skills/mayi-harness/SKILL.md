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
bun cli/play.ts new              # Start new game
bun cli/play.ts status           # View current state
bun cli/play.ts draw stock       # Draw from stock
bun cli/play.ts draw discard     # Draw from discard (if not down)
bun cli/play.ts laydown "1,2,3" "4,5,6,7"  # Lay down melds
bun cli/play.ts skip             # Skip laying down
bun cli/play.ts discard 5        # Discard card at position
bun cli/play.ts layoff 3 1       # Lay off card to meld
bun cli/play.ts mayi             # Call May I
bun cli/play.ts pass             # Pass on May I
bun cli/play.ts continue         # Next round
bun cli/play.ts log              # View action log
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
