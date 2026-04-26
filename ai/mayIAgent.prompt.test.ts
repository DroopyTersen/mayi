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
});
