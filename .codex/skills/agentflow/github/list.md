# /af list - GitHub Backend

List all cards grouped by column.

## Process

```bash
# Get all project items - ONE API call
gh project item-list $PROJECT --owner $OWNER --format json
```

Parse the JSON and group by status field. The project item-list response includes `content.body` for each issue, so you have everything in one response.

**IMPORTANT:** Do NOT loop through issues with individual `gh issue view` calls. That's slow (N+1 queries). Use the data from the single project item-list call.

## Flags

**`--workable`**: Filter to only show items where:
- Status is: Approved, Refinement, Tech Design, or Implementation
- No `needs-feedback` label (check `content.labels` in response)
- No `blocked` label (check `content.labels` in response)

**Note on dependencies:** Dependency checking (parsing `## Dependencies` from issue body) is expensive. For `/af list --workable`, skip dependency checks. Only check dependencies when actually selecting a card to work on in `/af next` or `/af work`.

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
