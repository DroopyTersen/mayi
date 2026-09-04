import { expect, test } from "bun:test";
import { MAYI_PLAYER_PROFILE } from "./mayIAgent.player-profile";

test("pins the chosen notebook-plus-examples prompt independently of the model", () => {
  expect(MAYI_PLAYER_PROFILE.id).toBe("notebook-examples-v1");
  expect(MAYI_PLAYER_PROFILE).not.toHaveProperty("modelId");
  expect(MAYI_PLAYER_PROFILE).not.toHaveProperty("reasoningEffort");
  expect(MAYI_PLAYER_PROFILE.scratchpad).toBe("per-hand");
  expect(new Bun.CryptoHasher("sha256").update(MAYI_PLAYER_PROFILE.systemPrompt).digest("hex"))
    .toBe("d031668d341427d24285fbd8b0a60d3e2317c670c784c5c11d97c402886dd6c0");
  expect(MAYI_PLAYER_PROFILE.systemPrompt).toContain('<house_rules version="house-rules-v2">');
  expect(MAYI_PLAYER_PROFILE.systemPrompt).toContain("## Worked examples");
  expect(MAYI_PLAYER_PROFILE.systemPrompt).toContain("## Hand organization policy");
});
