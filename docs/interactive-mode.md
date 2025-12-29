# Interactive Mode

A human-friendly terminal game with numbered menus and conversational prompts. Play May I? against AI opponents in your terminal.

## Quick Start

```bash
bun harness/play.ts --interactive
# or
bun harness/play.ts -i
```

## How It Works

Interactive mode provides a REPL-style experience:
- Numbered menu options for all actions
- Clear visual feedback after each action
- Auto-play for AI opponents
- Press Enter to continue between turns

## Game Flow

### 1. Welcome Screen

When you start, you'll see a welcome message and be prompted to begin:

```
══════════════════════════════════════════════════════════════════
                      Welcome to May I?
══════════════════════════════════════════════════════════════════

May I? is a rummy-style card game where you collect sets and runs
to meet your contract each round. First player to go out wins the round.
Lowest total score after 6 rounds wins the game!

Starting a new game of May I?
You're playing against Alice and Bob.

Press Enter to begin...
```

### 2. Game Display

Each turn shows the full game state:

```
══════════════════════════════════════════════════════════════════
                      MAY I? — Round 1 of 6
                              2 sets
══════════════════════════════════════════════════════════════════

PLAYERS
→ You: 10 cards ✓ DOWN
  Alice: 11 cards
  Bob: 11 cards

TABLE
  Your melds:
    [1] Set: 10♠ 10♠ 10♥
    [2] Set: Q♥ Q♣ Joker

DISCARD: 8♣ (4 in pile) | STOCK: 66 cards

──────────────────────────────────────────────────────────────────
```

### 3. Your Turn - Drawing

When it's your turn and you need to draw:

```
Your hand: 4♥ 3♣ 7♣ 5♥ A♣ 9♠ 2♦ 9♥ J♣ 7♠

It's your turn. What would you like to do?

  1. Draw from the stock pile
  2. Take the 8♣ from the discard
  ─────────────────────────────────
  3. Organize your hand

>
```

### 4. Your Turn - Actions

After drawing, you can lay down, lay off, swap jokers, or discard:

```
Your hand: 4♥ 3♣ 7♣ 5♥ A♣ 9♠ 2♦ 9♥ J♣ 7♠ K♦

What would you like to do?

  1. Lay down your contract
  2. Discard a card to end your turn
  ─────────────────────────────────
  3. Organize your hand

>
```

If you're already down:

```
What would you like to do?

  1. Lay off cards onto table melds
  2. Discard a card to end your turn
  ─────────────────────────────────
  3. Organize your hand

>
```

### 5. Laying Down

When laying down your contract, enter card positions from your hand:

```
You chose to lay down. Build your melds:

Your hand: 1:4♥ 2:3♣ 3:7♣ 4:5♥ 5:A♣ 6:9♠ 7:2♦ 8:9♥ 9:J♣ 10:7♠

Contract requires: 2 sets

Enter cards for your SET 1 (e.g., "1 2 3"):
> 1 4 8

Enter cards for your SET 2 (e.g., "1 2 3"):
> 3 9 10
```

### 6. Laying Off

When laying off cards to existing melds:

```
Your hand: 1:4♥ 2:3♣ 3:K♦

Lay off which card? (1-3) 3

You're laying off K♦. Which meld?

  [1] Your Set: 10♠ 10♠ 10♥
  [2] Your Set: Q♥ Q♣ Joker
  [3] Alice's Run: 3♠ 4♠ 5♠ 6♠ ← fits here!

> 3
```

The `← fits here!` indicator shows which melds your card can legally join.

### 7. May I Window

When another player draws from stock and you want the discard:

```
May I? (8♣ + penalty card)

  1. Yes, May I!
  2. No thanks

>
```

If you call May I and win, you receive the discard plus one penalty card from the stock.

### 8. Round End

When someone goes out:

```
🎉 Alice goes out!

──────────────────────────────────────────────────────────────────

ROUND 1 COMPLETE

  You: 45 points
  Alice: 0 points ⭐ (went out)
  Bob: 32 points

──────────────────────────────────────────────────────────────────

STANDINGS AFTER ROUND 1

  1. Alice — 0 points
  2. Bob — 32 points
  3. You — 45 points

Press Enter to continue to next round...
```

### 9. Game End

After all 6 rounds:

```
══════════════════════════════════════════════════════════════════

                      🏆 GAME OVER 🏆

                       FINAL STANDINGS

  🥇  Alice — 87 points
  🥈  Bob — 142 points
  🥉  You — 198 points

                Alice wins! Congratulations!

══════════════════════════════════════════════════════════════════

  1. Play again
  2. Quit

>
```

## AI Opponents

In interactive mode, you play as "You" against two AI opponents (Alice and Bob). The AI uses a simple strategy:
- Always draws from stock
- Never lays down (skips)
- Discards first card in hand

This keeps games moving but means AI opponents won't win rounds through skill.

## Tips

1. **Card positions are 1-indexed** - The first card in your hand is position 1
2. **Use spaces or commas** - When entering multiple cards, `1 2 3` and `1,2,3` both work
3. **Watch the "fits here" hints** - When laying off, the game shows which melds accept your card
4. **Press Enter to continue** - After AI turns and round transitions

## Differences from Command Mode

| Feature | Interactive Mode | Command Mode |
|---------|------------------|--------------|
| Input | Numbered menus | CLI commands |
| AI play | Automatic | Manual (all players) |
| State display | Auto-refresh | `status` command |
| Persistence | Same game-state.json | Same game-state.json |
| Best for | Human players | AI agents |

Both modes use the same underlying orchestrator and share the same game state files.
