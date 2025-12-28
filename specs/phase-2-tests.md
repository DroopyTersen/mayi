## Phase 2: Minimal Playable Turn — Comprehensive Test Descriptions

From the Implementation Plan, Phase 2 covers:

- `GameState`, `Player`, `TurnState` types
- Stripped-down TurnMachine: `awaitingDraw` → `awaitingDiscard` → `turnComplete`
- Hand reordering (free action, any state)
- Basic CLI rendering

### `core/engine/types.test.ts`

```
describe('GameState structure', () => {
  - gameId is a non-empty string
  - currentRound is 1-6
  - players is an array of Player objects
  - currentPlayerIndex is valid index into players array
  - dealerIndex is valid index into players array
  - stock is an array of Cards
  - discard is an array of Cards (top card is index 0)
  - table is an array of Melds (empty initially)
})

describe('Player structure', () => {
  - id is a non-empty string
  - name is a non-empty string
  - hand is an array of Cards
  - isDown is a boolean (false initially)
  - totalScore is a number (0 initially)
})

describe('TurnState structure', () => {
  - hasDrawn is a boolean
  - hasLaidDown is a boolean (for later phases)
  - laidDownThisTurn is a boolean (for later phases)
})

describe('createInitialGameState', () => {
  - creates game with 3-8 players
  - sets currentRound to 1
  - sets dealerIndex to 0 (or random)
  - sets currentPlayerIndex to 1 (left of dealer)
  - initializes all players with empty hands, isDown: false, totalScore: 0
  - stock and discard are empty (deal happens separately)
  - table is empty array
})
```

### `core/engine/turnMachine.test.ts`

```
describe('TurnMachine - initial state', () => {
  - starts in 'awaitingDraw' state
  - hasDrawn is false
  - player hand matches input
  - stock matches input
  - discard matches input
})

describe('TurnMachine - drawing from stock', () => {
  describe('DRAW_FROM_STOCK command', () => {
    - transitions from 'awaitingDraw' to 'awaitingDiscard'
    - sets hasDrawn to true
    - adds top card of stock to player's hand
    - removes top card from stock
    - hand size increases by 1
    - stock size decreases by 1
    - discard pile is unchanged
  })

  describe('when stock is empty', () => {
    - what happens? (Phase 2 might defer this - note for later)
  })
})

describe('TurnMachine - drawing from discard', () => {
  describe('DRAW_FROM_DISCARD command', () => {
    - transitions from 'awaitingDraw' to 'awaitingDiscard'
    - sets hasDrawn to true
    - adds top card of discard to player's hand
    - removes top card from discard
    - hand size increases by 1
    - discard size decreases by 1
    - stock is unchanged
  })

  describe('when discard is empty', () => {
    - command is rejected / not available
    - state remains 'awaitingDraw'
    - no changes to hand, stock, or discard
  })
})

describe('TurnMachine - discarding', () => {
  describe('DISCARD command after drawing', () => {
    - transitions from 'awaitingDiscard' to 'turnComplete'
    - removes specified card from player's hand
    - adds that card to top of discard pile
    - hand size decreases by 1
    - discard size increases by 1
    - stock is unchanged
  })

  describe('DISCARD command validation', () => {
    - rejects if cardId is not in player's hand
    - rejects if player hasn't drawn yet (state is 'awaitingDraw')
    - state remains unchanged on rejection
  })

  describe('discarding specific cards', () => {
    - can discard any card in hand (first, middle, last)
    - can discard the card just drawn
    - can discard a wild card (2 or Joker)
    - correct card is removed (verify by id, not just count)
  })
})

describe('TurnMachine - invalid commands', () => {
  describe('in awaitingDraw state', () => {
    - DISCARD command is rejected
    - remains in awaitingDraw state
  })

  describe('in awaitingDiscard state', () => {
    - DRAW_FROM_STOCK command is rejected
    - DRAW_FROM_DISCARD command is rejected
    - remains in awaitingDiscard state
  })

  describe('in turnComplete state', () => {
    - all commands are rejected (final state)
    - or: state machine has ended
  })
})

describe('TurnMachine - turn output', () => {
  - turnComplete state outputs final hand
  - turnComplete state outputs final stock
  - turnComplete state outputs final discard
  - turnComplete state outputs playerId
  - output can be used to update game state
})
```

### `core/engine/handReordering.test.ts`

```
describe('REORDER_HAND command', () => {
  describe('basic reordering', () => {
    - accepts new order of card ids
    - hand contains same cards in new order
    - hand size is unchanged
    - all original cards still present
    - no duplicate cards introduced
  })

  describe('valid in any turn state', () => {
    - works in 'awaitingDraw' state
    - works in 'awaitingDiscard' state
    - does not change the current state
    - does not affect hasDrawn flag
    - is a "free action" - doesn't consume turn
  })

  describe('sort by rank', () => {
    - orders cards A, K, Q, J, 10, 9, 8, 7, 6, 5, 4, 3
    - wilds (2s, Jokers) go at end
    - within same rank, any order is fine (or by suit)
  })

  describe('sort by suit', () => {
    - groups cards by suit (♠ ♥ ♦ ♣ or similar)
    - within suit, ordered by rank
    - wilds go at end
  })

  describe('move single card', () => {
    - can move card from position A to position B
    - other cards shift appropriately
    - (3♥ 5♦ 9♣) move pos 3 to pos 1 → (9♣ 3♥ 5♦)
  })

  describe('validation', () => {
    - rejects if cardIds don't match current hand exactly
    - rejects if cardIds has wrong count
    - rejects if cardIds contains id not in hand
    - rejects if cardIds is missing a card from hand
    - rejects if cardIds has duplicates
    - on rejection, hand remains unchanged
  })

  describe('edge cases', () => {
    - reordering hand of 1 card (no-op, but valid)
    - reordering to same order (no-op, but valid)
    - reordering empty hand (edge case - probably invalid game state)
  })
})
```

### `core/engine/gameLoop.test.ts` (manual turn orchestration for Phase 2)

```
describe('basic turn loop', () => {
  describe('turn advancement', () => {
    - after turn completes, currentPlayerIndex advances
    - advances clockwise (index + 1, wrapping)
    - with 4 players: 0 → 1 → 2 → 3 → 0
    - dealer index doesn't change during round
  })

  describe('state transfer between turns', () => {
    - next player sees updated stock (card removed if drawn from stock)
    - next player sees updated discard (new card on top)
    - next player sees previous player's hand size changed
    - game state is consistent across turns
  })

  describe('initial game setup', () => {
    - after deal, each player has 11 cards
    - stock has remaining cards
    - discard has 1 card (flipped from stock)
    - first player is left of dealer (dealerIndex + 1)
  })
})

describe('multiple consecutive turns', () => {
  - player 1 draws and discards, then player 2's turn starts
  - player 2 draws and discards, then player 3's turn starts
  - full rotation: all players take one turn, back to player 1
  - stock depletes correctly over multiple draws
  - discard grows correctly over multiple discards
})
```

### `cli/renderer.test.ts` (if testing CLI output)

```
describe('renderCard', () => {
  - renders 9♥ as "9♥"
  - renders 10♦ as "10♦"
  - renders J♠ as "J♠"
  - renders Q♣ as "Q♣"
  - renders K♥ as "K♥"
  - renders A♦ as "A♦"
  - renders 2♠ as "2♠"
  - renders Joker as "Joker"
  - uses unicode suit symbols (♥♦♣♠)
})

describe('renderHand', () => {
  - displays cards in order
  - separates cards with spaces
  - example: "3♥ 5♦ 9♣ J♠ Joker"
})

describe('renderNumberedHand (for selection)', () => {
  - displays position numbers with cards
  - example: "1:3♥ 2:5♦ 3:9♣ 4:J♠ 5:Joker"
  - positions are 1-indexed for human readability
})

describe('renderGameState', () => {
  - shows current round
  - shows all players with card counts
  - shows current player indicator (→ or similar)
  - shows discard pile top card
  - shows stock pile count
  - shows current player's hand
})
```

### `cli/input.test.ts` (if testing CLI input parsing)

```
describe('parseDrawCommand', () => {
  - 'd' or '1' → DRAW_FROM_STOCK
  - 't' or '2' → DRAW_FROM_DISCARD
  - invalid input returns error/null
})

describe('parseDiscardCommand', () => {
  - 'x 3' or '3' → DISCARD with card at position 3
  - position is 1-indexed
  - validates position is within hand size
  - invalid input returns error/null
})

describe('parseReorderCommand', () => {
  - 'sort rank' → sort by rank action
  - 'sort suit' → sort by suit action
  - 'move 5 1' → move card from pos 5 to pos 1
  - validates positions are within hand size
})
```

---

**Notes for Phase 2:**

1. **No May I yet** — turns are simple: draw → discard. The May I window comes in Phase 6.

2. **No laying down yet** — that's Phase 3. The `awaitingDiscard` state is just "you drew, now discard."

3. **No going out yet** — that's Phase 4. Turns always end with a discard.

4. **Stock depletion** — The rules say to flip the discard pile. Should we handle this in Phase 2 or defer? I'd suggest deferring complex stock management to later.

5. **Hand reordering** — Per your Phase 2 addendum, this is a global event that works in any state. Key insight: it doesn't consume your turn action.

Ready for Phase 3 (Contracts + Laying Down)?
