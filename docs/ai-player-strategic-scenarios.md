# Strategic benchmark design — delayed consequences

Status: v9 retains the v8 strategic catalog and corrects the mechanics-only
May I priority fixture's missing legal allow continuation. Root observations
and rubric are unchanged; previous v8 results retain their original identity.
The catalog retains the contract-versus-horizon family (sections 1–2), the
Hand 6 coverage pair (section 3), delayed May I pair (section 4), and shared-run
timing family (section 10), and implements contested-run planning (section 8).
Sections 5–7 and 9 remain designs. The v3 development
suite saturated at 100% for Spark-low; unchanged-player calibrations now expose
misses in several strategic families.
Complete benchmark validation before resuming prompt/effort selection. Keep the
player, organization instruction, and tactical helpers unchanged during this
evaluation-design phase.

V8/scope-v2 adds six cases without changing the player: twelve development
strategy cases across four families, two near-transfer strategic holdouts,
thirteen separate mechanics/robustness cases, and five quarantined cases. The
four original holdouts remain mechanics/robustness. The new holdouts belong to
the contested-run family; they do not establish generalization to unseen
strategic families. Realistic May I/Joker decisions and stale-evidence reversal
coverage remain gaps, not reasons to relabel mechanics as strategy.
See `docs/ai-player-evaluation.md` for exclusions and no-provider inspection.

Rule clarification (2026-09-04): Hands 1–5 require exactly three cards per
initial set and four per initial run. Only Hand 6 permits extensions. Historical
extended Hands 1–5 scenarios remain quarantined negative regression fixtures;
their original scores are not evidence for the corrected rules. The house rules,
player guidance, and tool protocol remain separate prompt layers. A legality
correction is not a strategy improvement or evidence of a higher score.

The missing distinction is not legality or recognizing a ready contract. It is
choosing between legal plans with different outcomes one or two own turns later.
Extra cards alone are not a sufficient difficulty improvement.

## 1. Keep more points now to go out next turn

Hand 2, after drawing, candidate holds:

- 7♣ 7♦ 7♥
- 9♣ 9♦ 9♥
- 4♠ 5♠ 6♠ 7♠
- Q♣ K♣

The table has public sets of nines and queens, a club run from 3 through 8,
and a heart run from 10 through King. No public meld accepts the leftover
sevens. There are exactly two complete candidate contracts, both with a
three-card set and four-card run, independent of the initial-extension dispute:

- Lay three nines and the spade run; discard K♣. Three sevens and Q♣ remain:
  31 points.
- Lay three sevens and the spade run; discard K♣. Three nines and Q♣ remain:
  37 points.

The second line retains more points, yet all four remaining cards can be laid
off next turn. With a stock draw and the final discard, it can go out. The
first line cannot unload its three sevens on the existing table in one turn.

Implemented branches use fixed nonterminal opponent turns followed by either
3♥ or a Joker. Grade going out by the second candidate turn, not retained points
after the first turn.
This is a conditional short-horizon result, not a claim that no hidden opponent
could finish first. Accept every engine-legal plan reaching the same outcome.

## 2. Same hand, but the opponent will finish first

Reuse the candidate cards, public melds, and public prelude from case 1. The
next opponent now has one card instead of three (with the two physical cards
returned to the unobserved stock). Public pickup and
subsequent play history establishes that the retained card is a nine; no nine
has left that opponent's hand since the pickup. That nine fits the public set.

On their next turn they can lay off the known nine and discard their stock draw.
The candidate cannot exit this turn. Now laying three nines is preferable: it
leaves 31 penalty points rather than 37. Keeping future layoff cards is wrong
when there will be no future candidate turn.

Replay the opponent's legal exit and score actual retained penalty. The
candidate must infer the known retained card from public history; never expose
an otherwise hidden card in the prompt. This pair prevents a rule such as
"always save public-meld cards" from acing the benchmark.

All three branches conserve 108 physical cards and replay a fifteen-action
legal public prelude. Full-credit references pass across four hand permutations;
the opposite-contract controls also complete legally but receive zero.

Observation fidelity: the initial calibration compressed the prelude into ten
truthful grouped entries and reused static history on turn two. The app's
then-ten-event limit would also have evicted the original pickup. Local app
retention now covers the current hand. The newer `public-action-history-v1`
rollout journal replays all fifteen actions through the shared app projector
and appends accepted continuation events. Regression tests verify identical
root snapshots across four permutations and that the second decision receives
the opponent's intervening nine layoff. These are still constructed mid-hand
positions, not initial-deal replay or deployed-memory evidence. Other legacy
cases without preludes still use declared fixture history; do not generalize
this family's replay provenance to the entire suite.

Unchanged Spark-low calibration: both safe branches scored 0/4; the urgent
branch scored 4/4. All twelve trials laid nines first, completed legally, and
organized correctly. The successful urgent branch alone therefore does not
establish understanding of the contrast. Existing tactical guidance presents
only the nines contract; it may bias this choice, but the traces do not prove
causation. This measures the configured player, including its guidance, not
the model in isolation. No guidance was changed to fix this family.

Observation-v1 calibration repeats the same 0/4, 0/4, 4/4 outcomes with the
unchanged configured player. Independent replay matched every saved input
(fifteen public events initially, twenty-two at the second decision). All
twelve again chose nines first. This rules out the old truncation/static-history
gap as a sufficient explanation for these observed misses, but does not prove
the causal reason for the plan choice or establish generalized skill.

## 3. Maximize next-turn winning draws in Hand 6

Implemented root after drawing: 9♣ 9♦; 3♥ 4♥ 5♥ 6♥ 8♥ 9♥;
4♠ 5♠ 6♠ 7♠. There is no immediate all-card laydown. Moving 9♥ into the set
reveals competing plans: discard 8♥ to keep a complete minimum contract with
many extension draws, or discard 3♥ to keep a longer but gapped heart run.
Only A♣ is observed outside the hand.

An evaluator-only exhaustive search finds 23 winning physical draws out of 95
unseen cards after discarding 8♥, versus 14/95 after discarding 3♥; every other
discard has zero next-draw wins. An independent Codex partition enumeration
agreed for every discard and draw type. Engine tests execute every positive
winning-draw witness.

Two nonterminal opponent turns lead to either 9♠ or a Joker. Both branches
give 50 points for maximum full-population coverage and 50 for executing the
second-turn win. The narrower legal plan gets zero in the natural branch but
50 in the lucky Joker branch. Thus a lucky win cannot substitute for planning.
These are two branches of ONE root, not two independent strategic families.
The root and pre-second-draw observations match across branches. Full 108-card
inventory and all four hand permutations are checked.

Before selecting a fixture, enumerate the legal next-draw completions for each
discard. Use the two-deck card multiplicities and only information available to
the player. Freeze a declared distribution over remaining unseen cards; do not
choose one lucky hidden stock card and call its preferred discard optimal.

Required fixture property: at least two legal discards have positive winning
draw coverage, with a meaningful gap in that coverage. Publish the oracle
counts in evaluator-only artifacts. Test both planning (winning-draw coverage)
and conversion (does the player recognize and execute the resulting win?).

## 4. May I replenishes the stock—but the hand still ends before your turn

Four-player game. Candidate is off-turn immediately before three down opponents.
Stock has one card. Discard has the exposed contract-completing card plus two
reserve cards. The player is not down and could otherwise profit from calling.

Calling takes the exposed card and the final stock card as penalty. Recycling
keeps one discard exposed and moves only the other reserve into stock. The hand
does not end immediately, but the current down opponent must draw that final
stock card; with only one discard remaining, the hand ends before the caller
can use the newly completed contract. The call adds positive penalty with no
chance to realize its benefit.

Reference and counterfactual tests replay both the penalty draw and the
opponent's forced draw. The pair adds TWO more reserve cards: the caller
survives three opponent turns and lays down two exact three-card sets on the
next own turn. Passing cannot realize that contract in this continuation.

The initial three-player draft conserved 108 cards but was unreachable by hand
count parity. It was corrected before provider calibration. Both four-player
fixtures conserve 108 cards; candidate starts with 11, down opponents with
25/25/25 (short reserve) or 25/25/23 (larger reserve), with six public cards each.
These are deliberately rare, claim-heavy stock boundaries, not opening-play
examples. Inventory, necessary reachability invariants, and engine continuations
are verified; a complete historical deal/claim sequence has not been replayed.

Owner feedback: this is too contrived to represent ordinary strategic skill.
Retain it as stock-boundary robustness coverage, not as the reason to select a
player configuration. Historical artifacts remain unchanged. V7 labels both
branches robustness and separates their scores from strategy; they remain
available as regression diagnostics. Quarantine blocks rule-dependent cases.
This is a prospective scope change, not retrospective removal of a low score.

## 5. Defensive claim versus useful-looking self-improvement

Create a May I response with a card that does not advance the candidate's own
contract. Public history and a small opponent hand/plan make it valuable to
the caller. Claiming incurs a short-term burden but blocks a near-term exit;
allowing preserves the candidate's attractive plan but loses the hand.

Pair with a state where the apparent threat has already disappeared (the
relevant cards were publicly discarded or played, or the opponent became down
and cannot take discard). Require updating the threat estimate instead of
following a permanent rank blacklist.

These are judgment scenarios unless the public history establishes the threat
uniquely. Score across predeclared opponent continuations, not a single hidden
hand selected after seeing the candidate's action.

## 6. Preserve a backup plan, then pivot using new evidence

Build an incomplete contract with two overlapping plans sharing one flexible
card. A short-term discard can lock the candidate into the apparently closest
plan, while another preserves both paths. On the next turn, a public pickup,
discard, or meld changes which plan is practical.

Use paired branches with the identical initial observation and opposite later
evidence. A strong player preserves the option initially and then switches or
stays for the right reason. A script that always chooses one suit/rank must
lose one branch. Grade the reachable contract/exit and retained penalty after
two or three candidate turns, not a persuasive explanation.

## 7. A down next player is not the only possible discard recipient

Start with two expendable cards of comparable value to the candidate. The next
player is down, so cannot take either discard. In one branch, every other
opponent is down too: there is no reason to retain a card solely because it
would have helped the next player before they laid down. In the paired branch,
a farther player is still up and has publicly retained cards that make one
discard dangerous via May I. The same next-player status no longer makes that
discard safe.

Build the public evidence through real draws and removals; establish only the
threat warranted by those observations. Score actual contract/exit consequences
across declared continuations. The rules determine eligibility and priority;
the decision about which eligible opponent to protect against is strategy.
Include current-player-before-draw versus after-stock-draw priority where it
changes the consequence, without implying that a down player can block a claim.

## 8. Choose the less-contested run, but do not abandon a better plan blindly

Implemented in v8. Hand 5, after drawing: Q♣ Q♦ Q♥, K♣ K♦ K♥,
5♦ 6♦ 7♦, and 5♠ 6♠ 7♠. The two sets plus two incomplete runs fill all
twelve slots. A discard must weaken a run or break a completed set; there is
no unrelated singleton to throw away. Seventeen actual public events, replayed
from a complete eleven-card deal, establish that an opponent picked up and
still retains one 4♦ and one 8♦. Both pickups are older than the newest ten
events. All 108 physical cards are conserved.

An evaluator-only exhaustive oracle considers every discard and all physical
unobserved draw copies. With nine publicly known cards outside the candidate's
hand, 87 cards are unobserved. Under an explicitly exchangeable unobserved-card
model, conditional on surviving to the next stock draw without claims or
recycling, preserving spades leaves sixteen completing copies: twelve wilds
and four natural endpoints. Preserving diamonds leaves fourteen. Breaking
either set leaves zero one-draw completions. These are conditional draw
coverage counts, not actual-stock probabilities inferred from omniscience.

Four development branches cover the natural continuation, a Joker continuation
that can rescue the inferior plan, a suit mirror, and a reversal. In the
reversal the spade alternative is 3♠ 4♠ 5♠ and the observed diamonds are
4♦/10♦: the contested diamond run retains fifteen outs versus fourteen for
spades. The 2♠ is wild, already counted among the twelve wilds, not a second
natural endpoint. A blanket instruction to avoid the contested suit loses.

The first discard earns 50% for maximum exact-contract draw coverage; the
second own turn earns 50% for actually laying down. Exact initial melds are
3+3+4; the oracle rejects the production solver's oversized alternatives.
All tied best run-card discards are accepted. Legal opposite-plan controls
score zero under natural continuations and 50% under the lucky Joker draw.
No script assumes the model knows the future. This is not a global claim about
discard safety, inferred opponent intent, feeding rivals, or expected score;
the continuation declares nonterminal opponents drawing stock.

Two rank-shifted high-run/boundary variants are held out from model tuning.
They are near-transfer checks of this same family, not independent families.
Independent raw-card enumeration confirmed the canonical oracle's physical
counts and exact-size witnesses without relying on production meld validation.

Still proposed: a branch where an opponent lays down and creates a diamond
layoff destination. Retain useful diamonds only if doing so preserves the
candidate's own contract path; reverse the result when carrying them delays
laydown. Also test publicly disposed pickups rather than treating a suit as a
permanent blacklist (section 9).

Scoring limits: losing the binary 50-point planning criterion for choosing
fourteen instead of fifteen outs is not a fifty-point expected-score loss.
The model also receives the existing legal-contract helper on its second
turn; conversion measures using that assistance, not unaided meld discovery.

Unchanged Spark-low calibration: four development cases × four repetitions,
concurrency four, no pacing. Planning succeeds in 6/16 trials and conversion
in 10/16, yielding 50% rubric quality. Natural diamonds, wild diamonds, mirrored
spades, and stronger-diamonds reversal score 25%, 50%, 50%, and 75% respectively.
All sixteen trials complete legally and organize both candidate turns. Total
cost is $0.024339144; provider p50/p95 per decision is 9,852/23,633 ms. The four
Joker trials all choose the weaker plan but still convert, demonstrating why
outcome and planning must be separate. No holdout model was run. This is
selected-family difficulty evidence, not a player improvement or whole-suite
ranking. Artifacts: `.data/ai-evals/spark-low-v8-contested-run-calibration-20260903/`.

## 9. Retire stale evidence instead of keeping a permanent blacklist

A player picked up 8♦ many turns ago. Compare one history where that physical
card is still retained with another where it was publicly discarded, laid
down, or swapped into a run. The candidate should update its threat or supply
estimate. A later pickup by a different player transfers the evidence; it
does not erase it. Include duplicate-copy cases so matching a visible rank
and suit alone cannot justify tracking a unique hidden card.

Use the app's actual public events, with the relevant pickup older than ten
entries and continuation events appended after every transition. Keep private
stock draws and May I penalty faces hidden. Separate factual tracking accuracy
from strategic quality: identifying who can still hold a known card is one
measurement; deciding what to discard given that evidence is another.

## 10. A useful public run extension can help the opponent first

Implemented in v6. Everyone is down. The candidate holds 5♠ K♣ A♣ after
drawing. A public run is 6♠–9♠. The next opponent has one card: public history
records their earlier pickup of 4♠, with no later public removal of any 4♠.
Two physical copies do not invalidate that retained-face deduction.

Playing 5♠ now reduces the candidate's hand, but enables that opponent to
draw, lay off 4♠, and discard their draw to win. Holding 5♠ and discarding
either liability preserves an exit chance. The declared opponent draw is not
playable elsewhere, so the candidate gets another turn: either Q♣ or a Joker
fits the public queens, then 5♠ plays and the remaining liability is discarded.

The reversal replaces K♣ with 10♣, which already fits a public 3♣–9♣ run.
Now the candidate can play both cards and discard A♣ immediately. Withholding
the bridge wastes a certain win. These are three branches of one strategic
family, not three independent roots. Rubrics accept any legal winning line,
including either first-turn liability discard in the delayed branches.

All 108 physical cards are conserved. The candidate sees seventeen replayed
public actions; actual continuation events append before later decisions.
Independent reconstruction, now a regression test, reaches each physical card
position using a nine-action prefix from three eleven-card hands, an empty
table, and no down players. This normalizes generated meld IDs/table display
order; it does not claim the fixture's seventeen-event observation includes
that extra prefix or is a naturally sampled game. Initial melds use exact
three-card sets and four-card runs, avoiding the disputed extension rule.

The opponent's responsive policy reads only its own hand and the public table.
It plays the known 4♠ if the bridge was opened. A legal early loss completes
the rollout; the harness must not ask the model for a nonexistent second turn
or classify the loss as provider failure. Reference and inferior controls
verify these semantics through the real engine.

This is conditional short-horizon evidence, not global expected-score
optimality. A different opponent draw might allow an exit even without the
bridge. Natural/Joker canonical root observations match exactly; later
repetitions use scenario-keyed hand ordering and need not match across branches.
No future draw or evaluator objective is included in the model observation.

Unchanged Spark-low calibration: delayed natural 0/4, delayed wild 0/4,
immediate win 4/4. All trials complete legally and organize correctly. In all
eight delayed trials Spark lays off 5♠, discards A♣, and loses before its next
turn, retaining K♣ for ten points. The second-turn conversion is therefore
not exercised by this player. Provider decision p50/p95: 9,656/11,532 ms;
twelve trials cost $0.007155. This validates difficulty, not a player change
or a whole-suite score. No strategy instruction was added to solve this case.

## Evaluation protocol

- First implement legal reference trajectories and inferior legal controls.
  A wrong line must fail on outcome, not merely through an illegal-action gate.
- Make branches consistent with an actual two-deck deal and public history.
  Include a conservation check for unique card IDs and multiplicities.
- Freeze roots, branch distributions, rubrics, and opponent policies before
  trying candidate configurations. Keep opponent hands and future draws hidden.
- Run each scenario/branch four times with paired hand permutations. Separate
  model nondeterminism from variation in possible future worlds.
- Report whole-suite results for every configuration, with tactical regression
  and strategic scores separately visible. Never select on one scenario.
- Keep broad failure families and untouched holdouts. Do not drop passing
  cases or tune prompts to failing fixture identities.
- During benchmark construction, run the unchanged selected Spark player only
  to establish difficulty. Do not change its instructions or helpers to improve
  the new benchmark score.
- Do not restart effort/prompt selection if the new strategic suite is still
  saturated. At least several cases across multiple strategic families must
  leave repeatable headroom, rather than one provider error creating a lower
  aggregate.
- Keep runs bounded to a few candidate turns and parallel independent trials;
  full six-hand tournaments remain infrequent validation, not the inner loop.
