# Family Testing Issues Backlog

Issues collected from family testing sessions.

---

## FT-1001: Organize cards without save button - allow organizing at any point

**Description:** Currently, organizing cards requires entering a dedicated OrganizeHandView with Save/Cancel buttons. Users want to be able to organize their hand at any point without needing to save - changes should apply immediately or automatically.

**Replication Steps:**
1. Start a game and get cards dealt
2. Click "Organize" button in the action bar
3. Rearrange cards (select + arrow buttons, or sort buttons)
4. Must click "Save" to apply changes

**Expected vs Actual:**
- **Expected:** Organizing should be frictionless - drag to reorder immediately, no save button needed
- **Actual:** Must enter organize mode, make changes, then click Save

**Relevant Files:**
- `app/ui/organize-hand/OrganizeHandView.tsx` - Current organize UI with Save/Cancel buttons
- `app/ui/game-view/GameView.tsx:147-153` - handleOrganize sends REORDER_HAND action
- `app/ui/action-bar/ActionBar.tsx:125-134` - Organize button (only visible during your turn)
- `core/engine/hand.reordering.ts` - Sort functions (sortHandByRank, sortHandBySuit)

---

## FT-1002: Bug with laying off - can't click card

**Description:** Users report being unable to click/select a card when in the lay-off view. The card click handler may not be working correctly.

**Replication Steps:**
1. Lay down your contract in a previous turn
2. On a subsequent turn, draw a card
3. Click "Lay Off" button to enter lay-off mode
4. Try to click on a card in your hand to select it
5. Card may not respond to clicks

**Expected vs Actual:**
- **Expected:** Clicking a card in LayOffView should select it (highlight it)
- **Actual:** Card click may not register or card may not become selected

**Relevant Files:**
- `app/ui/lay-off-view/LayOffView.tsx:43-46` - handleCardClick toggles selectedCardId
- `app/ui/lay-off-view/LayOffView.tsx:98-103` - HandDisplay with onCardClick
- `app/ui/player-hand/HandDisplay.tsx` - HandDisplay component
- `app/ui/playing-card/PlayingCard.tsx:129-193` - PlayingCard button with onClick

---

## FT-1003: Organize by dragging on tablet/desktop

**Description:** On tablet or desktop, users expect to be able to drag cards to reorder them, not just use arrow buttons. Drag-and-drop is more natural for touch/mouse input.

**Replication Steps:**
1. Open game on tablet or desktop
2. Click "Organize" to enter organize mode
3. Try to drag a card to a new position
4. Dragging doesn't work - must use arrow buttons

**Expected vs Actual:**
- **Expected:** Drag cards to reorder them directly (like physical cards)
- **Actual:** Can only select a card and use Left/Right arrow buttons to move it

**Relevant Files:**
- `app/ui/organize-hand/OrganizeHandView.tsx` - Current implementation with arrow buttons
- `app/ui/player-hand/HandDisplay.tsx` - Hand display (would need drag handlers)
- Consider using a library like `@dnd-kit/core` or `react-beautiful-dnd`

---

## FT-1004: Runs descending are rejected

**Description:** When laying down a run with cards in descending order (e.g., K-Q-J-10), it's rejected as invalid even though the cards would form a valid run if reordered.

**Replication Steps:**
1. Have cards that form a valid run (e.g., 10, J, Q, K of hearts)
2. Enter lay down mode
3. Add cards to a run meld in descending order (K first, then Q, J, 10)
4. Click "Lay Down"
5. Error: Invalid run

**Expected vs Actual:**
- **Expected:** System should accept the run regardless of the order cards were added, or auto-sort them
- **Actual:** Runs must be added in ascending order; descending order is rejected

**Relevant Files:**
- `core/meld/meld.validation.ts:96-175` - `isValidRun` checks cards are in ascending order (line 142-145)
- `app/ui/lay-down-view/LayDownView.tsx` - Cards added in click order
- Could add auto-sorting before validation, or reorder in handleLayDown

---

## FT-1005: Gemini AI not working

**Description:** When selecting Gemini as the AI model, it may not be functioning correctly. Could be API key issues or model ID mismatch.

**Replication Steps:**
1. In lobby, click "Add AI Player"
2. Select "Gemini" as the model
3. Start the game
4. Observe AI behavior or check console for errors

**Expected vs Actual:**
- **Expected:** Gemini AI makes valid moves
- **Actual:** Gemini may fail or produce errors

**Relevant Files:**
- `ai/modelRegistry.ts:72-77` - CANONICAL_MODELS defines `gemini: "gemini-3-flash-preview"`
- `app/party/ai-model-factory.ts:98-99` - Maps `default:gemini` to `"gemini-3-flash-preview-20241219"`
- Check if `GOOGLE_GENERATIVE_AI_API_KEY` env var is set
- `ai/modelRegistry.ts:49-51` - Gemini provider creation

---

## FT-1006: Remember user's name when starting new game

**Description:** When starting a new game (different room), users have to re-enter their name. The name should be remembered across games.

**Replication Steps:**
1. Join a game and enter your name (e.g., "Drew")
2. Game ends or you leave
3. Start/join a new game (different room ID)
4. Prompted to enter name again

**Expected vs Actual:**
- **Expected:** Name is remembered (localStorage) and pre-filled or auto-used for new games
- **Actual:** Each room has its own sessionStorage key, name not shared across rooms

**Relevant Files:**
- `app/routes/game.$roomId.tsx:36-60` - Uses `sessionStorage` with room-specific keys
- `app/routes/game.$roomId.tsx:54-60` - `getStoredPlayerName` / `storePlayerName` are room-specific
- Change to use `localStorage` with a global key, or use both (global + room override)

---

## FT-1007: AI character personas - predefined set with name, model, avatar

**Description:** Instead of manually naming AI players, provide a set of predefined AI "characters" with fixed names, personalities, and avatars. Users just pick from the list.

**Replication Steps:**
1. In lobby, click "Add AI Player"
2. Must manually type a name
3. No avatar/personality options

**Expected vs Actual:**
- **Expected:** Pick from predefined characters (e.g., "Grandma Rose - Claude", "Uncle Bob - GPT")
- **Actual:** Manual name entry + model selection

**Relevant Files:**
- `app/ui/lobby/AddAIPlayerDialog.tsx` - Dialog for adding AI players
- `app/ui/lobby/AIPlayersList.tsx` - Displays added AI players
- `app/party/protocol.types.ts` - AIModelId type definition
- Would need new character data structure with name, model, avatar

---

## FT-1008: Add start new game button

**Description:** After a game ends, there's no button to start a new game. Users have to navigate away and create a new room.

**Replication Steps:**
1. Complete a full game (all 6 rounds)
2. See GameEndScreen
3. Only option is "Leave" button
4. No way to start another game with same players

**Expected vs Actual:**
- **Expected:** "New Game" button that resets the room to lobby state
- **Actual:** Only "Leave" option, must create new room manually

**Relevant Files:**
- `app/ui/game-transitions/GameEndScreen.tsx` - End screen with only "Leave" button
- `app/party/mayi-room.ts` - Would need new message type to reset room to lobby
- Would need to clear game state and set roomPhase back to "lobby"

---

## FT-1009: Multi-select to add to meld when laying down

**Description:** When laying down, users want to select multiple cards at once and add them all to a meld, rather than clicking one card at a time.

**Replication Steps:**
1. Enter lay down mode
2. Have multiple cards for a meld (e.g., 4 cards for a run)
3. Must click each card individually to add to the meld
4. Tedious for large melds

**Expected vs Actual:**
- **Expected:** Select multiple cards first, then click the meld to add all at once
- **Actual:** Single card selection only - click card, it immediately adds to active meld

**Relevant Files:**
- `app/ui/lay-down-view/LayDownView.tsx:49-63` - handleCardClick adds single card
- Would need to change to multi-select pattern (like GameView's selectedCardIds Set)
- Then add a "Add to Meld" button or gesture

---

## FT-1010: Card suit size too small - hard to distinguish spades vs clubs

**Description:** The suit symbols (especially spades ♠ and clubs ♣) are too small to easily distinguish, especially on smaller screens.

**Replication Steps:**
1. Look at cards with spades or clubs
2. Try to quickly identify the suit
3. Hard to tell ♠ from ♣ at small sizes

**Expected vs Actual:**
- **Expected:** Suits are easily distinguishable at all sizes
- **Actual:** ♠ and ♣ look very similar at small sizes

**Relevant Files:**
- `app/ui/playing-card/PlayingCard.tsx:11-15` - SIZE_CLASSES define card dimensions
- `app/ui/playing-card/PlayingCard.tsx:84-89` - CornerContent renders rank and suit
- Suit symbol is just text (`suitSymbol`) - consider making it larger or using icons
- Lines 86-87: suit display with `-mt-0.5` spacing

---

## FT-1011: May-I button confusion - allowing vs requesting

**Description:** The "May I?" button is confusing. It's used both to REQUEST a May I (when it's not your turn) and the resolution buttons (Allow/Claim) are separate. Users are confused about the flow.

**Replication Steps:**
1. Wait for another player's turn
2. See "May I?" button
3. Click it to request the discard
4. Dialog appears for other player asking to Allow/Claim
5. Users confused about who clicks what and when

**Expected vs Actual:**
- **Expected:** Clearer UX - maybe confirmation dialog when requesting, clearer indication of what's happening
- **Actual:** Single "May I?" button with no confirmation, state change isn't obvious

**Relevant Files:**
- `app/ui/action-bar/ActionBar.tsx:99-103` - "May I?" button for requesting
- `app/ui/action-bar/ActionBar.tsx:106-115` - Allow/Claim buttons for resolution
- `app/ui/may-i-request/MayIPromptDialog.tsx` - Dialog shown to player being prompted
- Consider adding confirmation or clearer state indication

---

## FT-1012: May-I button doesn't indicate waiting state after click

**Description:** After clicking "May I?", the button remains enabled and doesn't show that you're now waiting for other players to respond.

**Replication Steps:**
1. Wait for another player's turn
2. Click "May I?" button
3. Button still shows "May I?" and looks clickable
4. No indication that request is pending

**Expected vs Actual:**
- **Expected:** After clicking, button should change to "Waiting..." or disable, show pending state
- **Actual:** Button looks the same, can click multiple times

**Relevant Files:**
- `app/ui/action-bar/ActionBar.tsx:99-103` - Button visibility driven only by `canMayI`
- `core/engine/game-engine.availability.ts` - Determines canMayI based on game state
- Need to track "pending May I request" state and show in UI
- GameView could track local "mayI requested" state

---

## FT-1013: Hand overflow on iPad with 15+ cards

**Description:** When a player has many cards (15+), the hand display overflows the iPad screen and cards become inaccessible.

**Replication Steps:**
1. Accumulate 15+ cards in hand (through May I's or not being able to lay down)
2. View on iPad
3. Cards extend beyond visible area
4. Cannot see or interact with all cards

**Expected vs Actual:**
- **Expected:** Hand should scale down or increase overlap based on card count to fit screen
- **Actual:** Fixed overlap/size regardless of card count, overflow occurs

**Relevant Files:**
- `app/ui/player-hand/HandDisplay.tsx:17-28` - OVERLAP constants are fixed
- `app/ui/hand-drawer/HandDrawer.tsx` - Mobile drawer with fixed sizing
- Could calculate overlap dynamically based on container width and card count
- Or add horizontal scroll with scroll indicators

---

## FT-1014: Auto-fix out-of-order runs that are actually valid

**Description:** If a player lays down cards for a run in the wrong order (but the cards ARE valid for a run), the system should auto-sort them instead of rejecting.

**Replication Steps:**
1. Have cards like 10♥, J♥, Q♥, K♥
2. Enter lay down mode and select run meld
3. Add in order: Q, K, J, 10 (wrong order but valid cards)
4. Click "Lay Down"
5. Rejected as invalid run

**Expected vs Actual:**
- **Expected:** System detects valid run cards and auto-sorts to correct order
- **Actual:** Strict position validation fails because cards aren't in ascending order

**Relevant Files:**
- `core/meld/meld.validation.ts:136-145` - Checks naturals are in increasing order
- `app/ui/lay-down-view/LayDownView.tsx:80-82` - onLayDown sends melds as-is
- Could sort cards by rank before validation in handleLayDown
- Or add helper function `sortRunCards()` to reorder before sending

---

## FT-1015: Show AI reasoning tokens

**Description:** Display the AI's thinking/reasoning when it makes decisions, so players can understand why the AI made certain moves.

**Replication Steps:**
1. Play against AI players
2. AI makes a move
3. No visibility into why that move was chosen

**Expected vs Actual:**
- **Expected:** Show AI reasoning in activity log or expandable panel
- **Actual:** Only see the action taken, not the reasoning

**Relevant Files:**
- `ai/mayIAgent.ts` - AI agent implementation
- `app/party/ai-turn-handler.ts` - Executes AI turns
- `app/ui/game-view/AIThinkingIndicator.tsx` - Shows "AI is thinking..."
- Would need to capture and broadcast reasoning from AI SDK response

---

## FT-1016: Lay down dialog needs scrolling for 3-meld contracts in landscape

**Description:** When contract requires 3 melds (e.g., 2 sets + 1 run), in landscape mode the LayDownView doesn't fit on screen and content is cut off with no scrolling.

**Replication Steps:**
1. Reach a round with 3-meld contract (e.g., round 3: 2 sets + 1 run)
2. Hold iPad in landscape orientation
3. Click "Lay Down" to enter lay down mode
4. Can't see all melds + hand + buttons - content cut off at bottom

**Expected vs Actual:**
- **Expected:** Content should scroll to access all melds and action buttons
- **Actual:** Content is cut off, no scrolling available

**Relevant Files:**
- `app/ui/lay-down-view/LayDownView.tsx` - Uses flex layout, no scroll container
- `app/ui/responsive-drawer/ResponsiveDrawer.tsx:82` - Has `overflow-hidden` on content div
- Need to change to `overflow-y-auto` and ensure proper flex sizing
- Line 82: `<div className="px-4 pb-4 flex-1 min-h-0 overflow-hidden flex flex-col">`

---

## FT-1017: May-I click causes "Invalid contract is not two-session run" error

**Description:** Clicking May-I sometimes causes an error message about invalid contract/run, even though the user was just trying to call May I (not lay down).

**Replication Steps:**
1. Wait for another player's turn
2. Click "May I?" button (possibly multiple times)
3. Error appears: "Action failed: Invalid contract is not two-session run"
4. Error message doesn't match the action attempted

**Expected vs Actual:**
- **Expected:** May I action should succeed or fail with relevant error
- **Actual:** Error message references "contract" validation that's unrelated to May I

**Relevant Files:**
- `app/party/game-actions.ts` - executeGameAction handles CALL_MAY_I
- `app/routes/game.$roomId.tsx:364-379` - Error handling from server
- Possible bug: error from previous failed action being shown for May I action
- Or CALL_MAY_I handler is incorrectly triggering contract validation

---

## FT-1018: Wild card lay-off position on runs - allow start or end always

**Description:** When laying off a wild card onto a run, users should always be able to choose start or end position (when both are valid). Currently the position choice may be inconsistent.

**Replication Steps:**
1. Have a wild card (2 or Joker) in hand
2. There's a run on table (e.g., 5-6-7 of hearts)
3. Try to lay off the wild card
4. May not get option to choose start vs end position

**Expected vs Actual:**
- **Expected:** Always prompt for position choice when wild can go at either end
- **Actual:** `needsPositionChoice` only prompts when BOTH ends are valid, otherwise auto-places

**Relevant Files:**
- `core/engine/layoff.ts:323-334` - `needsPositionChoice` function
- `app/ui/lay-off-view/LayOffView.tsx:54-56` - Shows position dialog when needed
- `app/ui/lay-off-view/LayOffView.tsx:107-136` - Position selection UI
- Issue may be in run bounds detection or auto-placement logic

---

## FT-1019: Activity feed should show most recent at top

**Description:** The activity log shows oldest entries first. Users expect to see the most recent activity at the top without scrolling.

**Replication Steps:**
1. Play several turns to generate activity
2. Look at the Activity section
3. Most recent activity is at the bottom
4. Have to scroll to see latest

**Expected vs Actual:**
- **Expected:** Most recent activity at top (reverse chronological)
- **Actual:** Oldest at top, newest at bottom

**Relevant Files:**
- `app/ui/game-status/ActivityLog.tsx:20` - `displayEntries = entries.slice(-maxEntries)` takes last N entries
- But displays in original order (oldest first in array)
- Need to reverse: `entries.slice(-maxEntries).reverse()` or render in reverse order

---

## FT-1020: Intermittent connection drops - shows waiting even when it's your turn

**Description:** Connection sometimes drops silently. UI shows "Waiting for other players..." even though it's actually the player's turn. Refreshing fixes it.

**Replication Steps:**
1. Play game for a while
2. Notice UI stops updating
3. Shows "Waiting for other players..."
4. But it's actually your turn (other players see you as current player)
5. Refresh page to resync

**Expected vs Actual:**
- **Expected:** Connection drops are detected and auto-reconnect happens, or clear error shown
- **Actual:** Silent connection drop, stale UI state, no reconnection

**Relevant Files:**
- `app/routes/game.$roomId.tsx:304-330` - WebSocket setup with PartySocket
- `app/routes/game.$roomId.tsx:325-328` - onclose/onerror just set status to disconnected
- PartySocket should auto-reconnect, but state may not sync properly
- May need to re-request game state on reconnect

---

## FT-1021: May-I button covers discard pile card suit on phone

**Description:** On mobile, the May-I button is positioned such that it covers part of the discard pile card, making it hard to see the suit.

**Replication Steps:**
1. Open game on phone (mobile view)
2. Wait for another player's turn (May I? button visible)
3. Look at discard pile
4. Button overlaps/covers the card's suit indicator

**Expected vs Actual:**
- **Expected:** Button positioned to not obscure the discard card
- **Actual:** Button overlaps with the card, covering suit

**Relevant Files:**
- `app/ui/hand-drawer/HandDrawer.tsx:203-210` - Discard pile display in drawer
- `app/ui/game-table/DiscardPileDisplay.tsx` - Shows interactive label overlay
- Button may be positioned via `interactiveLabel` overlay
- Consider repositioning label or adjusting z-index/layout

---

## FT-1022: Lay-off should allow retracting card before saving

**Description:** After adding a card to a meld during lay-off, there's no way to undo/retract before clicking Done. Should be able to remove the card and try a different meld.

**Replication Steps:**
1. Enter lay-off mode
2. Select a card
3. Click on a meld to add card to it
4. Realize you wanted to add to different meld
5. No way to undo - card is already sent to server

**Expected vs Actual:**
- **Expected:** Lay-off should be staged locally, with ability to remove before committing
- **Actual:** Each lay-off immediately sends to server (no undo)

**Relevant Files:**
- `app/ui/lay-off-view/LayOffView.tsx:48-61` - handleMeldClick immediately calls onLayOff
- `app/ui/game-view/GameView.tsx:119-125` - handleLayOff sends action immediately
- Would need to add local staging state in LayOffView, only send on "Done" click
- Similar to how LayDownView stages cards before sending

---

## FT-1023: Players table UI - nested borders issue, move contract in

**Description:** The players table has nested borders (table has border, rows have borders) which looks cluttered. Also, contract info should be moved into the players section.

**Replication Steps:**
1. Look at the Players section in game view
2. Notice table border + row borders = double lines
3. Contract shown separately in header

**Expected vs Actual:**
- **Expected:** Clean single border, contract integrated into players section
- **Actual:** Nested borders look cluttered, contract separate from players

**Relevant Files:**
- `app/ui/game-status/PlayersTableDisplay.tsx:28` - Outer border `rounded-lg border`
- `app/ui/game-status/PlayersTableDisplay.tsx:46` - Row border `border-t border-border`
- `app/ui/game-view/GameView.tsx:274-284` - Players section separate from contract in header
- Consider removing outer border or using dividers instead of row borders

---

## FT-1024: Round end popup buggy - flashes, doesn't show, or shows late

**Description:** The RoundEndOverlay has inconsistent behavior. Sometimes it flashes briefly, sometimes doesn't appear, sometimes appears after the next round has started.

**Replication Steps:**
1. Complete a round (someone goes out)
2. Watch for round end popup
3. May: flash briefly, not appear at all, or appear delayed

**Expected vs Actual:**
- **Expected:** Popup reliably appears, stays visible for countdown, then dismisses
- **Actual:** Inconsistent - sometimes works, sometimes flashes, sometimes skipped

**Relevant Files:**
- `app/routes/game.$roomId.tsx:426-432` - Sets roundEndData on ROUND_ENDED message
- `app/routes/game.$roomId.tsx:508-516` - Renders RoundEndOverlay when roundEndData exists
- `app/ui/game-transitions/RoundEndOverlay.tsx:25-36` - Auto-dismiss countdown
- Race condition: GAME_STATE update may clear roundEndData before overlay shows
- Or multiple ROUND_ENDED messages causing state thrashing

---
