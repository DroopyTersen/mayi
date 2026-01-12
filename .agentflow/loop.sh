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
#   - .agentflow/board.json exists
#   - .agentflow/RALPH_LOOP_PROMPT.md exists
#

set -e

MAX_ITERATIONS=${1:-20}
ITERATION=0
PROMPT_FILE=".agentflow/RALPH_LOOP_PROMPT.md"
OUTPUT_FILE=".agentflow/.last_output.txt"

# Verify setup
[[ -f ".agentflow/board.json" ]] || { echo "Error: .agentflow/board.json not found"; exit 1; }
[[ -f "$PROMPT_FILE" ]] || { echo "Error: $PROMPT_FILE not found"; exit 1; }

echo "AgentFlow Loop | Max: $MAX_ITERATIONS iterations | Ctrl+C to stop"
echo ""

for ((i=1; i<=MAX_ITERATIONS; i++)); do
    echo "--- Iteration $i/$MAX_ITERATIONS ---"

    # Run Claude in print mode
    # -p: non-interactive, single response
    # --verbose: show turn-by-turn output in real-time
    # --allowedTools: auto-approve these tools without prompting
    # tee: display output AND save to file for checking completion signal
    set +e
    claude -p "$(cat $PROMPT_FILE)" \
        --output-format stream-json \
        --allowedTools "Read,Write,Edit,Bash,Glob,Grep,Task" \
        2>&1 | tee "$OUTPUT_FILE"
    EXIT_CODE=$?
    set -e

    # Check for errors
    if [[ $EXIT_CODE -ne 0 ]]; then
        echo ""
        echo "Warning: Claude exited with code $EXIT_CODE"
    fi

    # Stop if Claude says no workable cards
    if grep -q "AGENTFLOW_NO_WORKABLE_CARDS" "$OUTPUT_FILE" 2>/dev/null; then
        echo ""
        echo "No workable cards remain."
        rm -f "$OUTPUT_FILE"
        echo "Loop finished after $i iteration(s)"
        exit 0
    fi

    echo ""
    sleep 2
done

rm -f "$OUTPUT_FILE"
echo "Loop finished after $MAX_ITERATIONS iteration(s) (max reached)"
