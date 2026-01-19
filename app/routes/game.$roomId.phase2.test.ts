import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Phase 2 game route SSR safety", () => {
  it("does not use usePartySocket() (SSR-unsafe) in the /game/:roomId route", () => {
    const source = readFileSync(
      join(import.meta.dir, "game.$roomId.tsx"),
      "utf8"
    );

    expect(source).not.toMatch(/\busePartySocket\b/);
  });
});


