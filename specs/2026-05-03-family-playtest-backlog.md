# May 3 Family Playtest Backlog

**Source:** 3-player all-human session with Mom on iPad, Andrew on iPhone, Dad on Android.
**Goal:** Convert observations into small, testable backlog items and identify the low-hanging fixes first.
**Working principle:** Prefer minimal, elegant fixes. If recon shows a fix is not simple, pause and defer it.
**Rules source of truth:** `docs/house-rules.md`. All behavior must align to Grandma Jeanne's House Rules.

## House-Rules Anchors

- Runs are 4 or more cards of the same suit in consecutive order.
- Sets are 3 or more cards of the same rank; duplicate suits are valid because this is a multi-deck game.
- Hands 1-5 laydown must be exactly the contract, no extra cards.
- No layoff on the same turn as initial laydown.
- Layoff requires drawing first, is only after already being down from a previous turn, has no wild-ratio limit, and does not exist in Hand 6.
- Hand 6 is different: laying down requires using every card, immediately wins, has no discard, no layoff, and no joker swaps.
- Joker swaps are only from runs, only before the player has laid down, and only after the required draw.
- May-I has no per-hand limit and must settle promptly while preserving turn-order priority.

## Status Legend

- `Candidate`: likely small enough to implement after approval
- `Defer`: useful, but not low-hanging as stated
- `Aligned`: current behavior already matches `docs/house-rules.md`

## Item Summary

| # | Item | Status | Size | Recommendation |
|---|------|--------|------|----------------|
| 1 | Room codes are case-insensitive | Candidate | S | Do now |
| 2 | Run ordering with leading wilds | Candidate | S | Do now |
| 3 | Joker swap activity logging | Candidate | XS/S | Do now |
| 4 | Final-hand run validation | Candidate | XS | Add regression only |
| 5 | New game discoverability | Candidate | S | Fresh-room flow only |
| 6 | Join and share flow | Candidate | XS/S | Lobby share card only |
| 7 | Mobile discard visibility after laydown | Candidate | S | Do now |
| 8 | Mobile hand visibility | Defer | M | Needs UX decision |
| 9 | May-I tap feedback | Candidate | S | Do now |
| 10 | May-I popup labels | Candidate | XS | Do now |
| 11 | Lay off multiple cards to same meld | Candidate | XS/S | Affordance only |
| 12 | Lay off from main screen | Defer | M | Keep mobile drawer-only for now |
| 13 | Mobile battery usage | Candidate | XS/S | Non-invasive mitigations only |
| 14 | Invalid laydown feedback | Candidate | S | Do now |
| 15 | Post-action confirmation feedback | Candidate | S | After activity logging |
| 16 | Minimum run length rule | Aligned | XS | No code change |
| 17 | Duplicate-set handling rule | Candidate | XS | Docs/test clarification |
| 18 | Same-suit run rule documentation | Aligned | XS | No code change |

## Items

### 1. Room Codes Are Case-Insensitive

**Status:** Candidate
**User-facing requirement:** Players who enter the same room code with different casing join the same game.
**Smallest technical approach:** Add `normalizeRoomId(roomId) => roomId.trim().toUpperCase()` in `core/room/room-id.utils.ts`; apply it in home join redirect, `game.$roomId` loader canonicalization, and room-specific player-storage keys.
**Likely files:** `core/room/room-id.utils.ts`, `app/routes/home.tsx`, `app/routes/game.$roomId.tsx`, `app/routes/player-storage.ts`.
**Tests:** Room-id utility test, player-storage key test, route redirect tests preserving query params.
**Risks:** Canonical redirect must preserve agent harness query params. Existing lowercase rooms would be merged into uppercase, which is desired for generated codes.

### 2. Run Ordering With Leading Wilds

**Status:** Candidate
**User-facing requirement:** When a player lays down a run using wilds, the table preserves the intended run values.
**Smallest technical approach:** In `normalizeRunCards`, first preserve an already-valid selected run order, then fall back to inference for invalid-but-normalizable input.
**Likely files:** `core/meld/run.normalizer.ts`, `core/meld/run.normalizer.test.ts`, targeted turn/round laydown storage tests.
**Tests:** `Wild, Wild, 7, 8` remains leading-wild order; middle/trailing wild cases still pass.
**Risks:** Ambiguous wild bounds change, but this matches player-selected intent and house rules.

### 3. Joker Swap Activity Logging

**Status:** Candidate
**User-facing requirement:** Joker swaps appear in the activity feed.
**Smallest technical approach:** Add web activity logging for successful `SWAP_JOKER`, verifying before/after state proves the swap happened before logging.
**Likely files:** `app/party/game-actions.ts`, `app/party/party-game-adapter.ts`, `app/party/game-actions.test.ts`.
**Tests:** Successful swap adds activity with actor, placed card, and target meld; no-op/invalid attempts do not log.
**Risks:** Do not log blindly because some invalid swap attempts can be accepted by outer action routing but ignored by the turn machine.

### 4. Final-Hand Run Validation

**Status:** Candidate
**User-facing requirement:** Hand 6 accepts valid one-set/two-run layouts, including a 5-card run.
**Smallest technical approach:** Add a targeted regression test only. Core recon indicates `3-card set + 5-card run + 4-card run` already goes out correctly.
**Likely files:** `core/engine/laydown.test.ts` or a focused Hand 6 test file.
**Tests:** Hand 6 uses all cards and wins with one set plus two runs where one run has 5 cards.
**Risks:** UI pre-submit validation may still be less specific, but engine behavior appears aligned.

### 5. New Game Discoverability

**Status:** Candidate
**User-facing requirement:** A player can start a new game from obvious UI without editing the URL.
**Smallest technical approach:** Add a fresh-room `/game/new` route that redirects to `/game/${generateRoomId()}`. Link game-over `Play Again` and a small active-game New Game affordance to it.
**Likely files:** route config/new route, `app/routes/game.$roomId.tsx`, game-over UI as needed.
**Tests:** Route ordering test for `/game/new` before `/game/:roomId`; manual fresh-room check.
**Risks:** Same-room rematch/reset is not low-hanging and should stay out of scope.

### 6. Join And Share Flow

**Status:** Candidate
**User-facing requirement:** Hosts can share a game link/code clearly across phone, iPad, and Android.
**Smallest technical approach:** Extend `ShareLinkCard`: keep room code visible, add Copy Code, keep Copy Link, and add native Share only when `navigator.share` exists.
**Likely files:** `app/ui/lobby/ShareLinkCard.tsx` and tests.
**Tests:** Render copy-link/copy-code controls; manual native-share check on mobile.
**Risks:** Do not imply late join is supported after game start unless that behavior is verified.

### 7. Mobile Discard Visibility After Laydown

**Status:** Candidate
**User-facing requirement:** On mobile, once a player has enough room, they can see discard context without opening the hand drawer.
**Smallest technical approach:** Add a mobile-only discard row in `GameView` when the player is down or hand size is below a threshold. Keep it context-only unless `availableActions` says pickup/May-I is legal.
**Likely files:** `app/ui/game-view/GameView.tsx`, `app/ui/game-table/DiscardPileDisplay.tsx`.
**Tests:** Helper/render test for visibility condition; mobile manual checks at 360-390px and tablet.
**Risks:** Down players cannot draw discards or May-I under house rules, so display-only must not imply availability.

### 8. Mobile Hand Visibility

**Status:** Defer
**User-facing requirement:** Active mobile players can see and act on enough of their hand without constantly opening the drawer.
**Recon result:** Increasing drawer height is small but does not satisfy the real requirement. Auto-opening the drawer or making a persistent playable footer is a larger UX change with table/discard tradeoffs.
**Recommendation:** Defer until there is a clear mobile hand model. A shallow drawer-height tweak can be considered separately if desired.

### 9. May-I Tap Feedback

**Status:** Candidate
**User-facing requirement:** After tapping May I, the player immediately sees pending feedback and cannot spam the action.
**Smallest technical approach:** Add local optimistic pending state in `app/routes/game.$roomId.tsx` after `CALL_MAY_I`; clear it on `GAME_STATE`, `ERROR`, or `MAY_I_RESOLVED`; pass a derived `PlayerView` to `GameView` with `canMayI=false` and `hasPendingMayIRequest=true`.
**Likely files:** `app/routes/game.$roomId.tsx`, possibly a small helper for derived state.
**Tests:** Pending-state helper or ActionBar test; manual mobile tap check.
**Risks:** Clearing local state must be conservative so rejected requests do not leave the UI stuck.

### 10. May-I Popup Labels

**Status:** Candidate
**User-facing requirement:** Popup actions clearly distinguish allowing the caller from claiming the discard instead.
**Smallest technical approach:** Copy-only update in `MayIRequestView`. Suggested labels: `Allow May I`, `Pick Up Discard`, `Claim Instead (+ penalty)`. Remove any copy implying a May-I usage limit.
**Likely files:** `app/ui/may-i-request/MayIRequestView.tsx` and tests.
**Tests:** Update render tests for labels.
**Risks:** None if action handlers stay unchanged.

### 11. Lay Off Multiple Cards To Same Meld

**Status:** Candidate
**User-facing requirement:** It should be obvious how to add multiple cards to the same meld.
**Smallest technical approach:** Improve the existing layoff drawer affordance: make the add target distinct from staged-card remove controls. Do not add true multi-select yet.
**Likely files:** `app/ui/lay-off-view/LayOffView.tsx`, `app/ui/lay-off-view/useStagedLayOffs.ts`, render tests.
**Tests:** Drawer staging/retract tests for two cards to one meld.
**Risks:** True multi-select is M because ordering, wild prompts, partial failures, and sequential removal all matter.

### 12. Lay Off From Main Screen

**Status:** Defer
**User-facing requirement:** Tap-to-lay-off from the main game screen works consistently on deployed mobile views.
**Recon result:** Desktop inline layoff exists. Mobile main-screen layoff is intentionally disabled by `!isMobile`; mobile uses drawer-only layoff.
**Recommendation:** Keep mobile drawer-only for now. Optionally make copy/affordances clearer. Full mobile main-screen layoff needs a UX decision because selected cards are not visible once the drawer closes.

### 13. Mobile Battery Usage

**Status:** Candidate
**User-facing requirement:** Mobile play should not drain battery unusually quickly.
**Smallest technical approach:** Start with non-invasive mitigations: gate obvious debug logs, add reduced-motion classes to indefinite animations, and consider pausing custom heartbeat while hidden with a visibility wake ping.
**Likely files:** `app/hooks/usePartyConnection.ts`, `app/routes/game.$roomId.tsx`, `app/ui/action-bar/ActionBar.tsx`, `app/ui/game-table/PlayerMeldsDisplay.tsx`, `app/ui/connection-status/ConnectionBanner.tsx`.
**Tests:** Focused `usePartyConnection` visibility tests if heartbeat changes; manual mobile hidden/visible and offline/online checks.
**Performance verification:** Use Chrome DevTools MCP against a local multiplayer session to capture CPU activity, long tasks, websocket/network churn, and behavior after background/visible transitions. Save traces before and after any mitigation.
**Risks:** Aggressive reconnect/heartbeat changes can delay live May-I prompts. Keep the first pass conservative.

### 14. Invalid Laydown Feedback

**Status:** Candidate
**User-facing requirement:** When a laydown fails, the player gets a specific reason.
**Smallest technical approach:** Reuse existing error plumbing. In `setLayDownError`, build normalized melds and surface `validateContractMelds(...).error` before falling back to generic `invalid melds`.
**Likely files:** `core/engine/turn.machine.ts`, `core/engine/game-engine.errors.test.ts`, `app/party/game-actions.test.ts`.
**Tests:** Same-suit gap laydown surfaces the specific gap text through turn machine and party action error path.
**Risks:** Keep error text stable enough for tests without overfitting copy.

### 15. Post-Action Confirmation Feedback

**Status:** Candidate
**User-facing requirement:** Discard, layoff, joker swap, and May-I actions feel acknowledged on mobile.
**Smallest technical approach:** First add joker-swap activity logging. Then optionally surface the newest own high-value activity as a lightweight mobile confirmation/live region above the hand peek. No new toast dependency.
**Likely files:** `app/routes/game.$roomId.tsx`, `app/ui/game-view/GameView.tsx`, `app/ui/game-status/ActivityLog.tsx`.
**Tests:** Render/helper test for filtering latest own activity.
**Risks:** Avoid noisy duplicate feedback. This should follow item 3.

### 16. Minimum Run Length Rule

**Status:** Aligned
**User-facing requirement:** Players know whether runs must be longer than two cards.
**Recon result:** House rules, engine, normalizer, contracts, and UI staging all enforce 4+ same-suit runs. Existing tests cover 2-card and 3-card invalid runs.
**Recommendation:** No code change.

### 17. Duplicate-Set Handling Rule

**Status:** Candidate
**User-facing requirement:** Players know whether six matching cards can count as two separate sets.
**Smallest technical approach:** Keep current behavior and clarify docs/tests: six matching physical cards may be played as two separate 3+ set melds if no card is reused; one 6-card set still counts as one meld.
**Likely files:** `docs/house-rules.md`, `app/ui/house-rules/HouseRulesContent.tsx`, `core/engine/contracts.test.ts`.
**Tests:** Explicit duplicate-set split test if not already clear enough.
**Risks:** Changing behavior would conflict with current multi-deck assumptions and house-rule-compatible set definition.

### 18. Same-Suit Run Rule Documentation

**Status:** Aligned
**User-facing requirement:** Players can discover that runs must be same suit.
**Recon result:** `docs/house-rules.md` and in-game house-rules UI already state same-suit runs and the same-suit gap rule. Tests cover mixed-suit invalid runs.
**Recommendation:** No code change.

## Low-Hanging Candidate Queue

Recommended approval batch, in order:

1. Room code case-insensitivity.
2. May-I popup label cleanup.
3. Joker swap activity logging.
4. Final-hand 5-card-run regression test.
5. Duplicate-set docs/test clarification.
6. Run ordering with leading wilds.
7. Invalid laydown feedback.
8. May-I immediate pending feedback.
9. Join/share card improvements.
10. Fresh-room New Game route.
11. Mobile discard visibility after laydown.
12. Layoff drawer affordance cleanup.
13. Conservative battery mitigations.

Deferred for later:

- Mobile hand visibility beyond a shallow drawer-height tweak.
- Mobile main-screen layoff.
- Same-room rematch/reset.
- Aggressive websocket reconnect or heartbeat behavior changes without device testing.

## Battery Recon Plan

Use Chrome DevTools MCP for battery-adjacent evidence before changing networking behavior:

1. Run a local dev session with at least one active game tab.
2. Record an idle-game performance trace for 60-90 seconds.
3. Inspect websocket/network traffic for heartbeat frequency and reconnect churn.
4. Record a second trace during normal actions: draw, discard, May-I prompt, layoff.
5. Simulate hidden/visible and offline/online transitions, then confirm resync still works.
6. Only approve mitigations that reduce CPU/network activity without delaying live May-I prompts.

## Recon Notes

- Subagents performed read-only recon. No implementation files were changed by recon.
- Existing user work was observed in `core/engine/laydown.actions.test.ts`; avoid touching it unless implementation requires coordination.
- This document is the only new tracking artifact from the recon pass.
