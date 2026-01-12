# Column: Done

**Actor:** None
**Agent:** None
**Commit:** None

---

## Summary

Terminal state. Work is complete, approved, and committed. The card remains as permanent documentation of the work performed.

The Ralph Loop ignores cards in this column.

---

## Definition of Done

N/A - This is the terminal state.

---

## What Happens

Card arrives from Human Review after approval.

- Work item is complete
- Card context contains the full history
- Commits (spec and implementation) are in repository history
- Card remains for future reference

No further action required.

---

## Card Final State

```markdown
# {Title}

## Type
{feature | bug | refactor}

## Priority
{priority}

## Description
{Original description}

---

## Refinement
**Date:** {date}
**Agent:** code-explorer
**Status:** Complete

### Functional Requirements
{Requirements documented}

### Acceptance Criteria
- [x] Criterion 1
- [x] Criterion 2

---

## Tech Design
**Date:** {date}
**Agent:** code-architect
**Status:** Complete

### Decision
{Approaches considered and selection rationale}

### Technical Design
{Comprehensive design documentation}

### Spec Commit
**SHA:** `{sha}`

---

## Implementation
**Date:** {date}

### Changes Made
{Files created/modified}

### Verification Results
{All verification passed}

---

## Code Review
**Date:** {date}
**Agent:** code-reviewer
**Score:** {XX}/100
**Verdict:** PASS

### Implementation Commit
**SHA:** `{sha}`

---

## Human Review
**Date:** {date}
**Reviewer:** {name}
**Decision:** Approved

---

## Completed
**Date:** {date}

### Summary
| Field | Value |
|-------|-------|
| Type | {feature / bug / refactor} |
| Branch | `{branch-name}` |
| Spec Commit | `{sha}` |
| Implementation Commit | `{sha}` |
| Code Review Score | {XX}/100 |
| Duration | {days from created to done} |

---

## Conversation Log

{Full conversation history between agent and human}

---

## History
| Date | Column | Actor | Notes |
|------|--------|-------|-------|
| {date} | New | Human | Created |
| {date} | Refinement | Agent | Recon complete |
| {date} | Refinement | Human | Questions answered |
| {date} | Refinement | Agent | Requirements documented |
| {date} | Tech Design | Agent | Approaches proposed |
| {date} | Tech Design | Human | Approach selected |
| {date} | Tech Design | Agent | Design finalized, spec committed |
| {date} | Implementation | Agent | Tests written, code complete |
| {date} | Implementation | Agent | Code review: {score}/100 |
| {date} | Implementation | Agent | Verification passed, committed |
| {date} | Human Review | Human | Approved |
| {date} | Done | - | Complete |
```

---

## Archival

Done cards can be:
- **Left in place** for reference (recommended initially)
- **Archived** periodically (backend-specific location)
- **Deleted** after a retention period

The card serves as permanent documentation of:
- What was built and why
- Decisions made along the way
- Who reviewed and approved
- Commit references for traceability
- Branch name for future reference

---

## Entry Criteria

- Human Review approved

---

## Exit Criteria

None (terminal state)

---

## Important Notes

- **Cards are documentation** - they capture the full journey
- **Commits are linked** - spec and implementation commits are recorded
- **History tells the story** - the history table shows progression
- **Keep for reference** - valuable for understanding past decisions

---

## Previous Column

< **Human Review** (arrives after approval)
