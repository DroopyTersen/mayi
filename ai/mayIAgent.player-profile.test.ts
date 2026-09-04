import { expect, test } from "bun:test";
import { MAYI_PLAYER_PROFILE } from "./mayIAgent.player-profile";

test("pins the chosen notebook-plus-examples prompt independently of the model", () => {
  expect(MAYI_PLAYER_PROFILE.id).toBe("notebook-examples-v1");
  expect(MAYI_PLAYER_PROFILE).not.toHaveProperty("modelId");
  expect(MAYI_PLAYER_PROFILE).not.toHaveProperty("reasoningEffort");
  expect(MAYI_PLAYER_PROFILE.scratchpad).toBe("per-hand");
  expect(new Bun.CryptoHasher("sha256").update(MAYI_PLAYER_PROFILE.systemPrompt).digest("hex"))
    .toBe("9a551b08cb4699cfeb2d5d10ab7a131b41134eeac7c969204a0897407183a576");
  expect(MAYI_PLAYER_PROFILE.systemPrompt).toContain("## Worked examples");
  expect(MAYI_PLAYER_PROFILE.systemPrompt).toContain("## Hand organization policy");
});
