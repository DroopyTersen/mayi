# May I? Web App — UX Specification

This document describes the user experience for the May I? web application MVP. The goal is a minimal translation of the CLI interactive mode to a web interface that works on desktop, tablet, and phone.

## Design Philosophy

- **Information-dense but friendly** — Show all relevant game state clearly without hiding information behind menus or tabs
- **Always-visible state** — Players should always see the table, players, their hand, and available actions without needing to expand or navigate
- **Explicit over clever** — Actions happen through clear button taps and wizard flows, not drag-and-drop or gesture magic
- **Responsive, not separate** — Same information on all screen sizes, just compressed on mobile

## Mockups

![Tablet Mockup](./mockups/tablet-mockup.jpg)
![Phone Mockup](./mockups/phone-mockup.jpg)

## Layout

### Desktop Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  MAY I? — Round 2 of 6 — 1 set + 1 run                                      │
├───────────────────────────────┬─────────────────────────────────────────────┤
│                               │                                             │
│  PLAYERS                      │  TABLE                                      │
│  ┌─────┐ ┌─────┐ ┌─────┐     │                                             │
│  │ You │ │Alice│ │ Bob │     │  Alice                                      │
│  │ 11  │ │  8  │ │ 10  │     │    Set: 9♠ 9♥ 9♦                            │
│  │  —  │ │  ✓  │ │  —  │     │    Run: 4♣ 5♣ 6♣ 7♣                         │
│  │  0  │ │ 45  │ │ 32  │     │                                             │
│  └─────┘ └─────┘ └─────┘     │  Bob                                        │
│     ↑                        │    Set: K♠ K♦ Joker                         │
│  (current turn)              │                                             │
│                               │                                             │
├───────────────────────────────┴─────────────────────────────────────────────┤
│  DISCARD: [K♣]                                                              │
├────────────────────────────────────────────────────────┬────────────────────┤
│                                                        │  ACTIVITY          │
│  YOUR HAND                                             │                    │
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐     │  Alice laid down   │
│  │ 3 │ │ 5 │ │ 6 │ │ 7 │ │ 8 │ │ 9 │ │ 9 │ │ J │     │  Bob drew, disc K♣ │
│  │ ♥ │ │ ♦ │ │ ♦ │ │ ♦ │ │ ♦ │ │ ♣ │ │ ♥ │ │ ♠ │     │  Your turn...      │
│  └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘     │                    │
│                                                        │                    │
├────────────────────────────────────────────────────────┴────────────────────┤
│  [Draw Stock]  [Take Discard]                              [Organize Hand]  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Mobile Layout

On mobile, sections stack vertically:

```
┌─────────────────────────────┐
│ MAY I? Round 2 — 1 set + 1 run │
├─────────────────────────────┤
│ PLAYERS (horizontal scroll) │
│ [You 11] [Alice 8 ✓] [Bob 10]│
├─────────────────────────────┤
│ TABLE                       │
│ Alice: Set 9♠9♥9♦           │
│        Run 4♣5♣6♣7♣         │
│ Bob:   Set K♠K♦Joker        │
├─────────────────────────────┤
│ DISCARD: [K♣]               │
├─────────────────────────────┤
│ YOUR HAND (horiz scroll)    │
│ [3♥][5♦][6♦][7♦][8♦]...    │
├─────────────────────────────┤
│ [Draw Stock] [Take Discard] │
│ [Organize Hand]             │
└─────────────────────────────┘
```

---

## Visual Elements

### Card Rendering

Cards are rendered as minimal styled boxes, not images:

```
┌───┐
│ 9 │   - Red text for hearts (♥) and diamonds (♦)
│ ♥ │   - Black text for clubs (♣) and spades (♠)
└───┘
```

Jokers display with a joker symbol or "JKR" text.

Wild cards (2s and Jokers) may have a subtle visual distinction (e.g., different background tint) but this is optional for MVP.

### Player Cards

Players are shown as compact "avatar cards" in a horizontal row:

```
┌─────────┐
│  Alice  │   - Name at top
│   8     │   - Card count (large, prominent)
│   ✓     │   - Down indicator (✓ if laid down, — if not)
│   45    │   - Total score
└─────────┘
```

The current player's card is visually highlighted (border, background, or glow).

### Table Melds

Melds are grouped by player with hierarchy:

```
Alice
  Set: 9♠ 9♥ 9♦
  Run: 4♣ 5♣ 6♣ 7♣

Bob
  Set: K♠ K♦ Joker
```

On desktop, cards in melds could be rendered as mini card boxes. On mobile, text representation is fine.

### Discard Pile

Shows only the top card prominently. No need to show pile count.

### Stock Pile

Not displayed. Players don't need to see how many cards remain in stock.

### Activity Log

- **Desktop:** Sidebar showing last 5-6 actions
- **Mobile:** Compressed or shown on demand
- Includes waiting indicators: "Waiting for Alice to draw..."

---

## Action Bar

The action bar is always visible at the bottom of the screen. Buttons appear dynamically based on game state.

### When It's Your Turn

**Draw phase (haven't drawn yet):**

```
[Draw Stock]  [Take Discard]  [Organize Hand]
```

Note: "Take Discard" is hidden if you're already down (down players can only draw from stock).

**Action phase (after drawing, before discarding):**

```
[Lay Down]  [Discard]  [Organize Hand]
```

If already down:

```
[Lay Off]  [Discard]  [Organize Hand]
```

If joker swap is available (joker in a run on table, you have the natural card, you're not down):

```
[Lay Down]  [Swap Joker]  [Discard]  [Organize Hand]
```

### When It's NOT Your Turn

```
[May I?]  [Organize Hand]
```

"May I?" only appears when:

- A discard is exposed (current player drew from stock)
- You are not down

### When May I? Window Is Active

If someone called May I? and you're ahead of them in turn order:

- A popup/modal appears asking if you want to block

---

## Modes / Screens

Actions that require card selection open in a drawer/panel:

- **Desktop:** Dialog or side panel
- **Mobile:** Full-screen drawer (bottom sheet style, using something like [Vaul](https://github.com/emilkowalski/vaul))

The responsive drawer pattern from [shadcn/ui](https://ui.shadcn.com/docs/components/drawer) works well here.

### Lay Down Mode

A wizard for building melds to satisfy the round's contract.

```
┌─────────────────────────────────────────────────────────────┐
│  LAY DOWN — Round 2 (1 set + 1 run)                    [X]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  STAGING AREA                                               │
│                                                             │
│  Set 1:  [9♥ ✕] [9♦ ✕] [9♣ ✕]           ✓ Valid set        │
│                                                             │
│  Run 1:  [5♦ ✕] [6♦ ✕] [7♦ ✕] [8♦ ✕]    ✓ Valid run        │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  YOUR HAND (tap to add)                                     │
│  [3♥] [J♠] [Q♠] [2♣] [Joker]                               │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  [Cancel]                                      [Lay Down]   │
└─────────────────────────────────────────────────────────────┘
```

**Flow:**

1. User taps "Lay Down" from action bar
2. Lay Down mode opens showing all required melds (Set 1, Set 2, Run 1, etc. based on contract)
3. User taps cards in their hand → cards move to the staging area under the appropriate meld
4. Each staged card has a remove button (✕) to move it back to hand
5. Real-time validation shows ✓ or ✗ with error message for each meld
6. "Lay Down" button is disabled until all melds are valid
7. User can tap "Cancel" at any time to abort

**Selecting which meld to add to:**

- User taps on a meld row (Set 1, Run 1, etc.) to select it as the target
- Then taps cards to add to that meld
- Or: tapping a card could show a quick picker "Add to: Set 1 / Run 1"

**Validation feedback:**

- Valid: "✓ Valid set" or "✓ Valid run" in green
- Invalid: "✗ Wilds outnumber naturals" or "✗ Not a valid sequence" in red
- Errors clear automatically when the issue is fixed

### Lay Off Mode

For adding cards to existing melds on the table (only available after you're down).

```
┌─────────────────────────────────────────────────────────────┐
│  LAY OFF                                               [X]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  TABLE MELDS                                                │
│                                                             │
│  [1] Alice's Set: 9♠ 9♥ 9♦                                 │
│  [2] Alice's Run: 4♣ 5♣ 6♣ 7♣                              │
│  [3] Bob's Set: K♠ K♦ Joker                                │
│  [4] Your Run: 10♥ J♥ Q♥ K♥                                │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  YOUR HAND (tap card, then tap meld)                        │
│  [3♥] [9♠] [A♥]                                            │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  [Done]                                                     │
└─────────────────────────────────────────────────────────────┘
```

**Flow:**

1. User taps "Lay Off" from action bar
2. Mode opens showing table melds and your hand
3. User taps a card in their hand (it highlights as "selected")
4. User taps a meld to lay off to
5. If valid, card moves to that meld immediately
6. User stays in mode and can lay off more cards
7. User taps "Done" when finished

**Validation:**

- Invalid melds for the selected card could be grayed out
- Or: show error inline if user taps an invalid meld

### Discard Mode

For selecting which card to discard and end your turn.

```
┌─────────────────────────────────────────────────────────────┐
│  DISCARD — Select a card to add to the discard pile    [X]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  YOUR HAND                                                  │
│  [3♥] [5♦] [6♦] [7♦] [8♦] [9♣] [9♥] [J♠] [Q♠] [2♣]        │
│                                                             │
│  Tap a card to discard it.                                  │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  [Cancel]                                                   │
└─────────────────────────────────────────────────────────────┘
```

**Flow:**

1. User taps "Discard" from action bar
2. Mode opens showing just their hand with clear instruction
3. User taps a card
4. Card is discarded, turn ends, mode closes automatically

### Organize Hand Mode

For sorting and reordering cards. Available anytime, even when not your turn.

```
┌─────────────────────────────────────────────────────────────┐
│  ORGANIZE HAND                                         [X]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  YOUR HAND                                                  │
│                                                             │
│     [←] [3♥] [→]                                           │
│     [←] [5♦] [→]                                           │
│     [←] [6♦] [→]                                           │
│     [←] [7♦] [→]                                           │
│     ...                                                     │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  [Sort by Rank]  [Sort by Suit]              [Done]         │
└─────────────────────────────────────────────────────────────┘
```

**Flow:**

1. User taps "Organize Hand"
2. Mode opens showing each card with left/right arrows
3. Tapping ← moves that card left in the hand order
4. Tapping → moves that card right
5. "Sort by Rank" reorders: 3, 4, 5... J, Q, K, A, wilds at end
6. "Sort by Suit" reorders: ♠, ♥, ♦, ♣ grouped, wilds at end
7. "Done" closes the mode

### Swap Joker Mode

For swapping a natural card from your hand with a Joker in a run on the table.

Only appears when:

- There's a Joker in a run on the table
- You have the natural card that could replace it
- You haven't laid down yet this round

```
┌─────────────────────────────────────────────────────────────┐
│  SWAP JOKER                                            [X]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  RUNS WITH JOKERS                                           │
│                                                             │
│  [1] Alice's Run: 5♠ 6♠ [Joker] 8♠                         │
│      → Joker is acting as 7♠                                │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  YOUR HAND                                                  │
│  [7♠] [9♣] [J♦]                                            │
│                                                             │
│  Tap your 7♠, then tap the run to swap.                    │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  [Cancel]                                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## May I? Flow

The May I? mechanism is a key differentiator of this game. Here's how it works in the web UI:

### Trigger

When the current player draws from stock (not discard), the top discard becomes "exposed" and available for May I? claims.

### Button Visibility

- **Current player:** Already drew, so no pickup option
- **Other players (not down):** "May I?" button appears in their action bar
- **Players who are down:** No button (down players can't May I?)

### Claiming Flow

```
Alice discards Q♥
         │
         ▼
Bob's turn. Bob draws from stock.
         │
         ▼
Q♥ is now "exposed"
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Carol, Dave, You all see [May I?] button                   │
│  Bob continues his turn (can lay down, discard, etc.)       │
└─────────────────────────────────────────────────────────────┘
         │
         ├── Carol taps "May I?" ─────────────────────────────┐
         │                                                     │
         │   Players AHEAD of Carol (just Dave in this case)  │
         │   see a popup:                                      │
         │                                                     │
         │   ┌─────────────────────────────────────────────┐  │
         │   │  Carol wants to May I the Q♥               │  │
         │   │                                             │  │
         │   │  [Allow]  [May I Instead]                   │  │
         │   └─────────────────────────────────────────────┘  │
         │                                                     │
         │   • "Allow" → Carol gets Q♥ + penalty card          │
         │   • "May I Instead" → Dave gets it instead          │
         │                                                     │
         ├── If no one calls May I? ──────────────────────────┤
         │                                                     │
         │   Bob finishes his turn (discards)                  │
         │   May I window closes                               │
         │   Next player's turn begins                         │
         │                                                     │
         └─────────────────────────────────────────────────────┘
```

### Priority Resolution

If multiple players call May I? simultaneously:

- The player closest to the current player (in turn order) has priority
- A popup asks players ahead if they want to block

### UI Considerations

- May I? buttons should be clearly visible but not disruptive
- Blocking popups should be modal (require a response)
- Consider a timeout for blocking decisions in multiplayer (e.g., 10 seconds to respond)

---

## Error Handling

Errors are displayed inline, not as modals that require dismissal.

### Error Container

Each mode (Lay Down, Lay Off, etc.) has a dedicated error area:

```
┌─────────────────────────────────────────────────────────────┐
│  ⚠️  Run 1 is invalid: Cards are not consecutive           │
└─────────────────────────────────────────────────────────────┘
```

Errors automatically clear when the user fixes the issue (e.g., removes or adds cards to make a valid meld).

### Validation Timing

- **Lay Down:** Real-time validation as cards are staged
- **Lay Off:** Validate on attempt (gray out invalid melds, or show error on tap)
- **Discard:** No validation needed (any card can be discarded)

---

## Turn Indicators

### Whose Turn

- The current player's avatar card is highlighted (border, glow, or background color)
- Activity log shows: "Waiting for Alice to draw..." or "Your turn!"

### Action Availability

- When it's not your turn, action buttons are disabled (grayed out) except "Organize Hand" and "May I?" (when applicable)
- When it's your turn, relevant action buttons are enabled

---

## Round Transitions

When a round ends (someone goes out):

- The game seamlessly transitions to the next round
- No modal or "Press to continue" required
- Scores are updated on player cards
- Activity log shows: "Alice went out! Round 2 complete."

Players can see score progression via the player cards which always show total score.

---

## Game End

When the final round (Round 6) ends:

### Summary Screen

A final summary modal/screen appears:

```
┌─────────────────────────────────────────────────────────────┐
│                      GAME OVER                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  FINAL STANDINGS                                            │
│                                                             │
│  ┌──────────┬────┬────┬────┬────┬────┬────┬───────┐        │
│  │ Player   │ R1 │ R2 │ R3 │ R4 │ R5 │ R6 │ TOTAL │        │
│  ├──────────┼────┼────┼────┼────┼────┼────┼───────┤        │
│  │ Alice    │  0 │ 15 │ 32 │  0 │ 18 │ 22 │   87  │ 🏆     │
│  │ Bob      │ 45 │  0 │ 28 │ 33 │  0 │ 36 │  142  │        │
│  │ You      │ 32 │ 48 │  0 │ 25 │ 41 │ 52 │  198  │        │
│  └──────────┴────┴────┴────┴────┴────┴────┴───────┘        │
│                                                             │
│              Alice wins! Congratulations!                   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  [Play Again]                                    [Exit]     │
└─────────────────────────────────────────────────────────────┘
```

---

## Technology Notes

### Framework

- React with Tailwind CSS
- Responsive design (mobile-first)

### Component Library Suggestions

- [Vaul](https://github.com/emilkowalski/vaul) for bottom sheet drawers on mobile
- [shadcn/ui Drawer](https://ui.shadcn.com/docs/components/drawer) for responsive drawer/dialog pattern

### State Management

- Game state from core engine
- UI state (which mode is open, selected cards, etc.) in React state
- Eventually: PartyKit/WebSocket for real-time multiplayer sync

---

## Future Considerations (Not MVP)

These are explicitly out of scope for MVP but noted for future reference:

- Drag-and-drop card reordering
- Card animations (dealing, drawing, discarding)
- Sound effects
- Spectator mode UI
- Chat/emoji reactions
- Undo functionality
- Game replay/history viewer
- Themes/card back customization

---

## Open Questions

1. **Lay Down meld targeting:** When user taps a card, how do they indicate which meld it goes to? Options:

   - Tap meld row first to "select" it, then tap cards
   - Tap card, then tap meld row
   - Cards always go to the first incomplete meld

2. **Mobile activity log placement:** Where does it fit when space is tight?

   - Collapsible section above the hand?
   - Accessible via a button/icon?
   - Only show "Waiting for X..." status, not full log?

3. **May I? timeout:** In multiplayer, how long do blocking players have to respond?
   - Fixed timeout (10-15 seconds)?
   - Configurable per game?
   - No timeout (could cause stalls)?

---

## Visual Design Notes

The web app should feel friendly and approachable — think nostalgic family card game, not technical terminal. Use the existing shadcn/ui design system with clean, readable typography and good contrast.

**Key visual principles:**
- Light, clean background (not dark terminal)
- Standard readable fonts (not monospace)
- Clear card rendering with red/black suit colors
- Friendly, family-game aesthetic
- Focus on clarity and usability over flashy effects

**Card colors:**
- Red for hearts (♥) and diamonds (♦)
- Black for clubs (♣) and spades (♠)

---

## Reference Layout JSX

(Note: The ASCII terminal mockups have been removed in favor of the image mockups above. The JSX below is a reference implementation.)

- **Dense Layout:** The 2-column structure defined in the spec.
- **Current Player Highlight:** "YOU" is bordered in the accent color.
- **Action Bar:** Only "Draw Stock" and "Organize Hand" are active. "Take Discard" is disabled because the previous player drew from stock (indicated by the activity log), meaning the discard isn't fresh.

```text
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ MAY I? — Round 2 of 6 — Contract: 1 set + 1 run                             ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ PLAYERS                                   ┃ ACTIVITY LOG                    ┃
┃ ┏━━━━━━━┓ ┌───────┐ ┌───────┐             ┃                                 ┃
┃ ┃ YOU   ┃ │ ALICE │ │ BOB   │             ┃ [10:15] Alice laid down         ┃
┃ ┃  11   ┃ │   8   │ │  10   │             ┃ [10:16] Bob drew from stock     ┃
┃ ┃  —    ┃ │   ✓   │ │  —    │             ┃ [10:16] Bob discarded Q♣        ┃
┃ ┃   0   ┃ │  45   │ │  32   │             ┃ → YOUR TURN                     ┃
┃ ┗━━━━━━━┛ └───────┘ └───────┘             ┃                                 ┃
┃    ↑ (Your Turn)                          ┃                                 ┃
┃                                           ┃                                 ┃
┃ TABLE                                     ┃                                 ┃
┃                                           ┃                                 ┃
┃ Alice                                     ┃                                 ┃
┃ ├─ Set: [9♠] [9♥] [9♦]                    ┃                                 ┃
┃ └─ Run: [4♣] [5♣] [6♣] [7♣]               ┃                                 ┃
┃                                           ┃                                 ┃
┃ Bob                                       ┃                                 ┃
┃ (No melds laid down)                      ┃                                 ┃
┃                                           ┃                                 ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┻━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ DISCARD PILE: [Q♣]                                                          ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ YOUR HAND                                                                   ┃
┃ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐           ┃
┃ │ 3 │ │ 5 │ │ 6 │ │ 7 │ │ 8 │ │ 9 │ │ 9 │ │ J │ │ 2 │ │ Q │ │ K │           ┃
┃ │ ♥ │ │ ♦ │ │ ♦ │ │ ♦ │ │ ♦ │ │ ♣ │ │ ♥ │ │ ♠ │ │ ♠ │ │ ♠ │ │ ♠ │           ┃
┃ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘           ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ [ DRAW STOCK ]   [ Take Discard ]                     [ ORGANIZE HAND ]     ┃
┃ (Active Blue)    (Disabled Gray)                      (Plain Gray)          ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

```

---

### Mockup 2: Mobile — Main Game State (Opponent's Turn)

This shows the stacked mobile layout while waiting for another player.

**Key Features:**

- **Vertical Stack:** Sections are stacked as specified.
- **Horizontal Scrolling:** The Player section and Hand section indicate horizontal scrolling capability.
- **Waiting State:** The action bar shows a status message instead of active turn buttons.
- **May I? Availability:** The "MAY I?" button is present but disabled (grayed out) because the current player (Alice) hasn't discarded yet.

```text
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ ROUND 2 — 1 set + 1 run             ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ PLAYERS                             ┃
┃ < [YOU 11 —] [ALICE 8 ✓] [BOB 10]>  ┃
┃              (Highlighted)          ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ TABLE                               ┃
┃ Alice                               ┃
┃ ├─ Set: 9♠ 9♥ 9♦                    ┃
┃ └─ Run: 4♣ 5♣ 6♣ 7♣                 ┃
┃ Bob                                 ┃
┃ (No melds)                          ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ DISCARD: [K♣]                       ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ YOUR HAND                           ┃
┃ < [3♥] [5♦] [6♦] [7♦] [8♦] [9♣]... >┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ Waiting for Alice to draw...        ┃
┃ [ May I? ]      [ ORGANIZE HAND ]   ┃
┃ (Disabled)      (Active)            ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

```

---

### Mockup 3: Desktop Modal — Lay Down Mode (Wizard)

This is the crucial complex interaction area. It opens as a large dialog over the main interface.

**Key Features:**

- **Explicit Staging:** Clearly separates cards committed to a meld vs. cards remaining in hand.
- **Inline Validation:** Immediate feedback on the validity of sets/runs.
- **Clear Actions:** Remove buttons [x] on staged cards.
- **Gated Submission:** The main "LAY DOWN" button is disabled until all contract requirements are met with valid melds.

```text
╔═══════════════════════════════════════════════════════════════════════════╗
║ LAY DOWN — Round 2 Contract: 1 set + 1 run                            [X] ║
╠═══════════════════════════════════════════════════════════════════════════╣
║                                                                           ║
║ STAGING AREA                                                              ║
║                                                                           ║
║ ▼ SET 1 (Required) ────────────────────────────────────────────────────── ║
║ ┌───┐┌───┐┌───┐                                                           ║
║ │ 9 ││ 9 ││ 9 │                                     ✓ VALID SET           ║
║ │ ♥ ││ ♦ ││ ♣ │ [x]                                (Green text)           ║
║ └───┘└───┘└───┘                                                           ║
║                                                                           ║
║ ▼ RUN 1 (Required) ────────────────────────────────────────────────────── ║
║ ┌───┐┌───┐┌───┐┌───┐                                                      ║
║ │ 5 ││ 6 ││ 8 ││ 7 │                                ✗ INVALID SEQUENCE    ║
║ │ ♦ ││ ♦ ││ ♦ ││ ♦ │ [x]                            (Red text)            ║
║ └───┘└───┘└───┘└───┘                                                      ║
║                                                                           ║
╠═══════════════════════════════════════════════════════════════════════════╣
║ YOUR HAND (Tap to add to selected meld above)                             ║
║ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐                                             ║
║ │ 3 │ │ J │ │ 9 │ │ Q │ │ 2 │                                             ║
║ │ ♥ │ │ ♠ │ │ ♥ │ │ ♠ │ │ ♣ │                                             ║
║ └───┘ └───┘ └───┘ └───┘ └───┘                                             ║
╠═══════════════════════════════════════════════════════════════════════════╣
║ [ Cancel ]                                                [ LAY DOWN ]    ║
║ (Active Gray)                                             (Disabled Gray) ║
╚═══════════════════════════════════════════════════════════════════════════╝

```

---

### Mockup 4: Mobile Drawer — The "May I?" Interception

This demonstrates the unique game mechanic where a player must make a time-sensitive decision to block another player.

**Key Features:**

- **Bottom Sheet / Drawer:** Appears over the bottom half of the mobile screen (using a pattern like Vaul).
- **Urgency:** A simple progress bar indicates time remaining to decide.
- **Clear Choices:** Two distinct buttons for the two possible outcomes.

```text
(Background is slightly dimmed mobile game screen)
.
.
.
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ MAY I? REQUEST                      ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                                     ┃
┃  Carol wants to "May I" the [Q♥]    ┃
┃                                     ┃
┃  You are ahead of them in turn      ┃
┃  order. Do you want it instead?     ┃
┃                                     ┃
┃  Updating in 8s...                  ┃
┃  [██████████───────]                ┃
┃                                     ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ [ ALLOW CAROL ]   [ MAY I INSTEAD ] ┃
┃ (Gray Button)     (Accent Button)   ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

```

## Reponsive Layout JSX

```tsx
return (
  <div className="h-screen w-screen overflow-hidden bg-background text-foreground flex flex-col">
    {/* Header - Fixed height */}
    <header className="border-b-2 border-border px-3 py-2 flex-shrink-0">
      <h1 className="text-sm font-bold leading-tight">
        MAY I? — Round {gameState.round} of {gameState.totalRounds} —{" "}
        {gameState.contract}
      </h1>
      {/* Players section on mobile */}
      <div className="block sm:hidden">
        <table className="w-full text-xs mt-2">
          <thead>
            <tr className="text-left border-b border-border">
              <th className="pb-1 font-bold">Player</th>
              <th className="pb-1 font-bold text-center">Cards</th>
              <th className="pb-1 font-bold text-center">Down?</th>
              <th className="pb-1 font-bold text-right">Score</th>
            </tr>
          </thead>
          <tbody>
            {gameState.players.map((player) => (
              <tr
                key={player.id}
                className={
                  player.isCurrentTurn ? "bg-primary/10 font-bold" : ""
                }
              >
                <td className="py-1">{player.name}</td>
                <td className="py-1 text-center text-base">
                  {player.cardCount}
                </td>
                <td className="py-1 text-center">
                  {player.isDown ? "✓" : "—"}
                </td>
                <td className="py-1 text-right text-muted-foreground">
                  {player.score}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </header>

    {/* Main Grid - Takes remaining height */}
    <div className="flex-1 grid grid-rows-1 sm:grid-cols-[1fr_minmax(250px,30%)] overflow-hidden">
      {/* Left Column - Table (all screen sizes) */}
      <div className="border-b-2 sm:border-b-0 sm:border-r-2 border-border overflow-y-auto">
        <div className="p-3 space-y-3">
          <div>
            <h2 className="text-xs font-bold mb-2">TABLE</h2>

            {/* Discard Pile */}
            <div className="mb-3 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Discard:</span>
              {gameState.discardPile && (
                <div className="relative">
                  {/* Stack effect - cards behind */}
                  <div className="absolute top-0.5 left-0.5 w-[48px] h-[68px] border-2 border-border rounded bg-card/50" />
                  <div className="absolute top-1 left-1 w-[48px] h-[68px] border-2 border-border rounded bg-card/70" />
                  <GameCard card={gameState.discardPile} size="sm" />
                </div>
              )}
            </div>

            {/* Melds */}
            <TableMelds
              melds={gameState.tableMelds}
              players={gameState.players}
            />
          </div>

          {/* Activity Log - Desktop only */}
          <div className="hidden lg:block">
            <ActivityLog activities={gameState.activityLog} />
          </div>
        </div>
      </div>

      <div className="hidden sm:block border-l-2 border-border overflow-y-auto">
        <div className="p-3">
          <h2 className="text-xs font-bold mb-2">PLAYERS</h2>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left border-b border-border">
                <th className="pb-1 font-bold">Player</th>
                <th className="pb-1 font-bold text-center">Cards</th>
                <th className="pb-1 font-bold text-center">Down?</th>
                <th className="pb-1 font-bold text-right">Score</th>
              </tr>
            </thead>
            <tbody>
              {gameState.players.map((player) => (
                <tr
                  key={player.id}
                  className={
                    player.isCurrentTurn ? "bg-primary/10 font-bold" : ""
                  }
                >
                  <td className="py-1">{player.name}</td>
                  <td className="py-1 text-center text-base">
                    {player.cardCount}
                  </td>
                  <td className="py-1 text-center">
                    {player.isDown ? "✓" : "—"}
                  </td>
                  <td className="py-1 text-right text-muted-foreground">
                    {player.score}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    {/* Bottom Section - Your Hand & Actions */}
    <div className="flex-shrink-0 border-t-2 border-border flex flex-col max-h-[40vh]">
      <div className="flex-1 overflow-y-auto px-3 py-2">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-bold">
            YOUR HAND ({gameState.yourHand.length})
          </h2>
          <Button
            onClick={() => setActiveMode("organize")}
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
          >
            Organize
          </Button>
        </div>
        <div className="flex flex-wrap gap-y-2">
          <div className="flex -space-x-8">
            {gameState.yourHand.map((card, idx) => (
              <div key={card.id} style={{ zIndex: idx }}>
                <GameCard card={card} size="md" fanned />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Action Bar - Fixed height */}
      <div className="px-3 py-2 bg-muted/30 border-t-2 border-border flex-shrink-0">
        <ActionBar
          hasDrawn={gameState.hasDrawn}
          isDown={yourPlayer?.isDown || false}
          isYourTurn={isYourTurn}
          canMayI={gameState.canMayI}
          onAction={handleAction}
        />
      </div>
    </div>

    {/* Action Modes */}
    <LayDownMode
      isOpen={activeMode === "lay-down"}
      onClose={handleModeClose}
      hand={gameState.yourHand}
      contract={gameState.contract}
    />
    <LayOffMode
      isOpen={activeMode === "lay-off"}
      onClose={handleModeClose}
      hand={gameState.yourHand}
      tableMelds={gameState.tableMelds}
      players={gameState.players}
    />
    <DiscardMode
      isOpen={activeMode === "discard"}
      onClose={handleModeClose}
      hand={gameState.yourHand}
      onDiscard={handleDiscard}
    />
    <OrganizeMode
      isOpen={activeMode === "organize"}
      onClose={handleModeClose}
      hand={gameState.yourHand}
      onSave={handleOrganize}
    />
  </div>
);
```
