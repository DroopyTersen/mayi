# Spec: Add Start New Game Button

**Issue:** #6
**Branch:** feature/6-add-start-new-game-button
**Date:** 2026-01-12

## Summary

After a game ends, users need a way to start a new game. The human suggested making the "MAY I?" header text a link to the home page, plus wiring up the existing "Play Again" button in GameEndScreen.

## Technical Design

This is a simple feature with one obvious implementation:

1. Make "MAY I?" text in `GameHeader` a clickable link to home
2. Wire up the existing `onNewGame` prop in `GameEndScreen`

### Files to Modify

| File | Changes |
|------|---------|
| `app/ui/game-status/GameHeader.tsx` | Wrap "MAY I?" span in a Link to "/" |
| `app/routes/game.$roomId.tsx` | Add `onNewGame={onLeaveGame}` to GameEndScreen |

### Implementation Sequence

1. In `GameHeader.tsx`:
   - Import `Link` from `react-router`
   - Replace the `<span>MAY I?</span>` with `<Link to="/">MAY I?</Link>`
   - Keep the same styling, add hover state

2. In `game.$roomId.tsx`:
   - Add `onNewGame={onLeaveGame}` to the GameEndScreen component (line ~524)
   - The `onLeaveGame` handler already navigates to home, so we reuse it

### Verification Steps

| Step | Command | Expected |
|------|---------|----------|
| Type check | `bun run typecheck` | No errors |
| Unit tests | `bun test` | All pass |
| Build | `bun run build` | Success |
| Manual test | Complete a game | "Play Again" button visible on GameEndScreen |
| Manual test | Click "MAY I?" during game | Navigates to home page |

### TDD Plan

This is a UI wiring change with minimal logic. Testing approach:
- Existing component tests should continue to pass
- Manual verification via web app

## Rationale

Human comment: "this could literally be as simple as designing an app logo to go in the header and making the app logo and title a link to the new game screen."

This implementation:
- Reuses existing `onNewGame` prop in GameEndScreen (already implemented, just not wired)
- Reuses existing `onLeaveGame` handler (both actions navigate to home)
- Minimal code changes (2 files, ~5 lines changed)
- Follows existing navigation pattern in codebase
