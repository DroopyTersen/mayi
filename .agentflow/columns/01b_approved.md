# Column: Approved

**Actor:** Agent (Ralph Loop)
**Agent:** None
**Commit:** None

---

## Summary

Holding area for human-approved cards ready for agent work. Cards enter this column when a human moves them from `new`, signaling they are ready to be processed.

The Ralph Loop picks up cards from this column, creates a feature branch, and moves them to Refinement.

---

## Definition of Done

- Feature branch created and checked out
- Branch name recorded in card context
- Card moved to `refinement` column

---

## What Happens

### Agent Pickup

The next Ralph Loop iteration:
1. Picks up the card from `approved`
2. Creates feature branch (or checks out existing)
3. Records branch name in card context
4. Moves card to `refinement`
5. Continues with refinement phase

---

## Branch Creation

When picking up a card from `approved`, create a dedicated branch.

### Step 1: Check for Existing Branch

First, check if the card already has a branch (returning from rejection):

```
Look for "## Branch" section in card context
```

**If branch exists:** Just checkout the existing branch:
```bash
git checkout {existing-branch-name}
```
Then skip to "Record Branch" step.

**If no branch:** Continue to create one.

### Step 2: Generate Branch Name

```bash
# Format: {type}/{id}-{slug}
# Example: feature/123-add-user-authentication

TYPE={card.type}  # feature, bug, or refactor
ID={card.id}      # Issue number or card ID
SLUG=$(echo "{card.title}" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//' | sed 's/-$//' | cut -c1-50)

BRANCH="${TYPE}/${ID}-${SLUG}"
```

### Step 3: Create and Checkout Branch

```bash
# Ensure we're on main and up to date
git checkout main
git pull origin main

# Create and switch to new branch
git checkout -b "$BRANCH"
```

### Step 4: Record Branch in Card Context

Add to card context using `/af context`:
```
/af context {id} append "
## Branch
\`{branch-name}\`
"
```

---

## Entry Criteria

- Card exists in `new` column
- Human has reviewed the card
- Human moved card to `approved`

---

## Exit Criteria

- Feature branch created (or existing branch checked out)
- Branch name recorded in card context
- Card moved to `refinement` by Ralph Loop

---

## Next Column

> **Refinement** (picked up by Ralph Loop)
