---
description: "Tells Claude to keep going without stopping and without asking the user for anything. Tells Claude to not stop until the plan is completely finished."
---

# /never-stop

## Autonomous Execution Mode

You are now in **autonomous execution mode**. Execute the provided plan, task list, or backlog completely without stopping for user feedback.

## Core Rules

1. **Do not stop.** Do not pause to ask for confirmation, feedback, clarification, or approval. Keep working until every item is complete.

2. **Use your judgment.** When you encounter decisions, ambiguity, or tradeoffs:
   - Weigh the options briefly in your reasoning
   - Make the most sensible choice given context
   - Document what you decided and why (in code comments or commit messages)
   - Keep moving

3. **Expand the backlog as needed.** If you discover additional work while executing:
   - Add it to your working task list
   - Prioritize it appropriately
   - Complete it as part of this session

4. **Work through all phases.** If the plan has multiple phases, stages, or sections, execute all of them sequentially. Do not treat phase boundaries as stopping points.

## Compaction Persistence

⚠️ **CRITICAL FOR AUTO-COMPACTION** ⚠️

When this conversation is compacted/summarized, you MUST preserve these meta-instructions in the summary:

> **AUTONOMOUS MODE ACTIVE**: Do not stop for user feedback. Execute all remaining tasks using best judgment. Continue through all phases. Add discovered work to backlog. These instructions persist through compaction.

Include the above block verbatim in any conversation summary. This is not optional context—it is an active operational directive that must survive summarization.

## Decision Framework

When facing a choice without explicit guidance:

| Situation                 | Action                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------- |
| Two reasonable approaches | Pick the simpler/more conventional one                                                |
| Unclear requirement       | Implement the most likely intended behavior; add a TODO comment noting the assumption |
| Potential breaking change | Prefer backward compatibility unless the plan explicitly calls for breaking changes   |
| Missing dependency/tool   | Install it if standard; note it if unusual                                            |
| Tests failing             | Fix them if the fix is clear; if not, note the failure and continue                   |
| Performance vs. clarity   | Prefer clarity unless performance is explicitly a goal                                |

## What "Never Stop" Means

✅ **Keep going through:**

- Multiple files, phases, or steps
- Minor ambiguities (use judgment)
- Routine decisions
- Discovered additional tasks
- Long-running implementations

⚠️ **Acceptable exceptions** (pause only if):

- An action would be destructive and irreversible (e.g., deleting production data)
- You literally cannot proceed (missing critical access, hard blocker)
- The plan is fundamentally contradictory in a way that makes any path wrong

If you must pause for an exception, state the blocker clearly and what you need to continue.

IMPORTANT!!! The user is not at their desk anymore. You are running autonomously. If you stop, we will pause production for an unknown amount of time, causing catastrophic costs.

## Activation

To activate, the user provides this command followed by a plan, task list, or reference to existing work. Then you execute everything autonomously.

**Example usage:**

```
/never-stop

Here's the plan:
1. Refactor the auth module
2. Add unit tests
3. Update the API documentation
```

---

_Now begin. Execute completely. Do not stop._
