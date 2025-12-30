/**
 * PartyGameAdapter - Bridge between PartyServer and GameEngine
 *
 * This adapter wraps GameEngine for use in the PartyServer room.
 * It handles:
 * - Creating games from lobby state (human + AI players)
 * - Mapping between lobby player IDs and engine player IDs
 * - Serialization/deserialization for Durable Object storage
 * - Providing per-player views for WebSocket broadcasts
 * - Executing game actions
 */

import { GameEngine } from "../../core/engine/game-engine";
import type {
  PlayerView,
  MeldSpec,
  GameSnapshot,
} from "../../core/engine/game-engine.types";
import type { RoundNumber } from "../../core/engine/engine.types";
import type { AIPlayerInfo, HumanPlayerInfo } from "./protocol.types";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Player mapping for translating between lobby IDs and engine IDs
 *
 * Lobby uses external IDs (nanoid for humans, ai-xxx for AI)
 * Engine uses sequential IDs (player-0, player-1, etc.)
 */
export interface PlayerMapping {
  /** Lobby player ID (external) */
  lobbyId: string;
  /** Engine player ID (internal, player-0, player-1, etc.) */
  engineId: string;
  /** Player name */
  name: string;
  /** Is this an AI player? */
  isAI: boolean;
  /** AI model ID (if AI player) */
  aiModelId?: string;
}

/**
 * Serialized game state for Durable Object storage
 */
export interface StoredGameState {
  /** Engine persisted snapshot (JSON string) */
  engineSnapshot: string;
  /** Player mappings for ID translation */
  playerMappings: PlayerMapping[];
  /** Room ID for reference */
  roomId: string;
  /** When the game was created */
  createdAt: string;
  /** When state was last updated */
  updatedAt: string;
}

/**
 * Options for creating a new game from lobby state
 */
export interface CreateGameFromLobbyOptions {
  /** Room ID */
  roomId: string;
  /** Human players (in join order) */
  humanPlayers: HumanPlayerInfo[];
  /** AI players */
  aiPlayers: AIPlayerInfo[];
  /** Starting round (1-6) */
  startingRound: RoundNumber;
}

// ═══════════════════════════════════════════════════════════════════════════
// PartyGameAdapter Class
// ═══════════════════════════════════════════════════════════════════════════

export class PartyGameAdapter {
  private engine: GameEngine;
  private playerMappings: PlayerMapping[];
  private roomId: string;
  private createdAt: string;

  private constructor(
    engine: GameEngine,
    playerMappings: PlayerMapping[],
    roomId: string,
    createdAt: string
  ) {
    this.engine = engine;
    this.playerMappings = playerMappings;
    this.roomId = roomId;
    this.createdAt = createdAt;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Factory Methods
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create a new game from lobby state
   */
  static createFromLobby(options: CreateGameFromLobbyOptions): PartyGameAdapter {
    const { roomId, humanPlayers, aiPlayers, startingRound } = options;

    // Build player names array (humans first, then AI)
    const playerNames: string[] = [
      ...humanPlayers.map((p) => p.name),
      ...aiPlayers.map((p) => p.name),
    ];

    if (playerNames.length < 3 || playerNames.length > 8) {
      throw new Error("Game requires 3-8 players");
    }

    // Create player mappings
    const playerMappings: PlayerMapping[] = [];

    // Human players
    humanPlayers.forEach((human, index) => {
      playerMappings.push({
        lobbyId: human.playerId,
        engineId: `player-${index}`,
        name: human.name,
        isAI: false,
      });
    });

    // AI players
    aiPlayers.forEach((ai, index) => {
      playerMappings.push({
        lobbyId: ai.playerId,
        engineId: `player-${humanPlayers.length + index}`,
        name: ai.name,
        isAI: true,
        aiModelId: ai.modelId,
      });
    });

    // Create the game engine
    const engine = GameEngine.createGame({
      playerNames,
      startingRound,
      gameId: roomId,
    });

    const now = new Date().toISOString();
    return new PartyGameAdapter(engine, playerMappings, roomId, now);
  }

  /**
   * Restore game from stored state
   */
  static fromStoredState(storedState: StoredGameState): PartyGameAdapter {
    const engine = GameEngine.fromJSON(
      storedState.engineSnapshot,
      storedState.roomId,
      storedState.createdAt
    );

    return new PartyGameAdapter(
      engine,
      storedState.playerMappings,
      storedState.roomId,
      storedState.createdAt
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Serialization
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get serialized state for Durable Object storage
   */
  getStoredState(): StoredGameState {
    return {
      engineSnapshot: this.engine.toJSON(),
      playerMappings: this.playerMappings,
      roomId: this.roomId,
      createdAt: this.createdAt,
      updatedAt: new Date().toISOString(),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ID Translation
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Translate lobby player ID to engine player ID
   */
  lobbyIdToEngineId(lobbyId: string): string | null {
    const mapping = this.playerMappings.find((m) => m.lobbyId === lobbyId);
    return mapping?.engineId ?? null;
  }

  /**
   * Translate engine player ID to lobby player ID
   */
  engineIdToLobbyId(engineId: string): string | null {
    const mapping = this.playerMappings.find((m) => m.engineId === engineId);
    return mapping?.lobbyId ?? null;
  }

  /**
   * Get player mapping by lobby ID
   */
  getPlayerMapping(lobbyId: string): PlayerMapping | null {
    return this.playerMappings.find((m) => m.lobbyId === lobbyId) ?? null;
  }

  /**
   * Get all player mappings
   */
  getAllPlayerMappings(): PlayerMapping[] {
    return [...this.playerMappings];
  }

  /**
   * Get AI player mappings
   */
  getAIPlayerMappings(): PlayerMapping[] {
    return this.playerMappings.filter((m) => m.isAI);
  }

  /**
   * Check if a lobby player ID is an AI
   */
  isAIPlayer(lobbyId: string): boolean {
    const mapping = this.getPlayerMapping(lobbyId);
    return mapping?.isAI ?? false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // State Access
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get the full game snapshot (for server-side logic)
   */
  getSnapshot(): GameSnapshot {
    return this.engine.getSnapshot();
  }

  /**
   * Get a player-specific view using their lobby ID
   *
   * Returns null if the lobby ID is not a valid player
   */
  getPlayerView(lobbyPlayerId: string): PlayerView | null {
    const engineId = this.lobbyIdToEngineId(lobbyPlayerId);
    if (!engineId) return null;

    try {
      return this.engine.getPlayerView(engineId);
    } catch {
      return null;
    }
  }

  /**
   * Get the lobby ID of the player the engine is waiting on
   *
   * Translates the engine's awaitingPlayerId to a lobby ID
   */
  getAwaitingLobbyPlayerId(): string | null {
    const engineId = this.engine.getAwaitingPlayerId();
    return this.engineIdToLobbyId(engineId);
  }

  /**
   * Get the engine phase
   */
  getPhase() {
    return this.engine.getPhase();
  }

  /**
   * Get the turn phase
   */
  getTurnPhase() {
    return this.engine.getTurnPhase();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Commands (using lobby player IDs)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Draw from stock pile
   */
  drawFromStock(lobbyPlayerId: string): GameSnapshot | null {
    const engineId = this.lobbyIdToEngineId(lobbyPlayerId);
    if (!engineId) return null;
    return this.engine.drawFromStock(engineId);
  }

  /**
   * Draw from discard pile
   */
  drawFromDiscard(lobbyPlayerId: string): GameSnapshot | null {
    const engineId = this.lobbyIdToEngineId(lobbyPlayerId);
    if (!engineId) return null;
    return this.engine.drawFromDiscard(engineId);
  }

  /**
   * Skip laying down
   */
  skip(lobbyPlayerId: string): GameSnapshot | null {
    const engineId = this.lobbyIdToEngineId(lobbyPlayerId);
    if (!engineId) return null;
    return this.engine.skip(engineId);
  }

  /**
   * Lay down melds
   */
  layDown(lobbyPlayerId: string, meldSpecs: MeldSpec[]): GameSnapshot | null {
    const engineId = this.lobbyIdToEngineId(lobbyPlayerId);
    if (!engineId) return null;
    return this.engine.layDown(engineId, meldSpecs);
  }

  /**
   * Lay off a card onto an existing meld
   */
  layOff(
    lobbyPlayerId: string,
    cardId: string,
    meldId: string
  ): GameSnapshot | null {
    const engineId = this.lobbyIdToEngineId(lobbyPlayerId);
    if (!engineId) return null;
    return this.engine.layOff(engineId, cardId, meldId);
  }

  /**
   * Swap a joker from a run
   */
  swapJoker(
    lobbyPlayerId: string,
    meldId: string,
    jokerCardId: string,
    swapCardId: string
  ): GameSnapshot | null {
    const engineId = this.lobbyIdToEngineId(lobbyPlayerId);
    if (!engineId) return null;
    return this.engine.swap(engineId, meldId, jokerCardId, swapCardId);
  }

  /**
   * Discard a card
   */
  discard(lobbyPlayerId: string, cardId: string): GameSnapshot | null {
    const engineId = this.lobbyIdToEngineId(lobbyPlayerId);
    if (!engineId) return null;
    return this.engine.discard(engineId, cardId);
  }

  /**
   * Call May I
   */
  callMayI(lobbyPlayerId: string): GameSnapshot | null {
    const engineId = this.lobbyIdToEngineId(lobbyPlayerId);
    if (!engineId) return null;
    return this.engine.callMayI(engineId);
  }

  /**
   * Allow May I caller to have the card
   */
  allowMayI(lobbyPlayerId: string): GameSnapshot | null {
    const engineId = this.lobbyIdToEngineId(lobbyPlayerId);
    if (!engineId) return null;
    return this.engine.allowMayI(engineId);
  }

  /**
   * Claim the card (blocking May I caller)
   */
  claimMayI(lobbyPlayerId: string): GameSnapshot | null {
    const engineId = this.lobbyIdToEngineId(lobbyPlayerId);
    if (!engineId) return null;
    return this.engine.claimMayI(engineId);
  }

  /**
   * Reorder hand
   */
  reorderHand(lobbyPlayerId: string, cardIds: string[]): GameSnapshot | null {
    const engineId = this.lobbyIdToEngineId(lobbyPlayerId);
    if (!engineId) return null;
    return this.engine.reorderHand(engineId, cardIds);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Cleanup
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Stop the engine (cleanup)
   */
  stop(): void {
    this.engine.stop();
  }
}
