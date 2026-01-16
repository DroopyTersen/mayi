# /af pr-feedback - GitHub Backend

Address PR review comments and implement suggested fixes.

## Usage

```
/af pr-feedback <pr-url-or-number>
```

Examples:
- `/af pr-feedback 456`
- `/af pr-feedback #456`
- `/af pr-feedback https://github.com/owner/repo/pull/456`

## Process

### 1. Parse PR Reference

Extract PR number from input:
- If URL: Parse number from path (`/pull/NUMBER`)
- If number: Use directly (strip `#` prefix if present)

### 2. Get PR Details

```bash
# Get PR info including linked issue and branch
gh pr view PR_NUMBER --json number,title,state,headRefName,closingIssuesReferences,body
```

Key fields:
- `headRefName`: Branch to switch to
- `closingIssuesReferences`: Linked issue(s)

### 3. Find Associated Issue

```bash
# Extract issue number from closingIssuesReferences
gh pr view PR_NUMBER --json closingIssuesReferences --jq '.closingIssuesReferences[0].number'
```

If no linked issue found, warn user but continue (PR may not use "Fixes #X" syntax).

### 4. Run `/af show` on Issue

If an associated issue was found:
- Execute `/af show ISSUE_NUMBER`
- This displays issue context AND PR review comments (per show.md)

If no issue found:
- Display PR body and title as context
- Still fetch PR review comments directly

### 5. Fetch PR Review Comments

```bash
# Get inline code review comments
gh api repos/{owner}/{repo}/pulls/PR_NUMBER/comments --jq '.[] | {
  id: .id,
  author: .user.login,
  file: .path,
  line: .line,
  body: .body,
  created_at: .created_at
}'

# Get PR conversation comments
gh pr view PR_NUMBER --json comments --jq '.comments[] | {
  author: .author.login,
  body: .body,
  createdAt: .createdAt
}'
```

### 6. Switch to PR Branch

```bash
# Fetch and switch to the PR branch
git fetch origin
git checkout PR_BRANCH_NAME
git pull --rebase origin PR_BRANCH_NAME
```

### 7. Analyze and Address Comments

For each review comment:

1. **Read the comment** - Understand what's being requested
2. **Locate the file/line** - Use the `path` and `line` from the comment
3. **Assess the suggestion**:
   - If you agree: Implement the fix
   - If you disagree: Explain why (but lean toward implementing unless clearly wrong)
   - If unclear: Ask the user for guidance

### 8. Implement Fixes

For each fix:
1. Read the relevant file
2. Make the suggested change
3. Run any related tests to verify

### 9. Commit and Push

After addressing comments:

```bash
# Stage changes
git add -A

# Commit with descriptive message
git commit -m "fix: address PR review feedback

- [brief description of each fix]

Co-Authored-By: Claude <noreply@anthropic.com>"

# Push to the PR branch
git push origin PR_BRANCH_NAME
```

## Output Format

```
## PR #456: Add OAuth login

**Branch:** feature/oauth-login
**State:** open
**Linked Issue:** #123

---

### Review Comments (3)

1. **reviewer** on `src/auth/oauth.ts:42`:
   > This token should be validated before use.

   ✅ Implemented: Added token validation

2. **reviewer** on `src/auth/oauth.ts:78`:
   > Consider adding error handling for network failures.

   ✅ Implemented: Added try/catch with retry logic

3. **reviewer** on `src/auth/oauth.ts:95`:
   > Magic number - extract to constant

   ✅ Implemented: Created TOKEN_EXPIRY_SECONDS constant

---

**Committed:** abc1234
**Pushed to:** feature/oauth-login
```

## When User Pastes PR URL

If the user provides a PR URL in conversation (not via `/af pr-feedback`), recognize the pattern and suggest:

"I see you've shared a PR. Would you like me to run `/af pr-feedback` to review and address the comments?"

Or if context makes it clear they want fixes, run the command directly.

## Error Handling

| Situation | Action |
|-----------|--------|
| PR not found | "PR #X not found in this repository" |
| PR already merged | "PR #X is already merged. Comments may be outdated." |
| No review comments | "No review comments found on PR #X" |
| Branch conflict | "Branch has conflicts. Please resolve manually." |
| Push rejected | "Push rejected. Pull latest changes and retry." |

## Tips

- Review comments often have useful context - read the full thread, not just the last message
- Some comments may be resolved but not marked as such - check if the code already addresses them
- If a comment requests a large architectural change, consider whether it should be a separate card
