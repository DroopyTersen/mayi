# Spec: Discard Button Nudge (#39)

## Summary
Add a gentle visual nudge (pulse animation) to the Discard button after a player takes a meaningful action (lay down, lay off, or swap joker) to remind them they still need to discard to end their turn.

## Approach: Pragmatic

### Engine Changes
- Add `tookActionThisTurn: boolean` to `TurnContext` and `GameSnapshot`
- Set flag in `layDown`, `layOff`, and `swapJoker` actions

### Availability Changes
- Add `shouldNudgeDiscard: boolean` to `AvailableActions`
- Compute: `isYourTurn && canDiscard && snapshot.tookActionThisTurn`

### UI Changes
- Apply `animate-pulse` class to Discard button when `shouldNudgeDiscard` is true

## Files to Modify
1. `core/engine/turn.machine.ts`
2. `core/engine/game-engine.types.ts`
3. `core/engine/game-engine.ts`
4. `core/engine/game-engine.availability.ts`
5. `app/ui/action-bar/ActionBar.tsx`

## Acceptance Criteria
- [ ] Nudge appears after lay down
- [ ] Nudge appears after lay off
- [ ] Nudge appears after swap joker
- [ ] Nudge does NOT appear after draw only
- [ ] Works on desktop and mobile
