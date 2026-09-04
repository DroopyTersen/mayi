/** Game legality only. Canonical human authority: docs/house-rules.md.
 * The pre-existing initial-meld extension discrepancy awaits owner clarification;
 * this extraction does not decide a rule change. Never tune this in a strategy experiment.
 */
export const MAYI_HOUSE_RULES_VERSION = "house-rules-v1";

export const MAYI_HOUSE_RULES = `## Grandma Jeanne house rules
- Six hands; lowest cumulative score wins. Cards score 3-10 face value, J/Q/K 10, A 15, 2 20, Joker 50.
- Contracts: H1 2 sets; H2 1 set + 1 run; H3 2 runs; H4 3 sets; H5 2 sets + 1 run; H6 1 set + 2 runs.
- A set has at least 3 cards of one rank; duplicate copies and duplicate suits are valid in sets. A run has at least 4 consecutive cards of one suit. Natural run order is 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K, A.
- Ace is high only, never low or in the middle. 2s and Jokers are wild and cannot be natural run ranks. Wilds cannot outnumber natural cards when laying down. Wilds may outnumber natural cards when laying off.
- Deal exactly 11 cards to each player. For 3-5 players use 2 standard decks and 4 Jokers; for 6-8 players use 3 standard decks and 6 Jokers.
- For two same-suit runs, same-suit runs require a gap of at least 2 cards between them; never split one longer run into two contracts.

## Turn and contract rules
- You must draw before any other action. Draw one card from stock or discard; a down player may draw only from stock.
- Before going down, submit exactly the required number and type of melds. Each set or run may contain more than its minimum cards when those cards form one valid meld; do not include unrelated extra cards.
- Do not lay off on the same turn you lay down. On later turns, after drawing, lay off to any valid table meld, then discard.
- A discard ends the turn. You may go out without a discard only by playing every remaining card into valid melds.
- Jokers can be swapped only out of runs, never sets. You may only swap Jokers before laying down, and only after the required draw.

## May I? rules
- The top discard is exposed until claimed or replaced by a new discard. A player may call May I? before the current player discards, including after that player draws from stock or acts.
- The current player has first priority before drawing; after drawing from stock they leave the line. Players are checked in turn order. Down players are not in line for May I? and cannot block a caller.
- A May I? claimant gets the discard plus one penalty card from stock. If the stock cannot provide that penalty and cannot be recycled, the hand ends and the penalty is not waived. There is no per-hand May I? limit.

## Hand 6 and stock
- Hand 6 requires every card in your hand to be used in 1 set + 2 runs; laying down immediately wins and needs no discard.
- Hand 6 has no laying off or Joker swapping: nobody is down before winning, there are no table melds, and each May I? adds two cards that must all fit the final melds.
- When the stock is exhausted, recycle the discard pile except its exposed top card into a shuffled stock. If no cards can replenish it, the hand ends and everyone scores their held cards.`;
