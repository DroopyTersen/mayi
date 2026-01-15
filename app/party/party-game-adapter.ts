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
import type { AIPlayerInfo, HumanPlayerInfo, ActivityLogEntry } from "./protocol.types";
import { renderCard } from "../../cli/shared/cli.renderer";

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
  /** Character avatar ID (e.g., "ethel", "curt") */
  avatarId?: string;
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
  /** Activity log entries */
  activityLog: ActivityLogEntry[];
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

// ═══════════════════════════════════════════════════════════════════════════
// State Merge Utility
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Merge AI's state changes with fresh state, preserving other players' hands.
 *
 * This fixes a race condition where:
 * 1. AI turn starts, loads state A
 * 2. Human reorders hand during AI turn, saves state B
 * 3. AI finishes, would normally save state A' (losing human's reorder)
 *
 * With this merge:
 * - Use AI's game state (stock, discard, table, turn, current player's hand)
 * - Preserve fresh state's hands for non-current players (reorders, etc.)
 *
 * XState v5 persisted snapshot structure:
 * - snapshot.context.players: player metadata with empty hands
 * - snapshot.children.round.snapshot.context.players: round actor's players with actual hands
 *
 * @param freshState - Latest state from storage (may include other players' changes)
 * @param aiState - AI's adapter state after its actions
 * @param currentPlayerEngineId - Engine ID of the current player (e.g., "player-0")
 * @returns Merged state that preserves other players' hands
 */
export function mergeAIStatePreservingOtherPlayerHands(
  freshState: StoredGameState | null,
  aiState: StoredGameState,
  currentPlayerEngineId: string
): StoredGameState {
  type RoundSnapshotPlayer = { id: string; hand: unknown; isDown?: boolean };
  type CardLike = { id: string };

  // If no fresh state, just use AI state
  if (!freshState) return aiState;

  // Parse snapshots
  const freshSnapshot = JSON.parse(freshState.engineSnapshot);
  const aiSnapshot = JSON.parse(aiState.engineSnapshot);

  // Get round numbers from both snapshots
  const freshRoundNumber =
    freshSnapshot?.children?.round?.snapshot?.context?.roundNumber;
  const aiRoundNumber =
    aiSnapshot?.children?.round?.snapshot?.context?.roundNumber;

  // If rounds differ, keep the newer round state (prevents rolling back a round transition).
  if (
    freshRoundNumber !== undefined &&
    aiRoundNumber !== undefined &&
    freshRoundNumber !== aiRoundNumber
  ) {
    return aiRoundNumber > freshRoundNumber ? aiState : freshState;
  }

  // Navigate to players array in both snapshots
  // XState v5 structure: snapshot.children.round.snapshot.context.players
  const freshPlayers =
    freshSnapshot?.children?.round?.snapshot?.context?.players;
  const aiPlayers =
    aiSnapshot?.children?.round?.snapshot?.context?.players;

  // If we can't find valid players in fresh state, prefer fresh state
  // (it's from storage and more authoritative than stale AI adapter state)
  // Only proceed with merge if we have valid data in BOTH states
  if (!freshPlayers || !aiPlayers || freshPlayers.length !== aiPlayers.length) {
    return freshState;
  }

  // Find current player index by engine ID
  const currentPlayerIndex = aiPlayers.findIndex(
    (p: { id: string }) => p.id === currentPlayerEngineId
  );

  // If current player not found, prefer fresh state (authoritative from storage)
  if (currentPlayerIndex === -1) {
    return freshState;
  }

  // Merge: AI's snapshot with fresh hands for non-current players
  const mergedPlayers = aiPlayers.map(
    (aiPlayer: RoundSnapshotPlayer, index: number): RoundSnapshotPlayer => {
      if (index === currentPlayerIndex) {
        // Use AI's version for current player (their hand may have changed from draws/discards)
        return aiPlayer;
      }
      // Use fresh version for other players (preserves their reorders)
      const freshPlayer = freshPlayers[index];
      if (freshPlayer && freshPlayer.hand !== undefined) {
        return { ...aiPlayer, hand: freshPlayer.hand };
      }
      return aiPlayer;
    }
  );

  // XState keeps the current player's authoritative hand in the TurnMachine
  // context. After an AI turn completes, the persisted snapshot often includes
  // a newly spawned TurnMachine for the NEXT player. If the AI's adapter was
  // stale (e.g., May-I resolved while AI was "thinking"), we can end up with:
  // - round.context.players[N].hand (fresh, merged) ✅
  // - turn.context.hand (stale) ❌
  //
  // GameEngine prefers turn.context.hand for the current player when building
  // PlayerView, so we must keep the TurnMachine hand in sync for non-AI players.
  const turnContext =
    aiSnapshot?.children?.round?.snapshot?.children?.turn?.snapshot?.context;
  const turnPlayerId = turnContext?.playerId as string | undefined;
  const shouldSyncTurnHand =
    typeof turnPlayerId === "string" && turnPlayerId !== currentPlayerEngineId;
  const mergedTurnPlayer = shouldSyncTurnHand
    ? mergedPlayers.find((p: RoundSnapshotPlayer) => p.id === turnPlayerId)
    : null;
  const turnContextPatch =
    shouldSyncTurnHand && mergedTurnPlayer && mergedTurnPlayer.hand !== undefined
      ? {
          hand: mergedTurnPlayer.hand,
          ...(typeof mergedTurnPlayer.isDown === "boolean"
            ? { isDown: mergedTurnPlayer.isDown }
            : {}),
        }
      : null;

  // Build merged snapshot - update players in the round actor's context
  const mergedSnapshot = {
    ...aiSnapshot,
    children: {
      ...aiSnapshot.children,
      round: {
        ...aiSnapshot.children?.round,
        snapshot: {
          ...aiSnapshot.children?.round?.snapshot,
          context: {
            ...aiSnapshot.children?.round?.snapshot?.context,
            players: mergedPlayers,
          },
          children:
            turnContextPatch
              ? {
                  ...aiSnapshot.children?.round?.snapshot?.children,
                  turn: {
                    ...aiSnapshot.children?.round?.snapshot?.children?.turn,
                    snapshot: {
                      ...aiSnapshot.children?.round?.snapshot?.children?.turn
                        ?.snapshot,
                      context: {
                        ...aiSnapshot.children?.round?.snapshot?.children?.turn
                          ?.snapshot?.context,
                        ...turnContextPatch,
                      },
                    },
                  },
                }
              : aiSnapshot.children?.round?.snapshot?.children,
        },
      },
    },
  };

  // Safety: If the merged snapshot has duplicate card IDs across hands, or any
  // hand card ID also appears in stock/discard piles, the AI snapshot is stale
  // relative to storage. Returning the fresh state avoids resurrecting cards
  // (e.g., after a May-I resolution) and prevents duplicate dealing.
  const handCardIds = new Set<string>();
  let hasDuplicateHandCards = false;
  for (const player of mergedPlayers) {
    const hand = player.hand;
    if (!Array.isArray(hand)) continue;
    for (const card of hand) {
      if (!card || typeof card !== "object") continue;
      const id = (card as CardLike).id;
      if (typeof id === "string") {
        if (handCardIds.has(id)) {
          hasDuplicateHandCards = true;
        }
        handCardIds.add(id);
      }
    }
  }

  if (hasDuplicateHandCards) return freshState;

  const mergedRoundContext = mergedSnapshot?.children?.round?.snapshot?.context as
    | { stock?: unknown; discard?: unknown }
    | undefined;
  const mergedTurnContext = mergedSnapshot?.children?.round?.snapshot?.children?.turn?.snapshot
    ?.context as
    | { stock?: unknown; discard?: unknown }
    | undefined;

  const pilesToCheck: unknown[] = [
    mergedRoundContext?.stock,
    mergedRoundContext?.discard,
    mergedTurnContext?.stock,
    mergedTurnContext?.discard,
  ];

  const hasHandPileOverlap = pilesToCheck.some((pile) => {
    if (!Array.isArray(pile)) return false;
    return pile.some((card) => {
      if (!card || typeof card !== "object") return false;
      const id = (card as CardLike).id;
      return typeof id === "string" && handCardIds.has(id);
    });
  });

  if (hasHandPileOverlap) return freshState;

  return {
    ...aiState,
    engineSnapshot: JSON.stringify(mergedSnapshot),
  };
}

export class PartyGameAdapter {
  private engine: GameEngine;
  private playerMappings: PlayerMapping[];
  private roomId: string;
  private createdAt: string;
  private activityLog: ActivityLogEntry[];
  private logIdCounter: number = 0;

  private constructor(
    engine: GameEngine,
    playerMappings: PlayerMapping[],
    roomId: string,
    createdAt: string,
    activityLog: ActivityLogEntry[] = []
  ) {
    this.engine = engine;
    this.playerMappings = playerMappings;
    this.roomId = roomId;
    this.createdAt = createdAt;
    this.activityLog = activityLog;
    // Initialize counter from existing log entries
    this.logIdCounter = activityLog.length;
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
        avatarId: human.avatarId,
        isAI: false,
      });
    });

    // AI players
    aiPlayers.forEach((ai, index) => {
      playerMappings.push({
        lobbyId: ai.playerId,
        engineId: `player-${humanPlayers.length + index}`,
        name: ai.name,
        avatarId: ai.avatarId,
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
    const adapter = new PartyGameAdapter(engine, playerMappings, roomId, now, []);

    // Log game started
    adapter.logAction("system", "Game started", playerNames.join(", "));

    return adapter;
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
      storedState.createdAt,
      storedState.activityLog ?? []
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
      activityLog: this.activityLog,
    };
  }

  /**
   * Get recent activity log entries (for sending over WebSocket)
   *
   * Filters out boring entries and returns the last N entries.
   */
  getRecentActivityLog(count: number = 10): ActivityLogEntry[] {
    // Filter out system messages and skip actions
    const SKIP_ACTIONS = ["skipped", "passed on May I", "Game started"];
    const interesting = this.activityLog.filter(
      (entry) =>
        entry.playerId !== "system" &&
        !SKIP_ACTIONS.some((skip) => entry.action.includes(skip))
    );
    return interesting.slice(-count);
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

  /**
   * Get a map of lobby player IDs to player names.
   * Used for displaying player names in UI when scores are keyed by lobby ID.
   */
  getPlayerNamesMap(): Record<string, string> {
    const names: Record<string, string> = {};
    for (const mapping of this.playerMappings) {
      names[mapping.lobbyId] = mapping.name;
    }
    return names;
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
   * Returns null if the lobby ID is not a valid player.
   * Enriches the view with avatarIds from player mappings.
   */
  getPlayerView(lobbyPlayerId: string): PlayerView | null {
    const engineId = this.lobbyIdToEngineId(lobbyPlayerId);
    if (!engineId) return null;

    try {
      const view = this.engine.getPlayerView(engineId);

      // Find the viewing player's mapping for avatarId
      const selfMapping = this.playerMappings.find((m) => m.engineId === engineId);

      // Enrich opponents with avatarIds from mappings
      const enrichedOpponents = view.opponents.map((opponent) => {
        const mapping = this.playerMappings.find((m) => m.engineId === opponent.id);
        return {
          ...opponent,
          avatarId: mapping?.avatarId,
        };
      });

      return {
        ...view,
        yourAvatarId: selfMapping?.avatarId,
        opponents: enrichedOpponents,
      };
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
    meldId: string,
    position?: "start" | "end"
  ): GameSnapshot | null {
    const engineId = this.lobbyIdToEngineId(lobbyPlayerId);
    if (!engineId) return null;
    return this.engine.layOff(engineId, cardId, meldId, position);
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

  // ═══════════════════════════════════════════════════════════════════════════
  // Activity Logging
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Log an activity entry
   *
   * @param lobbyPlayerId - Lobby player ID (or "system" for system messages)
   * @param action - Action description
   * @param details - Optional additional details
   */
  logAction(lobbyPlayerId: string, action: string, details?: string): void {
    const snapshot = this.engine.getSnapshot();
    const mapping = this.playerMappings.find((m) => m.lobbyId === lobbyPlayerId);
    const playerName = lobbyPlayerId === "system" ? "System" : (mapping?.name ?? lobbyPlayerId);

    const entry: ActivityLogEntry = {
      id: `log-${++this.logIdCounter}`,
      timestamp: new Date().toISOString(),
      roundNumber: snapshot.currentRound,
      turnNumber: snapshot.turnNumber,
      playerId: lobbyPlayerId,
      playerName,
      action,
      ...(details ? { details } : {}),
    };

    this.activityLog.push(entry);
  }

  /**
   * Log a draw action with the drawn card
   */
  logDraw(
    lobbyPlayerId: string,
    before: GameSnapshot,
    after: GameSnapshot,
    source: "stock" | "discard"
  ): void {
    const mapping = this.playerMappings.find((m) => m.lobbyId === lobbyPlayerId);
    if (!mapping) return;

    const beforePlayer = before.players.find((p) => p.id === mapping.engineId);
    const afterPlayer = after.players.find((p) => p.id === mapping.engineId);
    if (!beforePlayer || !afterPlayer) return;

    // Check if draw succeeded
    if (afterPlayer.hand.length !== beforePlayer.hand.length + 1) return;

    // Find the new card
    const beforeIds = new Set(beforePlayer.hand.map((c) => c.id));
    const drawn = afterPlayer.hand.find((c) => !beforeIds.has(c.id));
    if (!drawn) return;

    if (source === "stock") {
      // Stock is face-down, so don't reveal the card
      this.logAction(lobbyPlayerId, "drew from the draw pile");
    } else {
      // Discard is face-up, so everyone can see what was taken
      this.logAction(lobbyPlayerId, "took from discard", renderCard(drawn));
    }
  }

  /**
   * Log a discard action
   */
  logDiscard(
    lobbyPlayerId: string,
    before: GameSnapshot,
    after: GameSnapshot,
    cardId: string
  ): void {
    // Find the card that was discarded
    const card = before.discard.find((c) => c.id === cardId) ??
      after.discard.find((c) => c.id === cardId);

    // Check if discard succeeded
    const cardInDiscard = after.discard.some((c) => c.id === cardId);
    const roundEnded = after.currentRound !== before.currentRound || after.phase === "GAME_END";

    if (cardInDiscard || roundEnded) {
      if (card) {
        this.logAction(lobbyPlayerId, "discarded", renderCard(card));
      }

      // Log "went out" if player went out
      const mapping = this.playerMappings.find((m) => m.lobbyId === lobbyPlayerId);
      if (mapping) {
        const beforePlayer = before.players.find((p) => p.id === mapping.engineId);
        if (beforePlayer && beforePlayer.hand.length === 1 && roundEnded) {
          this.logAction(lobbyPlayerId, "went out!");
        }
      }
    }
  }

  /**
   * Log a lay down action
   */
  logLayDown(lobbyPlayerId: string, before: GameSnapshot, after: GameSnapshot): void {
    const mapping = this.playerMappings.find((m) => m.lobbyId === lobbyPlayerId);
    if (!mapping) return;

    const beforePlayer = before.players.find((p) => p.id === mapping.engineId);
    const afterPlayer = after.players.find((p) => p.id === mapping.engineId);

    if (beforePlayer && afterPlayer && !beforePlayer.isDown && afterPlayer.isDown) {
      this.logAction(lobbyPlayerId, "laid down contract");
    }
  }

  /**
   * Log a lay off action
   *
   * @param position - Only shown in log when "start" (prepending to run)
   */
  logLayOff(
    lobbyPlayerId: string,
    cardId: string,
    before: GameSnapshot,
    after: GameSnapshot,
    position?: "start" | "end"
  ): void {
    const mapping = this.playerMappings.find((m) => m.lobbyId === lobbyPlayerId);
    if (!mapping) return;

    const beforePlayer = before.players.find((p) => p.id === mapping.engineId);
    const afterPlayer = after.players.find((p) => p.id === mapping.engineId);

    if (beforePlayer && afterPlayer && afterPlayer.hand.length === beforePlayer.hand.length - 1) {
      const card = beforePlayer.hand.find((c) => c.id === cardId);
      if (card) {
        // Only show "at start" for prepending - appending is the default
        const positionText = position === "start" ? " at start" : "";
        this.logAction(lobbyPlayerId, `laid off${positionText}`, renderCard(card));
      }
    }
  }

  /**
   * Log a May I call
   */
  logMayICall(lobbyPlayerId: string, cardId: string, before: GameSnapshot): void {
    const card = before.discard.find((c) => c.id === cardId);
    if (card) {
      this.logAction(lobbyPlayerId, "called May I", renderCard(card));
    }
  }

  /**
   * Log when a player allows May-I to proceed
   */
  logMayIAllow(lobbyPlayerId: string): void {
    this.logAction(lobbyPlayerId, "allowed May I");
  }

  /**
   * Log when a player claims and blocks the original caller
   */
  logMayIClaim(lobbyPlayerId: string, cardRendered: string): void {
    this.logAction(lobbyPlayerId, "claimed May I", cardRendered);
  }

  /**
   * Log May I resolution - who took the card
   */
  logMayIResolved(winnerLobbyId: string, cardRendered: string, wasBlocked: boolean): void {
    if (wasBlocked) {
      this.logAction(winnerLobbyId, "took the May I card", cardRendered);
    } else {
      this.logAction(winnerLobbyId, "took the May I card", cardRendered);
    }
  }
}
