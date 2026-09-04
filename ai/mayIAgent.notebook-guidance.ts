/** Optional player guidance, never authoritative game rules or an automatic ledger. */
export const MAYI_NOTEBOOK_GUIDANCE_VERSION = "player-notebook-v1";
export const MAYI_NOTEBOOK_EXAMPLES_VERSION = "player-notebook-examples-v1";

export const MAYI_NOTEBOOK_GUIDANCE = `## Private player notebook
You maintain your own notebook using the existing per-hand scratchpad. It starts empty each hand; nothing is inferred or recorded for you. Read it with your current hand and public history before deciding. Its entries are model-written summaries, not verified facts, rules, or obligations to stick to a plan. Current observations and authoritative house rules take precedence.

Use four compact labels in two nonempty lines, at most 400 characters total:
Observed: concrete evidence from your own hand or public observations worth remembering. Suspected: a tentative interpretation, explicitly uncertain.
Plan: your current contract or exit route and a useful backup if space permits. Reconsider: specific evidence that would change this plan.

Keep only information useful to later decisions, not a complete event log or a reasoning transcript. Distinguish a pickup from a claim that the player still holds or wants the card. Review later disposals, table changes, turn order and claim eligibility; revise or delete stale beliefs. Duplicate card faces do not identify a unique physical copy. Do not invent hidden cards, exact odds, or future draws. If there is no useful observation or inference, say none or unknown rather than filling the space with a guess.

Before a normal discard, include the updated notebook as strategy_note alongside the existing discard call. Reflect the hand you will have after that discard; use card faces, not shifting hand positions. Keep still-relevant evidence and replace obsolete intent. Do not make a separate model call or delay a winning move merely to write a note. No next-turn note is needed when the hand ends. May I decisions read the prior notebook and current public history but cannot write a note through their tools.

The notebook supports your existing player guidance and tactical hints; it does not change legal actions, hand organization, or the game rules.`;

interface MayINotebookExample {
  observation: string;
  decision: string;
  note: string;
}

/** Partial teaching situations, not full-game optimality claims or benchmark answers. */
export const MAYI_NOTEBOOK_EXAMPLES: readonly MayINotebookExample[] = [
  {
    observation: "Lee earlier took 4-clubs and 5-clubs. Your club and heart run starts are similarly developed, and no opponent looks close to finishing.",
    decision: "Treat clubs as possibly contested, not impossible. Favor the comparable heart route if it preserves your own contract; a cheap club backup can remain useful.",
    note: "Observed: Lee took 4C then 5C. Suspected: may want a club run, not certain.\nPlan: favor hearts while routes are comparable; retain a cheap club backup. Reconsider: a stronger club draw or contrary public evidence.",
  },
  {
    observation: "Later Lee puts 4-clubs and 5-clubs into a table run, then discards 6-clubs. Lee is now down. Your notebook still says Lee is collecting clubs.",
    decision: "Retire the old assumption of ongoing discard demand. The down player cannot claim your discard, but other eligible players still may; visible melds can also create later layoffs.",
    note: "Observed: Lee laid the club run and discarded 6C; now down. Suspected: old club-demand signal is stale.\nPlan: reassess my run routes and all eligible claimants; consider public layoffs only after my contract. Reconsider: new draws or table changes.",
  },
  {
    observation: "An A-diamonds outside your complete contract could later join a public ace set. Keeping it does not break your contract, and another unused card can be discarded.",
    decision: "A future layoff can justify retaining the ace when a later turn is plausible. Compare that exit route with the ace liability; a future turn is not guaranteed.",
    note: "Observed: my contract is complete without AD; public ace set accepts it on a later eligible turn. Suspected: another turn is plausible, not certain.\nPlan: preserve AD if the exit route outweighs its liability. Reconsider: an opponent nearing out or changed public melds.",
  },
  {
    observation: "In a different hand, the same A-diamonds is essential to your best own-contract route. An optional side plan is occupying space needed to finish that contract.",
    decision: "Do not value an imagined future layoff as if you were already down. Preserve the viable own-contract route; abandon the side plan when its opportunity cost is too high.",
    note: "Observed: AD is part of my own-contract route; I am not down. Suspected: the side plan costs needed flexibility.\nPlan: complete my contract first; do not reserve cards solely for unavailable layoffs. Reconsider: a draw that completes a cheaper alternative contract.",
  },
  {
    observation: "An exposed 10-hearts directly completes your planned contract. You can call May I, but the award would also bring an unknown penalty card.",
    decision: "Consider the claim because it advances a concrete plan, while checking priority, added burden and whether you are likely to act. Do not treat the penalty as a known useful card.",
    note: "Observed: exposed 10H completes my planned contract; May I also adds an unknown card. Suspected: claim value depends on priority and time to act.\nPlan: compare claiming with keeping the current route. Reconsider: another claimant, changed turn order, or imminent hand end.",
  },
  {
    observation: "In a different position, 10-hearts only creates a speculative backup pair, your primary contract route is still far away, and a down opponent has very few cards.",
    decision: "Do not carry the previous claim decision across changed circumstances. The speculative improvement may not justify two additional cards and their liability; reassess rather than claiming from habit.",
    note: "Observed: 10H only adds a backup pair; my contract is distant and a down opponent has few cards. Suspected: extra-card liability may outweigh the backup.\nPlan: favor the viable primary route and limit speculative burden. Reconsider: a card that directly completes my contract.",
  },
];

export function buildMayINotebookGuidance(includeExamples = false): string {
  if (!includeExamples) return MAYI_NOTEBOOK_GUIDANCE;
  const examples = MAYI_NOTEBOOK_EXAMPLES.map((example, index) =>
    `${index + 1}. Observation: ${example.observation}\nDecision lesson: ${example.decision}\nNotebook example:\n${example.note}`,
  ).join("\n\n");
  return `${MAYI_NOTEBOOK_GUIDANCE}\n\n## Worked examples\nThese are partial teaching situations, not your current hand. Never copy their facts into your notebook. Apply the distinction, not a memorized move.\n\n${examples}`;
}
