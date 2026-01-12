# Workflow Commands - GitHub Backend

Commands for working on cards: `/af work`, `/af next`, `/af feedback`, `/af depends`, `/af review`, `/af loop`.

---

## /af work <id>

Work on a specific card.

### Process

1. **Get issue:** `gh issue view NUMBER --json number,title,body,labels,state,comments`
2. **Get status:** Check project item for current column
3. **Check blockers:**
   - Has `needs-feedback` label? → Stop, explain what's needed
   - Has `blocked` label? → Stop, show blocker details
4. **Read context:**
   - `.agentflow/PROJECT_LOOP_PROMPT.md`
   - `.agentflow/columns/{column}.md`
5. **Execute phase** (see column docs for full details)

### Phase Summary

| Column | Action |
|--------|--------|
| approved | Move to refinement, start exploration |
| refinement | Run code-explorer, document requirements or ask questions |
| tech-design | Run code-architect, propose approaches or finalize design |
| implementation | Write tests, implement, run code-reviewer, commit |

---

## /af next

Work on highest priority workable card.

### Process

1. Run `/af list --workable`
2. If no cards: "No workable cards. All waiting on human input."
3. Select first card (already sorted by priority, then age)
4. Announce: "Working on: #NUMBER {title} ({column})"
5. Execute `/af work NUMBER`

### Dependency Handling

If ALL cards are dependency-blocked, assess whether to start one:
- Predecessor in `final-review` → May proceed if confident it lands soon
- Predecessor in earlier column → Warn and suggest waiting

If proceeding with incomplete predecessors, document the decision in a comment.

---

## /af feedback <id>

Respond to a card waiting for human input.

### Process

1. Check issue has `needs-feedback` label
2. Get issue with comments: `gh issue view NUMBER --json body,comments`
3. Display pending questions from recent comments
4. Prompt human for responses
5. Add comment with response:
   ```bash
   gh issue comment NUMBER --body "**Human (YYYY-MM-DD):** {response}"
   ```
6. Remove label:
   ```bash
   gh issue edit NUMBER --remove-label "needs-feedback"
   ```

### Quick Form

```
/af feedback 123 "Use Redis for sessions"
```

Adds answer as comment, removes tag in one step.

### Confirm

"✅ Feedback recorded. Issue #123 is now workable."

---

## /af depends <id> [on|remove] <predecessor>

Manage card dependencies.

### Show Dependencies (no action)

```
/af depends 123
```

1. Parse `## Dependencies` section from issue body
2. For each predecessor, check its status column
3. Display:
   ```
   Dependencies for #123:
     #100 Add user auth — ✅ done
     #101 Add OAuth — 🔄 implementation

   Status: Partially blocked (1 predecessor not done)
   ```

### Add Dependency

```
/af depends 123 on 100
```

1. Get issue body
2. Find or create `## Dependencies` section
3. Add/update: `Blocked by: #100, #101`
4. Update issue body

### Remove Dependency

```
/af depends 123 remove 100
```

1. Get issue body
2. Remove predecessor from `Blocked by:` line
3. Update issue body

### Confirm

"✅ #123 now depends on #100"
"✅ Dependency on #100 removed from #123"

---

## /af review <id>

Run code review on implementation.

### Process

1. Verify issue is in implementation or final-review
2. Get issue body for tech design and implementation details
3. Invoke `Agent("code-reviewer")` with context
4. Output review markdown

Can be used standalone outside the normal workflow.

---

## /af loop

External bash script, not a Claude command.

### Usage

```bash
.agentflow/loop.sh              # Default: 20 iterations
.agentflow/loop.sh 50           # Custom max
```

### How It Works

1. Script pipes `.agentflow/RALPH_LOOP_PROMPT.md` to Claude
2. Claude runs `/af list --workable`, selects card, executes phase
3. Claude updates card, exits
4. Script checks for `AGENTFLOW_NO_WORKABLE_CARDS` or continues

### Exit Conditions

- No workable cards remain
- Max iterations reached
- User interrupts (Ctrl+C)
