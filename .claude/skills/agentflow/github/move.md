# /af move - GitHub Backend

Move a card to a different column.

## Process

**Step 1: Get item ID**
```bash
ITEM_ID=$(gh project item-list $PROJECT --owner $OWNER --format json | \
  jq -r '.items[] | select(.content.number == NUMBER) | .id')
```

**Step 2: Get option ID for target column**
```bash
OPTION_ID=$(jq -r '.statusOptions["column-name"]' .agentflow/github.json)
```

**Step 3: Update status**
```bash
gh project item-edit \
  --project-id $(jq -r '.projectId' .agentflow/github.json) \
  --id $ITEM_ID \
  --field-id $(jq -r '.statusFieldId' .agentflow/github.json) \
  --single-select-option-id $OPTION_ID
```

## Valid Columns

new, approved, refinement, tech-design, implementation, final-review, done

## Warnings

- Moving to agent column: "Note: Agent will pick up this card"
- Moving backward: "Warning: Moving backward may lose work"

## Confirm

"✅ Moved #123 to {column}"
