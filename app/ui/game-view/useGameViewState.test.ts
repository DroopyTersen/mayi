import { describe, expect, it } from "bun:test";
import {
  toggleSingleSelectedCard,
} from "./useGameViewState";

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
