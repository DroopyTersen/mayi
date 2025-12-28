import { describe, it, expect } from "bun:test";

describe("GameState - table management", () => {
  describe("initial state", () => {
    it.todo("table is empty array at start of round", () => {});
    it.todo("no melds exist before anyone lays down", () => {});
  });

  describe("after first player lays down", () => {
    it.todo("table contains that player's melds", () => {});
    it.todo("melds have correct ownerId", () => {});
    it.todo("melds have unique ids", () => {});
  });

  describe("after multiple players lay down", () => {
    it.todo("table contains melds from all players who are down", () => {});
    it.todo("melds keep their ownerId", () => {});
    it.todo("melds are distinguishable by id", () => {});
    it.todo("table grows as more players lay down", () => {});
  });

  describe("table persistence across turns", () => {
    it.todo("table melds persist when turn advances", () => {});
    it.todo("table melds persist after discards", () => {});
    it.todo("table only changes when someone lays down (or lays off in Phase 4)", () => {});
  });
});

describe("GameState - isDown tracking", () => {
  describe("initial state", () => {
    it.todo("all players start with isDown: false", () => {});
    it.todo("at start of each round, isDown resets to false", () => {});
  });

  describe("after laying down", () => {
    it.todo("only the player who laid down has isDown: true", () => {});
    it.todo("other players remain isDown: false", () => {});
    it.todo("isDown persists across that player's future turns", () => {});
  });

  describe("multiple players down", () => {
    it.todo("each player's isDown tracked independently", () => {});
    it.todo("player A down, player B not down is valid state", () => {});
    it.todo("eventually all players might be down", () => {});
  });

  describe("round transition", () => {
    it.todo("when round ends, all isDown should reset for next round", () => {});
  });
});
