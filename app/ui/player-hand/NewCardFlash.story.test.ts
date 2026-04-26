import { describe, expect, it } from "bun:test";

describe("NewCardFlashStory", () => {
  it("does not generate random card IDs at module scope", async () => {
    const source = await Bun.file(
      new URL("./NewCardFlash.story.tsx", import.meta.url)
    ).text();
    const beforeComponent =
      source.split("export function NewCardFlashStory")[0] ?? source;

    expect(beforeComponent).not.toMatch(/\bnextId\(\)/);
    expect(beforeComponent).not.toMatch(/\bcrypto\.randomUUID\(\)/);
    expect(beforeComponent).not.toMatch(/\bMath\.random\(\)/);
  });
});
