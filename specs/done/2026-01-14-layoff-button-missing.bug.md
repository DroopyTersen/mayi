# Bug: "Lay Off" button missing after draw

## Report

User report (paraphrased): After drawing, the UI didn’t show the `Lay Off` button. Refreshing didn’t make it appear. On a later turn/session, it was there.

Screenshot shows:
- Status text: `Your turn - Discard a card`
- Action buttons visible: `Discard`, `Organize` (no `Lay Off`)
- Table has melds (so layoff would normally be relevant)
- Activity includes: `Kate: laid down contract`

## Expected

After drawing, if the player is already down (from a previous turn) and there are table melds, the UI should show `Lay Off` as an available action (alongside `Discard`).

## Actual

UI did not show `Lay Off`. Refresh did not change it. Later it appeared again.

## Findings (most likely explanation)

This appears consistent with **server-driven game state**, not a client rendering bug:

- The `Lay Off` button is rendered only when `availableActions.canLayOff === true` (`app/ui/action-bar/ActionBar.tsx`).
- `availableActions` is computed in the engine (`core/engine/game-engine.availability.ts`), and `canLayOff` is only enabled during `turnPhase === "AWAITING_ACTION"` and when:
  - player is down (`isDown === true`)
  - table has melds (`snapshot.table.length > 0`)
  - **player did not lay down this turn** (`snapshot.laidDownThisTurn === false`)
  - not Round 6
- The screenshot’s status text `Your turn - Discard a card` maps to `turnPhase === "AWAITING_DISCARD"` (`app/ui/game-view/game-view.utils.ts`), where the engine intentionally offers discard-related actions and does not offer layoff via `availableActions`.

So the UI likely reflected a state where the player was already in the discard-only phase for that turn.

Re-check against the documented house rules (`docs/house-rules.md`):

- Rule 5.3 explicitly says **“No lay off on the same turn you lay down”**.
- The screenshot shows the player is marked as down and has fresh melds visible under “You”, and the activity log includes `Kate: laid down contract`, which strongly suggests the screenshot was taken immediately after laying down the contract in the same turn.
- In that scenario, the missing `Lay Off` button is expected behavior (the player must wait until their next turn to lay off).

## Hypotheses for how the player reached discard-only phase

1. **They laid down earlier in the same turn** (or the server thought they did), which is a house rule preventing layoff on the same turn as laying down.
   - This is consistent with the activity line `Kate: laid down contract` (if the viewer is Kate), and with the `laidDownThisTurn` gating in `core/engine/game-engine.availability.ts`.
   - In the turn machine, laying down transitions to `awaitingDiscard` (which the snapshot maps to `AWAITING_DISCARD`) (`core/engine/turn.machine.ts`).
2. **A `SKIP` action occurred** after the draw (intentional or accidental), which also transitions from the action phase into `AWAITING_DISCARD`.
   - `SKIP` is supported by the protocol and is accepted only in `turnPhase === "AWAITING_ACTION"` (`app/party/game-actions.ts`, `app/routes/game.$roomId.tsx`).
3. Less likely: **stale or out-of-order client state** made the status text/actions reflect `AWAITING_DISCARD` even though the player expected they were still in action phase.
   - A refresh wouldn’t fix this if the durable state truly was `AWAITING_DISCARD`.

## Suggested improvements

- UI clarity: when `canLayOff` is false because `laidDownThisTurn` is true (rule 5.3), show a small inline hint like “Lay off available next turn” (to reduce “button missing” reports).
- Debug logging: when a player reports missing actions, capture `turnPhase` and `availableActions` in client logs (and optionally emit to server telemetry).
- Activity log detail: consider logging `skipped` (or “moved to discard”) for humans if it helps diagnose phase transitions.

## How to validate / reproduce

- Set up a state where the player is down and the table has melds.
- After drawing:
  - If the player is in `AWAITING_ACTION` and `laidDownThisTurn=false`, verify `Lay Off` appears.
  - If the player performs `LAY_DOWN` (making `laidDownThisTurn=true`), verify turn becomes `AWAITING_DISCARD` and `Lay Off` disappears for the remainder of the turn.
  - If the player performs `SKIP`, verify turn becomes `AWAITING_DISCARD` and `Lay Off` disappears for the remainder of the turn.
