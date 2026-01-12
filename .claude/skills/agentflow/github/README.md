# GitHub Projects Backend

Uses GitHub Projects (new Projects, not classic) as the board and GitHub Issues as cards.

## Detection

Backend is active when `.agentflow/github.json` exists.

## Prerequisites

```bash
gh auth status                    # Verify authenticated
gh auth refresh -s project        # Add project scope if needed
```

## Configuration

`.agentflow/github.json` contains:
```json
{
  "project": 42,                    // Project number from URL
  "owner": "username",              // GitHub username or org
  "repo": "repo-name",              // Repository name
  "projectId": "PVT_...",           // GraphQL node ID
  "statusFieldId": "PVTSSF_...",    // Status field ID
  "statusOptions": {                // Column name → option ID
    "new": "...",
    "approved": "...",
    "refinement": "...",
    "tech-design": "...",
    "implementation": "...",
    "final-review": "...",
    "done": "..."
  }
}
```

Run `/af-setup-github` to create this file.

## Core Patterns

### Get Project Info
```bash
PROJECT=$(jq -r '.project' .agentflow/github.json)
OWNER=$(jq -r '.owner // empty' .agentflow/github.json)
if [ -z "$OWNER" ]; then
  REMOTE=$(git remote get-url origin)
  OWNER=$(echo "$REMOTE" | sed -E 's#.*(github\.com[:/])([^/]+)/.*#\2#')
fi
```

### List Project Items
```bash
gh project item-list $PROJECT --owner $OWNER --format json
# Returns: { "items": [...] }
```

### Get Item ID for Issue
```bash
ITEM_ID=$(gh project item-list $PROJECT --owner $OWNER --format json | \
  jq -r '.items[] | select(.content.number == NUMBER) | .id')
```

### Update Item Status (Move Card)
```bash
PROJECT_ID=$(jq -r '.projectId' .agentflow/github.json)
STATUS_FIELD_ID=$(jq -r '.statusFieldId' .agentflow/github.json)
OPTION_ID=$(jq -r '.statusOptions["column-name"]' .agentflow/github.json)

gh project item-edit \
  --project-id $PROJECT_ID \
  --id $ITEM_ID \
  --field-id $STATUS_FIELD_ID \
  --single-select-option-id $OPTION_ID
```

### Issue Operations
```bash
# Create
gh issue create --title "Title" --body-file /tmp/body.md --label "enhancement"

# View (ALWAYS include comments)
gh issue view NUMBER --json number,title,body,labels,state,comments

# Edit labels
gh issue edit NUMBER --add-label "needs-feedback"
gh issue edit NUMBER --remove-label "blocked"

# Edit body
gh issue view NUMBER --json body -q '.body' > /tmp/body.md
# ... modify file ...
gh issue edit NUMBER --body-file /tmp/body.md

# Add comment
gh issue comment NUMBER --body "**Agent (date):** Message"
```

## Card Identification

Cards are identified by **issue number** (e.g., `123`, `#123`).

## Card Context

Card context is stored in the **issue body**. Use `gh issue view` to read and `gh issue edit --body-file` to update.

## Conversation Log

Use **issue comments** for agent-human dialogue:
- `gh issue comment NUMBER --body "message"` to add
- `gh issue view NUMBER --json comments` to read

## Labels vs Tags

GitHub uses labels. Map AgentFlow tags to labels:
- `needs-feedback` → label `needs-feedback`
- `blocked` → label `blocked`
- Card type → labels `enhancement`, `bug`, `refactor`
