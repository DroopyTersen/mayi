Let me re-read the rules carefully to make sure I've got everything right.Good, I've got a clear picture now. Let me write out comprehensive Phase 1 tests with corrections and additions:

---

## Phase 1: Card Foundation — Comprehensive Test Descriptions

### `core/card/deck.test.ts`

```
describe('createDeck', () => {
  describe('for 3-5 players (2 decks + 4 jokers)', () => {
    - creates exactly 108 cards total (52 × 2 + 4)
    - contains 8 cards of each rank 3-10 (2 per suit × 2 decks)
    - contains 8 cards of each face rank J, Q, K, A (2 per suit × 2 decks)
    - contains 8 twos (2 per suit × 2 decks) — these are wild but still cards
    - contains exactly 4 Jokers
    - Jokers have suit: null and rank: 'Joker'
    - every card has a unique id (essential for multi-deck identification)
    - card ids encode enough info to distinguish duplicates (e.g., "9-hearts-0" vs "9-hearts-1")
  })

  describe('for 6-8 players (3 decks + 6 jokers)', () => {
    - creates exactly 162 cards total (52 × 3 + 6)
    - contains 12 cards of each non-wild rank (3 per suit × 3 decks)
    - contains exactly 6 Jokers
    - every card has a unique id
  })

  describe('card structure', () => {
    - every card has id, suit, and rank properties
    - suits are exactly: 'hearts', 'diamonds', 'clubs', 'spades' (or null for Joker)
    - ranks are exactly: 'A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2', 'Joker'
  })
})

describe('shuffle', () => {
  - returns array of same length as input
  - contains all original cards (by id)
  - contains no duplicate cards
  - does not mutate the original array
  - produces different order than input (run 10x, at least 9 should differ)
  - different calls produce different orders (randomness check)
})

describe('deal', () => {
  - deals exactly 11 cards to each player
  - with 4 players, removes 44 cards from deck (11 × 4)
  - with 8 players, removes 88 cards from deck (11 × 8)
  - returns remaining cards as stock pile
  - stock has correct count: deckSize - (11 × playerCount)
  - does not mutate original deck array
  - each player's hand contains unique cards (no duplicates within hand)
  - no card appears in multiple players' hands
  - all dealt cards came from the original deck
})
```

### `core/card/utils.test.ts`

```
describe('isWild', () => {
  describe('wild cards', () => {
    - returns true for 2♥
    - returns true for 2♦
    - returns true for 2♣
    - returns true for 2♠
    - returns true for Joker
  })

  describe('natural cards', () => {
    - returns false for Ace (any suit)
    - returns false for King (any suit)
    - returns false for Queen (any suit)
    - returns false for Jack (any suit)
    - returns false for 10 through 3 (any suit)
  })
})

describe('isNatural', () => {
  - returns true for all non-wild cards (A, K, Q, J, 10-3)
  - returns false for 2s
  - returns false for Jokers
  - isNatural(card) === !isWild(card) for any card
})

describe('getPointValue', () => {
  describe('number cards', () => {
    - returns 3 for 3♥
    - returns 4 for 4♦
    - returns 5 for 5♣
    - returns 6 for 6♠
    - returns 7 for 7♥
    - returns 8 for 8♦
    - returns 9 for 9♣
    - returns 10 for 10♠
  })

  describe('face cards', () => {
    - returns 10 for Jack (any suit)
    - returns 10 for Queen (any suit)
    - returns 10 for King (any suit)
  })

  describe('special cards', () => {
    - returns 15 for Ace (any suit)
    - returns 2 for 2 (any suit) — wild but low point value
    - returns 50 for Joker — high risk/reward
  })
})

describe('getRankValue (for run ordering)', () => {
  - returns correct numeric value for ordering: 3=3, 4=4, ..., 10=10, J=11, Q=12, K=13, A=14
  - 2 and Joker return special value (wild indicator) or throw error
})

describe('compareRanks', () => {
  - 3 < 4 < 5 < ... < 10 < J < Q < K < A
  - correctly orders all natural ranks
  - Ace is highest natural rank
  - 3 is lowest natural rank (2 is wild, not in sequence)
})
```

### `core/meld/validation.test.ts`

```
describe('isValidSet', () => {
  describe('valid sets - naturals only', () => {
    - valid: exactly 3 cards of same rank (9♣ 9♦ 9♥)
    - valid: 4 cards of same rank (K♣ K♦ K♥ K♠)
    - valid: 5 cards of same rank — multi-deck allows this (9♣ 9♦ 9♥ 9♠ 9♣)
    - valid: 6+ cards of same rank (with multiple decks)
    - valid: duplicate suits allowed (9♣ 9♣ 9♦) — multi-deck scenario
    - valid: all same suit allowed (9♣ 9♣ 9♣) — weird but legal with 3 decks
  })

  describe('valid sets - with wilds', () => {
    - valid: 2 naturals + 1 wild (9♣ 9♦ Joker)
    - valid: 2 naturals + 1 two (9♣ 9♦ 2♥)
    - valid: 3 naturals + 1 wild (9♣ 9♦ 9♥ Joker)
    - valid: 3 naturals + 2 wilds (9♣ 9♦ 9♥ 2♠ Joker) — 3 natural, 2 wild OK
    - valid: 2 naturals + 2 wilds (9♣ 9♦ 2♥ Joker) — equal count is OK
    - valid: 4 naturals + 4 wilds — equal count still OK
    - valid: mix of 2s and Jokers as wilds
  })

  describe('invalid sets - structure', () => {
    - invalid: fewer than 3 cards (9♣ 9♦)
    - invalid: only 1 card
    - invalid: empty array
    - invalid: different ranks without wilds (9♣ 10♦ J♥)
    - invalid: different ranks even with wild present (9♣ 10♦ Joker) — wild can't fix mismatched naturals
  })

  describe('invalid sets - wild ratio', () => {
    - invalid: 1 natural + 2 wilds (9♣ Joker Joker)
    - invalid: 1 natural + 2 twos (9♣ 2♥ 2♦)
    - invalid: 1 natural + 1 Joker + 1 two (9♣ Joker 2♥)
    - invalid: 2 naturals + 3 wilds
    - invalid: all wilds (Joker Joker 2♣)
    - invalid: 0 naturals + any wilds
  })

  describe('edge cases', () => {
    - valid: set of Aces (A♣ A♦ A♥)
    - valid: set of 3s — lowest non-wild rank (3♣ 3♦ 3♥)
    - 2s used as wilds, not as "set of 2s" — clarify: can you make a set of 2s?
  })
})

describe('isValidRun', () => {
  describe('valid runs - naturals only', () => {
    - valid: exactly 4 consecutive cards same suit (5♠ 6♠ 7♠ 8♠)
    - valid: 5 consecutive cards same suit (5♠ 6♠ 7♠ 8♠ 9♠)
    - valid: 6+ consecutive cards
    - valid: low run starting at 3 (3♦ 4♦ 5♦ 6♦)
    - valid: high run ending at Ace (J♥ Q♥ K♥ A♥)
    - valid: middle run (7♣ 8♣ 9♣ 10♣)
    - valid: run through face cards (9♠ 10♠ J♠ Q♠)
    - valid: longest possible run (3♦ 4♦ 5♦ 6♦ 7♦ 8♦ 9♦ 10♦ J♦ Q♦ K♦ A♦) — 12 cards
  })

  describe('valid runs - with wilds', () => {
    - valid: wild filling internal gap (5♠ 6♠ Joker 8♠) — Joker acts as 7♠
    - valid: wild at start of run (Joker 6♠ 7♠ 8♠) — Joker acts as 5♠
    - valid: wild at end of run (5♠ 6♠ 7♠ 2♣) — 2 acts as 8♠
    - valid: multiple wilds filling gaps (5♠ Joker 7♠ 2♣) — fills 6♠ and 8♠
    - valid: 2 naturals + 2 wilds (5♠ Joker Joker 8♠) — equal count OK
    - valid: wild extending beyond normal sequence (Joker 3♠ 4♠ 5♠) — Joker as "below 3"? NO - 3 is lowest
    - valid: run with wild at high end (Q♥ K♥ A♥ Joker)? — NO, A is highest, nothing above
  })

  describe('invalid runs - structure', () => {
    - invalid: fewer than 4 cards (5♠ 6♠ 7♠)
    - invalid: only 3 cards even with correct sequence
    - invalid: 2 cards
    - invalid: 1 card
    - invalid: empty array
    - invalid: mixed suits (5♠ 6♥ 7♠ 8♠)
    - invalid: gap in sequence without wild (5♠ 6♠ 8♠ 9♠) — missing 7
    - invalid: duplicate rank in run (5♠ 6♠ 6♠ 7♠) — can't repeat ranks
    - invalid: non-consecutive cards (5♠ 7♠ 9♠ J♠)
  })

  describe('invalid runs - ace positioning', () => {
    - invalid: Ace as low card (A♠ 3♠ 4♠ 5♠) — Ace is HIGH only
    - invalid: Ace in middle of run (K♠ A♠ 3♠ 4♠) — no wraparound
    - invalid: wraparound run (Q♠ K♠ A♠ 3♠) — Ace doesn't connect to 3
  })

  describe('invalid runs - wild ratio', () => {
    - invalid: 1 natural + 3 wilds (5♠ Joker Joker 2♣)
    - invalid: 2 naturals + 3 wilds
    - invalid: wilds outnumber naturals by any amount
    - invalid: all wilds (Joker Joker 2♣ 2♦)
  })

  describe('invalid runs - 2 as natural', () => {
    - invalid: treating 2 as natural rank in sequence (2♠ 3♠ 4♠ 5♠) — 2 is always wild
    - if 2 appears in a run, it must be acting as wild for some other rank
  })

  describe('edge cases', () => {
    - valid: run using both 2s and Jokers as wilds (5♠ 2♣ Joker 8♠)
    - what about run starting at 3 with wild "before" it? (Joker 3♠ 4♠ 5♠) — is Joker acting as 2? No, 2 isn't in sequence
    - wild at end extending past Ace? (J♥ Q♥ K♥ A♥ Joker) — invalid, nothing above Ace
  })
})

describe('countWildsAndNaturals', () => {
  - returns {wilds: 0, naturals: 3} for (9♣ 9♦ 9♥)
  - returns {wilds: 1, naturals: 2} for (9♣ 9♦ Joker)
  - returns {wilds: 2, naturals: 2} for (9♣ 9♦ 2♥ Joker)
  - returns {wilds: 2, naturals: 0} for (Joker 2♣)
  - returns {wilds: 0, naturals: 0} for empty array
  - counts both 2s and Jokers as wilds
})

describe('wildsOutnumberNaturals', () => {
  - returns false for 3 naturals, 0 wilds
  - returns false for 2 naturals, 1 wild
  - returns false for 2 naturals, 2 wilds (equal is OK)
  - returns false for 4 naturals, 4 wilds (equal is OK)
  - returns true for 1 natural, 2 wilds
  - returns true for 2 naturals, 3 wilds
  - returns true for 0 naturals, any wilds
})

describe('getRunRanks', () => {
  - extracts natural ranks from a run, marking wild positions
  - correctly identifies what rank each wild is "acting as"
  - for (5♠ Joker 7♠ 8♠) → positions [5, 6, 7, 8] where 6 is wild
})

describe('canExtendRun', () => {
  - returns true for card that extends run at low end (4♠ extends 5♠ 6♠ 7♠ 8♠)
  - returns true for card that extends run at high end (9♠ extends 5♠ 6♠ 7♠ 8♠)
  - returns true for wild card at either end
  - returns false for card of wrong suit
  - returns false for card that doesn't connect (10♠ can't extend 5♠ 6♠ 7♠ 8♠)
  - returns false for card already in run (6♠ can't extend 5♠ 6♠ 7♠ 8♠)
  - returns false for extending below 3 with natural card
  - returns false for extending above Ace
  - handles wilds in the existing run correctly
})

describe('canExtendSet', () => {
  - returns true for card of matching rank (9♣ extends 9♦ 9♥ 9♠)
  - returns true for wild card
  - returns false for card of different rank
  - returns false if adding wild would make wilds outnumber naturals
  - handles duplicate cards from multiple decks (9♣ extends 9♣ 9♦ 9♥)
})
```

### `core/meld/jokerPosition.test.ts` (for Joker swapping logic)

```
describe('identifyJokerPosition', () => {
  - in run (5♠ Joker 7♠ 8♠), Joker is acting as 6♠
  - in run (Joker 6♠ 7♠ 8♠), Joker is acting as 5♠
  - in run (5♠ 6♠ 7♠ Joker), Joker is acting as 8♠
  - in run (5♠ Joker Joker 8♠), first Joker is 6♠, second is 7♠
  - in run (Joker 4♠ 5♠ Joker), first is 3♠, second is 6♠
  - handles 2s acting as wilds same as Jokers
})

describe('canSwapJokerWithCard', () => {
  - returns true when natural card matches Joker's position (7♠ can swap Joker acting as 7♠)
  - returns false when natural card doesn't match position (8♠ can't swap Joker acting as 7♠)
  - returns false when card is wrong suit (7♥ can't swap Joker acting as 7♠)
  - returns false when card is itself wild (2♣ can't swap for Joker)
  - returns false for swapping from set (never allowed)
  - only works with Jokers, not 2s (2s cannot be swapped out)
})
```

### `core/scoring/scoring.test.ts`

```
describe('calculateHandScore', () => {
  - empty hand scores 0
  - hand with single 5 scores 5
  - hand with 3, 4, 5 scores 12
  - hand with J, Q, K scores 30
  - hand with single Ace scores 15
  - hand with single 2 scores 2
  - hand with single Joker scores 50
  - mixed hand: (3♥ J♦ A♠ Joker) scores 3 + 10 + 15 + 50 = 78
  - worst case hand: multiple Jokers (Joker Joker Joker) scores 150
})

describe('calculateRoundScores', () => {
  - player who went out scores 0
  - other players score sum of their remaining cards
  - returns map of playerId → score
})
```

---

**Questions I spotted while writing these:**

1. **Set of 2s** — Can you make a set of three 2s like (2♣ 2♦ 2♥)? They're all wild cards... This seems philosophically weird. My instinct: no, because there are no "naturals" in that set. The wild ratio rule would make it invalid (0 naturals, 3 wilds).

ANSWER: INVALID, you cannot make a set of three 2s like (2♣ 2♦ 2♥). The wild ratio rule would make it invalid (0 naturals, 3 wilds).

2. **Wild extending past sequence boundaries** — Can a Joker at the start of (Joker 3♠ 4♠ 5♠) represent a "2♠" even though 2s aren't in the natural sequence? I'd say no — the run sequence is 3-4-5-6-7-8-9-10-J-Q-K-A. Nothing below 3 or above A. So that run would be invalid (Joker has nothing to represent).

ANSWER: INVALID, a Joker at the start of (Joker 3♠ 4♠ 5♠) cannot represent a "2♠"

3. **Joker above Ace** — Similarly, (Q♥ K♥ A♥ Joker) — the Joker would need to be "above Ace" which doesn't exist. Invalid?

ANSWER: Yes that is invalid.
