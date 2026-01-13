/**
 * Agent Test State Converter
 *
 * Converts the simplified AgentTestState format into the full
 * StoredGameState format that PartyGameAdapter expects.
 */

import type { AgentTestState } from "./agent-state.types";
import type { StoredGameState, PlayerMapping } from "./party-game-adapter";
import type { AIModelId, AI_MODEL_DISPLAY_NAMES } from "./protocol.types";
import { CONTRACTS } from "../../core/engine/contracts";

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

  // Build player mappings (first player is the human agent)
  const playerMappings: PlayerMapping[] = state.players.map((player, index) => ({
    lobbyId: player.id,
    engineId: `player-${index}`,
    name: player.name,
    isAI: player.isAI,
    aiModelId: player.isAI ? player.aiModelId : undefined,
  }));

  // Map players to engine format
  const enginePlayers = state.players.map((player, index) => ({
    id: `player-${index}`,
    name: player.name,
    hand: player.hand,
    isDown: player.isDown,
    totalScore: player.totalScore ?? 0,
  }));

  // Get contract for the round
  const contract = CONTRACTS[state.roundNumber];

  // Determine the dealer (we'll use the last player as default)
  const dealerIndex = state.players.length - 1;

  // Build player order for turn context
  const playerOrder = enginePlayers.map((p) => p.id);

  // Build player down status map
  const playerDownStatus: Record<string, boolean> = {};
  enginePlayers.forEach((p) => {
    playerDownStatus[p.id] = p.isDown;
  });

  // Current player info
  const currentPlayer = enginePlayers[state.turn.currentPlayerIndex]!;

  // Map AgentTestState phase to XState turn machine state value
  // awaitingDraw → awaitingDraw
  // awaitingAction → drawn (XState uses "drawn" for post-draw state)
  // awaitingDiscard → awaitingDiscard
  const xstateTurnValue =
    state.turn.phase === "awaitingAction" ? "drawn" : state.turn.phase;

  // Build the XState v5 persisted snapshot structure
  const engineSnapshot = {
    status: "active",
    value: "playing",
    historyValue: {},
    context: {
      gameId: roomId,
      players: enginePlayers.map((p) => ({ ...p, hand: [] })), // Parent context has empty hands
      currentRound: state.roundNumber,
      dealerIndex,
      roundHistory: [],
      winners: [],
      lastError: null,
    },
    children: {
      round: {
        snapshot: {
          status: "active",
          value: { active: "playing" },
          historyValue: {},
          context: {
            roundNumber: state.roundNumber,
            contract: {
              roundNumber: state.roundNumber,
              sets: contract.sets,
              runs: contract.runs,
            },
            players: enginePlayers,
            currentPlayerIndex: state.turn.currentPlayerIndex,
            dealerIndex,
            stock: state.stock,
            discard: state.discard,
            table: state.table,
            winnerPlayerId: null,
            turnNumber: 1, // We start at turn 1 for injected state
            lastDiscardedByPlayerId:
              state.discard.length > 0
                ? enginePlayers[(state.turn.currentPlayerIndex + enginePlayers.length - 1) % enginePlayers.length]!.id
                : null,
            predefinedState: null,
            mayIResolution: null,
            discardClaimed: false,
            currentPlayerHasDrawnFromStock: state.turn.phase !== "awaitingDraw" && state.turn.hasDrawn,
          },
          children: {
            turn: {
              snapshot: {
                status: "active",
                value: xstateTurnValue,
                historyValue: {},
                context: {
                  playerId: currentPlayer.id,
                  hand: currentPlayer.hand,
                  stock: state.stock,
                  discard: state.discard,
                  hasDrawn: state.turn.hasDrawn,
                  roundNumber: state.roundNumber,
                  isDown: currentPlayer.isDown,
                  laidDownThisTurn: false,
                  table: state.table,
                  lastError: null,
                  playerOrder,
                  playerDownStatus,
                  lastDiscardedByPlayerId:
                    state.discard.length > 0
                      ? enginePlayers[(state.turn.currentPlayerIndex + enginePlayers.length - 1) % enginePlayers.length]!.id
                      : null,
                },
                children: {},
              },
              src: "turnMachine",
              syncSnapshot: false,
            },
          },
        },
        src: "roundMachine",
        syncSnapshot: false,
      },
    },
  };

  return {
    engineSnapshot: JSON.stringify(engineSnapshot),
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
