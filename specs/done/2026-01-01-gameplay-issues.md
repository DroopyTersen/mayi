# Gameplay Issues - 2026-01-01

Issues discovered during E2E testing of May-I race condition fix.

## UI Issues

### Issue 1: "1 card selected" persists across turns

**Severity**: Minor
**Steps to reproduce**:

1. Select a card on your turn
2. Discard it
3. Wait for AI turns to complete
4. On your next turn, "1 card selected" text still shows even though no card is selected

**Expected**: Card selection state should reset between turns

### Issue 2: Activity log shows player as "Test" instead of display name

**Severity**: Minor
**Observed**: Activity log shows "Test: discarded 2♣" - using internal player ID instead of display name

**Expected**: Should show the player's display name for consistency with other UI elements

### Issue 3: "(You)" label appears on wrong player panel

**Severity**: Medium
**Observed**: When viewing AI1's meld area, it shows "AI1 (You)" as the label
**Expected**: "(You)" should only appear next to the human player's name, not AI players

### Issue 4: "2 cards selected" count accumulates incorrectly

**Severity**: Minor
**Observed**: After selecting and discarding cards, the selection counter shows "2 cards selected" even when starting fresh
**Steps to reproduce**:

1. Select a card and discard
2. On next turn, counter may show incorrect number

### Issue 5: Discard pile partially cut off at top of viewport

**Severity**: Minor
**Observed**: The discard pile area (top of card face) is sometimes cut off at the top of the viewport
**Expected**: Full card should always be visible

### Issue 6: Mobile viewport (375px) has poor card readability

**Severity**: Medium
**Observed**: At iPhone-sized viewport (375x812):

- Cards in hand are very small and difficult to read
- Players table is cut off, only showing header
- Activity log is not visible
- Minimum width appears to be enforced at ~500px

**Expected**: Better responsive design for mobile:

- Larger card rendering or horizontal scroll
- Collapsible sections for Players/Activity
- Touch-friendly tap targets

### Issue 7: Tablet viewport cuts off Players table

**Severity**: Minor
**Observed**: At 768x1024 viewport, the Players table row for AI2 is partially cut off at the bottom
**Expected**: Table should be fully visible or scrollable

### Issue 8: CRITICAL - Discard modal selects wrong card

**Severity**: Critical
**Steps to reproduce**:

1. Click Discard button
2. In the modal, click on a specific card (e.g., A♣ at position 9)
3. Click Discard to confirm
4. A DIFFERENT card gets discarded (e.g., 10♠)

**Observed**: Selected A♣ in modal but 10♠ was discarded. Card selection index seems misaligned.
**Expected**: The card clicked in the modal should be the card that gets discarded
**Impact**: Game-breaking - players cannot reliably choose which card to discard

### Issue 9: CRITICAL - Game crashes/redirects to home unexpectedly

**Severity**: Critical
**Observed**: While playing, the game suddenly navigated to the home page (http://localhost:5173/)
**Context**: Happened after discarding a card (related to Issue 8?)
**Expected**: Game should remain on game page unless explicitly navigated away
**Impact**: Total loss of game progress

### Issue 10: "Selected" text shows wrong suit in Discard modal

**Severity**: Medium
**Steps to reproduce**:

1. Click Discard button
2. Select a card (e.g., 4♠ or J♠)
3. Observe the "Selected: X of Y" text

**Observed**:

- Selected J♠ but text shows "Selected: J of clubs"
- Selected 4♠ but text shows "Selected: 4 of clubs"
- The card visual shows the correct suit (spades) but the text says "clubs"

**Expected**: The "Selected" text should show the correct suit matching the visual card
**Impact**: Confusing UX, makes it hard to verify which card is selected

### Issue 11: Lay Down modal card selection also misaligned

**Severity**: Critical
**Observed**: Same card selection offset bug exists in Lay Down modal

- Clicking on one card adds a different card to the meld
- Makes it nearly impossible to correctly build sets/runs
  **Related to**: Issue 8 (same root cause likely)

### Issue 12: Discard pile shows wrong suit icon

**Severity**: Medium
**Steps to reproduce**:

1. Discard a card (e.g., K♥ or J♥)
2. Observe the discard pile visual

**Observed**:

- Discarded K♥ (hearts) but discard pile shows K with spade icon
- Discarded J♥ (hearts) but discard pile shows J with spade icon
- Activity log shows correct suit, only visual is wrong

**Expected**: Discard pile card visual should match the actual card suit
**Impact**: Confusing - players may think wrong card was discarded

### Issue 13: CRITICAL - Lay Down silently fails without error

**Severity**: Critical
**Steps to reproduce**:

1. Open Lay Down modal
2. Add cards to fulfill contract (e.g., Set 1 with 3 Jacks, Run 2 with 4 spades)
3. Both melds show complete (no "need X more" message)
4. Click "Lay Down" button

**Observed**:

- Modal closes but lay down is NOT applied
- Player still has all 12 cards
- Table still shows "No melds on the table yet"
- No error message or feedback to user

**Expected**: Either lay down should succeed, OR show an error explaining why it failed
**Impact**: Game-breaking - players cannot complete contracts even with valid melds

---

## Gameplay Observations

- Both AI players successfully laid down contracts and are playing strategically
- AI turn execution with the new AITurnCoordinator appears to be working correctly
- AI players are taking turns in proper order

---

## May-I Testing Status

- [x] Human calls May-I during AI turn - **TESTED SUCCESSFULLY**
- [x] AI player responds to May-I prompt - **TESTED SUCCESSFULLY**
- [x] May-I resolution works correctly - **TESTED SUCCESSFULLY**

### May-I Test Results (Round 2)

1. Player2 called "May I?" on A♦ while it was Player1's turn
2. Player1 received prompt with options: "Allow" or "May I Instead!"
3. Auto-allowing countdown (7 seconds) displayed correctly
4. Player1 clicked "Allow"
5. Player2 received A♦ + penalty card from stock (went from 11 to 13 cards)
6. Turn order continued correctly after May-I resolution

**Conclusion**: May-I mechanic works correctly for human players.

---

## E2E Testing Session Summary (2026-01-01)

### What Works

- ✅ AI turns execute correctly (draw, lay off cards, discard)
- ✅ Game state persists between turns without corruption
- ✅ No crashes during normal gameplay (unlike earlier session)
- ✅ Turn order is correct (player → AI1 → AI2 → player)
- ✅ AI players successfully laid down contracts (Round 1: 2 sets, Round 2: 1 set + 1 run)
- ✅ AI players lay off cards to existing melds
- ✅ AITurnCoordinator integration is stable
- ✅ **May-I mechanic works correctly** (tested human-to-human)
- ✅ **Human player can lay down contracts** (tested with workaround)

### Card Selection Offset Bug - Confirmed (+1 Offset)

Issues 8 and 11 confirmed: Card selection in modals is offset by +1.

- Clicking card at position N selects card at position N+1
- **Workaround**: Click the card BEFORE the one you want to select
- This affects both Discard modal and Lay Down modal
- Root cause likely in card click handler index calculation

### Lay Down Modal UX Issues Discovered

**Issue 14 (NEW)**: Clicking on Run 2 meld area closes modal and loses Set 1 progress

- **Severity**: Critical
- **Steps to reproduce**:
  1. Open Lay Down modal
  2. Add cards to Set 1 until complete
  3. Click on Run 2 area to select it
  4. Modal closes, all progress lost
- **Workaround**: Click directly on "Run 2" text label (not the surrounding area)
- **Impact**: Very difficult to build contracts requiring both set and run

### Issue 13 Update - Lay Down Sometimes Works

The silent lay down failure (Issue 13) appears to be inconsistent:

- In this session, human player successfully laid down contract (1 set + 1 run)
- Contract: Set (3♦, 3♠, 3♣) + Run (5♠, 6♠, 2♠, 2♠)
- Player went from 12 cards to 4 cards after lay down
- Melds appeared correctly on table
- **Possible cause**: Earlier failures may have been due to invalid meld construction or modal switching issues

### Round 2 Progress (at end of session)

- **Player1**: Down ✓, 4 cards, Score: 37
- **Player2**: Not down, 14 cards, Score: 113
- **GrokAI1**: Not down, 11 cards, Score: 0
- **GrokAI2**: Down ✓, 4 cards, Score: 3

### Critical Bugs Summary

| Issue                                 | Severity | Status       | Workaround                                |
| ------------------------------------- | -------- | ------------ | ----------------------------------------- |
| #8 Card selection offset (Discard)    | Critical | Confirmed    | Click N-1 to select N                     |
| #11 Card selection offset (Lay Down)  | Critical | Confirmed    | Click N-1 to select N                     |
| #13 Lay Down silent failure           | Critical | Inconsistent | Ensure valid melds, avoid modal switching |
| #14 Modal closes when switching melds | Critical | NEW          | Click on text labels only                 |

### Recommended Priority Fixes

1. **Card selection index offset** - Most impactful, breaks core gameplay
2. **Modal meld switching** - Prevents proper contract building
3. **Discard pile suit display** - Confusing but cosmetic

---

_Updated during E2E testing session - 2026-01-01_
