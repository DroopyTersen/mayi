import { describe, expect, it } from "bun:test";
import { FAMILY_CHARACTERS } from "~/ui/lobby/character.data";
import { AVATAR_ANIMATIONS } from "./avatar-animation.data";

describe("family avatar animations", () => {
  it("records readable prompts for reproducing the artwork", async () => {
    const path = new URL("../../../docs/avatar-animation-prompts.json", import.meta.url);
    const prompts = await Bun.file(path).json();
    expect(typeof prompts.fullPortraitRevisionPrompt).toBe("string");
    expect(typeof prompts.fullPortraitRevisionSequences.turn).toBe("string");
  });

  for (const character of FAMILY_CHARACTERS) {
    it(`provides all three animation sheets for ${character.name}`, async () => {
      for (const sequence of ["turn", "lay-down", "lay-off"] as const) {
        expect(AVATAR_ANIMATIONS.get(character.id)).toContain(sequence);
        const path = new URL(`../../../public/avatars/animated/${character.id}-${sequence}.webp`, import.meta.url);
        expect(await Bun.file(path).exists()).toBe(true);
      }
    });
  }
});
