# Structured notebook and worked examples

This is the bounded follow-up requested after the previous wrap-up: combine the
model-maintained ledger with its existing per-hand scratchpad, then test worked
examples. Keep the existing tactical hints. No tactical solver or committee.

## Selected configuration (2026-09-04)

Drew chose **notebook + examples** after reviewing both runs, then clarified
that Spark should be the default and player execution should be model-agnostic.
This supersedes the pending-promotion status in the historical results below.

New app/CLI players and web quick-starts now default to
`meta/muse-spark-1.3-contributor` through OpenRouter, at **low** reasoning effort.
Existing explicitly selected models are not silently changed. Every model uses
the same `executePlayerTurn` entry point and `notebook-examples-v1` profile.
Provider selection and static API settings are the only model-specific parts.

The selected full prompt is byte-identical to the evaluated example variant:
`9a551b08cb4699cfeb2d5d10ab7a131b41134eeac7c969204a0897407183a576`.
House rules, hand-organization guidance, tactical hints, and the ten-second app
reaction window are unchanged. The notebook remains model-written private
intent, not authoritative rules or automatically inferred opponent knowledge.

Completed-turn notes persist privately in `ai:notebook:` Durable Object keys
or the CLI's `ai-notebooks.json`, separate from public game state and activity.
They are checked against game/player/hand identity, expire at hand end, and
are not replaced by aborted or unfinished proposals. The normal May I response
path can read them; this change does not add autonomous May I initiation to the
app. Explicit eval controls remain opt-in calls to the underlying agent.

The Luna-only response-continuation, compaction, instruction-cache, and tool
selection branches and their obsolete tests were removed. Luna remains an
optional provider with static xhigh settings and no stored-response chain.
Old continuity files/keys are unused, not deleted. Frozen evaluation artifacts
and the older 57.29% checkpoint remain untouched and recoverable.

This is a user-approved local promotion, not another score experiment or a
deployment. The mixed results and reliability caveats below still apply.

Validation: 870 local tests passed (24 live tests skipped), typecheck and the
production build passed, and a separate two-turn live Spark smoke test passed.
Both turns completed legally, the second read the first turn's persisted note,
and public saves/activity did not contain it. Measured provider time was
11.21 / 11.12 seconds; combined provider-reported cost was $0.0034967. This is
integration evidence, not a new strategic score or latency guarantee.

## Exact repeat and retention decision

After the first run, Drew requested an unchanged repeat and said to keep the
notebook if it consistently added about four or five points. Another 252 trials
completed: all three variants, the same 21 cases, four repetitions each.

| Strategy score | First run | Repeat | Pooled |
| --- | ---: | ---: | ---: |
| Control | 52.08% | 47.92% | 50.00% |
| Structured notebook | 54.17% | 54.17% | 54.17% |
| Notebook + examples | 50.00% | 64.58% | 57.29% |

The notebook's matched gains were **+2.08 and +6.25 percentage points**, or
**+4.17 pooled**. That is a positive direction in both runs and an average gain
in the requested range, not a four-to-five-point gain in each run. All of its
strategy improvement remains in contested-run planning. Contract horizon and
shared-run timing remain 33.33%; Hand 6 coverage remains 100% in every arm.

Examples changed direction: -2.08 then +16.67 points against control, or -4.17
then +10.42 against the notebook alone. Their 7.29-point pooled lift over control
is real arithmetic, but these two runs do not demonstrate consistent benefit.
Do not select only the favorable repeat or call the first result definitively
harmful. The repeated families and hand permutations are correlated; there is
no claim of a population confidence interval or full-game win-rate improvement.

The notebook also has real tradeoffs. All 168 notebook cases completed with
legal engine actions, but there were ten recovered three-line note rejections
in 904 requests (98.89% success). Four of 247 eligible turns skipped organization
(98.38% compliance); all four nevertheless won legally. Control had no rejected
requests or missed sorts. Examples had no rejected requests and one missed sort
in 248 opportunities. The notebook misses were repeat Hand 6 take-discard rep3,
Hand 6 preserve-natural rep1, preserve-wild rep2, and shared-run immediate-win
rep4. These remain player-policy misses, not illegal wins or altered score grades.

At the end of the repeat, the notebook met the requested *pooled score* target
but not the earlier request/organization gates, so promotion awaited Drew's
choice. Drew subsequently selected notebook + examples; see the configuration
above. That choice does not erase the observed regressions or mixed results.

Repeat robustness was 80.56% / 86.11% / 88.89%; pooled robustness was 83.33% /
86.11% / 88.89%. These are bounded mechanics diagnostics, not representative
strategic win rates. Both memory-enabled arms again had 92 commits and 52 actual
later reads, with empty initial notes; no May I decision read a nonempty note.

Repeat ordinary provider p50/p95 was 8.74/22.57 seconds for control,
11.56/27.00 for notebook, and 10.99/27.52 for examples. The repeat cost $0.31907;
both comparisons together cost **$0.66468** for 504 trials. Pooled notebook cost
was 25.29% above control. These costs and timings retain the limitations below.

Both repeats used the same model and full prompt hashes. The 159-file repeat
freeze adds only its launcher/protocol files to the original 155-file freeze;
no product source was changed. All children exited successfully, and root replay
verified the repeat's 252 records, 432 inputs, 1,341 tool outputs, 2,426 engine
attempts, 288 memory transitions, and 168 paired initial public inputs without
discrepancies. The two full-population repeat tests also passed.

Independent final audits covered all 252 repeat records; exact hashes and grades
matched. Strict organization was 364/369, with the five real omissions detailed
above (four notebook, one examples). The unchanged Hand 1 fixture label conflict
is separately recorded and still causes no numerical disagreement.

The recoverable snapshot is
`.data/ai-evals/notebook-examples-replication-v1-20260904/preserved-configurations.json`:
159 exact source/dependency files, all three model/prompt configurations, both
runs' outcomes, and 35 hashed evidence artifacts. Its SHA-256 is
`d6f53a8ff3a198ee0565f4df0dba2d758b9e912616210f88e4d622c0fd3f4eeb`.
Credentials are excluded. This is separate from the older 57.29% checkpoint;
the matching pooled examples number is coincidental, not the same candidate.

## First run result

Historical first-run decision: neither variant cleared the prospective promotion
screen, so both remained opt-in pending the repeat and Drew's later selection.

| Variant | Strategy | Robustness | Ordinary turn p50 / p95 | Recorded cost, 84 cases |
| --- | ---: | ---: | ---: | ---: |
| Control | 52.08% | 86.11% | 9.38 / 24.19 s | $0.09634 |
| Structured notebook | 54.17% | 86.11% | 11.90 / 29.30 s | $0.12066 |
| Notebook + examples | 50.00% | 88.89% | 12.26 / 33.85 s | $0.12861 |

All 252 cases completed with legal engine actions and correct observed hand
organization. Total recorded cost was **$0.34561**. Ordinary-turn timings are
provider time, not a guaranteed ten-second minimum or user-visible pacing.

The notebook gained 2.08 strategy percentage points, below the predefined five
point threshold, and cost 25.25% more. Its four rejected requests were attempts
to put three lines in the two-line notebook; all recovered. Request success was
451/455 (99.12%), below the 99.5% gate. Control was 446/446; examples were 448/448.
There were no provider errors or unresolved requests.

Adding examples lost 4.17 strategy points versus the notebook, including a
12.5-point loss in the contested-run family, exceeding the ten-point family-loss
gate. Robustness improved 2.78 points. Against control, the combined package
lost 2.08 strategy points and cost 33.50% more. Neither observation is replicated
evidence or a full-game win-rate claim.

Only contested-run strategy changed: 56.25% / 62.50% / 50.00%. Every arm remained
33.33% on contract horizon, 33.33% on shared-run timing, and 100% on Hand 6 draw
coverage. The added instructions did not solve the difficult multi-turn planning
failures in this suite. Paired gains/losses/ties were 5/4/75 for notebook versus
control, and 5/6/73 for examples versus notebook.

### Did Spark actually use memory?

Yes, in the limited sense that committed notes were present in later model
inputs. Each notebook arm had 144 traced decisions, 92 committed notes, and 52
later reads across nine scenarios. Every opening note was empty. All 52 reads
were ordinary turns: this comparison does **not** exercise a May I decision with
nonempty prior memory. Input inclusion does not prove a note caused a choice.

The examples improved formatting: all 108 accepted note proposals contained the
four labels, versus 93/105 without examples. Thirteen and sixteen proposals,
respectively, were deliberately discarded when the hand ended; these were not
persistence failures. Correct formatting did not ensure accurate state or a
good plan: reviewers found stale pre-discard plans, unsupported observations,
and unavailable future actions in some notes. No direct copying of the teaching
examples' facts was found. The inconsistent future-layoff fixture is separated
from realistic strategic evidence when assessing its misleading notes.

## Implementation

`ai/mayIAgent.notebook-guidance.ts` contains two optional guidance variants:

- `player-notebook-v1`: distinguish **Observed**, **Suspected**, **Plan**, and
  **Reconsider** in the existing two-line, 400-character private notebook.
- `player-notebook-examples-v1`: the same instructions plus six partial teaching
  examples covering contested suits, stale opponent beliefs, future layoffs
  versus own-contract needs, and concrete versus speculative May I value.

Spark writes the note itself through `discard.strategy_note`. Nothing extracts
facts or chooses a strategy for it. Notes commit only after a completed ordinary
turn, stay private to that game/player/hand, and reset when the hand changes or
ends. May I decisions can read prior notes but cannot write them. A note is a
fallible player summary, not a reasoning transcript or authoritative state.

These are player instructions, not house rules. The unchanged house rules and
current observations outrank the notebook. Both variants preserve existing
tactical hints, rule/tool prompt components, and the hand-organization policy.
The feature is opt-in; no app model or prompt default changes in this experiment.

## Comparison design

Three fresh Spark-low Contributor arms each receive all 21 eligible development
scenarios, repeated four times: 48 strategy records and 36 robustness records
per arm. Compare control to notebook, then notebook to notebook-plus-examples;
the combined contrast is descriptive too. Initial public observations are
paired, and each trial's notebook starts empty.

All three use the same imperative tactical hints, reasoning effort, v11 suite,
h8 harness, schema 7, and concurrency four per arm. There is no conversation or
reasoning replay, cost cap, pacing delay, Luna comparison, or paid holdout run.
Sources, full prompts, model configuration, and initial observations were frozen
before dispatch. No partial-result tuning or replacement samples are allowed.

This tests the notebook package (storage plus instructions), not the isolated
effect of memory storage. Only later decisions with a committed note test
recall, but opening decisions remain in all headline scores. The twelve strategy
cases cover four correlated families, not twelve independent skills or full-game
win rates. Provider timings exclude presentation pacing and reflect concurrent
load. Recorded costs are not an invoice.

Before the comparison, a separately tested v11 fixture correction made the
future-layoff opponents discard the card they actually drew. Its original stock
branch and legal alternative discard-draw branch both replay to full credit.
Historical v10 results remain unchanged; a v10-to-v11 score difference must not
be described as a player improvement. That position remains fixture-only, with
public-meld/down-flag inconsistency, rather than realistic strategic evidence.

## Evidence and cleanup

Protocol, exact prompts, launcher, raw run references, audits, and comparison:
`.data/ai-evals/notebook-examples-v1-20260904/`.

First-run verification: all 252 records replayed through the real engine and
tools, including 432 decision inputs, 1,349 requests, 2,440 engine attempts and
288 memory transitions. Two independent reviewers covered all 252 exact-hashed
records; grades matched. They separately verified 371/371 organization
opportunities and identified the latent Hand 1 fixture label conflict (twelve
records, no numerical effect). Sources stayed frozen. Focused product/harness
tests, full typecheck, two full-population artifact tests and diff check passed.

The user then requested an exact repeat. Its separate protocol and artifacts
live at `.data/ai-evals/notebook-examples-replication-v1-20260904/`; original
results and all unsuccessful requests remain intact.

The original 57.2917% candidate remains preserved at
`.data/ai-evals/neutral-contract-hint-replication-v1-20260904/preserved-candidate.json`.
It is a recoverable historical checkpoint, not a replicated score guarantee.

Two unused standalone prompt remnants were moved out of active source into the
experiment's `retired-prompts/` directory: `complete-plan-ranking-v1.md` and
`contract-hand-organization-v1.md`. Both are recoverable. Active organization,
tactical hints, scratchpad capabilities, and historical evidence remain intact.
No staging, commit, merge, deployment, credentials, or account changes.
