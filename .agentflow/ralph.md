# AgentFlow Loop Architecture

This document explains how the Ralph Wiggum-style autonomous loop works.

## The Pattern

```
┌─────────────────────────────────────────────────────────────────┐
│                     External Bash Loop                          │
│                  (.agentflow/loop.sh)                           │
│                                                                 │
│  while workable_cards_exist && iteration < max:                 │
│    1. Read board.json, display next card info                   │
│    2. Pipe RALPH_LOOP_PROMPT.md to Claude Code                │
│    3. Claude processes ONE card phase                           │
│    4. Claude moves card, exits                                  │
│    5. Check for completion promise                              │
│    6. Sleep briefly, continue                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Claude Code Session                         │
│                    (one per iteration)                          │
│                                                                 │
│  1. Reads RALPH_LOOP_PROMPT.md instructions                   │
│  2. Reads board.json, selects highest priority card             │
│  3. Reads card context file                                     │
│  4. Reads column-specific instructions (columns/*.md)           │
│  5. Executes phase (calls sub-agents as needed)                 │
│  6. Updates card context with output                            │
│  7. Updates progress.txt                                        │
│  8. Moves card to next column                                   │
│  9. Exits cleanly                                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Why External Loop?

The original "Ralph Wiggum" pattern (by Geoffrey Huntley) uses a simple bash loop:
```bash
while :; do cat PROMPT.md | claude-code; done
```

This approach has several advantages:

1. **Fresh Context**: Each iteration starts with a clean context window
2. **State via Files**: Progress is tracked in files, not session memory
3. **Easy Control**: Ctrl+C stops cleanly between iterations
4. **Visibility**: Terminal shows progress clearly
5. **Resilience**: Errors in one iteration don't break the loop

## Files Involved

| File | Purpose |
|------|---------|
| `.agentflow/loop.sh` | External bash loop script |
| `.agentflow/RALPH_LOOP_PROMPT.md` | Instructions piped to Claude each iteration |
| `.agentflow/board.json` | Board state (cards, columns) |
| `.agentflow/cards/*.md` | Card context files (accumulate over time) |
| `.agentflow/columns/*.md` | Column-specific execution instructions |
| `.agentflow/PROJECT_LOOP_PROMPT.md` | Project-specific instructions |
| `.agentflow/progress.txt` | Session memory (append-only log) |

## Card Selection Algorithm

Each iteration, Claude selects ONE card:

```javascript
// Pseudocode
const workableColumns = ['approved', 'refinement', 'tech-design', 'implementation'];
const priorityRank = { critical: 0, high: 1, medium: 2, low: 3 };

const candidates = board.cards
  .filter(c => workableColumns.includes(c.column))
  .filter(c => !(c.tags || []).includes('blocked'))
  .filter(c => !(c.tags || []).includes('needs-feedback'))
  .sort((a, b) => {
    // First by priority
    const priorityDiff = priorityRank[a.priority] - priorityRank[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    // Then by age (oldest first)
    return new Date(a.createdAt) - new Date(b.createdAt);
  });

return candidates[0] || null;
```

## Completion Signals

The loop stops when:

1. **No workable cards**: Claude outputs `AGENTFLOW_NO_WORKABLE_CARDS`
2. **Max iterations**: Safety limit reached (default: 20)
3. **User interrupt**: Ctrl+C pressed
4. **Custom promise**: Optional completion string found

## Human Checkpoints

Cards pause when requiring human input, controlled by tags and columns:

| Condition | Human Action Needed |
|-----------|---------------------|
| `needs-feedback` tag | Answer questions in Conversation Log, remove tag |
| `blocked` tag | Resolve external blocker, remove tag |
| `new` column | Review and approve new cards, move to `approved` |
| `final-review` column | Review implementation, approve or request changes |

The loop skips cards with `needs-feedback` or `blocked` tags, and cards in `new`, `final-review`, or `done` columns. When ALL cards need human input, the loop exits.

## Running the Loop

```bash
# Start the loop
.agentflow/loop.sh

# With custom settings
.agentflow/loop.sh 50           # Max 50 iterations
.agentflow/loop.sh 50 "DONE"    # Custom completion promise

# Monitor in another terminal
watch -n 1 'jq ".cards | group_by(.column) | map({column: .[0].column, count: length})" .agentflow/board.json'
```

## Safety Considerations

1. **Iteration limit**: Always set a reasonable max (default: 20)
2. **Ctrl+C friendly**: Script exits cleanly on interrupt
3. **State in files**: Can always inspect/modify board.json manually
4. **Drift prevention**: Claude adds `needs-feedback` tag if tech design needs revision
5. **Human gates**: Cannot skip `new` or `final-review` columns or cards with `needs-feedback` tag
