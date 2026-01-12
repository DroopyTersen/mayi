# Column: Implementation

**Actor:** Agent
**Agent:** `code-reviewer` (after implementation)
**Commit:** Implementation commit

---

## Summary

Execute the tech design. Write tests first (TDD preferred), implement the solution, run verification, and get code review. The tech design should have resolved all unknowns, so this phase is primarily execution.

This column is typically agent-only with no human interaction (unless blocked or drift detected).

---

## Definition of Done

- Tests written (before implementation when possible)
- Implementation complete per tech design
- All verification steps passing
- Code review completed (score >= 70)
- Implementation committed
- Card moved to Final Review

---

## Execution Steps

### Step 1: Read Card Context

```
Read the card's context (title, description, Refinement, and Tech Design sections)
```

Find the Tech Design section:
- Look for `## Tech Design` with `**Status:** Complete`
- If no complete tech design found, exit: "Waiting for tech design to complete"

### Step 2: Write Tests First (TDD)

Before implementing, write tests based on the verification plan:

**Features:**
- Write tests for happy path
- Write tests for edge cases

**Bugs:**
- Write failing test that reproduces the bug

**Refactors:**
- Verify existing tests cover behavior to preserve

### Step 3: Implement the Solution

Follow the tech design:
- Create new files as specified
- Modify existing files as planned
- Follow project conventions from `PROJECT_LOOP_PROMPT.md`
- Follow the implementation sequence from tech design

### Step 4: Cursory Verification

Quick checks to catch obvious issues:

```bash
# Adapt these to the project (check PROJECT_LOOP_PROMPT.md)
bun run typecheck || npm run typecheck || npx tsc --noEmit
bun test || npm test
bun run build || npm run build
```

### Step 5: Complete Implementation

If using TDD, iterate until tests pass:
- Make the failing tests pass
- Refactor if needed while keeping tests green

### Step 6: Code Review

Invoke the code-reviewer agent:

```
Agent("code-reviewer")
> Card: {card.title}
> Tech design: {from card}
> Files changed: {list of files}
```

**Evaluate the score:**

| Score | Verdict | Action |
|-------|---------|--------|
| 90-100 | Excellent | Proceed to full verification |
| 80-89 | Good | Proceed, note minor issues |
| 70-79 | Acceptable | Proceed, address noted issues |
| 50-69 | Needs Work | Fix critical issues, re-review |
| 0-49 | Significant Issues | Must fix before proceeding |

If score < 70: Address issues and invoke code-reviewer again.

### Step 7: Full Verification

Execute all verification steps from tech design:

```bash
# All tests
bun test

# Type check
bun run typecheck

# Build
bun run build

# Integration tests (if applicable)
bun test integration/

# UI testing via Claude Chrome (if applicable)
```

All verification must pass before proceeding.

**If verification cannot be completed:** See [Verification Blockers](#verification-blockers) below.

### Step 8: Create Implementation Commit and Push

```bash
git add .
git commit -m "{type}({scope}): {title}"
git push origin HEAD
```

This pushes to the feature branch established in the Approved phase.

**Type mapping:**
- feature → `feat`
- bug → `fix`
- refactor → `refactor`

**Examples:**
- `feat(auth): add OAuth login with Google provider`
- `fix(pagination): correct offset calculation`
- `refactor(validation): extract shared utilities`

### Step 9: Update Card and Move

1. Append Implementation and Code Review sections to card context
2. Update History table
3. Move card to `final-review` column

---

## Drift Prevention

If during implementation you discover the tech design needs significant changes:

1. Stop implementation
2. Document the issue in Conversation Log
3. Add `needs-feedback` tag
4. Add note explaining what needs revision
5. Exit this iteration (human will review)

Do NOT continue implementing if the design is wrong.

---

## By Work Item Type

### Feature

**TDD Approach:**
1. Write tests for happy path
2. Write tests for edge cases
3. Implement until tests pass
4. Refactor with green tests

**Verification:** Full test coverage for new code

### Bug

**TDD Approach:**
1. Write failing test that reproduces bug
2. Implement fix
3. Verify test passes
4. Run regression tests

**Verification:** Bug test passes, existing tests still pass

### Refactor

**TDD Approach:**
1. Ensure existing tests cover behavior
2. Make incremental changes
3. Keep tests green throughout

**Verification:** All existing tests still pass, behavior unchanged

---

## Code Review Scoring

**Score Breakdown:**
| Category | Points | What It Measures |
|----------|--------|------------------|
| Functionality | 40 | Does it work correctly? |
| Architecture Compliance | 20 | Does it follow the tech design? |
| Code Quality | 20 | Is it clean, readable, maintainable? |
| Safety/Security | 20 | Are there security concerns? |

---

## Card Context Update

```markdown
---

## Implementation
**Date:** {YYYY-MM-DD}

### Tests Written
| Test File | Coverage |
|-----------|----------|
| `path/to/test.ts` | {what it tests} |

### Changes Made
| File | Change | Description |
|------|--------|-------------|
| `path/to/new.ts` | Created | New component for X |
| `path/to/existing.ts` | Modified | Added Y functionality |

### Verification Results

#### Cursory Verification
- Type check: Pass
- Build: Pass
- Basic tests: Pass

#### Full Verification
| Step | Result | Notes |
|------|--------|-------|
| Type check | Pass | No errors |
| Unit tests | Pass | 15 passed, 2 new |
| Integration tests | Pass | 5 passed |
| Build | Pass | |
| UI testing | Pass | Tested via Claude Chrome |

---

## Code Review
**Date:** {YYYY-MM-DD}
**Agent:** code-reviewer
**Score:** {XX}/100

**Verdict:** {PASS | NEEDS WORK}

### Breakdown
| Category | Score | Notes |
|----------|-------|-------|
| Functionality | /40 | |
| Architecture Compliance | /20 | |
| Code Quality | /20 | |
| Safety/Security | /20 | |

### Issues Found
{Any issues and how they were addressed}

### Implementation Commit
**SHA:** `{sha}`
**Branch:** `{branch-name}`
**Date:** {YYYY-MM-DD}
```

---

## Tag Handling

| Condition | Action |
|-----------|--------|
| Tech design needs revision | Add `needs-feedback`, document issue |
| Verification cannot be completed | Add `blocked`, document reason |
| External blocker | Add `blocked`, document reason |
| Generally no tags in this phase | Proceed through to final-review |

---

## Verification Blockers

If you cannot complete any expected verification step, **do not move the card forward**. This includes situations such as:

- **UI verification unavailable** - Claude Chrome extension not configured or accessible
- **Test harness broken** - Tests fail to run due to environment issues (not test failures)
- **Build system errors** - Build fails due to missing dependencies or configuration
- **Integration environment down** - External services needed for verification are unavailable
- **Missing tools** - Required tools (typecheck, linter, etc.) not installed or configured

### When Blocked on Verification

1. **Stop immediately** - Do not proceed to commit or move the card
2. **Add `blocked` tag** to the card
3. **Add detailed comment** to the Conversation Log explaining:
   - Which verification step failed
   - What error or issue was encountered
   - What was attempted to resolve it
   - What is needed to unblock (e.g., "Chrome extension needs to be enabled", "test database needs to be running")
4. **Exit this iteration** - Allow human to review and resolve

### Card Update for Verification Blocker

```markdown
---

### Conversation Log

**Agent ({YYYY-MM-DD}):**
Blocked on verification. Unable to complete: {verification step}

**Issue:** {Detailed description of what failed}

**Attempted:** {What was tried to resolve it}

**Needed to unblock:** {What human action or configuration is required}

---
```

### Example Blockers

| Verification Step | Blocker Example | Comment |
|-------------------|-----------------|---------|
| UI testing | "Claude Chrome MCP not available in non-interactive mode" | "Need to configure --mcp-config for Chrome extension or run verification manually" |
| Type check | "npx tsc command not found" | "TypeScript not installed, run: bun install" |
| Integration tests | "Connection refused to localhost:5432" | "PostgreSQL database not running, start with: docker-compose up -d" |
| Build | "Module '@/components' not found" | "Path aliases not configured, check tsconfig.json" |

**Critical:** The card must NOT move to Final Review if verification is incomplete. A blocked card with clear documentation allows humans to either fix the environment or manually verify and move the card forward.

---

## Entry Criteria

- Tech design complete (`Status: Complete`)
- Spec committed
- Verification steps documented
- No `needs-feedback` or `blocked` tag

---

## Exit Criteria

- Tests written and passing
- Implementation matches tech design
- All verification steps passed
- Code review completed (score >= 70)
- Implementation committed
- Card moved to `final-review`

---

## Important Notes

- **TDD is preferred** - write tests before implementation
- **For bugs, start with a failing test** - it proves you understand the bug
- **Follow the tech design** - don't deviate without good reason
- **Run full verification** - don't skip steps from the verification plan
- **Fix code review issues** - don't proceed with score < 70
- **Sequence: Cursory → Code Review → Full** - catches issues early

---

## Next Column

> **Final Review**
