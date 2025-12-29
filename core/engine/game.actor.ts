/**
 * Game Actor Factory
 *
 * Provides a clean API for creating and managing game actors.
 * This is the main entry point for starting games.
 */

import { createActor, type ActorRefFrom, type InspectionEvent, type Snapshot } from "xstate";
import { gameMachine, type GameContext, type GameEvent } from "./game.machine";
import type { RoundNumber, Player } from "./engine.types";
import type { Card } from "../card/card.types";
import type { Meld } from "../meld/meld.types";

/**
 * Internal types for accessing persisted snapshot hierarchy.
 * XState's getPersistedSnapshot() returns a recursive structure that
 * doesn't fully type the children property. These types represent
 * our specific actor hierarchy for type-safe extraction.
 */
interface PersistedChildSnapshot<TContext, TValue = string> {
  snapshot?: {
    value: TValue;
    context: TContext;
    children?: Record<string, PersistedChildSnapshot<unknown>>;
  };
}

interface MayIContext {
  discardedCard: Card;
  claimants: string[];
  currentPlayerId: string;
}

interface TurnContext {
  playerId: string;
  hand: Card[];
  isDown: boolean;
  hasDrawn: boolean;
  laidDownThisTurn: boolean;
}

interface RoundContext {
  players: Player[];
  currentPlayerIndex: number;
  stock: Card[];
  discard: Card[];
  table: Meld[];
}

interface GamePersistedSnapshot {
  value: string;
  context: GameContext;
  children?: {
    round?: PersistedChildSnapshot<RoundContext> & {
      snapshot?: {
        children?: {
          turn?: PersistedChildSnapshot<TurnContext, string | Record<string, unknown>> & {
            snapshot?: {
              children?: {
                mayIWindow?: PersistedChildSnapshot<MayIContext>;
              };
            };
          };
        };
      };
    };
  };
}

/**
 * Type for the game actor returned by the factory
 */
export type GameActor = ActorRefFrom<typeof gameMachine>;

/**
 * Input for creating a new game
 */
export interface GameActorInput {
  /** Player names to add to the game */
  playerNames?: string[];
  /** Whether to auto-start the game after adding players */
  autoStart?: boolean;
}

/**
 * Options for creating a game actor
 */
export interface GameActorOptions {
  /** Callback for inspection events (useful for logging/replay) */
  onInspect?: (event: InspectionEvent) => void;
  /** Persisted snapshot to restore from */
  snapshot?: Snapshot<unknown>;
}

/**
 * Serializable game state for persistence
 * This flattens the hierarchical actor state into a single object
 */
export interface SerializableGameState {
  version: "3.0";

  // Game-level
  gameId: string;
  currentRound: RoundNumber;
  dealerIndex: number;
  roundHistory: Array<{
    roundNumber: number;
    scores: Record<string, number>;
    winnerId: string;
  }>;

  // Current state
  machineState: string;

  // Round-level (only present during playing state)
  players: Array<{
    id: string;
    name: string;
    hand: Card[];
    isDown: boolean;
    totalScore: number;
  }>;
  currentPlayerIndex: number;
  stock: Card[];
  discard: Card[];
  table: Meld[];

  // Turn-level
  turnPhase: TurnPhase;
  hasDrawn: boolean;
  laidDownThisTurn: boolean;

  // May I window (if active)
  mayIWindow: {
    discardedCard: Card;
    claimants: string[];
    awaitingPlayerId: string;
  } | null;
}

export type TurnPhase =
  | "awaitingDraw"
  | "mayIWindow"
  | "drawn"
  | "awaitingDiscard"
  | "turnComplete";

/**
 * Create a new game actor
 *
 * @example
 * ```typescript
 * // Create and start a game
 * const actor = createGameActor({
 *   playerNames: ["Alice", "Bob", "Carol"],
 *   autoStart: true,
 * });
 *
 * // Send events
 * actor.send({ type: "DRAW_FROM_STOCK" });
 *
 * // Get state
 * const state = getSerializableState(actor);
 * ```
 */
export function createGameActor(
  input?: GameActorInput,
  options?: GameActorOptions
): GameActor {
  const actor = createActor(gameMachine, {
    snapshot: options?.snapshot,
    inspect: options?.onInspect,
  });

  actor.start();

  // Add players if provided
  if (input?.playerNames) {
    for (const name of input.playerNames) {
      actor.send({ type: "ADD_PLAYER", name });
    }
  }

  // Auto-start if requested
  if (input?.autoStart && input?.playerNames && input.playerNames.length >= 3) {
    actor.send({ type: "START_GAME" });
  }

  return actor;
}

/**
 * Get serializable state from a game actor
 *
 * This extracts state from the hierarchical actor structure into a flat object
 * suitable for JSON serialization.
 */
export function getSerializableState(actor: GameActor): SerializableGameState {
  const snapshot = actor.getSnapshot();
  const context = snapshot.context;
  // Cast to our typed structure - XState's getPersistedSnapshot doesn't fully type children
  const persistedSnapshot = actor.getPersistedSnapshot() as unknown as GamePersistedSnapshot;

  // Get round-level data from invoked roundMachine
  const roundSnapshot = persistedSnapshot.children?.round?.snapshot;
  const roundContext = roundSnapshot?.context;

  // Get turn-level data from invoked turnMachine
  const turnSnapshot = roundSnapshot?.children?.turn?.snapshot;
  const turnContext = turnSnapshot?.context;

  // Get May I window data from invoked mayIWindowMachine
  const mayISnapshot = turnSnapshot?.children?.mayIWindow?.snapshot;
  const mayIContext = mayISnapshot?.context;

  // Determine turn phase
  let turnPhase: TurnPhase = "awaitingDraw";
  if (turnContext) {
    const turnState = turnSnapshot?.value;
    if (typeof turnState === "string") {
      if (turnState === "awaitingDraw") turnPhase = "awaitingDraw";
      else if (turnState === "drawn") turnPhase = "drawn";
      else if (turnState === "complete") turnPhase = "turnComplete";
      else if (turnState === "awaitingDiscard") turnPhase = "awaitingDiscard";
    } else if (typeof turnState === "object" && turnState !== null) {
      if ("mayIWindow" in turnState) turnPhase = "mayIWindow";
      else if ("awaitingDiscard" in turnState) turnPhase = "awaitingDiscard";
    }
  }

  // Build players array - prefer round context if available
  const players: Player[] = roundContext?.players ?? context.players;

  return {
    version: "3.0",

    // Game-level
    gameId: context.gameId,
    currentRound: context.currentRound as RoundNumber,
    dealerIndex: context.dealerIndex,
    roundHistory: context.roundHistory,

    // Current state
    machineState: String(snapshot.value),

    // Round-level
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      hand: turnContext?.playerId === p.id ? turnContext.hand : p.hand,
      isDown: turnContext?.playerId === p.id ? turnContext.isDown : p.isDown,
      totalScore: p.totalScore,
    })),
    currentPlayerIndex: roundContext?.currentPlayerIndex ?? 0,
    stock: roundContext?.stock ?? [],
    discard: roundContext?.discard ?? [],
    table: roundContext?.table ?? [],

    // Turn-level
    turnPhase,
    hasDrawn: turnContext?.hasDrawn ?? false,
    laidDownThisTurn: turnContext?.laidDownThisTurn ?? false,

    // May I window
    mayIWindow: mayIContext
      ? {
          discardedCard: mayIContext.discardedCard,
          claimants: mayIContext.claimants,
          awaitingPlayerId: mayIContext.currentPlayerId,
        }
      : null,
  };
}

/**
 * Restore a game actor from serialized state.
 *
 * LIMITATION: XState v5's invoke pattern does not support full snapshot restoration
 * for invoked actors. This function can only restore games in setup or gameEnd states.
 * Games in the "playing" state cannot be restored because the roundMachine (and its
 * children turnMachine and mayIWindowMachine) cannot be reconstructed from a snapshot.
 *
 * For games in "playing" state, this will throw an error. To persist mid-game state,
 * you would need to implement a different serialization approach that replays events.
 *
 * @throws Error if attempting to restore a game in "playing" state
 */
export function restoreGameActor(
  state: SerializableGameState,
  options?: Omit<GameActorOptions, "snapshot">
): GameActor {
  // Cannot restore games with active invoked actors
  if (state.machineState === "playing") {
    throw new Error(
      "Cannot restore game in 'playing' state. " +
        "XState v5 invoke pattern does not support restoring invoked actor hierarchies. " +
        "Games can only be restored from 'setup' or 'gameEnd' states."
    );
  }

  // Build context from serialized state
  const restoredContext: GameContext = {
    gameId: state.gameId,
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      hand: p.hand,
      isDown: p.isDown,
      totalScore: p.totalScore,
    })),
    currentRound: state.currentRound,
    dealerIndex: state.dealerIndex,
    roundHistory: state.roundHistory,
    winners: [],
    lastError: null,
  };

  // XState expects specific literal types for status
  // Handle setup and gameEnd separately for proper typing
  const baseSnapshot = {
    value: state.machineState,
    context: restoredContext,
    children: {},
    output: undefined,
    error: undefined,
  };

  const snapshot =
    state.machineState === "gameEnd"
      ? { ...baseSnapshot, status: "done" as const }
      : { ...baseSnapshot, status: "active" as const };

  const actor = createActor(gameMachine, {
    snapshot,
    inspect: options?.onInspect,
  });

  actor.start();
  return actor;
}
