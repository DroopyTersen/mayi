import { describe, expect, it } from "bun:test";

import { buildSystemPrompt } from "./mayIAgent.prompt";

describe("buildSystemPrompt", () => {
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

    expect(prompt).not.toContain("Aim for 50-100 words max before calling a tool");
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

    expect(prompt).toContain("natural run order is 3, 4, 5, 6, 7, 8, 9, 10, j, q, k, a");
    expect(prompt).toContain("ace is high only, never low or in the middle");
    expect(prompt).toContain("2s and jokers are wild and cannot be natural run ranks");
    expect(prompt).toContain("3-5 players use 2 standard decks and 4 jokers");
    expect(prompt).toContain("6-8 players use 3 standard decks and 6 jokers");
    expect(prompt).toContain("deal exactly 11 cards to each player");
    expect(prompt).toContain("duplicate copies and duplicate suits are valid in sets");
  });

  it("explains the engine's contract boundary without asking for invalid exact-size melds", () => {
    const prompt = buildSystemPrompt().toLowerCase();

    expect(prompt).toContain("submit exactly the required number and type of melds");
    expect(prompt).toContain("each set or run may contain more than its minimum cards");
    expect(prompt).toContain("do not include unrelated extra cards");
  });

  it("prioritizes contract-unlocking Joker swaps and urgent point dumping", () => {
    const prompt = buildSystemPrompt().toLowerCase();

    expect(prompt).toContain("before discarding, scan for an immediate contract");
    expect(prompt).toContain("joker swap that unlocks that contract");
    expect(prompt).toContain("opponent is down with 1-2 cards");
    expect(prompt).toContain("discard your highest penalty card, including a joker");
  });
});
