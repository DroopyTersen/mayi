# AI Player Evaluation Log

This is the human-readable, append-only decision log for AI-player experiments.
Raw case evidence remains in ignored local directories under `.data/ai-evals/`.

## 2026-09-02 — Measurement foundation

- Suite: `fixed-state-v1`, 20 real-engine tactical positions (14 development,
  6 holdout), each with a tested full-credit reference trajectory.
- Skill gates: incomplete turns and any rejected engine action score zero.
- Reported independently: tactical quality with 95% interval, completion,
  legality, provider and turn latency, presentation pacing, tokens, retries,
  and direct or reconstructed cost.
- Experiment integrity: unique run directories, exact prompt capture and hash,
  scenario-level results, and named-case reruns.
- Repetitions are paired across candidates: the first uses the canonical hand
  order and later repetitions use deterministic, shared hand permutations.
  Multi-candidate reports include matched quality, latency, cost, and win-tie-loss
  deltas against the first candidate.
- Budget policy: Luna is a frozen reference only. Spark is the only model used
  for effort sweeps and prompt or product hill-climbing.

## 2026-09-02 — Frozen Luna reference

- Initial run: `.data/ai-evals/luna-frozen-baseline-v1`.
- Affected fixture repair: the original Ace-high case accidentally allowed a
  valid four-card run without using the Ace. That case result was invalidated,
  the fixture was corrected test-first, and only that case was rerun at
  `.data/ai-evals/luna-baseline-ace-fix-v1`.
- Corrected reference: 80% tactical quality (16/20), 100% completion, 95%
  legality, about $0.01765 total reconstructed cost. The original run's raw
  provider latency was 5.9 s p50 and 15.7 s p95; the repaired case took 8.3 s.
- Remaining misses worth measuring in Spark: balanced-wild contract recognition,
  invalid same-suit split avoidance, urgent Joker dumping, and laying off all
  cards to go out. Do not tune directly to holdout wording.

## 2026-09-02 — Product pacing invariant

- Change class: product behavior, not model skill, harness, rubric, or eval data.
- AI turns now provide a 10-second player reaction window before provider
  execution instead of a 500 ms cosmetic delay. This gives humans time to
  inspect the exposed discard and call May I.
- Automated responses inside an active May I resolution retain a separate
  500 ms delay, avoiding a 10-second pause for every player in the claim line.
- The pacing delay is recorded explicitly with production turn metrics and is
  excluded from provider latency and tactical quality. Reasoning effort remains
  free to optimize skill and cost rather than being used as a timing crutch.

## 2026-09-03 — Tournament prerequisites

- Change class: harness and engine reproducibility, not AI strategy.
- Fixed the previously ignored `GameEngine.createGame({ seed })` option. Seeded
  dealing and stock recycling are deterministic, while normal games retain
  random shuffling.
- Added an in-memory AI runtime over the production engine with accepted and
  rejected action evidence.
- Added duplicate-tournament seat rotation and independent aggregation of
  placement, six-hand score, score margin, round wins, completion, legality,
  provider latency, and cost.

## 2026-09-03 — Duplicate tournament runner

- Change class: evaluation harness, not AI strategy.
- Added an executable tournament that reuses one seeded deal while rotating
  three candidate configurations through all seats.
- The safe default is a one-hand, Spark-only effort comparison. Luna is only
  available through an explicit three-candidate command.
- Runs preserve the exact prompt hash, candidate identities, seeds, rotations,
  decision cap, game-level evidence, and separate skill, reliability, provider
  latency, and cost summaries.
- Known gap: automated players can respond to a May I resolution but cannot yet
  initiate an out-of-turn May I call. The runner records that limitation and
  does not represent its standings as complete May I judgment.

## 2026-09-03 — Policy-aware harness v2 repair

- Change class: evaluation-harness repair and engine invariant, not AI strategy.
- The fixed-state runtime previously compared complete projected snapshots,
  including a freshly generated `updatedAt`, when deciding whether an action
  was accepted. A timestamp-only change could therefore be mistaken for engine
  progress. The runtime now ignores presentation timestamps and applies the
  same command policy as the live room before invoking the engine.
- The full-game tournament runtime now applies that command policy as well.
- The underlying round machine also now rejects a current player calling May I
  on their own turn; they must claim the discard through the normal draw action.
- New manifests identify `ai-player-eval-harness-v2`, preventing new Spark
  evidence from being silently mixed with pre-repair runs.
- Audited the frozen Luna evidence by replaying all 20 retained tool transcripts
  through the repaired runtime. Result: 0 legality mismatches and 0 grading
  mismatches, so the corrected 80% Luna reference remains valid.

## 2026-09-03 — May I initiation measurement

- Change class: evaluation setup and callable AI capability, not a Spark prompt
  improvement.
- Added `may-i-call-v1`: six call-versus-pass positions with four development
  cases and two holdouts. Every reference decision is legal and full credit;
  opposite decisions fail the positive and negative controls.
- Added a dedicated model decision path exposing only `call_may_i` and
  `pass_may_i`. It preserves hidden hands, records raw provider timing and cost,
  and sends accepted calls through the real command policy and round machine.
- Added a Spark-first runner with the same effort ladder, paired deterministic
  hand permutations, exact prompt capture, and opt-in-only Luna behavior.

## 2026-09-03 — Matched Spark promotion gate

- Change class: evaluation harness and experiment discipline, not AI strategy.
- Added a cross-run comparator for immutable Spark experiments. It requires the
  same suite version, harness version, scenario/repetition keys, rendered input
  states, and rubric before calculating a delta.
- Promotion is skill-first: tactical quality must rise, completion and legality
  cannot regress, and a lower-scoring individual case changes the verdict from
  automatic promotion to review.
- Matched provider-latency and cost-per-case deltas remain separate diagnostics;
  neither can rescue a weaker player.
- No model calls or prompt changes were made. The unchanged-prompt Spark
  development baseline is still required before selecting a candidate idea.

## 2026-09-03 — Executable Luna baseline certification

- Change class: data/artifact certification, not model strategy, rubric, or
  scenario changes.
- Added a certifier that replays retained model tool calls through the current
  command policy and XState engine, verifying the exact input state, legality,
  current grader output, and final outcome for every case.
- Certified all 20 cases successfully. The only replacement is the documented
  `ace-high-run-contract:1` result from `luna-baseline-ace-fix-v1`; the other 19
  come from `luna-frozen-baseline-v1`.
- Comparable artifact: `.data/ai-evals/luna-frozen-baseline-certified-v2`, with
  harness `ai-player-eval-harness-v2` and suite `fixed-state-v1` recorded in the
  manifest.
- The certified aggregate remains 80.0% tactical quality, 100% completion, 95%
  legality, 5.9 s provider p50, 15.7 s p95, and $0.017653 reconstructed cost.
  No Luna call was made.

## 2026-09-03 — Tournament May I initiation

- Change class: evaluation harness, not model strategy or production pacing.
- Advanced the duplicate tournament to `duplicate-tournament-v2`. Before each
  draw, every eligible off-turn player receives a call-or-pass opportunity in
  deterministic turn-priority order; a call is resolved by the real engine and
  the existing AI response path.
- Recorded per-competitor May I opportunities, calls, passes, and incomplete
  decisions. Their provider latency and cost are included in the same totals as
  ordinary turns and resolution responses.
- Incomplete call decisions are counted and treated as passes so one provider
  failure cannot deadlock a game. The manifest records that callers are sampled
  once before the draw, matching the product reaction window, rather than again
  after every action in the turn.
- The evaluation still has zero presentation pacing. The live product's
  separate 10-second reaction window remains unchanged.

## 2026-09-03 — Paired uncertainty gate

- Change class: evaluator and promotion policy, not model strategy, rubric, or
  scenario content.
- Added a paired 95% confidence interval over per-case tactical-score deltas,
  using a small-sample Student-t bound and the score's -100 to +100
  percentage-point limits.
- A prompt can now be promoted only after at least three matched repetitions of
  every scenario and only when the entire paired quality interval is above
  zero. A one-shot improvement or noisy gain is classified as `review`.
- Completion and legality regressions still reject immediately. A positive
  aggregate with any lower-scoring matched case still requires review.
- This raises the cost of the final promotion run but keeps one-repetition
  targeted smoke tests available, which is appropriate for inexpensive Spark
  hill climbing.

## 2026-09-03 — Frozen Luna May I initiation baseline

- Change class: one-time baseline evidence, not hill climbing or a prompt
  change.
- Ran Luna xhigh once across all six `may-i-call-v1` positions and froze the
  artifact at `.data/ai-evals/luna-may-i-call-frozen-baseline-v1`.
- Result: 100% tactical quality (6/6), 100% completion, and 100% legality. Luna
  called on all three contract-completing controls and passed the unrelated,
  one-card-opponent, and Hand 6 risk controls.
- Raw provider latency was 3.24 s p50 and 6.63 s p95. Reconstructed total cost
  was $0.003412; OpenAI did not report direct per-case cost metadata.
- This is a one-repetition descriptive baseline. It will not be rerun during
  hill climbing; repeated uncertainty and all prompt iteration belong to Spark.

## 2026-09-03 — Isolated Spark prompt experiments

- Change class: evaluation harness and experiment integrity, not model strategy
  or a production prompt change.
- Added paired `--prompt-experiment` and `--prompt-addendum-file` flags to the
  fixed-state, May I initiation, and duplicate-tournament runners. Luna is
  rejected whenever an experiment is attached.
- Every experiment now preserves the untouched production prompt, exact
  strategy addendum, composed prompt, independent hashes, source path, and
  composite prompt version in its immutable manifest and case identities.
- Tightened cross-run promotion so the selected candidate, model, provider, and
  reasoning effort must be identical. An unchanged prompt is classified as a
  repeatability check and cannot be promoted as a strategy improvement.
- No candidate addendum has been created or tested yet. The unchanged Spark
  development baseline still determines which backlog idea is eligible for the
  first paid experiment.

## 2026-09-03 — Seat-controlled tournament uncertainty

- Change class: tournament evaluator, not AI strategy, prompt, or game rules.
- Advanced the tournament suite to `duplicate-tournament-v3`. Each statistical
  sample is now one complete seed across all three seat rotations, rather than
  treating unequal dealt hands as independent candidate evidence.
- The first configured Spark competitor is the reference. Every other
  competitor receives candidate-minus-reference final-score and placement
  deltas, paired 95% confidence intervals, and seed-level score win-tie-loss
  counts. Lower score and placement deltas are better.
- A seed is excluded and named unless both competitors completed every seat.
  The report warns that one seed is descriptive and at least three are needed
  before interpreting its uncertainty interval.
- Cost, provider latency, completion, legality, and May I behavior remain
  separate from the gameplay-skill comparison.

## 2026-09-03 — Balanced Spark execution order

- Change class: evaluation execution schedule, not AI strategy, rubric, game
  state, or production behavior.
- Fixed-state and May I multi-candidate runs now finish one matched
  scenario/repetition across all candidates before advancing. The leading
  candidate rotates deterministically on every matched case.
- This spreads cold prompt-cache and time-of-run provider effects across Spark
  effort levels instead of running one entire candidate before the next.
- Manifests record `rotating-interleaved-v1`, and cross-run comparisons reject
  mismatched execution-schedule versions. Single-candidate prompt experiments
  retain their natural one-entry schedule.
- All provider models are now constructed before a fixed-state artifact
  directory is created, so a missing credential fails preflight instead of
  leaving a misleading empty run behind.

## 2026-09-03 — Cost-bounded Spark evaluations

- Change class: evaluation harness and spend safety, not AI strategy, rubric,
  scenario content, or production behavior.
- Fixed-state, May I initiation, and duplicate-tournament runs now default to a
  `$0.25` observed-cost stop threshold, configurable with `--max-cost-usd`.
- Threshold checks happen only between complete matched scenario/repetition
  blocks. Every configured Spark effort finishes the already-started block,
  preserving fair comparisons while limiting overshoot to that block.
- Tournament checks use the larger duplicate-seed boundary, completing all
  three seat rotations before deciding whether another seed can start.
- A result without either direct or reconstructable cost stops execution before
  the next block. Runs preserve `run-status.json` with the policy version,
  completion reason, planned and executed counts, observed spend, and overshoot.
- The cross-run promotion gate rejects cost-limited and unknown-cost runs, so a
  coincidentally matching partial matrix cannot promote a production prompt.
- No model calls or prompt changes were made. The unchanged Spark baseline is
  still waiting for the OpenRouter credential.

## 2026-09-03 — Predeclared Spark effort selection

- Change class: evaluator policy, not AI strategy, rubric, scenario content, or
  production behavior.
- Added a development-sweep selector that anchors to the highest measured
  quality, computes paired small-sample Student-t 95% intervals, and uses a
  predeclared 2.5 percentage-point non-inferiority margin.
- Completion or legality regressions always disqualify a cheaper effort. Cost
  chooses only among statistically eligible efforts; provider latency remains
  separate and acts only as a later tie-breaker.
- The selector requires at least three matched repetitions per scenario and a
  completed cost status, rejects Luna and holdout-inclusive sweeps, and emits
  durable JSON and Markdown decisions beside the raw evidence.
- Corrected the cost-status policy so an unknown cost on the final planned
  block remains `unknown-cost` rather than being mislabeled `completed`.
- No model calls or prompt changes were made.

## 2026-09-03 — Frozen Luna checkpoint comparison

- Change class: evaluator and reporting, not AI strategy, rubric, scenarios, or
  production behavior.
- Added a cross-model checkpoint report that pairs the frozen Luna result with
  Spark's canonical first repetition on identical states and rubrics, while
  retaining all repeated Spark cases for its own quality, reliability, raw
  provider latency, and cost estimates.
- The report permits different prompt identities because model, reasoning
  effort, and instructions jointly define the player being compared. It still
  requires the same harness and suite, a complete all-split Spark checkpoint,
  at least three Spark repetitions per scenario, and trustworthy cost.
- The result is explicitly descriptive and never promotable: Luna's one
  provider observation per position cannot establish its run-to-run variance.
  No additional Luna call is made.
- No model calls or prompt changes were made.

## 2026-09-03 — Resolved model configuration lock

- Change class: evaluation reproducibility and artifact certification, not AI
  strategy, game rules, rubric, or production behavior.
- Advanced new evaluation artifacts to `ai-player-eval-harness-v3`. Every
  candidate manifest now preserves the configured ID, resolved provider model
  slug, transport, output/temperature defaults, provider reasoning and usage
  options, cache policy, and dynamic tool-selection policy behind a canonical
  SHA-256 fingerprint. Case rows retain that fingerprint without duplicating
  the full configuration.
- Artifact loading verifies the snapshot and case-to-manifest fingerprints.
  Prompt promotion rejects configuration drift even when the friendly
  candidate ID, provider, and effort label are unchanged. Spark effort
  selection additionally requires each v3 arm to match the currently declared
  configuration.
- Re-certified the existing 20 Luna observations offline as
  `.data/ai-evals/luna-frozen-baseline-certified-v3`; all engine replays passed
  and the aggregate remains 80.0% quality, 100% completion, 95% legality,
  5.9 s provider p50, 15.7 s p95, and $0.017653 reconstructed cost.
- No model call or prompt change was made. Luna remains frozen, and the first
  paid Spark baseline still awaits the OpenRouter credential.

## 2026-09-03 — Scenario-clustered confidence

- Change class: evaluator statistics and promotion policy, not AI strategy,
  prompt, game rules, rubric, or scenario content.
- Repetitions of one position are no longer treated as independent strategic
  examples. Fixed-state prompt comparisons and Spark effort selection first
  average candidate-minus-reference quality within each scenario, then compute
  their Student-t 95% interval across distinct scenario means.
- Prompt promotion now requires at least three distinct scenarios as well as
  three matched repetitions per scenario. Per-attempt regressions and hard
  gates remain strict; provider latency and cost remain call-level diagnostics.
- Comparison artifacts advanced to schema 4 and effort-selection artifacts to
  schema 2, with `scenario-mean` recorded as the confidence unit.
- No model call, prompt change, rubric change, or scenario change was made.

## 2026-09-03 — Strategic discrimination sanity baseline

- Change class: evaluator validation, not AI strategy, prompt, rubric, game
  rules, or scenario content.
- Added the deterministic `blind-legal-v1` policy: draw stock, never meld,
  allow May I, and discard the first card. It uses the real command policy and
  XState engine, and separately replays the hidden reference trajectory as the
  oracle.
- Across all 20 `fixed-state-v1` positions, the blind policy completed 100%
  legally but scored 36%, while the oracle scored 100%. The 64-point gap shows
  that mere legality and phase compliance cannot earn a strong tactical score.
- The zero-cost test now preserves that discrimination invariant. No model call
  or candidate prompt change was made.

## 2026-09-03 — Hand-order-robust sanity calibration

- Change class: evaluator validation policy, not AI strategy, prompt, rubric,
  game rules, or scenario content.
- Repeating `blind-legal-v1` across the same three hand permutations used for
  model trials exposed 36%, 31%, and 36% scores. Its "discard the first card"
  rule accidentally benefited when a fixture placed the strategically correct
  discard first.
- Advanced the calibration policy to `blind-legal-v2`. It selects a stable
  opaque card ID without using card value or rendered hand position, so input
  permutations cannot change its decision.
- Across 60 scenario/repetition cases, the blind policy now completes and plays
  legally 100% of the time, scores exactly 31% in each repetition, and remains
  69 percentage points below the 100% oracle. No model call, candidate prompt,
  rubric, or scenario changed.

## 2026-09-03 — Balanced holdout decision polarity

- Change class: eval-case split correction and frozen-artifact certification,
  not AI strategy, prompt, rubric, game rules, or scenario state.
- The six-case holdout previously placed the negative side of all three
  rule-boundary pairs outside development. A conservative player that never
  attempted those contracts therefore earned 66.7% holdout quality despite
  lacking the corresponding positive skills.
- Swapped only the Ace pair's split labels: valid Ace-high contract recognition
  is now holdout, and invalid Ace-low rejection is development. The holdout now
  contains three active and three conservative decisions while retaining 14
  development and 6 holdout positions. The suite advanced to
  `fixed-state-v2`; inputs, reference actions, rubrics, and overall weighting
  did not change.
- Under `blind-legal-v2`, development quality is 22.9%, holdout quality is
  50.0%, and overall quality remains 31.0% across each of three hand
  permutations. The oracle remains 100% in both splits.
- Replayed the exact existing Luna action transcripts into
  `.data/ai-evals/luna-frozen-baseline-certified-v4`; all 20 action sequences
  match v3, overall quality remains 80%, and the resolved configuration
  fingerprint remains
  `fbf75f173c8d88287790fcf474644a40adfe489321491f782aed0dce32fc8144`.
  The new development/holdout slices are 78.6% and 83.3%. No provider call was
  made.

## 2026-09-03 — Strategic-category visibility and effort guard

- Change class: evaluator reporting and effort-selection policy, not AI
  strategy, prompt, rubric, game rules, or scenario content.
- Fixed-state summaries now preserve development/holdout category slices with
  scenario count, case count, quality, completion, and legality. A model can no
  longer present only a healthy aggregate while a whole decision family is at
  0%.
- Their top-line quality interval now uses distinct scenario means as its
  confidence units, matching the promotion and effort-selection statistics;
  repeated hand permutations no longer create pseudo-replication in the run
  report.
- Spark effort selection now averages matched repetition deltas within each
  scenario and then within each category. A cheaper effort is ineligible if any
  category is worse than the strongest measured effort by more than the same
  predeclared non-inferiority margin, even when the overall confidence interval
  passes.
- A completed sweep must contain the same repetition IDs for every scenario;
  over-sampling one position can no longer bias aggregate quality or category
  selection.
- Fixed-state summary artifacts advanced to schema 2, and effort-selection
  artifacts advanced to schema 3 with every category delta reported. No model
  call, prompt change, rubric change, or scenario change was made.

## 2026-09-03 — Tournament unknown-cost integrity

- Change class: tournament harness and spend safety, not AI strategy, prompt,
  rubric, game rules, or scenario content.
- Tournament decisions without provider-reported cost or reconstructable token
  usage are no longer recorded as `$0`. Each competitor and aggregate now
  preserve an explicit unknown-cost decision count, and cost per turn is
  withheld when the total is incomplete.
- The budget retains every known cost subtotal while separately recording each
  unknown decision. After the current three-rotation duplicate seed finishes,
  any unknown cost stops the run with `unknown-cost` before another seed can
  start.
- Final scores, placements, wins, and score margins now aggregate completed
  games only. Incomplete games remain in reliability, latency, May I, and spend
  metrics but can no longer contribute partial scores as apparent skill.
- Tournament game artifacts advanced to schema 3 and tournament summaries to
  schema 4. No model calls were made.

## 2026-09-03 — Isolated tournament prompt assignment

- Change class: tournament evaluator configuration, not AI strategy, rubric,
  game rules, or scenario content.
- A tournament prompt experiment must now name one Spark candidate explicitly.
  Only that competitor receives the addendum; the other two continue with the
  exact base prompt as stable opposition.
- The manifest preserves a complete prompt snapshot and fingerprint for every
  candidate, and the runtime resolves the assigned prompt for both ordinary
  turns and out-of-turn May I decisions.
- Advanced the tournament suite to `duplicate-tournament-v4`. No prompt was
  promoted and no model calls were made.

## 2026-09-03 — Matched tournament prompt comparison

- Change class: tournament evaluator and artifact schema, not AI strategy,
  prompt, rubric, game rules, or scenario content.
- Added a baseline-versus-experiment comparator for isolated Spark prompt
  trials. For every complete duplicate seed, it averages the target and each
  unchanged anchor across all three seats, then measures the experiment's
  change in target-minus-anchor score and placement margin relative to the
  unchanged baseline run.
- The report preserves every seed-level difference in differences, paired
  Student-t 95% intervals across distinct seeds, and improvement/tie/regression
  counts independently for both anchors. Negative deltas mean the prompt
  improved relative to the stable opponent.
- Target completion, legality, decision count, raw provider latency, and spend
  are reported separately. Operational improvements cannot conceal weaker
  gameplay.
- The loader refuses incomplete or unknown-cost runs, nonidentical candidates,
  seeds, limits, and rotations, model/configuration drift, a premodified
  baseline, or anything other than one isolated prompt addendum. Comparison
  artifacts are written beside the experimental run.
- Tournament manifests advanced to schema 2 so their per-candidate prompt
  assignments can be validated. No model calls were made.

## 2026-09-03 — Graded sanity calibration

- Change class: evaluator validation, not AI strategy, prompt, rubric, game
  rules, or scenario content.
- Added `rule-aware-greedy-v1`, a deterministic visible-state policy that
  understands card points, obvious same-rank discard pickups and May I claims,
  and legal layoffs but deliberately has no contract planner, Joker strategy,
  or long-horizon opponent model.
- Across all 20 positions and three matched hand permutations, it completed
  and played legally 100% of the time and scored exactly 62% in every
  repetition: 60% development and 66.7% holdout. The existing blind and oracle
  policies remain 31% and 100%.
- The stable 31% -> 62% -> 100% ladder shows that the suite resolves an
  intermediate level of rule-aware gameplay rather than only separating the
  two extreme endpoints. No provider call was made.
- Added an executable calibration report that validates the current Luna
  artifact against every scenario identity and rubric, then requires the full
  `31% blind -> 62% rule-aware -> 80% frozen Luna -> 100% oracle` ordering.
  The first certified artifact is
  `.data/ai-evals/fixed-state-v2-calibration/`; no provider call was made.

## Candidate improvement backlog — not yet applied

These are deliberately frozen before seeing Spark results. Select only after
the unchanged `house-rules-v3` Spark development baseline identifies a matching
failure class.

1. Render a deterministic exact-contract candidate when the engine can prove
   one exists, reducing arithmetic and card-position mistakes.
2. Render every currently legal layoff and explicitly identify an all-cards-out
   sequence, improving endgame conversion without changing game rules.
3. Add state-derived urgency tiers from opponent down status and hand counts so
   point dumping responds consistently to imminent danger.
4. Replace prose strategy with a compact phase-specific decision checklist that
   checks immediate contract, immediate go-out, and point liability in order.
5. Add a bounded contract-plan summary—best current sets/runs, missing cards,
   backup plan, and protected discards—to improve multi-turn consistency.
6. Add a deterministic discard risk score combining point liability, public
   opponent pickups, and table-feed risk, leaving the model to break close ties.

## 2026-09-03 — Short-rollout inner loop

- Change class: evaluation harness and development scenario, not AI strategy,
  production prompt, holdout rubric, or game rules.
- Stopped the initial full Hand 6 Spark tournament before it completed a game;
  it was too slow to support prompt iteration and produced no game result.
- Added `short-rollout-v1`, a real-round-machine microgame with deterministic
  opponents and a hard ceiling of three model decisions: two Spark turns and
  one out-of-turn May I decision. The known-good reference calls May I and goes
  out in two candidate turns with zero illegal actions.
- The first unchanged-prompt Spark-low run completed in 18.856 seconds at
  $0.001878. It scored 100%, completed all three decisions, played legally,
  called May I, and went out. Artifacts are in
  `.data/ai-evals/spark-low-short-rollout-baseline-v1/`.
- This is now the first-pass prompt-development loop. The 14-position
  development suite remains the promotion layer, and duplicate full games are
  reserved for infrequent final validation.

## 2026-09-03 — Nuanced rollout suite and hand-organization experiment

- Change class: AI tool capability, short-rollout evaluation, and isolated
  Spark prompt experiment. The production prompt was not changed.
- Added the free `organize_hand` AI tool backed by the engine's canonical
  `REORDER_HAND` command. Before this change the engine could reorder a hand,
  but the AI had no tool with which to do so and no organization instruction.
- Replaced the ceilinged one-position loop with `short-rollout-v2`: eight
  objectively graded scenarios covering planned May I use, passing before
  stock exhaustion, priority claims, allowing a costly Joker claim, an exact
  Joker swap, constrained natural-before-Joker layoffs, avoiding a rank an
  opponent publicly collected, and preserving public-meld layoff cards without
  weakening the player's own contract. All reference trajectories are legal
  and score 100%.
- The runner now evaluates every scenario four times by default, uses paired
  deterministic hand permutations, records cases incrementally, reports
  gameplay separately from hand-organization compliance, and has no Spark cost
  cap. Raw provider and wall time exclude presentation pacing.
- The unchanged Spark-low baseline scored 76.5625% across 32 cases with 100%
  completion, 93.75% legality, 0% organization, 6.544 s provider p50, 17.233 s
  p95, and $0.021462 total cost. Joker-swap planning scored 0%, constrained
  layoffs 45%, and future layoff preservation 67.5%.
- A first organized run exposed a harness defect: the fixed-state adapter
  validated but did not forward `REORDER_HAND`. Added a failing integration test,
  fixed the adapter, and discarded that run as a harness artifact.
- The final isolated `contract-hand-organization-v1` arm changed only ordinary
  turns and contained no tactical reminders. It scored 82.5%, a directional
  +5.9375 percentage points over baseline, with 100% completion and legality and
  90.625% organization compliance. It improved 4 paired cases, tied 26, and
  regressed 2. Across eight scenario means the paired 95% interval for the
  quality delta was -5.12 to +17.00 points, so the result is promising but not
  promotion-grade evidence. Provider p50/p95 rose to 7.180/20.946 s and total
  cost to $0.031197.

## 2026-09-03 — General rule-derived tactical assistance

- Change class: AI-visible state planning, with fixed scenario definitions and
  rubrics. These helpers derive legal options from the current engine state and
  do not match scenario IDs or hidden opponent cards.
- Added a pre-draw preview for an exact natural-card Joker swap, an exhaustive
  engine-validated contract candidate for hands of at most 16 cards, an exact
  multi-step layoff planner that updates table state after every card, and a
  future-layoff protector limited to cards outside an already-valid contract.
- The Joker preview raised its targeted scenario from 0% to 72.5% in each of
  two independent four-case runs. The exact contract finder then converted all
  5 of 5 targeted post-swap positions that were reached; remaining misses were
  pre-draw choices.
- The layoff planner scored 4/4 in its targeted run and 4/4 in the following
  complete-suite run. Future-layoff protection also scored 4/4 in its targeted
  run.
- The complete Spark-low run after the layoff planner scored 95.9% across 32
  cases, with 100% completion and legality, 8.611 s provider p50, 29.174 s p95,
  and $0.026814 total cost. A subsequent unchanged-prompt run scored 84.4%
  because the stochastic pass-May-I and pre-draw Joker choices moved sharply;
  the newly assisted layoff and future-layoff categories remained 100%.
- This variance ended per-scenario hill climbing. Individual categories remain
  diagnostic probes, but future model and prompt choices are selected on the
  frozen overall suite only.

## 2026-09-03 — Whole-suite effort and system-prompt experiments

- Change class: permanent prompt promotion plus evaluation methodology. The
  eight scenarios, rubrics, four repetitions, hand permutations, and product
  helpers stayed fixed throughout these configuration comparisons.
- Promoted contract-aware hand organization into `house-rules-v4`: rank order
  for Hands 1 and 4, suit order for Hands 2, 3, 5, and 6, followed by normal
  play. The prompt version and Luna cache key were advanced so v3 and v4
  artifacts cannot be silently mixed.
- Spark-low + v4 scored 96.9% quality, 100% completion and legality, and 96.9%
  organization across 32 cases. Provider p50/p95 were 15.990/49.100 s and total
  cost was $0.037888. This is the current configuration anchor.
- Spark-minimal + the identical v4 prompt scored 90.6%, with 100% completion
  and legality and 87.5% organization. Provider p50/p95 were 6.340/17.287 s and
  total cost was $0.030154. Against low it had 0 paired case wins, 30 ties, and
  2 losses; the scenario-mean quality delta was -6.25 points with a wide 95%
  interval of -21.03 to +8.53. Low remains selected because the observed skill
  gain costs only $0.007734 per 32-case run.
- Spark-medium was stopped after three correct cases because provider latency
  degraded to 38.575, 71.435, and 119.351 seconds. The partial artifact is not
  ranked as skill evidence; low already clears the separate ten-second product
  presentation floor without requiring higher reasoning.
- Added explicit `ordinary-turns` and `all-candidate-decisions` prompt scopes to
  the short-rollout runner. The latter prevents a system-prompt experiment from
  silently leaving May-I calls and responses on the base prompt.
- At fixed Spark-low, the general `complete-plan-ranking-v1` system addendum
  scored 93.8% quality and only 93.8% completion, versus the anchor's 96.9% and
  100%. It had 1 paired win, 29 ties, and 2 losses; its scenario-mean delta was
  -3.125 points with a 95% interval of -16.52 to +10.27. It is rejected on the
  aggregate and completion hard gate even though one diagnostic category
  improved.
- Going forward, change one configuration variable at a time and use overall
  suite quality plus completion/legality gates for selection. Scenario slices
  explain tradeoffs but do not authorize fixture-specific prompt edits.

## 2026-09-03 — Frozen diverse suite, not fixture-specific hill climbing

- Change class: evaluation definitions, reporting, and execution scheduling.
  No additional player prompt, tactical helper, game rule, or model default
  changes were made in this iteration. Organization stays in `house-rules-v4`.
- Expanded the short-rollout catalog to v3: twelve development scenarios and
  four holdouts. Added extended initial melds, own-contract versus future-layoff
  conflict, a Hand 6 known-discard win, inference from two public pickups,
  same-suit run separation, unusable Joker liability, no partial Hand 6
  contract, and the May I stock-recycling boundary.
- Every new candidate starts with eleven cards. All sixteen reference
  trajectories score 100% legally, and each new challenge has a plausible
  lower-scoring negative control verified through the real engine. The catalog
  remains synthetic; some legacy mechanics probes use reduced hands.
- A separate read-only scenario audit caught overclaims about objective
  superiority under hidden information. The catalog and reports now distinguish
  immediate tactics, conditional scripted outcomes, and strategic preferences.
  In particular, public pickups indicate risk but do not prove an opponent's
  needs. Extended-contract tests follow the implemented minimum-size rule;
  the conflicting exact-size wording in the house-rules document was not
  silently treated as a rule change.
- Default runs now evaluate all twelve development scenarios, four repetitions
  each, with four independent trials in flight. The bounded scheduler drains
  an active batch before reporting a failure and serializes artifact writes.
  Concurrency is recorded; holdout selection is explicit. Forty-eight trials
  are not treated as forty-eight independent scenario concepts.
- Configuration choices must use the whole development suite with fixed
  product code, rubrics, repetition schedule, prompt scope, and concurrency.
  Holdouts are reserved for a frozen finalist, and individual scenario scores
  remain diagnostics. No further prompt changes are justified by one failing
  fixture. Luna is not part of these tuning runs.
- Verification before live measurement: 2,844 tests passed, 19 skipped, zero
  failures; full `bun run typecheck` and `bun run build` passed.
- Before any holdout model run, the independent audit found an equivalent
  same-suit-gap line that took and discarded the public four instead of the
  unknown stock king. Both lines leave identical hands and melds. A new failing
  regression test reproduced the unfair 70-versus-100 grade, and the holdout
  grader now accepts the equivalent final state. Development fixtures and the
  in-flight baseline were unchanged.
- The completed v3 Spark-low development baseline scored 100% across all 48
  trials, with 100% completion/legality, 95.8% organization, 9.447 s provider
  p50, 27.945 s p95, and $0.046747 total cost. It finished in about 5m21s.
  Artifact: `.data/ai-evals/spark-low-short-rollout-v3-house-rules-v4-c4/`.
  This is a saturated benchmark, not evidence that further player improvement
  is unnecessary.
- Stopped the following Spark-minimal run after 19 recorded trials when Drew
  redirected the work to harder strategic tests. It has no completed aggregate
  and must not be ranked as a whole-suite comparison. No holdout model calls
  were made.
- The next benchmark must test delayed consequences and competing multi-turn
  plans, not merely larger combinatorial hands. Concrete designs, paired
  reversals, information boundaries, and outcome criteria are in
  `docs/ai-player-strategic-scenarios.md`. Prompt/effort tuning is paused while
  this benchmark-design work proceeds; the player remains unchanged.

## 2026-09-03 — Constitution versus player guidance

- Previous goal turn: progress. The v3 run established a measured ceiling and
  changed the next action from player tuning to strategic benchmark design.
- Drew clarified that house rules are authoritative static game law, while
  organization and strategy are player guidance. Split the prompt into distinct
  rule, guidance, and tool-protocol modules with explicit authority precedence.
  Organization remains the default player policy, not a game rule.
- Replaced the misleading whole-prompt `house-rules-v4` identity with a composed
  identity from independently versioned rules, guidance, and protocol. Existing
  saved runs keep their historical names and bytes. New prompt artifacts carry
  separate hashes for each layer; strategy experiments modify only the guidance
  section and cannot inject reserved authority-section tags.
- This is an instruction-boundary refactor, not a scored strategic improvement.
  No live provider runs were made in this iteration and no engine rules or the
  canonical house-rules document were changed. A new baseline is required once
  the rule discrepancy below is resolved.
- Found an existing mismatch: house-rules section 8 forbids initial extensions
  in Hands 1–5; the engine and prior AI rule summary allow them. Requested owner
  clarification and suspended dependent strategic examples rather than changing
  the constitution to suit the benchmark. The unimplemented strategic test
  draft was removed; the concrete design remains documented.
- Independently hardened reference validation: illegal opponent script actions
  can no longer be ignored when certifying a full-credit reference. Conditional
  May I allow scripts are skipped when no claim exists, and no actions are
  attempted after terminal scoring. A red-first regression verifies rejection
  of an actually illegal opponent action.
- The independent prompt-boundary review found two new defects: custom guidance
  could introduce reserved section tags, and literal JavaScript replacement
  tokens in an addendum could duplicate surrounding sections. Reproduced both
  with failing tests, then added a shared section guard and literal-preserving
  insertion callback. Historical prompt artifacts remain untouched.
- Local verification: 2,851 tests passed, 19 skipped, zero failures; typecheck,
  production build, and whitespace checks passed. Live-provider tests were not
  run. This validates the separation machinery, not gameplay improvement.

## 2026-09-03 — Strategic v4 calibration, unchanged player guidance

- Previous goal turn: progress. Constitutional separation and regression tests
  are implemented. The initial-meld clarification is still pending; dependent
  cases remain suspended. This iteration advances independent benchmark work,
  not a player/prompt/effort improvement.
- Added four cases across two families. Hand 6 planning counts all unseen
  physical-card completions (23/95 versus14/95), then tests conversion across
  natural and wild continuations. Delayed May I tracks claim/recycling/forced
  draws, with a larger-reserve reversal. All use complete108-card inventories,
  legal full-credit engine references, and genuinely legal inferior controls.
- Independent judges validated the conditional rubrics. The May I review caught
  an impossible three-player hand-count parity despite complete inventory;
  red-first tests drove a four-player correction before provider calibration.
  Necessary reachability invariants and continuations are verified, not a full
  replay from the initial deal. Judge evidence is retained at
  `.data/ai-evals/strategic-v4-validation-20260903/judge-results.json`.
- V4 has20 cases:16 development plus the four untouched holdouts. The new
  calibration intentionally selects only the four rule-independent cases,
  four repetitions each, Spark-low, concurrency4, zero presentation pacing.
  It is a difficulty diagnostic, not whole-suite configuration selection.
- First run, `spark-low-v4-strategic-calibration-20260903`, reported50% and
  cost$0.015236. Its four wild cases incorrectly failed legality because the
  evaluator rejected a no-op organization request. Both actual rubric criteria
  passed and the model won. Exact tool replay reproduced the defect; adapter
  acceptance now recognizes the identical full hand order while still rejecting
  invalid permutations. No engine, player helper, or guidance was changed.
- The corrected runtime-v2 run is
  `.data/ai-evals/spark-low-v4-strategic-calibration-runtime-v2-20260903/`:
  16/16 complete and legal; organization100%; quality75%; provider decision
  p50 7,363ms/p95 16,684ms; cost$0.017348. Both Hand6 branches and the larger
  reserve scored4/4; the delayed-exhaustion pass case scored0/4. The50→75
  difference is a harness repair, NOT improved player skill. Original artifacts
  remain unchanged; the new manifest records `fixed-state-runtime-v2`.
- Do not tune specifically to the May I failure. Only one strategic family
  currently leaves headroom; Hand6 still saturated. Next add distinct
  multi-turn strategic families and retain all existing cases, then establish
  a complete matched baseline before resuming whole-suite prompt/effort sweeps.
- Final independent provider-artifact review confirmed a behavioral horizon
  miss: all four negative cases legally call and end with13 cards, with no
  missing public information, tool rejection, or incomplete execution. The
  positive4/4 alone does not establish understanding of the contrast. No
  evaluator-answer leakage appeared in the saved system prompt or MayI input
  states. Prompt and house-rule hashes match across both calibration runs.
- Final local checks: 2,864 passed,19 skipped,zero failed; typecheck and
  whitespace checks passed. No deployment or Luna run. House rules, player
  guidance, and gameplay presentation pacing remain unchanged this iteration.

## 2026-09-03 — Strategic v5 contract-versus-horizon calibration

- Previous goal turn: progress. The repaired v4 runtime exposed a repeatable
  delayed May I miss. This iteration adds a distinct failure family before
  restarting whole-suite tuning; it does not modify the player to solve a case.
- Added three branches with the same twelve-card candidate decision hand and
  exactly two legal minimum-size contracts. In the two nonterminal branches,
  laying sevens preserves three nines and a queen for next-turn public layoffs.
  In the urgent branch, public transfers establish the next opponent's one
  remaining card is a nine; laying nines minimizes the candidate's terminal
  penalty to 31 instead of 37. Natural and wild safe continuations share the
  same initial visible state. These are one family, not three independent roots.
- Tests were written and observed failing before implementation. Full 108-card
  inventories, a fifteen-action legal engine prelude, both 3+4 contract shapes,
  full-credit references across four hand permutations, and lower-scoring legal
  controls are verified. No initial meld extension is required.
- Independent review found no blocking legality or grading defect. It also
  checked inventory after every replay transition. The constructed public
  history truthfully groups fifteen actions into ten entries; production's
  last-ten-individual-events window would lose the original pickup. Rollout
  continuation table state updates, but its initial history is not appended.
  Therefore this is a decision diagnostic given public evidence, not evidence
  that production remembers it. The initial deal itself was not replayed.
- V5 now contains 23 cases: 19 development and four untouched holdouts. Only
  the three new rule-independent branches were calibrated, four repetitions
  each, Spark-low, concurrency 4, zero presentation pacing, no cost cap.
  Artifact: `.data/ai-evals/spark-low-v5-contract-horizon-calibration-20260903/`.
- Results: 33.3% conditional quality, 100% completion, legality, and correct
  organization. Both safe branches scored 0/4; urgent scored 4/4. Provider
  decision p50/p95 were 7,585/28,005 ms; total cost was $0.018255. This selected
  family score is not comparable with the earlier whole-suite score.
- Independent artifact replay matched all 20 saved decision inputs and executed
  all recorded actions legally. Natural misses end active with two sevens and
  3-heart (17 points); wild misses with two sevens (14 points). All urgent cases
  end with 31 points. The eight zeroes are genuine conditional outcome misses,
  not runtime failures, incomplete calls, or organization penalties.
- Every trial lays nines first and discards the king, matching the existing
  single-contract tactical hint. The urgent success does not independently
  demonstrate public-history deduction or horizon adaptation. The hint is
  player guidance, not game law; a possible bias is not proven causation or
  evidence of the model's private reasoning. No hint or prompt was changed.
- Model configuration, full prompt, and separate house-rule/guidance/protocol
  hashes match the corrected v4 calibration. The new work changes benchmark
  coverage, not player skill. Judge evidence is retained in
  `.data/ai-evals/strategic-v5-validation-20260903/judge-results.json`.
- Local verification: 2,867 passed, 19 skipped, zero failed; typecheck and
  whitespace checks passed. No deployment, Luna call, house-rule amendment,
  player-guidance change, or product-pacing change.
- Next: validate/freeze a complete benchmark with explicit observation fidelity
  and rule eligibility, then compare general guidance/effort changes across all
  development cases. Rule-dependent cases remain procedurally suspended; the
  runner does not yet enforce that exclusion. Do not promote on these three
  selected branches or drop successful cases to manufacture a lower score.

## 2026-09-03 — Public-history delivery and scrollable activity

- Previous goal turn: progress. Read-only inspection located the ten-event
  truncation boundaries; independent scenario review favored realistic public
  history and competing-plan decisions over the scarce-stock May I fixture.
  This iteration improves product observation fidelity, not the player prompt,
  reasoning effort, or grading rubric. Benchmark setup is still in progress.
- The app adapter now supplies all recorded current-hand public activity to
  broadcast/reconnect snapshots and AI turns. The prompt renderer no longer
  takes only ten current-hand events. The UI keeps a six-entry preview and
  makes earlier entries expandable and vertically scrollable.
- Red-first tests exercised real engine turns, more than ten events, persistence,
  broadcast privacy, reconnect, engine-ID mapping, prompt retention, and real
  React rendering. Initial failures confirmed truncation and missing history
  methods before implementation. No mocks or provider calls were used.
- Longer history exposed missing public laydown cards and lost final discards.
  Additional failing regressions preceded fixes. Independent review then found
  lost terminal meld events, hand-boundary attribution errors, and May I pickup
  inference problems. New failing terminal/claim regressions preceded fixes;
  logging now uses before-action context plus verified public transfers or
  terminal winner evidence. Private stock and penalty card faces stay hidden.
- Independent final review passed active-hand delivery, privacy, attribution,
  and UI retention. The judge also exercised an 18-case H2/H6 May I matrix over
  CALL/ALLOW/CLAIM and stock counts 0/1/2. Evidence is retained at
  `.data/ai-evals/public-history-validation-20260903/judge-results.json`.
- Known nonblocking residual: a successful May I that consumes the final
  penalty card and ends the hand can omit its final acquisition event after
  the engine clears ownership evidence. No private faces or next-hand entries
  are leaked or fabricated. Do not claim a complete historical transcript or
  use this omission to infer that the completed-hand pickup did not happen.
- Desktop browser validation in the local component showcase expanded 42 older
  entries, scrolled through the oldest turn, and checked Enter/Tab access.
  This is component-level evidence, not a deployed multiplayer room or physical
  mobile-device check. Regression tests cover the actual broadcast and reconnect
  projections separately.
- Final verification: 2,881 passed, 19 skipped, zero failed; 9,000 assertions.
  Typecheck, build, and whitespace checks passed. Build still warns about
  devtools fs/path imports for Workers compatibility; no deployment was attempted.
  No Luna run, player-guidance change, house-rule amendment, or pacing change.
- Added prospective scenario designs for eligible discard recipients, contested
  suits with physical-copy counts, stale/changed ownership evidence, and shared
  run extensions that help an opponent first. Each calls for reversal branches
  and real outcomes. They are designs, not implemented or calibrated cases.
- The owner-rejected scarce-stock fixture will be robustness coverage rather
  than representative skill in the next benchmark version; current v5 catalog
  and historical scores remain unchanged. Rule-dependent cases are still only
  procedurally suspended. Do not run or rank a whole suite until these scopes
  are versioned explicitly.
- Next: version the observation contract, replace grouped/static fixture history
  with actual app-log replay and evolving continuation events, implement the
  realistic strategic families with legal references and inferior controls,
  then establish a matched baseline before any whole-suite Spark prompt/effort
  comparison. Full-history availability alone is not evidence of better play.

## 2026-09-03 — Replayable public history and runtime-v3 calibration

- Previous goal turn: progress. Full recorded current-hand history reached the
  app and AI, with scrollable older activity. This iteration fixes benchmark
  observation fidelity; it does not change strategy guidance or the rubric.
- Extracted the app's public-action projection into a shared core module.
  App logging and the short-rollout journal use the same logic for public
  draws, melds, discards, swaps, and May I recipients. App compatibility methods
  remain; private stock and penalty identities remain hidden.
- Red-first app-parity and journal tests preceded implementation. The three
  contract-horizon cases now replay their fifteen-action legal prelude with
  fifteen ungrouped events. Root snapshots match the previous preparation
  across all four permutations. Actual candidate and scripted opponent actions
  append before subsequent decisions; returned history is independently copied.
  Removed the now-unused handwritten grouped history from those fixtures.
- Manifests and case artifacts record `public-action-history-v1`; manifest
  entries label replayed, constructed, or unrecorded initial history. Legacy
  cases without preludes still use synthetic seed evidence. Some seeded pickups
  lack a full ownership/disposal trail; this change does not certify those
  cases for realistic tracking. No full-suite ranking is authorized by this run.
- Independent review reproduced a real app/eval mismatch: rejected laydown
  left an error that caused successful CALL/ALLOW actions to return false and
  vanish from eval history. A failing real-round regression preceded the fix.
  `fixed-state-runtime-v3` now consumes the app's shared stale-error policy for
  accepted round-level actions. App policy and game rules are unchanged.
- Selected-family calibration, not prompt tuning: Spark-low, three scenarios,
  four repetitions each, concurrency four, zero presentation pacing, no cost
  cap. Saved at `.data/ai-evals/spark-low-v5-public-history-v1-calibration-20260903/`.
  Prompt and model configuration hashes match the prior calibration.
- Results remain 33.3% conditional quality: safe natural 0/4, safe wild 0/4,
  known exit 4/4. Completion, legality, and organization are all 100%. Provider
  decision p50/p95: 10,377/25,487 ms. Total cost: $0.020034. Prior run was also
  33.3%, but used runtime-v2 and grouped/static history. No score movement or
  generalized player improvement is claimed across this observation change.
- Independent replay matched all 20 saved decision inputs byte-for-byte:
  fifteen events at all initial decisions and twenty-two at all eight second
  decisions. All 72 candidate tool calls and 52 scripted opponent commands
  were accepted. Grades reproduce exactly. Safe natural leaves 17 points, safe
  wild 14; urgent leaves 31 when the opponent exits. Final states are replayed
  evidence, not raw final snapshots persisted by the original runner.
- All twelve trials organize by suit, lay nines plus the spade run, and discard
  the king. Urgent passes therefore do not demonstrate history-based adaptation.
  The tactical hint still presents nines; its causal influence remains untested.
  Judge results: `.data/ai-evals/rollout-history-v1-validation-20260903/judge-results.json`.
- Residuals: terminal last-penalty May I can still omit a completed-hand pickup;
  synthetic legacy histories are not replay-certified; robustness versus main
  strategy and disputed-rule eligibility still need explicit versioned filtering.
  None justify discarding historical scores or changing house rules.
- Final verification: 2,886 passed, 19 skipped, zero failed; 9,140 assertions.
  Typecheck, build, and whitespace checks passed. A final suite run exposed an
  unrelated timestamp-sensitive copy test (12/200 repeated failures, differing
  only by projection milliseconds). The test now compares stable state and
  validates timestamps separately; 200/200 repetitions pass. No engine behavior
  changed for that correction. No deployment, Luna call, or player/pacing change.
- Next: implement realistic paired strategic roots with actual preludes and
  outcome-based legal controls, then explicitly classify rule-independent main
  strategy versus robustness/legacy cases. Preserve the suite and holdouts;
  freeze a complete matched baseline before resuming whole-suite Spark tuning.

## 2026-09-03 — Shared-run timing family and terminal-outcome calibration

- Previous goal turn: progress. Shared public-action history and runtime-v3
  calibration established reliable observations. This iteration adds a
  realistic strategic family without changing the configured player.
- V6 adds three development branches: delay a public run extension that would
  enable a known opponent exit, convert that delay under natural/Joker future
  draws, and take the immediate win when another card already lays off. The
  catalog is now 26 cases: 22 development, four untouched holdouts. This is one
  new strategic family, not three independent roots.
- The seventeen-action prelude records a 4-spade pickup followed by no removal
  of that face; the next opponent has one card. Candidate 5-spade can extend
  the public 6–9 spade run, allowing that opponent to finish. References hold
  it until the candidate can exit; either liability discard receives credit.
  A reversal with playable 10-club instead of King takes the immediate exit.
- Red-first scenario tests preceded implementation. Premature bridging first
  exposed the harness's static opponent/required-second-turn assumptions.
  Red-first policy, completion, catalog-version, and failure-classification
  tests preceded the shared responsive-policy and terminal-state fixes.
  A legal early loss now completes and grades as strategy, not provider failure;
  rejected opponent commands prevent completion and classify as harness errors.
- Harness-v2 records all candidate/opponent attempts and final snapshots in
  case schema 3; manifest/summary schema 4 record harness and observation
  versions, with policy IDs in the manifest. Opponent policy receives only a
  copied own hand/public table. Full final snapshots remain evaluator-only.
- Independent review found no substantive fixture/rubric defect. It constructed
  a nine-action prefix from a legal eleven-card deal, followed by the existing
  prelude. Retained regression verifies all three physical positions after
  normalizing generated meld IDs/table order. All initial melds are exact
  minimum sizes; no disputed initial-extension behavior is required.
- The historical prefix is not part of the seventeen-event fixture observation.
  This proves reachable positions, not naturally sampled games or complete
  from-deal history delivery. Canonical natural/wild observations match; later
  repetitions use scenario-keyed hand ordering, not cross-branch byte equality.
- Calibration: Spark-low, three cases × four repetitions, concurrency four,
  zero pacing, no cost cap. Artifacts:
  `.data/ai-evals/spark-low-v6-shared-run-calibration-20260903/`.
  Both delayed branches score 0/4; immediate win scores 4/4. Selected-family
  quality is 33.3%, with completion/legality/organization all 100%. Provider
  p50/p95: 9,656/11,532 ms; wall p50/p95: 9,663/11,538 ms. Total cost:
  $0.007155022. All twelve trials use one model decision.
- All eight delayed trials organize, lay 5-spade, and discard Ace-club. The
  opponent lays its known 4-spade and exits, leaving candidate King-club worth
  ten points. No delayed live trial reaches its future natural/Joker draw:
  second-turn conversion is reference evidence, not live model evidence.
- Independent artifact replay matched all twelve inputs, action outcomes,
  final snapshots (excluding projection timestamp), and grades; every final
  snapshot conserves 108 unique cards. Prompt and candidate objects exactly
  match the prior v5 history calibration. This is new benchmark difficulty,
  not a player improvement or a valid v5-versus-v6 score comparison.
  Review: `.data/ai-evals/shared-run-v6-validation-20260903/judge-results.json`.
- Scope limits remain explicit: conditional draw continuations, not global
  expected-score optimality; one family, not eight independent delayed tests;
  input/tool-boundary privacy evidence, not a captured provider wire transcript.
  Existing scarce-stock cases remain robustness-only by policy, and disputed
  rule cases remain suspended. V6 does not yet implement automatic filtering.
- Local verification: 2,896 passed, 19 skipped, zero failed; 9,370 assertions.
  Typecheck and whitespace checks passed. No Luna call, deployment, product
  pacing change, house-rule change, or player-guidance change.
- Next: explicitly version representative strategy versus robustness/disputed
  rules and legacy history provenance, then add contested-suit/stale-evidence
  families with legal reversals. Freeze and validate the complete eligible
  benchmark before resuming whole-suite Spark prompt/effort selection. Do not
  tune the player against this selected family.

## 2026-09-03 — Enforced benchmark scope and score separation

- Previous goal turn: progress. The shared-run family exposed a repeatable
  strategic error with independently replayed provider evidence. This turn is
  benchmark/harness repair only; no player or rubric improvement is claimed.
- Independent score-blind audits examined all sixteen legacy/challenge cases.
  Their deterministic references pass the engine, but many have impossible
  physical inventories, reduced not-down hands, or inconsistent table owners.
  Three rewards depend directly on oversized initial Hands 1–5 melds, contrary
  to section 8. Exact-size counterfactuals are legal but lose their winning
  criteria. Two pickup-history cases lack reliable physical/disposal provenance.
- V7 preserves all 26 catalog cases and historical split labels. New
  `rollout-scope-v1` explicitly classifies eight strategy cases across three
  families, thirteen mechanics/robustness cases, and five quarantine cases.
  Historical artifacts and reference tests are not rewritten or regraded.
- Quarantine: plan-call-may-i-and-go-out, include-extended-run-to-go-out,
  prioritize-own-contract-over-public-layoff, avoid-publicly-collected-rank,
  and avoid-publicly-collected-run-gap. The run-gap decision is conservative:
  one judge considered it acceptable as robustness; missing disposal evidence
  is not proof that the earlier pickup never happened. Its uncertain signal
  remains quarantined pending replay rather than scored as factual tracking.
- Default all-eligible development runs now select 17 cases: eight strategy
  plus nine robustness, or 68 trials at four repetitions. All-eligible across
  both splits selects 21 cases. The four original holdouts remain robustness;
  there are zero representative strategic holdouts. This gap is reported, not
  papered over by relabeling known development cases.
- Red-first scope/selection tests preceded implementation. Explicit, mixed,
  out-of-split, duplicate, unknown, and quarantined selections fail before
  provider trials. Independent CLI review caught repeated --scenario flags
  overwriting earlier requests; a reproduced failing regression preceded the
  concatenation fix. Prototype-named unclassified keys also fail closed.
- `--describe` prints the complete selection, exclusions/reasons, inventory
  and initial-history provenance, family IDs, and coverage without inference
  or new run artifacts. Independent checks succeeded with no credentials and
  Bun env-file loading disabled. Provider registry imports can still initialize
  objects; no-provider does not mean zero imported provider objects.
- Case schema 4 carries scope version and eligibility. Manifest/summary schema
  5 carries selection metadata and separate strategy/robustness scores. A
  red-first hardening test removed ambiguous top-level qualityPercent from the
  summary: diagnosticQualityPercent is explicitly mixed, while strategy lives
  in scopeScores.strategy. Empty stratum evidence is null, not a zero grade.
- Real fixture regressions verify all eight strategic cases conserve the full
  108-card deck, have no undersized not-down starting hands, and use exact
  initial reference/prelude meld sizes outside Hand 6. Independent review
  supports the three families' narrow provenance/conditional claims, not
  generalized strategic strength or benchmark readiness.
- Independent gate audit and schema addendum pass. Evidence is retained at
  `.data/ai-evals/rollout-scope-v1-validation-20260903/`, including the actual
  no-provider all-eligible selection JSON. No new paid-result persistence was
  exercised: schema changes are source/test-supported, not provider-run proof.
- No provider calls, cost, score delta, prompt change, house-rule amendment,
  reasoning-effort change, pacing change, deployment, or historical-score
  deletion occurred this turn. This is setup progress, not player improvement.
- Final local verification: 2,906 passed, 19 skipped, zero failed; 9,555
  assertions. Typecheck and whitespace checks passed. New audit artifacts are
  intentionally ignored under .data; existing unrelated worktree changes remain.
- Next: replace missing realistic May I/Joker/history competition coverage
  with conserved, reachable strategic roots and legal reversal controls; add
  an untouched representative strategic holdout. Then freeze the eligible
  benchmark and matched Spark baseline before resuming whole-suite prompt and
  effort experiments. Do not promote on the current three-family diagnostic.

## 2026-09-03 — Contested-run availability, reversal, and near-transfer holdouts

- Previous goal turn: progress. Eligibility and separated scores removed
  misleading mechanics/rule-conflict evidence from strategic ranking. This
  iteration expands measurement only; no player improvement is claimed.
- V8/scope-v2 adds four development cases and two near-transfer holdouts.
  Total catalog: 32 cases, 26 development and six holdouts. Eligible development
  is twelve strategy cases across four families plus nine robustness cases
  (84 trials at four repetitions). Two strategy holdouts belong to the same
  contested-run family; four old holdouts remain robustness. Five quarantine
  entries and all historical artifacts/split labels remain unchanged.
- Hand 5 root: two completed three-card sets plus two three-card run starts
  fill the twelve-card post-draw hand. Discarding forces a plan commitment.
  Retained opponent pickups reduce the completing physical copies for one run;
  a boundary-run reversal makes the contested plan stronger instead. The
  suite tests specific observable copies, not an assumption that someone
  collecting diamonds holds every diamond.
- New evaluator-only oracle enumerates every discard and physical unseen draw,
  selecting only exact 3+3+4 contracts. Red-first tests caught production
  solver witnesses using oversized initial melds; exact-size filtering fixes
  only the evaluator, without changing the engine, player, or constitution.
  Independent raw-card enumeration matched 2,256 discard/draw pairs and 81
  witnesses for the canonical roots, including discarded-copy exclusion.
- All six fixtures replay from a complete 108-card eleven-card deal. Seventeen
  public events establish two retained pickups older than the latest ten
  entries; seven known discard cards plus those two pickups leave 87 cards
  unobserved. Preferred/alternative completion counts are 16/14 or 15/14.
  The oracle assumes exchangeability and survival with no intervening claims
  or recycling. It is not an actual-stock or global expected-score oracle.
- Independent review caught three preludes skipping a ready contract. A
  failing regression preceded moving the contested run's missing card to the
  final root draw. Every candidate SKIP now lacks a ready exact contract;
  independent re-review confirmed root/count/history/privacy invariants.
  Earlier endpoint disposal is plausible, not proven optimal prior play.
- Fifty rubric points reward maximum first-discard draw coverage; fifty reward
  second-own-turn laydown. References score 100 across four hand permutations.
  Legal opposite-plan controls score zero with natural draws and 50 with the
  lucky Joker. A binary fifty-point loss is not a fifty-point expected-game
  disadvantage. Existing tactical contract assistance remains available.
- Red-first catalog/scope/selection tests preceded integration. Per-scenario
  reference tests replace aggregate loops that exceeded Bun's five-second
  test timeout, without increasing timeouts or weakening assertions.
- Calibration: Spark-low, four development cases × four repetitions,
  concurrency four, zero pacing and no cost cap. Artifacts:
  `.data/ai-evals/spark-low-v8-contested-run-calibration-20260903/`.
  Quality by case: diamonds-natural 25%, diamonds-wild 50%, spades-natural
  50%, stronger-diamonds 75%; selected-family mean 50%. Planning succeeds in
  6/16 trials; conversion in 10/16. Every trial completes legally, with two
  decisions and correct organization on both turns. No warnings were recorded.
- Nine planning misses retain the lower-coverage run; one mirror trial breaks
  the completed king set and leaves zero one-draw completions. All four wild
  trials choose the weaker plan but convert anyway. These are observable
  choices, not a diagnosis of the model's private reasoning.
- Provider p50/p95 per decision: 9,852/23,633 ms. Wall p50/p95:
  9,869/23,658 ms. Total cost: $0.024339144. Manifest candidate and complete
  prompt objects exactly match the prior v6 shared-run calibration. No prompt,
  effort, house-rule, product pacing, or Luna changes; no holdout provider calls.
  Cross-version aggregate deltas are not player improvement evidence.
- Independent provider-artifact replay accepted all 400 prelude actions and
  186 recorded actions, matched all 32 input states byte-for-byte and all
  sixteen final snapshots (excluding updatedAt), and verified physical
  inventory throughout. All ten conversions have exact 3+3+4 melds; successful
  candidates retain one card, so this is laydown rather than a round-win rate.
  Tool-position mapping, scope/schema metadata, prompt/configuration hashes,
  organization, scores, cost arithmetic and latency summaries reconcile.
  Review: `.data/ai-evals/contested-run-v8-validation-20260903/judge-results.json`.
- The audit found one non-blocking report-text defect: the conversion evidence
  sentence asserted laydown even in six passed:false cases. A failing text
  regression preceded a prospective conditional-wording fix. Raw provider
  artifacts remain untouched; their booleans, actions, and scores are correct.
  The v8 fixture inputs and numerical rubric are unchanged. This is a reporting
  correction, not a player change or a regraded calibration.
- Local verification after wording repair: 2,956 passed, 19 skipped, zero
  failed; 10,380 assertions. Focused oracle/fixture checks: nineteen passed,
  715 assertions. Typecheck
  and whitespace checks passed. New evidence lives under ignored .data; no
  commit, deployment, credential change, or unrelated worktree cleanup.
- Next: freeze the current eligible development suite and capture its complete
  matched Spark baseline, then compare generalized effort/prompt candidates
  across all eligible cases, keeping strategic quality and robustness separate.
  Selected-family outcomes must not drive case-specific prompt patches. Keep
  realistic May I/Joker, stale-evidence and unseen-family coverage gaps visible;
  use untouched holdouts only for a frozen finalist, not ordinary tuning.

## 2026-09-03 — Frozen whole-development baseline and reasoning comparison

- Previous goal turn: progress. Contested-run planning added a fourth validated
  conditional strategic family and two untouched near-transfer holdouts. Its
  selected calibration is difficulty evidence, not a whole-suite baseline.
- This iteration changes only an existing candidate setting: Spark-low versus
  Spark-high. No implementation or player-prompt edit is required. House rules,
  guidance, tool assistance, observations, temperature, output limit, pricing,
  hand permutations, and four-way concurrency remain fixed. Production defaults
  and the separate human-visible pacing policy are not being changed.
- Full eligible development selection: 21 scenarios × four repetitions = 84
  trials per setting. Twelve strategic scenarios (four correlated families)
  and nine robustness scenarios are reported separately; all six holdouts and
  five quarantined scenarios are excluded. No cost cap or artificial pacing.
- Before comparison, fingerprinted 109 inference/evaluator/core source and
  dependency/rule files. Source-set SHA-256:
  `80507ac1fa76df4102abe2b30e91f5f7acf341a6fcd00ca457dc19d3e1046bcd`.
  Exact file hashes and predeclared comparison policy are in
  `.data/ai-evals/spark-v8-effort-comparison-20260903/plan.json`.
- Five generalized improvement avenues were considered: higher reasoning,
  complete-plan comparison, explicit public-evidence tracking, checking the
  next opponent's reply, and horizon-aware liability management. Higher
  reasoning is first because it isolates additional deliberation without
  encoding fixture-specific advice. The other ideas remain unimplemented.
- Runs must be complete and source/prompt/selection compatible before comparing.
  Primary quality is strategic; mechanics and per-family/per-case regressions
  stay visible. Completion/legality regressions block promotion. Cost and
  latency are separate diagnostics; 84 trials are not 84 independent strategic
  situations or an estimated win rate. Any promising result needs replication
  before a frozen-finalist holdout, not tuning against holdout outcomes.
- Baseline run: `.data/ai-evals/spark-low-v8-full-development-20260903/`.
  Candidate run planned: `.data/ai-evals/spark-high-v8-full-development-20260903/`.

### Baseline result and interrupted comparison

- The complete low-effort run finished: strategy 54.2%, robustness 88.9%; all
  84 trials completed legally and every evaluated turn was organized. Cost
  $0.088258392; provider p50/p95 8,801/21,742 ms per decision. This is rubric
  compliance on four correlated strategic families, not overall win rate.
- Independent review reproduced 80/84 trials exactly, including all 48
  strategic trials. The four remaining reserve/recycling trials are internally
  coherent but not deterministic: repeated replays alternate between two
  recycled-card orders. Every original trial had an exact matching branch;
  this is a harness randomness defect, not evidence of illegal player actions.
- Both safe contract-horizon cases and both delayed shared-run cases scored
  zero in every repetition. Their immediate-exit controls passed. Contested
  run planning averaged 62.5%; Hand 6 draw coverage remained 100%. These are
  useful whole-suite weaknesses, not permission to patch individual cases.
- The planned high-effort run was not started. The original source freeze and
  raw artifacts are retained as descriptive evidence, not a fully matched
  deterministic baseline. Independent audit results and the superseding
  decision are recorded in
  `.data/ai-evals/spark-v8-effort-comparison-20260903/judge-results.json`.
- A red-first full-trajectory replay test exposed unseeded automatic stock
  recycling. Direct turn seed/persistence tests also failed before repair.
  Fixing only the child turn was insufficient: the authoritative round-owned
  draw used a separate default shuffle. Both paths now use the same derived
  per-turn seed, while unseeded/legacy turns retain random shuffling. No global
  randomness patch, hidden-card disclosure, player guidance or rule change.
- Fixed-state runtime advances to v4; suite v8, scope v2, numeric rubrics and
  public observation version remain unchanged. Thirty-two reference replays
  now match. Local verification: 2,961 passed, 19 skipped, zero failed; 10,774
  assertions. Typecheck and whitespace checks passed. Independent repair
  review is pending before a new source freeze and fresh complete low/high
  runs; do not splice four repaired cases into the old baseline.

### Runtime-v4 freeze

- A further red-first test required a deterministic scenario-identity seed
  for every fixture, not just those with explicit seeds. Repetitions keep the
  same random stream while varying hand order; explicit fixture seeds are
  preserved and source inputs are not mutated.
- Independent repair review approved fresh v4 evaluations: thirty-two full
  replays, restore-before-each-action continuity, exact seeded round/turn card
  agreement, manual/May I recycling and non-disclosure of seeds all checked.
  Older unseeded/legacy child-stock synchronization quirks remain outside this
  fix; parent round state is authoritative and synchronizes before later
  actions. This approval is not blanket certification of old save internals.
- Final local tests: 2,962 passed, 19 skipped, zero failed; 10,784 assertions.
  Typecheck passed. Fresh source freeze: 109 files, SHA-256
  `ce776e51800fcc70cdb7cf973bd16fd0462b76675593b9072d733318f5960638`.
  Protocol: `.data/ai-evals/spark-v8-runtime-v4-effort-comparison-20260903/plan.json`.
- New full-run IDs are `spark-low-v8-runtime-v4-full-development-20260903`
  and `spark-high-v8-runtime-v4-full-development-20260903`. Only reasoning
  effort differs. No holdouts, player guidance, house rules, production defaults
  or pacing changes. The prior runtime-v3 comparison remains superseded.

### Runtime-v4 whole-suite result: reject high-effort promotion

- Fresh low and high runs each produced all 84 expected records. All initial
  public observations match by scenario/repetition; all 109 frozen source
  files remain unchanged. Manifest differences are confined to run/candidate
  identity, reasoning effort and the corresponding configuration hash.
- Low: strategy rubric 44.7917%, robustness 88.8889%, 84/84 complete, all legal
  and organized. Provider p50/p95 9,300/31,374 ms; recorded token cost
  $0.090715. Independent audits replay all 128 decision input states and 84
  final snapshots, including every repaired reserve/recycling trajectory.
- High: strategy diagnostic 45.8333%, robustness 86.1111%, only 80/84 complete,
  all candidate actions legal. Provider p50/p95 15,376/48,419 ms; recorded
  token cost $0.114874108. Cost uses recorded usage and frozen rates, not a
  billing invoice; network interruptions can leave missing usage.
- High's four incomplete cases fail the preregistered completeness gate:
  **no promotion and no rankable strategic improvement**. Both settings still
  fail all sixteen safe-horizon/shared-run-delay trials and pass their exit
  controls. Contested-run diagnostics move 34.375% to 37.5%; all other
  strategic family means are unchanged. Overall paired rubric gains/losses/
  ties are 2/3/79, not independent win/loss evidence.
- The high Joker regression is genuine: stock instead of the exposed nine
  exhausts the reduced stock and ends the hand. Frozen organization metrics
  count 107/108 versus low 108/108, but this single missed opportunity is a
  terminal draw, not an independently ignored organization instruction.
- All four incomplete records show an upstream provider interruption: one
  network error and three early stops without completing the turn. The runner
  then cascades six rejected opponent actions and a second candidate decision
  on the still-current original turn. This exposed a prospective failure-path
  repair; preserve the artifacts and do not count them as completed strategy
  trials. Aggregate token usage does not establish truncation as the cause.
- Evidence: `.data/ai-evals/spark-v8-runtime-v4-effort-comparison-20260903/`
  contains the frozen protocol, low and high-mechanics independent audits,
  `comparison.json` and `report.md`. High strategy audit is pending. No source
  change after freezing, no holdout provider calls, production changes or
  deployment. Next: red-first fail-fast handling for incomplete turns, then
  generalized player-guidance experiments over the complete suite at low
  effort; do not tune fixture-specific answers into the prompt.
- High replay subsequently matched all 80 strategy input states, 48 final
  snapshots and 48 paired first observations. The four failed first invocations
  never advance to a second physical turn; repeat organization is therefore
  an artifact of re-invoking the same turn. The frozen organization percentage
  counts sorted invocations and cannot certify exactly-once physical-turn
  compliance in these four cases. High provider timing has 127 samples for
  128 invocations because the network-error call has no provider metric; wall
  time has all 128. Wall p50/p95: low 9,312/31,388 ms; high 15,387/48,434 ms.
- High strategy audit is complete with no saved-state or grade mismatch,
  but confirms 44/48 completed strategic trials and the four failure cascades.
  Both audit slices are retained beside the final report. Final verdict remains
  reject promotion; the goal continues with failure-path repair and broader
  guidance experiments, not a claim that high effort improved the player.

## 2026-09-03 — Fail-fast harness and conditional plan-value experiment

- Previous goal turn: progress. It established a fully replayed low baseline,
  rejected high effort on completeness, and exposed a reproducible failure
  cascade. Current change classes remain separate: harness repair first,
  then an isolated player-guidance experiment. No rubric or case edits.
- Real OpenRouter SDK calls to unavailable local port zero, with a synthetic
  local-only key, reproduced two candidate invocations after one transport
  failure. A broken opponent script also invoked the candidate after rejected
  actions. No mocked model or HTTP responses, live provider billing, or user
  credentials were used in these tests. After red, exported the case executor
  and added fail-fast breaks after unsuccessful decisions/rejected opponent
  actions. Error recording precedes exit. Harness version advances to v3;
  game runtime remains v4, suite v8 and scope v2. All 2,965 tests passed,
  19 skipped, 10,802 assertions; typecheck passed.
- Five generalized candidate improvements considered: (1) conditional
  whole-plan valuation through the next own turn; (2) a retained-versus-stale
  public-evidence ledger; (3) broader alternative-contract tool suggestions to
  reduce first-candidate anchoring; (4) explicit opponent-reply checking before
  board changes; (5) a larger high-effort output allowance, contingent on actual
  stop-reason evidence rather than assuming truncation. Select (1) at low
  effort: a short decision-method addendum, not a scenario-specific tactic or
  another rigid priority ranking. The earlier complete-plan-ranking-v1
  experiment was rejected and is not being reused.
- Red-first prompt isolation test requires the new addendum only inside
  player guidance, with house rules, tool protocol and organization unchanged.
  It also rejects fixture IDs, suit choices and oracle counts in the text.
  Quality remains an empirical whole-suite question; string tests do not
  establish strategic merit. No production promotion at this stage.
- Independent review approved the fail-fast patch and found no blocker to the
  isolated guidance experiment. The existing initial-meld rule discrepancy
  remains excluded rather than silently amended. Both arms explicitly use
  `all-candidate-decisions`, including dedicated May I calls and responses.
- Fresh protocol and source freeze:
  `.data/ai-evals/conditional-plan-v1-h3-comparison-20260903/plan.json`;
  110 files, SHA-256
  `eba60aaacc2dae5baa0a3ce945f8b4f4a3d3ead6e05b7fb9851a672bc485019e`.
  Two arms run concurrently with four trials each (eight maximum total),
  four repetitions per case, no cap/pacing and no holdout model calls. Timing
  belongs to this shared-load protocol, not previous single-arm runs. Fresh
  control ID: `spark-low-v8-h3-control-20260903`; experiment ID:
  `spark-low-v8-h3-conditional-plan-v1-20260903`. Only guidance differs.
- Both original arms were interrupted by an existing OpenRouter key's $1
  total limit. Their 84-record artifacts remain intact but are not rankable;
  failed requests have missing usage/timing, not genuinely free instant turns.
  Fail-fast handling preserved the original denials without opponent-error
  cascades. Removed only the eval key's credit limit through computer use,
  honoring the user's explicit no-Spark-cost-caps instruction. API readback
  confirms null limit and $1.006239144 prior total usage. No key rotation,
  credit purchase or other setting changes.
- Full fresh restart is preregistered in `restart-protocol.json` beside the
  original protocol. Both new run IDs insert `-uncapped` before the date.
  All 110 source files still match the freeze. Same 21 cases, four repetitions,
  two concurrent four-trial arms and promotion gates; no sample replacement,
  case splicing, holdout calls, rule changes or production promotion.

### Uncapped result and next experiment

- Both fresh arms finished all 84 records. Before any subsequent code edits,
  all 110 source hashes and all 84 paired initial public observations matched.
  Three independent Codex judge slices replayed all 168 records. Saved states,
  actions and rubric scores matched; the accounting defect below is retained
  explicitly rather than hidden by an adjusted aggregate.
- Control: strategy 43.75%, robustness 86.1111%, 84/84 completed/legal;
  provider p50/p95 8,253/20,277 ms; recorded token cost $0.084498904.
  Conditional guidance: strategy diagnostic 51.0417%, robustness 86.1111%,
  recorded 82/84 complete, all legal; provider p50/p95 10,073/29,164 ms;
  recorded cost $0.086416898. Costs are reconstructed usage, not invoices.
- All strategic movement is in contested-run planning: 31.25% to 53.125%.
  Other families are unchanged. Five overall paired rubric gains, two losses,
  77 ties. The wild contested-run regression breaks a completed set and cannot
  convert the later Joker. A higher mean does not establish general skill.
- **No promotion.** Safe-horizon wild repetition 2 genuinely stops after
  organization without completing the turn; h3 avoids the prior cascade.
  The provider stop's cause is unproven. Separately, priority-claim repetition
  3 legally allows but the fixture omits the next opponent response. Its
  tactical zero is valid; the provider/noncompletion attribution and extra
  model/organization/wall slot are false. Actual experiment organization is
  106/106 opportunities; raw 106/107 includes that nonexistent ordinary turn.
- Current comparison/report and independent audits are retained under
  `.data/ai-evals/conditional-plan-v1-h3-comparison-20260903/`. The earlier
  capped runs remain invalid and intact. No holdout provider calls, production
  changes or deployment occurred.
- After the source freeze was released, four red real-engine tests reproduced
  the missing allow branch across all permutations. Added only the opponent's
  allow-only continuation; existing runner behavior skips it after a claim
  and stops at round end after an allow. Root and rubric remain identical.
  Suite advances to `short-rollout-v9`; runtime v4/harness v3 are unchanged.
  Independent review approved both paths. Full local suite: 2,970 passed,
  19 skipped, zero failed, 10,843 assertions; typecheck and diff check pass.
- Drew proposed a private two-line per-hand strategy scratchpad during this
  run. The next isolated experiment is specified in
  `docs/ai-player-scratchpad-experiment.md`: empty per-trial memory, retain
  revisable intent across turns, clear on hand change, no public disclosure,
  no rule changes, and no aborted-note commitment. It is **not implemented or
  enabled yet**. Do not bundle this unpromoted addendum into that experiment
  by default. Next goal turn: TDD the opt-in memory capability and compare
  fresh v9 controls against it over the entire eligible development suite.

## Private per-hand scratchpad v1 (2026-09-03)

- Change class: opt-in player capability plus its necessary evaluation wiring,
  not a house-rule, rubric, scenario or default-player change. Candidate ideas
  considered: private intent continuity (user-selected); explicit alternative
  contract comparison; a public-evidence opponent ledger; opponent-reply checks;
  provider completion reliability instrumentation. Implement only the first.
- Notes are one or two lines, at most 400 characters, supplied on the existing
  discard tool. Stage after a successful action, commit after a completed model
  invocation, read on later ordinary and May I decisions, reset each hand and
  trial. Disabled tools and baseline prompt remain unchanged; no app wiring.
- Red-first tests cover memory lifecycle, stale/aborted writes, private/public
  separation, schema gating, guidance isolation and real local transport
  failures. Independent review found terminal/error traces used an old board;
  a real-engine failing test reproduced it, then latest-state finalization
  fixed expiry without hiding the original provider error.
- Harness v4 identifies optional private context/traces; suite v9, runtime v4,
  public observation version, scoring and active case eligibility are unchanged.
  A fresh full-suite comparison will use Spark-low, four repetitions per case,
  all candidate decisions, no caps or pacing, no conditional-plan addendum and
  no holdout provider calls. No promotion based solely on added unit tests.

### Paired scratchpad result

- Protocol/artifacts:
  `.data/ai-evals/hand-scratchpad-v1-h4-comparison-20260903/`. Frozen 112-file
  SHA-256 `4fa028c8f9b8adaef3965f3da60b99cf124e78b8a31b91fad2d2ac90e442c456`.
  All source hashes and all 84 paired initial public observations match.
- Fresh control: strategy 51.0417%, robustness 88.8889%, 84/84 completed and
  legal. Scratchpad: strategy 46.875%, robustness 83.3333%, 83/84 completed,
  84/84 legal. Three paired score gains, seven losses, 74 ties. All strategic
  movement is contested-run planning, 53.125% → 40.625%; other family means
  do not change. These are rubric scores, not win-rate estimates.
- Control provider decision p50/p95 8,777/23,365 ms and recorded cost
  $0.07897751; scratchpad 8,803/26,219 ms and $0.087695994. Ordinary-turn
  p50/p95 are 9,722/21,442 ms and 9,431/26,219 ms respectively. Both arms
  share the declared concurrent load and exclude presentation pacing.
- All 127 scratchpad traces checked: 90 proposals, 74 commits, 35 later reads,
  longest note 202 characters, no chain/private-input/control-contamination or
  final-public-snapshot leakage error. Notes accompanying terminal wins expire.
  Independent robustness audit replays 72 records and verifies live model
  discard-note → commit → next own input → terminal expiry in all four future
  layoff cases; gameplay in those cases is identical between arms.
- **Do not promote.** The two robustness regressions and the one unfinished
  safe-wild turn occur with empty prior memory. The latter stops after two
  provider steps and only organization; no proposal commits, no fake later
  decisions are appended. Preserve all failures, without replacing samples or
  asserting an unproven provider-stop cause. This is evidence about the full
  capability-plus-guidance experiment, not causal proof that recall harms play.
- Local validation: 2,986 tests passed, 19 skipped, zero failures; typecheck and
  diff check pass. Three independent reviewer slices replayed all 168 records
  with no state, grade, completion or memory-lifecycle mismatch. Some notes
  contain impossible targets or stale card/count assumptions; those defects
  are distinguished from observed game outcomes and do not prove causal harm.
  Keep the capability opt-in/process-local; app persistence/defaults, Luna,
  human pacing, house rules, commits and deployment remain untouched.
- Next evaluation-design consideration: many decisive choices precede the
  first note, and shared-run trials end before a note can be read. Longer
  reachable sequences with new evidence and real continuation/pivot choices
  should be a separate suite iteration, not fixture-specific prompt tuning or
  a retrospective excuse to change these scores.

## Contract alternatives experiment (2026-09-04, preparation)

- Previous goal turn: progress. The opt-in scratchpad was implemented and
  all 168 paired records independently replayed; no promotion. The next change
  is a player-visible derived-assistance experiment, not a rule, rubric or
  scenario change. Scratchpad and unpromoted prompt addenda stay disabled.
- Five candidates considered: (1) present distinct contract alternatives and
  their residual hands instead of a single imperative hint; (2) require tool
  use while a turn is unfinished, addressing observed early stops; (3) expose
  a retained public-card ledger for opponent tracking; (4) a generic opponent
  reply checklist; (5) longer reachable continuity/pivot evaluation sequences.
  Select (1): the current renderer says CALL lay_down for its first result,
  and every safe-horizon failure follows that result. This is a testable
  anchoring hypothesis, not proof about the model's private reasoning.
- The opt-in treatment will show up to three engine-validated options with
  distinct residual card faces, numbered meld positions, leftover cards, and
  individually available future public-table layoff targets. Enumeration
  order is not strategic ranking; targets are conditional on reaching a later
  turn and the table still permitting them. Do not pick a winning fixture move
  for the model, inspect hidden cards, or change the public history or rules.
- Preserve baseline rendering/defaults, including Luna. Run fresh Spark-low
  controls against the treatment over the full eligible development suite,
  four repetitions each, fixed rules/rubrics/effort, no caps or pacing, no
  holdout calls. Verify all shown positional contracts against the real engine
  before freezing sources. Keep the existing initial-meld rule discrepancy
  outside the active rule-independent suite; this is not blanket promotion of
  engine legality into house-rule authority.

### Contract-options paired result

- Implemented and red-first tested the opt-in `contract-options` view. Up to
  three candidates are deduplicated by residual rank/suit multiset before the
  limit, with multiplicity retained. Default rendering remains byte-identical
  across all 84 reconstructed previous control roots; system guidance, tool
  schemas, house rules and engine candidate ranking are unchanged. Both initial
  and tool-result views honor the option. Harness v5 records its selection.
- Frozen protocol and reports:
  `.data/ai-evals/contract-options-v1-h5-comparison-20260904/`.
  All 113 source hashes match SHA-256
  `0d4309bdf3688137499f9490d1eac2f6f64e087f26cd20a9099199dd619f5a7d`.
  Fresh 21-case × 4-repetition arms, concurrency four each, no caps/pacing,
  memory, prompt addenda or holdout calls; identical model/system/rubric facts.
- Strategy 52.0833% → 61.4583%; robustness 86.1111% → 86.1111%; both arms
  complete/legal 84/84. Twelve paired score gains, eight losses, 64 ties.
  Contract horizon 33.3333% → 83.3333%; contested runs 56.25% → 46.875%;
  Hand 6 draw coverage stays 100%, shared-run timing stays 33.3333%.
- Eight safe-horizon trials now choose sevens and preserve future nines, then
  go out. Two urgent known-exit trials also choose sevens and retain 37 rather
  than 31 points. All twelve horizon cases offer two residual options; ten
  treatment selections use option two. The other observed contracts show only
  one option, so this is not evidence of three-way strategic comparison.
- Contested first-choice differences and the two robustness differences occur
  before any changed options content. Do not attribute those stochastic
  differences to a view the player had not seen. Shared-run inputs/actions are
  identical; its failures remain. Derived assistance changed, not the rules,
  rubric, raw evidence, reasoning effort or system guidance.
- Ordinary-turn provider p50/p95 7,827/19,608 → 8,796/20,309 ms. All-decision
  provider p50/p95 7,559/19,513 → 8,609/20,309 ms. Recorded cost for 84 cases
  $0.065399202 → $0.067989948. All 128 provider samples exist per arm;
  presentation delay is excluded and the shared concurrency is declared.
- **Review only; do not promote.** Scenario-clustered descriptive 95% delta
  interval is −22.60 to +41.35 points, and the twelve strategic scenarios are
  only four correlated families. A higher mean does not erase urgent-case
  regressions. Replicate the unchanged full-suite pair before finalist review;
  do not tailor wording to these cases or consume holdouts during tuning.
- Three independent judges replayed and regraded all 168 records, zero
  mismatches. Root separately reconstructed initial views and finals. All
  40 robustness option occurrences were accepted on cloned real-engine states.
  Intermediate tool-return views were reconstructed from frozen tool execution,
  not separately captured provider response bodies.
- Raw organization 107/108 versus 108/108 includes one control terminal draw
  before organization was possible. Actual opportunity compliance is 107/107
  versus 108/108; no behavioral organization gain is claimed. Track the
  denominator correction as a separate harness-only TDD iteration.
- Local validation: 2,991 passed, 19 skipped, zero failed, 10,954 assertions;
  typecheck/diff check pass. Source freeze released after complete audits.
  No app defaults, Luna, human pacing, rules, commits or deployment changed.

## Contract-options unchanged replication (2026-09-04)

- Previous goal turn: progress; completed a full paired experiment and all
  independent replays. This is an evidence replication, not a new product,
  prompt, rule, rubric, harness or scenario change. The same 113-file source
  freeze is revalidated before calls; organization denominator correction is
  deliberately deferred so it cannot complicate this replication.
- Protocol: `.data/ai-evals/contract-options-v1-h5-replication-20260904/plan.json`.
  Fresh control and options runs each contain all 21 eligible development cases
  four times, Spark-low, concurrency four per arm, no caps/pacing, no notes,
  no addendum and no holdout calls. Save failures without replacement. Report
  this new pair separately and combine equally with the prior complete pair;
  never select the best repetitions. No promotion from an isolated mean gain.

### Replication outcome and OverGrid research

- Live runs completed: control strategy54.1667%, options55.2083%; robustness
  83.3333% each. Control83/84 completed and84/84 legal; options84/84 both.
  Control `contract-horizon-known-exit:3` stops after two provider steps with
  only organization. Preserve its score0, warning and unfinished state; do not
  replace it or interpret this as a clean strength comparison.
- All eight safe-horizon options trials again succeed. All four urgent-exit
  options trials choose sevens and retain37 instead of31 points. The three
  completed urgent controls retain31; the fourth is the unfinished turn above.
  Contested family68.75%→40.625%; those first choices precede changed content.
  Hand6 coverage stays100%; shared-run timing stays33.3333%.
- Ordinary-turn provider p50/p95:8,515/21,477→8,474/17,514ms. Cost per84 cases:
  $0.062642704→$0.076088254. All128 provider samples per arm are present. No
  additional configurations, prompts, notes, rules or provider settings changed.
- Equally pooling both complete *run artifacts*, without dropping failed
  trials: strategy53.125%→58.3333%, robustness84.7222% each. Control167/168
  completed, treatment168/168; both168/168 legal. Descriptive scenario-clustered
  95% delta interval−26.28 to+36.70pp; four correlated families. No new hand
  permutations are implied: each original root/order has two samples.
  Across168 pairs:22 gains,18 losses,128 ties. All84 initial views per arm
  match across runs. Data and per-case results are in `combined.json`.
- **Do not promote.** The original large whole-suite gain did not replicate
  at comparable magnitude; urgent-case regressions repeat. Raw organization
  shortfalls are again terminal draws without opportunity, not missed actions.
  Leave this metric correction for a separate harness-only TDD change.
- Drew requested Sol to read the OverGrid blog sequentially. A dedicated Sol
  subagent read all23 posts: numbered00–18, then four player guides, following
  the site's sequence rather than nonmonotonic dates. Research-only memo:
  `.data/ai-evals/overgrid-research-20260904.md`. Parent verified original
  candidate-supply and selective-reply articles. No blog-inspired code changes
  or extra provider experiments were bundled into this replication.
- Seven prospective ideas: selective public opponent-opportunity check;
  contract-option order counterbalance; factual public-retention ledger;
  consequence-diverse complete actions; observable ambiguity-triggered effort;
  revisable scratchpad on longer reachable sequences; real-play-derived new
  strategic families. Highest-leverage next player hypothesis is the narrow
  public-opportunity check. Parent refinement: account for threats already
  present as well as opportunities newly enabled before the next own turn.
  Keep it player guidance, not house rules, with the full suite and immediate
  win/opposite-policy controls. Order counterbalance remains a useful separate
  mechanism diagnostic; do not bundle the seven proposals into one change.
- Independent audits now cover all168 new records with zero replay/current-
  grade mismatches; all113 frozen sources match. However, the audit surfaced a
  legality measurement blind spot: treatment `contested-run-diamonds-natural:1`
  calls `lay_down` with `[[4,9,11],[5,10,12],[1,2,3]]`. Its three-card run is
  rejected before reaching the engine and the player later recovers. Current
  `legal:true` and empty warnings describe engine attempts, not all requests.
  Preserve the raw historical score but explicitly qualify the metric.
- Next goal turn should TDD complete tool-request outcome capture and correct
  organization opportunity accounting as a separate harness iteration before
  any new player experiment. This is measurement repair, not strategy gain.
  No source/model changes occurred in this replication; focused opt-in tests
  passed5/5, diff check passed. Source freeze released after the final audit.

## Tool-request capture and organization opportunities (2026-09-04)

- Previous turn: progress; replicated the unchanged options experiment and
  completed Sol's23-post research. This turn is **harness measurement repair**,
  not a player, rule, rubric or scenario improvement.
- TDD first: missing request artifacts and new opportunity tests failed before
  implementation. The real rejected three-card-run request remains captured
  even after successful recovery. New optional SDK observer tracks normalized
  requests at model response, actual tool outcomes, and step completion; it
  preserves rejection/error details and leaves absent results unresolved.
  Both ordinary and dedicated May I execution are wired; app callers leave the
  observer unset. Request health and warnings are separate from engine legality
  and the unchanged strategic score. Invalid requests block promotion review.
- Organization denominator follows actual ordinary-turn tool availability.
  Terminal required draws without opportunity are excluded; provider stopping
  in a live post-draw state and genuinely skipped sorting still count as misses.
  Wrong/rejected reorders earn no credit. The terminal-draw strategic loss stays0.
  This measures correct-sort occurrence, not strict timing/exactly-once behavior.
- Harness `short-rollout-harness-v6`, case schema5, summary/manifest schema6.
  Suitev9, runtimev4, scopev2, public observationv1 unchanged. Historical raw
  artifacts and scores are not rewritten. Plan/reproductions/audits/report:
  `.data/ai-evals/h6-measurement-20260904/`.
- Fresh default-player run
  `spark-low-v9-h6-measurement-baseline-20260904`: all21 eligible development
  cases x4, Spark-low, concurrency4, no cost cap/pacing, addendum, notes or
  experimental menu. No holdouts consumed or failed samples replaced.
  Strategy48.9583%; robustness86.1111%. All84 completed and engine-legal;
  all379 observed requests succeeded. Organization107/107 opportunities across
  108 ordinary invocations. This baseline is not a claimed strength delta.
- Ordinary-turn provider p50/p95:8,180/17,417ms. All128 model-decision
  provider p50/p95:7,576/17,225ms; recorded total cost$0.07624584. Prior pairs
  used8 maximum concurrent trials versus this run's4; do not attribute historical
  timing differences to the observer. Strategic score is not a game win rate.
- Root replay plus three independent judges cover all84 records,128 input views,
  379 complete captured tool outputs,647 engine attempts and final states/grades;
  zero mismatches. All84 initial views byte-identical to the prior control.
  Source freeze matches115 unique paths (116 entries; duplicated bun.lock).
  Live records contain only succeeded requests: rejection/schema/unknown-tool
  paths have separate real-tool/local-SDK evidence, not live failure evidence.
  Live abort timing and a separate raw HTTP capture remain unverified.
- Validation:381 AI tests passed,19 skipped,0failed,3,425 assertions;35 relevant
  PartyServer tests passed,72 assertions. Typecheck/diff check passed. No player
  guidance, house rules, engine, Luna, provider settings, app defaults or human
  pacing changed; no commit/deployment. Freeze released after the complete audit.
- Next player experiment remains a short public opponent-opportunity check:
  account for existing threats and opportunities a move enables before the next
  own turn. Hold other player capabilities fixed within a full-suite pair; no
  fixture-specific instructions. Contract-options and scratchpad remain unpromoted.

## Public-opportunity guidance experiment (2026-09-04)

- Previous goal turn: progress; repaired measurement and independently audited
  a full baseline. This iteration is one **player-guidance experiment**, not a
  harness, rubric, scenario, rule, tool or provider change. Seven generalized
  candidate ideas from Sol's sequential OverGrid reading were considered; chose
  a 174-word public-opportunity check accounting for existing threats and what
  a move enables before the next own turn. No fixture answers or extra memory.
- TDD: new test first failed because the prompt file did not exist. After the
  addendum, 21 focused tests passed, 97 assertions. Typecheck then found one
  test-only missing explicit `experiment: undefined` property. Provider runs
  were mistakenly dispatched before that result was read. Preserve this lapse:
  preflight was not green. Freeze held through runs/audits; the harmless test
  setup correction was deferred until afterward, not hidden by rewriting hashes.
- Fresh control/treatment each ran all21 eligible development cases x4, Spark-low,
  concurrency4 per arm, no cap/pacing, no notes, default tactical presentation,
  all-candidate-decision prompt scope. No holdout calls or sample replacement.
  Plan/results/audits: `.data/ai-evals/public-opportunity-v1-h6-comparison-20260904/`.
- Strategy45.8333%→46.875%; robustness87.2222%→86.1111%. Across84 paired
  trials:3 gains,3 losses,78 ties. The12 strategic cases remain only4 correlated
  families; descriptive scenario-mean95% delta interval−7.56 to+9.65pp. These
  rubric scores are not game win rates. Hand6 coverage100% both, contract-horizon
  and shared-run families33.3333% both, contested37.5%→40.625%.
- **Reject; do not promote.** Treatment adds an immediate-exhaustion call in
  repetition4 (100→75 case mean), while layoff sequencing improves85→100.
  Safe-horizon contract choices and shared-run delay cases remain0 in both arms.
  Contested natural-diamonds0→25 and stronger-diamonds75→100 improve, but
  wild-diamonds50→37.5 and spades25→0 regress. Immediate-win controls survive.
  Do not revise wording around these individual cases or consume holdouts.
- Both arms complete84/84. Engine legality83/84→84/84; requests383/384→384/384.
  Control safe-wild repetition4 tries7-clubs on a club run already containing7;
  real engine rejects it and the player recovers. Capture/warning are correct,
  unlike the historical pre-engine blind spot. Its strategy criterion fails
  independently of legality. Treatment has no unhealthy captured requests.
- Organization108/108 opportunities in both arms. Independent judges also
  verify exactly-once/immediate ordering here; the general metric is weaker
  occurrence compliance. The old Hand1 layoff fixture's suit setting differs
  from prompt rank; all8 calls use rank and both sorts yield identical order.
- Ordinary-turn provider p50/p95 (108 samples):8,831/24,095→9,932/25,694ms.
  All-decision provider p50/p95 (128 samples):8,387/22,353→9,791/25,689ms.
  Cost$0.07487906→$0.086268422, +15.21%. Pacing excluded and concurrency matched;
  sampled timing differences are not proof of a general prompt latency effect.
- Root and three independent judges replay all168 records:256 public inputs,
  768 exact tool outputs/statuses,1,307 engine attempts, all finals and grades;
  zero mismatch. All84 initial views match; manifests differ only run/prompt.
  All117 frozen source hashes match through final audit. Normalized request
  reconciliation is not independent raw transport capture. No rule discrepancy
  resolved and no quarantined case reactivated.
- Freeze released only after all audits. The sole post-freeze source correction
  supplies the missing property in the prompt test; separate validation retains
  its original/new hashes and confirms every other frozen source is unchanged.
  Focused tests pass21/21 with97 assertions; typecheck and diff check pass.
  No app/default change, Luna run, human-pacing change, commit or deployment.
- Next separate hypothesis: counterbalance the identical opt-in contract option
  set to distinguish semantic choice from display-slot attraction. This is a
  mechanism diagnostic, not a presumed improvement; keep urgent-exit controls
  and the full suite. Broader real-play-derived independent families remain
  necessary before claims of general strength. Do not treat this negative prompt
  result as proof of the cause of the player's decisions.

## Contract-option order diagnostic (2026-09-04)

- Previous goal turn: progress; audited and rejected public-opportunity guidance.
  Chose one of six generalized ideas: reverse the identical bounded contract menu
  after admission, preserving facts, exact actions and all other observation text.
  This is opt-in presentation diagnostics, not house rules or player guidance.
  No change to defaults, candidate generation, prompt, rubric, scenarios or tools.
- TDD: three initial failing tests; then59 focused tests/188 assertions pass.
  Typecheck passed and was read before dispatch. Added only the explicit
  `contract-options-reversed` mode, renderer wiring and CLI parsing. Same default
  prompt hash as before; all84 default initial observations unchanged.
- Fresh original/reversed runs each cover all21 eligible development cases x4,
  Spark-low, concurrency4 per arm (eight maximum together), no cap/pacing,
  addendum or notes. No holdouts or sample replacement. Evidence:
  `.data/ai-evals/contract-order-reversal-h6-comparison-20260904/`.
- **Diagnostic only; no promotion.** Only12 paired trials ever see reordered
  alternatives: three horizon cases with two options. Eleven preserve semantic
  selection despite slot changes. Known-exit repetition2 stays in slot1 but
  changes nines to sevens; retained penalty31→37, frozen score100→0. One switch
  does not distinguish an ordering effect from stochastic selection. No observed
  three-option choices; reversal is not full permutation counterbalancing.
- Other72 pairs have no changed observation at any point. Twelve of13 paired
  score changes occur here. All nine contested score changes begin with different
  root discards under identical input. Do not attribute these to option ordering.
- Strategy67.7083%→59.375%; robustness82.5%→83.3333%;5 gains,8 losses,71 ties.
  Hand6 coverage100% both; safe horizons100% both; known-exit25%→0%; shared
  delays0% both; immediate-win controls100% both. Contested71.875%→53.125%.
  Descriptive scenario-mean delta interval−16.15 to−0.51pp is not causal evidence:
  most variation lacks intervention exposure and12 cases are only4 correlated
  families. Scores are conditional short-rollout rubrics, not game win rates.
- Both84/84 completed and engine-legal. Requests404/405→402/402. Original
  stronger-diamonds repetition2 emits discard({}) missing position; actual schema
  rejects before execution, no engine attempt/output; next request recovers.
  Keep this request-health failure even though score100 and completion survive.
  Organization107/107 opportunities both; independent strict checks also pass.
  One terminal draw each arm never offers organization. Preserve-future-layoff's
  original70 versus reversed100 rewards a route preference; both paths go out.
- Ordinary-turn provider p50/p95 (108):8,475/17,421→8,350/14,987ms; ordinary
  wall8,486/17,441→8,360/15,002ms. All128 decisions provider8,164/17,421→
  8,117/15,770ms; wall8,175/17,441→8,129/15,786ms. Recorded cost$0.069794114→
  $0.078229026 (+12.09%). Pacing excluded; not a general latency/cost estimate.
- Root plus three independent judges audit all168 records,256 model input views,
  807 request schemas,806 real outputs/statuses,1,345 engine attempts, final
  states and grades; zero mismatches. Root checks1,062 presentation pairs. All118
  source hashes held through audits; manifests differ only run/presentation.
  Freeze released afterward. No rule discrepancy resolved, quarantined case
  restored, Luna run, app/default/pacing change, commit or deployment.
- User's reasoning-continuity question: Meta's official Muse Spark1.3 cookbook
  documents native Responses previous_response_id and stateless encrypted-item
  replay with store:false. Current Muse path is OpenRouter Chat with reasoning
  excluded and fresh context each game turn; Luna alone chains responses.
  OpenRouter Muse Contributor pass-through is not yet verified. No migration or
  credential change made. Next capability check can establish feasibility before
  a separate per-player/per-hand continuity experiment; same prompt/effort, public
  inputs only, reset at hand boundary, whole suite x4. Independent real-play
  strategic families remain needed before broad strength claims.

## Muse reasoning continuity and within-turn replay (2026-09-04)

- Previous goal turn: progress; audited option-order diagnostic and documented
  native Meta continuity. Now verified OpenRouter Contributor encrypted reasoning
  on raw chat/tool calls and exact AI SDK within-decision/caller-managed follow-up
  replay. Existing account/key suffices; no native Meta signup or credential change.
  Capability evidence: `.data/ai-evals/muse-continuity-feasibility-20260904/`.
- Found provider3.0.0 silently discarding unrecognized `meta-responses-v1` on
  parsing/serialization; upstream main also lacked it. Minimal reproducible Bun
  patch adds that enum member in public/internal runtime and declarations only
  (four additions). `patchedDependencies`/lockfile preserve it. No payload editing.
  App default remains minimal effort with reasoning excluded.
- TDD: real installed serializer failed before patch; profile, effective-config
  fingerprint and CLI opt-in tests were red first. 264 offline tests pass,1 skip,
  3063 assertions; final live SDK1 pass/8 assertions. Typecheck and frozen-lockfile
  installation passed and were read before dispatch. Probe setup corrections
  (environment loading, unsupported named tool choice, body capture opt-in and
  variable block counts) remain documented, separate from gameplay samples.
- One opt-in player/provider experiment chosen from six generalized ideas:
  `--reasoning-replay within-turn`, preserving emitted reasoning through AI SDK
  tool calls in one decision. Both arms use the patch; only reasoning.exclude
  true→false changes. No per-game-turn memory, scratchpad, menu or prompt change.
  Effective configurations/hashes explicitly record the switch.
- Fresh control/treatment each run all21 eligible development cases x4, Spark-low,
  concurrency4 per arm, no cap/pacing. Same prompt and all84 initial views. No
  holdout calls or failed-sample replacement. Full plan/comparison/audits/report:
  `.data/ai-evals/reasoning-replay-h6-comparison-20260904/`.
- **Do not promote as gameplay improvement.** Strategy50%→46.875% (−3.125pp);
  robustness83.3333%→88.8889%. Five paired gains,four losses,75 ties. Both
  robustness gains start on the first request before reasoning can be replayed.
  Contested natural diamonds25→25,wild50→62.5,spades50→25,stronger-diamonds75→50.
  All other case means tie: safe horizons and shared delays0,Hand6 coverage and
  immediate-win controls100. Delayed-exhaustion diagnostic remains0.
- Twelve strategic cases are four correlated families, not independent games;
  descriptive scenario-mean95% delta interval−10.00 to+3.75pp. Scores are
  conditional rubrics, not win rates. Eight shared/contested pairs first change
  semantic actions after organization; seven change score. Three horizon choices
  differ after tool history without score movement. Timing alone is not causal
  or per-case encrypted-transport proof; no hidden reasoning inspected.
- Both arms complete84/84 and engine-legal84/84. Requests382/383→384/384. Control
  stronger-diamonds rep3 emits discard({}) missing position; actual SDK rejects
  before engine, next valid discard recovers. Preserve the error despite score100.
  Organization107/107→108/108; the excluded swap's terminal draw offered no sort.
  Independent strict first-opportunity/exactly-once checks also pass.
- Ordinary-turn provider p50/p95(108):7,783/20,265→8,057/21,165ms; wall7,795/
  20,274→8,064/21,183ms. All-decision provider(128):7,343/19,397→7,781/19,212ms;
  wall7,358/19,420→7,803/19,226ms. Cost$0.074886244→$0.074068814(−1.09%).
  Input1,452,639→1,447,531; cache-read929,872→934,307; output103,749→104,389,
  including reasoning75,488→76,168. No general timing/cost saving claim.
- Root plus three independent judges cover all168 records,256 public inputs,
  767 request schemas,766 outputs/statuses,1,305 engine attempts, finals and grades;
  zero discrepancies. Root helper's read-time updatedAt false positive was
  corrected only in ignored audit code. All125 source hashes held through final
  audits; freeze released afterward. No rule discrepancy resolved or quarantined
  case reactivated. No Luna run, app/default/pacing change, commit or deployment.
- Next separate hypothesis: per-player/per-hand own-observation/tool/reasoning
  history, reset on hand/game/player/model/prompt changes. Exact cross-call replay
  is transport-proven, but player memory is not implemented or evaluated here.
  Compare whole suites and consider visible-history-only ablation; do not infer
  that replay acceptance implies better strategy. Broader real-play-derived
  independent families remain necessary before general strength claims.
- Post-documentation checks:6 focused tests pass,17 assertions; typecheck exit0
  and diff check pass. All125 frozen source hashes still match.

## Later-decision measurement and v10 rebaseline (2026-09-04)

- Previous goal work: progress. The reasoning transport answer was verified;
  the follow-on measurement audit covers all168 v9 records.63 were sub-perfect,
  but with each first decision fixed, no missing frozen-rubric credit remained
  recoverable on later decisions.88 later model decisions do not by themselves
  establish strategic headroom. Audit evidence/report is in
  `.data/ai-evals/hand-conversation-preflight-20260904/`.
- Chose measurement improvement before implementing player memory, from the six
  generalized directions in the preflight plan. No model/provider/default,
  guidance, house-rule, tool-protocol or human-pacing change. Existing research
  examples are still conditional strategy diagnostics, not full-game win rates.
- Suitev10 extends the same four contested development cases to three own turns
  by moving an existing real earlier turn out of the scripted prelude. No new
  family weight, oracle instructions, fabricated reasoning, forced initial
  discard or reset to the old root. Full development remains21 eligible cases
  (12 strategic in4 correlated families plus9 robustness); holdouts unchanged.
- Harnessv7/case schema6 records candidate-perspective before/after action
  evidence per decision, including rejected engine attempts. The second-turn
  grader uses the actual hand and public cards; shifted stock is handled by
  opponents returning their actual drawn card. Hidden stock and other hands are
  not recorded in this evidence or provided to the grader. Existing public
  activity remains available in all model prompts.
- Conditional positive draw-coverage trajectory and sampled conversion each
  count50. Numeric discard regret is separate: a destroyed route may have
  chosen=best=0 without a new bad discard. A tied-best earlier choice can still
  have no contract on the sampled final draw. Missing opportunity is null, not
  false; an observed unconverted available contract is separately flagged.
- Independent design and implementation judges executed same-first-prefix
  controls (good100 versus0/50/0/0),96 legal first draw/discard branches, hidden
  identity invariance, skipped-ready and already-down boundaries, genuine
  rejected actions and missing-evidence cases. Three review findings addressed
  test-first: positive-route wording/zero regret, nullable missing opportunity,
  and reference/live parity for incomplete quality gating. Earlier organization
  mechanics tests now explicitly use the preserved post-draw fixed-root fixture.
- TDD red results were observed before evidence/episode implementation and each
  review fix. Final independent18 tests/468 assertions, root64 regressions/638
  assertions,13 option/organization/reasoning/scratchpad tests/62 assertions and
  latest five boundary tests/109 assertions pass. Typecheck and diff check pass.
  Reference certificate proves84/84 whole-development references complete/legal/
  full-credit, with129 source hashes unchanged throughout certification.
- Final frozen source hash:
  `18ac00f874ab3d0727fadd1c32efaa7e3f522fcb814cdbf3329ec7040dddf812`.
  Only five previously fingerprinted measurement sources changed; four new
  evidence/episode source and test files are added. Model configuration and
  runtime prompt remain identical to the previous unretained Spark-low control.
  Full plan, reference artifacts and independent review:
  `.data/ai-evals/earlier-entry-v10-20260904/`.
- Fresh unchanged Spark-low baseline dispatched as
  `spark-low-v10-h7-baseline-20260904`: all21 x4, concurrency4, no cap/pacing,
  no scratchpad/menu/reasoning-replay opt-ins, no Luna or holdout calls. Keep
  sources frozen through completion and audit. This is a new measurement
  baseline; never label v9→v10 score movement a gameplay improvement. No player
  promotion, commit or deployment. Results and later-decision headroom audit
  remain pending at this entry; per-hand player history is not implemented.

### v10 baseline audit completion (2026-09-04)

- Original PID19574 is absent; all84 unique rows and final result/summary exist.
  Original process exit code was not retained; no replacement run was dispatched.
- Unchanged Spark-low: strategy52.0833%, robustness83.3333%;54 full-credit,
  two50-point and28 zero-point episodes. No v9-to-v10 player-improvement claim.
  Complete/legal84/84; healthy requests445/445; organization123/123.
-144 model decisions: provider p50/p95 8.712/21.692s, wall8.728/21.716s,
  known provider cost$0.098157604. Human-facing pacing unchanged.
- Root and three independent judges cover all84 records:144 public inputs,
  445 request schemas/outputs,809 engine attempts, per-decision evidence/finals/
  criteria all replay without discrepancies. All129 source hashes match through
  final reconciliation; baseline/evidence hashes sealed and source freeze released.
- All16 contested episodes preserve the same first semantic decision. Seven
  later discards retain14 completing cards versus16 available; an eighth changes
  its second draw and misses the favorable sampled continuation. Independent
  same-first-prefix legal controls reach100 in all eight. The latter is sampled
  opportunity cost, not a global draw-choice proof. No actual final-turn ready
  contract was missed. This now supports testing later-decision interventions.
- Full public history still exists in every observation; memory is neither
  proved necessary nor proved beneficial. New report and source/evidence seal:
  `.data/ai-evals/earlier-entry-v10-20260904/`. Keep broad strategy claims limited
  to these four correlated families; more independent real-play evidence is needed.
- Separate per-hand conversation experiment design independently reviewed:
  ownership/in-flight safety, fresh abort/pass/hand checks, exact configuration
  identity, actual player transport linkage, and predefined attribution gates are
  required before dispatch. No new player-memory comparison or promotion yet.

### Per-hand conversation boundary, not yet player integration (2026-09-04)

- Chosen generalized intervention from six alternatives: preserve the player's
  own complete conversation during a hand. This is a player-context capability,
  not an authoritative-rule, strategy-prompt, rubric or scenario change. The
  later-decision evidence above justifies testing it, not claiming it works.
- Added only `ai/mayIAgent.conversation.ts` and its colocated test. Immutable
  game/player/incarnation ownership, one in-flight ticket, exact defensive
  observation/response-message copies, hand/configuration/prompt resets and
  complete ordered tool-call/result linkage. Counts-only traces expose no
  encrypted payload. Recovered failed tool results remain in completed history;
  incomplete/aborted/stale decisions do not append. A hand-ending success resets
  memory. Both active turn and May I resolution phases are supported.
- TDD RED: missing module before implementation. Independent reviewer reproduced
  two additional defects; permanent tests first failed, then fixes passed:
  structurally wider owner objects caused a trim TypeError, and unresolved tool
  calls could cross into a new assistant message. Final independent review found
  no remaining boundary blocker. This is not an API/transport validation claim.
- Root final24 boundary tests/59 assertions pass. Combined conversation,
  scratchpad, existing reasoning replay and Luna lineage regression:44 tests,
  125 assertions pass. Full typecheck and diff check pass. The nine sealed
  baseline artifacts and all129 earlier source fingerprints still match; these
  two new files are not imported by any player/API/runner and change no defaults.
- `.data/ai-evals/hand-conversation-v1-20260904/` contains plan, independent design
  review and boundary review. Before dispatch: integrate both execution APIs with
  fresh state/late-abort/May I pass checks; reject Luna mixing; capture exact
  observation/history hashes; verify real serialized per-assistant reasoning
  attachment and terminal tool results across changed tool sets; then freeze a
  fresh whole-suite retained-control versus per-hand-treatment comparison.
- Development advancement thresholds are fixed before results: strategy+5pp,
  robustness drop at most2pp, no strategic-family drop over10pp, complete/legal
  and organization100%, request success at least99.5% and within0.5pp of control,
  zero unresolved requests. A pass requires fresh replication and broader
  evaluation before promotion. One full conversation combines visible and
  encrypted context; no reasoning-only causal claim without an ablation.
- No new model calls, account changes, Luna use, cost cap, pacing change, staging,
  commit or deployment in this boundary step. Full goal remains active; the
  player does not yet carry this history between game turns.

## Per-hand player context integration and transport proof (2026-09-04)

- Previous answer verified provider capability but made no player progress; this
  goal turn integrates the tested boundary into executeTurn and May I decisions.
  It remains opt-in, Spark-only, with immutable per-trial lineage, exact current
  observation/message hashes, fresh snapshots and no raw encrypted artifacts.
  Same completion validation applies to fresh and retained-history controls.
- TDD: missing helper was RED, then11 tests passed. Six actual closed-local-port
  API failure tests were RED, then passed after integration. Independent review
  found async caller mutation could desynchronize hash and committed messages;
  a permanent RED regression preceded defensive-copy repair. A second RED
  regression proved completion-validation asymmetry on missing tool results;
  both arms now use the same validator. No model or transport mocks.
- Runner fresh/per-hand flags require within-turn reasoning retention and reject
  scratchpad/menu/prompt mixing. New sessions are created per case/repetition.
  Harness8/schema7 records actual API context and missing input/output usage;
  timing-only metrics are not usage. Suite/rubric remainsv10. Four runner tests
  were RED before implementation; timing-only coverage got its own RED test.
- One preexisting scratchpad test depended on the old post-draw v9 root. v10
  starts earlier, so its setup now performs a real stock draw before testing
  discard-note privacy. No game rule, strategy prompt or scoring change.
- Root regression:91 tests/422 assertions pass across12 focused files. Full
  typecheck and diff check pass. Independent helper/runner reviews have no open
  findings. Baseline comparison finds125/129 old frozen sources identical; only
  the two player APIs, rollout runner and harness-version source changed.
- Real SDK/player wire proof: ordinary turn -> other player's real discard ->
  May I pass -> next ordinary turn. Latest03:33:39 artifact verifies literal
  first-request body SHA equality, exact catalog temperature/output limit,
  ordered per-assistant encrypted metadata, tool-call/result IDs, terminal
  results exactly once and exact user-observation sequence. Final command:
  2 tests (one offline schema test, one live proof),124 assertions,11.16 seconds.
- Keep setup/certification corrections visible: initial probe incorrectly asked
  the last discarder to May I their own discard; corrected with real opponent
  advance. Earlier03:27 proof hashed a projection that stripped tool definitions;
  RED schema regression preceded full-body hashing. Earlier probes omitted
  catalog defaults despite recording their SHA; explicit wire-setting assertion
  failed before adding the same middleware as the runner. Earlier artifacts
  remain narrower/superseded evidence, not silently upgraded certificates.
- Six additional live API lifecycle cases pass34 assertions: successful
  hand-ending draws remain success, late cancellations do not commit in either
  arm. Two May I cancellation cases were rerun with explicit observed tool-name
  assertions and persisted pass_may_i evidence:2 pass/12 assertions. These small
  test-instruction probes are not strategic-eval samples or gameplay results.
  Failed setup calls can lack usage; recorded cost is not full account spend.
- Artifacts and independent reviews are under
  `.data/ai-evals/hand-conversation-v1-20260904/`. Next: freeze exact sources,
  run21x4 in each fresh/per-hand arm concurrently, then audit all168 records
  under the predeclared advancement gates. No default, human pacing, Luna,
  credential, account, staging, commit or deployment change. Goal stays active.

## Per-hand conversation full-suite outcome (2026-09-04)

- Previous goal turn was a verified wait: the exact comparison parent and both
  children were live. This turn obtains terminal evidence and audits the pair;
  no run was restarted on an observation timeout. Parent session42060 and
  processes50501-50503 terminate with both child exit codes0. Dispatch was
  simultaneous03:40:47.553Z; per-hand ends03:46:51.975Z, fresh03:47:28.978Z.
- Full21 eligible development cases x4 per arm, Spark-low Contributor,
  concurrency4 each, no caps/pacing. Same prompt/settings/tools and within-turn
  reasoning replay in both arms; only per-hand prior own conversation differs.
  All84 paired initial public views match the v10 baseline. No failed samples,
  incomplete runs, new holdout calls or alternative prompts were substituted.
- Strategy53.125%→52.0833% (-1.0417pp), robustness86.1111%→86.1111%. Gate
  requires >=5pp strategy gain, so reject advancement/replication and do not
  promote. Other gates pass:84/84 complete/legal each, strict organization
  123/123 each, requests448/449→447/447, unresolved0. Case means: natural
  diamonds25→50, wild diamonds62.5→62.5, spades50→75, stronger diamonds100→37.5;
  all other means unchanged. Full paired gains/losses/ties6/7/71.
- All286 API observations/context traces validate:168 first decisions have
  empty histories, treatment supplies prior history59 times, fresh never does.
  Exact observation suffixes, configuration/prompt hashes, request counts,
  committed history counts and terminal resets match. Do not treat hashes as
  reconstructed encrypted transcripts; separate real wire proof establishes
  the transport path, not causal gameplay improvement.
- Independent judges cover all168 records in72/48/48 slices. Root replays286
  inputs,896 schemas,895 exact outputs,1,625 engine attempts and all finals and
  grades with zero mismatches. Independent immediate/once-only organization
  totals246/246. The single preserved error is fresh stronger-diamonds rep3,
  third own decision:discard({}) missing position is rejected before the engine
  and a later valid discard recovers. Engine legality is not request legality.
- Horizon/shared-run openings are identical; all safe/delay cases still fail
  before any later repair. Four later contract-branch discards/Joker destinations
  differ without changing score. The shared-run delay cases end before history
  can help. The unchanged one-candidate renderer's imperative contract hint is
  a prospective anchoring hypothesis, not a proven cause.
- Hand6/contested24 pairs:13 identical semantic paths,10 first diverge at
  decision2 after7 retained messages with equal current views,1 differs on the
  empty-history opening. The ten later differences net0 score; diamonds-wild
  rep4's opening100→50 supplies the net strategic loss. The two robustness
  priority divergences also occur at empty openings and offset. This descriptive
  post-stratification does not replace the failed whole-suite gate or establish
  memory causality. Both contested arms have8 positive-regret second discards
  and0 missed available final contracts. Per-hand stronger-diamonds rep2 takes
  a different second draw, then has tied-best14/88 discard coverage and no final
  contract after shifted A-clubs; do not infer best earlier draw from that sample.
- Ordinary123-turn provider p50/p95:7.936/18.675→6.884/18.055s; wall
  7.947/18.692→6.895/18.065s. All143 decisions per arm also include12 May I
  initiations and8 claim/allow responses. Every decision has token usage.
  Known cost$0.080512338→$0.121249042 (+50.60%); not account spend or proof no
  unknown provider-internal retry cost. Equal concurrency does not eliminate
  provider-time confounding. Human-facing pacing is unchanged.
- Audit tooling is artifact-only and test-first: missing-module RED preceded
  each replay/aggregation script. The first Bun command needed explicit./ for
  the ignored.data test path. Replay initially rejected the valid terminal
  status because its check said completed; corrected only the auditor. A RED
  timing-coverage test added separate8-response timing instead of silently
  omitting that decision kind. Replay3 tests/12 assertions and aggregation1
  test/14 assertions pass; root CLI audits pass and diff check passes.
- Evidence:.data/ai-evals/hand-conversation-v1-20260904/{comparison.json,
  report.md,root-replay.json,judge-robustness.json,judge-horizon.json,
  judge-contested.json,final-seal.json}. Source freeze has141 matching files;
  final seal releases it only after cross-checking complete independent reports.
  This turn changes audit artifacts/docs only, not the frozen player.
- Six next candidates considered in neutral-contract-hint-v1-20260904/plan.md:
  neutral example framing; replace rather than append strategic priorities;
  factual disposal-aware public ledger; consequence-diverse turn plans; higher
  effort only with verified stop-budget evidence; new independent real-play
  families. Select neutral framing next without changing the candidate facts,
  rules or guidance. Prospective only: no implementation/dispatch yet. Broader
  strategic coverage remains necessary, not replaced by this narrow experiment.
- No default, rule, rubric, quarantine, Luna, credential/account, staging,
  commit, merge or deployment changes. The full goal remains active.

## Neutral contract-hint first pair (2026-09-04)

- The provider-capability answer made no player progress. This goal turn tests
  the next frozen hypothesis: neutral framing of the existing single legal
  contract example, with identical facts/selection. New opt-in is
  neutral-contract-hint-v1; it does not enable the previous options menu,
  scratchpad, conversation retention or reasoning replay. House rules, player
  guidance, organization policy, tool protocol and model profile stay unchanged.
- TDD: five product tests RED before implementation, then5 pass/165 assertions;
  focused regression85 pass/474 assertions, full typecheck0. Three pre-existing
  source files change: presentation type/version, renderer wording and runner
  option/version metadata. Default fixture hash remains pinned. Preflight judge
  independently sees green, not RED chronology; unavailable-local-endpoint
  tests prove recorded inputs, not provider-wire capture.
- Prior-path checks:84 old trials,809 attempts,2,739 player views and2,708
  hidden-card perturbations, no fact/default-view drift. Freeze143 sources at
  6d98f376ede45596a60c1c2c2826dcba6c260204bb8eb90c97453e93b998e148.
  Both runs use all21 eligible v10 development cases x4, harness8/schema7,
  Spark Contributor low, concurrency4 each, no caps/pacing or failed replacements.
- Parent session99710 and processes65362-65364 reach terminal exit0. Dispatch
  04:16:26Z; neutral ends04:24:25Z, imperative04:25:35Z. Strategy45.8333%→57.2917%
  (+11.4583pp), robustness86.1111% each. Both84/84 complete/legal, immediate
  once-only organization123/123, requests443/443→449/449, no errors/unresolved.
  All numerical gates pass: advance only to replication, not default promotion.
- The gain is entirely contested-run37.5%→71.875%; horizon33.3333%, Hand6 100%,
  shared-run33.3333% each remain unchanged. Case changes: diamonds-natural0→50,
  spades-natural50→75, stronger-diamonds37.5→100; diamonds-wild62.5 unchanged.
  Full pairs7 gains/1 loss/76 ties. The two opposing robustness changes cancel.
- Independent judges cover72/48/48 records; raw row hashes, identities, grades,
  empty issue lists and strict organization246/246 all cross-check. All nine
  contested/Hand6 semantic divergences precede hint exposure on equal inputs;
  no changed-framing benefit is established. All36 available final contracts
  are converted. Imperative stronger-diamonds rep2 draws/re-discards JH with
  tied-best14/88 actual discard coverage but shifts its final stock draw; its50
  is not evidence that the earlier draw was optimal. Horizon openings remain
  the same inferior contract despite exposure. Later differing wild layoffs
  start from equal fresh observations without the hint and do not change scores.
- Root replay168 records,288 inputs,892 exact outputs,1,620 engine attempts,
  892 schemas and1,468 fact checks passes with zero issues. Judge audit notes a
  latent Hand1 fixture organization label says suit while guidance says rank;
  actual requests correctly choose rank and both sorts happen to match. Keep
  this label caveat; do not change the frozen rubric or count model violations.
- Ordinary124-turn provider p50/p95 9.362/32.379→8.754/20.358s; wall
  9.371/32.387→8.763/20.365s. Each arm also has12 May I initiations and8
  claim/allow responses. Known cost$0.091636776→$0.092140464 (+0.55%), combined
  $0.18377724. Per-decision usage completeness is unknown in the unretained
  path, not zero missing; aggregate case usage exists. No account-spend or
  causal latency claim; concurrent provider randomness remains relevant.
- Artifact replay/aggregation tests3 pass/22 assertions; final-seal tests
  3 pass/17 assertions after RED, including explicit normalization of the
  contested judge's independent field names without weakening hash/score/issue
  checks. Report and seal are under
  .data/ai-evals/neutral-contract-hint-v1-20260904/. The final seal releases
  source freeze only after all168 judgments and143 source hashes match.
- Next protocol:neutral-contract-hint-replication-v1-20260904/plan.md. Run one
  fresh unchanged full pair, then report both, not a pooled rescue/best run.
  The old tournament drops card details, truncates history to10 and saves only
  terminal games; after replication, separately TDD/version history parity and
  incremental trajectory evidence before independent real-play family mining.
  No new replication calls are dispatched in this entry.
- No default, human pacing, rules, rubric, quarantine, Luna, account/key,
  staging, commit, merge or deployment changes. The goal remains active.

## Neutral contract-hint unchanged replication (2026-09-04)

- Previous turn was progress: all first-pair audits completed and the exact
  numerical-pass/no-causal-evidence distinction was sealed. This turn runs the
  prospectively selected unchanged replication; no product, harness, rubric,
  scenario, rule, prompt, effort or provider-setting change. Full21 eligible
  v10 development cases x4 per arm, harness8/schema7, Spark-low Contributor,
  concurrency4 each, no caps/pacing, no memory/replay/scratchpad or Luna calls.
- Drew asked not to lose the57.3% candidate. It is preserved in
  .data/ai-evals/neutral-contract-hint-replication-v1-20260904/preserved-candidate.json:
  exact bytes for143 evaluated source/dependency files, model/prompt identities,
  lockfile/provider patch, and original evidence hashes. All bytes and aggregate
  hash verify. No credentials or unrelated workspace content copied; no old
  result overwritten. Preservation is not a claim that57.3% will repeat.
- Before dispatch, preparation rechecks20 sealed original artifacts,143 source
  hashes and84 initial public views. Source aggregate remains
  6d98f376ede45596a60c1c2c2826dcba6c260204bb8eb90c97453e93b998e148. Both live
  manifests match the prior prompt/model hashes,21 selections and all flags.
  Parent session43516/process76759 and children76760/76761 exit0. Simultaneous
  dispatch04:39:55.577Z; neutral ends04:47:53.941Z, control04:48:12.565Z.
  No restart on observation timeout and no sample replacements.
- Strategy51.0417%→51.0417% (0pp); robustness83.3333%→86.1111%. Both complete
  and legal84/84. Requests442/442→444/444, strict organization122/122→123/123,
  no rejected/error/unresolved requests. Strategy gate>=5pp fails; other gates
  pass. Do not pool with the first45.8333%→57.2917% pair to rescue promotion.
  Both complete independent pairs remain visible; no third identical retry.
- All strategic family means tie: contested53.125%, horizon33.3333%,Hand6 100%,
  shared-run33.3333%. Contested case means: natural-diamonds25→37.5,
  wild-diamonds50→62.5, spades50→25, stronger-diamonds87.5→87.5. Full paired
  changes5 gains/3 losses/76 ties. Robustness Joker-swap50→75 supplies its net
  gain; delayed-exhaustion remains0 and the other seven cases100.
- Root replay168 records,288 inputs,886 outputs/schemas,1,614 engine attempts,
  1,462 fact checks and84 paired initial views passes with zero issues. Judges
  independently cover72/48/48 records and cross-check all168 exact row hashes,
  scores and empty audit-issue lists;245/245 strict organization opportunities.
  All143 source hashes unchanged before/after. Horizon judge independently
  executes12 legal alternative paths; contested judge implements a separate
  physical-partition oracle, tested first3 tests/9 assertions.
- All ten contested first semantic divergences and all three score-changing
  robustness divergences precede altered wording with equal current public
  transcripts. Four horizon differences are fresh second-turn choices without
  changed framing, score-neutral. A reserve-case residual discard differs after
  exposure but both score100. None establishes the desired strategic gain.
  Every actual final contract opportunity is converted. Three discard-pickup
  paths shift future stock draws; both stronger-diamonds rep2 episodes lose the
  diamond route in decision1. Keep actual-hand discard optimality distinct from
  earlier draw/route quality, and unavailable contracts from missed conversions.
- Both robustness and horizon reviewers saw prior topline context in the linked
  prospective protocol; neither read prior judge/comparison reports or used them
  for scores. Record this limit, not a claim of full blinding. Next judge packets
  should separate procedural requirements from previous-result context.
- Ordinary124-turn provider p50/p95 8.977/25.437→8.481/20.332s; wall
  8.986/25.447→8.487/20.344s. Each arm also has12 May I initiations and8
  claim/allow responses. Known cost$0.080569034→$0.087148772 (+8.17%); replication
  $0.167717806 and all four runs$0.351495046. Per-decision token completeness
  remains unknown in the unretained path; recorded cost is not an invoice and
  timing is not a causal improvement claim.
- Data/artifact tooling is test-first: preparation/preservation2 tests/24
  assertions; replay/aggregation reuse2 tests/12 assertions reproduce the sealed
  first pair; final-seal1 test/7 assertions checks every independent row and the
  preserved bytes. Product regression5 tests/165 assertions, full typecheck and
  diff check pass. Final seal releases freeze only after completed audits.
- Next decision compares six generalized actions; selects canonical broader
  public-history fidelity, then incremental per-decision evidence separately,
  before new independent real-play families/holdouts. The current tournament's
  lossy post-decision action log needs action-level before/after projection;
  simply passing one decision snapshot would be wrong. Retain censored bounded
  prefixes as incomplete, not game wins/losses; preserve static rule quarantine.
  Scope/TDD plan:broader-measurement-next.md; selection:next-decision.md in the
  replication directory. No measurement implementation is bundled into this run.
- No default, human pacing, rules, rubric, quarantine, account/key, staging,
  commit, merge or deployment change. The full goal remains active.

## Tournament canonical public history (2026-09-04)

- Classification: harness observation/runtime fidelity, not a player or rubric
  improvement. The previous replication remains sealed and unmodified. Drew's
  57.2917% candidate remains saved with exact bytes for143 evaluated files;
  preservation regression verifies its snapshot hash and all20 original
  evidence hashes. Original45.8333→57.2917 and replication51.0417→51.0417
  remain separate; no repeated-gain or default-promotion claim.
- Replaced retrospective action-name-only, last10 history with a game-scoped
  canonical public journal shared by ordinary turns, May I calls/responses and
  fallback ALLOW. Each accepted action uses its own actual before/after state.
  Full current-hand copied history reaches both model APIs. Old-hand terminal
  events remain in the in-memory journal but not next-hand inputs.
- Test-first runtime recovery follows the existing production stale-error
  policy for round-level actions. Bad contract→successful May I no longer
  loses the transfer. Valid already-organized hands succeed; invalid card
  permutations remain rejected. No production engine or player changes.
- Independent clean-context judge found accepted overlapping layoffs lost the
  second public event. Both raw-runtime and real-tool probes failed before the
  fix. Durable RED tests then preceded synchronous snapshot capture immediately
  before the real engine mutation. No parallel-tool provider setting changed.
  Initial and final audits are both retained; independent recheck supports the
  final narrow change with no remaining material issue.
- Versions: duplicate-tournament-v5, public-action-history-v1 and
  game-engine-runtime-v2; composed tournament harness identity includes both.
  Existing comparisons reject mismatched suites/harnesses. No comparison of
  the newly observed tournament against old truncated-history scores is valid.
- Root63 tests/855 assertions pass across12 files, including preservation,
  runtime, journal, public app parity, hidden stock/opponent perturbations,
  terminal/exhaustion cases, invalid reorder/rejection recovery, concurrent
  actions and shared/short-rollout history regressions. Judge independently
  reran62 tests/545 assertions. Full typecheck and diff check pass. Root verifies
  the judge's final3 source hashes;141 of143 saved source files still match the
  workspace, with only tournament runner/runtime intentionally changed.
- Limits: no live provider call, wire capture or full provider-driven fallback
  execution. Disk decision evidence is still terminal-only; old-hand journal
  evidence is in memory, not yet persisted. Next isolate incremental started/
  completed decision artifacts, retaining incomplete prefixes as censored.
  Existing decisionContext tracing also validates completion, so do not enable
  it merely as an observer. Separately probe the analogous pre-action await in
  the short-rollout wrapper; currently a source-only adjacent risk, not proof
  that sealed historical results were affected.
- Report/probes/audits and preservation regression:
  .data/ai-evals/tournament-public-history-v1-20260904/. No new strategy score,
  paid calls, Luna, cost-cap policy, human pacing, rules, prompt, default,
  quarantine, credentials/account, staging, commit, merge or deployment change.
  The broader stronger-player/measurement goal remains active.

## Final guidance replacement and user-directed wrap-up (2026-09-04)

- Drew requested exactly one last experiment, then cleanup and a summary. This
  overrides continued open-ended tuning. Selected whole-guidance replacement:
  conditional whole-plan choice instead of appended advice beside absolute
  tactical priorities. Exact organization and rule/tool/identity components
  remain unchanged. No further experiments, repairs, or provider repeats.
- Both fresh arms use Spark-low Contributor, neutral contract hints, v10/h8/
  schema7, all21 eligible development cases x4, all-candidate-decisions scope,
  concurrency4 each, no caps/pacing, memory, replay, or scratchpad. Freeze149
  sources; aggregate1df55215b14f4823798d028949a4ea90202e8188ef9bc1118bcf07ae3f81bff4.
  Local eval-only replacement mode is opt-in and test-first; production prompt
  and model defaults remain unchanged. Candidate rules/tool component hashes
  exactly match control. No Luna or holdout provider calls.
- Original parent98716 and children98717/98718 exit0. Simultaneous dispatch
  05:35:24Z; control ends05:44:11Z, replacement05:47:56Z. Both84-row populations
  remain intact. No restarts or substituted cases.
- Strategy45.8333% ->53.125% (+7.2917pp); raw robustness88.8889% ->80.5556%.
  Completion84/84 ->83/84; candidate engine legality84/84 each. Requests447/447
  ->438/438, organization124/124 ->121/121, no rejected/error/unresolved requests.
  Seven paired gains, six losses,71 ties. Numerical screen fails robustness and
  completion: do not promote. One positive pair is not replication or win rate.
- Contested family37.5 ->53.125; horizon33.3333 ->41.6667; Hand6 stays100 and
  shared-run stays33.3333. Horizon safe-natural rep4 chooses the sevens contract,
  preserves its public-table disposal line and goes out. The other three natural
  trials and all four safe-wild trials still miss that plan. Replacement has two
  genuine robustness regressions: priority claim rep4 allows instead of claiming
  a winning card; Joker-swap rep2 draws stock instead of the enabling discard.
- Independent audit identifies one separate fixture defect: replacement
  preserve-future-layoff-cards rep3 legally draws discard, lays down and keeps
  K-clubs/3-hearts; the opponent's fixed discard then names a card it did not
  draw from the shifted stock. Original incomplete/zero score stays, but is not
  a model failure. No exclusion, optimistic regrade, repair or rerun. The
  whole-suite robustness score is therefore qualified. Hand1 layoff organization
  label also remains a disclosed latent fixture mismatch; actual requests rank
  correctly and both sort results coincide.
- Ordinary provider p50/p95 9.744/25.873s ->13.389/35.401s, wall9.755/25.881s
  ->13.396/35.409s. Known cost$0.100800326 ->$0.115770800 (+14.85%); combined
  $0.216571126. Timing is descriptive concurrent-load evidence, excludes human
  pacing; costs are recorded/reconstructed, not an invoice. Per-decision usage
  completeness is unknown. Ordinary decisions124 ->122; MayI initiations12 each
  and claim/allow responses8 each.
- Root verifies168 records,286 inputs,885 outputs/schemas,1,611 engine attempts,
  1,457 framing fact checks and84 identical paired initial views, zero replay
  mismatch. Two clean-context judges cover independent72/48/48 record slices,
  exact hashes,245 organization opportunities and885 requests. The single
  case-local opponent-script defect is the only material audit issue. No
  same-step request groups occur: adjacent concurrency risk remains unexercised.
- Verification:73 focused product/harness tests574 assertions, six artifact/
  preservation tests335 assertions, typecheck and diff check pass. Initial test
  failures for missing replacement/launcher behavior were resolved before use;
  the offline old-pair audit needed a larger nonblocking test deadline and a
  corrected expected runtime filename, then reproduced all168 prior records.
- Cleanup archives only the newly started unintegrated incremental-journal
  prototype/test as recoverable.txt files under final-guidance-replacement-
  20260904/unfinished-journal. Audited capabilities, all historical evidence and
  unrelated dirty work remain. No staging, commit, merge, deployment, accounts,
  credentials, house-rule amendment, default or human-pacing change.
- The exact57.2917% checkpoint remains byte-verified at neutral-contract-hint-
  replication-v1-20260904/preserved-candidate.json, SHA825decd509f8ca08ef88b321d1d7d28ebd9a227c00fdba33332bdc392f6df8b6.
  First45.8333 ->57.2917 and repeat51.0417 ->51.0417 remain separate. Current
  app default is still Luna; explicit Spark keeps its minimal profile, while low
  remains the eval reference. No speculative feature is silently enabled.
- Handoff:docs/ai-player-wrapup.md. Evidence and final protocol are under
  .data/ai-evals/final-guidance-replacement-20260904/. Work stops as requested;
  broader real-game validation and independent strategic families remain open,
  not misrepresented as completed. The existing goal was already user-paused.

## Model-written notebook and worked examples (2026-09-04)

- Drew authorized the combined model-maintained ledger/scratchpad and worked
  examples, retaining existing tactical hints, plus cleanup of unused remnants.
  This is one bounded three-arm comparison, not renewed open-ended hill climbing.
- Test-first notebook guidance uses Observed/Suspected/Plan/Reconsider in the
  existing two-line/400-character private scratchpad. Six conditional teaching
  examples cover public beliefs, changed evidence, contract opportunity cost,
  future layoffs and May I burden. No automatic ledger, solver, committee, rule,
  tool protocol, hand-organization, or app-default change.
- Separately repaired the future-layoff fixed opponent discard with an own-hand
  policy; both stock and legal discard-draw branches now finish at full credit.
  Version v11 distinguishes this measurement repair from historical v10 scores.
  Its inconsistent public-meld/down flags remain a disclosed fixture-only limit.
- Three fresh Spark-low Contributor arms use all21 eligible development cases
  x4, all-candidate-decisions scope, h8/schema7, concurrency4 each, imperative
  hints unchanged, no replay/conversation, caps/pacing, Luna or paid holdouts.
  Freeze155 files; aggregate a42fa9c91c56491f17149e2e773fdbe36c7628a45c03c11eacb7916997509a8b.
  Original parent50677 and children50678/50679/50680 exit0; dispatch12:31:58Z,
  final completion12:43:03Z. All252 records retained, no restarted arms.
- Control/notebook/examples strategy52.0833/54.1667/50%; robustness86.1111/
  86.1111/88.8889%. Every arm84/84 complete and engine-legal. Organization
  123/123,124/124,124/124. Requests446/446,451/455,448/448; the four notebook
  rejections are three-line note validation failures, all recovered. No provider
  errors or unresolved requests. Existing Hand1 layoff organization-label mismatch
  has no observed metric effect: both sort orders coincide and actual calls rank.
- Notebook gains2.0833pp, below5pp gate, and fails99.5% request-success gate.
  Added examples lose4.1667pp strategy and12.5pp in contested-run family, failing
  both gain and family-regression gates. Neither is promoted. Combined examples
  versus control: strategy-2.0833pp, robustness+2.7778pp. Paired gains/losses/ties
  5/4/75,5/6/73,5/5/74 for the two incremental and combined contrasts.
- Only contested-run strategy changes:56.25/62.5/50%. Contract horizon and
  shared-run stay33.3333%; Hand6 stays100%. Four correlated strategic families
  and four permutations do not establish a replicated improvement or win rate.
- Each notebook arm has144 traced decisions,92 commits and52 later reads in
  nine scenarios; all opening notes empty. All later reads are ordinary turns,
  so nonempty-memory May I decisions remain untested here. Four-label proposals
  93/105 versus108/108;13/16 terminal-hand proposals discarded as intended.
  Correct delivery/formatting is not factual or strategic correctness: some notes
  retain pre-discard plans or unsupported beliefs. No teaching-fact copying found.
- Ordinary provider p50/p95:9.384/24.187s,11.900/29.295s,12.262/33.846s.
  Known cost$0.096336888/$0.120662666/$0.128613832; total$0.345613386.
  Notebook costs25.25% more than control; combined package33.50% more. Timing
  excludes presentation pacing and is descriptive under concurrent load; token
  completeness per decision is unavailable and known cost is not an invoice.
- Root replay verifies252 rows,432 inputs,1349 tool outputs/schema checks,
  2440 engine attempts,288 memory transitions,2213 framing-fact checks,168
  paired initial public inputs and155 source hashes, with no discrepancies.
- Archived two unreferenced prompt remnants, unchanged and recoverable, under
  notebook-examples-v1-20260904/retired-prompts. Active capabilities, all old
  evidence, unrelated work and exact57.2917% preserved candidate remain intact.
  No credentials/account, staging, commit, merge, deployment, model default or
  human-pacing change. No further paid tuning; broader goal remains user-paused.
- Handoff:docs/ai-player-notebook-experiment.md. Complete protocol, raw run
  references, comparison and audits:.data/ai-evals/notebook-examples-v1-20260904/.

## Exact notebook/examples repeat at user request (2026-09-04)

- Drew requested the full comparison again, retaining notebook if its gain was
  consistently about4-5 points. Repeated all three arms,21 eligible development
  cases x4, without tuning or changing prompts, reasoning, hints, model, starting
  observations, caps/pacing or scope. No paid holdouts or Luna. New run identities
  preserve every original sample. Tested launcher changes only identities.
- Freeze159 files (original155 plus repeat launcher/protocol); aggregate
  01269e57bb5dae6af025d4b80e14253ca318fb77a5836d8006f3b1843f246b27.
  Parent59063, children59071/59072/59073 all exit0. Dispatch12:49:23Z; final
  completion12:59:36Z. All252 repeat cases complete and engine-legal.
- Repeat strategy control47.9167%, notebook54.1667%, examples64.5833%; repeat
  robustness80.5556/86.1111/88.8889%. Notebook strategy is54.1667% in both runs:
  matched gains+2.0833/+6.25pp, pooled+4.1667pp over control50%. This supports
  a positive average in Drew's requested range, not4-5pp in each individual run.
- Examples change direction: control contrast-2.0833/+16.6667pp, pooled+7.2917pp;
  notebook contrast-4.1667/+10.4167pp. Do not select the favorable repeat or call
  their benefit consistent. All strategy variation remains contested-run:
  repeat43.75/62.5/93.75%; other families remain33.3333/33.3333/100%.
- Repeat requests439/439,443/449,453/453. Notebook has six recovered three-line
  note rejections. Repeat organization122/122,119/123,123/124: four notebook
  misses, one examples miss, all in legally winning turns. Pooled notebook
  requests894/904=98.8938% and organization243/247=98.3806%; control has neither
  rejection nor sort miss. Raw gameplay grades remain unchanged; these are
  player-policy/request regressions, not illegal wins.
- Both variants fail the inherited numerical screen despite repeat strategy
  gains. Notebook meets the requested pooled score range but not reliability
  gates; asked Drew whether to enable despite those regressions or retain as
  experimental. No app/default promotion pending that choice. Exact notebook
  and examples configurations are preserved; no third round of paid tuning.
- Repeat ordinary provider p50/p95:8.738/22.566s,11.555/27.004s,10.985/27.521s.
  Repeat cost$0.319069202; total both comparisons$0.664682588 for504 records.
  Pooled notebook cost+25.29%, examples+36.28% against control. Each memory
  arm again has92 commits and52 later ordinary reads; all initial notes empty,
  with no nonempty-memory May I decision. Same causality/timing/usage limits.
- Root repeat audit verifies252 rows,432 inputs,1341 outputs/schema checks,
  2426 engine attempts,288 memory transitions,2205 framing checks,168 paired
  initial public views and159 sources, zero mismatch. Two reviewers independently
  cover all252 exact row hashes/grades; strict organization364/369. Latent Hand1
  fixture label mismatch remains separate and numerically harmless. A preliminary
  judge progress statement conflated replay agreement with organization success;
  root raw-request checks caught it and final reports enumerate all five misses.
- Tests: repeat protocol test13 assertions, two full-population tests15 assertions,
  preservation test7 assertions pass. Original summary regression still passes;
  product sources are unchanged from the previously passing focused tests and
  full typecheck. Diff check passes. All original and repeat run processes ended.
- Snapshot notebook-examples-replication-v1-20260904/preserved-configurations.json
  contains159 exact source bytes, all three full configurations, both outcomes
  and35 evidence hashes, excluding credentials. SHA
  d6f53a8ff3a198ee0565f4df0dba2d758b9e912616210f88e4d622c0fd3f4eeb.
  The original57.2917% checkpoint and two recoverably archived prompt remnants
  remain intact. No staging, commit, merge, deployment, account or credential
  change; tactical hints, rules and ten-second reaction window remain unchanged.
- Handoff remains docs/ai-player-notebook-experiment.md; repeat artifacts under
  .data/ai-evals/notebook-examples-replication-v1-20260904/. Existing broad goal
  remains user-paused, not declared complete by these bounded evaluations.

## User-selected notebook + examples, shared player execution (2026-09-04)

- Drew selected notebook + examples, then clarified Spark must be the default
  and player execution must not branch by model. Promoted the selected prompt
  locally as `notebook-examples-v1`, with Spark Contributor / low as the default
  for new app/CLI players and quick-starts. Explicit saved model choices remain.
- Every normal player now uses `executePlayerTurn`: the same prompt, phase-filtered
  tools, and model-written notebook. Provider adapters retain only static API
  configuration. Removed the Luna-only stored-response chain, compaction/cache
  hooks, dynamic tool-selection branches, storage plumbing, obsolete tests, and
  a redundant registry-only execution wrapper. No new tactical solver or committee.
- Private notes persist separately from public game state/activity, are isolated
  by game/player/hand, and expire on hand changes/end. Failed or aborted proposals
  do not overwrite committed intent. No change to authoritative rules, tactical
  hints, organization guidance, or the ten-second app reaction window.
- Exact selected prompt SHA256 remains
  `9a551b08cb4699cfeb2d5d10ab7a131b41134eeac7c969204a0897407183a576`.
  Reverified both preserved checkpoints unchanged: notebook/examples artifact
  `d6f53a8ff3a198ee0565f4df0dba2d758b9e912616210f88e4d622c0fd3f4eeb`,
  older strategy checkpoint
  `825decd509f8ca08ef88b321d1d7d28ebd9a227c00fdba33332bdc392f6df8b6`.
  They include recoverable original source; old user continuity files/keys remain
  untouched but unused. Historical scores/caveats are not rewritten as a new win.
- TDD verified changed default, shared request behavior across providers, private
  notebook restoration/isolation, real tool commits and transport-failure handling.
  Broad local check: 870 pass, 24 skip, zero failures across 118 files; typecheck
  and production build pass. Corrected two test expectations: default effort now
  low, and the journal fixture must draw before its attempted laydown/discard.
- Separate live smoke: `RUN_INTEGRATION_TESTS=1 bun --env-file=.env.local test
  ai/openrouter-muse.integration.test.ts`; two legal completed turns, persisted
  notebook read on turn two, no private note in public save/activity. Provider
  durations 11.205 / 11.123 seconds; total recorded cost $0.0034967. This is not
  a new suite score or a guaranteed minimum latency. Temporary smoke saves removed.
- Local only: no staging, commit, merge, deployment, account, or credential change.
  Broader paused goal remains paused; this user-approved configuration is locked in.
