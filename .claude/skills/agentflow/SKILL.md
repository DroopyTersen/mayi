---
name: agentflow
description: AgentFlow Kanban workflow for AI-assisted development. Use when the user mentions agentflow, cards, board, tasks, or wants to track work items, anything about a "Ralph Loop" etc... Translates informal requests into proper /af commands.
---

# AgentFlow Skill

A friendly interface to the AgentFlow Kanban workflow. Translates informal requests into `/af` commands.

Please read @.claude/commands/af.md for the complete command reference.

## How This Works

Users can speak naturally about their workflow. This skill interprets intent and invokes the appropriate `/af` command.

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
| "start the loop" / "run autonomously"             | `/af loop` (provides backend-specific instructions) |

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

### Autonomous Mode

The loop runs externally (not inside Claude):

```
/af loop    # Shows instructions for running the external loop
```

## Interpreting User Intent

When the user's request is ambiguous:

1. Check current board state with `/af status`
2. Use `/af status` to understand what needs attention
3. Ask clarifying questions if multiple interpretations exist

When the user seems stuck:

- If cards have `needs-feedback` tag → prompt them to answer questions
- If cards are in `final-review` → prompt them to approve/reject
- If no workable cards → explain the board state

## Full Command Reference

For complete command documentation, see:
@.claude/commands/af.md
