import { describe, expect, it } from "bun:test";
import { resolveGameViewAction } from "./useGameViewState";

describe("resolveGameViewAction", () => {
  it("uses the single selected card as an immediate discard", () => {
    expect(resolveGameViewAction("discard", new Set(["card-7"]))).toEqual({
      kind: "sendAction",
      action: "discard",
      payload: { selectedCardIds: ["card-7"] },
    });
  });

  it("opens the discard drawer when no card is selected", () => {
    expect(resolveGameViewAction("discard", new Set())).toEqual({
      kind: "openDrawer",
      drawer: "discard",
    });
  });

  it("opens the discard drawer when multiple cards are selected", () => {
    expect(
      resolveGameViewAction("discard", new Set(["card-7", "card-9"]))
    ).toEqual({
      kind: "openDrawer",
      drawer: "discard",
    });
  });
});
