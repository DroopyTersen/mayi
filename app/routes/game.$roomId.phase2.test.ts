import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

describe("Phase 2 game route SSR safety", () => {
  it("does not use usePartySocket() (SSR-unsafe) in the /game/:roomId route", () => {
    const source = readFileSync(
      "/Users/drew/code/mayi/app/routes/game.$roomId.tsx",
      "utf8"
    );

    expect(source).not.toMatch(/\busePartySocket\b/);
  });
});


