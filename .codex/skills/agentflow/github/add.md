# /af add - GitHub Backend

Create a new GitHub issue and add it to the project board.

## Process

**Step 1: Gather info**
- Ask user for type (feature/bug/refactor) if not obvious
- Ask user for priority (default: medium)
- Map type to label: feature→enhancement, bug→bug, refactor→refactor

**Step 2: Create issue body**
```bash
cat > /tmp/claude/issue-body.md << 'EOF'
## Type
{feature | bug | refactor}

## Priority
{critical | high | medium | low}

## Description
{description from user or title if simple}

---

## History
| Date | Column | Actor | Notes |
|------|--------|-------|-------|
| {YYYY-MM-DD} | New | Human | Created |
EOF
```

**Step 3: Create issue**
```bash
gh issue create \
  --title "{title}" \
  --body-file /tmp/claude/issue-body.md \
  --label "{type_label}"
# Capture the returned URL: https://github.com/OWNER/REPO/issues/NUMBER
```

**Step 4: Add to project**
```bash
gh project item-add $PROJECT --owner $OWNER --url {ISSUE_URL}
```

**Step 5: Get item ID**
```bash
ITEM_ID=$(gh project item-list $PROJECT --owner $OWNER --format json | \
  jq -r '.items[] | select(.content.number == NUMBER) | .id')
```

**Step 6: Set status to New**
```bash
gh project item-edit \
  --project-id $PROJECT_ID \
  --id $ITEM_ID \
  --field-id $STATUS_FIELD_ID \
  --single-select-option-id $(jq -r '.statusOptions.new' .agentflow/github.json)
```

**Step 7: Verify**
```bash
gh issue view NUMBER --json number,title,labels
```

## Confirm

"✅ Created issue #{number}: {title} in New"
