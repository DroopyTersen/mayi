/**
 * Tests for available actions at the engine level
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { GameEngine } from "./game-engine";
import {
  getPlayersWhoCanCallMayI,
  getMeldPlaceholderCount,
  canPlayerCallMayI,
  getLaydownCommandHint,
} from "./game-engine.availability";
import type { GameSnapshot } from "./game-engine.types";

describe("getPlayersWhoCanCallMayI", () => {
  let engine: GameEngine;
  let snapshot: GameSnapshot;

  beforeEach(() => {
    engine = GameEngine.createGame({
      gameId: "test-game",
      playerNames: ["Alice", "Bob", "Carol"],
    });
    snapshot = engine.getSnapshot();
  });

  it("returns empty array when phase is not ROUND_ACTIVE", () => {
    // Force to a different phase by completing the game (mock)
    const fakeSnapshot = { ...snapshot, phase: "GAME_END" as const };
    expect(getPlayersWhoCanCallMayI(fakeSnapshot)).toEqual([]);
  });

  it("returns empty array when there is no discard", () => {
    const fakeSnapshot = { ...snapshot, discard: [] };
    expect(getPlayersWhoCanCallMayI(fakeSnapshot)).toEqual([]);
  });

  it("excludes the player who discarded the current card", () => {
    // Start of game - dealer (index 0) dealt, player 1 starts
    // The discard was placed by the system, so lastDiscardedByPlayerId might be null
    // Let's simulate a real discard scenario
    const currentPlayerId = snapshot.players[snapshot.currentPlayerIndex]!.id;

    // Draw and discard to set up lastDiscardedByPlayerId
    engine.drawFromStock(currentPlayerId);
    const afterDraw = engine.getSnapshot();
    engine.skip(currentPlayerId);
    const card = afterDraw.players.find((p) => p.id === currentPlayerId)!.hand[0]!;
    engine.discard(currentPlayerId, card.id);

    const afterDiscard = engine.getSnapshot();

    // Now the player who just discarded should NOT be able to May I
    const eligible = getPlayersWhoCanCallMayI(afterDiscard);
    expect(eligible).not.toContain(currentPlayerId);
  });

  it("excludes players who are down", () => {
    // Create a scenario where a player is down
    const currentPlayerId = snapshot.players[snapshot.currentPlayerIndex]!.id;

    // Make the first player go down (would need to set up a valid laydown)
    // For this test, let's just check the logic with a mocked snapshot
    const playerDown = { ...snapshot.players[0]!, isDown: true };
    const fakeSnapshot = {
      ...snapshot,
      players: [playerDown, ...snapshot.players.slice(1)],
    };

    const eligible = getPlayersWhoCanCallMayI(fakeSnapshot);
    expect(eligible).not.toContain(playerDown.id);
  });

  it("includes eligible players who are not down and did not discard", () => {
    // After the first player draws and discards, the other players should be eligible
    const currentPlayerId = snapshot.players[snapshot.currentPlayerIndex]!.id;

    engine.drawFromStock(currentPlayerId);
    const afterDraw = engine.getSnapshot();
    engine.skip(currentPlayerId);
    const card = afterDraw.players.find((p) => p.id === currentPlayerId)!.hand[0]!;
    engine.discard(currentPlayerId, card.id);

    const afterDiscard = engine.getSnapshot();
    const eligible = getPlayersWhoCanCallMayI(afterDiscard);

    // The other two players should be eligible
    const otherPlayers = afterDiscard.players.filter((p) => p.id !== currentPlayerId);
    for (const player of otherPlayers) {
      expect(eligible).toContain(player.id);
    }
  });

  it("returns empty array during RESOLVING_MAY_I phase", () => {
    const fakeSnapshot = { ...snapshot, phase: "RESOLVING_MAY_I" as const };
    expect(getPlayersWhoCanCallMayI(fakeSnapshot)).toEqual([]);
  });
});

describe("getMeldPlaceholderCount", () => {
  it("returns 2 for Round 1 (2 sets)", () => {
    expect(getMeldPlaceholderCount({ roundNumber: 1, sets: 2, runs: 0 })).toBe(2);
  });

  it("returns 2 for Round 2 (1 set + 1 run)", () => {
    expect(getMeldPlaceholderCount({ roundNumber: 2, sets: 1, runs: 1 })).toBe(2);
  });

  it("returns 2 for Round 3 (2 runs)", () => {
    expect(getMeldPlaceholderCount({ roundNumber: 3, sets: 0, runs: 2 })).toBe(2);
  });

  it("returns 3 for Round 4 (3 sets)", () => {
    expect(getMeldPlaceholderCount({ roundNumber: 4, sets: 3, runs: 0 })).toBe(3);
  });

  it("returns 3 for Round 5 (2 sets + 1 run)", () => {
    expect(getMeldPlaceholderCount({ roundNumber: 5, sets: 2, runs: 1 })).toBe(3);
  });

  it("returns 3 for Round 6 (1 set + 2 runs)", () => {
    expect(getMeldPlaceholderCount({ roundNumber: 6, sets: 1, runs: 2 })).toBe(3);
  });
});

describe("canPlayerCallMayI", () => {
  it("returns true when player is in eligible list", () => {
    const engine = GameEngine.createGame({
      gameId: "test-mayi-check",
      playerNames: ["Alice", "Bob", "Carol"],
    });
    const snapshot = engine.getSnapshot();

    // Draw and discard to set up a valid May I scenario
    const currentPlayerId = snapshot.players[snapshot.currentPlayerIndex]!.id;
    engine.drawFromStock(currentPlayerId);
    const afterDraw = engine.getSnapshot();
    engine.skip(currentPlayerId);
    const card = afterDraw.players.find((p) => p.id === currentPlayerId)!.hand[0]!;
    engine.discard(currentPlayerId, card.id);

    const afterDiscard = engine.getSnapshot();
    const otherPlayer = afterDiscard.players.find((p) => p.id !== currentPlayerId)!;

    expect(canPlayerCallMayI(afterDiscard, otherPlayer.id)).toBe(true);
  });

  it("returns false when player is not eligible", () => {
    const engine = GameEngine.createGame({
      gameId: "test-mayi-check-false",
      playerNames: ["Alice", "Bob", "Carol"],
    });
    const snapshot = engine.getSnapshot();

    // The player who will discard cannot call May I on their own discard
    const currentPlayerId = snapshot.players[snapshot.currentPlayerIndex]!.id;
    engine.drawFromStock(currentPlayerId);
    const afterDraw = engine.getSnapshot();
    engine.skip(currentPlayerId);
    const card = afterDraw.players.find((p) => p.id === currentPlayerId)!.hand[0]!;
    engine.discard(currentPlayerId, card.id);

    const afterDiscard = engine.getSnapshot();

    // The discarding player cannot May I their own card
    expect(canPlayerCallMayI(afterDiscard, currentPlayerId)).toBe(false);
  });
});

describe("getLaydownCommandHint", () => {
  it("returns hint with 2 placeholders for 2-meld contracts", () => {
    const hint = getLaydownCommandHint({ roundNumber: 1, sets: 2, runs: 0 });
    expect(hint).toBe('laydown "<meld1>" "<meld2>"');
  });

  it("returns hint with 3 placeholders for 3-meld contracts", () => {
    const hint = getLaydownCommandHint({ roundNumber: 4, sets: 3, runs: 0 });
    expect(hint).toBe('laydown "<meld1>" "<meld2>" "<meld3>"');
  });

  it("works for mixed contracts", () => {
    const hint = getLaydownCommandHint({ roundNumber: 5, sets: 2, runs: 1 });
    expect(hint).toBe('laydown "<meld1>" "<meld2>" "<meld3>"');
  });
});
