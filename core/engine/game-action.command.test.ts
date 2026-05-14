import { describe, expect, it } from "bun:test";
import { gameActionSchema } from "./game-action.command";

describe("gameActionSchema", () => {
  it("accepts valid game actions", () => {
    expect(gameActionSchema.safeParse({ type: "DRAW_FROM_STOCK" }).success).toBe(true);
    expect(
      gameActionSchema.safeParse({ type: "DISCARD", cardId: "card-1" }).success
    ).toBe(true);
    expect(
      gameActionSchema.safeParse({
        type: "LAY_DOWN",
        melds: [{ type: "set", cardIds: ["card-1", "card-2", "card-3"] }],
      }).success
    ).toBe(true);
  });

  it("rejects malformed game actions", () => {
    expect(gameActionSchema.safeParse({ type: "DISCARD" }).success).toBe(false);
    expect(
      gameActionSchema.safeParse({ type: "LAY_DOWN", melds: [{ cardIds: [] }] }).success
    ).toBe(false);
    expect(gameActionSchema.safeParse({ type: "DANCE" }).success).toBe(false);
  });
});
