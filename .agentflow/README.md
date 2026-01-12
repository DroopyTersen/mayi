# AgentFlow MVP

A file-based Kanban workflow for AI-assisted software development using Claude Code.

## Quick Start

### 1. Copy files to your project

Copy both directories to your project root:

```
your-project/
├── .claude/          ← Copy this (rename from claude/)
├── .agentflow/       ← Copy this
└── (your code)
```

### 2. Make the loop script executable

```bash
chmod +x .agentflow/loop.sh
```

### 3. Customize for your project

Edit `.agentflow/PROJECT_LOOP_PROMPT.md` with your:
- Tech stack
- Code conventions
- Build/test commands
- Project-specific instructions

### 4. Start Claude Code

```bash
cd your-project
claude
```

### 5. Add cards and run

```bash
# In Claude:
/af add "Implement user authentication"
/af add "Fix pagination bug"

# Exit Claude, then run the loop:
.agentflow/loop.sh
```

---

## File Structure

```
your-project/
├── .claude/
│   ├── settings.json                # Permissions for Claude
│   ├── commands/
│   │   └── af.md                    # /af commands (add, list, work, etc.)
│   ├── skills/
│   │   └── agentflow/
│   │       └── SKILL.md             # Core workflow knowledge
│   └── agents/
│       ├── code-explorer.md         # Codebase reconnaissance
│       ├── code-architect.md        # Architecture design (3 approaches)
│       └── code-reviewer.md         # Code review with confidence scoring
│
└── .agentflow/
    ├── board.json                   # Board state - local backend
    ├── github.json                  # Board config - GitHub Projects backend (use one or the other)
    ├── loop.sh                      # External loop script (Ralph Wiggum style)
    ├── RALPH_LOOP_PROMPT.md         # Instructions for each loop iteration
    ├── PROJECT_LOOP_PROMPT.md       # ⚙️ PROJECT-SPECIFIC - customize this!
    ├── ralph.md                     # Loop architecture documentation
    ├── progress.txt                 # Session memory (created during loop)
    ├── .gitignore                   # Ignore temp files
    ├── columns/                     # Column-specific execution instructions
    │   ├── 01_new.md
    │   ├── 01b_approved.md
    │   ├── 02_refinement.md
    │   ├── 03_tech-design.md
    │   ├── 04_implementation.md
    │   ├── 05_final-review.md
    │   └── 06_done.md
    └── cards/                       # Card context files
        └── {card-id}.md
```

---

## The 7-Column Workflow

| # | Column | Type | What Happens |
|---|--------|------|--------------|
| 1 | **New** | Human | You add cards with `/af add` |
| 2 | **Approved** | Human | Human reviews and approves cards for agent work |
| 3 | **Refinement** | 🤖 Agent | `code-explorer` documents functional requirements |
| 4 | **Tech Design** | 🤖 Agent | `code-architect` designs technical approach |
| 5 | **Implementation** | 🤖 Agent | Code written, `code-reviewer` evaluates |
| 6 | **Final Review** | Human | Final approval before completion |
| 7 | **Done** | ✅ | Complete! |

Human feedback is handled via the `needs-feedback` tag. When an agent has questions, it adds this tag and the loop skips the card until you respond via `/af feedback`.

---

## Commands Reference

Use these inside Claude Code:

| Command | Description |
|---------|-------------|
| `/af add <title>` | Add new card to New column |
| `/af list` | List all cards by column |
| `/af status` | Quick board overview |
| `/af show <id>` | Show card details and context |
| `/af move <id> <column>` | Move card manually |
| `/af work <id>` | Work on specific card (one-off) |
| `/af next` | Work on next available card (one-off) |
| `/af review <id>` | Run code review on a card |
| `/af feedback <id>` | Respond to card with `needs-feedback` tag |

---

## Running the Loop

The loop is an **external bash script** (Ralph Wiggum pattern):

```bash
# Default: max 20 iterations
.agentflow/loop.sh

# Custom max iterations
.agentflow/loop.sh 50

# Custom completion promise
.agentflow/loop.sh 50 "ALL_DONE"

# Press Ctrl+C to stop anytime
```

### What the loop does:

1. Reads board state to find workable cards
2. Displays next card info in terminal
3. Pipes `RALPH_LOOP_PROMPT.md` to Claude Code
4. Claude reads the column-specific instructions (`columns/*.md`)
5. Claude processes ONE card phase, updates `progress.txt`, moves it, exits
6. Loop checks for completion or continues
7. Repeats until no workable cards or max iterations

### Why external loop?

- **Fresh context** each iteration (no context bloat)
- **Easy to stop** with Ctrl+C
- **Clear visibility** in terminal
- **State in files** not session memory
- **Resilient** to errors

---

## Agents

### code-explorer
Deep codebase analysis for reconnaissance:
- Finds relevant files
- Traces execution paths
- Documents patterns
- Generates clarifying questions

### code-architect
Generates three architecture approaches:
1. **Minimal** — Fastest path, extend existing code
2. **Clean** — Ideal design with proper abstractions  
3. **Pragmatic** — Balanced approach (usually recommended)

Includes trade-off matrix and implementation plan.

### code-reviewer
Reviews implementation with confidence scoring (0-100):
- **90+** = Excellent, ready to merge
- **80-89** = Good, minor issues
- **70-79** = Acceptable, some concerns
- **<70** = Needs work before human review

---

## Typical Workflow

```
# 1. Add cards
claude
> /af add "Add OAuth login"
> /af add "Fix search performance"
> /af status
> exit

# 2. Run the autonomous loop
.agentflow/loop.sh

# Loop runs until cards need human input...

# 3. Handle feedback requests
claude
> /af status                   # See which cards need feedback
> /af feedback abc123          # Answer questions for a card
> exit

# 4. Continue the loop
.agentflow/loop.sh

# 5. When cards reach Final Review
claude
> /af show abc123              # Review the implementation
> /af move abc123 done         # Approve and complete
> exit

# 6. Repeat until done!
```

---

## Card Context Files

Each card has a markdown file at `.agentflow/cards/{id}.md` that accumulates over time:

```markdown
# Add OAuth Login

## Type
Feature

## Priority
high

## Description
Implement OAuth authentication with Google provider.

---

## Refinement
**Date:** 2026-01-09
**Agent:** code-explorer
**Status:** Complete

### Relevant Files
| File | Purpose | Relevance |
|------|---------|-----------|
| `src/auth/session.ts` | Session management | Will need to integrate |
| `src/routes/login.tsx` | Login page | Add OAuth button here |

### Functional Requirements
User should be able to authenticate via Google OAuth.

### Acceptance Criteria
- [ ] User can sign in with Google
- [ ] Session persists across refreshes
- [ ] Logout clears session

---

## Tech Design
**Date:** 2026-01-09
**Agent:** code-architect
**Status:** Complete

### Decision
Selected Approach 2 (Clean) for maintainability.

### Technical Design
...implementation details...

### Spec Commit
**SHA:** `abc123`

---

## Implementation
**Date:** 2026-01-10

### Changes Made
| File | Change |
|------|--------|
| `src/auth/oauth.ts` | Created |
| `src/routes/login.tsx` | Modified |

### Verification Results
| Step | Result |
|------|--------|
| Type check | Pass |
| Tests | Pass |

---

## Code Review
**Date:** 2026-01-10
**Agent:** code-reviewer
**Score:** 87/100

### Implementation Commit
**SHA:** `def456`

---

## Conversation Log

**Agent (2026-01-09):** Should we support GitHub OAuth as well, or just Google?

**Human (2026-01-09):** Google only for now.

---

## History
| Date | Column | Actor | Notes |
|------|--------|-------|-------|
| 2026-01-09 | New | Human | Created |
| 2026-01-09 | Refinement | Agent | Requirements documented |
| 2026-01-09 | Tech Design | Agent | Design complete |
| 2026-01-10 | Implementation | Agent | Code complete, score 87/100 |
```

---

## Customization

### Project Settings (`.agentflow/PROJECT_LOOP_PROMPT.md`)

This is the most important file to customize:

- **Tech stack** — Runtime, framework, database
- **Commands** — How to run tests, typecheck, build
- **Conventions** — Code style, patterns to follow
- **Domain knowledge** — Business rules, key concepts
- **Sensitive areas** — Files not to touch

### Agent Behavior

Edit files in `.claude/agents/` to customize:
- What questions the explorer asks
- How the architect evaluates approaches
- What the reviewer checks for

### Loop Behavior

Edit `.agentflow/RALPH_LOOP_PROMPT.md` to change:
- Card selection logic
- Completion signals

Edit `.agentflow/columns/*.md` to change:
- Phase execution steps
- Agent invocation patterns
- Card file update templates

---

## Tips

1. **Start small** — Add 2-3 cards, run the loop, see how it works
2. **Answer questions thoroughly** — Better answers = better architecture
3. **Review architectures carefully** — This is your main control point
4. **Use `/af status` often** — See what needs attention
5. **Edit card files directly** — They're just markdown
6. **Customize `PROJECT_LOOP_PROMPT.md`** — Project context improves everything

---

## Troubleshooting

**"No workable cards"**
- All cards are in `new`, `final-review`, or `done` columns (human-only columns)
- Or all cards have `needs-feedback` or `blocked` tags
- Use `/af status` to see what needs attention
- Move cards from `new` to `approved` when ready for agent work
- Use `/af feedback` to respond to pending questions

**Loop exits immediately**
- Check backend config for errors (`board.json` or `github.json`)
- Make sure cards exist and aren't all tagged/blocked

**Cards stuck with `needs-feedback` tag**
- Use `/af feedback <id>` to answer questions
- Or edit the card file directly and remove from tags array

**Claude doesn't follow the workflow**
- Check `.agentflow/RALPH_LOOP_PROMPT.md` is present
- Check `.agentflow/columns/*.md` files exist
- Verify `.claude/skills/agentflow/SKILL.md` exists

**Agent not found**
- Ensure `.claude/agents/*.md` files are present
- Check settings.json has `Agent` permission
