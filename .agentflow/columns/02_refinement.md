# Column: Refinement

**Actor:** Agent (with optional human feedback loop)
**Agent:** `code-explorer`
**Commit:** None

---

## Summary

Document user-facing functional requirements. This phase focuses on **what** needs to happen, not **how** to implement it. Think of this as backlog refinement.

**Default: Ask questions.** Only proceed without human input if ALL of these are true:
- The card description is highly specific (not vague or open-ended)
- There is only ONE reasonable interpretation
- You have HIGH confidence you understand exactly what the user wants
- It's a small, scoped bug fix with obvious expected behavior

When in doubt, ask. It's better to pause for clarification than to build the wrong thing.

---

## Definition of Done

- Acceptance criteria documented (measurable)
- Edge cases identified
- Verification approach outlined
- All questions answered (no `needs-feedback` tag)

---

## Execution Steps

### Step 1: Read Card Context

```
Read the card's context (title, description, type, priority, and any existing sections)
```

### Step 2: Run Code Explorer

Invoke the code-explorer agent:

```
Agent("code-explorer")
> Task: {card.title}
> Type: {card.type}
> Description: {from card}
> Project context: {from PROJECT_LOOP_PROMPT.md}
```

The explorer will:
- Find relevant existing code and patterns
- Trace execution paths for similar functionality
- Identify integration points
- Document context for the work item

### Step 3: Evaluate Requirements Clarity

Based on the exploration, decide:

**If CLEAR (can proceed):**
- Document full functional requirements
- Skip to Step 5 (finalize)

**If UNCLEAR (need human input):**
- Document questions in Conversation Log
- Add `needs-feedback` tag
- Exit this iteration (human will respond)

### Step 4: Human Responds (only if tagged)

This step happens outside the Ralph Loop:
1. Human reviews card
2. Human answers questions in Conversation Log
3. Human removes `needs-feedback` tag

Next Ralph iteration picks up the card and continues.

### Step 5: Finalize Requirements

Document complete functional requirements:
- User-facing behavior descriptions
- Acceptance criteria (measurable)
- Edge cases and error scenarios
- Verification approach (how we'll know it works)

### Step 6: Update Card and Move

1. Append Refinement section to card context (see template below)
2. Update History table
3. Move card to `tech-design` column
4. Update card metadata (timestamp, etc.)

---

## By Work Item Type

### Feature

**Focus:** What should it do? How should it behave?

**Document:**
- Feature description in user terms
- Acceptance criteria (what "done" looks like)
- User workflows affected
- Edge cases and error states

### Bug

**Focus:** What exactly went wrong? What should happen instead?

**Document:**
- Detailed reproduction steps
- Expected vs actual behavior
- Environment/conditions where it occurs
- Impact assessment

### Refactor

**Focus:** What changes? What must stay the same?

**Document:**
- Current behavior documentation
- Desired state description
- Scope boundaries (what's in/out)
- Behavior that must be preserved

---

## Card Context Update

### If Questions Needed (awaiting feedback)

```markdown
---

## Refinement
**Date:** {YYYY-MM-DD}
**Agent:** code-explorer
**Status:** Awaiting feedback

### Relevant Files
| File | Purpose | Relevance |
|------|---------|-----------|
| `path/to/file.ts` | Description | Why it matters |

### Codebase Context
{What the agent learned about existing code and patterns}

---

## Conversation Log

**Agent ({YYYY-MM-DD}):** I've explored the codebase and have some questions:

1. {Question 1}
2. {Question 2}

{Human will respond below}
```

### If Complete (moving to tech-design)

```markdown
---

## Refinement
**Date:** {YYYY-MM-DD}
**Agent:** code-explorer
**Status:** Complete

### Relevant Files
| File | Purpose | Relevance |
|------|---------|-----------|
| `path/to/file.ts` | Description | Why it matters |

### Functional Requirements
{User-facing description of what this work item needs to accomplish}

### Acceptance Criteria
- [ ] Criterion 1 (user-facing, measurable)
- [ ] Criterion 2
- [ ] Edge case: {scenario}

### For Bugs: Reproduction Steps
1. Step 1
2. Step 2
3. Expected: X
4. Actual: Y

### For Refactors: Scope & Boundaries
**In Scope:**
- Item 1

**Out of Scope:**
- Item 1

**Behavior Preservation:**
- {Behavior that must remain unchanged}

### Edge Cases
| Scenario | Expected Behavior |
|----------|-------------------|
| {scenario} | {what should happen} |

### Verification Approach
{How we will know this works. Not technical commands, but scenarios.}

- Scenario A: {how to verify}
- Scenario B: {how to verify}

---

## Conversation Log

**Agent ({date}):** I've explored the codebase and have some questions:
1. Should we support both OAuth providers or just Google?
2. Where should user sessions be stored?

**Human ({date}):**
1. Start with Google only
2. Use Redis for sessions

**Agent ({date}):** Got it. Scoping requirements to Google OAuth with Redis sessions.
```

---

## Tag Handling

| Condition | Action |
|-----------|--------|
| Need human input | Add `needs-feedback` to tags array, stay in refinement |
| Questions answered | Human removes `needs-feedback`, agent picks up next iteration |
| External blocker | Add `blocked` to tags array, document reason |

---

## Entry Criteria

- Card exists with title, description, type
- Card in `new` column or returning from `needs-feedback`
- No `blocked` tag

---

## Exit Criteria

- Functional requirements documented
- Acceptance criteria clear and measurable
- All questions answered
- Card moved to `tech-design`

---

## Important Notes

- **Do not include implementation details** - that's for Tech Design
- **Think like a product owner** - what does the user need?
- **Be comprehensive** - edge cases discovered now save time later
- **Iterate if needed** - it's okay to ask follow-up questions

---

## Next Column

> **Tech Design**
