import { describe, expect, it } from "bun:test";
import {
  createReorderHandPayload,
  resolveGameViewAction,
  toggleSingleSelectedCard,
} from "./useGameViewState";

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

describe("createReorderHandPayload", () => {
  it("keeps card ids in the dropped order", () => {
    expect(
      createReorderHandPayload([
        { id: "card-c" },
        { id: "card-a" },
        { id: "card-b" },
      ])
    ).toEqual({ cardIds: ["card-c", "card-a", "card-b"] });
  });
});

describe("toggleSingleSelectedCard", () => {
  it("selects a different card by replacing the previous selection", () => {
    expect(toggleSingleSelectedCard(new Set(["card-7"]), "card-9")).toEqual(
      new Set(["card-9"])
    );
  });

  it("clears selection when toggling the selected card", () => {
    expect(toggleSingleSelectedCard(new Set(["card-7"]), "card-7")).toEqual(
      new Set()
    );
  });
});
