/**
 * Agent Test State Converter
 *
 * Converts the simplified AgentTestState format into the full
 * StoredGameState format that PartyGameAdapter expects.
 */

import type { AgentTestState } from "./agent-state.types";
import type { StoredGameState, PlayerMapping } from "./party-game-adapter";
import { GameEngine } from "../../core/engine/game-engine";

/**
 * Convert AgentTestState to StoredGameState
 *
 * This creates a valid XState snapshot structure that can be used
 * with PartyGameAdapter.fromStoredState()
 */
export function convertAgentTestStateToStoredState(
  state: AgentTestState,
  roomId: string
): StoredGameState {
  const now = new Date().toISOString();

  const playerNames = state.players.map((p) => p.name);

  // Create a real engine snapshot as a base, then patch in the injected round state.
  // This avoids hand-constructing the entire XState persisted snapshot shape.
  const baseEngine = GameEngine.createGame({
    playerNames,
    startingRound: state.roundNumber,
    gameId: roomId,
  });
  const persistedSnapshot = JSON.parse(baseEngine.toJSON()) as any;

  // Build player mappings (lobby IDs ↔ engine IDs)
  const playerMappings: PlayerMapping[] = state.players.map((player, index) => ({
    lobbyId: player.id,
    engineId: `player-${index}`,
    name: player.name,
    isAI: player.isAI,
    aiModelId: player.isAI ? player.aiModelId : undefined,
  }));

  const lobbyIdToEngineId = new Map(
    playerMappings.map((m) => [m.lobbyId, m.engineId] as const)
  );

  const enginePlayers = state.players.map((player, index) => ({
    id: `player-${index}`,
    name: player.name,
    hand: player.hand,
    isDown: player.isDown,
    totalScore: player.totalScore ?? 0,
  }));

  // Translate meld ownership from lobby IDs → engine IDs
  const translatedTable = state.table.map((meld) => ({
    ...meld,
    ownerId: lobbyIdToEngineId.get(meld.ownerId) ?? meld.ownerId,
  }));

  const roundSnapshot = persistedSnapshot?.children?.round?.snapshot;
  const roundContext = roundSnapshot?.context;
  const turnSnapshot = roundSnapshot?.children?.turn?.snapshot;
  const turnContext = turnSnapshot?.context;
  const rootContext = persistedSnapshot?.context;

  return {
    engineSnapshot: JSON.stringify(
      patchPersistedSnapshotForAgentTestState({
        persistedSnapshot,
        rootContext,
        roundContext,
        turnSnapshot,
        turnContext,
        state,
        enginePlayers,
        translatedTable,
      })
    ),
    playerMappings,
    roomId,
    createdAt: now,
    updatedAt: now,
    activityLog: [
      {
        id: "log-1",
        timestamp: now,
        roundNumber: state.roundNumber,
        turnNumber: 1,
        playerId: "system",
        playerName: "System",
        action: "State injected for agent testing",
      },
    ],
  };
}

function patchPersistedSnapshotForAgentTestState(options: {
  persistedSnapshot: any;
  rootContext: any;
  roundContext: any;
  turnSnapshot: any;
  turnContext: any;
  state: AgentTestState;
  enginePlayers: Array<{
    id: string;
    name: string;
    hand: unknown[];
    isDown: boolean;
    totalScore: number;
  }>;
  translatedTable: unknown[];
}): any {
  const {
    persistedSnapshot,
    rootContext,
    roundContext,
    turnSnapshot,
    turnContext,
    state,
    enginePlayers,
    translatedTable,
  } = options;

  if (!persistedSnapshot || !rootContext || !roundContext || !turnSnapshot || !turnContext) {
    throw new Error("Unexpected engine snapshot shape (cannot apply agent test state)");
  }

  const playerCount = enginePlayers.length;
  const currentPlayerIndex = state.turn.currentPlayerIndex;
  const currentPlayer = enginePlayers[currentPlayerIndex];
  if (!currentPlayer) {
    throw new Error(`Invalid currentPlayerIndex ${currentPlayerIndex}`);
  }

  const dealerIndex = (currentPlayerIndex + playerCount - 1) % playerCount;
  const lastDiscardedByPlayerId =
    state.discard.length > 0 ? enginePlayers[dealerIndex]!.id : null;

  const xstateTurnValue =
    state.turn.phase === "awaitingAction" ? "drawn" : state.turn.phase;

  const drawSource =
    state.turn.hasDrawn ? (state.turn.drawSource ?? "stock") : null;

  const playerOrder = enginePlayers.map((p) => p.id);
  const playerDownStatus = Object.fromEntries(
    enginePlayers.map((p) => [p.id, p.isDown])
  );

  rootContext.players = enginePlayers.map((p) => ({ ...p, hand: [] }));
  rootContext.currentRound = state.roundNumber;
  rootContext.dealerIndex = dealerIndex;

  roundContext.roundNumber = state.roundNumber;
  roundContext.players = enginePlayers;
  roundContext.currentPlayerIndex = currentPlayerIndex;
  roundContext.dealerIndex = dealerIndex;
  roundContext.stock = state.stock;
  roundContext.discard = state.discard;
  roundContext.table = translatedTable;
  roundContext.winnerPlayerId = null;
  roundContext.turnNumber = 1;
  roundContext.predefinedState = null;
  roundContext.mayIResolution = null;
  roundContext.lastDiscardedByPlayerId = lastDiscardedByPlayerId;

  // Best-effort for May-I related flags. If you need more precise control,
  // inject a full persisted snapshot instead of AgentTestState.
  roundContext.discardClaimed = drawSource === "discard";
  roundContext.currentPlayerHasDrawnFromStock = drawSource === "stock";

  turnSnapshot.value = xstateTurnValue;
  turnContext.playerId = currentPlayer.id;
  turnContext.hand = currentPlayer.hand;
  turnContext.stock = state.stock;
  turnContext.discard = state.discard;
  turnContext.hasDrawn = state.turn.hasDrawn;
  turnContext.roundNumber = state.roundNumber;
  turnContext.isDown = currentPlayer.isDown;
  turnContext.laidDownThisTurn = false;
  turnContext.table = translatedTable;
  turnContext.lastError = null;
  turnContext.playerOrder = playerOrder;
  turnContext.playerDownStatus = playerDownStatus;
  turnContext.lastDiscardedByPlayerId = lastDiscardedByPlayerId ?? undefined;

  return persistedSnapshot;
}
