# May I? — CLI UX Design

This document defines the user experience for the terminal-based client.

---

## Design Principles

1. **Conversation-style output** — reads like a narrator describing the game, not a data dump
1. **Numbered menus** — clear, unambiguous choices that work for humans and AI agents
1. **Card IDs only when needed** — show position numbers only during card selection
1. **Unicode suits** — ♥♦♣♠ for readability
1. **Compressed AI turns** — single-line summaries keep the game moving
1. **Dealt order preserved** — no auto-sorting; player organizes manually if desired

---

## Card Display Conventions

| Context          | Format      | Example                                 |
| ---------------- | ----------- | --------------------------------------- |
| Normal hand view | Cards only  | `3♥ 5♦ 6♦ 7♦ 8♦ 9♣ Joker`               |
| Card selection   | Numbered    | `1:3♥ 2:5♦ 3:6♦ 4:7♦ 5:8♦ 6:9♣ 7:Joker` |
| Melds on table   | Cards only  | `Set: 9♣ 9♥ 9♠`                         |
| Discard pile top | Single card | `DISCARD: K♣`                           |

**Card notation:**

- Number cards: `3♥`, `10♦`
- Face cards: `J♠`, `Q♣`, `K♥`, `A♦`
- Wild 2s: `2♣`, `2♦`, `2♥`, `2♠`
- Jokers: `Joker`

---

## Screen Layout

### Standard Game View

```
═══════════════════════════════════════════════════════════════
                    MAY I? - Round 2 of 6
              Contract: 1 Set + 1 Run to lay down
═══════════════════════════════════════════════════════════════

PLAYERS
  → You: 6 cards ✓ DOWN
    Alice: 8 cards ✓ DOWN
    Bob: 11 cards
    Carol: 7 cards ✓ DOWN

TABLE
  ┌─────────────────────────────────────────────────────────┐
  │ Your melds:                                             │
  │   [1] Set: 9♣ 9♥ 9♠                                     │
  │   [2] Run: 5♦ 6♦ 7♦ 8♦                                  │
  │                                                         │
  │ Alice's melds:                                          │
  │   [3] Set: K♥ K♦ K♣ Joker                               │
  │   [4] Run: 10♠ J♠ Q♠ K♠                                 │
  │                                                         │
  │ Carol's melds:                                          │
  │   [5] Set: 3♣ 3♦ 3♠                                     │
  │   [6] Run: 7♥ 8♥ 9♥ 10♥ J♥                              │
  └─────────────────────────────────────────────────────────┘

DISCARD: 4♦ (12 in pile) | STOCK: 22 cards

───────────────────────────────────────────────────────────────

Your hand: 3♥ 9♦ Q♥ 4♦ 2♣ Joker

What would you like to do?

  1. Lay off cards onto table melds
  2. Discard a card to end your turn
  ─────────────────────────────────
  3. Organize your hand

>
```

### Early Game (No Melds Yet)

```
═══════════════════════════════════════════════════════════════
                    MAY I? - Round 1 of 6
                Contract: 2 Sets to lay down
═══════════════════════════════════════════════════════════════

PLAYERS
  → You: 12 cards
    Alice: 11 cards
    Bob: 11 cards
    Carol: 11 cards

TABLE
  No melds yet.

DISCARD: K♣ (1 in pile) | STOCK: 59 cards

───────────────────────────────────────────────────────────────

Your hand: 3♥ 5♦ 6♦ 7♦ 8♦ 9♣ 9♥ 9♠ J♠ Q♠ 2♣ Joker

It's your turn. What would you like to do?

  1. Draw from the stock pile
  2. Take the K♣ from the discard
  ─────────────────────────────────
  3. Organize your hand

>
```

---

## Turn Flows

### Drawing

```
It's your turn. What would you like to do?

  1. Draw from the stock pile
  2. Take the K♣ from the discard
  ─────────────────────────────────
  3. Organize your hand

> 1

You drew the 7♥ from the stock.
```

### Discarding (Card Selection Mode)

```
What would you like to do?

  1. Lay off cards onto table melds
  2. Discard a card to end your turn
  ─────────────────────────────────
  3. Organize your hand

> 2

Your hand: 1:3♥ 2:9♦ 3:Q♥ 4:4♦ 5:2♣ 6:Joker

Discard which card? (1-6)
> 3

You discarded Q♥.
```

### Laying Down Contract

```
What would you like to do?

  1. Lay down your contract
  2. Discard a card (you can't lay off until next turn)
  ─────────────────────────────────
  3. Organize your hand

> 1

You chose to lay down. Build your melds:

Your hand: 1:3♥ 2:5♦ 3:6♦ 4:7♦ 5:8♦ 6:9♣ 7:9♥ 8:9♠ 9:J♠ 10:Q♠ 11:2♣ 12:Joker

Contract requires: 1 set, 1 run

Enter cards for your SET (e.g., "6 7 8"):
> 6 7 8

  Set: 9♣ 9♥ 9♠ ✓

Enter cards for your RUN (e.g., "2 3 4 5"):
> 2 3 4 5

  Run: 5♦ 6♦ 7♦ 8♦ ✓

Laying down:
  • Set: 9♣ 9♥ 9♠
  • Run: 5♦ 6♦ 7♦ 8♦

  1. Confirm
  2. Start over

> 1

You laid down your contract!

Your hand: 3♥ J♠ Q♠ 2♣ Joker

What would you like to do?

  1. Discard a card to end your turn
  ─────────────────────────────────
  2. Organize your hand

>
```

### Laying Off

```
What would you like to do?

  1. Lay off cards onto table melds
  2. Discard a card to end your turn
  ─────────────────────────────────
  3. Organize your hand

> 1

Your hand: 1:3♥ 2:9♦ 3:Q♥ 4:4♦ 5:2♣ 6:Joker

Lay off which card? (1-6)
> 2

You're laying off 9♦. Which meld?

  [1] Your Set: 9♣ 9♥ 9♠ ← fits here!
  [2] Your Run: 5♦ 6♦ 7♦ 8♦ ← fits here!
  [3] Alice's Set: K♥ K♦ K♣ Joker
  [4] Alice's Run: 10♠ J♠ Q♠ K♠

> 2

Added 9♦ to your run. It's now: 5♦ 6♦ 7♦ 8♦ 9♦

Your hand: 3♥ Q♥ 4♦ 2♣ Joker

What would you like to do?

  1. Lay off more cards
  2. Discard a card to end your turn
  ─────────────────────────────────
  3. Organize your hand

>
```

### Joker Swapping (Before Laying Down)

```
What would you like to do?

  1. Lay down your contract
  2. Swap a Joker from a run on the table
  3. Discard a card (you can't lay off until after laying down)
  ─────────────────────────────────
  4. Organize your hand

> 2

Your hand: 1:3♥ 2:7♠ 3:9♦ 4:Q♥ 5:2♣ 6:Joker

Which card will replace the Joker? (1-6)
> 2

Runs with Jokers:
  [4] Alice's Run: 6♠ Joker 8♠ 9♠ (Joker is acting as 7♠)

Which run?
> 4

Swapped! You gave 7♠ and took the Joker.

Your hand: 3♥ 9♦ Q♥ 2♣ Joker Joker
```

---

## Hand Organization

Accessible from any menu as a numbered option. Does not consume turn actions.

### Organization Submenu

```
Your hand: 3♥ 9♦ Q♥ 4♦ 2♣ Joker

Organize your hand:

  1. Sort by rank (A K Q J 10 9 ... 3, wilds at end)
  2. Sort by suit (♠ ♥ ♦ ♣, wilds at end)
  3. Move a card
  4. Done organizing

>
```

### Sort by Rank

```
> 1

Your hand: Q♥ 9♦ 4♦ 3♥ 2♣ Joker

  1. Sort by rank
  2. Sort by suit
  3. Move a card
  4. Done organizing

>
```

### Sort by Suit

```
> 2

Your hand: Q♥ 3♥ 9♦ 4♦ 2♣ Joker

  1. Sort by rank
  2. Sort by suit
  3. Move a card
  4. Done organizing

>
```

### Move a Card

```
> 3

Your hand: 1:Q♥ 2:3♥ 3:9♦ 4:4♦ 5:2♣ 6:Joker

Move which card? (1-6)
> 5

Move 2♣ to which position? (1-6)
> 1

Your hand: 2♣ Q♥ 3♥ 9♦ 4♦ Joker

  1. Sort by rank
  2. Sort by suit
  3. Move a card
  4. Done organizing

> 4

───────────────────────────────────────────────────────────────

Your hand: 2♣ Q♥ 3♥ 9♦ 4♦ Joker

What would you like to do?
...
```

---

## May I? Flow

### Next Player’s Choice

```
───────────────────────────────────────────────────────────────

Alice discarded Q♥.

Bob, it's your turn. Do you want the Q♥?

  1. Yes, take it
  2. No, draw from the stock instead

>
```

### May I Window Opens

```
> 2

Bob passed on the Q♥.

Carol, May I? (Q♥ + penalty card)

  1. Yes, May I!
  2. No thanks

> 1

Carol calls "May I!" and takes the Q♥.
Carol draws a penalty card from the stock.
Carol now has 8 cards.

Bob, it's still your turn.

You drew the 3♣ from the stock.
```

### Multiple May I Candidates

```
Bob passed on the Q♥.

Carol, May I? (Q♥ + penalty card)

  1. Yes, May I!
  2. No thanks

> 2

You, May I? (Q♥ + penalty card)

  1. Yes, May I!
  2. No thanks

> 2

No one wanted the Q♥.

Bob, it's your turn.

You drew the 6♠ from the stock.
```

---

## AI Turn Summaries

AI turns are compressed to single lines to keep the game moving:

```
───────────────────────────────────────────────────────────────

Alice's turn: Drew from stock. Discarded 7♣.

Bob, do you want the 7♣?
  1. Yes, take it
  2. No, draw from stock
> 2

Carol, May I? (7♣ + penalty card)
  1. Yes, May I!
  2. No thanks
> 2

Bob's turn: Drew from stock. Discarded 2♥.
```

### AI Laying Down

```
Alice's turn: Drew from stock. Laid down contract:
  • Set: K♥ K♦ K♣
  • Set: 5♠ 5♦ 5♣
Discarded J♣.
```

### AI Laying Off

```
Carol's turn: Drew from discard (9♦). Laid off 9♠ → meld [1]. Discarded 4♣.
```

### AI May I

```
Alice discarded Q♠.

Bob passed on the Q♠.
Carol calls "May I!" — takes Q♠ + penalty card (now 9 cards).

Bob's turn: Drew from stock. Discarded 3♦.
```

---

## Going Out

### Rounds 1-5 (Discard Last Card)

```
Your hand: 1:4♣

What would you like to do?

  1. Discard a card to end your turn
  ─────────────────────────────────
  2. Organize your hand

> 1

Your hand: 1:4♣

Discard which card? (1-1)
> 1

You discarded 4♣.

🎉 You go out!
```

### Round 6 (Must Play All Cards)

```
═══════════════════════════════════════════════════════════════
                    MAY I? - Round 6 of 6
            Contract: 1 Set + 2 Runs to lay down
             ⚠️  No discard to go out this round!
═══════════════════════════════════════════════════════════════

...

Your hand: 4♠ 4♣

What would you like to do?

  1. Lay off cards onto table melds
  ─────────────────────────────────
  2. Organize your hand

(You must play all cards to go out — no discarding!)

> 1

Your hand: 1:4♠ 2:4♣

Lay off which card? (1-2)
> 1

Added 4♠ to meld [5]. Set is now: 4♣ 4♦ 4♠

Your hand: 4♣

  1. Lay off more cards
  ─────────────────────────────────
  2. Organize your hand

> 1

Your hand: 1:4♣

Lay off which card? (1-1)
> 1

Added 4♣ to meld [5]. Set is now: 4♣ 4♦ 4♠ 4♣

Your hand is empty!

🎉 You go out!
```

---

## Round End / Scoring

```
🎉 Carol goes out!

───────────────────────────────────────────────────────────────

ROUND 2 COMPLETE

  Carol: 0 points ⭐ (went out)
  You: 47 points (3♥ 4♦ Q♥ 2♣ Joker)
  Alice: 23 points (5♣ 8♥ K♠)
  Bob: 86 points (A♦ A♠ 7♣ 9♦ 10♥ J♣ Joker)

───────────────────────────────────────────────────────────────

STANDINGS AFTER ROUND 2

  1. Carol — 12 points
  2. Alice — 45 points
  3. You — 59 points
  4. Bob — 131 points

───────────────────────────────────────────────────────────────

Press Enter to start Round 3...
```

---

## Game End

```
🎉 Alice goes out!

───────────────────────────────────────────────────────────────

ROUND 6 COMPLETE (FINAL ROUND)

  Alice: 0 points ⭐ (went out)
  You: 15 points (A♣)
  Carol: 52 points (2♦ Joker)
  Bob: 34 points (K♥ Q♦ J♣ 4♠)

═══════════════════════════════════════════════════════════════

                        🏆 GAME OVER 🏆

                    FINAL STANDINGS

  🥇  Carol — 89 points
  🥈  Alice — 112 points
  🥉  You — 143 points
  4.  Bob — 267 points

           Carol wins! Congratulations!

═══════════════════════════════════════════════════════════════

  1. Play again
  2. Quit

>
```

---

## Error Handling

### Invalid Card Selection

```
Your hand: 1:3♥ 2:9♦ 3:Q♥ 4:4♦ 5:2♣ 6:Joker

Discard which card? (1-6)
> 8

Invalid choice. Please enter a number 1-6.
>
```

### Invalid Meld

```
Enter cards for your SET (e.g., "6 7 8"):
> 1 2 3

  Set: 3♥ 5♦ 6♦ ✗ Invalid — cards must be the same rank.

Enter cards for your SET (e.g., "6 7 8"):
>
```

### Can’t Lay Off That Card

```
You're laying off 3♥. Which meld?

  [1] Your Set: 9♣ 9♥ 9♠
  [2] Your Run: 5♦ 6♦ 7♦ 8♦
  [3] Alice's Set: K♥ K♦ K♣

> 1

3♥ doesn't fit in that meld. Choose another or press 0 to cancel.
>
```

### Wilds Outnumber Naturals

```
Enter cards for your SET (e.g., "6 7 8"):
> 6 11 12

  Set: 9♣ 2♣ Joker ✗ Invalid — wilds can't outnumber natural cards.

Enter cards for your SET (e.g., "6 7 8"):
>
```

---

## Implementation Notes

### State Machine Mapping

| CLI State                           | TurnMachine State               |
| ----------------------------------- | ------------------------------- |
| “Draw from stock or discard” menu   | `awaitingDraw`                  |
| “Lay down / lay off / discard” menu | `drawn`                         |
| Card selection for discard          | `awaitingDiscard` (input phase) |
| After discarding                    | `turnComplete` or `wentOut`     |
| May I prompts                       | `MayIWindowMachine`             |
| Organize hand submenu               | Any state (global event)        |

### Hand Organization Command

`REORDER_HAND` is a global event on `TurnMachine`:

```typescript
on: {
  REORDER_HAND: {
    actions: 'reorderHand',
    // No target = stays in current state
  },
},
```

This allows organizing at any point without consuming turn actions.

---

_Document version: 0.1_
