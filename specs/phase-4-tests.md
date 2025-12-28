## Phase 4: Laying Off + Going Out + Scoring — Complete Test Descriptions

### `core/engine/layoff.test.ts`

```
describe('canLayOffCard guard', () => {
  describe('preconditions for laying off', () => {
    - returns false if player is not down (isDown: false)
    - returns false if player laid down this turn (laidDownThisTurn: true)
    - returns false if player hasn't drawn yet (not in drawn state)
    - returns true if isDown: true AND laidDownThisTurn: false AND hasDrawn
  })

  describe('laying off to sets', () => {
    - valid: adding matching rank to set (9♣ to 9♦ 9♥ 9♠)
    - valid: adding wild to set (Joker to 9♦ 9♥ 9♠)
    - valid: adding 2 (wild) to set (2♣ to 9♦ 9♥ 9♠)
    - valid: adding duplicate card from multi-deck (9♣ to 9♣ 9♦ 9♥)
    - invalid: adding wrong rank (10♣ to 9♦ 9♥ 9♠)
    - invalid: adding wild if it would make wilds outnumber naturals
  })

  describe('laying off to sets - wild ratio edge cases', () => {
    given: set (9♦ 9♥ 9♠) — 3 natural, 0 wild
    - adding Joker → 3 natural, 1 wild — valid
    - adding 2♣ → 3 natural, 1 wild — valid

    given: set (9♦ 9♥ Joker) — 2 natural, 1 wild
    - adding 9♠ (natural) → 3 natural, 1 wild — valid
    - adding 2♣ (wild) → 2 natural, 2 wild — valid (equal is OK)

    given: set (9♦ 9♥ Joker 2♣) — 2 natural, 2 wild
    - adding 9♠ (natural) → 3 natural, 2 wild — valid
    - adding Joker → 2 natural, 3 wild — INVALID (wilds outnumber)
  })

  describe('laying off to runs', () => {
    - valid: extending run at low end (4♠ to 5♠ 6♠ 7♠ 8♠)
    - valid: extending run at high end (9♠ to 5♠ 6♠ 7♠ 8♠)
    - valid: adding wild at low end (Joker to 5♠ 6♠ 7♠ 8♠) — acts as 4♠
    - valid: adding wild at high end (2♣ to 5♠ 6♠ 7♠ 8♠) — acts as 9♠
    - invalid: card doesn't connect (10♠ to 5♠ 6♠ 7♠ 8♠) — gap of 1
    - invalid: wrong suit (4♥ to 5♠ 6♠ 7♠ 8♠)
    - invalid: rank already in run (6♠ to 5♠ 6♠ 7♠ 8♠) — duplicate rank
    - invalid: non-connecting card (3♠ to 5♠ 6♠ 7♠ 8♠) — gap too large
  })

  describe('run extension boundaries', () => {
    given: run (3♦ 4♦ 5♦ 6♦)
    - can extend high with 7♦ — valid
    - cannot extend low (nothing below 3) — invalid
    - wild at low end invalid (nothing for it to represent)

    given: run (J♥ Q♥ K♥ A♥)
    - can extend low with 10♥ — valid
    - cannot extend high (nothing above A) — invalid
    - wild at high end invalid (nothing for it to represent)

    given: run (3♠ 4♠ 5♠ 6♠ 7♠ 8♠ 9♠ 10♠ J♠ Q♠ K♠ A♠) — full 12-card run
    - cannot extend in either direction
    - no cards can be added
  })

  describe('laying off to runs - wild ratio edge cases', () => {
    given: run (5♠ 6♠ 7♠ 8♠) — 4 natural, 0 wild
    - adding Joker at either end → 4 natural, 1 wild — valid

    given: run (5♠ Joker 7♠ 8♠) — 3 natural, 1 wild
    - adding 4♠ (natural) → 4 natural, 1 wild — valid
    - adding 9♠ (natural) → 4 natural, 1 wild — valid
    - adding 2♣ (wild) at end → 3 natural, 2 wild — valid (equal OK)

    given: run (5♠ Joker 7♠ 2♣) — 2 natural, 2 wild
    - adding 4♠ (natural) → 3 natural, 2 wild — valid
    - adding 9♠ (natural) → 3 natural, 2 wild — valid
    - adding Joker → 2 natural, 3 wild — INVALID
  })

  describe('card ownership for lay off', () => {
    - card must be in current player's hand
    - cannot lay off card not in hand
    - cannot lay off card from another player's hand
    - cannot lay off card already on table
    - cardId must exist
  })

  describe('meld ownership - anyone can add to any meld', () => {
    - can lay off to your own melds
    - can lay off to other players' melds
    - meld ownership doesn't restrict who can add
    - meld ownerId unchanged after lay off (original owner keeps credit)
  })
})

describe('LAY_OFF action', () => {
  describe('successful lay off to set', () => {
    - removes card from player's hand
    - adds card to target meld's cards array
    - meld remains type: 'set'
    - meld ownerId unchanged
    - hand size decreases by 1
    - player remains in 'drawn' state (can lay off more)
  })

  describe('successful lay off to run - low end', () => {
    given: run (5♠ 6♠ 7♠ 8♠), player has 4♠
    when: player lays off 4♠
    then: run becomes (4♠ 5♠ 6♠ 7♠ 8♠)
    and: card at correct position (first)
  })

  describe('successful lay off to run - high end', () => {
    given: run (5♠ 6♠ 7♠ 8♠), player has 9♠
    when: player lays off 9♠
    then: run becomes (5♠ 6♠ 7♠ 8♠ 9♠)
    and: card at correct position (last)
  })

  describe('successful lay off - wild to run', () => {
    given: run (5♠ 6♠ 7♠ 8♠), player has Joker
    when: player lays off Joker to high end
    then: run becomes (5♠ 6♠ 7♠ 8♠ Joker)
    and: Joker represents 9♠
  })

  describe('multiple lay offs in one turn', () => {
    - player can lay off first card, remain in 'drawn' state
    - player can lay off second card, remain in 'drawn' state
    - player can lay off third card, etc.
    - each lay off is separate command
    - hand decreases with each lay off
    - can lay off to different melds in same turn
    - can lay off multiple cards to same meld (one at a time)
  })

  describe('state transitions after lay off', () => {
    - after LAY_OFF, remains in 'drawn' state
    - can issue another LAY_OFF command
    - can proceed to DISCARD (rounds 1-5)
    - can proceed to END_TURN (round 6)
    - can trigger going out if hand becomes empty (round 6)
  })
})

describe('LAY_OFF rejection', () => {
  describe('player state rejections', () => {
    - rejected if player not down (isDown: false)
    - rejected if player laid down this turn (laidDownThisTurn: true)
    - rejected if player hasn't drawn yet
    - error message: "must be down from a previous turn to lay off"
    - error message: "cannot lay off on same turn as laying down"
    - state unchanged on rejection
    - hand unchanged on rejection
  })

  describe('invalid card rejections', () => {
    - rejected if cardId not in player's hand
    - error message: "card not in hand"
  })

  describe('invalid meld rejections', () => {
    - rejected if meldId doesn't exist on table
    - error message: "meld not found"
  })

  describe('card doesn't fit meld rejections', () => {
    - rejected if card doesn't match set's rank
    - rejected if card doesn't extend run
    - rejected if card wrong suit for run
    - error message: "card does not fit this meld"
  })

  describe('wild ratio rejections', () => {
    - rejected if adding wild would make wilds > naturals
    - error message: "would make wilds outnumber naturals"
  })
})
```

### `core/engine/goingOut.test.ts`

```
describe('going out - general rules', () => {
  describe('definition', () => {
    - going out means ending with 0 cards in hand
    - player who goes out scores 0 for the round
    - going out ends the round immediately
    - other players score their remaining cards
  })

  describe('must be down to go out', () => {
    - player cannot go out if isDown: false
    - only way to remove cards (other than discard) is to lay off
    - laying off requires being down
    - therefore: must be down to reach 0 cards
  })

  describe('only path to going out', () => {
    - lay down contract (become down)
    - on subsequent turns: lay off cards until 1 remains
    - discard last card (any round except 6) OR lay off last card (any round)
    - exception: go out on same turn as laying down (see below)
  })
})

describe('going out - rounds 1-5', () => {
  describe('going out via discard', () => {
    - player goes out by discarding their last card
    - after discard, hand.length === 0
    - triggers wentOut state
    - round ends
  })

  describe('going out via lay off', () => {
    - player goes out by laying off their last card(s)
    - after lay off, hand.length === 0
    - triggers wentOut state
    - round ends immediately
    - no discard required
  })

  describe('sequence to go out (with discard)', () => {
    given: player is down, has 3 cards after drawing
    when: player lays off 2 cards (1 card remaining)
    and: player discards last card
    then: player has 0 cards
    and: player went out
    and: round ends immediately
  })

  describe('sequence to go out (without discard)', () => {
    given: player is down, has 3 cards after drawing
    when: player lays off all 3 cards to valid melds
    then: player has 0 cards
    and: player went out
    and: round ends immediately without needing a discard
  })

  describe('must discard to end turn if >0 cards (rounds 1-5)', () => {
    given: player is down, has 2 cards after drawing
    when: player lays off 1 card (1 card remaining)
    then: player has NOT gone out yet (still has 1 card)
    and: player MUST discard to complete turn
    when: player discards last card
    then: NOW player has gone out
  })

  describe('wentOut trigger', () => {
    - checked after DISCARD or LAY_OFF command completes
    - if hand.length === 0 → wentOut
    - if hand.length > 0 after discard → turnComplete (normal)
  })
})

describe('going out - round 6 special rules', () => {
  describe('no discarding in round 6', () => {
    - DISCARD command is NEVER allowed in round 6
    - this applies to ALL players
    - this applies regardless of hand size
    - this applies whether going out or not
    - error message: "no discarding allowed in round 6"
  })

  describe('must lay off all cards to go out', () => {
    - in round 6, must reach 0 cards via laying off
    - last card(s) must be played to melds
    - no discard to "finish off" the last card
  })

  describe('going out via lay off', () => {
    given: round 6, player is down, has 2 cards
    when: player draws (3 cards)
    and: player lays off all 3 cards to valid melds
    then: hand is empty (0 cards)
    and: player has gone out
    and: no discard occurred
    and: round ends
  })

  describe('going out with single card', () => {
    given: round 6, player is down, has 1 card after drawing
    and: that card can be laid off
    when: player lays off that card
    then: hand is empty (0 cards)
    and: player goes out
  })

  describe('GO_OUT command', () => {
    - available in all rounds (as a convenience for multiple lay offs)
    - only available when player is down
    - can include finalLayOffs array for convenience
    - validates all lay offs before executing
    - executes all lay offs in order
    - player must end with 0 cards
    - transitions to wentOut state
  })

  describe('GO_OUT with multiple lay offs', () => {
    given: player has 3 cards: 9♠, 4♦, K♥
    and: table has melds each card can join
    when: GO_OUT { finalLayOffs: [
      { cardId: '9♠', meldId: 'set-of-9s' },
      { cardId: '4♦', meldId: 'diamond-run' },
      { cardId: 'K♥', meldId: 'set-of-kings' }
    ]}
    then: all three cards laid off
    and: hand is empty
    and: player went out
  })

  describe('GO_OUT rejected scenarios', () => {
    - rejected if player not down
    - rejected if any lay off in finalLayOffs is invalid
    - rejected if cards would remain after all lay offs
    - state unchanged on rejection
    - error messages specific to failure reason
  })
})

describe('going out - round 6 stuck scenarios', () => {
  describe('stuck with unlayable cards', () => {
    given: round 6, player is down, has 3 cards after drawing
    and: only 1 card can be laid off to existing melds
    when: player lays off that 1 card (2 remaining)
    and: remaining 2 cards cannot be laid off anywhere
    then: player cannot go out
    and: player cannot discard (round 6 rule)
    and: player must end turn with 2 cards in hand
    and: turn ends, next player goes
  })

  describe('stuck with single unlayable card', () => {
    given: round 6, player is down, has 1 card after drawing
    and: that card cannot be laid off to any meld
    then: player cannot go out (can't lay off)
    and: player cannot discard (round 6 rule)
    and: player ends turn with 1 card
    and: player must wait for melds to grow in future turns
  })

  describe('waiting for melds to expand', () => {
    given: round 6, player has 7♦ that fits no current meld
    and: no diamond runs exist, no set of 7s exists
    when: player's turn
    then: player cannot play the 7♦
    and: player keeps it for future turns
    and: hopes another player creates a meld it fits
    and: OR hopes to draw cards that help form layable combinations
  })

  describe('hand can grow in round 6', () => {
    given: round 6, player has 2 unlayable cards
    when: turn 1 - player draws (3 cards), can't lay off, no discard, ends with 3
    and: turn 2 - player draws (4 cards), can't lay off, no discard, ends with 4
    and: turn 3 - player draws (5 cards), can't lay off, no discard, ends with 5
    then: player's hand grows each turn when stuck
    and: this continues until player can lay off cards
  })

  describe('ending turn in round 6 without going out', () => {
    given: player has laid off all possible cards
    and: player still has cards remaining
    when: player has no more valid lay off moves
    then: turn ends automatically (or END_TURN command)
    and: no discard occurs
    and: next player's turn begins
  })
})

describe('going out - not down scenarios', () => {
  describe('cannot go out if not down - rounds 1-5', () => {
    given: player has not laid down (isDown: false)
    and: player has 1 card
    when: player draws (2 cards)
    then: player cannot lay off (not down)
    and: player must discard (1 card remaining)
    and: player CANNOT reach 0 cards this way
    and: player CANNOT go out while not down
  })

  describe('cannot go out if not down - round 6', () => {
    given: round 6, player has not laid down
    and: player has 8 cards
    when: player draws (9 cards)
    then: player cannot lay off (not down)
    and: player cannot discard (round 6)
    and: player ends turn with 9 cards
    and: player's hand grows until they can lay down!
  })

  describe('round 6 not down - hand growth', () => {
    given: round 6, player is not down, has 8 cards
    when: turn 1 - draws to 9, can't lay down, can't discard, ends with 9
    and: turn 2 - draws to 10, can't lay down, can't discard, ends with 10
    and: turn 3 - draws to 11, NOW can lay down contract!
    then: player finally lays down
    and: can start laying off on future turns
    and: can eventually go out
  })

  describe('only path to 0 cards requires being down', () => {
    - if not down: cannot lay off, can only draw and discard (rounds 1-5)
    - draw +1, discard -1 = net 0 change (can't reduce hand)
    - in round 6 not down: draw +1, no discard = hand grows
    - must lay down to become down
    - only then can lay off to reduce hand toward 0
  })
})

describe('going out - on lay down turn', () => {
  describe('going out same turn as laying down (rounds 1-5)', () => {
    given: player has 7 cards in hand
    when: player draws (8 cards)
    and: player lays down melds totaling 7 cards (1 card remaining)
    and: player discards last card
    then: player has 0 cards
    and: player went out
    note: player became down during turn, then immediately discarded to 0
    and: this IS allowed - going out on lay down turn
  })

  describe('example: round 1 going out on lay down', () => {
    given: round 1 (contract: 2 sets)
    and: player has 7 cards: (9♣ 9♦ 9♥ 9♠) + (K♣ K♦ K♥)
    when: player draws (8 cards total)
    and: player lays down: set of 4 nines + set of 3 kings = 7 cards
    and: player has 1 card remaining
    and: player discards that card
    then: player went out on same turn as laying down
  })

  describe('cannot go out on lay down turn in round 6', () => {
    given: round 6 (contract: 1 set + 2 runs = minimum 11 cards)
    and: player has 11 cards
    when: player draws (12 cards)
    and: player lays down exactly 11 cards
    and: player has 1 card remaining
    then: player cannot lay off (laidDownThisTurn: true)
    and: player cannot discard (round 6)
    and: player ends turn with 1 card
    and: must wait until next turn to lay off and go out
  })

  describe('round 6 go out on lay down - only with 12+ card contract', () => {
    given: round 6, player has 12 cards after drawing
    and: player can form contract using all 12 cards (larger melds)
    when: player lays down all 12 cards
    then: player has 0 cards
    and: player went out immediately on lay down
    note: rare scenario requiring larger-than-minimum melds
  })
})

describe('going out - turn output', () => {
  describe('wentOut output structure', () => {
    - wentOut: true
    - playerId: id of player who went out
    - hand: empty array []
    - distinct from turnComplete output
  })

  describe('turnComplete vs wentOut', () => {
    - turnComplete: wentOut: false, hand has cards, normal turn end
    - wentOut: wentOut: true, hand empty, round ends
    - both are final states of turn machine
    - parent machine (round) handles differently based on wentOut flag
  })

  describe('wentOut triggers round end', () => {
    - when turn outputs wentOut: true
    - round machine transitions to scoring state
    - no more turns for any player
    - scoring begins immediately
  })
})
```

### `core/engine/scoring.test.ts`

```
describe('calculateHandScore', () => {
  describe('empty hand', () => {
    - returns 0 for empty hand
    - player who went out always scores 0
  })

  describe('number cards (3-10)', () => {
    - 3♥ = 3 points
    - 4♦ = 4 points
    - 5♣ = 5 points
    - 6♠ = 6 points
    - 7♥ = 7 points
    - 8♦ = 8 points
    - 9♣ = 9 points
    - 10♠ = 10 points
  })

  describe('face cards', () => {
    - J♥ = 10 points
    - Q♦ = 10 points
    - K♣ = 10 points
    - J + Q + K = 30 points
  })

  describe('aces', () => {
    - A♠ = 15 points
    - A♥ = 15 points
    - A + A = 30 points
  })

  describe('wild cards', () => {
    - 2♥ = 2 points (wild but low value)
    - 2♦ = 2 points
    - 2♣ = 2 points
    - 2♠ = 2 points
    - Joker = 50 points (high risk!)
  })

  describe('mixed hand totals', () => {
    - (3♥) = 3
    - (3♥, 4♦) = 7
    - (3♥, 4♦, 5♣) = 12
    - (J♥, Q♦, K♣) = 30
    - (A♠, A♥) = 30
    - (Joker) = 50
    - (Joker, Joker) = 100
    - (2♣, 2♦, 2♥, 2♠) = 8 (all wilds but low total)
  })

  describe('realistic end-of-round hands', () => {
    - (3♥, 5♦, 9♣, J♠) = 3 + 5 + 9 + 10 = 27
    - (A♦, K♥, Q♠, Joker) = 15 + 10 + 10 + 50 = 85
    - (7♥, 8♥, 9♥, 10♥) = 7 + 8 + 9 + 10 = 34 (almost a run!)
    - (K♠, K♥, K♦) = 30 (almost a set!)
    - (2♣, 2♦, 2♥) = 6 (wilds but cheap to hold)
  })

  describe('worst case hands', () => {
    - single Joker = 50
    - two Jokers = 100
    - three Jokers = 150
    - Joker + Joker + A + A = 50 + 50 + 15 + 15 = 130
    - 11 Jokers = 550 (theoretical maximum per round)
  })

  describe('edge cases', () => {
    - single card hand
    - hand with all same card type
    - hand with one of each point value
    - very large hand (round 6 stuck scenario)
  })
})

describe('calculateRoundScores', () => {
  describe('basic scoring', () => {
    given: player 1 went out, player 2 has cards, player 3 has cards
    then: returns { p1: 0, p2: <hand score>, p3: <hand score> }
  })

  describe('structure', () => {
    - returns object/map of playerId → score
    - includes all players in the game
    - winner (went out) always has score 0
    - losers have score = sum of card values in hand
  })

  describe('multi-player scenarios', () => {
    given: 3 players, p1 went out
    and: p2 has (J♥, Q♦) = 20 points
    and: p3 has (A♠, Joker) = 65 points
    then: scores = { p1: 0, p2: 20, p3: 65 }

    given: 4 players, p3 went out
    and: p1 has (3♥) = 3
    and: p2 has (K♣, K♦) = 20
    and: p4 has (Joker, Joker, A♥) = 115
    then: scores = { p1: 3, p2: 20, p3: 0, p4: 115 }
  })

  describe('all players included', () => {
    - every player has an entry in result
    - no missing players
    - no duplicate entries
    - no extra players
  })

  describe('empty hands (edge case)', () => {
    - only winner should have empty hand
    - if somehow multiple empty hands, all would score 0
    - (shouldn't happen in normal play)
  })
})

describe('updateTotalScores', () => {
  describe('first round (starting from 0)', () => {
    given: all players start with totalScore: 0
    and: round scores are { p1: 0, p2: 25, p3: 40 }
    when: updateTotalScores called
    then: total scores = { p1: 0, p2: 25, p3: 40 }
  })

  describe('subsequent rounds (accumulation)', () => {
    given: total scores are { p1: 10, p2: 50, p3: 30 }
    and: round scores are { p1: 0, p2: 15, p3: 25 }
    when: updateTotalScores called
    then: total scores = { p1: 10, p2: 65, p3: 55 }
  })

  describe('accumulation over multiple rounds', () => {
    round 1: { p1: 0, p2: 30, p3: 45 } → totals: { p1: 0, p2: 30, p3: 45 }
    round 2: { p1: 25, p2: 0, p3: 60 } → totals: { p1: 25, p2: 30, p3: 105 }
    round 3: { p1: 15, p2: 40, p3: 0 } → totals: { p1: 40, p2: 70, p3: 105 }
    round 4: { p1: 0, p2: 20, p3: 35 } → totals: { p1: 40, p2: 90, p3: 140 }
    round 5: { p1: 50, p2: 0, p3: 10 } → totals: { p1: 90, p2: 90, p3: 150 }
    round 6: { p1: 0, p2: 30, p3: 25 } → totals: { p1: 90, p2: 120, p3: 175 }
  })

  describe('player scores only increase', () => {
    - scores can only go up (or stay same if went out)
    - no mechanism to reduce total score
    - going out = 0 points added, not subtraction
  })
})

describe('determineWinner', () => {
  describe('single winner (lowest score)', () => {
    given: final scores { p1: 120, p2: 85, p3: 200 }
    then: winners = [p2]
    and: p2 has lowest score (85)
  })

  describe('clear winner examples', () => {
    - { p1: 0, p2: 100, p3: 200 } → winner: [p1]
    - { p1: 50, p2: 51, p3: 52 } → winner: [p1]
    - { p1: 300, p2: 150, p3: 299 } → winner: [p2]
  })

  describe('two-way tie - both win', () => {
    given: final scores { p1: 100, p2: 100, p3: 150 }
    then: winners = [p1, p2]
    and: both tied for lowest
    and: both are considered winners
  })

  describe('three-way tie - all win', () => {
    given: final scores { p1: 80, p2: 80, p3: 80 }
    then: winners = [p1, p2, p3]
    and: all three win
  })

  describe('tie not for first place', () => {
    given: final scores { p1: 50, p2: 100, p3: 100 }
    then: winners = [p1]
    and: p2 and p3 tied for second place
    and: only p1 is winner
  })

  describe('tie for second doesn\'t affect winner', () => {
    given: final scores { p1: 75, p2: 80, p3: 80, p4: 100 }
    then: winners = [p1]
    and: p2/p3 tie is irrelevant
  })

  describe('perfect game - zero total', () => {
    given: player went out all 6 rounds
    then: total score = 0
    and: this is the best possible score
    and: guaranteed winner (or co-winner if tied)
  })

  describe('return type', () => {
    - always returns array of player IDs
    - array length >= 1
    - single winner: array of 1
    - tie: array of 2+
    - order in array doesn't matter (or alphabetical by ID)
  })
})

describe('scoring edge cases', () => {
  describe('all players tie', () => {
    given: all players have same total score
    then: all players win
  })

  describe('very high scores', () => {
    given: player stuck in round 6 with many cards
    and: round ends with 15+ cards in hand
    then: score could be 200+ for single round
    and: calculation handles large values correctly
  })

  describe('zero score for multiple rounds', () => {
    given: player went out in rounds 1, 2, and 3
    and: scored points in rounds 4, 5, 6
    then: total = 0 + 0 + 0 + r4 + r5 + r6
    and: accumulated correctly
  })
})
```

### `core/engine/roundEnd.test.ts`

```
describe('round end trigger', () => {
  describe('triggered by going out', () => {
    - when any player goes out, round ends immediately
    - no more turns for remaining players
    - current turn completes (wentOut state), then round ends
    - doesn't matter whose turn it was
  })

  describe('not triggered by other events', () => {
    - normal turn completion does not end round
    - laying down does not end round
    - laying off does not end round
    - only going out (0 cards) ends round
  })
})

describe('round end processing', () => {
  describe('sequence of operations', () => {
    1. Identify winner (player who went out)
    2. Calculate each player's hand score
    3. Create RoundRecord
    4. Update total scores
    5. Add record to roundHistory
    6. Determine next action (next round or game end)
  })

  describe('all players scored', () => {
    - winner scores 0
    - all other players score their hand values
    - no player skipped
  })
})

describe('RoundRecord', () => {
  describe('structure', () => {
    - roundNumber: 1-6
    - scores: map of playerId → round score
    - winnerId: player who went out
  })

  describe('example records', () => {
    round 1: {
      roundNumber: 1,
      scores: { p1: 0, p2: 35, p3: 42 },
      winnerId: 'p1'
    }
  })

  describe('storage in roundHistory', () => {
    - roundHistory starts as empty array
    - each round adds one RoundRecord
    - after round 1: roundHistory.length === 1
    - after round 6: roundHistory.length === 6
    - records in order by round number
  })

  describe('reconstructing game from history', () => {
    - can calculate any player's score at any point
    - can identify who won each round
    - full audit trail of game
  })
})

describe('round transition - to next round', () => {
  describe('when rounds 1-5 end', () => {
    given: round N ends (where N < 6)
    then: game continues to round N+1
    and: currentRound increments
  })

  describe('state reset for new round', () => {
    - all players' isDown reset to false
    - all players' hands cleared
    - table cleared (no melds)
    - turnState reset
  })

  describe('dealer rotation', () => {
    - dealerIndex advances by 1 (clockwise/left)
    - wraps around: if dealer was last player, becomes first
    - example: 4 players, dealer 2 → dealer 3 → dealer 0 → dealer 1
  })

  describe('first player', () => {
    - currentPlayerIndex = (dealerIndex + 1) % playerCount
    - first player is left of dealer
    - same as initial deal order
  })

  describe('new deck and deal', () => {
    - new deck created (appropriate for player count)
    - deck shuffled
    - 11 cards dealt to each player
    - one card flipped to start discard pile
    - remaining cards become stock
  })

  describe('scores preserved', () => {
    - totalScore for each player unchanged by round transition
    - only roundHistory and individual round scores added
  })
})

describe('round transition - to game end', () => {
  describe('after round 6', () => {
    given: round 6 ends
    then: game does not continue to round 7
    and: game phase becomes 'gameEnd'
  })

  describe('game end state', () => {
    - final scores calculated (already done via accumulation)
    - winner(s) determined
    - game is complete
    - no more actions possible
  })
})

describe('state reset details', () => {
  describe('player state reset', () => {
    - isDown: false (every player)
    - hand: new 11 cards from deal
    - totalScore: preserved (NOT reset)
    - laidDownThisTurn: false
  })

  describe('game state reset', () => {
    - table: [] (empty, no melds)
    - stock: shuffled deck minus 45 dealt cards (for 4 players) minus 1 discard
    - discard: [1 flipped card]
    - currentRound: previous + 1
    - dealerIndex: (previous + 1) % playerCount
    - currentPlayerIndex: (new dealerIndex + 1) % playerCount
  })

  describe('turn state reset', () => {
    - hasDrawn: false
    - laidDownThisTurn: false
    - current turn machine in initial state
  })
})
```

### `core/engine/turnMachine.test.ts` (Phase 4 additions)

```
describe('TurnMachine - drawn state with lay off', () => {
  describe('LAY_OFF availability', () => {
    - available when isDown: true AND laidDownThisTurn: false AND hasDrawn: true
    - NOT available when isDown: false (not down)
    - NOT available when laidDownThisTurn: true (just laid down)
    - NOT available when hasDrawn: false (haven't drawn yet)
  })

  describe('state after LAY_OFF', () => {
    - remains in 'drawn' state after LAY_OFF
    - can issue another LAY_OFF command
    - can issue DISCARD command (rounds 1-5)
    - can issue END_TURN command (round 6)
    - hasDrawn remains true
    - isDown remains true
  })

  describe('multiple lay offs', () => {
    - lay off first card → still in 'drawn'
    - lay off second card → still in 'drawn'
    - lay off third card → still in 'drawn'
    - unlimited lay offs allowed per turn
    - limited only by cards in hand and valid targets
  })
})

describe('TurnMachine - wentOut state', () => {
  describe('transition to wentOut (rounds 1-5)', () => {
    given: player is in 'awaitingDiscard' state
    and: player has 1 card in hand
    when: player discards that card
    then: hand becomes empty
    and: state transitions to 'wentOut' (not 'turnComplete')
  })

  describe('transition to wentOut (round 6)', () => {
    given: round 6, player is in 'drawn' state
    and: player has 1 card in hand
    when: player lays off that card
    then: hand becomes empty
    and: state transitions to 'wentOut'
  })

  describe('wentOut is final state', () => {
    - no commands accepted in wentOut state
    - cannot draw, discard, lay off, etc.
    - turn machine terminates
  })

  describe('wentOut output', () => {
    - output.wentOut === true
    - output.playerId === current player's id
    - output.hand === [] (empty array)
    - distinct from turnComplete output where wentOut === false
  })
})

describe('TurnMachine - turnComplete vs wentOut', () => {
  describe('turnComplete output', () => {
    - wentOut: false
    - playerId: current player
    - hand: remaining cards (length >= 1 in rounds 1-5)
    - normal turn ending
  })

  describe('wentOut output', () => {
    - wentOut: true
    - playerId: current player
    - hand: [] empty
    - triggers round end
  })

  describe('parent machine behavior', () => {
    - on turnComplete → advance to next player's turn
    - on wentOut → transition to round scoring
  })
})

describe('TurnMachine - round 6 specific behavior', () => {
  describe('DISCARD not available', () => {
    - in round 6, DISCARD command always rejected
    - rejected in 'awaitingDraw' state
    - rejected in 'drawn' state
    - rejected in any state
    - error: "no discarding allowed in round 6"
  })

  describe('no awaitingDiscard state in round 6', () => {
    - turn flow: awaitingDraw → drawn → (wentOut OR turnComplete)
    - skips awaitingDiscard entirely
    - after drawing, player can lay off or end turn
  })

  describe('state transitions in round 6', () => {
    from 'awaitingDraw':
      - DRAW_FROM_STOCK → 'drawn'
      - DRAW_FROM_DISCARD → 'drawn'

    from 'drawn':
      - LAY_OFF (if valid) → stay in 'drawn'
      - LAY_DOWN (if valid) → stay in 'drawn' (then must end turn)
      - hand empty → 'wentOut'
      - END_TURN (or no valid moves) → 'turnComplete'
      - DISCARD → rejected
  })

  describe('END_TURN command in round 6', () => {
    - explicitly ends turn without discarding
    - only valid in round 6
    - only valid in 'drawn' state
    - player keeps remaining cards
    - transitions to 'turnComplete'
  })

  describe('automatic turn end detection', () => {
    - if player has cards but no valid lay offs available
    - system could auto-detect "stuck" state
    - or player must explicitly END_TURN
    - implementation detail TBD
  })
})

describe('TurnMachine - going out detection', () => {
  describe('rounds 1-5: checked after discard or lay off', () => {
    - after DISCARD command processes
    - OR after LAY_OFF command processes
    - check if hand.length === 0
    - if yes → wentOut
    - if no → proceed (to turnComplete if discard, or stay in 'drawn' if lay off)
  })

  describe('round 6: checked after lay off', () => {
    - after each LAY_OFF command processes
    - check if hand.length === 0
    - if yes → wentOut
    - if no → remain in 'drawn', can continue
  })

  describe('checked after GO_OUT (any round)', () => {
    - GO_OUT processes all finalLayOffs
    - then checks hand.length
    - should be 0 (validated before execution)
    - transitions to wentOut
  })
})

describe('TurnMachine - player not down behavior', () => {
  describe('rounds 1-5, not down', () => {
    - can draw (DRAW_FROM_STOCK or DRAW_FROM_DISCARD)
    - can lay down (if have contract)
    - cannot lay off
    - must discard to end turn
    - flow: awaitingDraw → drawn → awaitingDiscard → turnComplete
  })

  describe('round 6, not down', () => {
    - can draw
    - can lay down (if have contract)
    - cannot lay off
    - CANNOT discard
    - must END_TURN if can't lay down
    - hand grows each turn until can lay down
  })

  describe('round 6, not down, hand growth', () => {
    turn 1: 11 cards → draw → 12 cards → can't lay down → END_TURN with 12
    turn 2: 12 cards → draw → 13 cards → can't lay down → END_TURN with 13
    turn 3: 13 cards → draw → 14 cards → maybe can lay down now?
    - this continues until player has enough cards for contract
    - or until another player goes out
  })
})
```

### `core/engine/integration.test.ts` (Phase 4)

```
describe('complete lay off turn flow', () => {
  describe('single lay off', () => {
    given: player is down from previous turn, has 5 cards
    and: table has set (9♣ 9♦ 9♥)
    and: player has 9♠ in hand
    when: player draws from stock (6 cards)
    and: player lays off 9♠ to the set (5 cards)
    and: player discards one card (4 cards)
    then: set is now (9♣ 9♦ 9♥ 9♠)
    and: player has 4 cards
    and: turn completes (wentOut: false)
  })

  describe('multiple lay offs', () => {
    given: player is down, has 4 cards: 9♠, 4♦, K♥, 3♣
    and: table has set of 9s, diamond run starting at 5, set of kings
    when: player draws (5 cards)
    and: player lays off 9♠ to set of 9s
    and: player lays off 4♦ to diamond run
    and: player lays off K♥ to set of kings
    and: player discards 3♣
    then: player has 1 card (the drawn card)
    and: three melds extended
    and: turn completes normally
  })

  describe('laying off to other player\'s meld', () => {
    given: player 1 owns set (K♣ K♦ K♥)
    and: player 2 is down, has K♠
    when: player 2's turn
    and: player 2 draws
    and: player 2 lays off K♠ to player 1's set
    then: set is (K♣ K♦ K♥ K♠)
    and: set still owned by player 1
    and: player 2's hand reduced by 1
  })

  describe('laying off wild to meld', () => {
    given: table has run (5♠ 6♠ 7♠ 8♠)
    and: player has Joker
    when: player lays off Joker to high end of run
    then: run is (5♠ 6♠ 7♠ 8♠ Joker)
    and: Joker represents 9♠
    and: run now has 4 natural, 1 wild
  })

  describe('cannot lay off immediately after laying down', () => {
    given: player is not down, has contract cards
    when: player draws
    and: player lays down contract (becomes down)
    and: player tries to lay off extra card
    then: lay off rejected (laidDownThisTurn: true)
    and: player must discard to end turn (unless hand is empty)
    and: can lay off next turn
  })
})

describe('going out scenarios - rounds 1-5', () => {
  describe('going out via lay off + discard', () => {
    given: round 3, player is down, has 2 cards
    when: player draws (3 cards)
    and: player lays off 2 cards to melds (1 card remaining)
    and: player discards last card
    then: player has 0 cards
    and: player went out
  })

  describe('going out via lay off only (no discard)', () => {
    given: round 3, player is down, has 2 cards
    when: player draws (3 cards)
    and: player lays off all 3 cards to melds (0 cards remaining)
    then: player has 0 cards
    and: player went out immediately
    and: no discard occurred
  })

  describe('going out on lay down turn (no discard)', () => {
    given: round 1, player has 6 cards (two 3-card sets possible)
    when: player draws (7 cards)
    and: player lays down 7 cards in two sets (one of 3, one of 4)
    then: player has 0 cards
    and: player went out immediately
    and: no discard occurred
  })

  describe('going out with just discard', () => {
    given: round 2, player is down, has 1 card
    when: player draws (2 cards)
    and: player lays off one card (1 card remaining)
    and: player discards last card
    then: player went out
  })
})

describe('going out scenarios - round 6', () => {
  describe('going out by laying off all cards', () => {
    given: round 6, player is down, has 2 cards: 9♠, K♥
    and: table has set of 9s and set of kings
    when: player draws (3 cards: 9♠, K♥, 5♦)
    and: suppose 5♦ fits a diamond run
    and: player lays off 9♠
    and: player lays off K♥
    and: player lays off 5♦
    then: player has 0 cards
    and: player went out
    and: no discard occurred
  })

  describe('going out with GO_OUT command', () => {
    given: round 6, player has 3 layable cards
    when: player issues GO_OUT with finalLayOffs for all 3
    then: all 3 laid off atomically
    and: player went out
  })

  describe('stuck in round 6 - cannot go out', () => {
    given: round 6, player is down, has 3 cards after drawing
    and: only 1 card can be laid off
    when: player lays off that card (2 remaining)
    and: remaining cards fit no meld
    then: player cannot lay off more
    and: player cannot discard (round 6)
    and: player ends turn with 2 cards
    and: did NOT go out
  })

  describe('hand growing in round 6 when stuck', () => {
    given: round 6, player is down with unlayable cards
    and: player has 3 cards
    when: turn 1: draws (4), can't lay off, ends with 4
    and: turn 2: draws (5), can't lay off, ends with 5
    and: turn 3: draws (6), still stuck, ends with 6
    then: hand grew to 6 cards
    and: waiting for melds to expand or lucky draws
  })

  describe('round 6 not down - hand grows faster', () => {
    given: round 6, player not down, has 11 cards
    when: turn 1: draws (12), can't lay down, can't discard, ends with 12
    and: turn 2: draws (13), can't lay down, ends with 13
    and: turn 3: draws (14), NOW can lay down contract!
    and: player lays down
    then: player is now down
    and: can start laying off on future turns
  })
})

describe('scoring integration', () => {
  describe('round end scoring flow', () => {
    given: 3 players
    and: player 1 goes out
    and: player 2 has (J♥, Q♦) in hand
    and: player 3 has (A♠, Joker, 5♣) in hand
    when: round ends
    then: p1 round score = 0
    and: p2 round score = 10 + 10 = 20
    and: p3 round score = 15 + 50 + 5 = 70
    and: roundRecord created with these scores
    and: totalScores updated
  })

  describe('total score accumulation', () => {
    given: after round 3, scores are { p1: 45, p2: 60, p3: 30 }
    and: round 4 ends with { p1: 0, p2: 25, p3: 55 }
    then: new totals = { p1: 45, p2: 85, p3: 85 }
    and: p2 and p3 now tied
  })

  describe('determining winner after round 6', () => {
    given: final totals { p1: 150, p2: 85, p3: 120 }
    then: p2 wins with lowest score
    and: game ends
  })

  describe('tie for winner', () => {
    given: final totals { p1: 100, p2: 100, p3: 150 }
    then: p1 and p2 both win
    and: both have lowest score (100)
  })
})

describe('edge cases', () => {
  describe('going out immediately in round 1', () => {
    given: round 1, player dealt perfect hand for 2 large sets + 1 extra
    example: (9♣ 9♦ 9♥ 9♠) + (K♣ K♦ K♥ K♠) + (3♣) = 9 cards, need 11
    actually: 11 cards = 4-card set + 4-card set + 3 extras
    when: player draws (12 cards)
    and: player lays down 8 cards (4+4)
    and: player has 4 cards left
    and: player discards 1 (3 left)
    then: did NOT go out (3 cards remaining)
    note: hard to go out round 1, need huge melds
  })

  describe('laying off wild breaks ratio - rejected', () => {
    given: meld (9♣ 9♦ Joker 2♥) — 2 natural, 2 wild
    when: player tries to lay off another Joker
    then: would become 2 natural, 3 wild
    and: rejected (wilds would outnumber)
  })

  describe('perfect game - zero total score', () => {
    given: player went out in all 6 rounds
    then: total score = 0 + 0 + 0 + 0 + 0 + 0 = 0
    and: player wins
    and: best possible outcome
  })

  describe('worst case round 6 scoring', () => {
    given: round 6, player stuck with many cards when someone else goes out
    example: 15 cards including 2 Jokers, 3 Aces, face cards
    then: score could be 100+ points for single round
    and: devastating to total score
  })

  describe('stock depletion during round', () => {
    given: many May I calls or long round
    when: stock runs out
    then: flip discard pile (keep top card) to form new stock
    and: round continues
    note: full implementation may be Phase 5 or later
  })
})
```
