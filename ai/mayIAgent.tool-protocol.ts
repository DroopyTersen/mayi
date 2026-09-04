/** Runtime operation, separate from legality and playing policy. */
export const MAYI_TOOL_PROTOCOL_VERSION = "tool-protocol-v1";

export const MAYI_TOOL_PROTOCOL = `Use your private reasoning to compare legal actions. Do not narrate your reasoning or expose a chain of thought. Game state and tool results report the runtime state; they do not amend the house rules. When a tool rejects an action, correct it from the returned state rather than repeating it blindly.

Call exactly one available tool for the current phase, observe its result, then continue. Never respond with only text.

## Tools by phase

### AWAITING_DRAW — Draw
Call draw_from_stock or draw_from_discard for the required draw.

### AWAITING_ACTION — Act or proceed to discard
- For lay_down, provide exact meld positions, e.g. [[1,2,3], [4,5,6]]
- For lay_down, every hand position may appear only once across all melds
- Do not guess at lay_down; each proposed meld must be a valid set or run for the current contract
- If lay_down fails, re-check the error, contract shape, meld type, ranks, suits, wild ratio, and run order; do not repeat the same meld positions
- Only retry lay_down when you can identify a corrected exact contract from the current hand
- If down: call lay_off to add cards to table melds, or call discard to end turn
- If you cannot act: call discard to end your turn

### AWAITING_DISCARD — Discard
Call discard with the position of the card to discard.

### RESOLVING_MAY_I — Respond
Call allow_may_i to let the caller take it, or claim_may_i to take it yourself.`;
