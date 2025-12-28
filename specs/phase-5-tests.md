Let me review the Implementation Plan and XState design for Phase 5.Now I have a clear picture. Let me write comprehensive Phase 5 tests.

---

## Phase 5: Full Game Loop — Comprehensive Test Descriptions

### `core/engine/gameMachine.test.ts`

```
describe('GameMachine - setup state', () => {
  describe('initial state', () => {
    - starts in 'setup' state
    - gameId is empty or generated
    - players array is empty
    - currentRound is 1
    - dealerIndex is 0
    - roundHistory is empty array
  })

  describe('ADD_PLAYER command', () => {
    - adds player to players array
    - player has id, name, hand: [], isDown: false, totalScore: 0
    - can add multiple players sequentially
    - players array grows with each ADD_PLAYER
    - remains in 'setup' state after adding player
  })

  describe('player limits', () => {
    - minimum 3 players required
    - maximum 8 players allowed
    - ADD_PLAYER rejected if already at 8 players
  })

  describe('START_GAME command', () => {
    - requires minimum 3 players (guard: hasMinPlayers)
    - rejected if fewer than 3 players
    - transitions to 'playing' state when valid
    - triggers initializePlayers action
  })

  describe('START_GAME rejected scenarios', () => {
    - rejected with 0 players
    - rejected with 1 player
    - rejected with 2 players
    - error message: "minimum 3 players required"
    - remains in 'setup' state on rejection
  })

  describe('initializePlayers action', () => {
    - sets initial totalScore to 0 for all players
    - sets isDown to false for all players
    - clears any existing hand data
    - prepares players for round 1
  })
})

describe('GameMachine - playing state', () => {
  describe('entering playing state', () => {
    - spawns RoundMachine with current round context
    - passes roundNumber (starts at 1)
    - passes players array
    - passes dealerIndex
  })

  describe('RoundMachine input', () => {
    - roundNumber: context.currentRound
    - players: context.players (with current totalScores)
    - dealerIndex: context.dealerIndex
  })

  describe('round completion', () => {
    - when RoundMachine reaches final state
    - receives roundRecord from RoundMachine output
    - adds roundRecord to roundHistory
    - transitions to 'roundEnd' state
  })

  describe('roundHistory update', () => {
    - appends new RoundRecord to existing history
    - preserves all previous round records
    - roundHistory.length increases by 1
  })
})

describe('GameMachine - roundEnd state', () => {
  describe('game continuation (rounds 1-5)', () => {
    given: currentRound is 1, 2, 3, 4, or 5
    when: round ends
    then: guard 'isGameOver' returns false
    and: transitions back to 'playing'
    and: incrementRound action fires
    and: advanceDealer action fires
  })

  describe('incrementRound action', () => {
    - currentRound increases by 1
    - round 1 → 2 → 3 → 4 → 5 → 6
    - after round 6, currentRound becomes 7 (triggers game end)
  })

  describe('advanceDealer action', () => {
    - dealerIndex increases by 1
    - wraps around: (dealerIndex + 1) % playerCount
    - with 4 players: 0 → 1 → 2 → 3 → 0 → 1 ...
    - dealer rotates left (clockwise)
  })

  describe('game end condition (after round 6)', () => {
    given: currentRound is 6
    when: round ends
    and: incrementRound makes currentRound = 7
    then: guard 'isGameOver' returns true (7 > 6)
    and: transitions to 'gameEnd' state
  })
})

describe('GameMachine - gameEnd state', () => {
  describe('entering gameEnd', () => {
    - triggers calculateFinalScores action
    - gameEnd is a final state
    - no further transitions possible
  })

  describe('calculateFinalScores action', () => {
    - final scores already accumulated in player.totalScore
    - determines winner(s) - lowest total score
    - handles ties (multiple winners)
  })

  describe('final state output', () => {
    - includes final scores for all players
    - includes winner(s) array
    - includes complete roundHistory
    - game is complete
  })
})

describe('GameMachine - guards', () => {
  describe('hasMinPlayers', () => {
    - returns false when players.length < 3
    - returns true when players.length >= 3
    - returns true when players.length === 8
  })

  describe('isGameOver', () => {
    - returns false when currentRound <= 6
    - returns true when currentRound > 6
    - checked in roundEnd state
  })
})

describe('GameMachine - context preservation', () => {
  describe('across rounds', () => {
    - players array persists
    - player.totalScore accumulates
    - roundHistory grows
    - gameId unchanged
  })

  describe('player scores', () => {
    - totalScore updated after each round
    - scores from roundRecord added to player.totalScore
    - cumulative across all 6 rounds
  })
})
```

### `core/engine/roundMachine.test.ts`

```
describe('RoundMachine - initialization', () => {
  describe('context from input', () => {
    - roundNumber from input
    - contract determined by roundNumber (CONTRACTS[roundNumber])
    - players copied from input with hand: [], isDown: false
    - currentPlayerIndex = (dealerIndex + 1) % playerCount
    - dealerIndex from input
    - stock: [] (populated during dealing)
    - discard: [] (populated during dealing)
    - table: [] (no melds yet)
    - winnerPlayerId: null
  })

  describe('first player calculation', () => {
    given: 4 players, dealerIndex = 0
    then: currentPlayerIndex = 1 (left of dealer)

    given: 4 players, dealerIndex = 3
    then: currentPlayerIndex = 0 (wraps around)

    given: 5 players, dealerIndex = 2
    then: currentPlayerIndex = 3
  })

  describe('player state reset', () => {
    - all players start with empty hand (will be dealt)
    - all players start with isDown: false
    - totalScore preserved from input (not reset)
  })
})

describe('RoundMachine - dealing state', () => {
  describe('entry actions', () => {
    - dealCards action executes
    - flipFirstDiscard action executes
    - immediately transitions to 'active' state (always transition)
  })

  describe('dealCards action', () => {
    - creates appropriate deck for player count
    - 3-5 players: 2 decks + 4 jokers = 108 cards
    - 6-8 players: 3 decks + 6 jokers = 162 cards
    - shuffles deck
    - deals 11 cards to each player
    - remaining cards become stock
  })

  describe('deck configuration', () => {
    given: 3 players
    then: 108 card deck, 33 dealt (11×3), 75 in stock before flip

    given: 4 players
    then: 108 card deck, 44 dealt (11×4), 64 in stock before flip

    given: 5 players
    then: 108 card deck, 55 dealt (11×5), 53 in stock before flip

    given: 6 players
    then: 162 card deck, 66 dealt (11×6), 96 in stock before flip

    given: 8 players
    then: 162 card deck, 88 dealt (11×8), 74 in stock before flip
  })

  describe('flipFirstDiscard action', () => {
    - takes top card from stock
    - places it face-up as first discard
    - stock size decreases by 1
    - discard pile has exactly 1 card
  })

  describe('post-deal state', () => {
    given: 4 players
    then: each player has exactly 11 cards
    and: stock has 63 cards (108 - 44 - 1)
    and: discard has 1 card
    and: all cards accounted for (no duplicates, no missing)
  })
})

describe('RoundMachine - active state', () => {
  describe('structure', () => {
    - initial substate is 'turnInProgress'
    - spawns TurnMachine for current player's turn
  })

  describe('TurnMachine invocation', () => {
    - passes playerId of current player
    - passes playerHand (current player's cards)
    - passes isDown status
    - passes contract for current round
    - passes stock
    - passes discard
    - passes table (melds)
    - passes roundNumber
  })

  describe('turn completion - normal', () => {
    given: TurnMachine completes with wentOut: false
    then: update game state from turn output
    and: advance to next player
    and: spawn new TurnMachine for next player
    note: May I window handled in Phase 6
  })

  describe('turn completion - went out', () => {
    given: TurnMachine completes with wentOut: true
    then: set winnerPlayerId from turn output
    and: transition to 'scoring' state
    and: do NOT advance turn (round is over)
  })

  describe('advanceTurn action', () => {
    - currentPlayerIndex = (currentPlayerIndex + 1) % playerCount
    - with 4 players: 0 → 1 → 2 → 3 → 0 → 1 ...
    - clockwise rotation
  })

  describe('state updates from turn', () => {
    - update current player's hand from turn output
    - update stock from turn output
    - update discard from turn output
    - update table (melds) from turn output
    - update isDown if player laid down
  })
})

describe('RoundMachine - scoring state', () => {
  describe('entry action', () => {
    - scoreRound action executes
    - scoring state is final
  })

  describe('scoreRound action', () => {
    - winner (winnerPlayerId) scores 0
    - all other players score sum of cards in hand
    - creates RoundRecord with scores
  })

  describe('RoundRecord creation', () => {
    - roundNumber: current round
    - scores: map of playerId → round score
    - winnerId: player who went out
  })

  describe('output', () => {
    - returns roundRecord to parent GameMachine
    - includes all scoring information
    - triggers roundEnd in GameMachine
  })
})

describe('RoundMachine - stock depletion', () => {
  describe('detection', () => {
    - guard 'stockEmpty' checks stock.length === 0
    - checked when player tries to draw from stock
    - or at round level as safety check
  })

  describe('reshuffleStock action', () => {
    - takes all cards from discard pile EXCEPT top card
    - shuffles those cards
    - places them as new stock
    - top discard remains face-up
  })

  describe('reshuffle scenario', () => {
    given: stock is empty, discard has 20 cards
    when: reshuffleStock triggered
    then: top discard card stays in place
    and: remaining 19 cards shuffled into stock
    and: stock now has 19 cards
    and: discard has 1 card
  })

  describe('double depletion (edge case)', () => {
    given: stock runs out again after reshuffle
    then: either end round immediately (all score current hands)
    or: reshuffle again (house rule choice)
    note: implementation should handle this gracefully
  })
})

describe('RoundMachine - guards', () => {
  describe('someoneWentOut', () => {
    - returns true when winnerPlayerId !== null
    - returns false when winnerPlayerId === null
    - used to transition to scoring
  })

  describe('stockEmpty', () => {
    - returns true when stock.length === 0
    - returns false when stock.length > 0
    - triggers reshuffle logic
  })
})
```

### `core/engine/dealing.test.ts`

```
describe('createDeckForPlayerCount', () => {
  describe('3-5 players', () => {
    - returns 108 cards (2 decks + 4 jokers)
    - contains 104 standard cards (52 × 2)
    - contains exactly 4 jokers
  })

  describe('6-8 players', () => {
    - returns 162 cards (3 decks + 6 jokers)
    - contains 156 standard cards (52 × 3)
    - contains exactly 6 jokers
  })

  describe('boundary cases', () => {
    - 3 players → 108 cards
    - 5 players → 108 cards
    - 6 players → 162 cards
    - 8 players → 162 cards
  })
})

describe('deal', () => {
  describe('card distribution', () => {
    - deals 11 cards to each player
    - deals in round-robin order
    - card 1 to player 1, card 2 to player 2, etc.
    - continues until all players have 11 cards
  })

  describe('dealing order', () => {
    - starts with player left of dealer (currentPlayerIndex)
    - continues clockwise
    - dealer receives cards last in each round of dealing
  })

  describe('remaining cards', () => {
    given: 108 card deck, 4 players
    when: deal completes
    then: 44 cards dealt (11 × 4)
    and: 64 cards remain in stock
  })

  describe('card integrity', () => {
    - no card appears in multiple hands
    - no card appears in both hand and stock
    - all dealt cards came from deck
    - total cards = hands + stock
  })
})

describe('flipFirstDiscard', () => {
  describe('operation', () => {
    - removes top card from stock
    - places card in discard pile
    - discard pile now has exactly 1 card
  })

  describe('stock adjustment', () => {
    given: stock has 64 cards
    when: flipFirstDiscard
    then: stock has 63 cards
    and: discard has 1 card
  })

  describe('card is face-up', () => {
    - discard top card is visible to all players
    - first player can choose to draw it
  })
})

describe('initial round state after dealing', () => {
  describe('3 player game', () => {
    - deck: 108 cards
    - dealt: 33 cards (11 × 3)
    - stock: 74 cards (108 - 33 - 1)
    - discard: 1 card
    - total: 108 cards accounted for
  })

  describe('4 player game', () => {
    - deck: 108 cards
    - dealt: 44 cards (11 × 4)
    - stock: 63 cards (108 - 44 - 1)
    - discard: 1 card
    - total: 108 cards accounted for
  })

  describe('5 player game', () => {
    - deck: 108 cards
    - dealt: 55 cards (11 × 5)
    - stock: 52 cards (108 - 55 - 1)
    - discard: 1 card
    - total: 108 cards accounted for
  })

  describe('6 player game', () => {
    - deck: 162 cards
    - dealt: 66 cards (11 × 6)
    - stock: 95 cards (162 - 66 - 1)
    - discard: 1 card
    - total: 162 cards accounted for
  })

  describe('8 player game', () => {
    - deck: 162 cards
    - dealt: 88 cards (11 × 8)
    - stock: 73 cards (162 - 88 - 1)
    - discard: 1 card
    - total: 162 cards accounted for
  })
})
```

### `core/engine/turnAdvancement.test.ts`

```
describe('turn advancement', () => {
  describe('clockwise rotation', () => {
    given: 4 players [P0, P1, P2, P3]
    and: currentPlayerIndex = 0
    when: turn completes
    then: currentPlayerIndex = 1

    when: turn completes again
    then: currentPlayerIndex = 2

    when: turn completes again
    then: currentPlayerIndex = 3

    when: turn completes again
    then: currentPlayerIndex = 0 (wrapped)
  })

  describe('wrap-around', () => {
    given: 4 players, currentPlayerIndex = 3
    when: turn completes
    then: currentPlayerIndex = 0

    given: 5 players, currentPlayerIndex = 4
    when: turn completes
    then: currentPlayerIndex = 0
  })

  describe('formula', () => {
    - nextPlayer = (currentPlayerIndex + 1) % playerCount
    - always produces valid index
    - cycles through all players
  })

  describe('full rotation', () => {
    given: 4 players
    then: one full rotation = 4 turns
    and: each player gets exactly one turn per rotation
    and: turn order is consistent
  })
})

describe('first player each round', () => {
  describe('left of dealer', () => {
    given: dealerIndex = 0, 4 players
    then: first player = 1

    given: dealerIndex = 3, 4 players
    then: first player = 0 (wraps)

    given: dealerIndex = 2, 5 players
    then: first player = 3
  })

  describe('formula', () => {
    - firstPlayer = (dealerIndex + 1) % playerCount
    - same formula as turn advancement
  })
})

describe('dealer rotation between rounds', () => {
  describe('advancement', () => {
    given: 4 players, dealer = 0 in round 1
    when: round 1 ends
    then: dealer = 1 for round 2

    when: round 2 ends
    then: dealer = 2 for round 3

    ...continues through round 6
  })

  describe('wrap-around', () => {
    given: 4 players, dealer = 3 in round 4
    when: round 4 ends
    then: dealer = 0 for round 5
  })

  describe('full game dealer rotation', () => {
    given: 4 players, dealer = 0 in round 1
    round 1: dealer = 0, first player = 1
    round 2: dealer = 1, first player = 2
    round 3: dealer = 2, first player = 3
    round 4: dealer = 3, first player = 0
    round 5: dealer = 0, first player = 1
    round 6: dealer = 1, first player = 2
  })
})
```

### `core/engine/roundTransition.test.ts`

```
describe('round transition', () => {
  describe('state reset for new round', () => {
    - all players' isDown reset to false
    - all players' hands cleared (new cards dealt)
    - all players' laidDownThisTurn reset to false
    - table cleared (no melds)
    - stock replenished (new shuffled deck)
    - discard reset (single flipped card)
  })

  describe('preserved state', () => {
    - player.totalScore NOT reset
    - roundHistory preserved and extended
    - gameId unchanged
    - players array (identities) unchanged
  })

  describe('round number progression', () => {
    - round 1 → round 2 → round 3 → round 4 → round 5 → round 6
    - currentRound increments by 1
    - contract changes each round
  })

  describe('contract progression', () => {
    round 1: 2 sets
    round 2: 1 set + 1 run
    round 3: 2 runs
    round 4: 3 sets
    round 5: 2 sets + 1 run
    round 6: 1 set + 2 runs
  })

  describe('score accumulation', () => {
    given: player has totalScore = 45 after round 3
    and: player scores 25 in round 4
    when: round 4 ends
    then: player.totalScore = 70

    and: player scores 0 in round 5 (went out)
    when: round 5 ends
    then: player.totalScore = 70 (unchanged)
  })
})

describe('round end to round start flow', () => {
  describe('sequence', () => {
    1. Round N ends (someone goes out)
    2. Scores calculated for round N
    3. RoundRecord created and added to history
    4. Player totalScores updated
    5. If round < 6: increment round, advance dealer
    6. New deck created and shuffled
    7. Cards dealt to all players
    8. First discard flipped
    9. First player (left of new dealer) begins
  })

  describe('timing', () => {
    - scoring happens before round transition
    - dealer advances before dealing
    - first player calculated from new dealer
  })
})
```

### `core/engine/stockDepletion.test.ts`

```
describe('stock depletion detection', () => {
  describe('during draw', () => {
    given: player tries to draw from stock
    and: stock.length === 0
    then: trigger reshuffle before draw completes
  })

  describe('guard check', () => {
    - stockEmpty guard returns true when stock.length === 0
    - checked before allowing DRAW_FROM_STOCK
  })
})

describe('reshuffleStock action', () => {
  describe('basic operation', () => {
    given: stock is empty
    and: discard has [topCard, card2, card3, card4, card5]
    when: reshuffleStock
    then: topCard remains in discard (face-up)
    and: [card2, card3, card4, card5] shuffled into stock
    and: stock.length === 4
    and: discard.length === 1
  })

  describe('preserves top discard', () => {
    - the card most recently discarded stays visible
    - next player still has option to draw it
    - game continuity maintained
  })

  describe('shuffle randomization', () => {
    - cards from discard are shuffled
    - not simply reversed or moved in order
    - proper randomization applied
  })

  describe('card integrity', () => {
    - no cards lost during reshuffle
    - no cards duplicated
    - total card count unchanged
  })
})

describe('reshuffle scenarios', () => {
  describe('mid-round reshuffle', () => {
    given: round in progress, many turns taken
    and: stock depleted due to draws and May I penalties
    when: next player draws from stock
    then: reshuffle occurs automatically
    and: game continues normally
    and: player receives their drawn card
  })

  describe('discard pile size', () => {
    - minimum discard for reshuffle: 2 cards (1 stays, 1 to stock)
    - typical: many cards accumulated from discards
    - all but top card become new stock
  })

  describe('multiple reshuffles in one round (edge case)', () => {
    given: reshuffle already occurred
    and: stock depletes again
    option A: reshuffle again (if discard > 1)
    option B: end round immediately, score current hands
    note: implementation choice, should be configurable
  })

  describe('stock empty, discard has only 1 card', () => {
    given: stock.length === 0
    and: discard.length === 1
    then: cannot reshuffle (no cards to move)
    then: round ends immediately
    and: all players score their current hands
    note: very rare edge case
  })
})

describe('draw from stock with reshuffle', () => {
  describe('seamless experience', () => {
    given: player issues DRAW_FROM_STOCK
    and: stock is empty (triggers reshuffle)
    when: reshuffle completes
    then: draw continues from new stock
    and: player receives top card of new stock
    and: turn proceeds normally
  })
})
```

### `core/engine/gameEnd.test.ts`

```
describe('game end trigger', () => {
  describe('after round 6', () => {
    given: round 6 completes
    when: roundEnd state processes
    and: incrementRound makes currentRound = 7
    then: isGameOver guard returns true
    and: transition to gameEnd state
  })

  describe('not triggered early', () => {
    given: rounds 1-5
    when: round completes
    then: isGameOver returns false
    and: game continues to next round
  })
})

describe('final score calculation', () => {
  describe('already accumulated', () => {
    - totalScore already updated after each round
    - no additional calculation needed
    - just determine winner from existing totals
  })

  describe('winner determination', () => {
    - player(s) with lowest totalScore win
    - single winner if one player has unique lowest
    - multiple winners if tie for lowest
  })
})

describe('determineWinner', () => {
  describe('single winner', () => {
    given: final scores { p1: 120, p2: 85, p3: 200, p4: 150 }
    then: winner = [p2]
    and: p2 has lowest score (85)
  })

  describe('two-way tie', () => {
    given: final scores { p1: 100, p2: 100, p3: 150, p4: 200 }
    then: winners = [p1, p2]
    and: both have lowest score (100)
  })

  describe('three-way tie', () => {
    given: final scores { p1: 80, p2: 80, p3: 80, p4: 120 }
    then: winners = [p1, p2, p3]
  })

  describe('all players tie', () => {
    given: final scores { p1: 100, p2: 100, p3: 100, p4: 100 }
    then: winners = [p1, p2, p3, p4]
    and: everyone wins
  })

  describe('perfect game', () => {
    given: player went out all 6 rounds
    then: totalScore = 0
    and: guaranteed winner (unless someone else also has 0)
  })
})

describe('gameEnd output', () => {
  describe('final state data', () => {
    - finalScores: map of playerId → total score
    - winners: array of winning player IDs
    - roundHistory: complete history of all 6 rounds
    - each round has scores and winnerId
  })

  describe('game completion', () => {
    - gameEnd is final state
    - no further commands accepted
    - game is complete
  })
})
```

### `core/engine/integration.test.ts` (Phase 5)

```
describe('full game flow - setup to end', () => {
  describe('game initialization', () => {
    when: create new game
    and: add 4 players (Alice, Bob, Carol, Dave)
    and: START_GAME
    then: game transitions to 'playing'
    and: round 1 begins
    and: dealer is player 0 (Alice)
    and: first player is player 1 (Bob)
  })

  describe('round 1 flow', () => {
    given: game in round 1
    and: contract is 2 sets
    when: cards dealt (11 each)
    and: players take turns
    and: eventually someone goes out
    then: round ends
    and: scores calculated
    and: game transitions to roundEnd
    and: then to round 2
  })

  describe('full 6 rounds', () => {
    - round 1: 2 sets, dealer = 0
    - round 2: 1 set + 1 run, dealer = 1
    - round 3: 2 runs, dealer = 2
    - round 4: 3 sets, dealer = 3
    - round 5: 2 sets + 1 run, dealer = 0
    - round 6: 1 set + 2 runs, dealer = 1
    - after round 6: game ends
  })

  describe('score accumulation through game', () => {
    example game:
    round 1: { Alice: 0, Bob: 35, Carol: 42, Dave: 28 }
    totals:  { Alice: 0, Bob: 35, Carol: 42, Dave: 28 }

    round 2: { Alice: 50, Bob: 0, Carol: 15, Dave: 60 }
    totals:  { Alice: 50, Bob: 35, Carol: 57, Dave: 88 }

    round 3: { Alice: 25, Bob: 30, Carol: 0, Dave: 45 }
    totals:  { Alice: 75, Bob: 65, Carol: 57, Dave: 133 }

    round 4: { Alice: 0, Bob: 40, Carol: 35, Dave: 0 }
    totals:  { Alice: 75, Bob: 105, Carol: 92, Dave: 133 }

    round 5: { Alice: 30, Bob: 0, Carol: 25, Dave: 55 }
    totals:  { Alice: 105, Bob: 105, Carol: 117, Dave: 188 }

    round 6: { Alice: 0, Bob: 45, Carol: 30, Dave: 65 }
    totals:  { Alice: 105, Bob: 150, Carol: 147, Dave: 253 }

    winner: Alice with 105 points
  })
})

describe('single round flow', () => {
  describe('dealing phase', () => {
    when: round starts
    then: deck created for player count
    and: deck shuffled
    and: 11 cards dealt to each player
    and: first discard flipped
    and: transition to active
  })

  describe('active phase - turns', () => {
    when: active state entered
    then: TurnMachine spawned for first player
    and: player takes their turn
    and: turn completes (wentOut: false)
    and: advance to next player
    and: repeat until someone goes out
  })

  describe('scoring phase', () => {
    when: player goes out (wentOut: true)
    then: transition to scoring
    and: calculate all player scores
    and: create RoundRecord
    and: output to GameMachine
  })
})

describe('turn sequencing within round', () => {
  describe('normal progression', () => {
    given: 4 players, first player = 1
    turn 1: player 1 takes turn
    turn 2: player 2 takes turn
    turn 3: player 3 takes turn
    turn 4: player 0 takes turn
    turn 5: player 1 again
    ... continues until someone goes out
  })

  describe('multiple rotations', () => {
    - players may go around multiple times
    - each player gets equal opportunities (roughly)
    - round ends when any player goes out
  })
})

describe('dealer and first player tracking', () => {
  describe('round 1', () => {
    given: initial dealer = 0
    then: first player = 1
    and: turn order: 1, 2, 3, 0, 1, 2, ...
  })

  describe('round 2', () => {
    given: dealer advances to 1
    then: first player = 2
    and: turn order: 2, 3, 0, 1, 2, 3, ...
  })

  describe('tracking across rounds', () => {
    round 1: dealer=0, first=1
    round 2: dealer=1, first=2
    round 3: dealer=2, first=3
    round 4: dealer=3, first=0
    round 5: dealer=0, first=1
    round 6: dealer=1, first=2
  })
})

describe('state persistence between turns', () => {
  describe('hand changes', () => {
    - after each turn, player's hand updated
    - drawn cards added
    - discarded cards removed
    - laid down/off cards removed
    - changes persist to next turn
  })

  describe('table changes', () => {
    - melds added when players lay down
    - melds extended when players lay off
    - changes visible to all players
    - persist until round ends
  })

  describe('stock and discard changes', () => {
    - stock decreases with draws
    - discard changes with discards
    - state accurate for each turn
  })
})

describe('edge cases', () => {
  describe('quick round - going out on first turn', () => {
    given: player 1 dealt perfect hand for contract
    when: player 1 draws and lays down all cards + discards
    then: round ends after just 1 turn
    and: other players score their 11 cards
    and: high scores for players who didn't play
  })

  describe('long round - many rotations', () => {
    given: no one can complete contract
    and: turns continue for many rotations
    then: stock may deplete (trigger reshuffle)
    and: eventually someone goes out
    and: round ends normally
  })

  describe('stock depletion during round', () => {
    given: many draws and May I calls
    when: stock runs out
    then: reshuffle discard pile
    and: continue round
    and: eventually someone goes out
  })

  describe('minimum length game', () => {
    given: one player goes out every round on first turn
    then: game has 6 rounds
    and: 6 turns total (or more if others go first)
    and: winner likely the player who went out most
  })
})

describe('contract enforcement per round', () => {
  describe('round 1', () => {
    - players must lay down 2 sets to go down
    - 1 set insufficient
    - sets + runs insufficient (wrong combination)
  })

  describe('round 2', () => {
    - players must lay down 1 set + 1 run
    - 2 sets insufficient
    - 2 runs insufficient
  })

  describe('round 3', () => {
    - players must lay down 2 runs
    - sets not accepted
  })

  describe('round 4', () => {
    - players must lay down 3 sets
    - most demanding set requirement
  })

  describe('round 5', () => {
    - players must lay down 2 sets + 1 run
    - combination contract
  })

  describe('round 6', () => {
    - players must lay down 1 set + 2 runs
    - minimum 11 cards required
    - special going out rules (no discard)
  })
})
```

### `core/engine/fullGame.test.ts` (end-to-end)

```
describe('complete game simulation', () => {
  describe('4 player game', () => {
    given: 4 players (Alice, Bob, Carol, Dave)
    when: game started and played to completion
    then: all 6 rounds completed
    and: winner determined by lowest score
    and: roundHistory has 6 entries
    and: game ends in 'gameEnd' state
  })

  describe('3 player game (minimum)', () => {
    given: 3 players
    when: game played to completion
    then: uses 108 card deck (2 decks)
    and: all 6 rounds completed
    and: winner determined
  })

  describe('8 player game (maximum)', () => {
    given: 8 players
    when: game played to completion
    then: uses 162 card deck (3 decks)
    and: all 6 rounds completed
    and: winner determined
  })
})

describe('game state at each phase', () => {
  describe('setup', () => {
    - players being added
    - game not started
    - no rounds played
  })

  describe('playing (mid-round)', () => {
    - currentRound set
    - cards dealt
    - turns in progress
    - melds may be on table
  })

  describe('roundEnd (between rounds)', () => {
    - round just completed
    - scores calculated
    - about to advance to next round (or end)
  })

  describe('gameEnd', () => {
    - all 6 rounds complete
    - final scores set
    - winners determined
    - game over
  })
})

describe('roundHistory completeness', () => {
  describe('after each round', () => {
    round 1: roundHistory.length === 1
    round 2: roundHistory.length === 2
    round 3: roundHistory.length === 3
    round 4: roundHistory.length === 4
    round 5: roundHistory.length === 5
    round 6: roundHistory.length === 6
  })

  describe('record contents', () => {
    - each record has roundNumber
    - each record has scores for all players
    - each record has winnerId (who went out)
  })

  describe('can reconstruct game', () => {
    - sum of round scores = total score
    - can identify who won each round
    - full audit trail available
  })
})

describe('error handling', () => {
  describe('invalid commands in setup', () => {
    - START_GAME with < 3 players rejected
    - ADD_PLAYER with > 8 players rejected
    - game stays in setup until valid start
  })

  describe('commands in wrong state', () => {
    - ADD_PLAYER rejected after game started
    - START_GAME rejected when already playing
    - game state unchanged on invalid command
  })

  describe('game integrity', () => {
    - all cards accounted for each round
    - scores never decrease
    - player count never changes mid-game
  })
})
```

---

**Key aspects of Phase 5:**

1. **GameMachine orchestration** — Setup → Playing (with RoundMachine) → RoundEnd → GameEnd
2. **RoundMachine orchestration** — Dealing → Active (with TurnMachine) → Scoring
3. **Dealing mechanics** — Correct deck size for player count, 11 cards each, stock/discard setup
4. **Turn and dealer advancement** — Clockwise rotation, wrap-around, dealer changes each round
5. **Stock depletion** — Reshuffle discard pile when stock runs out
6. **Round transitions** — State reset, score preservation, contract progression
7. **Game end** — Winner determination after round 6, tie handling
