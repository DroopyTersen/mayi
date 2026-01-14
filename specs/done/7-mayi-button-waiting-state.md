# Spec: May-I Button Waiting State

**Issue:** #7
**Type:** Bug
**Date:** 2026-01-12

## Problem
After clicking "May I?", the button remains enabled and does not show that the player is waiting for other players to respond.

## Root Cause
The `AvailableActions` interface has no field to indicate when the current player has an active May I request pending. When `mayIContext` exists, `canMayI` is set to `false` for everyone, but there's no distinction between "someone else called May I" and "I called May I and am waiting."

## Solution
Add `hasPendingMayIRequest: boolean` field to `AvailableActions`:
- `true` when `mayIContext?.originalCaller === playerId`
- `false` otherwise

Update `ActionBar.tsx` to show disabled "Waiting..." button when flag is true.

## Files to Modify
1. `core/engine/game-engine.availability.ts` - Add flag
2. `app/ui/action-bar/ActionBar.tsx` - Show waiting state

## Test Cases
1. `hasPendingMayIRequest` is true when player is originalCaller
2. `hasPendingMayIRequest` is false when player is not originalCaller  
3. `hasPendingMayIRequest` is false when no mayIContext exists
