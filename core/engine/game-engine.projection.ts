import type { Card } from "../card/card.types";
import type { Meld } from "../meld/meld.types";
import type { MayIResolution, Player, RoundNumber } from "./engine.types";
import type {
  EnginePhase,
  GameSnapshot,
  MayIContext,
  TurnPhase,
} from "./game-engine.types";
import { getContractForRound } from "./contracts";
import {
  duplicateCardIdsFromReport,
  validateCardZones,
  zonesFromRoundState,
} from "./card-state.invariants";
import { applyCardInvariantPolicy } from "./card-state.invariant-policy";

export type ProjectionWarningSink = (
  message?: unknown,
  ...optionalParams: unknown[]
) => void;

interface ActorSnapshotLike {
  value: unknown;
  context: GameProjectionContext;
}

interface GameProjectionContext {
  players: Player[];
  currentRound?: number;
  dealerIndex: number;
  lastError?: string | null;
  roundHistory?: GameSnapshot["roundHistory"];
}

interface PersistedSnapshotLike {
  children?: {
    round?: {
      snapshot?: PersistedChildSnapshotLike;
    };
  };
}

interface PersistedChildSnapshotLike {
  value?: unknown;
  context?: unknown;
  children?: {
    turn?: {
      snapshot?: PersistedChildSnapshotLike;
    };
  };
}

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
  hasDrawn: boolean;
  laidDownThisTurn: boolean;
  tookActionThisTurn: boolean;
  lastError: string | null;
}

export type GameEnginePersistedSnapshot = PersistedSnapshotLike;

export interface GameSnapshotProjectionInput {
  actorSnapshot: ActorSnapshotLike;
  persistedSnapshot: unknown;
  gameId: string;
  createdAt: string;
  updatedAt?: string;
  warn?: ProjectionWarningSink;
}

export function projectGameSnapshotFromXState(
  input: GameSnapshotProjectionInput
): GameSnapshot {
  const persistedSnapshot = input.persistedSnapshot as PersistedSnapshotLike;
  const context = input.actorSnapshot.context;

  const roundSnapshot = persistedSnapshot.children?.round?.snapshot;
  const roundContext = roundSnapshot?.context as RoundContext | undefined;
  const turnSnapshot = roundSnapshot?.children?.turn?.snapshot;
  const turnContext = turnSnapshot?.context as TurnContext | undefined;
  const isResolvingMayI = isRoundResolvingMayI(roundSnapshot?.value);

  const { phase, turnPhase } = projectPhases({
    gameState: input.actorSnapshot.value,
    turnState: turnSnapshot?.value,
    isResolvingMayI,
  });

  const players = clonePlayers(roundContext?.players ?? context.players);
  const currentPlayerIndex = roundContext?.currentPlayerIndex ?? 0;
  const dealerIndex = roundContext?.dealerIndex ?? context.dealerIndex;
  const awaitingPlayerId = projectAwaitingPlayerId({
    players,
    currentPlayerIndex,
    isResolvingMayI,
    mayIResolution: roundContext?.mayIResolution ?? null,
  });
  const mayIContext = projectMayIContext(roundContext?.mayIResolution ?? null);
  const currentRound = (context.currentRound ?? 1) as RoundNumber;
  const contract = getContractForRound(currentRound);

  if (!contract) {
    throw new Error(`Unknown contract for round ${currentRound}`);
  }

  const stock = cloneCards(roundContext?.stock ?? []);
  const discard = cloneCards(roundContext?.discard ?? []);
  const table = cloneTable(roundContext?.table ?? []);

  warnOnCardInvariantViolations({
    gameId: input.gameId,
    players,
    stock,
    discard,
    table,
    turnPlayerId: turnContext?.playerId ?? null,
    roundDiscardCount: roundContext?.discard?.length ?? null,
    roundPlayerCount: roundContext?.players?.length ?? null,
    warn: input.warn ?? console.warn,
  });

  return {
    version: "3.0",
    gameId: input.gameId,
    lastError: turnContext?.lastError ?? context.lastError ?? null,
    phase,
    turnPhase,
    turnNumber: roundContext?.turnNumber ?? 1,
    lastDiscardedByPlayerId: roundContext?.lastDiscardedByPlayerId ?? null,
    discardClaimed: roundContext?.discardClaimed ?? false,
    currentRound,
    contract,
    players,
    dealerIndex,
    currentPlayerIndex,
    awaitingPlayerId,
    stock,
    discard,
    table,
    hasDrawn: turnContext?.hasDrawn ?? false,
    laidDownThisTurn: turnContext?.laidDownThisTurn ?? false,
    tookActionThisTurn: turnContext?.tookActionThisTurn ?? false,
    mayIContext,
    roundHistory: context.roundHistory ?? [],
    createdAt: input.createdAt,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  };
}

function projectPhases(input: {
  gameState: unknown;
  turnState: unknown;
  isResolvingMayI: boolean;
}): { phase: EnginePhase; turnPhase: TurnPhase } {
  let phase: EnginePhase = "ROUND_ACTIVE";
  let turnPhase: TurnPhase = "AWAITING_DRAW";

  if (input.gameState === "gameEnd") {
    phase = "GAME_END";
  } else if (input.gameState === "roundEnd") {
    phase = "ROUND_END";
  } else if (input.gameState === "playing") {
    phase = input.isResolvingMayI ? "RESOLVING_MAY_I" : "ROUND_ACTIVE";

    if (input.turnState === "drawn") {
      turnPhase = "AWAITING_ACTION";
    } else if (input.turnState === "awaitingDiscard") {
      turnPhase = "AWAITING_DISCARD";
    }
  }

  return { phase, turnPhase };
}

function projectAwaitingPlayerId(input: {
  players: Player[];
  currentPlayerIndex: number;
  isResolvingMayI: boolean;
  mayIResolution: MayIResolution | null;
}): string {
  if (input.isResolvingMayI && input.mayIResolution?.playerBeingPrompted) {
    return input.mayIResolution.playerBeingPrompted;
  }

  return input.players[input.currentPlayerIndex]?.id ?? "";
}

function projectMayIContext(
  resolution: MayIResolution | null
): MayIContext | null {
  if (!resolution) {
    return null;
  }

  return {
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

function isRoundResolvingMayI(roundState: unknown): boolean {
  return (
    typeof roundState === "object" &&
    roundState !== null &&
    "active" in roundState &&
    typeof roundState.active === "object" &&
    roundState.active !== null &&
    "resolvingMayI" in roundState.active
  );
}

function warnOnCardInvariantViolations(input: {
  gameId: string;
  players: Player[];
  stock: Card[];
  discard: Card[];
  table: Meld[];
  turnPlayerId: string | null;
  roundDiscardCount: number | null;
  roundPlayerCount: number | null;
  warn: ProjectionWarningSink;
}): void {
  const cardInvariantReport = validateCardZones(
    zonesFromRoundState({
      players: input.players,
      stock: input.stock,
      discard: input.discard,
      table: input.table,
    })
  );
  const duplicateIds = duplicateCardIdsFromReport(cardInvariantReport);

  if (duplicateIds.length === 0) {
    return;
  }

  applyCardInvariantPolicy(cardInvariantReport, {
    policy: "warn",
    warn: input.warn,
    message:
      `[GameEngine] Duplicate card IDs detected: ${duplicateIds.join(", ")}. ` +
      "Game continues but state may be corrupted.",
    context: {
      gameId: input.gameId,
      turnPlayerId: input.turnPlayerId,
      roundDiscardCount: input.roundDiscardCount,
      roundPlayerCount: input.roundPlayerCount,
    },
  });
}

function cloneCards(cards: Card[]): Card[] {
  return cards.map((card) => ({ ...card }));
}

function clonePlayers(players: Player[]): Player[] {
  return players.map((player) => ({
    ...player,
    hand: cloneCards(player.hand),
  }));
}

function cloneTable(table: Meld[]): Meld[] {
  return table.map((meld) => ({
    ...meld,
    cards: cloneCards(meld.cards),
  }));
}
