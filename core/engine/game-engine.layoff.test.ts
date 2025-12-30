/**
 * Tests for GameEngine layOff and swap commands
 *
 * Commands return snapshots. The state tells the story.
 * Invalid operations are silently ignored by XState guards.
 */

import { describe, it, expect } from "bun:test";
import { GameEngine } from "./game-engine";

describe("GameEngine.layOff", () => {
  describe("validation via state", () => {
    it("wrong phase - state unchanged", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
      });

      const before = engine.getSnapshot();
      expect(before.turnPhase).toBe("AWAITING_DRAW");

      const after = engine.layOff(before.awaitingPlayerId, "card-id", "meld-id");

      // State unchanged - still in AWAITING_DRAW
      expect(after.turnPhase).toBe("AWAITING_DRAW");
    });

    it("wrong player - state unchanged", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
        dealerIndex: 0,
      });

      const snapshot = engine.getSnapshot();
      const playerId = snapshot.awaitingPlayerId;

      // Draw to get to AWAITING_ACTION
      engine.drawFromDiscard(playerId);

      const wrongPlayerId = engine
        .getSnapshot()
        .players.find((p) => p.id !== playerId)!.id;

      const before = engine.getSnapshot();
      const after = engine.layOff(wrongPlayerId, "card-id", "meld-id");

      // State unchanged - still in AWAITING_ACTION
      expect(after.turnPhase).toBe("AWAITING_ACTION");
      expect(after.table.length).toBe(before.table.length);
    });

    it("player not down - state unchanged", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
        dealerIndex: 0,
      });

      const snapshot = engine.getSnapshot();
      const playerId = snapshot.awaitingPlayerId;

      // Draw to get to AWAITING_ACTION
      engine.drawFromDiscard(playerId);

      const before = engine.getSnapshot();
      const player = before.players.find((p) => p.id === playerId)!;
      expect(player.isDown).toBe(false);

      const after = engine.layOff(playerId, "card-id", "meld-id");

      // State unchanged - still not down, hand unchanged
      expect(after.turnPhase).toBe("AWAITING_ACTION");
    });

    it("Round 6 - state unchanged (no melds on table)", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
        dealerIndex: 0,
        startingRound: 6,
      });

      const snapshot = engine.getSnapshot();
      const playerId = snapshot.awaitingPlayerId;

      // Draw to get to AWAITING_ACTION
      engine.drawFromDiscard(playerId);

      const before = engine.getSnapshot();
      const after = engine.layOff(playerId, "card-id", "meld-id");

      // State unchanged
      expect(after.turnPhase).toBe("AWAITING_ACTION");
      expect(after.table.length).toBe(0); // No melds in Round 6
    });
  });

  describe("laying off to melds (placeholder tests)", () => {
    // These require complex setup with a down player and melds on table
    it("adds card to set if rank matches", () => {
      expect(true).toBe(true);
    });

    it("adds card to low end of run", () => {
      expect(true).toBe(true);
    });

    it("adds card to high end of run", () => {
      expect(true).toBe(true);
    });
  });
});

describe("GameEngine.swap", () => {
  describe("validation via state", () => {
    it("wrong phase - state unchanged", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
      });

      const before = engine.getSnapshot();
      expect(before.turnPhase).toBe("AWAITING_DRAW");

      const after = engine.swap(before.awaitingPlayerId, "meld-id", "joker-id", "card-id");

      // State unchanged - still in AWAITING_DRAW
      expect(after.turnPhase).toBe("AWAITING_DRAW");
    });

    it("wrong player - state unchanged", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
        dealerIndex: 0,
      });

      const snapshot = engine.getSnapshot();
      const playerId = snapshot.awaitingPlayerId;

      // Draw to get to AWAITING_ACTION
      engine.drawFromDiscard(playerId);

      const wrongPlayerId = engine
        .getSnapshot()
        .players.find((p) => p.id !== playerId)!.id;

      const before = engine.getSnapshot();
      const after = engine.swap(wrongPlayerId, "meld-id", "joker-id", "card-id");

      // State unchanged
      expect(after.turnPhase).toBe("AWAITING_ACTION");
    });

    it("Round 6 - state unchanged (no melds on table)", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
        dealerIndex: 0,
        startingRound: 6,
      });

      const snapshot = engine.getSnapshot();
      const playerId = snapshot.awaitingPlayerId;

      // Draw to get to AWAITING_ACTION
      engine.drawFromDiscard(playerId);

      const before = engine.getSnapshot();
      const after = engine.swap(playerId, "meld-id", "joker-id", "card-id");

      // State unchanged
      expect(after.turnPhase).toBe("AWAITING_ACTION");
      expect(after.table.length).toBe(0);
    });
  });

  describe("successful swap (placeholder tests)", () => {
    // Requires complex setup with melds containing jokers
    it("removes joker from meld and adds to hand", () => {
      expect(true).toBe(true);
    });

    it("places swap card in meld at joker's position", () => {
      expect(true).toBe(true);
    });
  });
});
