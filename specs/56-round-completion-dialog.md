# Spec: Improve Round Completion Dialog (#56)

**Type:** Feature
**Priority:** Low
**Status:** Tech Design Complete

## Overview

Enhance the round completion dialog to show comprehensive round summary including:
- Winner prominently displayed with trophy icon
- Scores for all players
- Table melds visible (reusing TableDisplay)
- Each player's remaining cards as actual card images
- 15-second display duration (no manual dismiss)

## Approach: Clean Architecture

Human selected Clean Architecture approach for maximum maintainability and testability.

## Files to Create

| File | Purpose |
|------|---------|
| `app/party/round-summary.types.ts` | `RoundSummaryPayload` type definition |
| `app/party/round-summary.capture.ts` | Pure function to capture snapshot + unit tests |
| `app/ui/round-summary/WinnerBanner.tsx` | Trophy + winner name display component |
| `app/ui/round-summary/WinnerBanner.story.tsx` | Story for WinnerBanner |
| `app/ui/round-summary/ScoreBreakdown.tsx` | Score list per player |
| `app/ui/round-summary/ScoreBreakdown.story.tsx` | Story for ScoreBreakdown |
| `app/ui/round-summary/RemainingHandsDisplay.tsx` | Show each player's leftover cards |
| `app/ui/round-summary/RemainingHandsDisplay.story.tsx` | Story for RemainingHandsDisplay |
| `app/ui/round-summary/RoundSummaryDialog.tsx` | Composite dialog assembling all pieces |
| `app/ui/round-summary/RoundSummaryDialog.story.tsx` | Story for RoundSummaryDialog |

## Files to Modify

| File | Changes |
|------|---------|
| `app/party/protocol.types.ts` | Add `RoundSummaryPayload`, update `RoundEndedMessage` |
| `app/party/mayi-room.ts` | Update `broadcastRoundEnded()` to capture and include summary |
| `app/routes/game.$roomId.tsx` | Handle new `ROUND_ENDED` payload, render `RoundSummaryDialog` |

## Component Architecture

```
RoundSummaryDialog
├── WinnerBanner (trophy icon + winner name)
├── ScoreBreakdown (score list, sorted by points)
├── TableDisplay (existing component, reused)
└── RemainingHandsDisplay
    └── HandDisplay (existing component, per player)
```

## Protocol Changes

```typescript
export interface RoundSummaryPayload {
  winnerId: string;
  tableMelds: Meld[];
  playerHands: Record<string, Card[]>;
  scores: Record<string, number>;
  playerNames: Record<string, string>;
}

export interface RoundEndedMessage {
  type: "ROUND_ENDED";
  roundNumber: number;
  summary: RoundSummaryPayload;
}
```

## Critical Implementation Notes

**Race Condition Prevention:** The `captureRoundSummary()` function MUST be called BEFORE the round transition occurs. This ensures we capture:
- The winner's empty hand (they went out)
- Other players' remaining cards
- Table melds before they're cleared

## TDD Plan

1. Write test for `captureRoundSummary()` basic capture
2. Write test for `captureRoundSummary()` with empty hands (winner went out)
3. Write test for `captureRoundSummary()` with multiple melds per player
4. Write component tests for WinnerBanner with different winner states
5. Write test for 15-second countdown timer in RoundSummaryDialog

## Verification

| Step | Command | Expected |
|------|---------|----------|
| Type check | `bun run typecheck` | No errors |
| Unit tests | `bun test` | All pass |
| Build | `bun run build` | Success |
| Story verification | Dev server + /storybook | All 4 new stories render correctly |
| Integration test | Play game to round end | Dialog shows winner, melds, remaining cards for 15s |
| Race condition test | Multiple rounds in succession | No duplicate/missing cards |
