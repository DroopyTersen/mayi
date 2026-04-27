import { describe, expect, it } from "bun:test";
import type { Card } from "core/card/card.types";
import type { Meld } from "core/meld/meld.types";
import { getLayOffPositionDecision } from "./lay-off-position";

function card(id: string, rank: Card["rank"], suit: Card["suit"]): Card {
  return { id, rank, suit };
}

function run(id: string, cards: Card[]): Meld {
  return { id, type: "run", ownerId: "player-1", cards };
}

function set(id: string, cards: Card[]): Meld {
  return { id, type: "set", ownerId: "player-1", cards };
}

describe("getLayOffPositionDecision", () => {
  it("prompts for a wild card that can extend a run at either end", () => {
    const meld = run("run-1", [
      card("5-hearts", "5", "hearts"),
      card("6-hearts", "6", "hearts"),
      card("7-hearts", "7", "hearts"),
    ]);

    expect(getLayOffPositionDecision(card("2-clubs", "2", "clubs"), meld)).toEqual({
      kind: "needsPosition",
    });
  });

  it("auto-resolves a natural run extension", () => {
    const meld = run("run-1", [
      card("5-hearts", "5", "hearts"),
      card("6-hearts", "6", "hearts"),
      card("7-hearts", "7", "hearts"),
    ]);

    expect(getLayOffPositionDecision(card("8-hearts", "8", "hearts"), meld)).toEqual({
      kind: "ready",
      position: "end",
    });
  });

  it("does not assign a position for set lay-offs", () => {
    const meld = set("set-1", [
      card("9-hearts", "9", "hearts"),
      card("9-clubs", "9", "clubs"),
      card("9-spades", "9", "spades"),
    ]);

    expect(getLayOffPositionDecision(card("9-diamonds", "9", "diamonds"), meld)).toEqual({
      kind: "ready",
      position: undefined,
    });
  });
});
