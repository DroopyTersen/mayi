import { describe, expect, it } from "bun:test";
import {
  OPENROUTER_MUSE_CHAT_SETTINGS,
  createOpenRouterMuseChatSettings,
} from "./openrouter-muse-profile";

describe("OpenRouter Muse profile", () => {
  it("uses the locked low-effort player configuration while retaining usage accounting", () => {
    expect(OPENROUTER_MUSE_CHAT_SETTINGS).toEqual({
      reasoning: { effort: "low", exclude: true },
      usage: { include: true },
    });
  });

  it("creates auditable effort variants without changing usage accounting", () => {
    expect(createOpenRouterMuseChatSettings("high")).toEqual({
      reasoning: { effort: "high", exclude: true },
      usage: { include: true },
    });
  });
});
