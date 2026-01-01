# May I? Refactor Issues

Issues discovered during testing of the post-orchestrator-refactor codebase.

---

## Issue 1: May I calls that fail guards are silently ignored

**Severity**: Medium (UX issue)

**Description**: When a player attempts to call May I but the guard fails (e.g., trying to May I their own discard, or player is down), the command is silently ignored with no error message or feedback.

**Steps to reproduce**:
1. Start a new game
2. Player A discards a card
3. Player A tries to May I that same card: `bun cli/play.ts <game-id> mayi player-0`
4. The command appears to succeed (shows status) but nothing happened

**Expected behavior**: The CLI should show an error message explaining why the May I was rejected (e.g., "Cannot May I your own discard" or "Down players cannot call May I").

**Root cause**: The XState guard `canCallMayI` in `core/engine/round.machine.ts` returns `false` when the May I is invalid, but there's no mechanism to communicate the reason back to the user. The guard silently prevents the transition without setting `lastError`.

**Affected files**:
- `core/engine/round.machine.ts` (guard logic)
- `cli/play.ts` (handleMayI doesn't receive rejection reason)

---

## Issue 2: Round 6 laydown command hint is misleading

**Severity**: Low (UX issue)

**Description**: In Round 6, the command hint shows `COMMANDS: laydown "<meld1>" "<meld2>" | skip` but Round 6 requires 3 melds (1 set + 2 runs). This is confusing since the hint suggests only 2 melds are needed.

**Steps to reproduce**:
1. Start a new game at Round 6: `bun cli/play.ts new --round 6`
2. Draw a card
3. Observe the command hint: `COMMANDS: laydown "<meld1>" "<meld2>" | skip`

**Expected behavior**: The hint should show 3 meld placeholders for rounds requiring 3 melds:
- Round 4 (3 sets): `laydown "<meld1>" "<meld2>" "<meld3>"`
- Round 5 (2 sets + 1 run): `laydown "<meld1>" "<meld2>" "<meld3>"`
- Round 6 (1 set + 2 runs): `laydown "<meld1>" "<meld2>" "<meld3>"`

**Affected files**:
- `cli/harness/harness.render.ts` (command hint generation)

---

## Issue 3: Round-ending discard is not logged

**Severity**: Low (logging issue)

**Description**: When a player discards their last card to end a round, the discard action is not recorded in the game log. The last log entry shows "skipped" but not the final discard.

**Steps to reproduce**:
1. Play through Round 1 until a player goes out
2. Check the log: `bun cli/play.ts <game-id> log`
3. Observe that the final discard is missing

**Example log output**:
```
[2:11:07 PM] R1 T10: GPT-5 Mini laid off — 4♦ → meld 4
[2:11:13 PM] R1 T10: GPT-5 Mini skipped
```
(Missing: "GPT-5 Mini discarded — 3♠" and "GPT-5 Mini went out")

**Expected behavior**: The log should show:
```
[2:11:13 PM] R1 T10: GPT-5 Mini skipped
[2:11:20 PM] R1 T10: GPT-5 Mini discarded — 3♠
[2:11:20 PM] R1 T10: Round 1 ended — GPT-5 Mini went out!
```

**Root cause**: The discard action logging in `CliGameAdapter` may not be called before the round transition occurs, or the round end event doesn't trigger a log entry.

**Affected files**:
- `cli/shared/cli-game-adapter.ts` (action logging)

---

## Testing Summary

### Tested Features (Working Correctly)

1. **Game initialization** - New games start correctly with proper player counts and rounds
2. **Round 1-5 laydown** - Contract validation works (2 sets tested)
3. **Layoffs** - Adding cards to existing melds works correctly
4. **Wild card layoffs** - Wilds can be laid off without ratio restrictions
5. **May I resolution** - The allow/claim flow works correctly
6. **May I blocking** - Current player can claim and block a May I caller
7. **May I blocking by intermediate player** - Players between caller and current player can block
8. **May I when all players ahead are down** - Instantly awards the card to the caller
9. **Round 6 all-cards requirement** - Correctly rejects laydowns that don't use all cards
10. **Round 6 May I** - All players can participate since no one is ever "down"
11. **Round transitions** - Automatic round end, scoring, and new round start
12. **Scoring** - Point totals calculated correctly after round ends

### Not Fully Tested

- Game end conditions (all 6 rounds completed)
- Joker swapping from runs
- Stock depletion and reshuffle

---

## Testing Environment

- Date: 2024-12-30
- Test method: CLI harness (`bun cli/play.ts`)
- Games tested:
  - `56e623` - Round 1 complete game, Round 2 started
  - `dc327c` - 4-player game, May I blocking tests
  - `2127d0` - Round 6 special rules tests
