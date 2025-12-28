Let me re-read the rules carefully for laying off, going out, and scoring.Now let me also double-check the glossary for any additional details:---

## Phase 4: Laying Off + Going Out + Scoring — Comprehensive Test Descriptions

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
    - invalid: adding wrong rank (10♣ to 9♦ 9♥ 9♠)
    - invalid: adding wild if it would make wilds outnumber naturals
      - set is (9♦ 9♥ Joker) — 2 natural, 1 wild
      - adding 2♣ would make it 2 natural, 2 wild — still valid (equal)
      - set is (9♦ Joker 2♣) — 1 natural, 2 wild... wait, this shouldn't exist
      - actually: can't have invalid meld on table, so wilds never outnumber already
    - edge: adding to set that already has equal wilds/naturals
      - set (9♦ 9♥ Joker 2♣) — 2 natural, 2 wild
      - adding 9♣ (natural) → 3 natural, 2 wild — valid
      - adding Joker → 2 natural, 3 wild — INVALID
  })

  describe('laying off to runs', () => {
    - valid: extending run at low end (4♠ to 5♠ 6♠ 7♠ 8♠)
    - valid: extending run at high end (9♠ to 5♠ 6♠ 7♠ 8♠)
    - valid: adding wild at either end (Joker to 5♠ 6♠ 7♠ 8♠)
    - invalid: card doesn't connect (10♠ to 5♠ 6♠ 7♠ 8♠) — gap
    - invalid: wrong suit (4♥ to 5♠ 6♠ 7♠ 8♠)
    - invalid: card already in run by rank (6♠ to 5♠ 6♠ 7♠ 8♠) — duplicate rank
    - invalid: extending below 3 (need to extend 3♠ 4♠ 5♠ 6♠ — nothing below 3)
    - invalid: extending above A (need to extend J♠ Q♠ K♠ A♠ — nothing above A)
    - invalid: adding wild if it would make wilds outnumber naturals
  })

  describe('run extension boundaries', () => {
    - run (3♦ 4♦ 5♦ 6♦) can only extend high (add 7♦)
    - run (J♥ Q♥ K♥ A♥) can only extend low (add 10♥)
    - run (3♠ 4♠ 5♠ 6♠ 7♠ 8♠ 9♠ 10♠ J♠ Q♠ K♠ A♠) cannot extend at all
    - wild can extend run at valid end only
  })

  describe('run with wilds - extension', () => {
    - run (5♠ Joker 7♠ 8♠) can extend with 4♠ at low end
    - run (5♠ Joker 7♠ 8♠) can extend with 9♠ at high end
    - run (5♠ Joker 7♠ 8♠) — adding another wild: 2 natural + 2 wild = valid
    - run (5♠ Joker 7♠ 2♣) — already 2 natural, 2 wild
      - adding natural: 3 natural, 2 wild — valid
      - adding wild: 2 natural, 3 wild — INVALID
  })

  describe('card ownership', () => {
    - card must be in player's hand
    - cannot lay off card you don't have
    - cannot lay off card from another player's hand
    - cannot lay off card already on table
  })

  describe('meld ownership', () => {
    - can lay off to your own melds
    - can lay off to other players' melds
    - meld ownership doesn't restrict who can add to it
  })
})

describe('LAY_OFF action', () => {
  describe('successful lay off to set', () => {
    - removes card from player's hand
    - adds card to target meld's cards array
    - meld remains type: 'set'
    - meld ownerId unchanged (original owner keeps credit)
    - hand size decreases by 1
    - player remains in 'drawn' state (can lay off more)
  })

  describe('successful lay off to run', () => {
    - removes card from player's hand
    - adds card to correct position in run (sorted order)
    - meld remains type: 'run'
    - adding to low end: card becomes first in array
    - adding to high end: card becomes last in array
  })

  describe('multiple lay offs in one turn', () => {
    - player can lay off first card, then lay off second card
    - each lay off is separate command
    - hand decreases with each lay off
    - can lay off to different melds
    - can lay off multiple cards to same meld (one at a time)
  })

  describe('state transitions', () => {
    - after LAY_OFF, remains in 'drawn' state
    - can continue to lay off more cards
    - can proceed to DISCARD after any number of lay offs
    - can proceed to discard with 0 lay offs
  })
})

describe('LAY_OFF rejection', () => {
  describe('player state rejections', () => {
    - rejected if player not down (isDown: false)
    - rejected if player laid down this turn
    - rejected if player hasn't drawn yet
    - state unchanged on rejection
    - hand unchanged on rejection
    - clear error message returned
  })

  describe('invalid card/meld rejections', () => {
    - rejected if cardId not in player's hand
    - rejected if meldId doesn't exist on table
    - rejected if card doesn't fit meld
    - rejected if lay off would break wild ratio
  })
})
```

### `core/engine/goingOut.test.ts`

```
describe('going out - rounds 1-5', () => {
  describe('detection', () => {
    - player goes out when they discard their last card
    - after discard, hand.length === 0 triggers going out
    - only checked after DISCARD command
    - does not trigger during lay off (even if hand becomes empty mid-layoff... wait, can that happen?)
  })

  describe('sequence to go out', () => {
    given: player is down, has 3 cards after drawing
    when: player lays off 2 cards (1 card remaining)
    and: player discards last card
    then: player went out
    and: round ends
  })

  describe('must discard to go out', () => {
    given: player is down, has 2 cards after drawing
    when: player lays off 1 card (1 card remaining)
    then: player has NOT gone out yet
    and: player must discard to go out
    when: player discards last card
    then: now player has gone out
  })

  describe('cannot go out if not down', () => {
    given: player is not down, has 1 card after drawing
    when: player discards last card
    then: player has gone out? NO — wait...
    actually: can you go out if you're not down? Let me think...
    rules say: "Play cards (lay off, use wilds, etc.)" implies you're down
    but technically: if not down, you can't lay off, so you just draw and discard
    if you discard your last card while not down: is that going out?
    I think YES — you can go out even if not down, you just couldn't lay off
    edge case: player never laid down, but discards last card = round ends
  })

  describe('turn output when going out', () => {
    - turn output includes wentOut: true
    - turn output includes playerId of winner
    - different from normal turnComplete output
    - triggers round end processing
  })
})

describe('going out - round 6 special rules', () => {
  describe('no discard allowed', () => {
    - in round 6, going out requires 0 cards without discarding
    - DISCARD command behavior changes? Or GO_OUT command?
    - player must lay off until hand is empty
    - last card(s) must be played to melds
  })

  describe('GO_OUT command', () => {
    - only available in round 6
    - only available when player is down
    - can include final lay offs to reach 0 cards
    - rejected if would leave cards in hand
  })

  describe('going out via lay off', () => {
    given: round 6, player is down, has 2 cards
    when: player draws (3 cards)
    and: player lays off all 3 cards to valid melds
    then: hand is empty
    and: player has gone out
    and: no discard required
  })

  describe('going out with single card', () => {
    given: round 6, player is down, has 1 card after drawing
    when: player lays off that card
    then: player goes out with 0 cards
    and: no discard
  })

  describe('cannot discard in round 6 to go out', () => {
    given: round 6, player has 1 card
    when: player tries to DISCARD
    then: rejected? or allowed but doesn't end round?
    rules say: "you do not discard on this final out play"
    interpretation: if you're going out, you can't discard
    but if you're NOT going out this turn, can you discard?
    I think: you CAN discard if you still have cards after
    but you CANNOT discard your last card — must lay it off
  })

  describe('round 6 with multiple cards to lay off', () => {
    given: round 6, player has 4 cards after drawing
    when: player lays off card 1 (3 remaining)
    and: player lays off card 2 (2 remaining)
    and: player lays off card 3 (1 remaining)
    and: player lays off card 4 (0 remaining)
    then: player goes out
    and: no discard needed
  })

  describe('round 6 cannot go out - stuck with unlayable cards', () => {
    given: round 6, player has 2 cards that cannot be laid off
    when: player draws (3 cards)
    and: player lays off 1 card
    and: remaining 2 cards don't fit any meld
    then: player cannot go out this turn
    and: player must... what? Can they discard one?
    rules: "you do not discard on this final out play"
    interpretation: if you CAN'T go out, you CAN discard normally
    so: player discards, turn ends, they still have 1 card
  })

  describe('round 6 normal turn (not going out)', () => {
    given: round 6, player is down, has 4 cards
    when: player draws (5 cards)
    and: player lays off 2 cards (3 remaining)
    and: player cannot lay off remaining cards
    then: player can discard 1 card
    and: ends turn with 2 cards
    and: has NOT gone out
  })
})

describe('going out - edge cases', () => {
  describe('going out immediately after laying down', () => {
    - cannot happen in rounds 1-5 (must discard after lay down)
    - round 1-5: lay down leaves at least 1 card, must discard = 0 cards... wait
    - actually: if you lay down and have exactly 1 card left, you discard it = go out
    given: round 1, player has 8 cards
    when: player draws (9 cards)
    and: player lays down 2 sets (6 cards minimum, say exactly 6)
    and: player has 3 cards left
    and: player discards 1 card (2 remaining)
    then: player has NOT gone out (2 cards left)

    given: round 1, player has 7 cards
    when: player draws (8 cards)
    and: player lays down 2 sets (6 cards) + has exactly 2 left
    and: player discards 1
    then: player has 1 card, NOT out

    to go out on lay down turn: need to lay down and have exactly 1 card left to discard
    given: 7 cards, draw = 8, lay down 7 (large melds), discard 1 = 0 = OUT
    this IS possible with larger melds
  })

  describe('going out with large lay down', () => {
    given: player has cards to make large melds totaling 11 cards
    example: round 1, two sets of 4 cards each = 8 cards
    when: player draws (12 cards)
    and: player lays down 8 cards in two 4-card sets
    and: player has 4 cards left
    and: player discards 1
    then: 3 cards remaining, not out

    max lay down: round 6, 1 set + 2 runs
    if all maximum size... unlikely to go out on lay down turn
  })

  describe('going out on first turn', () => {
    given: player dealt 11 cards that form perfect contract + 1 extra
    when: player's first turn, draws (12 cards)
    and: 12 - contract = few cards
    scenario: round 6, contract = 11 minimum (3+4+4)
    12 - 11 = 1 card... but round 6 no discard!
    so: cannot go out on first turn in round 6 with minimum contract
    but: if contract uses 12 cards (larger melds), 0 left = go out!
  })

  describe('player not down going out', () => {
    given: player never laid down (isDown: false)
    and: player has 1 card
    when: player draws (2 cards)
    and: player discards (1 card)
    then: player has 1 card, NOT out

    to go out not down: would need 0 cards after discard
    but can't lay off if not down
    so must start turn with 1 card, draw, discard = 1 card left
    CANNOT go out if not down... unless you had 0 cards somehow (impossible)
    wait: start with 1 card, draw = 2, discard = 1. Always have 1 card.
    actually: if not down and have 1 card, you draw to 2, discard to 1. Can't reach 0.
    so: you CAN'T go out if you're not down (except round 6 where you must lay off)

    hmm wait, let me reconsider...
    if somehow player is not down with 1 card:
    - draws to 2
    - cannot lay down (doesn't have contract? or could they?)
    - cannot lay off (not down)
    - discards to 1
    they can never reach 0 without being down (need to lay off)

    UNLESS: they lay down this turn leaving 1 card (but can't lay off same turn)
    then discard = 0 cards = go out!
  })
})
```

### `core/engine/scoring.test.ts`

```
describe('calculateHandScore', () => {
  describe('empty hand', () => {
    - returns 0 for empty hand (went out)
  })

  describe('number cards', () => {
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
  })

  describe('special cards', () => {
    - A♠ = 15 points
    - 2♥ = 2 points (low value despite being wild)
    - Joker = 50 points (high risk!)
  })

  describe('hand totals', () => {
    - (3♥) = 3
    - (3♥, 4♦) = 7
    - (J♥, Q♦, K♣) = 30
    - (A♠, A♥) = 30
    - (Joker) = 50
    - (Joker, Joker) = 100
    - (Joker, Joker, Joker) = 150 (worst case with 3 Jokers)
  })

  describe('realistic end-of-round hands', () => {
    - (3♥, 5♦, 9♣, J♠) = 3 + 5 + 9 + 10 = 27
    - (A♦, K♥, Q♠, Joker) = 15 + 10 + 10 + 50 = 85
    - (2♣, 2♦, 2♥) = 2 + 2 + 2 = 6 (all wilds but low points)
    - (7♥, 8♥, 9♥, 10♥) = 7 + 8 + 9 + 10 = 34 (almost a run!)
  })

  describe('maximum possible score', () => {
    - 11 cards all Jokers = 550 points (theoretical max per round)
    - realistic bad hand: several face cards + Jokers
  })
})

describe('calculateRoundScores', () => {
  describe('basic scoring', () => {
    - player who went out gets 0 points
    - other players get sum of their hand values
    - returns map of playerId → score
  })

  describe('multi-player scenario', () => {
    given: player 1 went out, player 2 has (J♥), player 3 has (A♠, 5♦)
    then: scores = { p1: 0, p2: 10, p3: 20 }
  })

  describe('all players scored', () => {
    - every player in game has a score entry
    - no missing players
    - no extra players
  })
})

describe('updateTotalScores', () => {
  describe('first round', () => {
    given: no previous scores (all 0)
    when: round scores are { p1: 0, p2: 25, p3: 40 }
    then: total scores = { p1: 0, p2: 25, p3: 40 }
  })

  describe('subsequent rounds', () => {
    given: total scores are { p1: 10, p2: 50, p3: 30 }
    when: round scores are { p1: 0, p2: 15, p3: 25 }
    then: total scores = { p1: 10, p2: 65, p3: 55 }
  })

  describe('accumulation over 6 rounds', () => {
    - scores accumulate each round
    - player with lowest total after round 6 wins
    - ties possible (decide by rule: both win? or tiebreaker?)
  })
})

describe('determineWinner', () => {
  describe('after round 6', () => {
    given: final scores { p1: 120, p2: 85, p3: 200 }
    then: winner is p2 (lowest score)
  })

  describe('tie for lowest', () => {
    given: final scores { p1: 100, p2: 100, p3: 150 }
    then: p1 and p2 are tied
    and: both are winners? or tiebreaker needed?
  })

  describe('zero total score', () => {
    given: player went out every round
    then: total score is 0
    and: this player wins (best possible)
  })
})
```

### `core/engine/roundEnd.test.ts`

```
describe('round end trigger', () => {
  describe('triggered by going out', () => {
    - when player goes out, round ends immediately
    - no more turns for other players
    - current turn completes, then round ends
  })

  describe('round end processing', () => {
    - calculate score for each player based on hand
    - update total scores
    - record round result in roundHistory
    - prepare for next round (or game end)
  })
})

describe('RoundRecord', () => {
  describe('structure', () => {
    - roundNumber: 1-6
    - scores: map of playerId → round score
    - winnerId: player who went out
  })

  describe('storage in roundHistory', () => {
    - each round adds one RoundRecord
    - roundHistory grows from 0 to 6 entries
    - can reconstruct score progression from history
  })
})

describe('round transition', () => {
  describe('to next round', () => {
    given: round 1-5 ends
    then: currentRound increments
    and: dealerIndex advances (left)
    and: all players' isDown resets to false
    and: all players' hands cleared
    and: table cleared (no melds)
    and: new deck shuffled and dealt
  })

  describe('to game end', () => {
    given: round 6 ends
    then: game phase becomes 'gameEnd'
    and: final scores calculated
    and: winner determined
  })
})

describe('state reset for new round', () => {
  describe('player state', () => {
    - isDown: false for all players
    - hand: new 11 cards dealt
    - totalScore: preserved from previous rounds
  })

  describe('game state', () => {
    - table: empty (no melds)
    - stock: fresh shuffled deck minus dealt cards
    - discard: single flipped card from stock
    - currentRound: incremented
    - dealerIndex: advanced by 1 (wrapping)
    - currentPlayerIndex: left of new dealer
  })
})
```

### `core/engine/turnMachine.test.ts` (Phase 4 additions)

```
describe('TurnMachine - wentOut state', () => {
  describe('transition to wentOut', () => {
    - from 'awaitingDiscard' → 'wentOut' when discard leaves 0 cards (rounds 1-5)
    - from 'drawn' → 'wentOut' when lay off leaves 0 cards (round 6)
    - wentOut is a final state
  })

  describe('wentOut output', () => {
    - wentOut: true
    - playerId: current player
    - hand: empty array
    - triggers round end in parent machine
  })

  describe('turnComplete vs wentOut', () => {
    - turnComplete: wentOut: false, normal turn end
    - wentOut: wentOut: true, round ends
    - both are final states
    - distinguished by wentOut flag in output
  })
})

describe('TurnMachine - round 6 behavior', () => {
  describe('GO_OUT command', () => {
    - available only in round 6
    - available only when player is down
    - can include finalLayOffs array
    - each lay off validated
    - all lay offs executed in order
    - player must end with 0 cards
  })

  describe('GO_OUT with final lay offs', () => {
    given: player has 3 cards that all can be laid off
    when: GO_OUT { finalLayOffs: [layoff1, layoff2, layoff3] }
    then: all three cards laid off
    and: hand is empty
    and: transitions to wentOut
  })

  describe('GO_OUT rejected', () => {
    - rejected if not round 6
    - rejected if player not down
    - rejected if any lay off invalid
    - rejected if cards remain after lay offs
    - state unchanged on rejection
  })

  describe('discarding in round 6 when not going out', () => {
    given: round 6, player has 4 cards
    and: player can only lay off 2
    when: player lays off 2 cards (2 remaining)
    then: player can DISCARD (not going out)
    and: ends turn with 1 card
    and: does NOT go out
  })

  describe('cannot discard last card in round 6', () => {
    given: round 6, player has 1 card
    and: player cannot lay it off
    when: player tries to DISCARD
    then: rejected? or allowed?
    interpretation: if you have 1 card and it can't be laid off,
                   you're stuck — you CAN discard it (you're not "going out")
    actually: rules say no discard "when you go out" — if you can't go out, you can discard
    so: DISCARD is allowed, player ends with 0 cards but via discard not lay off
    wait: that would be going out by discarding, which is forbidden in round 6

    re-reading: "To go out, you must finish with no cards in your hand"
               "your last play must be laying a card (or cards) into melds"
               "You do not discard on this final out play"

    so: if you have 1 unlayable card, you CANNOT go out this turn
    you MUST discard... but then you have 0 cards via discard?

    I think the answer is: you can only discard if you have 2+ cards
    if you have 1 card that can't be laid off, you're stuck and must wait
    but how do you end your turn? You HAVE to do something...

    possible interpretations:
    a) you can discard and "not go out" but that's weird with 0 cards
    b) you cannot discard your last card in round 6, period
    c) if you can't lay off, you can discard even the last card (round continues)

    need clarification from user!
  })
})

describe('TurnMachine - drawn state with lay off', () => {
  describe('LAY_OFF available', () => {
    - available when isDown: true AND laidDownThisTurn: false
    - not available when isDown: false
    - not available when laidDownThisTurn: true
  })

  describe('multiple actions in drawn state', () => {
    - can LAY_OFF then LAY_OFF again
    - can LAY_OFF then READY_TO_DISCARD
    - can LAY_OFF then GO_OUT (round 6)
    - can skip LAY_OFF entirely
  })

  describe('state remains drawn after lay off', () => {
    - after LAY_OFF, still in 'drawn' state
    - can continue with more lay offs
    - turn not over until discard (or go out)
  })
})
```

### `core/engine/integration.test.ts` (Phase 4 additions)

```
describe('complete lay off turn flow', () => {
  describe('successful lay off turn', () => {
    given: player is down from previous turn, has 5 cards
    and: table has meld (9♣ 9♦ 9♥) that player can add to
    when: player draws (6 cards)
    and: player has 9♠ in hand
    and: player lays off 9♠ to the set (5 cards remaining)
    and: player discards (4 cards remaining)
    then: meld is now (9♣ 9♦ 9♥ 9♠)
    and: player has 4 cards
    and: turn completes normally
  })

  describe('laying off to other player meld', () => {
    given: player 1 laid down set (K♣ K♦ K♥)
    and: player 2 is down, has K♠ in hand
    when: player 2's turn
    and: player 2 lays off K♠ to player 1's set
    then: meld is (K♣ K♦ K♥ K♠)
    and: meld still owned by player 1
    and: player 2's hand reduced by 1
  })

  describe('multiple lay offs to multiple melds', () => {
    given: table has set (9♣ 9♦ 9♥) and run (5♠ 6♠ 7♠ 8♠)
    and: player has 9♠ and 4♠ in hand
    when: player lays off 9♠ to set
    and: player lays off 4♠ to run
    then: set is (9♣ 9♦ 9♥ 9♠)
    and: run is (4♠ 5♠ 6♠ 7♠ 8♠)
    and: player hand reduced by 2
  })
})

describe('going out scenarios', () => {
  describe('round 3: going out via discard', () => {
    given: round 3, player is down, has 2 cards (8♥, 3♦)
    and: table has run player can add 8♥ to
    when: player draws (3 cards)
    and: player lays off 8♥ (2 cards: drawn card + 3♦)
    and: player lays off drawn card if possible (1 card: 3♦)
    and: player discards 3♦
    then: player has 0 cards
    and: player went out
    and: round ends
  })

  describe('round 6: going out via lay off', () => {
    given: round 6, player is down, has 1 card (9♠)
    and: table has set (9♣ 9♦ 9♥)
    when: player draws (2 cards: 9♠ + new card)
    and: new card can also be laid off
    and: player lays off 9♠ (1 card remaining)
    and: player lays off new card (0 cards)
    then: player went out
    and: no discard occurred
    and: round ends
  })

  describe('cannot go out: unlayable cards', () => {
    given: round 6, player has cards that don't fit any meld
    when: player draws
    and: player cannot lay off any cards
    then: player must discard (if 2+ cards)
    or: player is stuck (if 1 card) — needs clarification
  })
})

describe('scoring integration', () => {
  describe('round end scoring', () => {
    given: player 1 goes out
    and: player 2 has (J♥, Q♦) = 20 points
    and: player 3 has (A♠, Joker) = 65 points
    when: round ends
    then: round scores = { p1: 0, p2: 20, p3: 65 }
    and: scores added to totals
    and: roundHistory updated
  })

  describe('full game scoring', () => {
    given: 6 rounds played
    and: each round recorded with scores
    then: total scores are sum of all round scores
    and: player with lowest total wins
  })
})

describe('edge cases', () => {
  describe('going out on lay down turn', () => {
    given: round 2, player has 8 cards
    and: player can form 1 set (3 cards) + 1 run (4 cards) = 7 cards
    when: player draws (9 cards)
    and: player lays down 7 cards (2 remaining)
    and: player cannot lay off (laidDownThisTurn)
    and: player discards (1 remaining)
    then: player has 1 card, did NOT go out

    to go out on lay down turn:
    need to lay down and have exactly 1 card left
    given: 7 cards, draw = 8, lay down 7, discard 1 = 0 = OUT!
    this requires laying down 7 cards (large melds)
  })

  describe('going out with lay down leaving 1 card', () => {
    given: player has 6 cards forming 2 large sets (4 + 3 = 7... no, 4+4=8)
    hmm, need exactly 8-1=7 cards in hand after draw, lay down 7, discard last
    round 1: player has 7 cards, draws to 8
    lays down: set of 4 (9♣ 9♦ 9♥ 9♠) + set of 3 (K♣ K♦ K♥) = 7 cards
    has 1 card left, discards = 0 cards = GOES OUT on lay down turn!
  })

  describe('laying off wild that breaks ratio', () => {
    given: meld (9♣ 9♦ 9♥ Joker) — 3 natural, 1 wild
    when: player tries to lay off 2♠ (another wild)
    then: would become 3 natural, 2 wild — still valid (3 >= 2)
    and: lay off succeeds

    given: meld (9♣ 9♦ Joker 2♥) — 2 natural, 2 wild
    when: player tries to lay off Joker
    then: would become 2 natural, 3 wild — INVALID
    and: lay off rejected
  })

  describe('player with 0 points entire game', () => {
    given: player went out in all 6 rounds
    then: total score = 0
    and: this player wins
    and: this is the best possible outcome
  })
})
```

---

**Questions I encountered while writing these:**

1. **Round 6 with 1 unlayable card** — If a player has exactly 1 card in round 6 that cannot be laid off to any meld, what happens? They can't go out (can't lay off), and they supposedly can't discard to go out. Can they still discard to end their turn (ending with 0 cards but NOT "going out")? Or are they stuck? This seems like a rare but possible edge case.

2. **Going out while not down** — My analysis suggests you effectively can't go out if you're not down (except by discarding on the same turn you lay down), since you can't lay off cards. Is this correct?

3. **Tie score at end of game** — What happens if two players tie for lowest total score after round 6? Both win? Some tiebreaker?

Ready for Phase 5 (Full Game Loop)?
