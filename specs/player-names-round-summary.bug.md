# Bug: Player Names Missing & Round Summary Not Showing for AI Wins

## Summary

Two related issues with end-of-round/game UI:

1. **Player names display as "Unknown"** in Final Standings and Round Summary screens
2. **Round Summary only appears when human player goes out** - if an AI player wins a round, it jumps straight to the next round without showing the summary

## Bug 1: Player Names Showing as "Unknown"

### Screenshot

![Final Standings showing "Unknown" for all players](attached)

### Expected Behavior

Player names should display correctly:
- "Drew (You)" or actual player name for the human
- "Claude", "Grok", "GPT", etc. for AI players

### Actual Behavior

All players display as "Unknown" in:
- Final Standings screen (Game Over)
- Round Summary screen (between rounds)

### Likely Cause

The standings/summary component is receiving player IDs but not resolving them to names. Possible issues:
- Using engine player IDs instead of lobby player IDs
- Player name lookup failing (wrong data source)
- Name field not being passed through wire protocol correctly

### Files to Investigate

- `app/ui/` - Game Over / Round Summary components
- `app/party/protocol.types.ts` - Check if player names are included in score payloads
- `app/routes/game.$roomId.tsx` - Check how player data is passed to UI

---

## Bug 2: Round Summary Skipped When AI Goes Out

### Expected Behavior

When **any** player (human or AI) goes out and ends a round:
1. Show Round Summary screen with scores
2. Wait for acknowledgment / brief pause
3. Proceed to next round

### Actual Behavior

- Human goes out → Round Summary displays correctly
- AI goes out → Immediately jumps to next round, no summary shown

### Likely Cause

The round transition logic may be:
- Only pausing/showing summary when it's the human's turn
- Auto-advancing when AI completes a turn that ends the round
- Missing a state/phase for "show round summary" that triggers regardless of who won

### Files to Investigate

- `app/party/game-room.ts` or `app/party/mayi-room.server.ts` - Round transition handling
- `app/routes/game.$roomId.tsx` - How round end is detected and UI state updated
- Look for conditionals that check if current player is human before showing summary

---

## Reproduction Steps

### For Bug 1 (Unknown names):
1. Start a game with AI players
2. Play until game ends
3. Observe Final Standings screen shows "Unknown" for all players

### For Bug 2 (Missing summary):
1. Start a game with AI players
2. Play until an AI player goes out (ends a round)
3. Observe the game immediately starts the next round without showing round summary
4. Compare: when human player goes out, round summary is displayed

---

## Priority

**Medium** - These are polish/UX issues that don't block gameplay but make the experience confusing:
- Hard to track who won each round
- Hard to see score progression
- Feels abrupt when AI wins a round

---

## Related Components

- Round Summary UI component
- Game Over / Final Standings UI component
- Score tracking and display
- Player name resolution (lobby ID → display name)
- Round transition flow in PartyServer
