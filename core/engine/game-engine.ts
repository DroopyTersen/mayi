/**
 * GameEngine - Server-safe wrapper around XState game machines
 *
 * This engine wraps the existing XState machines (game.machine, round.machine,
 * turn.machine) to provide:
 *
 * 1. ID-based commands (not position-based)
 * 2. Full serialization/hydration support
 * 3. PlayerView with per-player information hiding
 * 4. Zero Node.js dependencies (runs on Cloudflare Workers)
 *
 * All game logic lives in the XState machines - this is just a wrapper.
 */

import { createActor, type Snapshot } from "xstate";
import { gameMachine, type GameContext, type GameEvent } from "./game.machine";
import { CONTRACTS, getContractForRound } from "./contracts";
import type { Card } from "../card/card.types";
import type { Meld } from "../meld/meld.types";
import type { MayIResolution, Player, RoundNumber, RoundRecord } from "./engine.types";
import type {
  GameSnapshot,
  PlayerView,
  OpponentInfo,
  CommandResult,
  MeldSpec,
  CreateGameOptions,
  EnginePhase,
  TurnPhase,
  MayIContext,
} from "./game-engine.types";
import type { Contract } from "./contracts";
import { getAvailableActions } from "./game-engine.availability";

/**
 * Type for XState's persisted snapshot structure
 */
type PersistedSnapshot = ReturnType<ReturnType<typeof createActor>["getPersistedSnapshot"]>;

/**
 * Internal types for extracting nested actor state from XState's persisted snapshot
 */
interface RoundContext {
  players: Player[];
  currentPlayerIndex: number;
  dealerIndex: number;
  stock: Card[];
  discard: Card[];
  table: Meld[];
  roundNumber: RoundNumber;
  turnNumber: number;
  lastDiscardedByPlayerId: string | null;
  mayIResolution: MayIResolution | null;
  discardClaimed: boolean;
}

interface TurnContext {
  playerId: string;
  hand: Card[];
  stock: Card[];
  discard: Card[];
  isDown: boolean;
  hasDrawn: boolean;
  laidDownThisTurn: boolean;
  table: Meld[];
  lastError: string | null;
}

// Note: MayIWindowContext removed - May I is now handled at round level

/**
 * GameEngine - Thin wrapper around XState actor
 *
 * Commands send events to XState and return the current snapshot.
 * XState guards handle all validation. Invalid events are silently ignored.
 * The state tells the story - compare before/after if you need success/failure.
 *
 * Usage:
 * ```typescript
 * // Create new game
 * const engine = GameEngine.createGame({ playerNames: ["Alice", "Bob", "Carol"] });
 *
 * // Execute command - returns snapshot directly
 * const snapshot = engine.drawFromStock("player-1");
 * // State tells you what happened - save to database
 *
 * // Hydrate from database
 * const restored = GameEngine.fromPersistedSnapshot(savedSnapshot);
 * ```
 */
export class GameEngine {
  private actor: ReturnType<typeof createActor<typeof gameMachine>>;
  private gameId: string;
  private createdAt: string;

  private constructor(
    actor: ReturnType<typeof createActor<typeof gameMachine>>,
    gameId: string,
    createdAt: string
  ) {
    this.actor = actor;
    this.gameId = gameId;
    this.createdAt = createdAt;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Factory Methods
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create a new game with the specified options
   */
  static createGame(options: CreateGameOptions): GameEngine {
    const {
      playerNames,
      startingRound = 1,
      gameId = crypto.randomUUID(),
    } = options;

    if (playerNames.length < 3 || playerNames.length > 8) {
      throw new Error("Game requires 3-8 players");
    }

    // Create actor with starting round input
    const actor = createActor(gameMachine, {
      input: { startingRound: startingRound as RoundNumber },
    });
    actor.start();

    // Add players
    for (const name of playerNames) {
      actor.send({ type: "ADD_PLAYER", name });
    }

    // Start game
    actor.send({ type: "START_GAME" });

    const now = new Date().toISOString();
    return new GameEngine(actor, gameId, now);
  }

  /**
   * Restore a game from a persisted XState snapshot
   *
   * This hydrates the full actor hierarchy including nested invoked actors.
   */
  static fromPersistedSnapshot(
    persistedSnapshot: PersistedSnapshot,
    gameId: string = crypto.randomUUID(),
    createdAt: string = new Date().toISOString()
  ): GameEngine {
    // When restoring from snapshot, input is required but ignored (snapshot state takes precedence)
    const actor = createActor(gameMachine, {
      snapshot: persistedSnapshot,
      input: { startingRound: 1 as RoundNumber }, // Dummy input - snapshot overrides it
    });
    actor.start();

    return new GameEngine(actor, gameId, createdAt);
  }

  /**
   * Restore from a JSON string (convenience method)
   */
  static fromJSON(json: string, gameId?: string, createdAt?: string): GameEngine {
    const persistedSnapshot = JSON.parse(json);
    return GameEngine.fromPersistedSnapshot(persistedSnapshot, gameId, createdAt);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // State Access
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get XState's persisted snapshot (for database storage)
   *
   * This is the canonical format for persistence. It includes all nested
   * actor state and can be used with fromPersistedSnapshot to hydrate.
   */
  getPersistedSnapshot(): PersistedSnapshot {
    return this.actor.getPersistedSnapshot();
  }

  /**
   * Get persisted snapshot as JSON string
   */
  toJSON(): string {
    return JSON.stringify(this.getPersistedSnapshot());
  }

  /**
   * Get our custom GameSnapshot format (extracted from XState state)
   */
  getSnapshot(): GameSnapshot {
    return this.extractGameSnapshot();
  }

  /**
   * Get a player-specific view (hides other players' hands)
   */
  getPlayerView(playerId: string): PlayerView {
    const snapshot = this.getSnapshot();
    const player = snapshot.players.find((p) => p.id === playerId);
    if (!player) {
      throw new Error("Player not found");
    }

    const opponents: OpponentInfo[] = snapshot.players
      .filter((p) => p.id !== playerId)
      .map((p) => ({
        id: p.id,
        name: p.name,
        avatarId: p.avatarId,
        handCount: p.hand.length,
        isDown: p.isDown,
        totalScore: p.totalScore,
        isDealer: snapshot.players[snapshot.dealerIndex]?.id === p.id,
        isCurrentPlayer: snapshot.players[snapshot.currentPlayerIndex]?.id === p.id,
      }));

    return {
      gameId: snapshot.gameId,
      viewingPlayerId: playerId,
      yourName: player.name,
      yourAvatarId: player.avatarId,
      yourHand: [...player.hand],
      isYourTurn: snapshot.awaitingPlayerId === playerId,
      youAreDown: player.isDown,
      yourTotalScore: player.totalScore,
      opponents,
      currentRound: snapshot.currentRound,
      contract: snapshot.contract,
      phase: snapshot.phase,
      turnPhase: snapshot.turnPhase,
      turnNumber: snapshot.turnNumber,
      awaitingPlayerId: snapshot.awaitingPlayerId,
      stockCount: snapshot.stock.length,
      topDiscard: snapshot.discard[0] ?? null,
      discardCount: snapshot.discard.length,
      table: [...snapshot.table],
      roundHistory: [...snapshot.roundHistory],
      mayIContext: snapshot.mayIContext ? { ...snapshot.mayIContext } : null,
      availableActions: getAvailableActions(snapshot, playerId),
      turnOrder: snapshot.players.map((p) => p.id),
    };
  }

  /**
   * Get the current phase
   */
  getPhase(): EnginePhase {
    const snapshot = this.getSnapshot();
    return snapshot.phase;
  }

  /**
   * Get the current turn phase
   */
  getTurnPhase(): TurnPhase {
    const snapshot = this.getSnapshot();
    return snapshot.turnPhase;
  }

  /**
   * Get the ID of the player the engine is waiting on
   */
  getAwaitingPlayerId(): string {
    const snapshot = this.getSnapshot();
    return snapshot.awaitingPlayerId;
  }

  /**
   * Stop the actor (cleanup)
   */
  stop(): void {
    this.actor.stop();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Commands - All return the current snapshot. The state tells the story.
  // XState guards handle validation. Invalid events are silently ignored.
  // Compare before/after snapshots if you need to detect success/failure.
  // ═══════════════════════════════════════════════════════════════════════════

  /** Draw from stock. In May I window, this acts as "pass". */
  drawFromStock(playerId: string): CommandResult {
    this.actor.send({ type: "DRAW_FROM_STOCK", playerId });
    return this.getSnapshot();
  }

  /** Draw from discard pile */
  drawFromDiscard(playerId: string): CommandResult {
    this.actor.send({ type: "DRAW_FROM_DISCARD", playerId });
    return this.getSnapshot();
  }

  /** Skip laying down/off and proceed to discard phase */
  skip(playerId: string): CommandResult {
    this.actor.send({ type: "SKIP_LAY_DOWN", playerId });
    return this.getSnapshot();
  }

  /** Lay down melds to meet the contract */
  layDown(playerId: string, meldSpecs: MeldSpec[]): CommandResult {
    const melds = meldSpecs.map((spec) => ({ type: spec.type, cardIds: spec.cardIds }));
    this.actor.send({ type: "LAY_DOWN", playerId, melds });
    return this.getSnapshot();
  }

  /** Lay off a card onto an existing meld */
  layOff(playerId: string, cardId: string, meldId: string, position?: "start" | "end"): CommandResult {
    this.actor.send({ type: "LAY_OFF", playerId, cardId, meldId, position });
    return this.getSnapshot();
  }

  /** Swap a joker from a run with a card from hand */
  swap(playerId: string, meldId: string, jokerCardId: string, swapCardId: string): CommandResult {
    this.actor.send({ type: "SWAP_JOKER", playerId, jokerCardId, meldId, swapCardId });
    return this.getSnapshot();
  }

  /** Discard a card from hand */
  discard(playerId: string, cardId: string): CommandResult {
    this.actor.send({ type: "DISCARD", playerId, cardId });
    return this.getSnapshot();
  }

  /** Call May I to claim the discarded card (starts resolution) */
  callMayI(playerId: string): CommandResult {
    this.actor.send({ type: "CALL_MAY_I", playerId });
    return this.getSnapshot();
  }

  /** Allow the May I caller to have the card (when prompted during resolution) */
  allowMayI(playerId: string): CommandResult {
    this.actor.send({ type: "ALLOW_MAY_I", playerId });
    return this.getSnapshot();
  }

  /** Claim the card yourself, blocking the original caller (when prompted during resolution) */
  claimMayI(playerId: string): CommandResult {
    this.actor.send({ type: "CLAIM_MAY_I", playerId });
    return this.getSnapshot();
  }


  /** Reorder cards in hand (free action, can be called anytime during player's turn) */
  reorderHand(playerId: string, newCardOrder: string[]): CommandResult {
    this.actor.send({ type: "REORDER_HAND", playerId, newOrder: newCardOrder });
    return this.getSnapshot();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Extract GameSnapshot from XState's internal state
   */
  private extractGameSnapshot(): GameSnapshot {
    const actorSnapshot = this.actor.getSnapshot();
    const persistedSnapshot = this.actor.getPersistedSnapshot() as any;
    const context = actorSnapshot.context;

    // Get nested actor state
    const roundSnapshot = persistedSnapshot.children?.round?.snapshot;
    const roundContext = roundSnapshot?.context as RoundContext | undefined;
    const turnSnapshot = roundSnapshot?.children?.turn?.snapshot;
    const turnContext = turnSnapshot?.context as TurnContext | undefined;

    // Check if we're in May I resolution (round-level state)
    const roundState = roundSnapshot?.value;
    const isResolvingMayI =
      typeof roundState === "object" &&
      roundState !== null &&
      "active" in roundState &&
      typeof roundState.active === "object" &&
      roundState.active !== null &&
      "resolvingMayI" in roundState.active;

    // Determine phase
    let phase: EnginePhase = "ROUND_ACTIVE";
    let turnPhase: TurnPhase = "AWAITING_DRAW";

    const machineState = actorSnapshot.value;
    if (machineState === "setup") {
      phase = "ROUND_ACTIVE";
    } else if (machineState === "gameEnd") {
      phase = "GAME_END";
    } else if (machineState === "roundEnd") {
      phase = "ROUND_END";
    } else if (machineState === "playing") {
      // Check for May I resolution state first
      if (isResolvingMayI) {
        phase = "RESOLVING_MAY_I";
      } else {
        phase = "ROUND_ACTIVE";
      }

      // Check turn state
      const turnState = turnSnapshot?.value;
      if (typeof turnState === "string") {
        if (turnState === "awaitingDraw") turnPhase = "AWAITING_DRAW";
        else if (turnState === "drawn") turnPhase = "AWAITING_ACTION";
        else if (turnState === "awaitingDiscard") turnPhase = "AWAITING_DISCARD";
      }
    }

    // Build players array - prefer round context if available
    const players: Player[] = roundContext?.players ?? context.players;

    // Update current player's hand from turn context
    const updatedPlayers = players.map((p) => {
      if (turnContext && p.id === turnContext.playerId) {
        return {
          ...p,
          hand: turnContext.hand,
          isDown: turnContext.isDown,
        };
      }
      return p;
    });

    // Get current player index
    const currentPlayerIndex = roundContext?.currentPlayerIndex ?? 0;
    const dealerIndex = roundContext?.dealerIndex ?? context.dealerIndex;

    // Get awaiting player - during May I resolution, it's the prompted player
    let awaitingPlayerId = updatedPlayers[currentPlayerIndex]?.id ?? "";
    if (isResolvingMayI && roundContext?.mayIResolution?.playerBeingPrompted) {
      awaitingPlayerId = roundContext.mayIResolution.playerBeingPrompted;
    }

    // Extract May I context from round-level mayIResolution
    let mayIContextResult: MayIContext | null = null;
    if (roundContext?.mayIResolution) {
      const resolution = roundContext.mayIResolution;
      mayIContextResult = {
        originalCaller: resolution.originalCaller,
        cardBeingClaimed: resolution.cardBeingClaimed,
        playersToCheck: resolution.playersToCheck,
        currentPromptIndex: resolution.currentPromptIndex,
        playerBeingPrompted: resolution.playerBeingPrompted,
        playersWhoAllowed: resolution.playersWhoAllowed,
        winner: resolution.winner,
        outcome: resolution.outcome,
      };
    }

    const currentRound = (context.currentRound ?? 1) as RoundNumber;

    // Prefer turn error when available, then fall back to game-level error
    const lastError = turnContext?.lastError ?? context.lastError ?? null;

    return {
      version: "3.0",
      gameId: this.gameId,
      lastError,
      phase,
      turnPhase,
      turnNumber: roundContext?.turnNumber ?? 1,
      lastDiscardedByPlayerId: roundContext?.lastDiscardedByPlayerId ?? null,
      discardClaimed: roundContext?.discardClaimed ?? false,
      currentRound,
      contract: getContractForRound(currentRound)!,
      players: updatedPlayers,
      dealerIndex,
      currentPlayerIndex,
      awaitingPlayerId,
      // Prefer turn context for stock/discard/table as they're most current during a turn
      stock: turnContext?.stock ?? roundContext?.stock ?? [],
      discard: turnContext?.discard ?? roundContext?.discard ?? [],
      table: turnContext?.table ?? roundContext?.table ?? [],
      hasDrawn: turnContext?.hasDrawn ?? false,
      laidDownThisTurn: turnContext?.laidDownThisTurn ?? false,
      mayIContext: mayIContextResult,
      roundHistory: context.roundHistory ?? [],
      createdAt: this.createdAt,
      updatedAt: new Date().toISOString(),
    };
  }
}
