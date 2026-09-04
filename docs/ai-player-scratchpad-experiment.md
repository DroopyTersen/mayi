# Per-hand strategy scratchpad experiment

Status: opt-in capability implemented locally on 2026-09-03. First paired
whole-suite experiment did not improve measured play: strategy 51.04% → 46.88%,
robustness 88.89% → 83.33%, completion 84/84 → 83/84. Not enabled in the app or
combined with conditional-plan guidance. All 168 records were independently
replayed with matching states, grades and memory lifecycle.

## Hypothesis

A player can lose a coherent plan between separate model invocations even
when the next turn includes the same hand and public activity history. Carry
a short statement of intent forward, while allowing new evidence to change
it. Measure the configured player, not just the model in isolation.

## Player-visible contract

- Private to one game, player and hand; start empty and clear on hand change.
- At most two short lines, capped at 400 characters total.
- Record the current contract/exit plan and the evidence or condition that
  would change it. This is a concise decision summary, not a reasoning log.
- Read it with the current hand and public history on subsequent decisions,
  including May I opportunities. Current facts and authoritative house rules
  take precedence; the note is a revisable hypothesis, never an instruction
  that must be obeyed despite contradictory evidence.
- Supply `strategy_note` alongside the existing ordinary-turn `discard` call;
  this avoids an extra provider round trip. Commit it only after a completed
  invocation. The note itself is not a separate game action and does not alter
  the discard's engine semantics. Terminal wins do not need a next-turn note.
- Keep accepted notes outside the public game snapshot and activity feed.
  Never expose one player's notes to another. Eval traces may retain them for
  auditing, explicitly labeled private player memory.
- Do not commit an unfinished or aborted invocation's proposed note. Expire
  notes if the hand ends before the write is committed.

## Experiment boundary

Build and test an opt-in agent capability first. Leave the baseline, Luna,
house rules, hand organization, public-history retention, reasoning effort
and human-visible pacing unchanged. Do not combine the rejected/unfinished
conditional-plan addendum with this feature by default.

Use the full eligible development suite with four repetitions per scenario
and fresh paired controls. Record memory reads/writes alongside actual model
calls so judges can distinguish continuity from a coincidental good draw.
Report completion, legality, strategic families, regressions, cost and turn
latency separately. No Spark cost cap. No fixture answers or future cards in
the initial note; every trial starts with an empty, isolated scratchpad.

Required local tests include cross-turn retention, player/game isolation,
hand reset, size/line validation, stale/aborted-write protection, public-state
non-disclosure, and unchanged behavior when the capability is disabled.

The prior paired run and its independent audit are finished; its May I
continuation correction is separately tested as suite v9. Scratchpad capability
and traces advance the harness to v4; suite v9, public observations and runtime
v4 remain unchanged. Do not silently rescore or splice existing artifacts. Only consider app
enablement after independent whole-suite review; production storage and
restart persistence need their own verification before deployment.

Run the experiment with `--scratchpad per-hand --prompt-experiment hand-scratchpad-v1
--prompt-addendum-file ai/evals/prompts/hand-scratchpad-v1.md --prompt-scope
all-candidate-decisions`. Baseline omits memory and addendum. Case artifacts
retain each private read, proposal, commit/discard and next-read context.

Artifacts: `.data/ai-evals/hand-scratchpad-v1-h4-comparison-20260903/`.
All 84 initial public observations match across arms and all 112 frozen source
hashes remain unchanged. The notes are mechanically carried forward, but this
first run does not establish a strategic benefit or prove a causal harm from
recall. Keep this capability experimental; do not silently turn it on for app
players. Most current cases are short and make their key choice before the
first note, so a future long-horizon continuity test needs its own suite revision.
