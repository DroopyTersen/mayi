/**
 * Tests for May-I fallback handling in AI turn handler
 *
 * When an AI player is prompted to respond to May-I (allow or claim),
 * the fallback should auto-allow if the LLM fails.
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { executeFallbackTurn } from "./ai-turn-handler";
import { PartyGameAdapter, type StoredGameState, type PlayerMapping } from "./party-game-adapter";
import { GameEngine } from "../../core/engine/game-engine";
import type { Card } from "../../core/card/card.types";

// Helper to create a game in RESOLVING_MAY_I phase
function setupMayIResolutionGame(): {
  adapter: PartyGameAdapter;
  promptedPlayerId: string;
  callerPlayerId: string;
} {
  // Create a 4-player game (createGame auto-starts the game)
  // Note: Engine uses player-0 through player-N internally based on playerNames array
  const engine = GameEngine.createGame({
    playerNames: ["Player 0", "AI Player 1", "Player 2 (Caller)", "AI Player 3"],
  });

  // Get initial snapshot
  const initialSnapshot = engine.getSnapshot();
  const currentPlayerId = initialSnapshot.awaitingPlayerId;

  // Find a non-current player to call May I (player-2 or player-3)
  // Following the pattern from game-engine.xstate.test.ts
  const callerId = initialSnapshot.players.find(p => p.id !== currentPlayerId)!.id;

  // Call May I - this should transition to RESOLVING_MAY_I phase
  engine.callMayI(callerId);

  // Now the game should be in RESOLVING_MAY_I phase
  const snapshotResolvingMayI = engine.getSnapshot();
  if (snapshotResolvingMayI.phase !== "RESOLVING_MAY_I") {
    throw new Error(`Expected RESOLVING_MAY_I phase, got ${snapshotResolvingMayI.phase}`);
  }

  // Create adapter with player mappings
  const playerIds = initialSnapshot.players.map(p => p.id);
  const playerMappings: PlayerMapping[] = [
    { lobbyId: "lobby-0", engineId: playerIds[0]!, name: "Player 0", isAI: false },
    { lobbyId: "lobby-1", engineId: playerIds[1]!, name: "AI Player 1", isAI: true, aiModelId: "default:grok" },
    { lobbyId: "lobby-2", engineId: playerIds[2]!, name: "Player 2 (Caller)", isAI: false },
    { lobbyId: "lobby-3", engineId: playerIds[3]!, name: "AI Player 3", isAI: true, aiModelId: "default:grok" },
  ];

  const storedState: StoredGameState = {
    roomId: "test-room",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    activityLog: [],
    playerMappings,
    engineSnapshot: engine.toJSON(),
  };

  const adapter = PartyGameAdapter.fromStoredState(storedState);

  // The prompted player should be the current player (whose turn it was)
  const mayIContext = snapshotResolvingMayI.mayIContext;
  if (!mayIContext) {
    throw new Error("No May-I context");
  }

  // Find the lobby ID of the prompted player
  const promptedMapping = playerMappings.find(m => m.engineId === mayIContext.playerBeingPrompted);
  if (!promptedMapping) {
    throw new Error(`No mapping for prompted player ${mayIContext.playerBeingPrompted}`);
  }

  // Find the lobby ID of the caller
  const callerMapping = playerMappings.find(m => m.engineId === callerId);

  return {
    adapter,
    promptedPlayerId: promptedMapping.lobbyId,
    callerPlayerId: callerMapping!.lobbyId,
  };
}

describe("executeFallbackTurn - May-I Response", () => {
  it("should auto-allow May-I when prompted player uses fallback", async () => {
    const { adapter, promptedPlayerId } = setupMayIResolutionGame();

    // Verify we're in RESOLVING_MAY_I phase
    const snapshot = adapter.getSnapshot();
    expect(snapshot.phase).toBe("RESOLVING_MAY_I");

    // Execute fallback for the prompted player
    const result = await executeFallbackTurn(adapter, promptedPlayerId);

    // Should succeed with allow_may_i action
    expect(result.success).toBe(true);
    expect(result.usedFallback).toBe(true);
    expect(result.actions).toContain("allow_may_i");

    // Verify phase changed (either still RESOLVING_MAY_I for next player, or ROUND_ACTIVE)
    const newSnapshot = adapter.getSnapshot();
    // After first allow, might still be RESOLVING_MAY_I (prompting next player) or might resolve
    expect(["RESOLVING_MAY_I", "ROUND_ACTIVE"]).toContain(newSnapshot.phase);
  });

  it("should fail when non-prompted player tries fallback during May-I resolution", async () => {
    const { adapter, callerPlayerId } = setupMayIResolutionGame();

    // Verify we're in RESOLVING_MAY_I phase
    const snapshot = adapter.getSnapshot();
    expect(snapshot.phase).toBe("RESOLVING_MAY_I");

    // Try to execute fallback for the caller (not the prompted player)
    const result = await executeFallbackTurn(adapter, callerPlayerId);

    // Should fail - caller is not the prompted player
    expect(result.success).toBe(false);
    expect(result.error).toContain("Not the player being prompted");
  });

  it("should fail when random player tries fallback during May-I resolution", async () => {
    const { adapter } = setupMayIResolutionGame();

    // Verify we're in RESOLVING_MAY_I phase
    const snapshot = adapter.getSnapshot();
    expect(snapshot.phase).toBe("RESOLVING_MAY_I");

    // Try to execute fallback for a player not involved
    const result = await executeFallbackTurn(adapter, "lobby-0");

    // Should fail - not the prompted player
    expect(result.success).toBe(false);
    expect(result.error).toContain("Not the player being prompted");
  });

  it("should resolve May-I completely when all prompted AIs use fallback", async () => {
    const { adapter, promptedPlayerId } = setupMayIResolutionGame();

    // First prompted player allows
    const result1 = await executeFallbackTurn(adapter, promptedPlayerId);
    expect(result1.success).toBe(true);

    let snapshot = adapter.getSnapshot();

    // If still in RESOLVING_MAY_I, continue prompting
    let iterations = 0;
    while (snapshot.phase === "RESOLVING_MAY_I" && iterations < 10) {
      const mayIContext = snapshot.mayIContext;
      if (!mayIContext?.playerBeingPrompted) break;

      // Find the prompted player's lobby ID
      const promptedMapping = adapter.getAllPlayerMappings().find(
        m => m.engineId === mayIContext.playerBeingPrompted
      );
      if (!promptedMapping) break;

      // Execute fallback for prompted player
      const result = await executeFallbackTurn(adapter, promptedMapping.lobbyId);
      expect(result.success).toBe(true);

      snapshot = adapter.getSnapshot();
      iterations++;
    }

    // After all players allowed (or one claimed), should be back to ROUND_ACTIVE
    expect(snapshot.phase).toBe("ROUND_ACTIVE");
  });
});

describe("executeFallbackTurn - Regular Turn", () => {
  it("should still work for regular turns (not May-I)", async () => {
    // Create a simple 3-player game not in May-I phase (createGame auto-starts)
    // Note: Game requires 3-8 players
    const engine = GameEngine.createGame({
      playerNames: ["AI Player 0", "Player 1", "Player 2"],
    });

    const engineSnapshot = engine.getSnapshot();
    const playerIds = engineSnapshot.players.map(p => p.id);

    const playerMappings: PlayerMapping[] = [
      { lobbyId: "lobby-0", engineId: playerIds[0]!, name: "AI Player 0", isAI: true },
      { lobbyId: "lobby-1", engineId: playerIds[1]!, name: "Player 1", isAI: false },
      { lobbyId: "lobby-2", engineId: playerIds[2]!, name: "Player 2", isAI: false },
    ];

    const storedState: StoredGameState = {
      roomId: "test-room",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      activityLog: [],
      playerMappings,
      engineSnapshot: engine.toJSON(),
    };

    const adapter = PartyGameAdapter.fromStoredState(storedState);

    // Verify we're in ROUND_ACTIVE phase (not May-I)
    const adapterSnapshot = adapter.getSnapshot();
    expect(adapterSnapshot.phase).toBe("ROUND_ACTIVE");

    // Get the current player (game randomizes dealer/first player)
    const awaitingPlayerId = adapter.getAwaitingLobbyPlayerId();
    expect(awaitingPlayerId).toBeDefined();

    // Execute fallback for the current player
    const result = await executeFallbackTurn(adapter, awaitingPlayerId!);

    // Should succeed with regular turn actions
    expect(result.success).toBe(true);
    expect(result.usedFallback).toBe(true);
    expect(result.actions).toContain("draw_from_stock");
    // Discard action includes card ID like "discard(card-63)"
    expect(result.actions.some(a => a.startsWith("discard("))).toBe(true);
  });
});
