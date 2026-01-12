# Column: Tech Design

**Actor:** Agent (with optional human feedback loop)
**Agent:** `code-architect`
**Commit:** Spec commit

---

## Summary

Design the technical approach for implementing the work item. This phase focuses on **how** to build it. The goal is to resolve all technical unknowns and create a plan detailed enough that implementation is mostly execution.

### Default Behavior: Research Three Approaches

**For most work items, research and present THREE approaches:**

1. **Minimal** — The smallest change that solves the problem. Quick to implement, but may cut corners or accumulate tech debt. Good for time-sensitive fixes.

2. **Idealistic** — The "right" way if we had unlimited time. Clean architecture, full test coverage, handles all edge cases. May be over-engineered for the actual need.

3. **Pragmatic** — A balanced middle ground. Addresses the core problem well, maintainable code, reasonable scope. Often the best choice.

**Then get human feedback:**
- Compare and contrast the approaches
- Explain trade-offs (time, complexity, maintainability, risk)
- Make a recommendation with rationale
- Ask the human which approach (or blend) to use
- Add `needs-feedback` tag and exit

### When to Skip Multi-Approach Analysis

Only proceed without presenting approaches if ALL of these are true:
- It's a small bug fix with an obvious, single-line or trivial fix
- There is genuinely only ONE reasonable approach (not three)
- No architectural decisions, new patterns, or design choices involved
- The fix is low-risk and easily reversible

**For features**: Always present three approaches.
**For bugs**: Present approaches if the fix touches >2-3 files or has multiple solutions.
**For refactors**: Always present three approaches.

When in doubt, research the approaches and ask. A 5-minute pause for human input beats hours of rework.

---

## Definition of Done

- Technical approach documented with rationale
- Decision section (if multiple approaches considered)
- Files to create/modify listed
- Verification steps specified (specific commands)
- All unknowns resolved
- Spec committed

---

## Execution Steps

### Step 1: Read Card Context

```
Read the card's context (title, description, type, and Refinement section)
```

Review the Refinement section for:
- Functional requirements
- Acceptance criteria
- Edge cases
- Any answered questions in Conversation Log

### Step 2: Launch Architecture Agents (in parallel)

Launch 2-3 code-architect agents **in parallel**, each with a different focus:

```
# Agent 1: Minimal Changes
Agent("code-architect")
> Task: {card.title}
> Requirements: {from Refinement section}
> Focus: MINIMAL CHANGES
> Design the smallest change that solves the problem.
> Maximize reuse of existing code and patterns.
> Prioritize: low risk, fast implementation, minimal footprint.
> Accept trade-offs: may not be the cleanest, may accumulate some tech debt.

# Agent 2: Clean Architecture
Agent("code-architect")
> Task: {card.title}
> Requirements: {from Refinement section}
> Focus: CLEAN ARCHITECTURE
> Design the "right" way if we had unlimited time.
> Prioritize: maintainability, elegant abstractions, full edge case handling.
> Accept trade-offs: may be more effort, could be over-engineered for the need.

# Agent 3: Pragmatic Balance
Agent("code-architect")
> Task: {card.title}
> Requirements: {from Refinement section}
> Focus: PRAGMATIC BALANCE
> Design a balanced approach: quality + reasonable scope.
> Prioritize: addresses core problem well, maintainable, ships soon.
> Accept trade-offs: may not be perfect, but good enough and sustainable.
```

Each agent will independently:
- Analyze the problem through their specific lens
- Design an implementation approach
- List files to create/modify
- Identify risks and trade-offs

### Step 2b: Review and Synthesize

After all agents complete:

1. **Review all approaches** — read each agent's output
2. **Form your opinion** — which fits best for THIS specific task? Consider:
   - Is this a small fix or large feature?
   - How urgent is it?
   - How complex is the problem?
   - What's the project's current state (early vs mature)?
3. **Note concrete differences** — where do the approaches actually diverge in implementation?

### Step 3: Present Approaches for Human Feedback (Default)

**Default behavior — present to user and get feedback:**

1. **Brief summary of each approach** — 2-3 sentences capturing the essence
2. **Trade-offs comparison** — table or bullet list comparing key dimensions
3. **Concrete implementation differences** — where do the approaches actually diverge?
   - Different files touched?
   - Different abstractions created?
   - Different levels of test coverage?
4. **Your recommendation with reasoning** — which approach fits THIS task and WHY
5. **Ask the user** which approach they prefer (or what blend)

Then:
- Document everything in the card context
- Add `needs-feedback` tag
- Exit this iteration — human will respond

**Exception — skip to finalize (rare):**

Only skip presenting approaches if ALL of these are true:
- Trivial bug fix (single-line or <10 lines changed)
- Genuinely only ONE way to fix it
- Zero design decisions involved
- Low risk, easily reversible

If skipping, document why in the card context, then proceed to Step 5.

### Step 4: Human Responds (only if tagged)

This step happens outside the Ralph Loop:
1. Human reviews tech design options
2. Human responds in Conversation Log:
   - Approves approach, OR
   - Selects from options, OR
   - Provides feedback
3. Human removes `needs-feedback` tag

Next Ralph iteration picks up the card and continues.

### Step 5: Finalize Design

1. Read human's decision (if there was one)
2. Clean up the design:
   - Remove unchosen approaches (if multiple were proposed)
   - Add Decision section with rationale
   - Fully document the chosen approach
3. Ensure documentation includes:
   - Files to create/modify
   - Implementation sequence
   - Verification steps (specific commands)
   - TDD plan

### Step 6: Create Spec Commit and Push

```bash
git add .
git commit -m "spec({type}): {title}"
git push -u origin HEAD
```

The `-u` flag sets upstream tracking for the branch.

Note: The `/af` command handles staging the appropriate files for the backend.

Examples:
- `spec(feature): add user authentication`
- `spec(bug): fix pagination offset`
- `spec(refactor): extract validation utils`

### Step 7: Update Card and Move

1. Append Tech Design section to card context (see template below)
2. Update History table
3. Move card to `implementation` column

---

## By Work Item Type

### Feature

**Focus:** How do we build this new functionality?
**Design Depth:** Medium to High

**Document:**
- Component architecture
- New interfaces/types
- Integration approach
- Data flow (if complex)
- Test strategy

### Bug

**Focus:** What went wrong? How do we fix it safely?
**Design Depth:** Low to Medium

**Document:**
- Root cause identification
- Fix approach
- Regression prevention
- Failing test case (often helpful to write before fixing)

### Refactor

**Focus:** How do we transform current state to desired state?
**Design Depth:** Medium to High

**Document:**
- Current state documentation
- Desired state specification
- Migration/transformation steps
- Behavior preservation verification

---

## Card Context Update

### If Human Input Needed (awaiting feedback)

```markdown
---

## Tech Design
**Date:** {YYYY-MM-DD}
**Agent:** code-architect
**Status:** Awaiting feedback

### Requirements Summary
**Must Have:**
- Requirement 1 (from refinement)

**Constraints:**
- Constraint 1

### Proposed Approaches

#### Approach 1: Minimal
{The smallest change that solves the problem}

**Overview:** {Brief description}
**Pros:**
- Quick to implement
- Low risk of breaking existing code

**Cons:**
- May accumulate tech debt
- Doesn't handle edge case X

**Complexity:** Low | **Risk:** Low

#### Approach 2: Idealistic
{The "right" way if we had unlimited time}

**Overview:** {Brief description}
**Pros:**
- Clean architecture
- Handles all edge cases
- Easy to extend later

**Cons:**
- Significant implementation effort
- May be over-engineered for current needs

**Complexity:** High | **Risk:** Medium

#### Approach 3: Pragmatic
{Balanced middle ground}

**Overview:** {Brief description}
**Pros:**
- Addresses core problem well
- Maintainable without over-engineering
- Reasonable scope

**Cons:**
- Trade-off description

**Complexity:** Medium | **Risk:** Low

### Comparison Summary

| Aspect | Minimal | Idealistic | Pragmatic |
|--------|---------|------------|-----------|
| Implementation effort | Low | High | Medium |
| Maintainability | Fair | Excellent | Good |
| Handles edge cases | Partial | Full | Most |
| Tech debt risk | Higher | None | Low |

### Recommendation
**Recommended:** Approach {N} ({Name})

**Rationale:** {Why this approach is recommended — consider the specific context, timeline, and priorities}

**Alternative consideration:** {When another approach might be better}

---

## Conversation Log

... (previous entries) ...

**Agent ({date}):** I've designed three approaches for {card title}:

**Minimal:** {2-3 sentence summary}
**Clean:** {2-3 sentence summary}
**Pragmatic:** {2-3 sentence summary}

**Key differences:**
- Minimal touches {N} files, Clean touches {M} files
- Clean adds {abstraction}, Minimal reuses existing {pattern}
- {Other concrete difference}

**Trade-offs:**
| Aspect | Minimal | Clean | Pragmatic |
|--------|---------|-------|-----------|
| Effort | Low | High | Medium |
| Risk | Low | Medium | Low |
| Maintainability | Fair | Excellent | Good |

**My recommendation:** {Approach} — {reasoning specific to this task, considering urgency, complexity, project maturity}

Which approach would you like? Or a blend (e.g., "Pragmatic, but use Clean's abstraction for X")?

{Human will respond below}
```

### If Complete (moving to implementation)

```markdown
---

## Tech Design
**Date:** {YYYY-MM-DD}
**Agent:** code-architect
**Status:** Complete

### Requirements Summary
**Must Have:**
- Requirement 1

**Constraints:**
- Constraint 1

### Decision
**Approaches Considered:**
1. **Minimal** — {brief summary}
2. **Idealistic** — {brief summary}
3. **Pragmatic** — {brief summary}

**Selected:** {Name} (or blend: "{description}")

**Rationale:** {Why this approach was chosen, including human's input}

### Technical Design

{Comprehensive documentation of the chosen approach}

#### Files to Create
| File | Purpose |
|------|---------|
| `path/to/new.ts` | What it does |

#### Files to Modify
| File | Changes |
|------|---------|
| `path/to/existing.ts` | What changes |

#### Implementation Sequence
1. {First step}
2. {Second step}
3. {etc.}

### Verification Steps
| Step | Command | Expected |
|------|---------|----------|
| Type check | `bun run typecheck` | No errors |
| Unit tests | `bun test` | All pass |
| Build | `bun run build` | Success |
| UI test | {scenario} | {expected behavior} |

**TDD Plan:**
- [ ] Write test for {scenario 1}
- [ ] Write test for {scenario 2}

### Spec Commit
**SHA:** `{sha}`
**Branch:** `{branch-name}`
**Date:** {YYYY-MM-DD}

---

## Conversation Log

... (previous entries) ...

**Agent ({date}):** I've analyzed two approaches. I recommend Approach 2. Which would you prefer?

**Human ({date}):** Go with Approach 2, but keep the API simple.

**Agent ({date}):** Understood. Using Approach 2 with simplified API surface.
```

---

## Tag Handling

| Condition | Action |
|-----------|--------|
| Multiple viable approaches | Add `needs-feedback`, document options |
| Significant decision needed | Add `needs-feedback`, document recommendation |
| Human approved/selected | Remove `needs-feedback`, finalize design |
| External blocker | Add `blocked`, document reason |

---

## Entry Criteria

- Refinement phase complete
- Functional requirements documented
- No `needs-feedback` or `blocked` tag

---

## Exit Criteria

- Technical design documented
- Human approved approach (if feedback was needed)
- Decision section included (if multiple approaches considered)
- Verification steps specified
- Spec committed
- Card moved to `implementation`

---

## Important Notes

- **Do not implement in this phase** - only design and plan
- **Exception for bugs:** Writing a failing test is acceptable and encouraged
- **Be specific about verification** - vague plans lead to skipped verification
- **Junior developer test:** If a junior couldn't execute this plan, add more detail
- **Document the decision** - future readers should understand why

---

## Next Column

> **Implementation**
