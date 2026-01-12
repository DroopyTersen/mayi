# /af show - GitHub Backend

Display full card information.

## Process

**IMPORTANT:** Always include `comments` in the JSON fields.

```bash
# Get issue with all details including comments
gh issue view NUMBER --json number,title,body,labels,state,comments

# Get project status
gh project item-list $PROJECT --owner $OWNER --format json | \
  jq '.items[] | select(.content.number == NUMBER) | {status: .status}'
```

## Display Order

1. Issue number, title, state
2. Current column (from project Status field)
3. Labels (type, priority, tags)
4. Full issue body (card context)
5. **All comments** (conversation history)

## Why Comments Matter

Comments contain the ongoing dialogue:
- Agent questions and findings
- Human feedback and decisions
- Status updates and blockers
- Code review results

Without comments, you lose critical context.

## Output Format

```
# #123 Add OAuth login

**Column:** Tech Design
**Labels:** enhancement, high
**State:** open

---

[Full issue body content]

---

## Comments (3)

**agent-bot** (2026-01-10):
I have some questions about the OAuth implementation...

**drew** (2026-01-10):
Use Google OAuth only for now.

**agent-bot** (2026-01-11):
Tech design complete. Ready for implementation.
```
