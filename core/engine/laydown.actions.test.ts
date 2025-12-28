import { describe, it, expect } from "bun:test";

describe("layDownMelds action", () => {
  describe("hand modification", () => {
    it.todo("removes exactly the cards specified in melds", () => {});
    it.todo("does not remove other cards", () => {});
    it.todo("hand order of remaining cards preserved", () => {});
    it.todo("works with minimum size melds", () => {});
    it.todo("works with larger melds", () => {});
  });

  describe("table modification", () => {
    it.todo("adds all melds to table", () => {});
    it.todo("melds have type: 'set' or 'run' correctly", () => {});
    it.todo("melds have ownerId set to current player", () => {});
    it.todo("melds have unique generated ids", () => {});
    it.todo("meld cards are copies (not references to hand cards)", () => {});
  });

  describe("player state modification", () => {
    it.todo("sets isDown to true", () => {});
    it.todo("sets laidDownThisTurn to true", () => {});
  });

  describe("meld creation", () => {
    it.todo("createMeld generates unique id", () => {});
    it.todo("createMeld stores cards array", () => {});
    it.todo("createMeld stores type correctly", () => {});
    it.todo("createMeld stores ownerId", () => {});
  });
});
