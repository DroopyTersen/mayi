---
description: Verify AgentFlow Final Review cards with code review and UI testing
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, TodoWrite, mcp__claude-in-chrome__*
---

# AgentFlow Final Review Verification

Verify all cards in "Final Review" status through automated tests, code review, and live UI testing. Post verification results as comments on each GitHub issue.

## Process Overview

1. **Scan the board** — Get all Final Review cards via `/af list`
2. **Prioritize by complexity** — Test simplest fixes first (CSS/display → behavior → new modules)
3. **For each card** — Checkout branch, verify tests pass, test in UI, post results

## Detailed Steps

### Step 1: Get Final Review Cards

Run `/af list` or:
```bash
gh project item-list <PROJECT> --owner <OWNER> --format json | \
  jq '.items[] | select(.status == "Final Review")'
```

For each card, fetch details including branch name:
```bash
gh issue view <NUMBER> --json number,title,body,labels,comments
```

### Step 2: Create Verification Todo List

Use TodoWrite to track progress. Order by complexity:

| Complexity | Signs | Examples |
|------------|-------|----------|
| **Simple** | 1-2 files, CSS only, no new tests | Border fixes, display order |
| **Medium** | Behavior change, few files, some tests | Callback fixes, simple logic |
| **Complex** | New modules, 4+ files, 20+ new tests | Normalizers, hooks, projections |

### Step 3: Environment Setup

**Ensure .env exists** (needed for AI players, API calls):
```bash
# If missing, copy from sibling project
[ -f .env ] || cp ../mayi/.env .env
```

**Dev server management:**
```bash
# Check if already running
lsof -i :5173

# If not running, start it
bun run dev &

# If running on wrong branch, restart after checkout
pkill -f "react-router" && sleep 1 && bun run dev &
```

**Note:** Dev server has hot reload — for most changes, you don't need to restart after switching branches. Only restart if:
- Server crashed
- Major dependency changes
- .env file was added/changed

### Step 4: For Each Card

#### 4a. Checkout the Branch
```bash
git checkout <branch-name>
# Branch name is in issue body under "## Branch"
```

#### 4b. Run Automated Checks
```bash
# Type check
bun run typecheck

# Run tests (note the count!)
bun test

# Check for new tests (compare to baseline ~2034)
# More tests = implementation added test coverage
```

#### 4c. Code Review
```bash
# See scope of changes
git diff main...<branch> --stat

# Review specific files
git diff main...<branch> -- path/to/file.ts
```

Verify:
- Implementation matches issue requirements
- Code follows project patterns
- No obvious bugs or regressions

#### 4d. UI Testing with Claude Chrome

**Get browser context:**
```
mcp__claude-in-chrome__tabs_context_mcp
```

**For component fixes — use Storybook:**
```
Navigate to: http://localhost:5173/storybook/<component-name>
```
Take screenshot, verify the fix visually.

**For game flow fixes — start a new game:**
1. Navigate to `http://localhost:5173/`
2. Click "Create New Game"
3. Enter name, join game
4. Add 2 AI players (click "Add AI Player" twice)
5. Scroll down, click "Start Game"
6. Wait for AI turns or take manual actions to test the fix

**What to verify per fix type:**
- **Display fixes:** Screenshot shows correct rendering
- **Order fixes:** Items appear in expected sequence
- **Behavior fixes:** Perform action, observe correct result
- **Popup/overlay fixes:** Trigger condition, verify it appears/behaves correctly

#### 4e. Post Verification Comment

```bash
gh issue comment <NUMBER> --body "**Agent Verification ($(date +%Y-%m-%d)):**

## Verification Results

### Code Review
- ✅ Implementation matches requirements
- ✅ Changes are minimal and focused
- Files changed: \`file1.ts\`, \`file2.ts\`

### Test Results
- ✅ Type check: Pass
- ✅ All tests: XXXX/XXXX pass (Y new tests)
- ✅ Build: Success

### UI Verification
- ✅ Tested via [storybook/game UI]
- ✅ [Specific observation about the fix working]

### Commit
- SHA: <commit-sha>
- Branch: <branch-name>

## Verdict: **APPROVED FOR MERGE** ✅

[One sentence summary]"
```

### Step 5: Update Todo and Continue

Mark current card complete in TodoWrite, move to next card.

## Troubleshooting

**Dev server won't start:**
```bash
lsof -i :5173  # Check what's using port
kill -9 <PID>  # Kill it
```

**AI players stuck on "thinking":**
- Check .env has valid API keys
- Check server logs for API errors
- Can still test UI elements that don't require AI turns

**WebSocket shows "Connecting..." forever:**
- Restart dev server
- Refresh the browser page

## Summary Output

After completing all cards, provide summary:
- Total cards verified: X
- Approved: Y
- Needs changes: Z
- Skipped: W (with reasons)
