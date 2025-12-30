Let me re-read the rules carefully to make sure I capture everything for laying down contracts.Now let me check the Glossary for any additional details on melds and contracts:Now I have the full picture. Here are comprehensive Phase 3 tests:

---

## Phase 3: Contracts + Laying Down — Comprehensive Test Descriptions

### `core/engine/contracts.test.ts`

```
describe('Contract definitions', () => {
  describe('CONTRACTS constant', () => {
    - contains exactly 6 contracts (rounds 1-6)
    - round 1: { sets: 2, runs: 0 }
    - round 2: { sets: 1, runs: 1 }
    - round 3: { sets: 0, runs: 2 }
    - round 4: { sets: 3, runs: 0 }
    - round 5: { sets: 2, runs: 1 }
    - round 6: { sets: 1, runs: 2 }
    - each contract has roundNumber matching its key
  })

  describe('getContractForRound', () => {
    - returns correct contract for rounds 1-6
    - throws or returns null for invalid round numbers (0, 7, -1)
  })

  describe('minimum cards required per contract', () => {
    - round 1 (2 sets): minimum 6 cards (3 + 3)
    - round 2 (1 set + 1 run): minimum 7 cards (3 + 4)
    - round 3 (2 runs): minimum 8 cards (4 + 4)
    - round 4 (3 sets): minimum 9 cards (3 + 3 + 3)
    - round 5 (2 sets + 1 run): minimum 10 cards (3 + 3 + 4)
    - round 6 (1 set + 2 runs): minimum 11 cards (3 + 4 + 4)
  })
})

describe('validateContract', () => {
  describe('correct number of melds', () => {
    - round 1: valid with exactly 2 sets, 0 runs
    - round 1: invalid with 1 set (too few)
    - round 1: invalid with 3 sets (too many)
    - round 1: invalid with 2 sets + 1 run (extra run)
    - round 2: valid with exactly 1 set, 1 run
    - round 2: invalid with 2 sets, 0 runs (wrong types)
    - round 2: invalid with 0 sets, 2 runs (wrong types)
    - round 3: valid with exactly 0 sets, 2 runs
    - round 3: invalid with 1 set, 1 run
    - round 4: valid with exactly 3 sets, 0 runs
    - round 5: valid with exactly 2 sets, 1 run
    - round 6: valid with exactly 1 set, 2 runs
  })

  describe('meld type verification', () => {
    - correctly identifies melds as sets vs runs
    - rejects if meld type doesn't match what player claims
    - a meld of (9♣ 9♦ 9♥) must be declared as set, not run
    - a meld of (5♠ 6♠ 7♠ 8♠) must be declared as run, not set
  })

  describe('each meld must be independently valid', () => {
    - rejects if any set is invalid (see Phase 1 set validation)
    - rejects if any run is invalid (see Phase 1 run validation)
    - rejects if any meld has wilds outnumbering naturals
    - all melds checked, not just first one
  })

  describe('card usage', () => {
    - each card can only appear in one meld
    - rejects if same cardId appears in multiple melds
    - validates by cardId, not by rank/suit (multi-deck has duplicates)
  })
})
```

### `core/engine/turnMachine.test.ts` (Phase 3 additions)

```
describe('TurnMachine - drawn state', () => {
  describe('state structure', () => {
    - after drawing, enters 'drawn' state (not directly to awaitingDiscard)
    - hasDrawn is true
    - player can choose to lay down or proceed to discard
  })

  describe('proceeding without laying down', () => {
    - READY_TO_DISCARD transitions to 'awaitingDiscard'
    - player remains not down (isDown: false)
    - hand unchanged (still has drawn card)
    - can proceed even if player could lay down (optional action)
  })
})

describe('TurnMachine - LAY_DOWN command', () => {
  describe('preconditions', () => {
    - rejects if player hasn't drawn yet (state is awaitingDraw)
    - rejects if player is already down this round (isDown: true)
    - rejects if melds don't match contract
    - rejects if any meld is invalid
    - state unchanged on any rejection
  })

  describe('successful lay down - Round 1 (2 sets)', () => {
    - accepts valid 2 sets
    - example: (9♣ 9♦ 9♥) and (K♣ K♦ K♠)
    - removes meld cards from player's hand
    - adds melds to table
    - sets isDown to true
    - sets laidDownThisTurn to true
    - transitions to awaitingDiscard (auto-transition)
  })

  describe('successful lay down - Round 2 (1 set + 1 run)', () => {
    - accepts valid 1 set and 1 run
    - example: (9♣ 9♦ 9♥) and (5♠ 6♠ 7♠ 8♠)
    - both melds added to table
    - player marked as down
  })

  describe('successful lay down - Round 3 (2 runs)', () => {
    - accepts valid 2 runs
    - example: (3♦ 4♦ 5♦ 6♦) and (J♥ Q♥ K♥ A♥)
    - minimum 8 cards used
  })

  describe('successful lay down - Round 4 (3 sets)', () => {
    - accepts valid 3 sets
    - example: (3♣ 3♦ 3♥) and (7♠ 7♦ 7♣) and (Q♥ Q♠ Q♦)
    - minimum 9 cards used
  })

  describe('successful lay down - Round 5 (2 sets + 1 run)', () => {
    - accepts valid 2 sets and 1 run
    - minimum 10 cards used
  })

  describe('successful lay down - Round 6 (1 set + 2 runs)', () => {
    - accepts valid 1 set and 2 runs
    - minimum 11 cards used
    - (special going out rules tested in Phase 4)
  })

  describe('melds with wilds', () => {
    - accepts set with valid wild ratio: (9♣ 9♦ Joker)
    - accepts set with equal wilds/naturals: (9♣ 9♦ 2♥ Joker) — 2 natural, 2 wild
    - accepts run with wild filling gap: (5♠ 6♠ Joker 8♠)
    - accepts run with wild at end: (5♠ 6♠ 7♠ 2♣)
    - rejects set with too many wilds: (9♣ Joker Joker)
    - rejects run with too many wilds: (5♠ Joker Joker 2♣) — 1 natural, 3 wild
    - each meld validated independently for wild ratio
  })

  describe('larger than minimum melds', () => {
    - accepts 4-card set: (9♣ 9♦ 9♥ 9♠)
    - accepts 5-card set: (9♣ 9♦ 9♥ 9♠ 9♣) — duplicate from multi-deck
    - accepts 5-card run: (5♠ 6♠ 7♠ 8♠ 9♠)
    - accepts 6+ card run: (5♠ 6♠ 7♠ 8♠ 9♠ 10♠)
    - larger melds still count as 1 set or 1 run toward contract
  })

  describe('card removal from hand', () => {
    - only cards in melds are removed from hand
    - remaining cards stay in hand
    - hand size = previous size - cards laid down
    - example: 12 cards - 6 laid down = 6 remaining
    - correct cards removed (verified by cardId)
  })

  describe('meld ownership', () => {
    - each meld has ownerId set to current player
    - melds appear on table with correct owner
    - multiple players' melds can coexist on table
  })
})

describe('TurnMachine - invalid LAY_DOWN scenarios', () => {
  describe('wrong number of melds', () => {
    - round 1: rejects 1 set (need 2)
    - round 1: rejects 3 sets (too many)
    - round 2: rejects 2 sets + 0 runs (wrong combination)
    - round 2: rejects 0 sets + 2 runs (wrong combination)
    - provides clear error message about contract requirement
  })

  describe('invalid individual melds', () => {
    - rejects if first meld is invalid, even if second is valid
    - rejects if second meld is invalid, even if first is valid
    - rejects set with different ranks: (9♣ 10♦ J♥)
    - rejects run with gap: (5♠ 6♠ 8♠ 9♠)
    - rejects run with mixed suits: (5♠ 6♥ 7♠ 8♠)
    - rejects run with only 3 cards: (5♠ 6♠ 7♠)
    - rejects set with only 2 cards: (9♣ 9♦)
    - provides specific error about which meld is invalid
  })

  describe('card not in hand', () => {
    - rejects if any cardId in melds is not in player's hand
    - rejects if cardId belongs to another player
    - rejects if cardId is on the table already
    - rejects if cardId doesn't exist
  })

  describe('duplicate card usage', () => {
    - rejects if same cardId appears in two melds
    - example: trying to use 9♣ in both a set of 9s and... wait, that doesn't make sense
    - more realistic: player tries to submit melds with overlapping cardIds (bug/cheat attempt)
  })

  describe('already down', () => {
    - rejects LAY_DOWN if player already laid down this round
    - isDown: true prevents any further lay down attempts
    - error message: "already laid down this round"
  })
})

describe('TurnMachine - post lay down behavior', () => {
  describe('auto-transition to awaitingDiscard', () => {
    - after successful LAY_DOWN, state becomes awaitingDiscard
    - laidDownThisTurn flag causes this auto-transition
    - player cannot stay in 'drawn' state after laying down
  })

  describe('turn end after laying down', () => {
    - if hand.length > 0: must discard one card to end turn
    - if hand.length === 0: goes out immediately (no discard)
    - (note: can only reach 0 on lay down turn if contract uses all cards)
  })

  describe('cannot lay off on same turn', () => {
    - LAY_OFF command rejected when laidDownThisTurn is true
    - error: "cannot lay off on same turn as laying down"
    - must wait until next turn to lay off
  })

  describe('cannot lay down again', () => {
    - second LAY_DOWN command rejected
    - isDown already true
  })
})

describe('TurnMachine - turn completion after lay down', () => {
  describe('discard after laying down', () => {
    - from awaitingDiscard, DISCARD command works normally
    - card removed from hand, added to discard pile
    - transitions to turnComplete
    - output includes updated hand, table, discard
  })

  describe('turn output reflects lay down', () => {
    - output.isDown is true
    - output.table includes new melds
    - output.hand is reduced by meld cards + discard
  })
})
```

### `core/engine/gameState.test.ts` (table and isDown tracking)

```
describe('GameState - table management', () => {
  describe('initial state', () => {
    - table is empty array at start of round
    - no melds exist before anyone lays down
  })

  describe('after first player lays down', () => {
    - table contains that player's melds
    - melds have correct ownerId
    - melds have unique ids
  })

  describe('after multiple players lay down', () => {
    - table contains melds from all players who are down
    - melds keep their ownerId
    - melds are distinguishable by id
    - table grows as more players lay down
  })

  describe('table persistence across turns', () => {
    - table melds persist when turn advances
    - table melds persist after discards
    - table only changes when someone lays down (or lays off in Phase 4)
  })
})

describe('GameState - isDown tracking', () => {
  describe('initial state', () => {
    - all players start with isDown: false
    - at start of each round, isDown resets to false
  })

  describe('after laying down', () => {
    - only the player who laid down has isDown: true
    - other players remain isDown: false
    - isDown persists across that player's future turns
  })

  describe('multiple players down', () => {
    - each player's isDown tracked independently
    - player A down, player B not down is valid state
    - eventually all players might be down
  })

  describe('round transition', () => {
    - when round ends, all isDown should reset for next round
    - (this is Phase 4/5 territory but worth noting)
  })
})
```

### `core/engine/guards.test.ts` (Phase 3 additions)

```
describe('notDownYet guard', () => {
  - returns true when player.isDown is false
  - returns false when player.isDown is true
  - uses current player's state, not other players
})

describe('meetsContract guard', () => {
  describe('round 1 - 2 sets', () => {
    - returns true for exactly 2 valid sets
    - returns false for 1 set
    - returns false for 3 sets
    - returns false for 1 set + 1 run
    - returns false for 2 runs
  })

  describe('round 2 - 1 set + 1 run', () => {
    - returns true for exactly 1 valid set + 1 valid run
    - returns false for 2 sets
    - returns false for 2 runs
    - returns false for 1 set only
    - returns false for 1 run only
  })

  describe('round 3 - 2 runs', () => {
    - returns true for exactly 2 valid runs
    - returns false for 1 run
    - returns false for 2 sets
  })

  describe('round 4 - 3 sets', () => {
    - returns true for exactly 3 valid sets
    - returns false for 2 sets
    - returns false for 4 sets
  })

  describe('round 5 - 2 sets + 1 run', () => {
    - returns true for exactly 2 valid sets + 1 valid run
    - returns false for 3 sets
    - returns false for 1 set + 2 runs
  })

  describe('round 6 - 1 set + 2 runs', () => {
    - returns true for exactly 1 valid set + 2 valid runs
    - returns false for 2 sets + 1 run
    - returns false for 3 runs
  })
})

describe('validMelds guard', () => {
  - returns true if all proposed melds are valid
  - returns false if any meld is invalid
  - checks set validity rules (same rank, 3+ cards)
  - checks run validity rules (same suit, consecutive, 4+ cards)
  - validates each meld independently
})

describe('wildsNotOutnumbered guard', () => {
  - returns true if all melds have valid wild ratio
  - returns false if any meld has wilds > naturals
  - checks each meld independently
  - equal wilds to naturals is acceptable
})

describe('canLayDown composite guard', () => {
  - combines: notDownYet AND meetsContract AND validMelds AND wildsNotOutnumbered
  - all must be true for lay down to proceed
  - short-circuits on first failure (optional optimization)
})
```

### `core/engine/actions.test.ts` (Phase 3 additions)

```
describe('layDownMelds action', () => {
  describe('hand modification', () => {
    - removes exactly the cards specified in melds
    - does not remove other cards
    - hand order of remaining cards preserved
    - works with minimum size melds
    - works with larger melds
  })

  describe('table modification', () => {
    - adds all melds to table
    - melds have type: 'set' or 'run' correctly
    - melds have ownerId set to current player
    - melds have unique generated ids
    - meld cards are copies (not references to hand cards)
  })

  describe('player state modification', () => {
    - sets isDown to true
    - sets laidDownThisTurn to true
  })

  describe('meld creation', () => {
    - createMeld generates unique id
    - createMeld stores cards array
    - createMeld stores type correctly
    - createMeld stores ownerId
  })
})
```

### `core/engine/integration.test.ts` (full turn flows)

```
describe('complete lay down turn flow', () => {
  describe('round 1 - successful lay down', () => {
    given: player has 11 cards including (9♣ 9♦ 9♥) and (K♣ K♦ K♠)
    when: player draws from stock (now 12 cards)
    and: player lays down both sets (6 cards)
    and: player discards one card
    then: player has 5 cards remaining
    and: table has 2 melds owned by player
    and: player.isDown is true
    and: turn completes successfully
  })

  describe('round 2 - successful lay down with wilds', () => {
    given: player has cards including (9♣ 9♦ Joker) and (5♠ 6♠ 7♠ 8♠)
    when: player draws and lays down
    then: meld with Joker is valid (2 natural, 1 wild)
    and: both melds on table
  })

  describe('player chooses not to lay down', () => {
    given: player has valid contract in hand
    when: player draws
    and: player proceeds to discard without laying down
    then: player.isDown remains false
    and: table unchanged
    and: player keeps all cards except discard
    and: turn completes normally
  })

  describe('player cannot lay down - missing cards', () => {
    given: player only has 1 valid set, needs 2 for round 1
    when: player draws
    then: LAY_DOWN command is rejected
    and: player must proceed to discard
    and: player.isDown remains false
  })

  describe('multiple turns with lay down', () => {
    given: game with 3 players
    when: player 1 takes turn and lays down
    and: player 2 takes turn but cannot lay down
    and: player 3 takes turn and lays down
    then: table has melds from player 1 and player 3
    and: player 1 and 3 have isDown: true
    and: player 2 has isDown: false
  })
})

describe('edge cases', () => {
  describe('laying down maximum cards', () => {
    given: round 1, player has exactly 7 cards that form 2 sets (3+3) + 1 extra
    when: player draws (now 8 cards)
    and: player lays down 6 cards
    then: player has 2 cards, discards 1, ends with 1 card
  })

  describe('laying down leaves exactly 1 card', () => {
    given: round 5, player has 11 cards (dealt)
    when: player draws (12 cards)
    and: player lays down minimum 10 cards (3+3+4)
    then: player has 2 cards, must discard 1
    and: ends turn with 1 card in hand
  })

  describe('attempting lay down with insufficient remaining', () => {
    given: round 4 requires 9 cards minimum
    given: player has exactly 10 cards after drawing
    when: player tries to lay down 10 cards
    then: this would leave 0 cards - need to discard!
    note: is this even possible? 10 cards = 3+3+3+1 extra...
    actually: 3+3+4 = 10 for a 2set+1run, but round 4 is 3 sets
    3+3+3 = 9, leaving 1 to discard - this is fine
    edge: what if player tries to lay down ALL cards before round 6?
    answer: melds must match contract exactly - can't add extras during lay down
  })

  describe('contract validation prevents over-laying', () => {
    given: round 1 requires 2 sets
    when: player tries to lay down 3 sets
    then: rejected - wrong number of melds
    and: player cannot "include extras" in lay down action
  })

  describe('wilds across multiple melds', () => {
    given: round 1, player wants to lay down (9♣ 9♦ Joker) and (K♣ K♦ 2♥)
    when: player lays down
    then: each meld validated independently
    and: both are valid (2 natural, 1 wild each)
    and: lay down succeeds
  })

  describe('concentrated wilds in one meld - invalid', () => {
    given: round 1, player wants to lay down (9♣ Joker 2♥) and (K♣ K♦ K♠)
    when: player tries to lay down
    then: first meld invalid (1 natural, 2 wild)
    and: entire lay down rejected
    and: player state unchanged
  })

  describe('same rank cards from multiple decks', () => {
    given: multi-deck game
    when: player lays down (9♣ 9♣ 9♦) - two 9 of clubs
    then: this is valid - different physical cards (different ids)
    and: set of same rank, any suits (duplicates allowed)
  })
})
```

### `cli/laydown.test.ts` (CLI input for lay down)

```
describe('parseLayDownInput', () => {
  describe('card selection syntax', () => {
    - parses "l 1,2,3 4,5,6,7" as LAY_DOWN with two melds
    - first group "1,2,3" is first meld (card positions)
    - second group "4,5,6,7" is second meld
    - positions are 1-indexed
    - spaces separate melds
    - commas separate cards within meld
  })

  describe('meld type inference', () => {
    - determines if each group is set or run based on cards
    - 3 cards same rank → set
    - 4+ cards same suit consecutive → run
    - ambiguous cases? (probably not possible given rules)
  })

  describe('validation', () => {
    - rejects positions outside hand range
    - rejects duplicate positions across melds
    - rejects empty meld groups
    - provides helpful error messages
  })

  describe('alternative syntaxes', () => {
    - "l 1 2 3 / 4 5 6 7" with slash separator?
    - or guided mode: "enter cards for SET 1..."
  })
})

describe('lay down confirmation flow', () => {
  - shows proposed melds before confirming
  - allows player to cancel and re-enter
  - validates melds before sending command
  - provides preview: "Set: 9♣ 9♦ 9♥ ✓"
  - shows rejection reason if invalid
})
```

---

**Key insights from this phase:**

1. **Contract validation is the core guard** — Must check exact number of sets/runs, meld validity, and wild ratio all together.

2. **laidDownThisTurn flag** — This is critical for preventing lay-off on the same turn. The auto-transition to awaitingDiscard makes this clean.

3. **Card ownership verification** — Every cardId in the lay down request must be verified as actually being in the player's hand.

4. **Meld independence** — Each meld is validated separately for wild ratio. You can't "average" wilds across melds.

5. **Cannot over-lay** — Player can't include extra cards beyond the contract in the LAY_DOWN action itself. Those extras must wait for lay-off on future turns.
