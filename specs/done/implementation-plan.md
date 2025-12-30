## Implementation Phases (with XState mapping)

---

### Phase 1: Card Foundation

**What we build:**

- Card types (`Card`, `Suit`, `Rank`)
- `createDeck()`, `shuffle()`, `deal()`
- `isWild()`, `isNatural()`, `getPointValue()`
- `isValidSet()`, `isValidRun()` with wild card rules

**XState:** None yet. Pure functions only.

**Verification:** Unit tests cover all card/meld validation edge cases.

---

### Phase 2: Minimal Playable Turn

**What we build:**

- `GameState`, `Player`, `TurnState` types
- Stripped-down TurnMachine with just:

```typescript
states: {
  awaitingDraw: {
    on: {
      DRAW_FROM_STOCK: { target: 'awaitingDiscard', actions: 'drawFromStock' },
      DRAW_FROM_DISCARD: { target: 'awaitingDiscard', actions: 'drawFromDiscard' },
    },
  },
  awaitingDiscard: {
    on: {
      DISCARD: { target: 'turnComplete', actions: 'discard' },
    },
  },
  turnComplete: { type: 'final' },
}
```

- Barebones CLI: render hand, accept `d`/`t`/`x` commands

**XState:** Minimal TurnMachine. No RoundMachine or GameMachine yet — we manually loop turns.

**Verification:** Draw and discard in terminal, watch hand update correctly.

### Phase 2 Addendum: Hand Reordering

**What we add:**

- `REORDER_HAND` command (always valid, no guards needed)
- CLI commands for hand organization

```typescript
// Added to Command type
| { type: 'REORDER_HAND'; cardIds: string[] }

// Action — no guards, just validate all cards present
actions: {
  reorderHand: assign({
    hand: ({ context, event }) => {
      // Validate cardIds contains exactly the cards in hand
      const currentIds = new Set(context.hand.map(c => c.id));
      const newIds = new Set(event.cardIds);
      if (currentIds.size !== newIds.size) return context.hand;
      for (const id of currentIds) {
        if (!newIds.has(id)) return context.hand; // Invalid, no-op
      }
      // Reorder
      return event.cardIds.map(id => context.hand.find(c => c.id === id)!);
    },
  }),
}
```

**Key point:** `REORDER_HAND` is valid in _any_ turn state. It’s a free action — doesn’t consume your draw, doesn’t end your turn. We handle this by making it a global event on the TurnMachine:

```typescript
// TurnMachine - add at machine level, not inside specific states
on: {
  REORDER_HAND: {
    actions: 'reorderHand',
    // No target = stays in current state
  },
},

states: {
  awaitingDraw: { /* ... */ },
  awaitingDiscard: { /* ... */ },
  turnComplete: { type: 'final' },
}
```

**CLI commands:**

```
> sort              # Auto-sort by suit, then rank (or rank then suit — your preference)
> move 5 1          # Move card at position 5 to position 1
> swap 3 7          # Swap cards at positions 3 and 7
```

**Verification:** Reorder hand at any point during turn, confirm display updates, confirm game state unaffected.

---

### Phase 3: Contracts + Laying Down

**What we build:**

- `Contract` type and `CONTRACTS` definitions
- `validateContract()` guard
- Expand TurnMachine to include `drawn` state:

```typescript
states: {
  awaitingDraw: { /* ... */ },
  drawn: {
    on: {
      LAY_DOWN: {
        guard: and(['notDownYet', 'meetsContract', 'validMelds', 'wildsNotOutnumbered']),
        actions: 'layDownMelds',
        target: 'awaitingDiscard',
      },
      READY_TO_DISCARD: 'awaitingDiscard',
    },
  },
  awaitingDiscard: { /* ... */ },
  turnComplete: { type: 'final' },
}
```

- CLI shows contract requirement, accepts `l 1,2,3 4,5,6` lay down syntax

**XState:** TurnMachine gains `drawn` state with `LAY_DOWN` transition and guards.

**Verification:** Play turns in CLI, successfully lay down 2 sets for round 1 contract.

---

### Phase 4: Laying Off + Going Out + Scoring

**What we build:**

- `LAY_OFF` command and `canLayOffCard()` guard
- Going out detection (hand empties after discard)
- `calculateScores()` function
- TurnMachine gains `wentOut` final state:

```typescript
drawn: {
  on: {
    LAY_DOWN: { /* ... */ },
    LAY_OFF: {
      guard: and(['isDown', not('laidDownThisTurn'), 'validLayOff']),
      actions: 'layOffCard',
      // stay in drawn
    },
    READY_TO_DISCARD: 'awaitingDiscard',
  },
},
discarded: {
  always: [
    { guard: 'hasZeroCards', target: 'wentOut' },
    { target: 'turnComplete' },
  ],
},
wentOut: {
  type: 'final',
  output: ({ context }) => ({ wentOut: true, /* ... */ }),
},
```

**XState:** Full TurnMachine minus Round 6 special case. `wentOut` vs `turnComplete` final states.

**Verification:** Play until someone goes out, see correct scores displayed.

---

### Phase 5: Full Game Loop

**What we build:**

- RoundMachine with `dealing` → `active` → `scoring` states:

```typescript
states: {
  dealing: {
    entry: ['dealCards', 'flipFirstDiscard'],
    always: 'active',
  },
  active: {
    initial: 'turnInProgress',
    states: {
      turnInProgress: {
        invoke: {
          src: 'turnMachine',
          onDone: [
            { guard: 'playerWentOut', target: '#round.scoring' },
            { target: 'turnInProgress', actions: 'advanceTurn' },
          ],
        },
      },
    },
  },
  scoring: {
    entry: 'scoreRound',
    type: 'final',
  },
}
```

- GameMachine with `setup` → `playing` → `roundEnd` → loop or `gameEnd`:

```typescript
states: {
  setup: { /* ... */ },
  playing: {
    invoke: {
      src: 'roundMachine',
      onDone: 'roundEnd',
    },
  },
  roundEnd: {
    always: [
      { guard: 'isGameOver', target: 'gameEnd' },
      { target: 'playing', actions: ['incrementRound', 'advanceDealer'] },
    ],
  },
  gameEnd: { type: 'final' },
}
```

- Round 6 `GO_OUT` command (no discard, must hit zero cards)
- CLI shows round progression, dealer marker, cumulative scores

**XState:** Full GameMachine + RoundMachine. TurnMachine adds Round 6 logic.

**Verification:** Play all 6 rounds in CLI (controlling all players), see winner declared.

---

### Phase 6: May I Mechanic

**What we build:**

- MayIWindowMachine:

```typescript
states: {
  open: {
    on: {
      NEXT_PLAYER_DRAWS_DISCARD: { guard: 'isNextPlayer', target: 'closedByNextPlayer' },
      NEXT_PLAYER_DRAWS_STOCK: { guard: 'isNextPlayer', target: 'closedByNextPlayer' },
      CALL_MAY_I: { guard: 'canCallMayI', actions: 'addClaimant' },
    },
  },
  awaitingClaims: {
    on: {
      CALL_MAY_I: { guard: 'canCallMayI', actions: 'addClaimant' },
      RESOLVE: [
        { guard: 'hasClaimants', target: 'resolving' },
        { target: 'closedNoClaim' },
      ],
    },
  },
  resolving: {
    entry: ['resolveByPriority', 'giveCardsToWinner'],
    always: 'resolved',
  },
  resolved: { type: 'final' },
  closedByNextPlayer: { type: 'final' },
  closedNoClaim: { type: 'final' },
}
```

- RoundMachine’s `active` state gets `mayIWindow` substate:

```typescript
active: {
  states: {
    turnInProgress: { /* invoke turnMachine */ },
    mayIWindow: {
      invoke: {
        src: 'mayIWindowMachine',
        onDone: [
          { guard: 'mayIWasClaimed', target: 'turnInProgress', actions: 'giveMayICards' },
          { target: 'turnInProgress', actions: 'advanceTurn' },
        ],
      },
    },
  },
}
```

- CLI prompts each player: “May I? (y/n)”

**XState:** MayIWindowMachine spawned from RoundMachine. Turn flow pauses for resolution.

**Verification:** Multiple players call May I, correct priority resolution, penalty cards given.

---

### Phase 7: Joker Swapping

**What we build:**

- `SWAP_JOKER` command
- `canSwapJoker()` guard (runs only, not down yet, card fits position)
- Add to TurnMachine `drawn` state:

```typescript
drawn: {
  on: {
    // ... existing
    SWAP_JOKER: {
      guard: and(['notDownForJokerSwap', 'validJokerSwap']),
      actions: 'swapJoker',
      // stay in drawn
    },
  },
},
```

**XState:** TurnMachine gains `SWAP_JOKER` transition with guards.

**Verification:** CLI allows `s` command. Test: swap joker, then lay down using it. Test: can’t swap after laying down.

---

### Phase 8: AI Players

**What we build:**

- `PlayerVisibleState` generation from full `GameState`
- `getAvailableCommands()` function
- `AIDecisionFn` interface
- Random fallback AI for testing
- CLI game loop detects AI players, calls their decision function

**XState:** No changes. AI is an external consumer of state.

**Verification:** Play full 6-round game against AI opponents in CLI.

---

### Phase 9: Persistence + Polish

**What we build:**

- `SerializedGameState` type
- `hydrateGame()` / `dehydrateGame()` functions
- JSON file save/load in CLI
- Test fixtures as JSON files

**XState:** Serialization logic to snapshot and restore machine state.

**Verification:** Mid-game save, quit, reload, game continues exactly where left off.

---

### Phase 10: Web App

**What we build:**

- PartyKit server wrapping game engine
- React Router 7 routes + components
- D1/Drizzle persistence
- Room codes, joining, spectator mode

**XState:** Same machines, running server-side in PartyKit Durable Object.

**Verification:** Play a real game with family over the internet.
