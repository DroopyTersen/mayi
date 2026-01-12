# /af context - GitHub Backend

Update card context. **Critical:** Know when to use body vs comments.

## Terminology Mapping

Column files use abstract terms. Here's how they map to GitHub:

| Abstract Term | GitHub Implementation |
|---------------|----------------------|
| Card body | Issue body |
| Card discussion | Issue comments |
| Add `needs-feedback` tag | `gh issue edit --add-label "needs-feedback"` |
| Remove tag | `gh issue edit --remove-label "..."` |

## Body vs Comments (Important)

| Content Type | Where | Why |
|--------------|-------|-----|
| Finalized requirements | Body | Permanent documentation |
| Chosen tech design | Body | Permanent documentation |
| History table updates | Body | Track column transitions |
| Questions for human | **Comment** | Discussion, not decisions |
| Proposed approaches | **Comment** | Options, not final choice |
| Agent-human dialogue | **Comment** | Conversation belongs in threads |

**Rule:** If you're asking a question or presenting options, use a comment. Only update the body after human responds with a decision.

## Updating Issue Body

Use for **finalized content only**.

### `append` — Add content to issue body

```bash
# Get current body
gh issue view NUMBER --json body -q '.body' > /tmp/issue-body.md

# Append new content
cat >> /tmp/issue-body.md << 'EOF'

{new content}
EOF

# Update issue
gh issue edit NUMBER --body-file /tmp/issue-body.md
```

### `history` — Add row to History table

1. Get current body
2. Find the History table
3. Add new row: `| {YYYY-MM-DD} | {column} | Agent | {notes} |`
4. Update issue body

## Adding Comments (Discussion)

Use for **questions, proposals, and dialogue**.

```bash
# Post a comment
gh issue comment NUMBER --body "**Agent (YYYY-MM-DD):** Your message here"

# Read recent comments
gh issue view NUMBER --json comments -q '.comments[-3:][].body'
```

**When to comment:**
- Asking clarifying questions → comment + `needs-feedback` label
- Presenting multiple approaches for selection → comment + `needs-feedback` label
- Responding to human feedback → comment
- Progress updates → comment

**When to update body:**
- Requirements are finalized (human approved)
- Tech design is chosen (human selected approach)
- Adding History table entry
- Moving to next phase with complete documentation

## Examples

### Good: Questions as comment
```bash
gh issue comment 123 --body "$(cat <<'EOF'
**Agent (2026-01-11): Questions**

Before I can finalize requirements, I need to clarify:
1. Should we support both OAuth providers or just Google?
2. Where should user sessions be stored?
EOF
)"
gh issue edit 123 --add-label "needs-feedback"
```

### Good: Final requirements in body
```bash
# Only AFTER human answered questions in comments
gh issue view 123 --json body -q '.body' > /tmp/body.md
cat >> /tmp/body.md << 'EOF'

## Refinement
**Date:** 2026-01-11
**Status:** Complete

### Requirements
- User can log in with Google OAuth (Google only per human feedback)
- Session persists for 7 days in Redis (per human feedback)
EOF
gh issue edit 123 --body-file /tmp/body.md
```

### Bad: Don't put questions in body
```bash
# DON'T DO THIS - questions belong in comments
gh issue edit 123 --body "... ## Conversation Log\n\nAgent: What OAuth provider?..."
```
