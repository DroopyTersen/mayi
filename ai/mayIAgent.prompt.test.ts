import { describe, expect, it } from "bun:test";

import { buildSystemPrompt } from "./mayIAgent.prompt";
import { MAYI_HOUSE_RULES } from "./mayIAgent.house-rules";
import { MAYI_PLAYER_GUIDANCE } from "./mayIAgent.player-guidance";
import { MAYI_TOOL_PROTOCOL } from "./mayIAgent.tool-protocol";

describe("buildSystemPrompt", () => {
  it("rejects custom guidance that escapes its player-policy section", () => {
    for (const section of [
      "house_rules",
      "player_guidance",
      "tool_protocol",
      "instruction_authority",
      "identity",
    ]) {
      for (const tag of [`<${section}>`, `</${section}>`]) {
        expect(() => buildSystemPrompt({ playerGuidance: tag })).toThrow(
          "reserved prompt section",
        );
      }
    }
  });

  it("separates the constitution from replaceable player guidance and tool protocol", () => {
    const baseline = buildSystemPrompt();
    const experimental = buildSystemPrompt({
      playerGuidance: "Prefer conservative discards.",
    });
    const rulesSection = (prompt: string) =>
      prompt.match(/<house_rules[^>]*>([\s\S]*?)<\/house_rules>/)?.[1];
    expect(rulesSection(baseline)).toBe(rulesSection(experimental));
    expect(rulesSection(baseline)?.trim()).toBe(MAYI_HOUSE_RULES);
    expect(MAYI_HOUSE_RULES.toLowerCase()).not.toContain("organize");
    expect(MAYI_HOUSE_RULES.toLowerCase()).not.toContain("priority #1");
    expect(MAYI_HOUSE_RULES.toLowerCase()).not.toContain("re-planned");
    expect(MAYI_PLAYER_GUIDANCE).toContain("organize_hand");
    expect(MAYI_TOOL_PROTOCOL).not.toContain("organize_hand");
    expect(experimental).toContain("Prefer conservative discards.");
    expect(experimental).not.toContain("Going down is priority #1");
    expect(experimental).toContain(
      "House rules define legality and take precedence over player guidance",
    );
  });
  it("tells the AI to correct lay_down failures instead of blindly retrying", () => {
    const prompt = buildSystemPrompt();

    expect(prompt).toContain("If lay_down fails");
    expect(prompt).toContain("do not repeat the same meld positions");
    expect(prompt).toContain("Only retry");
    expect(prompt).not.toContain("do not call lay_down again this turn");
  });

  it("includes the critical Grandma Jeanne house rules in the stable instructions", () => {
    const prompt = buildSystemPrompt();

    for (const rule of [
      "same-suit runs require a gap of at least 2 cards",
      "you must draw before any other action",
      "do not lay off on the same turn you lay down",
      "wilds cannot outnumber natural cards when laying down",
      "wilds may outnumber natural cards when laying off",
      "Jokers can be swapped only out of runs, never sets",
      "you may only swap Jokers before laying down",
      "down players are not in line for May I?",
      "a May I? claimant gets the discard plus one penalty card",
      "Hand 6 requires every card in your hand",
      "Hand 6 has no laying off or Joker swapping",
      "when the stock is exhausted, recycle the discard pile except its exposed top card",
    ]) {
      expect(prompt.toLowerCase()).toContain(rule.toLowerCase());
    }
  });

  it("lets the model reason privately instead of prescribing visible chain-of-thought prose", () => {
    const prompt = buildSystemPrompt();

    expect(prompt).not.toContain(
      "Aim for 50-100 words max before calling a tool",
    );
    expect(prompt).not.toContain("Keep your thinking brief and decisive");
    expect(prompt).toContain("Do not narrate your reasoning");
  });

  it("keeps tool orchestration lean instead of duplicating the tool schemas", () => {
    const prompt = buildSystemPrompt();

    expect(prompt).not.toContain("## Tool Reference");
    expect(prompt).not.toContain("CRITICAL: You MUST call a tool");
    expect(prompt).toContain("Call exactly one available tool");
  });

  it("states the engine's card order, wilds, deck composition, and deal invariants", () => {
    const prompt = buildSystemPrompt().toLowerCase();

    expect(prompt).toContain(
      "natural run order is 3, 4, 5, 6, 7, 8, 9, 10, j, q, k, a",
    );
    expect(prompt).toContain("ace is high only, never low or in the middle");
    expect(prompt).toContain(
      "2s and jokers are wild and cannot be natural run ranks",
    );
    expect(prompt).toContain("3-5 players use 2 standard decks and 4 jokers");
    expect(prompt).toContain("6-8 players use 3 standard decks and 6 jokers");
    expect(prompt).toContain("deal exactly 11 cards to each player");
    expect(prompt).toContain(
      "duplicate copies and duplicate suits are valid in sets",
    );
  });

  it("requires exact initial sizes in Hands 1-5 and only permits extensions in Hand 6", () => {
    const prompt = buildSystemPrompt().toLowerCase();

    expect(prompt).toContain(
      "submit exactly the required number and type of melds",
    );
    expect(prompt).toContain(
      "hands 1-5: each initial set must contain exactly 3 cards and each initial run exactly 4 cards",
    );
    expect(prompt).toContain("only hand 6 permits larger initial melds");
    expect(prompt).not.toContain("each set or run may contain more than its minimum cards");
  });

  it("prioritizes contract-unlocking Joker swaps and urgent point dumping", () => {
    const prompt = buildSystemPrompt().toLowerCase();

    expect(prompt).toContain(
      "before discarding, scan for an immediate contract",
    );
    expect(prompt).toContain("joker swap that unlocks that contract");
    expect(prompt).toContain("opponent is down with 1-2 cards");
    expect(prompt).toContain(
      "discard your highest penalty card, including a joker",
    );
  });

  it("always organizes the hand in the contract-relevant order before planning", () => {
    const prompt = buildSystemPrompt().toLowerCase();

    expect(prompt).toContain(
      "call organize_hand exactly once immediately after drawing",
    );
    expect(prompt).toContain("hands 1 and 4");
    expect(prompt).toContain("organize by rank");
    expect(prompt).toContain("hands 2, 3, 5, and 6");
    expect(prompt).toContain("organize by suit");
    expect(prompt).toContain("continue the turn normally after organizing");
  });
});
