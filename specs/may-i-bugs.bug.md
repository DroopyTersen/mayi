# May-I Bug Cluster

**Issues:** #69, #71, #72, #73
**Reported:** 2026-01-18
**Context:** 3 human players (Mom/Kate, Dad, Jane), no AI, Round 5

---

## #73 - Penalty card same ID as claimed discard

**Priority:** Critical
**Column:** Refinement
**Reporter:** Jane

### Symptoms
1. Player calls May-I for a card (e.g., 7♥)
2. Receives discard (7♥) + penalty card which is ALSO 7♥ (same rank and suit)
3. Player discards one of the 7♥ cards
4. BOTH 7♥ cards disappear from hand
5. Later, one of the supposedly-discarded cards reappears in hand

### Technical Notes from Issue
- With 2 decks, having two cards of same rank+suit is valid
- Each should have UNIQUE card IDs (e.g., `hearts-7-0` vs `hearts-7-1`)
- Cards behaving as "same card" suggests identical IDs were assigned
- In `round.machine.ts:427-444`, penalty card comes from stock, discard comes from discard pile - should be different IDs

### Potential Areas
- `core/card/card.deck.ts` - deck creation and ID assignment
- `core/engine/round.machine.ts:427-444` - penalty card assignment
- State sync after May-I where stock might get corrupted

---

## #72 - Lay down corruption after allowing May-I

**Priority:** Critical
**Column:** Approved
**Reporter:** Dad

### Symptoms
1. Player A (current turn) is prompted by Player B's May-I request
2. Player A clicks "Allow" - Player B receives discard + penalty card
3. Player A (still their turn) attempts to lay down 2 sets
4. Both sets show duplicate cards that won't move into the meld properly
5. Repeated attempts cause "boatload of duplicates" to appear in hand view
6. Duplicates disappear after canceling lay down
7. When discarding a "duplicate" card, BOTH copies are removed from hand
8. Player ends up with 10 cards instead of expected count

### Technical Notes from Issue
- Previous May-I duplicate fixes (#44, #41, #43) focused on AI state merge - this is a human-only game, different code path
- `.filter(c => c.id !== cardId)` removes ALL matching IDs, but `.find()` only gets one card
- If duplicate IDs exist in hand, discard removes multiple but only adds one to pile
- Issue likely stems from state desync between RoundMachine and TurnMachine after May-I resolution

### Potential Areas
- `core/engine/round.machine.ts:468-472` (syncTurnPiles action)
- `core/engine/turn.machine.ts:448-451` (syncHand action)
- May-I resolution flow when current player allows

---

## #71 - May-I dialog unresponsive on mobile

**Priority:** High
**Column:** Approved
**Reporter:** Jane

### Symptoms
- Player on phone receives May-I prompt
- Clicks button to respond
- Nothing happens - UI frozen/stuck
- Refresh brings popup back (May-I not resolved server-side)

### Technical Notes from Issue
- `MayIPromptDialog` sends `GAME_ACTION` with `ALLOW_MAY_I` or `CLAIM_MAY_I` via WebSocket
- `setMayIPrompt(null)` is called client-side immediately after sending
- If popup reappears after refresh, server never received/processed the action
- Could be: WebSocket send failing silently, touch event not registering, or action being rejected server-side

### Related Context (from human comment)
- Bug was reported during testing of a **stale app version** (before recent deploys)
- #50 (Done): May-I auto-acceptance bug + timeout increase - may address this
- Need to verify on latest deployed version before investigating

### Potential Areas
- `app/routes/game.$roomId.tsx:276-282` (onAllowMayI/onClaimMayI handlers)
- `app/ui/may-i-request/MayIPromptDialog.tsx` (button click handling on mobile)
- `app/party/mayi-room.ts` (server-side action processing)

---

## #69 - Organize hand card stacking

**Priority:** Medium
**Column:** Tech Design
**Reporter:** Kate (Mom)

### Symptoms
- Two identical cards (same rank+suit, e.g., two 6♥) visually stack on top of each other
- Cannot select/move cards after attempting to organize duplicates
- Moving other cards (e.g., 8♦ next to 7♦) fails

### User Quote
> "My organizing got messed up when I got two six of hearts and tried to move them together. Then I tried to move the 8 of diamonds by the 7 but it wouldn't take it."

### Refinement Finding
**Investigation confirmed this is NOT an ID collision bug:**
- Cards receive unique sequential IDs at deck creation (`card-0`, `card-1`, `card-2`...)
- All card operations correctly use `card.id`
- React keys are set to `card.id`, so identical rank+suit cards are tracked separately
- Multi-deck duplicate handling is explicitly tested in `contracts.test.ts`

### Actual Root Cause Candidates (from refinement)
1. **CSS/Animation artifacts** - HandDisplay uses CSS transitions; identical-looking cards may appear to "stack" during animation
2. **State desync** - `selectedIndex` may get out of sync with `cards` array during rapid interactions
3. **Container query triple-render** - Auto-size mode renders each card 3x (sm/md/lg) which could cause visual artifacts
4. **Touch event issues** - On mobile, wrong card's onClick might fire for visually identical cards

### Status
- In Tech Design with 4 design options proposed (3 Claude + 1 Codex)
- Awaiting human selection on approach
- **Independent from #72/#73** - different root cause

---

## Investigation Progress

### Work Completed (Commit `0946c77`)

Added defensive duplicate ID detection:
- `findDuplicateCardIds()` in `core/engine/game-engine.ts:40-72`
- Scans all hands, stock, discard, and table for duplicate IDs
- `getSnapshot()` surfaces duplicates via `lastError`

### Tests Added
- `game-engine.test.ts` - verifies invariant catches corrupted snapshots
- `game-engine.mayi-duplicate-repro.test.ts` - manufactured corruption test
- `roundMachine.mayI.test.ts` - round-5 multi-May-I sequence (passes - no dupes in normal flow)

### Key Finding
Normal May-I engine operations do NOT produce duplicate IDs. The bug is triggered by something else - possibly WebSocket layer, state sync timing, or persistence/hydration.

### Defensive Fix (Commit `6b8b222`)

Added purge of duplicate card IDs from stock during May-I resolution:
- In `grantMayICardsToWinner` action (`round.machine.ts`)
- Filters out any card from stock that matches the claimed discard ID
- Prevents duplicate IDs if stock was somehow corrupted
- Test added: "skips duplicate stock cards that match the claimed discard"

---

## Testing Context

All bugs reported during same testing session:
- **Players:** 3 humans (Mom/Kate, Dad, Jane), no AI
- **Round:** 5 (later round = more state transitions)
- **App Version:** Stale - before #50, #55, #44, #41 fixes were deployed
- **May-I usage:** Multiple throughout game (not rapid succession)

---

## Relationship Between Issues

```
#73 (penalty card ID) ──┬──► Likely same root cause
#72 (lay down corrupt) ─┘    (duplicate IDs in state)

#71 (mobile dialog) ─────► Possibly unrelated (touch/WebSocket issue)
                           May be fixed by #50

#69 (organize stacking) ─► Confirmed different root cause
                           (UI/CSS issue, not ID collision)
```
