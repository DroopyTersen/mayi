import { describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
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
});
