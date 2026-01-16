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

## Check for Associated PR

After fetching issue details, check if there's a PR that references this issue:

```bash
# Find PRs that close/reference this issue
gh pr list --json number,title,state,closingIssuesReferences --state all | \
  jq '.[] | select(.closingIssuesReferences[]?.number == NUMBER)'
```

If a PR is found, get the PR review comments:

```bash
# Get inline review comments (code-level feedback)
gh api repos/{owner}/{repo}/pulls/PR_NUMBER/comments --jq '.[] | {
  author: .user.login,
  file: .path,
  line: .line,
  body: .body,
  created_at: .created_at
}'

# Get PR conversation comments (top-level discussion)
gh pr view PR_NUMBER --json comments --jq '.comments[] | {
  author: .author.login,
  body: .body,
  createdAt: .createdAt
}'
```

## Display Order

1. Issue number, title, state
2. Current column (from project Status field)
3. Labels (type, priority, tags)
4. Full issue body (card context)
5. **All comments** (conversation history)
6. **Associated PR** (if exists) with review comments

## Why Comments Matter

Comments contain the ongoing dialogue:
- Agent questions and findings
- Human feedback and decisions
- Status updates and blockers
- Code review results

Without comments, you lose critical context.

**PR review comments are equally important** when a card is moved back to implementation - they contain specific code feedback that needs to be addressed.

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

---

## Associated PR: #456 (open)

### PR Review Comments (2)

**reviewer** on `src/auth/oauth.ts:42` (2026-01-12):
This token should be validated before use.

**reviewer** on `src/auth/oauth.ts:78` (2026-01-12):
Consider adding error handling for network failures.
```

## When No PR Exists

If no associated PR is found, simply omit the "Associated PR" section.
