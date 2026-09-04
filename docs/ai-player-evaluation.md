# AI Player Evaluation

This evaluation measures an AI player as a versioned configuration:

```text
resolved provider model + transport + provider settings + reasoning effort
+ house-rule identity + player-guidance identity + tool-protocol identity
```

The initial objective is to establish a reproducible baseline and then improve
Muse Spark 1.3 Contributor without spending the hill-climbing budget on Luna.
GPT-5.6 Luna xhigh is a frozen reference baseline. Spark is the only model used
for routine effort sweeps and instruction iterations.

Current strategic iteration protocol: use the complete eligible development
short-rollout suite, four repetitions per case, no Spark cost cap and no eval
pacing. Report strategy separately from robustness, request health, organization,
latency and cost; preserve failed samples and quarantine disputed-rule fixtures.
The fixed-state cost-cap and three-repetition commands later in this document
describe the older tactical calibration workflow, not the current hill-climb
policy. See [the iteration log](ai-player-eval-log.md) for frozen protocols and
results. The public-opportunity guidance experiment was rejected; neither it,
contract-options nor scratchpad is promoted to the default player.

Current calibrated suite: `short-rollout-v10`; latest comparison harness
`short-rollout-harness-v8` (case schema7). The historical unretained v10 baseline
used harness7/schema6. The same21 eligible development cases
remain:12 strategic cases in4 correlated families and9 robustness checks. Four
contested-run development cases now start one own turn earlier, with three own
decisions. Holdouts and quarantines are unchanged; the original two-turn
contested definitions remain as fixed-root controls. Do not compare v9 and v10
headline scores as a player improvement. The fresh whole-suite x4 Spark-low
baseline is complete and independently audited: strategic quality52.0833%,
robustness83.3333%,84/84 completed/legal episodes,445/445 successful tool requests
and123/123 correctly organized opportunities. Provider decision latency p50/p95
is8.712/21.692s; the recorded run cost is$0.098157604. These are conditional
rubric scores, not game win rates. Frozen artifacts and the final evidence seal
are in `.data/ai-evals/earlier-entry-v10-20260904/`.

The expanded episodes preserve arbitrary legal early choices, including drawing
from discard; opponents draw stock and discard their actual draw. The grader
uses per-decision, candidate-perspective action evidence rather than a cached
reference hand. Evidence includes own hand and public table/discards, never
hidden stock contents or opponent hands, and is not added to model prompts.
Fifty points require an exact contract or a live maximal positive-coverage route
by decision2; fifty measure exact-contract outcome by decision3. Structured
coverage regret and final conversion opportunity distinguish inherited route
destruction, bad current choices, unlucky continuations, and missing evidence.
Unknown opportunity is null, not false. Incomplete/illegal model and reference
episodes both receive zero gated quality while retaining diagnostic criteria.

The baseline also exposes actual later-decision mistakes: seven second-turn
discards sacrifice public completing-card coverage. An eighth subperfect case
has sampled draw-path opportunity cost, not a proved globally inferior draw.
Independent legal continuations reach full credit in all eight with the actual
first decision unchanged. This demonstrates measurable later-decision headroom,
not evidence that memory helps.
The model still sees the full existing current-round public activity. A future
cross-turn-history comparison must preserve identical public information, isolate
history by player/hand/configuration, and compare whole suites. Neither encrypted
per-hand player history nor a new prompt/effort/default is enabled by this eval
change. Human-facing pacing and authoritative house rules remain untouched.

The per-hand own-conversation intervention is connected
to both player execution APIs and opt-in runner arms (`--conversation fresh` or
`--conversation per-hand`, both requiring `--reasoning-replay within-turn`).
Harness v8/schema7 captures exact API observation/history hashes and missing
usage; suite v10, prompts, rules, effort and defaults are unchanged. Private
history is isolated by game/player/hand/configuration, with fresh-state checks,
valid May I pass opportunities, complete terminal exchanges and late-abort
protection applied equally to both arms. Real SDK/player probes verify exact
request bytes, catalog settings, per-assistant opaque reasoning replay, terminal
results once, ordinary/May I tool transitions, hand-ending success and late
cancellation. Its full paired21x4 experiment and independent audits are complete:
fresh retained-within-turn control strategy53.125% versus per-hand52.0833%;
robustness86.1111% each. Both complete/legal84/84, strict organization123/123;
captured requests448/449 versus447/447. Known cost rises$0.080512338 to
$0.121249042. It fails the >=5pp strategic-gain gate: no replication advancement
or default promotion. The net loss originates in one empty-history opening
difference; later history-exposed divergences net to zero. This does not prove
memory harms play, nor that encrypted reasoning itself helps. See the fully
audited report in `.data/ai-evals/hand-conversation-v1-20260904/report.md`.

Neutral factual framing of the existing single legal contract example is now
an opt-in, with the first fresh whole-suite21x4 pair independently audited.
It preserves facts, selection, prompt, rules and effort, without unpromoted
memory. Strategy45.8333%→57.2917%, robustness86.1111% each; both84/84 complete
and legal, strict organization123/123, requests443/443→449/449. Known combined
cost$0.18377724. The numerical screen passes, but all strategic gains originate
in choices made before changed wording appears on equal public inputs; the
actually exposed contract-horizon openings do not improve. This does not
establish a framing benefit or justify promotion. See
`.data/ai-evals/neutral-contract-hint-v1-20260904/report.md`.

The unchanged full-suite replication is now complete and independently audited:
strategy51.0417% in both arms, robustness83.3333%→86.1111%,84/84 complete/legal
each, strict organization122/122→123/123 and requests442/442→444/444. Known
replication cost$0.167717806. The strategic gain does not replicate, so no
promotion or additional identical retry is selected. All first contested
semantic divergences again precede changed wording on equal public inputs.
The original57.2917% candidate is preserved, including exact bytes of143
evaluated source/dependency files, its settings and untouched sealed evidence;
it is not deleted or treated as a guaranteed score. See
`.data/ai-evals/neutral-contract-hint-replication-v1-20260904/report.md` and
`preserved-candidate.json` in that directory. The next implementation is broader
harness public-history fidelity, followed separately by incremental evidence.

Independent real-play-derived strategic families and untouched broader
evaluation remain necessary. The older tournament runner is not currently
observation-equivalent: it drops card details, keeps only ten activity entries
and writes results only after a game ends. Full current-hand public-history
parity and incremental trajectory recording need separate tested, versioned
measurement changes before broader opponent-tracking claims.

## House rules are not player instructions

`docs/house-rules.md` is the human-authoritative constitution. It defines legal
play for every player and is not a hill-climbing parameter. An AI preference
does not become a house rule merely because it says "always" or "must".

The runtime prompt has three independent layers:

- `ai/mayIAgent.house-rules.ts`: the concise game-legality representation,
  independently versioned. It must be reconciled with the constitution, not
  adjusted to increase an AI's benchmark score.
- `ai/mayIAgent.player-guidance.ts`: the player's organization policy, strategy,
  discard preferences, planning, and risk tradeoffs. These can differ between
  players or experiments. The default keeps contract-aware hand organization.
- `ai/mayIAgent.tool-protocol.ts`: how to call tools, use current card positions,
  and recover from rejected actions. Tool acceptance is not authority to amend
  the house rules.

`ai/mayIAgent.prompt.ts` composes the layers and explicitly gives house rules
precedence over player guidance. `ai/mayIAgent.prompt-version.ts` composes their
independent version identities. Earlier `house-rules-v3`/`house-rules-v4` labels
were unfortunately names for the entire AI prompt, not actual amendments to
the house rules; historical artifacts retain those original identities.

New evaluation prompt snapshots record separate version/hash pairs for all
three layers. Strategy addenda are inserted inside `player_guidance`, change
only its identity, and cannot introduce reserved rule/protocol section tags.
Tests assert that the house-rule and tool-protocol fingerprints stay identical
across a strategy experiment. The full prompt snapshot is still retained.

**Rule correction (2026-09-04):** Drew confirmed section 8: initial sets in
Hands 1–5 contain exactly three cards, and initial runs exactly four. Only
Hand 6 allows extensions and requires every held card. The shared validator,
human staging, AI candidates, and `house-rules-v2` prompt enforce this boundary.
Historical results retain their original rules and fingerprints; comparisons
under the corrected rules require a fresh baseline. Previously quarantined
rule-dependent scenarios remain excluded, not silently reactivated.

## Evaluation layers

### Fixed-state tactical suite

The first layer presents a model with exact game positions backed by the real
XState round machine. Every attempted tool action is applied to the real engine.
The `fixed-state-v2` catalog contains 20 positions covering:

- draw and discard judgment;
- immediate contract recognition;
- multi-deck duplicate sets;
- balanced and invalid wild-card ratios;
- Ace-high and invalid Ace-low runs;
- positive and negative same-suit run-gap boundaries;
- May I response judgment;
- layoffs;
- going out by laying off every remaining card;
- Joker swapping;
- public opponent tracking;
- endgame point dumping; and
- Hand 6 all-card planning.

Fourteen cases are in the development split. Six are holdouts. One polarity of
the Ace boundary is development and the other is holdout, avoiding the prior
holdout's bias toward conservative no-op answers. Development results may guide
improvements; holdout results may only be consulted at checkpoints after an
improvement has already been selected.

Every scenario includes a hidden known-good action trajectory. The test suite
replays all 20 trajectories through the real state machine and requires legal,
full-credit outcomes before a scenario can be used to judge a model.
As a discrimination check, `blind-legal-v2` follows the phases legally but
always draws stock, never melds, allows May I, and chooses an opaque card ID
without using card value or hand position. Across three deterministic hand
permutations per scenario it completes 100% of the suite legally and scores 31%
in every repetition, versus the reference trajectory's 100%. The stable
69-point gap prevents legal orchestration or lucky fixture ordering from
looking like strong gameplay.
The separate `rule-aware-greedy-v1` calibration uses only visible game state
and ordinary rules: it recognizes obvious same-rank pickups and claims, sheds
high-point cards, and performs legal layoffs, but it cannot plan contracts,
Joker swaps, or nuanced multi-turn strategy. It completes and plays legally in
all three permutations and scores exactly 62% each time (60% development,
66.7% holdout). This middle rung demonstrates that the suite produces graded
skill signals rather than only distinguishing a deliberately blind policy from
the hidden reference trajectory.
Repeated trials permute the evaluated hand deterministically. Every candidate
receives the same permutation for a given scenario and repetition, enabling
matched quality, latency, cost, and win-tie-loss comparisons.
Saved JSON and Markdown reports also slice quality, completion, and legality by
development/holdout category. This keeps a strong overall average from hiding a
failed decision family such as contract recognition, May I judgment, or
endgame play.
Their top-line quality interval uses one mean per distinct scenario, so adding
more permutations of the same position stabilizes that position without
pretending the suite gained new strategic coverage.
Multi-candidate runs execute one matched scenario/repetition across every
candidate before advancing, and rotate which candidate runs first. This
distributes prompt-cache warmup and provider-time effects instead of assigning
them systematically to the first or last effort level.

Run the cheapest Spark development calibration:

```bash
bun ai/evals/ai-player-fixed-state-runner.ts
```

Recheck the zero-cost blind, rule-aware, and oracle calibration ladder:

```bash
bun test ai/evals/ai-player-eval-sanity-baselines.test.ts
```

Materialize the complete calibrated ladder, including the replay-certified
frozen Luna result, without issuing a provider request:

```bash
bun ai/evals/ai-player-eval-calibration.ts
```

This validates the current suite, harness, scenario identities, rubrics, and
strict `31% blind < 62% rule-aware < 80% Luna < 100% oracle` ordering, then
writes `calibration.json` and `calibration.md` under
`.data/ai-evals/fixed-state-v2-calibration/`. A stale suite, missing case,
changed rubric, duplicate scenario, or non-increasing skill rung fails the
command instead of producing a reassuring report.

Run the complete Spark effort ladder on development cases:

```bash
bun ai/evals/ai-player-fixed-state-runner.ts --all-spark --repetitions 3
```

Paid fixed-state and May I initiation runs default to a `$0.25` observed-cost
stop threshold. Duplicate tournaments use the same default. Override it when
deliberately expanding a run:

```bash
bun ai/evals/ai-player-fixed-state-runner.ts \
  --all-spark \
  --repetitions 3 \
  --max-cost-usd 0.10
```

The runner checks the threshold only between complete matched
scenario/repetition blocks. Once a block starts, every configured candidate is
run so cost controls cannot create an unfair partial comparison. This means the
reported total can exceed the threshold by the cost of the final matched block.
If neither provider-reported nor reconstructed cost is available for any
result, the runner also stops before the next block rather than continuing with
unbounded unknown spend.

Tournament checks occur between duplicate seeds rather than between games. All
three seat rotations for a seed finish once started, keeping its gameplay
comparison valid; the final-seed overshoot can therefore be larger than a
fixed-state matched block.

Run a named Spark candidate against the holdout:

```bash
bun ai/evals/ai-player-fixed-state-runner.ts \
  --candidate spark-medium \
  --repetitions 5 \
  --split holdout
```

Run only selected cases for a cheap smoke test or harness repair:

```bash
bun ai/evals/ai-player-fixed-state-runner.ts \
  --candidate spark-minimal \
  --split all \
  --scenario ace-high-run-contract,wild-ratio-valid-contract
```

Do not invoke Luna again for routine evaluation or hill climbing. The paid Luna
run is frozen as the comparison baseline. Its
pre-harness-version evidence plus the repaired Ace case can be certified against
the current runtime without making a model call:

```bash
bun ai/evals/ai-player-luna-baseline-certifier.ts
```

This replays every retained positional tool call through the current command
policy and XState engine, verifies the original rendered input, legality,
current rubric output, and final outcome, then writes the single comparable
artifact `.data/ai-evals/luna-frozen-baseline-certified-v4`. The certifier
substitutes only the documented `ace-high-run-contract:1` repair and records
both source run IDs in the new manifest. Harness v3 also attaches the exact
resolved Luna model configuration and its SHA-256 fingerprint without making a
provider request.

Available Spark candidates are `spark-minimal`, `spark-low`, `spark-medium`,
`spark-high`, and `spark-xhigh`. All use the same prompt version during the
effort sweep.

After a complete three-repetition development sweep, select the effort with the
predeclared policy rather than eyeballing aggregate rows:

```bash
bun ai/evals/ai-player-effort-selection.ts \
  --run .data/ai-evals/spark-effort-sweep
```

The selector identifies the highest-quality measured Spark effort, averages
matched repetitions within each scenario, calculates paired Student-t 95%
intervals across those distinct scenario means, and applies a strict 2.5
percentage-point non-inferiority margin. An effort is
ineligible if that lower bound crosses the margin or if completion or legality
regresses. It also averages scenario deltas within every strategic category and
rejects an effort if any category falls outside the same margin. Cost chooses
the cheapest effort only among eligible arms; provider latency is reported
separately and acts only as a later tie-breaker. Equal quality is anchored to
the higher reasoning effort so a cheaper effort must demonstrate equivalence
against the more capable configuration.

The command rejects holdout-inclusive, under-repeated, unevenly repeated,
unmatched, cost-incomplete, or Luna-containing sweeps. It writes
`effort-selection.json` and `effort-selection.md` beside the raw run artifacts.
The margin can be made stricter explicitly with
`--noninferiority-margin-pp`; changing it after seeing results is not valid
selection evidence.

At a checkpoint, run the selected Spark effort for at least three repetitions
over `--split all`, then compare it with the certified frozen Luna artifact
without making another Luna call:

```bash
bun ai/evals/ai-player-baseline-comparison.ts \
  --spark-run .data/ai-evals/spark-checkpoint-all \
  --spark-candidate spark-high
```

The report pairs Luna with Spark's canonical first repetition on the exact same
20 states and rubrics, while using all Spark repetitions for its more stable
latency, cost, reliability, and repeated-quality estimates. It records prompt
identity because instructions are part of the player configuration and may
differ after hill climbing. The report is intentionally descriptive: Luna has
only one provider observation per position, so the paired interval measures
variation across positions rather than Luna's run-to-run stochastic variance.
It writes `luna-comparison-<spark-candidate>.json` and `.md` beside the Spark
checkpoint and never issues a promotion verdict.

### Isolated Spark prompt experiments

Keep the production prompt unchanged while testing one strategy change by
putting only the proposed addendum in a file and naming it explicitly:

```bash
bun ai/evals/ai-player-fixed-state-runner.ts \
  --candidate spark-medium \
  --prompt-experiment phase-checklist-v1 \
  --prompt-addendum-file ai/evals/prompts/phase-checklist-v1.md \
  --repetitions 1 \
  --run-id spark-medium-phase-checklist-smoke
```

The prompt experiment ID and file are an inseparable pair. The runner preserves
the untouched base prompt, its hash, the exact trimmed addendum and hash, the
composed prompt and hash, and a composite version such as
`house-rules-v3+phase-checklist-v1`. The same two flags work with the focused
May I runner. A duplicate tournament also requires
`--prompt-experiment-candidate <spark-candidate>`; only that competitor receives
the addendum while the other two remain frozen anchors. This prevents an
instruction experiment from changing its own opposition and masquerading as
isolated gameplay evidence. Any prompt experiment containing Luna is rejected;
prompt iteration is Spark-only.

### Public-history observation contract

The local app now supplies all recorded, displayable public activity from the
current hand, rather than the latest ten entries. `PartyGameAdapter` provides
the same history to broadcasts, reconnect snapshots, and AI turns; the AI
variant maps player IDs back to engine IDs. The prompt renderer preserves the
supplied current-hand entries in chronological order. Bounded recent-history
methods remain for legacy callers. None of this changes house rules or player
strategy guidance.

The app shows the six most recent entries immediately and exposes older entries
under an expandable, bounded, scrollable region. Public laydown cards are now
included, so a player can update earlier pickup evidence when cards leave an
opponent's hand. Stock draws and May I penalty faces remain private. Automatic
May I pickups are logged only after an observed transfer; failed-penalty hand
boundaries do not manufacture a pickup. Terminal events retain the prior hand
and turn attribution when the engine has already redealt.

This is full retention of the activity actually recorded, not a complete event
transcript: existing skip/organization omissions remain. One completed-hand
gap is known: a successful May I that consumes the last penalty card and
immediately ends the hand can omit its final acquisition entry because the
post-action hands have already been cleared. Do not use that omitted event as
evidence that the pickup failed. Legacy saved histories cannot retroactively
recover meld details that were never recorded.

Local real-engine, persistence, projection/reconnect, prompt-rendering, and
component tests verify delivery and privacy. Desktop browser expansion,
scrolling, and keyboard access were checked in the component showcase. This
does not establish deployed behavior, physical-device acceptance, or improved
AI tracking. The app-history change itself was not a player-skill experiment.

Short rollouts now record `observationVersion: public-action-history-v1` in
manifests and case artifacts. A trial journal uses the same public-action
projector as the app and appends accepted candidate/opponent actions before
the next decision. The three contract-horizon cases replay their fifteen-action
prelude, producing fifteen ungrouped public entries without changing the root
snapshot. Reference runs retain each decision's history for inspection.

V6's shared-run family similarly replays seventeen public actions. Harness
`short-rollout-harness-v2` supports responsive opponent decisions with an
own-hand/public-table-only view and stops when the hand actually ends. A legal
early loss is a completed strategic outcome, not an incomplete provider turn.
V6 case schema 3 introduced every actual candidate/opponent action attempt and
the final engine snapshot for independent replay. V7 case schema 4 also records
eligibility and scope version. Summary/manifest schema 5 retain the complete
selection/exclusion plan and separate strategy from robustness scores, alongside
harness/observation versions and opponent policy IDs.
Schema 5 removes the ambiguous top-level `qualityPercent`: the mixed value is
explicitly `diagnosticQualityPercent`; strategic comparisons use
`scopeScores.strategy.qualityPercent`. Missing stratum evidence is `null`, not
a zero score. These new schemas do not reinterpret older saved artifacts.
Harness `short-rollout-harness-v6` uses case schema 5 and summary/manifest schema
6. It adds `toolRequests` (decision and step identity, tool call ID, input,
actual returned output, status, and rejection/error text) and `toolRequestHealth`
counts. Capture begins at the normalized model response, continues at tool
completion, and reconciles at step end, so schema/unknown-tool errors and
pre-engine validation rejections are not lost. Calls without a recorded outcome
remain `unresolved`, never successful. The observer is eval-only and is never
rendered into player context. Transport failure before any response has zero
observed requests and an undefined success rate, not 100% success.

`legal`/`legalRate` and the existing strategic score continue to mean engine
attempt legality; no old score is reinterpreted. **They do not certify valid
model requests.** Tool-request health is a separate reliability dimension,
reported with warnings even when the player recovers and the strategic criteria
pass. A rejection, error, unresolved request, or missing capture blocks player
promotion pending review; do not promote from `legal: true` alone. These
observer/accounting repairs are not player-strength improvements.
Raw final snapshots are evaluator artifacts, never model observations. The
policy interface is not a security sandbox against closure-captured data;
review every policy's actual implementation for hidden-information access.

This is not blanket replay certification: cases without a replayable prelude
still begin with constructed fixture history or no recorded prelude. Their
manifest entries identify that source. Some legacy synthetic histories lack a
complete ownership/disposal trail and must be corrected or explicitly excluded
from a realistic tracking score. Continuations are recorded for every case.

The associated runtime is `fixed-state-runtime-v3`: it follows the app's policy
for stale turn errors after accepted May I/organization actions. A rejected
laydown no longer makes a subsequent genuine May I transfer disappear from
history. This is a harness repair, not improved player behavior.

Pair identical candidate configurations and seeds across observation/runtime
changes; do not label extra information or corrected acceptance as a reasoning
or guidance improvement. Report factual tracking separately from strategic
outcomes. These versions are not directly interchangeable with older artifacts.

### Nuanced short-rollout loop

The `short-rollout-v9` catalog has 32 cases, retaining all historical cases and
split labels. V9 adds the missing legal opponent response after an optional
allow in the May I priority fixture; its root and rubric remain unchanged.
Historical v8 artifacts keep their original identity. `rollout-scope-v2`
enforces prospective eligibility. No old result was
removed or regraded. Independent score-blind review found that many original
fixtures tested mechanics using incomplete or impossible game positions.

| Scope | Development | Holdout | Interpretation |
| --- | ---: | ---: | --- |
| Strategy | 12 | 2 | Four conditional strategic families; holdouts are near-transfer within one family |
| Robustness/mechanics | 9 | 4 | Separate synthetic mechanics and rare-boundary diagnostics |
| Quarantine | 5 | 0 | Rule-conflicting rewards or unresolved historical evidence |

Default `--scope all-eligible` runs the 21 eligible development cases (84 trials
at four repetitions). Each trial remains bounded to at most three model
decisions, with four independent trials running concurrently and zero pacing.
Strategy and robustness scores are separate; the combined diagnostic mean is
explicitly not a strategic ranking. `--scope strategy` or `--scope robustness`
selects a diagnostic stratum without changing its rubric.

The two new strategic holdouts are rank-shifted variants of contested-run
planning, not previously unseen families. They remain excluded from ordinary
tuning. The four original holdouts are retained mechanics checks. Realistic
May I/Joker strategy and stale-evidence reversals remain coverage gaps; passing
the selection gate alone does not establish broad gameplay strength.

The original eight cases cover May I initiation and response, exhaustion risk,
Joker swaps, constrained layoff ordering, public opponent-pickup inference, and
preserving future layoff cards. Four new development cases add extended
contracts, own-contract versus future-layoff conflicts, a Hand 6 known-discard
win, and inferring a run gap from two public pickups. The four holdouts test a
same-suit run gap, Joker liability under a fixed opponent continuation, the
Hand 6 prohibition on partial laydown, and May I with recyclable stock.

V4 adds four development cases: two Hand 6 branches measuring full-population
next-draw coverage and subsequent conversion, plus a delayed May I exhaustion
case and a larger-reserve reversal. These are two strategic families, not four
independent roots. See `docs/ai-player-strategic-scenarios.md` for the conditional
rubrics, exact card counts, legal inferior controls, and realism limitations.
V5 adds three branches of one contract-versus-horizon family: preserving
next-turn public layoffs across two draws, versus minimizing points before an
opponent's exit inferred from public history. Both possible contracts use exact
minimum melds. The initial calibration used ten grouped public entries and
static continuation history. Observation-v1 instead replays fifteen ungrouped
public events and appends the real continuation; the earlier app retention
limit is also removed locally. These remain constructed mid-hand decision
diagnostics, not full-deal replay or deployed-memory evidence. Unchanged-player calibrations expose repeatable
misses across two families; complete benchmark validation before resuming
whole-suite prompt/effort selection.
V6 adds three shared-run timing branches: holding a bridge card that would
enable a known opponent exit, two subsequent draw continuations, and the
opposite-policy control where the candidate can already win. Seventeen real
public actions establish the retained opponent card. A legal initial-deal
reconstruction verifies the physical positions after normalizing meld IDs and
table display order; the supplied history still starts at the mid-hand prelude.
Selected calibration exposes a repeatable premature-layoff error. It does not
measure a prompt change or establish generalized skill.

V8 adds four development cases and two near-transfer holdouts for contested
run planning. A full-deal seventeen-event replay establishes retained public
pickups older than ten events. The candidate must weaken one of two incomplete
runs to discard. Public physical-copy counts determine maximum next-stock-draw
exact-contract coverage, conditional on exchangeability, survival, no claims,
and no recycling; conversion on the second own turn is scored separately.
A stronger-contested-run reversal defeats blanket suit avoidance. This does
not measure global discard safety or full-game expected score. See section 8
of the strategic scenario document for counts, negative controls, and limits.

Every case has an engine-accepted full-credit reference trajectory; this does
not certify house-rule compliance or physical reachability. Every new challenge
also has a lower-scoring negative-control trajectory. The v3 and v5 additions
start the candidate with eleven cards before drawing; the v4 Hand 6 roots
start at a twelve-card post-draw decision. Some legacy cases use reduced hands as
mechanics-focused engine fixtures; this is not a sample of naturally occurring
game positions. The suite is a diagnostic benchmark, not an estimated win rate.
The owner identified the scarce-stock May I pair as too contrived for ordinary
strategy evaluation. Both branches now belong to robustness and cannot inflate
the strategic score. Historical results and deterministic references remain
available, including those now quarantined.

Assessments are explicitly labeled:

- `tactical`: engine legality or an immediate available result. Some rubrics
  include an explicitly described strategic discard tie-breaker.
- `scripted-outcome`: result conditional on the fixed hidden stock/opponent
  continuation; the model is never told that future.
- `strategic-preference`: a declared heuristic under uncertainty, such as
  avoiding an opponent's publicly collected rank. Public pickups are evidence,
  not proof of hidden needs.

The historical extended-contract fixtures followed the permissive engine and
player prompt. The 2026-09-04 correction now rejects those oversized Hands 1–5
initial melds; regression tests verify rejection instead of certifying the old
reference trajectories as legal.
The runner now rejects quarantined cases before creating a model or run
directory, including explicit or repeated `--scenario` selectors. There is no
provider-run override. The three rule-dependent cases are
`plan-call-may-i-and-go-out`, `include-extended-run-to-go-out`, and
`prioritize-own-contract-over-public-layoff`.

Two historical-signal cases are also quarantined pending replay/provenance
repair: `avoid-publicly-collected-rank` and `avoid-publicly-collected-run-gap`.
The former's pickup face is absent from every supplied zone. For the latter,
missing disposal evidence makes the signal unreliable; this is not proof that
the earlier pickup never occurred. One independent reviewer considered the
latter acceptable as robustness. The stricter quarantine preserves that
uncertainty and avoids rewarding an unverified tracking premise.

Unknown/unclassified cases, duplicate requests, and requested cases outside the
chosen split/scope fail rather than being silently dropped. Manifests retain
every included/excluded case, reason, family, history source, and inventory
status. `fullEligibleSplit` describes coverage of the requested split, not
readiness or permission to promote. Inspect without any provider calls:

```bash
bun ai/evals/ai-player-short-rollout-runner.ts \
  --describe --split development --scope all-eligible
```

The ten v4/v5/v6 additions do not require extended Hands 1–5 initial melds.
The fourteen strategy cases conserve all 108 physical cards; exact reference and
prelude initial meld sizes are regression-checked. The Hand 6 family has no
recorded prelude; the contract-horizon and shared-run families replay public
events; contested-run cases replay from the full initial deal. Their individual
provenance limitations remain documented. A selected
calibration is only a difficulty/harness diagnostic, never whole-suite ranking.

This Spark-only inner loop has no evaluation cost cap. It still records exact
provider-reported or reconstructed cost, provider time per model decision, and
wall time, but never stops a run based on spend. Presentation pacing remains
zero so the measured latency is not confused with the separate minimum time a
human needs to observe a turn.

Hand organization is measured independently from gameplay quality. The default
player guidance permanently instructs the AI to sort set-heavy
Hands 1 and 4 by rank and run/mixed Hands 2, 3, 5, and 6 by suit immediately
after the draw, then continue its turn normally. This policy was introduced
under the historical whole-prompt label `house-rules-v4`; it is not a house
rule and now belongs only to the independently versioned guidance. The earlier isolated
`contract-hand-organization-v1` arm remains useful historical evidence, but it
is no longer an optional candidate.
From harness v6, the organization denominator includes only ordinary invocations
where `organize_hand` was available in the initial state or after an actual
action. A required draw that immediately ends the hand has no such opportunity.
A live post-draw state counts even if the provider stops without acting; later
turn completion does not erase that opportunity. Correct sorting still requires
an accepted contract-appropriate reorder, not an already-sorted random deal.
Historical organization totals remain unchanged in their original artifacts.

Treat the complete suite as the unit of prompt and reasoning-effort selection.
Scenario-level results diagnose tradeoffs, but do not justify changing the
player to solve one fixture. Once setup is ready, keep suite/scope version,
product code, all eligible development scenarios, four repetitions, hand
permutations, and concurrency frozen while changing one configuration variable.
Compare strategy quality and robustness regressions separately, with completion and
legality as hard gates; report organization, provider p50/p95, wall p50/p95,
and cost separately. `--scenario` is only for harness diagnostics, never for
selecting or promoting a prompt. Do not compare different suite aggregate scores as
if the player changed. Use `--concurrency 1` for serial timing measurements;
do not compare their latency directly with four-concurrent runs.

Prompt experiments use a frozen, independently reviewed benchmark. Their CLI defaults to
`ordinary-turns` scope for compatibility with
the historical organization arm. A true system-prompt experiment must apply to
all evaluated decisions explicitly:

```bash
bun ai/evals/ai-player-short-rollout-runner.ts \
  --candidate spark-low \
  --prompt-experiment conditional-plan-value-v1 \
  --prompt-addendum-file ai/evals/prompts/conditional-plan-value-v1.md \
  --prompt-scope all-candidate-decisions \
  --split development --scope all-eligible --concurrency 4 \
  --run-id spark-low-short-rollout-v9-conditional-plan-value-v1
```

This illustrates experiment wiring, not a recommended configuration. The
conditional-plan addendum has not passed promotion gates. The opt-in
[per-hand scratchpad](ai-player-scratchpad-experiment.md) is implemented and
paired-tested, but not promoted; private intent is neither house rules nor a
replacement for the public activity history.

### Derived contract-options view (experimental)

Harness v5 can compare the existing imperative first-contract hint with a
neutral preview of up to three contracts with distinct leftover card faces:

```bash
bun ai/evals/ai-player-short-rollout-runner.ts \
  --candidate spark-low --repetitions 4 --concurrency 4 \
  --prompt-scope all-candidate-decisions \
  --tactical-presentation contract-options \
  --run-id spark-low-contract-options-experiment
```

This changes derived player assistance, not the system prompt, house rules,
public history, tool schemas or default player. It uses only the player's own
cards and the public table. Enumeration order is not strategic ranking; future
layoff fits are individual, conditional possibilities, not a guaranteed joint
sequence. Options are bounded, not exhaustive, and identical residual card
faces can collapse different board allocations. Engine validation does not
override the unresolved initial-meld rule boundary described above.

Both initial and subsequent tool-result views honor the opt-in; manifest and
case artifacts record `distinct-contract-options-v1`. Compare fresh full-suite
arms on the same source freeze. Their derived views intentionally differ, so
verify the unchanged underlying state/history and system prompt rather than
demanding byte-identical whole rendered observations. Scratchpad remains off
unless independently selected. The first paired result is **review only**:
52.1% to 61.5% strategy, with urgent-exit regressions; no default promotion.

Do not rank an incomplete effort run as skill evidence. Twelve development
strategy cases comprise only four families, with paired branches; repetitions
do not create 48 independent situations. Replicate a promising whole-suite
result before promotion, then run the
frozen finalist with `--split holdout`. Do not revise its prompt in response to holdout
failures. `--split all` is available for a final report, not routine tuning.
After short-rollout selection, use the larger fixed-state development/holdout
suite and only then an occasional duplicate tournament as broader validation.

### Out-of-turn May I initiation suite

Ordinary turns and May I responses do not measure whether a player knows when
to initiate a claim. The separate `may-i-call-v1` suite contains six exact
call-or-pass positions: four development cases and two holdouts. They cover
contract-completing set and run claims, unrelated discards, endgame risk, Hand
4's third set, and Hand 6's extra-card penalty.

Each case renders only public state plus the evaluated player's hand, offers
exactly `call_may_i` and `pass_may_i`, and applies a call through the production
command policy and real round machine. Both decisions are terminal and timed;
passing intentionally leaves the game unchanged.

Run the cheapest Spark development calibration:

```bash
bun ai/evals/ai-player-may-i-call-runner.ts
```

Run the complete Spark effort ladder:

```bash
bun ai/evals/ai-player-may-i-call-runner.ts \
  --all-spark \
  --repetitions 3
```

The one-time Luna baseline is explicit here as well:

```bash
bun ai/evals/ai-player-may-i-call-runner.ts \
  --candidate luna-xhigh-baseline \
  --split all \
  --run-id luna-may-i-call-frozen-baseline-v1
```

That frozen run scored 6/6 decisions correctly with 100% completion and
legality, 3.24 s provider p50, 6.63 s p95, and $0.003412 reconstructed cost.
It is a descriptive one-repetition reference, not evidence for tuning or a
reason to spend on repeated Luna trials.

### Duplicate full-game tournament

Fixed states are necessary but do not establish whole-game strength. The
duplicate tournament gives every candidate the same seeded deal in every seat.
It measures score, placement, round wins, score margin, completion, legality,
provider latency, and cost. The evaluation itself has no presentation delay.
Before each current player draws, eligible opponents receive a deterministic
call-or-pass decision in turn-priority order. A successful call enters the real
May I resolution, where higher-priority players respond through the ordinary AI
turn path.

The cheap default is Spark-only and starts in Hand 6: one seed, three seat
rotations, and `spark-minimal` versus `spark-medium` versus `spark-xhigh`:

```bash
bun ai/evals/ai-player-tournament-runner.ts
```

Run a six-hand Spark checkpoint with multiple duplicate deals:

```bash
bun ai/evals/ai-player-tournament-runner.ts \
  --candidate spark-low,spark-medium,spark-high \
  --seed checkpoint-a,checkpoint-b,checkpoint-c \
  --starting-round 1 \
  --max-turns 1200 \
  --run-id spark-checkpoint-v1
```

Validate an isolated prompt experiment against two unchanged Spark anchors.
First run the exact unchanged baseline:

```bash
bun ai/evals/ai-player-tournament-runner.ts \
  --candidate spark-low,spark-medium,spark-high \
  --seed checkpoint-a,checkpoint-b,checkpoint-c \
  --starting-round 1 \
  --max-turns 1200 \
  --run-id go-out-check-baseline-v1
```

Then change only the target prompt while preserving the candidates, seed order,
round, and turn cap:

```bash
bun ai/evals/ai-player-tournament-runner.ts \
  --candidate spark-low,spark-medium,spark-high \
  --prompt-experiment go-out-check-v1 \
  --prompt-addendum-file ai/evals/prompts/go-out-check-v1.md \
  --prompt-experiment-candidate spark-medium \
  --seed checkpoint-a,checkpoint-b,checkpoint-c \
  --starting-round 1 \
  --max-turns 1200 \
  --run-id go-out-check-experiment-v1
```

Compare the saved runs:

```bash
bun ai/evals/ai-player-tournament-run-comparison.ts \
  --baseline .data/ai-evals/go-out-check-baseline-v1 \
  --experiment .data/ai-evals/go-out-check-experiment-v1
```

Luna is never selected implicitly. A one-time direct tournament comparison must
name it explicitly:

```bash
bun ai/evals/ai-player-tournament-runner.ts \
  --candidate luna-xhigh-baseline,spark-minimal,spark-high \
  --seed luna-baseline-a,luna-baseline-b \
  --starting-round 1 \
  --max-turns 1200 \
  --run-id luna-baseline-tournament-v1
```

Tournament suite `duplicate-tournament-v4` includes out-of-turn May I
initiation. Its manifest records the exact scheduling policy: one opportunity
before the draw, eligible callers in priority order, and an incomplete model
decision treated as a recorded pass so the game cannot deadlock. This matches
the product's pre-turn reaction window. It does not re-ask callers after the
current player draws from stock or takes another action, so the focused
`may-i-call-v1` suite remains the sharper diagnostic for initiation judgment.
The manifest stores a complete prompt snapshot for each candidate so the
experimental arm and both unchanged anchors can be audited independently.
Tournament manifests use schema 2 for this per-candidate prompt evidence.

Whole-game skill comparisons are computed at the duplicate-set level, not from
raw individual games. For each seed, both competitors must finish every seat
rotation; their score and placement are averaged across those seats before the
candidate-minus-reference delta is calculated. Lower deltas are better. The
report includes paired 95% confidence intervals and seed-level score
win-tie-loss counts. Incomplete duplicate sets are excluded and named rather
than silently weakening a candidate. One seed is only a cheap smoke test; use
at least three seeds before interpreting tournament uncertainty.

The cross-run comparator adds a second control layer. Within each seed, it
calculates target-minus-anchor score and placement margins in the unchanged and
experimental runs, then reports experimental margin minus baseline margin.
This difference in differences is computed independently against both stable
anchors; negative values are improvements. Confidence intervals use duplicate
seed means as the independent units. The comparator refuses cost-limited or
unknown-cost runs, different seeds or rotations, model/configuration drift,
baseline prompt experiments, and any change to more than one prompt. It writes
`tournament-run-comparison.json` and `.md` to the experiment directory and
reports target completion, legality, provider latency, and cost separately.
This whole-game result is descriptive; it does not replace the repeated
fixed-state promotion gate.

The `--max-turns` safety cap counts model decisions, including out-of-turn calls
and May I responses, rather than only ordinary player turns. Provider latency
and cost likewise include every model decision made to play the game. The
report labels known spend as observed cost and counts decisions whose cost
could not be reported or reconstructed; cost-per-turn is withheld when any are
unknown. One unknown decision marks the seed's run status `unknown-cost` after
all three fairness-preserving seat rotations finish, while retaining the known
subtotal instead of silently converting the missing charge to zero.
Final-score, placement, win-rate, and score-margin aggregates include completed
games only. Incomplete games still count toward completion/legal reliability,
latency, May I behavior, and spend, so a failed game cannot fabricate a cheap
skill win or disappear from operational evidence.

## Rubric v1

Each tactical scenario defines objective criteria totaling 100 points. A turn
must both complete and contain only accepted engine actions before it can earn
quality points. This makes completion and legality hard gates rather than soft
bonuses.

The aggregate report keeps these dimensions separate:

| Dimension              | Measurement                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| Tactical quality       | Mean weighted scenario score, including zeros for hard-gate failures, with a bounded 95% confidence interval |
| Reliability            | Completed-turn rate and all-actions-legal rate                                                               |
| Latency                | Raw model-loop and provider p50/p95; presentation pacing is separate                                         |
| Cost                   | Provider-reported cost when available, otherwise reconstructed token cost                                    |
| Efficiency diagnostics | Input, cache-read, cache-write, output, reasoning tokens, and retries                                        |

Cost or speed never increases the skill score. A cheaper configuration wins
only when its skill is acceptably close to the strongest measured candidate.

## Failure taxonomy

- `provider`: the provider request failed before a complete turn was produced;
- `turn-incomplete`: the model stopped without a terminal game action;
- `illegal-action`: at least one attempted action was rejected by the engine;
- `strategy`: the turn completed legally but missed a tactical criterion;
- `harness-artifact`: the run did not capture enough evidence to judge; and
- `none`: all hard gates and tactical criteria passed.

## Artifacts

Each run writes ignored local artifacts under `.data/ai-evals/<run-id>/`:

- `manifest.json`: candidate identities, prompt version, effort, split,
  repetitions, suite version, harness version, scenario descriptions, rubric,
  exact resolved model slug, transport, model defaults, static provider
  options, dynamic tool-selection policy, and the exact system prompt. Model
  configuration and prompt each have an independent SHA-256 fingerprint.
  Experimental runs
  additionally retain the base prompt identity plus exact strategy addendum and
  their independent fingerprints. Fixed-state and May I runs also record the
  execution-schedule version;
- `cases.jsonl`: one append-only record per attempt, written even when the model
  fails a strategic criterion or cannot complete its turn;
- `summary.json`: machine-readable per-candidate aggregates; and
- `summary.md`: a compact comparison table, matched candidate deltas, and
  per-scenario results; and
- `run-status.json`: whether all planned matched blocks completed or execution
  stopped at the observed-cost threshold or because cost became unknowable,
  including planned/executed counts and any final-block overshoot.

The certified Luna manifest additionally records its primary source run,
replacement source run, exact replaced case key, certification timestamp, and
number of cases replayed through the current harness. It preserves the original
provider timing, token, action, and cost evidence rather than fabricating a new
model run.

Tournament runs use the same directory convention, replacing `cases.jsonl`
with `games.jsonl`. Their manifest also records seeds, seat rotations, starting
round, decision cap, zero evaluation pacing, and known capability limitations.
Their summaries include raw competitor metrics plus seat-controlled,
duplicate-seed score and placement deltas with uncertainty.

### Fast inner loop

Do not use a full Hand 6 game while developing prompts. The default inner loop
is a short real-engine rollout with scripted opponents and a hard cap of three
Spark decisions: two ordinary turns plus one out-of-turn May I decision.

```bash
bun ai/evals/ai-player-short-rollout-runner.ts \
  --run-id spark-low-short-rollout-smoke
```

The rollout tests whether Spark can build one set, recognize and call May I for
the second set, and convert the resulting position into going out on its next
turn. It records tactical quality, completion, legality, provider latency,
wall time, and cost separately. There is no presentation pacing delay in evals.
Use this roughly 20-second check for the first pass over a prompt candidate,
then use the full development fixed-state suite for promotion evidence. Reserve
duplicate full games for occasional final checkpoints after a prompt survives
both faster layers.

Each case record includes the exact rendered state given to the model, actions,
engine outcomes, criterion evidence, failure classification, raw timing, token
buckets, retries, and direct/reconstructed cost. API keys and private reasoning
are never written.

### Matched run promotion gate

Prompt iterations live in separate immutable run directories. Compare a new
Spark run with its unchanged-prompt Spark reference using:

```bash
bun ai/evals/ai-player-eval-run-comparison.ts \
  --reference .data/ai-evals/spark-prompt-v1-development \
  --candidate .data/ai-evals/spark-prompt-v2-development
```

If either run contains multiple candidates, select the two arms explicitly:

```bash
bun ai/evals/ai-player-eval-run-comparison.ts \
  --reference .data/ai-evals/spark-effort-baseline \
  --reference-candidate spark-medium \
  --candidate .data/ai-evals/spark-prompt-v2 \
  --candidate-id spark-medium
```

The comparison refuses to proceed unless both runs use the same suite, harness,
and execution-schedule version, contain exactly the same
scenario/repetition keys, render the
same input state for every pair, use the same rubric, and select the identical
candidate and resolved-model configuration fingerprint. That fingerprint
covers the model slug, transport, output and temperature defaults, provider
reasoning/usage/cache options, and dynamic tool policy. This prevents a test,
state, grading, model revision, provider setting, or effort change from
masquerading as a strategy gain. An
unchanged prompt fingerprint is labeled a `repeatability-check` and cannot be
promoted; a changed fingerprint is a `prompt-experiment`. A budgeted run must
also have a `completed` `run-status.json`; cost-limited or unknown-cost partial
evidence is never eligible for promotion.

The verdict is intentionally skill-first:

- `promote`: mean paired tactical quality improved, the scenario-clustered 95%
  confidence interval excludes zero, at least three distinct scenarios each
  have at least three matched repetitions, no case scored lower, and there is
  no new completion or legality failure;
- `review`: mean tactical quality improved without a new hard-gate failure, but
  evidence is under-repeated or statistically inconclusive, or at least one
  matched case regressed; and
- `reject`: quality did not improve or a previously complete/legal case failed.

Provider latency and cost-per-case deltas are matched and reported next to the
skill result, but cannot turn a weaker player into a promotion. Development and
holdout slices remain separate in the report. Repetitions stabilize each
scenario's paired mean; they do not count as independent strategic examples.
The confidence interval is built across the distinct scenario-mean deltas with
a small-sample Student-t bound, clamped to the possible -100 to +100
percentage-point range.

## Hill-climbing protocol

1. Use the certified frozen Luna baseline; do not spend iteration budget
   rerunning Luna.
2. Run the Spark effort ladder on the unchanged prompt and development split.
   Keep the default observed-cost stop threshold or set `--max-cost-usd`
   explicitly; only a `completed` `run-status.json` is a complete sweep.
3. Choose the cheapest Spark effort whose quality is close to the best Spark
   result and whose reliability is not worse, using
   `ai-player-effort-selection.ts` and its predeclared 2.5-point margin.
4. Freeze effort. Propose at least five materially different, generalizable
   instruction improvements based on development failures.
5. Apply one prompt change at a time. Use one matched repetition as a cheap
   smoke, then run at least three repetitions of every development case before
   promotion.
6. Use the matched run promotion gate. Keep a prompt only on `promote`; gather
   more evidence or inspect case regressions for `review`, and discard `reject`
   changes.
7. Run the holdout only at checkpoints; do not tune wording to holdout cases.
8. Compare that completed checkpoint with the frozen Luna artifact using the
   descriptive baseline report; never rerun Luna for hill climbing.
9. After the tactical suite stabilizes, run an unchanged duplicate-tournament
   baseline and an exactly matched isolated-prompt tournament. Use
   `ai-player-tournament-run-comparison.ts` to measure seed-clustered
   difference in differences against both unchanged Spark anchors; treat the
   result as descriptive whole-game evidence.

Rubric, scenario, harness, and product prompt changes must be recorded as
separate iterations so score movement remains interpretable.

The append-only experiment record is in [ai-player-eval-log.md](ai-player-eval-log.md).
