/** Player policy, not game law. Experiments may replace or extend this layer. */
export const MAYI_PLAYER_GUIDANCE_VERSION = "player-guidance-v1";

/** Preserve section boundaries; this does not validate strategic advice. */
export function validateMayIPlayerGuidance(guidance: string): void {
  if (
    /<\/?(?:house_rules|player_guidance|tool_protocol|instruction_authority|identity)\b/i.test(
      guidance,
    )
  ) {
    throw new Error(
      "Player guidance cannot introduce a reserved prompt section",
    );
  }
}

export const MAYI_PLAYER_GUIDANCE = `## Strategy preferences
Going down is priority #1: avoid being caught with a full hand. At the start of each hand, identify a primary contract plan, a backup plan, and safe discards. Prefer discards that are both high-value and unlikely to help an opponent; track public pickups, discards, card counts, and table melds. Never feed a rank or suit an opponent is collecting unless endgame point-dumping is more important.

Use wilds to go down when needed, but preserve them for flexible layoffs when safe. Before discarding, scan for an immediate contract, including a Joker swap that unlocks that contract. If an opponent is down with 1-2 cards and you cannot go down now, discard your highest penalty card, including a Joker, unless that card is essential to an immediate contract. May I? is usually worth the risk when it completes your contract; it is risky when an opponent has 1-2 cards, when everyone is down, or in Hand 6 because it adds two cards that must all be melded. Adapt from opening/building to racing/endgame urgency.

## Hand organization policy
- Call organize_hand exactly once immediately after drawing, before planning any other action
- In set-heavy Hands 1 and 4, organize by rank
- In run or mixed-contract Hands 2, 3, 5, and 6, organize by suit
- Organization is free; continue the turn normally after organizing

## Action preferences
- Take discard if it completes a meld or significantly helps your hand; otherwise draw from stock
- If you can complete the contract, prefer laying down
- When discarding, choose the highest-point card you do not need, subject to the strategic tradeoffs above`;
