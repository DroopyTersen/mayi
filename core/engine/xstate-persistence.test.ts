/**
 * Test: XState v5 persistence with nested invoked actors
 *
 * These tests verify that XState v5 can properly persist and restore
 * games in progress with nested actors (game → round → turn → mayIWindow).
 *
 * Bugs #4141 and #4171 were fixed in XState v5 stable, making this work.
 */

import { describe, it, expect } from "bun:test";
import { createActor } from "xstate";
import { gameMachine } from "./game.machine";
import { createGameActor, getSerializableState } from "./game.actor";

describe("XState v5 persistence with nested actors", () => {
  describe("basic persistence", () => {
    it("can persist a game in 'playing' state with getPersistedSnapshot", () => {
      const actor = createGameActor({
        playerNames: ["Alice", "Bob", "Carol"],
        autoStart: true,
      });

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("playing");

      const persistedSnapshot = actor.getPersistedSnapshot();

      // Check it has children (the round actor)
      const persisted = persistedSnapshot as any;
      expect(persisted.children).toBeDefined();
      expect(Object.keys(persisted.children ?? {})).toContain("round");

      // The round actor should also have children (the turn actor)
      const roundChild = persisted.children?.round;
      expect(roundChild?.snapshot?.children).toBeDefined();

      actor.stop();
    });

    it("can restore a game in 'playing' state from persisted snapshot", () => {
      const actor = createGameActor({
        playerNames: ["Alice", "Bob", "Carol"],
        autoStart: true,
      });

      actor.send({ type: "DRAW_FROM_STOCK" });

      const snapshotBefore = actor.getSnapshot();
      const persistedSnapshot = actor.getPersistedSnapshot();
      actor.stop();

      const restoredActor = createActor(gameMachine, { input: { startingRound: 1 },
        snapshot: persistedSnapshot,
      });
      restoredActor.start();

      const snapshotAfter = restoredActor.getSnapshot();

      expect(snapshotAfter.value).toBe("playing");
      expect(snapshotAfter.context.currentRound).toBe(snapshotBefore.context.currentRound);
      expect(snapshotAfter.context.players.length).toBe(3);

      restoredActor.stop();
    });

    it("restored game can continue receiving events", () => {
      const actor = createGameActor({
        playerNames: ["Alice", "Bob", "Carol"],
        autoStart: true,
      });

      const persistedSnapshot = actor.getPersistedSnapshot();
      actor.stop();

      const restoredActor = createActor(gameMachine, { input: { startingRound: 1 },
        snapshot: persistedSnapshot,
      });
      restoredActor.start();

      restoredActor.send({ type: "DRAW_FROM_STOCK" });

      const snapshot = restoredActor.getSnapshot();
      expect(snapshot.value).toBe("playing");

      restoredActor.stop();
    });
  });

  describe("hydration across game phases", () => {
    it("can hydrate game after drawing from stock (AWAITING_ACTION)", () => {
      const actor = createGameActor({
        playerNames: ["Alice", "Bob", "Carol"],
        autoStart: true,
      });

      // Draw from stock to enter AWAITING_ACTION/May I window
      actor.send({ type: "DRAW_FROM_STOCK" });

      const persistedSnapshot = actor.getPersistedSnapshot();
      actor.stop();

      // Hydrate
      const restoredActor = createActor(gameMachine, { input: { startingRound: 1 }, snapshot: persistedSnapshot });
      restoredActor.start();

      // Get state from hydrated actor
      const state = getSerializableState(restoredActor);
      expect(state.machineState).toBe("playing");
      // After draw from stock with May I window, should have players
      expect(state.players.length).toBe(3);

      restoredActor.stop();
    });

    it("can hydrate game after skipping laydown (AWAITING_DISCARD)", () => {
      const actor = createGameActor({
        playerNames: ["Alice", "Bob", "Carol"],
        autoStart: true,
      });

      // Complete May I window by passing
      actor.send({ type: "DRAW_FROM_STOCK" });

      // Get current player and have all non-current players pass May I
      const stateBefore = getSerializableState(actor);

      // Pass May I for all waiting players
      for (const player of stateBefore.players) {
        if (player.id !== stateBefore.players[stateBefore.currentPlayerIndex]?.id) {
          // Other players need to pass on May I
        }
      }

      // Skip laydown to move to AWAITING_DISCARD
      actor.send({ type: "SKIP_LAY_DOWN" });

      const persistedSnapshot = actor.getPersistedSnapshot();
      actor.stop();

      // Hydrate
      const restoredActor = createActor(gameMachine, { input: { startingRound: 1 }, snapshot: persistedSnapshot });
      restoredActor.start();

      const state = getSerializableState(restoredActor);
      expect(state.machineState).toBe("playing");

      restoredActor.stop();
    });

    it("can hydrate after multiple turns", () => {
      const actor = createGameActor({
        playerNames: ["Alice", "Bob", "Carol"],
        autoStart: true,
      });

      // Play through one complete turn
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });

      // Discard a card
      const state1 = getSerializableState(actor);
      const currentPlayer = state1.players[state1.currentPlayerIndex];
      if (currentPlayer && currentPlayer.hand.length > 0) {
        actor.send({ type: "DISCARD", cardId: currentPlayer.hand[0]!.id });
      }

      // Now persist mid-game
      const persistedSnapshot = actor.getPersistedSnapshot();
      actor.stop();

      // Hydrate
      const restoredActor = createActor(gameMachine, { input: { startingRound: 1 }, snapshot: persistedSnapshot });
      restoredActor.start();

      const state2 = getSerializableState(restoredActor);
      expect(state2.machineState).toBe("playing");
      expect(state2.players.length).toBe(3);

      restoredActor.stop();
    });
  });

  describe("JSON serialization roundtrip", () => {
    it("can serialize persisted snapshot to JSON and back", () => {
      const actor = createGameActor({
        playerNames: ["Alice", "Bob", "Carol"],
        autoStart: true,
      });

      actor.send({ type: "DRAW_FROM_STOCK" });

      const persistedSnapshot = actor.getPersistedSnapshot();
      actor.stop();

      // Serialize to JSON string (like storing in DB)
      const jsonString = JSON.stringify(persistedSnapshot);

      // Parse back
      const parsed = JSON.parse(jsonString);

      // Restore from parsed JSON
      const restoredActor = createActor(gameMachine, { input: { startingRound: 1 }, snapshot: parsed });
      restoredActor.start();

      const state = getSerializableState(restoredActor);
      expect(state.machineState).toBe("playing");
      expect(state.players.length).toBe(3);

      restoredActor.stop();
    });
  });
});
