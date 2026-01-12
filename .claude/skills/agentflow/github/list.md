# /af list - GitHub Backend

List all cards grouped by column.

## Process

```bash
# Get all project items
gh project item-list $PROJECT --owner $OWNER --format json
```

Parse the JSON and group by status field. For each item, check labels for tags.

## Flags

**`--workable`**: Filter to only show items where:
- Status is: Approved, Refinement, Tech Design, or Implementation
- No `needs-feedback` label
- No `blocked` label
- All predecessors in Done (check `## Dependencies` in issue body)

## Output Format

```
## New (2)
- #123 Add OAuth login [high]
- #124 Fix navbar bug [medium]

## Approved (1)
- #125 Implement search [high]

## Refinement (1) 🤖
- #126 Add dark mode [medium] ⏸️

## Tech Design (0) 🤖

## Implementation (1) 🤖
- #127 Update dashboard [medium]

## Final Review (1) 👀
- #128 Add caching [low] — score: 85/100

## Done (3) ✅
- #129 Initial setup
```

## Indicators

- 🤖 = Agent-workable column
- ⏸️ = Has `needs-feedback` label
- 🚫 = Has `blocked` label
- ⏳ = Has unfinished predecessors
- 👀 = Awaiting human review
