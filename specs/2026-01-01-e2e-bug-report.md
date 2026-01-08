# E2E Bug Report - 2026-01-01

## Test Session Details
- **Game ID**: 2mlfB_Bb
- **URL**: http://localhost:5173/game/2mlfB_Bb
- **Players**: Phone (human), Tablet (human), GrokAI (AI)
- **Starting Round**: Round 1 (2 sets)
- **Browser**: Chrome via Claude-in-Chrome MCP
- **Test Date**: 2026-01-01

## Viewport Configuration
- **Phone Tab** (631137100): Intended 375x812 (iPhone X)
- **Tablet Tab** (631137103): Intended 768x1024 (iPad Portrait)
- **Note**: Chrome resize_window affects window size, screenshots may show different dimensions

---

## Bugs Found

### BUG-001: CRITICAL - WebSocket State Sync Failure Between Clients

**Severity**: Critical (Game-breaking)
**Type**: Game Engine / WebSocket
**Discovered**: During Round 1 gameplay

#### Summary
Second client (Tablet) becomes completely desynchronized from game state after other players take turns. The WebSocket connection appears to stop receiving state updates.

#### Environment
- Game ID: 2mlfB_Bb
- Phone Tab: 631137100 (connected, receiving updates)
- Tablet Tab: 631137103 (connected but NOT receiving updates)

#### Steps to Reproduce
1. Create a new game with 2 human players + 1 AI
2. Both humans join from separate browser tabs
3. Start the game
4. Phone player takes their turn (draw + discard)
5. AI player takes their turn (draw + lay down + discard)
6. Observe Tablet client state

#### Expected Behavior
Tablet client should show:
- Current discard pile card (10♣)
- Updated player card counts (Phone: 11, GrokAI: 5)
- GrokAI's melds on the table
- Correct turn indicator ("Your turn" since it's Tablet's turn)
- Full activity log with all actions

#### Actual Behavior
Tablet client shows stale state:
- Old discard card (K♥ - the initial discard!)
- Wrong card counts (Phone: 12, GrokAI: 11)
- "No melds on the table yet" (GrokAI laid down 2 sets)
- Wrong turn indicator ("Waiting for Phone")
- Only 1 activity entry (missing 4+ actions)

#### Comparison Table
| Aspect | Phone (correct) | Tablet (stale) |
|--------|----------------|----------------|
| Discard | 10♣ | K♥ |
| GrokAI cards | 5 (Down ✓) | 11 (no down) |
| Phone cards | 11 | 12 |
| Table melds | GrokAI's 2 sets | "No melds yet" |
| Turn status | "Waiting for Tablet" | "Waiting for Phone" |

#### Likely Affected Files
- `app/party/mayi-room.ts` - PartyKit room WebSocket handling
- `app/routes/game.$gameId.tsx` - Client-side state subscription
- Possibly `app/party/ai-turn-coordinator.ts` - AI turn broadcasts

#### Impact
- Game is unplayable for the second human player
- They cannot take their turn or see current game state
- Would require page refresh to potentially resync

#### Workaround
Page refresh restores sync. After refreshing the Tablet tab, it correctly showed:
- Current discard (10♣)
- GrokAI's melds on table
- Correct card counts
- Correct turn indicator ("Your turn - Draw a card")

This confirms the server state is correct - the issue is WebSocket message delivery failing silently.

#### Root Cause Analysis
Likely causes:
1. WebSocket connection silently dropped for Tablet client
2. No automatic reconnection logic when connection is lost
3. PartyKit `this.getConnections()` may not include stale/dropped connections

#### Server Log Evidence (2026-01-02)
```
Error on connection 8db054cb-ceb2-4641-9d8e-fbcb9cee1b5c in MayIRoom:udkh21cD: [Error: Network connection lost.] { retryable: true }
Implement onError on MayIRoom to handle this error.
Error on connection 6b0d5683-853e-471e-81b2-6c4e14fdd0a5 in MayIRoom:2mlfB_Bb: [Error: Network connection lost.] { retryable: true }
Implement onError on MayIRoom to handle this error.
```

**Key Insight**: PartyKit is explicitly telling us to implement `onError` handler. The error has `retryable: true` but we're not handling reconnection.

#### Recommended Fix
1. **Implement `onError` handler in MayIRoom** - Handle connection errors and attempt reconnection
2. Add WebSocket heartbeat/ping-pong to detect dropped connections
3. Implement client-side reconnection with exponential backoff
4. On reconnect, fetch full state from server instead of relying on incremental updates
5. Consider adding connection health indicator in UI

#### Screenshots
- Phone tab screenshot: ss_4836fyjp0
- Tablet tab screenshot (before refresh): ss_5810ood7g
- Tablet tab screenshot (after refresh): ss_14316zouo

#### Second Occurrence (Same Session)
**Context**: After Tablet refreshed and played several turns, the sync issue recurred.

| Aspect | Phone (correct) | Tablet (stale) |
|--------|----------------|----------------|
| Discard | 9♣ | K♣ (3 turns old!) |
| GrokAI cards | 3 (Down ✓) | 5 |
| Jack set cards | 5 (with lay-offs) | 3 |
| Phone cards | 11 | 12 |
| Turn status | "Waiting for Tablet" | "Waiting for Phone" |

**Screenshots**: ss_5844lyvw6 (Phone), ss_6620elpt8 (Tablet)

**Conclusion**: The second occurrence may have been caused by Vite dev server HMR restart when `GameView.tsx` was edited. WebSocket connections can drop when the dev server rebuilds. This needs further testing in production or without file changes to confirm if it's a real bug or a dev environment artifact.

---

### BUG-002: FIXED - "X cards selected" Counter Persists Incorrectly

**Severity**: Minor (UI)
**Type**: UI State Management
**Status**: ✅ FIXED

#### Summary
The "X cards selected" counter in the player hand area persisted showing stale selection counts even after cards were discarded or the hand changed.

#### Root Cause
In `app/ui/game-view/GameView.tsx`, the `selectedCardIds` state (Set of card IDs) was never cleaned up when cards left the hand. If a user selected a card and then discarded it (or the hand changed for any reason), the old card ID remained in the Set.

#### Fix Applied
Added a `useEffect` hook that filters `selectedCardIds` to only include IDs that exist in the current hand:

```tsx
useEffect(() => {
  const handCardIds = new Set(gameState.yourHand.map((c) => c.id));
  setSelectedCardIds((prev) => {
    const cleaned = new Set([...prev].filter((id) => handCardIds.has(id)));
    if (cleaned.size !== prev.size) {
      return cleaned;
    }
    return prev;
  });
}, [gameState.yourHand]);
```

#### File Modified
- `app/ui/game-view/GameView.tsx` (lines 58-70)

---

### BUG-003: FIXED - "(You)" Label Appears on Wrong Player's Meld Section

**Severity**: Minor (UI)
**Type**: UI Display Logic
**Status**: FIXED

#### Summary
When viewing the game table, the "(You)" label appeared next to other players' meld sections instead of only appearing for the viewing player's melds.

#### Root Cause
The `TableDisplay` component was using `currentPlayerId` (the active turn player) instead of `viewingPlayerId` (the player viewing the game) to determine the "(You)" label.

#### Fix Applied
1. Added `viewingPlayerId` prop to `TableDisplay` component
2. Passed `viewingPlayerId` to `PlayerMeldsDisplay` as `isViewingPlayer`
3. Distinguished between `isActiveTurn` (for highlighting) and `isViewingPlayer` (for "(You)" label)

#### Files Modified
- `app/ui/game-table/TableDisplay.tsx`
- `app/ui/game-table/PlayerMeldsDisplay.tsx`
- `app/ui/game-view/GameView.tsx`

---

### BUG-004: Card Suit Data Mismatch (Visual vs Data Attributes)

**Severity**: Medium (Data Integrity)
**Type**: Game Engine / Card Data
**Status**: Open - Needs Investigation

#### Summary
Card visual rendering shows different suit symbols than what the data attributes indicate. For example, a card visually displays as 8♣ (clubs) but `data-card-suit="spades"`.

#### Evidence
When querying cards in the LayDownView modal:
```
[
  {"rank": "8", "suit": "spades", "testid": "card-8-spades"},
  {"rank": "8", "suit": "diamonds", "testid": "card-8-diamonds"},
  {"rank": "8", "suit": "spades", "testid": "card-8-spades"}  // Duplicate!
]
```
But visually the cards showed: 8♠, 8♣, 8♦ (one spades, one clubs, one diamonds)

#### Impact
- Card selection via data-testid may select wrong card
- Automation/testing is unreliable
- May indicate deeper card deck initialization issues

#### Additional Evidence (Confirmed 2026-01-01)
During Lay Down modal testing, card data-testid attributes did not match visual rendering:

1. **Ace Mismatch**: Card visually displayed as A♠ (black spade) but data showed:
   - `data-testid="card-A-clubs"` (should be spades)
   - `data-card-suit="clubs"` (but visual shows spades)

2. **Seven Mismatch**: Card visually displayed as 7♠ (black spade) but data showed:
   - `data-testid="card-7-clubs"` (should be spades)
   - `data-card-id="card-33"` with `suit="clubs"`

#### Root Cause Hypothesis
The visual rendering in PlayingCard.tsx uses the `suit` property from the card data to determine:
- Color (red for hearts/diamonds, black for clubs/spades)
- Symbol (♥♦♣♠)

But the data appears to have incorrect suit values stored. This could be:
1. Card deck initialization generating wrong suit values
2. Card ID to suit mapping issue
3. Card data corruption during game state transfers

#### Needs Investigation
- Check card deck generation in `core/card/`
- Verify card ID to suit mapping
- Check if this is a rendering issue or data issue
- Test: Query all cards in deck and verify visual matches data

---

### BUG-005: LayOff Modal - Meld Selection Not Working

**Severity**: Medium (UI Interaction)
**Type**: UI Event Handling
**Status**: Open

#### Summary
In the Lay Off modal, clicking on a meld container to add the selected card does not trigger the lay off action. The card remains selected but clicking melds has no effect.

#### Steps to Reproduce
1. Open a game where you are down (have laid down your contract)
2. Draw a card that could be laid off to an existing meld (e.g., draw 8♥ when there's an 8s set on the table)
3. Click "Lay Off" button to open the modal
4. Click on a card in your hand to select it (shows "1 card selected")
5. Click on the target meld to add the card

#### Expected Behavior
The selected card should be added to the clicked meld, the card should disappear from your hand, and the meld should show the new card.

#### Actual Behavior
Nothing happens. The card remains selected, the meld is unchanged, and no lay off occurs. No error messages appear.

#### Technical Investigation
The LayOffView component (`app/ui/lay-off-view/LayOffView.tsx`) shows:
- Meld containers have `onClick={() => handleMeldClick(meld.id)}`
- `handleMeldClick` calls `onLayOff(selectedCardId, meldId)`
- The click handler checks `if (!selectedCardId) return;`

Possible causes:
1. Event bubbling issue - PlayingCard buttons inside melds may be capturing clicks
2. The meld container div click is not registering due to nested button elements
3. React state update issue

#### Likely Affected Files
- `app/ui/lay-off-view/LayOffView.tsx` - Click handler on meld containers
- `app/ui/game-table/MeldDisplay.tsx` - Meld rendering (contains clickable cards)

---

### BUG-006: Activity Log Shows Wrong Card Suit

**Severity**: Minor (UI Display)
**Type**: Activity Log
**Status**: Open

#### Summary
The activity log displays incorrect suit symbols for discarded cards. The suit shown in the activity log doesn't match the visual card displayed on the discard pile.

#### Evidence
Multiple occurrences during Round 1:
1. Tablet discarded a card visually showing 10♦ (red diamond), but activity log showed "Tablet: discarded 10♠"
2. Card visually displayed as 8♥ (red heart) on discard, activity log showed "Tablet: discarded 8♥" but another view showed 8♠

#### Relationship to BUG-004
This may be the same root cause as BUG-004 (card suit visual/data mismatch) manifesting in the activity log formatting.

---

### BUG-007: Redundant "(You)" Label on Viewing Player's Melds

**Severity**: Minor (UI)
**Type**: UI Display Logic
**Status**: Open

#### Summary
The meld section header shows "You (You)" - the player name is already "You" and then the "(You)" suffix is also appended, making it redundant.

#### Steps to Reproduce
1. Join a game as any player
2. Lay down your contract to create melds
3. Look at the Table section showing your melds

#### Expected Behavior
The Table area should show just "You" or "Your melds" for the viewing player's section.

#### Actual Behavior
Shows "You (You)" which is redundant.

#### Root Cause
In `GameView.tsx`, the viewing player's name is set to "You" (line 157). Then in `PlayerMeldsDisplay.tsx`, when `isViewingPlayer=true`, it appends "(You)" as a suffix. Combined, this creates "You (You)".

#### Recommended Fix
In `PlayerMeldsDisplay.tsx`, only show the "(You)" suffix when `playerName !== "You"`:
```tsx
{isViewingPlayer && playerName !== "You" && (
  <span className="ml-2 text-xs font-normal text-muted-foreground">
    (You)
  </span>
)}
```

#### Screenshots
- ss_22370j36a (Phone view showing "You (You)")
- ss_3067w2y3q (Tablet view showing "You (You)")

#### Likely Affected Files
- `app/ui/game-table/PlayerMeldsDisplay.tsx` (line 38-42)

---

## Test Progress Log

### Round 1 - Starting State
- Phone: 11 cards (3♦, 4♦, Joker, 7♥, 9♣, K♣, 8♦, 4♣, 7♣, A♥, A♣)
- Tablet: 11 cards (5♥, 8♠, 3♣, 7♣, A♣, 2♠, 7♦, 2♥, K♣, 8♣, 2♣)
- GrokAI: 11 cards
- Discard: K♥
- Turn: Phone

### Round 1 - Current State (Session End)
- Phone: 5 cards (3♦, 4♦, 4♠, 3♣, Joker) - DOWN ✓
- Tablet: 5 cards (5♥, 2♦, 2♣, 5♦, 5♥) - DOWN ✓
- GrokAI: 1 card - DOWN ✓ (stuck at 1 card for many turns!)
- All players are down
- Discard pile: K♦
- Turn: Phone (needs to draw)
- GrokAI appears unable to go out despite having only 1 card

### Melds on Table
**Phone (You):**
- Set: A♥, A♠, A♠, A♥ (4 Aces)
- Set: 7♠, Joker, 7♠ (7s with wild)

**Tablet:**
- Set: 8♠, 8♠, 8♦, 8♠ (4 Eights)
- Set: 7♣, 7♦, 2♠ (7s with wild 2)

**GrokAI:** (not visible in table - may have no melds displayed?)

### Observations
1. **WebSocket sync issues (BUG-001)**: Required page refresh multiple times to sync state between tabs
2. **BUG-003 FIXED**: "(You)" label now correctly appears only on the viewing player's melds
3. **BUG-004 confirmed**: Card suit visual/data mismatch observed multiple times
4. **BUG-005 discovered**: LayOff modal meld click doesn't work
5. **BUG-006 discovered**: Activity log shows wrong suit symbols
6. **BUG-007 discovered**: Redundant "(You)" label - shows "You (You)" instead of just "You"

### GrokAI Behavior Note
GrokAI has been stuck at 1 card for many turns. They keep drawing and discarding but cannot go out. This may indicate:
- Their remaining card cannot be laid off to any existing meld
- A potential issue with AI decision-making for going out
- The card they hold doesn't match any meld on the table
- **Note**: GrokAI's melds are not visible in the table display - may be a rendering bug or they have no melds

---

## Session Summary

**Test Session Duration**: ~2+ hours (across context compactions)
**Round Progress**: Round 1 still in progress (not completed)

### Bugs Found This Session
| Bug | Severity | Status | Description |
|-----|----------|--------|-------------|
| BUG-001 | Critical | Open | WebSocket state sync failure |
| BUG-002 | Minor | FIXED | Card selection counter persistence |
| BUG-003 | Minor | FIXED | "(You)" label on wrong player |
| BUG-004 | Medium | Open | Card suit visual/data mismatch |
| BUG-005 | Medium | Open | LayOff modal meld click not working |
| BUG-006 | Minor | Open | Activity log wrong card suit |
| BUG-007 | Minor | Open | Redundant "(You)" label |

### Priority for Next Session
1. **BUG-001** - Critical WebSocket sync issue (game-breaking)
2. **BUG-005** - LayOff click not working (feature-blocking)
3. **BUG-004/006** - Card suit mismatch (data integrity)
4. **BUG-007** - Redundant label (easy fix)

