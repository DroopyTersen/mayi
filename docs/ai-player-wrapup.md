# AI player experiments: wrap-up

Completed: one final full-suite experiment, independent audit, and cleanup.
**Do not promote the replacement prompt.** Its strategic score improved, but
robustness regressed and turns took longer. The previous player configuration
and exact 57.3% checkpoint remain intact. Experiments stop here as requested.

## What we are keeping

- Muse Spark 1.3 Contributor works through OpenRouter and the AI SDK, including
  tools and recorded usage. Credentials remain local and are not in artifacts.
- Contract-aware hand organization is player guidance: rank for set-heavy Hands
  1/4, suit for Hands 2/3/5/6. It is not a house rule.
- Rule-derived contract, Joker-swap, layoff, and future-layoff assistance stays.
  These improved specific legal-action capabilities; they do not establish a
  general strategic win-rate gain.
- Full current-hand public action history and a scrollable activity view;
  hidden stock/opponent cards remain private. Tournament history now captures
  accepted actions individually, including overlapping tool actions.
- A faster, versioned short-rollout benchmark: 21 eligible development cases,
  four repetitions each, with strategy separated from robustness, raw action
  evidence, request health, organization, timing, and recorded cost.
- A ten-second human reaction window before ordinary AI execution, separately
  from model latency. May I resolution responses retain their shorter delay.

## Final experiment

Replace the whole strategic guidance layer with a conditional whole-plan
decision policy, rather than appending advice to conflicting absolute
priorities. Compare consequences through opponents' actions to the next turn,
remaining contract routes, future layoffs, penalty exposure, and public
information. Preserve exact organization and all rule/tool/identity sections.

Both fresh arms use Spark-low Contributor and neutral contract hints, on the
same 21 cases x4. Only guidance changes; no memory, scratchpad, reasoning
replay, cost cap, or pacing delay. This is one comparison, not a replicated
improvement claim.

| Metric | Fresh control | Replacement |
| --- | ---: | ---: |
| Strategy | 45.8% | 53.1% |
| Robustness, raw gated score | 88.9% | 80.6% |
| Completed episodes | 84/84 | 83/84 |
| Candidate engine legality | 84/84 | 84/84 |
| Organization opportunities | 124/124 | 121/121 |
| Successful tool requests | 447/447 | 438/438 |
| Ordinary-turn provider p50 / p95 | 9.744s / 25.873s | 13.389s / 35.401s |
| Recorded cost for 84 episodes | $0.100800 | $0.115771 |

The pair cost **$0.216571**, with treatment cost 14.9% higher. Recorded costs are
not an account invoice; per-decision token completeness is unknown. Timing is
raw provider time under concurrent load, excluding the human reaction window;
it is descriptive, not a causal latency estimate. Control finished in 8m47s,
replacement in 12m32s, with simultaneous dispatch.

Strategy gained 7.3 percentage points. Contested-run planning improved from
37.5% to 53.1%, contract-horizon planning from 33.3% to 41.7%; Hand 6 coverage
stayed 100% and shared-run timing stayed 33.3%. One concrete improved horizon
trial chose the sevens contract, kept cards that could all be laid off next
turn, and went out under the fixed continuation. This occurred once in four
natural-branch trials; it is not reliable mastery of the family.

The replacement also failed one of four winning priority-claim trials and one
of four Joker-swap trials; control passed all four of each. Those are genuine
observed regressions, separate from the fixture defect below. Overall there
were 7 paired gains, 6 losses, and 71 ties. The frozen numerical screen fails
robustness and completion. No prompt promotion, replication, holdout rescue,
or sample replacement follows.

Artifacts: `.data/ai-evals/final-guidance-replacement-20260904/`.

Audit caveat: replacement `preserve-future-layoff-cards`, repetition 3, legally
takes the discard, lays down, and keeps its two future-layoff cards. This shifts
the stock; the fixed opponent script then tries to discard a card it did not
draw. The original incomplete/zero-scored record stays in the raw result, but
it is a fixture defect, not proof of a player mistake. It prevents a clean
full-suite promotion claim. No case was excluded, repaired, or rerun.

## What the previous experiments actually established

These are separate matched comparisons, not a single improvement curve. The
benchmark and harness changed over the project, so rows must not be ranked
against one another.

| Experiment | Strategy control -> treatment | Decision |
| --- | ---: | --- |
| Higher reasoning effort | 44.8% -> 45.8% | Reject: completion fell from 84/84 to 80/84. |
| Conditional-plan addendum | 43.8% -> 51.0% | Not promoted: incomplete execution; one separate accounting defect was also identified. |
| Per-hand scratchpad | 51.0% -> 46.9% | Reject: lower strategy, robustness, and completion. |
| Contract alternatives | 52.1% -> 61.5%; repeat 54.2% -> 55.2% | Large gain did not replicate; regressions remained. |
| Public-opportunity advice | 45.8% -> 46.9% | Insufficient gain, robustness regression. |
| Within-turn reasoning replay | 50.0% -> 46.9% | Transport works; no demonstrated gameplay benefit. |
| Per-hand conversation | 53.1% -> 52.1% | No demonstrated benefit. |
| Neutral contract hints | 45.8% -> 57.3%; repeat 51.0% -> 51.0% | Exact candidate preserved; gain not reproduced. |
| Final whole-guidance replacement | 45.8% -> 53.1% | Not promoted: two genuine robustness regressions, one fixture defect, and slower turns. |

The requested **57.3% checkpoint is safe**. Its exact 143 source/dependency files,
prompt/model settings, and original evidence hashes are saved in
`.data/ai-evals/neutral-contract-hint-replication-v1-20260904/preserved-candidate.json`.
SHA256: `825decd509f8ca08ef88b321d1d7d28ebd9a227c00fdba33332bdc392f6df8b6`.
Preservation does not promise that its measured score will repeat.

Luna remains a frozen reference. Its older corrected fixed-state score was
80% (16/20), not a result on this harder strategy suite. We cannot honestly use
that number to rank current Spark versus Luna on nuanced gameplay.

## Limits and retained configuration

The strategy score covers 12 cases in only four correlated families, not 48
independent skills and not full-game win rate. Nine other cases are robustness
diagnostics. Disputed initial-meld rules and unsupported-history fixtures stay
quarantined rather than silently changing the authoritative house rules.
Broader real-game evidence and independent strategic families remain unfinished.

No experimental prompt, neutral hint, memory, or replay setting has been
automatically promoted to app defaults. Spark-low is the experiment reference;
the app still defaults to Luna, and explicit Spark selection retains its existing
minimal-effort profile. This wrap-up does not change that distinction.

## Cleanup and verification

The unfinished incremental tournament decision-journal prototype and its test
were moved out of source into recoverable `.txt` files under the final
experiment's `unfinished-journal/` directory. It was never integrated. Existing
audited capabilities and historical evidence remain; unrelated dirty work was
not removed. Experimental options remain opt-in and are not runtime defaults.

Verification: 73 focused product/harness tests (574 assertions), six artifact/
preservation tests (335 assertions), full typecheck, and whitespace checks
passed. Both original run processes exited successfully; no provider run is
left active. All 149 frozen source files stayed unchanged during the experiment.

Root replay verifies all 168 records, 286 inputs, 885 exact tool outputs and
schemas, 1,611 engine attempts, and 84 paired initial views, with zero replay
mismatches. Clean-context independent judges cover all 168 exact-line hashes,
all 245 organization opportunities, and all 885 successful requests. They
identify the one fixture defect above. Their evidence is normalized tool and
engine evidence, not hidden reasoning or raw provider transport. No recorded
same-step tool groups occurred, so this run does not exercise the adjacent
short-rollout concurrent-snapshot risk.

No staging, commit, merge, deployment, account, or credential changes are part
of this wrap-up. The overall result is a working inexpensive model integration,
useful player/tool improvements, and a more honest unsaturated benchmark—not a
demonstrated broadly superior strategic player or a new Luna head-to-head win.

The detailed chronology is in [the evaluation log](ai-player-eval-log.md).
