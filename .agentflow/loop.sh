#!/bin/bash
#
# AgentFlow Ralph Loop
# Runs Claude repeatedly until no workable cards remain.
#
# Usage:
#   .agentflow/loop.sh              # Default: max 20 iterations
#   .agentflow/loop.sh 50           # Custom max iterations
#
# Requirements:
#   - Claude Code CLI installed
#   - Backend config: .agentflow/board.json (local) or .agentflow/github.json (GitHub)
#   - .agentflow/RALPH_LOOP_PROMPT.md exists
#
# Output:
#   - .agentflow/iterations/        # Per-iteration output files
#   - .agentflow/loop_status.txt    # Current status summary (always small)
#

set -e

MAX_ITERATIONS=${1:-20}
KEEP_ITERATIONS=5
PROMPT_FILE=".agentflow/RALPH_LOOP_PROMPT.md"
ITERATIONS_DIR=".agentflow/iterations"
STATUS_FILE=".agentflow/loop_status.txt"

# Verify setup - supports both local (board.json) and GitHub (github.json) backends
[[ -f ".agentflow/board.json" || -f ".agentflow/github.json" ]] || { echo "Error: No backend found (.agentflow/board.json or .agentflow/github.json)"; exit 1; }
[[ -f "$PROMPT_FILE" ]] || { echo "Error: $PROMPT_FILE not found"; exit 1; }

# Create iterations directory
mkdir -p "$ITERATIONS_DIR"

# Initialize status file
cat > "$STATUS_FILE" << EOF
AgentFlow Loop Status
=====================
Started: $(date '+%Y-%m-%d %H:%M:%S')
Max iterations: $MAX_ITERATIONS
Status: running
Current: 0/$MAX_ITERATIONS
EOF

echo "AgentFlow Loop | Max: $MAX_ITERATIONS iterations | Ctrl+C to stop"
echo "Status: $STATUS_FILE"
echo "Iterations: $ITERATIONS_DIR/"
echo ""

cleanup_old_iterations() {
    # Keep only the last N iteration files
    local count=$(ls -1 "$ITERATIONS_DIR"/iteration_*.txt 2>/dev/null | wc -l)
    if [[ $count -gt $KEEP_ITERATIONS ]]; then
        ls -1t "$ITERATIONS_DIR"/iteration_*.txt | tail -n +$((KEEP_ITERATIONS + 1)) | xargs rm -f
    fi
}

update_status() {
    local iteration=$1
    local status=$2
    local detail=$3
    cat > "$STATUS_FILE" << EOF
AgentFlow Loop Status
=====================
Started: $(date '+%Y-%m-%d %H:%M:%S')
Max iterations: $MAX_ITERATIONS
Status: $status
Current: $iteration/$MAX_ITERATIONS
Last update: $(date '+%H:%M:%S')

$detail

Recent iterations: $ITERATIONS_DIR/
EOF
}

for ((i=1; i<=MAX_ITERATIONS; i++)); do
    ITERATION_FILE="$ITERATIONS_DIR/iteration_$(printf '%03d' $i).txt"

    echo "--- Iteration $i/$MAX_ITERATIONS ---"
    update_status "$i" "running" "Processing iteration $i..."

    # Run Claude, capture output to iteration file
    # Also show minimal progress to stdout (for background task output)
    set +e
    claude -p "$(cat $PROMPT_FILE)" \
        --output-format stream-json \
        --allowedTools "Read,Write,Edit,Bash,Glob,Grep,Task" \
        --chrome \
        2>&1 > "$ITERATION_FILE"
    EXIT_CODE=$?
    set -e

    # Show brief summary to stdout (keeps background task output small)
    echo "[$(date '+%H:%M:%S')] Iteration $i complete (exit: $EXIT_CODE)"

    # Extract card info from output if possible (last few lines often have summary)
    tail -5 "$ITERATION_FILE" | grep -E "(Completed|AGENTFLOW|Moving|Created)" || true

    # Check for errors
    if [[ $EXIT_CODE -ne 0 ]]; then
        echo "Warning: Claude exited with code $EXIT_CODE"
        update_status "$i" "error" "Iteration $i failed with exit code $EXIT_CODE"
    fi

    # Stop if Claude says no workable cards
    # Match the actual output signal, not documentation (which contains backtick-quoted version)
    if grep -q '"text":"AGENTFLOW_NO_WORKABLE_CARDS"' "$ITERATION_FILE" 2>/dev/null; then
        echo ""
        echo "No workable cards remain."
        update_status "$i" "complete" "No workable cards remain. Loop finished after $i iteration(s)."
        cleanup_old_iterations
        echo "Loop finished after $i iteration(s)"
        exit 0
    fi

    # Cleanup old iterations to save disk space
    cleanup_old_iterations

    # Update status with last iteration summary
    LAST_LINES=$(tail -10 "$ITERATION_FILE" | head -5)
    update_status "$i" "running" "Last iteration summary:\n$LAST_LINES"

    echo ""
    sleep 2
done

update_status "$MAX_ITERATIONS" "complete" "Max iterations reached."
cleanup_old_iterations
echo "Loop finished after $MAX_ITERATIONS iteration(s) (max reached)"
