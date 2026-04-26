import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ALL_CHARACTERS,
  FAMILY_CHARACTERS,
  getCharacterById,
} from "./character.data";

describe("character data", () => {
  it("includes Carter as a selectable family character with avatar assets", () => {
    const carter = getCharacterById("carter");

    expect(carter).toEqual({
      id: "carter",
      name: "Carter",
      description: "Playful little card shark with a bright smile",
      category: "family",
      avatarPath: "/avatars/carter.svg",
    });
    expect(FAMILY_CHARACTERS.map((character) => character.id)).toContain("carter");
    expect(ALL_CHARACTERS.map((character) => character.id)).toContain("carter");
    expect(existsSync(join(process.cwd(), "public/avatars/carter.svg"))).toBe(true);
    expect(existsSync(join(process.cwd(), "public/avatars/carter.png"))).toBe(true);
  });

  it("uses self-contained SVG wrappers for generated PNG avatars", () => {
    const avatarIds = ["carter", "hannah", "maggie-theo"];

    for (const avatarId of avatarIds) {
      const svg = readFileSync(
        join(process.cwd(), `public/avatars/${avatarId}.svg`),
        "utf8"
      );

      expect(svg).toContain("data:image/png;base64,");
      expect(svg).not.toContain(`href="${avatarId}.png"`);
    }
  });

  it("keeps generated SVG wrappers in sync with their PNG avatars", () => {
    const avatarIds = ["carter", "hannah", "maggie-theo"];

    for (const avatarId of avatarIds) {
      const png = readFileSync(join(process.cwd(), `public/avatars/${avatarId}.png`));
      const svg = readFileSync(
        join(process.cwd(), `public/avatars/${avatarId}.svg`),
        "utf8"
      );
      const embeddedPngBase64 = svg.match(/data:image\/png;base64,([^"]+)/)?.[1];

      expect(embeddedPngBase64).toBeDefined();
      const pngHash = createHash("sha256").update(png).digest("hex");
      const embeddedPngHash = createHash("sha256")
        .update(Buffer.from(embeddedPngBase64 ?? "", "base64"))
        .digest("hex");

      expect(embeddedPngHash).toBe(pngHash);
    }
  });

  it("includes Maggie & Theo as one selectable family character with avatar assets", () => {
    const maggieTheo = getCharacterById("maggie-theo");

    expect(maggieTheo).toEqual({
      id: "maggie-theo",
      name: "Maggie & Theo",
      description: "Golden retriever duo keeping a close eye on the table",
      category: "family",
      avatarPath: "/avatars/maggie-theo.svg",
    });
    expect(FAMILY_CHARACTERS.map((character) => character.id)).toContain("maggie-theo");
    expect(ALL_CHARACTERS.map((character) => character.id)).toContain("maggie-theo");
    expect(existsSync(join(process.cwd(), "public/avatars/maggie-theo.svg"))).toBe(true);
    expect(existsSync(join(process.cwd(), "public/avatars/maggie-theo.png"))).toBe(true);
  });

  it("includes Hannah as a selectable family character with avatar assets", () => {
    const hannah = getCharacterById("hannah");

    expect(hannah).toEqual({
      id: "hannah",
      name: "Hannah",
      description: "Warm-hearted player with a sharp eye for the table",
      category: "family",
      avatarPath: "/avatars/hannah.svg",
    });
    expect(FAMILY_CHARACTERS.map((character) => character.id)).toContain("hannah");
    expect(ALL_CHARACTERS.map((character) => character.id)).toContain("hannah");
    expect(existsSync(join(process.cwd(), "public/avatars/hannah.svg"))).toBe(true);
    expect(existsSync(join(process.cwd(), "public/avatars/hannah.png"))).toBe(true);
  });
});
