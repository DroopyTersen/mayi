/**
 * TDD Tests for shouldNudgeDiscard feature
 *
 * When a player has taken a meaningful action during their turn
 * (lay down, lay off, or swap joker), the Discard button should
 * show a visual nudge to remind them to discard.
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { GameEngine } from "./game-engine";
import { getAvailableActions } from "./game-engine.availability";
import type { GameSnapshot } from "./game-engine.types";
import type { Card } from "../card/card.types";

describe("shouldNudgeDiscard", () => {
  let engine: GameEngine;
  let snapshot: GameSnapshot;

  beforeEach(() => {
    engine = GameEngine.createGame({
      gameId: "test-nudge-game",
      playerNames: ["Alice", "Bob", "Carol"],
    });
    snapshot = engine.getSnapshot();
  });

  it("is false after drawing only (no action taken)", () => {
    const currentPlayerId = snapshot.players[snapshot.currentPlayerIndex]!.id;

    // Draw from stock
    engine.drawFromStock(currentPlayerId);
    const afterDraw = engine.getSnapshot();

    // Get available actions for current player
    const actions = getAvailableActions(afterDraw, currentPlayerId);

    // Should NOT nudge - player hasn't taken a meaningful action yet
    expect(actions.shouldNudgeDiscard).toBe(false);
  });

  it("is true after laying down contract", () => {
    // We need to set up a game where the player can actually lay down
    // Since this is TDD, this test will initially fail because shouldNudgeDiscard doesn't exist yet
    // The implementation will need to track lay down, lay off, and swap joker

    // For this test, we'll mock the snapshot to simulate having laid down
    const currentPlayerId = snapshot.players[snapshot.currentPlayerIndex]!.id;

    // Mock: player has drawn and laid down their contract
    const mockSnapshot: GameSnapshot = {
      ...snapshot,
      hasDrawn: true,
      laidDownThisTurn: true, // Indicates lay down happened
      tookActionThisTurn: true, // The NEW flag we're adding
      turnPhase: "AWAITING_DISCARD",
      awaitingPlayerId: currentPlayerId,
    };

    const actions = getAvailableActions(mockSnapshot, currentPlayerId);

    // Should nudge - player laid down and needs to discard
    expect(actions.shouldNudgeDiscard).toBe(true);
  });

  it("is true after laying off a card", () => {
    const currentPlayerId = snapshot.players[snapshot.currentPlayerIndex]!.id;

    // Mock: player has drawn and laid off a card (they were already down from previous turn)
    // In this scenario, they're in AWAITING_ACTION phase but have laid off
    const mockSnapshot: GameSnapshot = {
      ...snapshot,
      hasDrawn: true,
      laidDownThisTurn: false, // Did NOT lay down this turn (was down from before)
      tookActionThisTurn: true, // Laid off this turn
      turnPhase: "AWAITING_ACTION",
      awaitingPlayerId: currentPlayerId,
      players: snapshot.players.map((p) =>
        p.id === currentPlayerId ? { ...p, isDown: true } : p
      ),
    };

    const actions = getAvailableActions(mockSnapshot, currentPlayerId);

    // Should nudge - player laid off and can discard
    expect(actions.shouldNudgeDiscard).toBe(true);
  });

  it("is true after swapping a joker", () => {
    const currentPlayerId = snapshot.players[snapshot.currentPlayerIndex]!.id;

    // Mock: player has drawn and swapped a joker
    const mockSnapshot: GameSnapshot = {
      ...snapshot,
      hasDrawn: true,
      laidDownThisTurn: false,
      tookActionThisTurn: true, // Swapped a joker this turn
      turnPhase: "AWAITING_ACTION",
      awaitingPlayerId: currentPlayerId,
    };

    const actions = getAvailableActions(mockSnapshot, currentPlayerId);

    // Should nudge - player swapped and can discard
    expect(actions.shouldNudgeDiscard).toBe(true);
  });

  it("is false when not your turn", () => {
    const currentPlayerId = snapshot.players[snapshot.currentPlayerIndex]!.id;
    const otherPlayerId = snapshot.players.find((p) => p.id !== currentPlayerId)!.id;

    // Mock: it's current player's turn but we're checking another player
    const mockSnapshot: GameSnapshot = {
      ...snapshot,
      hasDrawn: true,
      tookActionThisTurn: true,
      turnPhase: "AWAITING_DISCARD",
      awaitingPlayerId: currentPlayerId,
    };

    const actions = getAvailableActions(mockSnapshot, otherPlayerId);

    // Should NOT nudge - it's not this player's turn
    expect(actions.shouldNudgeDiscard).toBe(false);
  });

  it("is false when canDiscard is false", () => {
    const currentPlayerId = snapshot.players[snapshot.currentPlayerIndex]!.id;

    // Mock: player took action but is in AWAITING_DRAW phase (cannot discard yet)
    const mockSnapshot: GameSnapshot = {
      ...snapshot,
      hasDrawn: false,
      tookActionThisTurn: false,
      turnPhase: "AWAITING_DRAW",
      awaitingPlayerId: currentPlayerId,
    };

    const actions = getAvailableActions(mockSnapshot, currentPlayerId);

    // Should NOT nudge - cannot discard yet
    expect(actions.shouldNudgeDiscard).toBe(false);
  });

  it("is false during May I resolution phase", () => {
    const currentPlayerId = snapshot.players[snapshot.currentPlayerIndex]!.id;

    // Mock: May I resolution is happening
    const mockSnapshot: GameSnapshot = {
      ...snapshot,
      phase: "RESOLVING_MAY_I",
      tookActionThisTurn: true,
      awaitingPlayerId: currentPlayerId,
      mayIContext: {
        originalCaller: "some-other-player",
        cardBeingClaimed: { id: "mock-card", rank: "5", suit: "hearts" } as Card,
        playersToCheck: [],
        currentPromptIndex: 0,
        playerBeingPrompted: currentPlayerId,
        playersWhoAllowed: [],
        winner: null,
        outcome: null,
      },
    };

    const actions = getAvailableActions(mockSnapshot, currentPlayerId);

    // Should NOT nudge - in May I resolution phase
    expect(actions.shouldNudgeDiscard).toBe(false);
  });

  it("is false during ROUND_END phase", () => {
    const currentPlayerId = snapshot.players[snapshot.currentPlayerIndex]!.id;

    const mockSnapshot: GameSnapshot = {
      ...snapshot,
      phase: "ROUND_END",
      tookActionThisTurn: true,
    };

    const actions = getAvailableActions(mockSnapshot, currentPlayerId);

    // Should NOT nudge - round has ended
    expect(actions.shouldNudgeDiscard).toBe(false);
  });

  it("is false during GAME_END phase", () => {
    const currentPlayerId = snapshot.players[snapshot.currentPlayerIndex]!.id;

    const mockSnapshot: GameSnapshot = {
      ...snapshot,
      phase: "GAME_END",
      tookActionThisTurn: true,
    };

    const actions = getAvailableActions(mockSnapshot, currentPlayerId);

    // Should NOT nudge - game has ended
    expect(actions.shouldNudgeDiscard).toBe(false);
  });
});

describe("tookActionThisTurn integration", () => {
  // These tests require the actual engine integration to work
  // They verify that tookActionThisTurn is properly set by actions

  it("tookActionThisTurn is false in initial snapshot", () => {
    const engine = GameEngine.createGame({
      gameId: "test-initial-action",
      playerNames: ["Alice", "Bob", "Carol"],
    });
    const snapshot = engine.getSnapshot();

    // Initially, no action has been taken
    expect(snapshot.tookActionThisTurn).toBe(false);
  });

  it("tookActionThisTurn remains false after drawing", () => {
    const engine = GameEngine.createGame({
      gameId: "test-draw-no-action",
      playerNames: ["Alice", "Bob", "Carol"],
    });
    const snapshot = engine.getSnapshot();
    const currentPlayerId = snapshot.players[snapshot.currentPlayerIndex]!.id;

    engine.drawFromStock(currentPlayerId);
    const afterDraw = engine.getSnapshot();

    // Drawing is not a "meaningful action" - should still be false
    expect(afterDraw.tookActionThisTurn).toBe(false);
  });
});
