---
name: agentflow
description: AgentFlow Kanban workflow for AI-assisted development. Use when the user mentions agentflow, cards, board, tasks, or wants to track work items, anything about a "Ralph Loop" etc... Translates informal requests into proper /af commands.
---

# AgentFlow Skill

A friendly interface to the AgentFlow Kanban workflow. Translates informal requests into `/af` commands.

## Documentation Structure

- `@.claude/commands/af.md` — Command dispatcher (start here)
- `@.claude/skills/agentflow/core.md` — Shared concepts (columns, tags, agents)
- `@.claude/skills/agentflow/github/` — GitHub Projects backend implementation
- `@.claude/skills/agentflow/json/` — Local JSON backend implementation

The af.md dispatcher will guide you to read the appropriate backend-specific files based on which config exists (`.agentflow/github.json` or `.agentflow/board.json`).

## How This Works

Users can speak naturally about their workflow. This skill interprets intent and invokes the appropriate `/af` command.

## Context Management — Use Subagents

**Important:** Run board queries as subagents to keep the main context clean.

Commands like `/af status`, `/af list`, and `/af show` can produce verbose output (JSON parsing, API calls, full card bodies). Instead of running these directly, delegate to a subagent:

```
Use Task tool with:
  subagent_type: "general-purpose"
  model: "haiku"
  prompt: |
    Run /af status (or /af list, /af show <id>)
    Return a concise summary:
    - Workable cards (count and top 3)
    - Cards needing feedback
    - Cards in final review
    - Any blockers or issues
```

Then present the subagent's summary to the user in a nice format.

**Why this matters:**
- Subagent handles verbose gh CLI output, JSON parsing, etc.
- Main conversation stays clean — only the summary enters context
- User gets a nice formatted response without the noise

**When to use subagents:**
| Command | Use Subagent? |
|---------|---------------|
| `/af status` | Yes — can be verbose |
| `/af list` | Yes — full board listing |
| `/af show <id>` | Yes — full card body + comments |
| `/af add` | No — interactive, needs user input |
| `/af move` | No — simple, quick |
| `/af tag` | No — simple, quick |
| `/af depends` | Maybe — if checking multiple predecessors |

## Common Requests → Commands

| User says...                                      | Invoke                                            |
| ------------------------------------------------- | ------------------------------------------------- |
| "add a card for X" / "track X" / "I need to do X" | `/af add "X"`                                     |
| "what's on my board?" / "show me my cards"        | `/af list`                                        |
| "what should I work on?" / "status"               | `/af status`                                      |
| "work on the next thing" / "keep going"           | `/af next`                                        |
| "show me card abc123" / "details on abc123"       | `/af show abc123`                                 |
| "I answered the questions on abc123"              | `/af feedback abc123`                             |
| "move abc123 to done"                             | `/af move abc123 done`                            |
| "review the code on abc123"                       | `/af review abc123`                               |
| "start the loop" / "run autonomously"             | Launch loop directly — NO status check first! (see Autonomous Mode) |
| "card X depends on Y" / "X is blocked by Y"       | `/af depends X on Y`                              |

## Quick Reference

**Columns:** new → approved → refinement → tech-design → implementation → final-review → done

**Tags that block work:**

- `needs-feedback` — agent has questions for human
- `blocked` — waiting on external dependency

**Card priorities:** critical > high > medium > low

## When to Use Each Command

### Adding Work

```
/af add "Title of the work item"
```

Creates a card in the New column. Will prompt for type (feature/bug/refactor) and priority.

### Checking Status

```
/af status   # Quick overview: what's workable, what needs attention
/af list     # Full board view by column
/af show ID  # Deep dive on one card
```

### Doing Work

```
/af next     # Work on highest-priority workable card
/af work ID  # Work on a specific card
```

### Human Checkpoints

```
/af feedback ID         # Respond to agent questions
/af feedback ID "answer"  # Quick response in one command
```

### Manual Control

```
/af move ID COLUMN  # Move card to any column
/af review ID       # Run code review on a card
```

### Autonomous Mode (Ralph Loop)

**IMPORTANT: Launch the loop directly. Do NOT run `/af status` first.** The loop checks the board itself — a preliminary status check wastes 1-2 minutes.

**Two ways to run the loop:**

| Method | When to use |
|--------|-------------|
| Terminal | User runs `.agentflow/loop.sh` directly in their terminal |
| Task agent | Claude runs the loop via Task tool (subagent) |

**From terminal (recommended for long runs):**
```bash
.agentflow/loop.sh 50   # User runs this in their terminal
```

**From within Claude (via Task agent) — launch immediately, no status check:**
```
Use Task tool with:
  subagent_type: "general-purpose"
  run_in_background: true
  prompt: |
    Run the AgentFlow loop. Read .agentflow/RALPH_LOOP_PROMPT.md and execute iterations.
    For each iteration:
    1. Run /af list --workable to find cards
    2. If no workable cards, output AGENTFLOW_NO_WORKABLE_CARDS and stop
    3. Select highest priority card, run /af work <id>
    4. After completing the phase, continue to next iteration
    Max iterations: 50
```

**Important:** Do NOT use `Bash` with `run_in_background: true` to run `loop.sh`. The bash script spawns `claude` CLI subprocesses which stalls when run from within Claude. Use the Task agent approach instead.

**Loop output files:**
- `.agentflow/loop_status.txt` — Quick status summary (always small, read this first)
- `.agentflow/iterations/` — Per-iteration output files (only last 5 kept)
- `.agentflow/progress.txt` — Accumulated progress log

**When user asks for status** ("how's the loop?", "what's the progress?"):
1. Read `.agentflow/loop_status.txt` for quick loop state
2. Read `.agentflow/progress.txt` for completed work summary
3. Optionally read latest iteration file for details: `tail -50 .agentflow/iterations/iteration_*.txt | tail -50`
4. Run `/af status` (via subagent) to see current board state
5. Summarize for user

**Example response:**
```
Ralph Loop Progress:
✓ #123 Add OAuth: refinement → tech-design
✓ #124 Fix bug: tech-design → implementation
🔄 #125 Search: currently in implementation

Loop: Running (iteration 12/50)
Needs attention: #126 has questions (needs-feedback)
```

**Note:** Don't read the full task output (it grows large). Use `loop_status.txt` instead.

## Interpreting User Intent

When the user's request is ambiguous:

1. Check current board state with `/af status`
2. Use `/af status` to understand what needs attention
3. Ask clarifying questions if multiple interpretations exist

When the user seems stuck:

- If cards have `needs-feedback` tag → prompt them to answer questions
- If cards are in `final-review` → prompt them to approve/reject
- If no workable cards → explain the board state

**When starting the loop:** Don't run `/af status` first. Just launch the loop directly — it will check the board itself. The preliminary status check wastes time.

## Full Command Reference

For complete command documentation:
1. Start with `@.claude/commands/af.md` (dispatcher)
2. Read `@.claude/skills/agentflow/core.md` for shared concepts
3. Read backend-specific files as directed by af.md
