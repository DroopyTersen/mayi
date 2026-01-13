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
START_TIME=$(date '+%Y-%m-%d %H:%M:%S')

# Verify setup - supports both local (board.json) and GitHub (github.json) backends
[[ -f ".agentflow/board.json" || -f ".agentflow/github.json" ]] || { echo "Error: No backend found (.agentflow/board.json or .agentflow/github.json)"; exit 1; }
[[ -f "$PROMPT_FILE" ]] || { echo "Error: $PROMPT_FILE not found"; exit 1; }

# Create iterations directory
mkdir -p "$ITERATIONS_DIR"

# Initialize status file
cat > "$STATUS_FILE" << EOF
AgentFlow Loop Status
=====================
Started: $START_TIME
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
Started: $START_TIME
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

    # Run Claude in background, show progress dots every 10 seconds
    set +e
    claude -p "$(cat $PROMPT_FILE)" \
        --output-format stream-json \
        --allowedTools "Read,Write,Edit,Bash,Glob,Grep,Task" \
        --chrome \
        > "$ITERATION_FILE" 2>&1 &
    CLAUDE_PID=$!

    # Show dots while waiting (flush immediately)
    while kill -0 $CLAUDE_PID 2>/dev/null; do
        sleep 10
        echo -n "." >&2
    done
    wait $CLAUDE_PID
    EXIT_CODE=$?
    set -e

    echo "" >&2  # newline after dots
    echo "[$(date '+%H:%M:%S')] Iteration $i complete (exit: $EXIT_CODE)"

    # Show what was added to progress.txt (last entry)
    if [[ -f ".agentflow/progress.txt" ]]; then
        echo "--- Progress ---"
        # Show from last "---" separator to end (tail -r is macOS version of tac)
        tail -r .agentflow/progress.txt 2>/dev/null | sed '/^---$/q' | tail -r 2>/dev/null || \
        tac .agentflow/progress.txt 2>/dev/null | sed '/^---$/q' | tac 2>/dev/null || \
        tail -20 .agentflow/progress.txt
        echo "----------------"
    fi

    # Check for errors
    if [[ $EXIT_CODE -ne 0 ]]; then
        echo "Warning: Claude exited with code $EXIT_CODE"
        update_status "$i" "error" "Iteration $i failed with exit code $EXIT_CODE"
    fi

    # Check for completion signals
    # Only match in result/assistant output, not in loaded documentation
    # The "result" field contains the final agent output
    if grep -q '"result":"[^"]*AGENTFLOW_NO_WORKABLE_CARDS' "$ITERATION_FILE" 2>/dev/null; then
        echo ""
        echo "No workable cards remain."
        update_status "$i" "complete" "No workable cards remain. Loop finished after $i iteration(s)."
        cleanup_old_iterations
        echo "Loop finished after $i iteration(s)"
        exit 0
    fi

    # Check if iteration completed normally (one card processed)
    # Only match in result field, not in loaded documentation
    if grep -q '"result":"[^"]*AGENTFLOW_ITERATION_COMPLETE' "$ITERATION_FILE" 2>/dev/null; then
        echo "Card processed successfully."
    else
        # Neither signal found - agent may have been cut off
        echo "Warning: No completion signal found. Agent may have been interrupted."
        update_status "$i" "warning" "Iteration $i: No completion signal. Continuing anyway..."
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
