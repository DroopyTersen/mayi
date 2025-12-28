This is really helpful! Let me make sure I understand the full mechanics:

**Key clarifications:**

1. **Current player draws from discard** → No May I opportunity at all. Done.

2. **Current player draws from stock** → They "pass" on the discard, lose veto rights, May I is available.

3. **May I can be called BEFORE current player draws** → Someone shouts "May I!" and the current player can veto by taking the discard themselves (as their draw, no penalty).

4. **Veto = priority claiming**:

   - Current player vetoes (before drawing) → They take discard as their draw, no penalty
   - Non-current player vetoes → They take discard + penalty (it's a May I for them)
   - Priority goes to whoever is closest in turn order

5. **Once current player draws from stock, they can't veto** → They've passed, must let May I resolve among others.

So the "veto" isn't really blocking - it's "I want it more, and I'm ahead of you in line." Anyone can claim, but priority determines who actually gets it.

Let me rewrite Phase 6 with this understanding:

---

## Phase 6: May I Mechanic — Revised Comprehensive Test Descriptions

### `core/engine/mayIWindow.test.ts`

```
describe('MayIWindowMachine - initialization', () => {
  describe('context from input', () => {
    - discardedCard: the card just discarded
    - discardedByPlayerId: player who discarded
    - currentPlayerId: player whose turn is next (hasn't drawn yet)
    - currentPlayerIndex: index of player whose turn it is
    - playerOrder: array of player IDs in turn order
    - claimants: [] (empty initially)
    - currentPlayerClaimed: false
    - currentPlayerPassed: false
    - winnerId: null
    - stock: current stock pile (for penalty card)
  })

  describe('initial state', () => {
    - starts in 'open' state
    - discard is available for claiming
    - current player hasn't decided yet
    - no claimants yet
  })
})

describe('MayIWindowMachine - open state', () => {
  describe('current player takes discard (immediate claim)', () => {
    given: window is open, current player hasn't drawn
    when: current player issues DRAW_FROM_DISCARD
    then: currentPlayerClaimed = true
    and: transitions to 'closedByCurrentPlayer'
    and: current player receives discard (NO penalty)
    and: this counts as their draw
    and: all May I claims voided
  })

  describe('current player draws from stock (passes)', () => {
    given: window is open, current player hasn't drawn
    when: current player issues DRAW_FROM_STOCK
    then: currentPlayerPassed = true
    and: current player loses veto rights
    and: transitions to 'resolvingClaims'
    and: May I claims will be resolved
  })

  describe('other player calls May I (before current player decides)', () => {
    given: window is open, current player hasn't drawn
    when: player-3 calls May I
    then: player-3 added to claimants array
    and: remains in 'open' state
    and: waiting for current player to decide
  })

  describe('multiple players call May I before current player decides', () => {
    given: window is open
    when: player-3 calls May I
    and: player-0 calls May I
    then: claimants = [player-3, player-0]
    and: still waiting for current player
  })

  describe('current player vetoes (claims after others called)', () => {
    given: window is open
    and: player-3 has called May I
    and: current player hasn't drawn yet
    when: current player issues DRAW_FROM_DISCARD
    then: current player takes discard (NO penalty)
    and: transitions to 'closedByCurrentPlayer'
    and: player-3's May I claim is denied
    note: this is the "veto" - current player takes it before drawing from stock
  })

  describe('guards - canCallMayI', () => {
    - returns false if caller is the one who discarded (can't May I own card)
    - returns true for current player (they can claim as their draw)
    - returns true for any other player
  })

  describe('guards - isCurrentPlayer', () => {
    - returns true if event.playerId === currentPlayerId
    - used to handle current player's draw actions
  })
})

describe('MayIWindowMachine - resolvingClaims state', () => {
  describe('entering state', () => {
    given: current player drew from stock (passed)
    then: window transitions to 'resolvingClaims'
    and: resolve claims by priority
  })

  describe('no claimants', () => {
    given: in resolvingClaims, claimants = []
    then: transitions to 'closedNoClaim'
    and: discard remains on pile
    and: no one gets penalty card
  })

  describe('single claimant', () => {
    given: in resolvingClaims, claimants = [player-3]
    then: player-3 wins
    and: player-3 receives discard + penalty card
    and: transitions to 'resolved'
  })

  describe('multiple claimants - priority resolution', () => {
    given: in resolvingClaims
    and: claimants = [player-3, player-0]
    and: currentPlayerIndex = 1 (player-1's turn, they passed)
    then: priority order after player-1: player-2 → player-3 → player-0
    and: player-3 is closer than player-0
    and: player-3 wins
    and: player-3 receives discard + penalty card
    and: player-0 receives nothing
  })

  describe('veto between non-current players', () => {
    given: player-1 discarded, player-2 is current (passed)
    and: player-0 calls May I (3 turns away)
    and: player-3 calls May I (1 turn away)
    then: player-3 is closer to player-2 in turn order
    and: player-3 wins (effectively "vetoed" player-0)
    and: player-3 receives discard + penalty card
    and: player-0 receives nothing
  })
})

describe('MayIWindowMachine - priority calculation', () => {
  describe('basic priority', () => {
    given: 4 players [P0, P1, P2, P3]
    and: P1 discarded, P2 is current (passed)
    then: priority order: P2(current) → P3 → P0
    and: P1 cannot claim (discarded the card)

    test: claimants = [P0, P3]
    then: winner = P3 (P3 comes before P0)
  })

  describe('wrap-around priority', () => {
    given: 4 players [P0, P1, P2, P3]
    and: P3 discarded, P0 is current (passed)
    then: priority order: P0(current/passed) → P1 → P2

    test: claimants = [P1, P2]
    then: winner = P1 (closest to P0)
  })

  describe('current player in priority (but already passed)', () => {
    given: P2 is current, already drew from stock (passed)
    and: claimants = [P3, P0]
    then: P2 cannot win (already passed)
    and: priority among remaining: P3 → P0
    and: winner = P3
  })

  describe('5 player scenario', () => {
    given: 5 players [P0, P1, P2, P3, P4]
    and: P2 discarded, P3 is current (passed)
    then: priority: P4 → P0 → P1

    test: claimants = [P0, P1]
    then: winner = P0

    test: claimants = [P4, P0]
    then: winner = P4
  })
})

describe('MayIWindowMachine - final states', () => {
  describe('closedByCurrentPlayer', () => {
    - final state
    - output type: 'CURRENT_PLAYER_CLAIMED'
    - current player received discard (no penalty)
    - all May I claims voided
    - current player's turn continues (they've drawn)
  })

  describe('resolved', () => {
    - final state
    - output type: 'MAY_I_RESOLVED'
    - winnerId: player who won
    - winnerReceived: [discardedCard, penaltyCard]
    - current player's turn continues (they drew from stock)
  })

  describe('closedNoClaim', () => {
    - final state
    - output type: 'NO_CLAIMS'
    - discard remains on pile
    - current player's turn continues (they drew from stock)
  })
})
```

### `core/engine/mayIPriority.test.ts`

```
describe('getClaimPriority', () => {
  describe('priority order after current player', () => {
    given: 4 players [P0, P1, P2, P3], current = P2
    then: priority order = [P3, P0, P1]
    and: P2 not in list (they're current, handle separately)
    and: discarder (whoever it was) excluded
  })

  describe('wrap-around', () => {
    given: 4 players, current = P3
    then: priority order = [P0, P1, P2]

    given: 4 players, current = P0
    then: priority order = [P1, P2, P3]
  })

  describe('excluding discarder', () => {
    given: 4 players, P1 discarded, P2 is current
    then: priority order = [P3, P0]
    and: P1 excluded (discarded)
    and: P2 excluded (current, handled separately)
  })
})

describe('resolveByPriority', () => {
  describe('single claimant', () => {
    given: claimants = [P3]
    then: winner = P3
  })

  describe('multiple claimants - first in priority wins', () => {
    given: priority order = [P3, P0, P1]
    and: claimants = [P0, P1]
    then: winner = P0 (P0 before P1 in priority)

    given: priority order = [P3, P0, P1]
    and: claimants = [P1, P3]
    then: winner = P3 (P3 before P1)

    given: priority order = [P3, P0, P1]
    and: claimants = [P0, P3, P1]
    then: winner = P3 (first in priority among all claimants)
  })

  describe('order of calling doesn't matter', () => {
    given: P1 called May I first, then P3 called
    and: priority order = [P3, P0, P1]
    then: winner = P3 (priority trumps call order)
  })
})

describe('veto scenarios', () => {
  describe('closer player vetoes further player', () => {
    given: P0 (3 turns away) calls May I
    and: P3 (1 turn away) calls May I
    then: P3 wins
    and: P3 "vetoed" P0 by having higher priority
    and: P3 gets discard + penalty
    and: P0 gets nothing
  })

  describe('current player vetoes everyone', () => {
    given: P3 called May I, P0 called May I
    and: current player (P2) hasn't drawn yet
    when: P2 issues DRAW_FROM_DISCARD
    then: P2 wins (highest priority)
    and: P2 gets discard, NO penalty
    and: P3 and P0 get nothing
    note: current player veto = taking the discard as their draw
  })

  describe('current player cannot veto after passing', () => {
    given: P3 called May I
    and: current player (P2) drew from stock (passed)
    then: P2 cannot claim the discard anymore
    and: P3 wins by default
  })

  describe('chain of vetoes', () => {
    given: priority order = [P3, P0, P1]
    scenario: P1 calls May I
    scenario: P0 says "no, I want it" (calls May I)
    scenario: P3 says "no, I want it" (calls May I)
    then: P3 wins (highest priority)
    and: all others' claims denied
    note: in implementation, all claims collected then resolved by priority
  })
})
```

### `core/engine/mayIActions.test.ts`

```
describe('current player claiming', () => {
  describe('claim via DRAW_FROM_DISCARD', () => {
    given: current player issues DRAW_FROM_DISCARD
    then: current player receives discardedCard
    and: NO penalty card (it's their normal draw)
    and: discard pile top removed
    and: stock unchanged
    and: current player's hand += 1
  })

  describe('claim voids other May I calls', () => {
    given: P3 and P0 have called May I
    when: current player (P2) issues DRAW_FROM_DISCARD
    then: P2 gets the card
    and: P3's claim voided
    and: P0's claim voided
    and: no penalty cards drawn by anyone
  })

  describe('counts as current player's draw', () => {
    given: current player claims discard
    then: they cannot also draw from stock
    and: turn continues from 'drawn' state
    and: they can lay down, lay off, etc.
  })
})

describe('non-current player winning May I', () => {
  describe('receives discard + penalty', () => {
    given: P3 wins May I
    then: P3 receives discardedCard
    and: P3 receives penalty card (top of stock)
    and: P3's hand += 2
  })

  describe('discard and stock updated', () => {
    given: discard = [K♠, Q♥, ...]
    and: stock = [7♦, 3♣, ...]
    when: P3 wins May I for K♠
    then: discard = [Q♥, ...] (K♠ removed)
    and: stock = [3♣, ...] (7♦ removed as penalty)
    and: P3's hand includes K♠ and 7♦
  })

  describe('turn order unchanged', () => {
    given: P2 is current player, drew from stock
    and: P3 wins May I
    then: it's still P2's turn
    and: P3 must wait for their normal turn
    and: turn order: P2 (current) → P3 → P0 → P1 → ...
  })
})

describe('no claims scenario', () => {
  describe('discard stays on pile', () => {
    given: current player drew from stock
    and: no one called May I
    when: window resolves
    then: discard pile unchanged
    and: discardedCard still on top
    and: stock unchanged
    and: no hands changed (from May I)
  })
})
```

### `core/engine/mayIRules.test.ts`

```
describe('May I eligibility rules', () => {
  describe('cannot May I your own discard', () => {
    given: P1 just discarded K♠
    when: P1 tries to call May I
    then: rejected (cannot claim own discard)
    note: would be pointless anyway - they just gave it up
  })

  describe('current player CAN claim (not technically May I)', () => {
    given: P2 is current player
    when: P2 draws from discard
    then: this is their normal draw, NOT a May I
    and: no penalty
    and: this is "claiming" not "May I-ing"
  })

  describe('all other players can May I', () => {
    given: P1 discarded, P2 is current
    then: P3 can call May I
    and: P0 can call May I
    and: anyone except P1 (discarder) and excluding P2's special claim
  })
})

describe('May I timing rules', () => {
  describe('May I can be called before current player draws', () => {
    given: P1 discards
    and: P2's turn starts (awaitingDraw)
    when: P3 calls May I
    then: valid, claim recorded
    and: window waits for P2 to decide
    and: P2 can still veto by taking discard
  })

  describe('May I window closes when current player draws from discard', () => {
    given: P3 has called May I
    when: current player (P2) draws from discard
    then: P2 gets the card
    and: P3's claim denied
    and: window closes
  })

  describe('May I resolves when current player draws from stock', () => {
    given: P3 has called May I
    when: current player (P2) draws from stock
    then: P2 has "passed"
    and: window resolves May I claims
    and: P3 wins (only claimant)
    and: P3 gets card + penalty
  })

  describe('current player loses veto after drawing from stock', () => {
    given: P2 (current) draws from stock
    then: P2 cannot claim the discard anymore
    and: May I resolves among other claimants
    and: P2's draw is from stock, not discard
  })
})

describe('May I unlimited per round', () => {
  describe('no limit on calls per player', () => {
    turn 1: P3 wins May I (+2 cards)
    turn 5: P3 wins May I again (+2 cards)
    turn 9: P3 wins May I again (+2 cards)
    then: all valid
    and: P3's hand has grown by 6 cards from May I
  })

  describe('can May I multiple times in sequence', () => {
    given: P3 just won a May I
    when: next player discards
    then: P3 can call May I again
    and: pays another penalty card if they win
  })

  describe('strategic cost', () => {
    - each May I adds 2 cards to hand
    - +1 wanted card, +1 random penalty
    - larger hand = more points if caught at round end
    - risk/reward tradeoff
  })
})

describe('May I penalty card', () => {
  describe('always from stock', () => {
    - penalty card is top card of stock
    - cannot choose which card
    - blind draw (luck element)
  })

  describe('only non-current players pay penalty', () => {
    - current player claiming: 1 card (their draw), no penalty
    - anyone else winning May I: 2 cards (discard + penalty)
  })

  describe('penalty card could be anything', () => {
    - might be helpful (card you need)
    - might be harmful (Joker = 50 points if stuck)
    - adds uncertainty to May I decision
  })
})
```

### `core/engine/roundMachine.mayI.test.ts`

```
describe('RoundMachine - May I window integration', () => {
  describe('window opens after discard', () => {
    given: player completes turn (discards, wentOut: false)
    then: May I window opens
    and: MayIWindowMachine spawned
    and: current player's turn is "paused" at awaitingDraw
  })

  describe('window does NOT open if player went out', () => {
    given: player goes out (wentOut: true)
    then: NO May I window
    and: round transitions to scoring
    and: no discard to claim anyway
  })

  describe('MayIWindowMachine input', () => {
    - discardedCard: card just discarded
    - discardedByPlayerId: player who discarded
    - currentPlayerId: next player (whose turn it is)
    - currentPlayerIndex: index of current player
    - playerOrder: all player IDs
    - stock: current stock pile
  })
})

describe('RoundMachine - May I outcomes', () => {
  describe('CURRENT_PLAYER_CLAIMED outcome', () => {
    given: MayIWindow outputs type: 'CURRENT_PLAYER_CLAIMED'
    then: current player has the discard in hand
    and: current player's turn continues from 'drawn' state
    and: no May I penalty applied
    and: discard removed from pile
  })

  describe('MAY_I_RESOLVED outcome', () => {
    given: MayIWindow outputs type: 'MAY_I_RESOLVED'
    and: winnerId = P3
    then: P3's hand updated (+discard +penalty)
    and: stock updated (-1 penalty card)
    and: discard pile updated (-1 card)
    and: current player's turn continues
    and: current player must have drawn from stock already
  })

  describe('NO_CLAIMS outcome', () => {
    given: MayIWindow outputs type: 'NO_CLAIMS'
    then: discard pile unchanged
    and: stock unchanged
    and: current player's turn continues
    and: current player already drew from stock
  })
})

describe('RoundMachine - turn flow with May I', () => {
  describe('current player claims - simple flow', () => {
    1. P1 discards K♠
    2. May I window opens
    3. P2 (current) issues DRAW_FROM_DISCARD
    4. Window outputs CURRENT_PLAYER_CLAIMED
    5. P2's hand has K♠
    6. P2's turn continues (drawn state)
    7. P2 can lay down, lay off, etc.
    8. P2 discards
    9. New May I window opens
  })

  describe('May I won - flow continues', () => {
    1. P1 discards K♠
    2. May I window opens
    3. P3 calls May I
    4. P2 (current) issues DRAW_FROM_STOCK
    5. Window resolves: P3 wins
    6. P3 gets K♠ + penalty card
    7. P2's turn continues (drew from stock)
    8. P2 can lay down, lay off, etc.
    9. P2 discards
    10. New May I window opens
    note: P3 doesn't get a turn now - must wait
  })

  describe('no May I - simple flow', () => {
    1. P1 discards 3♣ (low value, no one wants it)
    2. May I window opens
    3. P2 (current) issues DRAW_FROM_STOCK
    4. No one calls May I
    5. Window outputs NO_CLAIMS
    6. 3♣ stays on discard pile
    7. P2's turn continues
  })

  describe('current player vetoes May I', () => {
    1. P1 discards K♠
    2. May I window opens
    3. P3 calls May I
    4. P0 calls May I
    5. P2 (current) issues DRAW_FROM_DISCARD (veto)
    6. Window outputs CURRENT_PLAYER_CLAIMED
    7. P2 has K♠
    8. P3 and P0 get nothing
    9. P2's turn continues
  })
})

describe('RoundMachine - multiple May I in a round', () => {
  describe('May I each discard', () => {
    turn 1: P0 discards → May I window → P2 wins May I
    turn 2: P1 discards → May I window → no claims
    turn 3: P2 discards → May I window → P0 wins May I
    turn 4: P3 discards → May I window → P1 takes discard (current player)
    ...
    each discard gets its own May I window
  })

  describe('same player winning multiple May I', () => {
    turn 1: P3 wins May I (+2 cards)
    turn 2: P3 wins May I (+2 cards)
    turn 3: P3 wins May I (+2 cards)
    then: P3's hand has grown significantly
    and: all valid if P3 had priority each time
  })
})
```

### `core/engine/turnMachine.mayI.test.ts`

```
describe('TurnMachine - May I awareness', () => {
  describe('turn starts in awaitingDraw', () => {
    given: May I window just opened (previous player discarded)
    and: current player's turn "begins"
    then: turn machine in 'awaitingDraw' state
    and: May I window is active concurrently
    and: current player's draw command affects May I window
  })

  describe('DRAW_FROM_DISCARD during May I window', () => {
    when: current player issues DRAW_FROM_DISCARD
    then: TurnMachine transitions to 'drawn'
    and: MayIWindow receives the claim
    and: May I window closes (CURRENT_PLAYER_CLAIMED)
    and: current player has the discard
  })

  describe('DRAW_FROM_STOCK during May I window', () => {
    when: current player issues DRAW_FROM_STOCK
    then: TurnMachine transitions to 'drawn'
    and: current player has card from stock
    and: MayIWindow receives "pass" signal
    and: May I window resolves claims
  })

  describe('hand state after May I resolution', () => {
    scenario A - current player claimed:
    given: current player drew from discard
    then: hand includes discardedCard
    and: hand.length = previous + 1

    scenario B - another player won May I:
    given: current player drew from stock, P3 won May I
    then: current player's hand includes stock card
    and: P3's hand includes discard + penalty
    and: current player's hand.length = previous + 1
    and: P3's hand.length = previous + 2
  })
})

describe('TurnMachine - discard availability', () => {
  describe('discard available if no May I', () => {
    given: previous turn ended, no one May I'd
    then: discard pile has the discarded card on top
    and: current player can draw it
  })

  describe('discard unavailable if May I won', () => {
    given: P3 won May I for K♠
    when: current player's turn continues
    then: K♠ is NOT on discard pile
    and: discard top is whatever was under K♠
    and: current player already drew from stock
  })
})
```

### `core/engine/mayIIntegration.test.ts`

```
describe('May I - complete flow scenarios', () => {
  describe('Scenario: Current player takes discard, no May I', () => {
    given: 4 players [P0, P1, P2, P3]
    and: P1 discards K♠
    and: P2 is current (turn just started)
    when: P2 issues DRAW_FROM_DISCARD
    then: P2 receives K♠
    and: no penalty
    and: May I window closes
    and: P2's turn continues in 'drawn' state
  })

  describe('Scenario: Current player draws stock, one May I claimant', () => {
    given: P1 discards K♠
    and: P2 is current
    when: P3 calls May I
    and: P2 issues DRAW_FROM_STOCK
    then: P2 receives stock card
    and: May I resolves
    and: P3 wins (only claimant)
    and: P3 receives K♠ + penalty card
    and: P2's turn continues
  })

  describe('Scenario: Multiple claimants, priority resolution', () => {
    given: P1 discards K♠, P2 is current
    when: P0 calls May I
    and: P3 calls May I
    and: P2 draws from stock
    then: priority order (after P2): P3, P0
    and: P3 wins (closer to P2)
    and: P3 receives K♠ + penalty
    and: P0 receives nothing
  })

  describe('Scenario: Current player vetoes May I', () => {
    given: P1 discards K♠, P2 is current
    when: P3 calls May I
    and: P0 calls May I
    and: P2 draws from DISCARD (veto)
    then: P2 receives K♠ (no penalty)
    and: P3's claim denied
    and: P0's claim denied
    and: P2's turn continues
  })

  describe('Scenario: Non-current player vetoes another', () => {
    given: P1 discards K♠, P2 is current
    when: P0 calls May I (3 positions away)
    and: P3 calls May I (1 position away)
    and: P2 draws from stock (passes)
    then: P3 wins over P0 (closer in priority)
    and: this is "P3 vetoing P0"
    and: P3 receives K♠ + penalty
    and: P0 receives nothing
  })

  describe('Scenario: No one wants the discard', () => {
    given: P1 discards 3♣ (low value)
    and: P2 is current
    when: P2 draws from stock
    and: no one calls May I
    then: 3♣ remains on discard pile
    and: P2's turn continues
    and: no hands changed from May I
  })

  describe('Scenario: May I before current player decides', () => {
    given: P1 discards K♠, P2's turn starts
    when: P3 immediately calls May I (before P2 acts)
    and: P2 sees P3 wants it
    and: P2 decides to draw from discard (veto)
    then: P2 gets K♠ (no penalty)
    and: P3's early claim denied
    note: current player always has first right
  })
})

describe('May I - edge cases', () => {
  describe('May I with 3 players (minimum)', () => {
    given: 3 players [P0, P1, P2]
    and: P0 discards, P1 is current
    then: only P2 can call May I (P0 discarded, P1 is current)
    and: P2 wins automatically if they call
    and: P1 can veto by taking discard
  })

  describe('May I with 8 players (maximum)', () => {
    given: 8 players
    and: P0 discards, P1 is current
    then: P2-P7 can all call May I
    and: P2 has highest priority (closest to P1)
    and: if only P7 calls, P7 wins
  })

  describe('May I when stock is low', () => {
    given: stock has 1 card
    and: P3 wins May I
    when: penalty card drawn
    then: stock becomes empty
    and: next draw may trigger reshuffle
  })

  describe('May I when stock is empty', () => {
    given: stock is empty
    and: discard pile has cards
    when: P3 wins May I
    then: reshuffle discard (except top) to form stock
    and: THEN draw penalty card
    and: May I completes normally
  })

  describe('First discard of round', () => {
    given: round just started, first player's turn
    when: first player discards
    then: May I window opens normally
    and: second player is current
    and: all rules apply
  })
})

describe('May I - turn order verification', () => {
  describe('turn order unchanged after May I', () => {
    given: turn order is P0 → P1 → P2 → P3 → P0...
    and: P1's turn, P1 discards
    and: P3 wins May I
    then: P2 takes next turn (not P3)
    and: P3 takes turn after P2
    and: order unchanged
    and: P3 just got cards out of turn
  })

  describe('May I winner waits for their turn', () => {
    given: P3 wins May I during P2's turn
    then: P2 completes their turn
    then: P3 takes their turn (with May I cards already in hand)
    then: P0 takes their turn
    and: normal rotation
  })
})

describe('May I - strategic scenarios', () => {
  describe('May I to complete contract', () => {
    given: P3 needs K♠ to complete contract
    and: P1 discards K♠
    when: P3 calls May I
    and: P2 draws from stock (not interested in K♠)
    then: P3 gets K♠ + penalty
    and: P3 can now potentially lay down
    and: strategic advantage worth the penalty card
  })

  describe('May I risk - getting caught', () => {
    given: P3 has 15 cards (from multiple May I calls)
    and: P0 goes out
    then: P3 scores all 15 cards
    and: potentially very high score
    and: May I is high risk if you can't use the cards
  })

  describe('Vetoing to block opponent', () => {
    given: P3 needs K♠ to complete contract
    and: P1 discards K♠
    and: P3 calls May I
    when: P2 (current) doesn't need K♠ but wants to block P3
    then: P2 can veto by taking discard (no penalty for P2)
    and: P3 doesn't get the card
    and: strategic blocking
  })

  describe('Non-current veto to block', () => {
    given: P0 (3 turns away) calls May I for K♠
    and: P3 (1 turn away) doesn't need K♠ but wants to block P0
    when: P3 calls May I (veto)
    then: P3 gets K♠ + penalty
    and: P0 blocked
    and: P3 paid penalty to block
    and: may be worth it strategically
  })
})
```

### `cli/mayI.test.ts`

```
describe('CLI - May I prompts', () => {
  describe('current player decision', () => {
    display:
    "Alice discarded K♠."
    "Bob, it's your turn. Do you want the K♠?"
    "  1. Yes, take it"
    "  2. No, draw from stock"
    > _
  })

  describe('current player decision with pending May I', () => {
    display:
    "Alice discarded K♠."
    "Carol calls 'May I?' for the K♠."
    "Bob, it's your turn. Carol wants the K♠."
    "  1. Take the K♠ yourself (no penalty)"
    "  2. Let Carol have it, draw from stock"
    > _
  })

  describe('May I prompt for other players', () => {
    given: Bob drew from stock (passed)
    display:
    "Bob passed on the K♠."
    "Carol, May I? (K♠ + penalty card)"
    "  1. Yes, May I!"
    "  2. No thanks"
    > _

    then prompt Dave:
    "Dave, May I? (K♠ + penalty card)"
    "  1. Yes, May I!"
    "  2. No thanks"
    > _
  })

  describe('May I resolution display - single winner', () => {
    display:
    "Carol calls 'May I!' and takes the K♠."
    "Carol draws a penalty card from the stock."
    "Carol now has 13 cards."
  })

  describe('May I resolution display - priority winner', () => {
    display:
    "Carol and Dave both want the K♠."
    "Carol is closer in turn order."
    "Carol takes the K♠ and draws a penalty card."
    "Carol now has 13 cards."
  })

  describe('May I veto display - current player', () => {
    display:
    "Carol calls 'May I?' for the K♠."
    "Bob takes the K♠ instead. Carol's May I is denied."
    "Bob, continue your turn..."
  })

  describe('May I veto display - non-current player', () => {
    display:
    "Dave calls 'May I?' for the K♠."
    "Carol says 'No, I want it!' and takes the K♠."
    "Carol draws a penalty card."
    "Carol now has 13 cards."
    "Dave's May I is denied."
  })

  describe('no May I claims', () => {
    display:
    "Bob passed on the 3♣."
    "No one wanted the 3♣."
    "Bob, continue your turn..."
  })
})

describe('CLI - AI May I decisions', () => {
  describe('AI May I summary', () => {
    display:
    "Alice discarded Q♠."
    "Bob draws from stock."
    "Carol calls 'May I!' — takes Q♠ + penalty (now 13 cards)."
    "Bob's turn continues..."
  })

  describe('AI veto summary', () => {
    display:
    "Alice discarded K♠."
    "Dave calls 'May I?' for the K♠."
    "Bob takes the K♠ instead."
    "Bob's turn continues..."
  })
})
```

---

**Key differences from previous version:**

1. **May I can be called BEFORE current player draws** — The window is open immediately after discard
2. **Current player has highest priority** — They can "veto" by taking the discard (no penalty)
3. **Current player loses veto rights after drawing from stock** — Once they pass, they can't claim
4. **Veto = priority claiming** — Any player can "veto" someone further away by claiming themselves
5. **Non-current vetoes pay penalty** — Only current player gets no penalty
6. **Priority determines winner** — Turn order position, not call order
