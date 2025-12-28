/**
 * State management for the May I? CLI harness
 *
 * Handles loading, saving, and creating game state
 */

import type { Card } from "../core/card/card.types";
import type { RoundNumber } from "../core/engine/engine.types";
import type { PersistedGameState, ActionLogEntry, HarnessState } from "./harness.types";
import { CONTRACTS } from "../core/engine/contracts";
import { createDeck, shuffle, deal } from "../core/card/card.deck";
import { getDeckConfig } from "../core/engine/round.machine";

const STATE_FILE = "harness/game-state.json";
const LOG_FILE = "harness/game-log.jsonl";

/**
 * Check if a game state file exists
 */
export function gameExists(): boolean {
  return Bun.file(STATE_FILE).size > 0;
}

/**
 * Load game state from file
 */
export function loadGameState(): PersistedGameState {
  const file = Bun.file(STATE_FILE);
  if (file.size === 0) {
    throw new Error("No game in progress. Run 'bun harness/play.ts new' to start a new game.");
  }
  const content = require("fs").readFileSync(STATE_FILE, "utf-8");
  const state = JSON.parse(content) as PersistedGameState;

  // Basic validation
  if (state.version !== "1.0") {
    throw new Error(`Unsupported state version: ${state.version}`);
  }
  if (!state.players || state.players.length < 3) {
    throw new Error("Invalid state: missing or insufficient players");
  }

  return state;
}

/**
 * Save game state to file
 */
export function saveGameState(state: PersistedGameState): void {
  state.updatedAt = new Date().toISOString();
  const content = JSON.stringify(state, null, 2);
  require("fs").writeFileSync(STATE_FILE, content);
}

/**
 * Create a new 3-player game
 */
export function createNewGame(
  playerNames: [string, string, string],
  seed?: string
): PersistedGameState {
  const gameId = crypto.randomUUID().slice(0, 8);
  const now = new Date().toISOString();

  // Create players
  const players = playerNames.map((name, index) => ({
    id: `player-${index}`,
    name,
    hand: [] as Card[],
    isDown: false,
    totalScore: 0,
  }));

  // Create and shuffle deck
  const deckConfig = getDeckConfig(3); // 2 decks + 4 jokers for 3 players
  let deck = createDeck(deckConfig);

  // TODO: Add seeded shuffle support
  // For now, just shuffle randomly
  deck = shuffle(deck);

  // Deal cards
  const dealResult = deal(deck, 3);

  // Assign hands to players
  players[0]!.hand = dealResult.hands[0]!;
  players[1]!.hand = dealResult.hands[1]!;
  players[2]!.hand = dealResult.hands[2]!;

  // First player is left of dealer (dealer is player 0)
  const currentPlayerIndex = 1;

  const harness: HarnessState = {
    phase: "AWAITING_DRAW",
    awaitingPlayerId: players[currentPlayerIndex]!.id,
    mayIContext: null,
    turnNumber: 1,
  };

  const state: PersistedGameState = {
    version: "1.0",
    gameId,
    seed: seed ?? null,
    createdAt: now,
    updatedAt: now,
    currentRound: 1,
    contract: CONTRACTS[1],
    players,
    currentPlayerIndex,
    dealerIndex: 0,
    stock: dealResult.stock,
    discard: dealResult.discard,
    table: [],
    roundHistory: [],
    harness,
  };

  // Save state
  saveGameState(state);

  // Clear and start fresh log
  require("fs").writeFileSync(LOG_FILE, "");
  appendActionLog({
    timestamp: now,
    turnNumber: 0,
    roundNumber: 1,
    playerId: "system",
    playerName: "System",
    action: "GAME_STARTED",
    details: `Players: ${playerNames.join(", ")}`,
  });

  return state;
}

/**
 * Append an entry to the action log
 */
export function appendActionLog(entry: ActionLogEntry): void {
  const line = JSON.stringify(entry) + "\n";
  require("fs").appendFileSync(LOG_FILE, line);
}

/**
 * Read the action log
 */
export function readActionLog(): ActionLogEntry[] {
  const file = Bun.file(LOG_FILE);
  if (file.size === 0) {
    return [];
  }
  const content = require("fs").readFileSync(LOG_FILE, "utf-8");
  const lines = content.trim().split("\n").filter((l: string) => l.length > 0);
  return lines.map((line: string) => JSON.parse(line) as ActionLogEntry);
}

/**
 * Get the current player from state
 */
export function getCurrentPlayer(state: PersistedGameState) {
  return state.players[state.currentPlayerIndex]!;
}

/**
 * Get a player by ID
 */
export function getPlayerById(state: PersistedGameState, playerId: string) {
  return state.players.find((p) => p.id === playerId);
}

/**
 * Get the player whose decision we're waiting for
 */
export function getAwaitingPlayer(state: PersistedGameState) {
  return getPlayerById(state, state.harness.awaitingPlayerId);
}

/**
 * Advance to the next player's turn
 */
export function advanceToNextPlayer(state: PersistedGameState): void {
  state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
  state.harness.phase = "AWAITING_DRAW";
  state.harness.awaitingPlayerId = state.players[state.currentPlayerIndex]!.id;
  state.harness.turnNumber++;
}

/**
 * Setup state for a new round
 */
export function setupNewRound(state: PersistedGameState): void {
  const nextRound = (state.currentRound + 1) as RoundNumber;

  // Advance dealer
  state.dealerIndex = (state.dealerIndex + 1) % state.players.length;
  state.currentPlayerIndex = (state.dealerIndex + 1) % state.players.length;

  // Reset round state
  state.currentRound = nextRound;
  state.contract = CONTRACTS[nextRound];
  state.table = [];

  // Create and deal new deck
  const deckConfig = getDeckConfig(3);
  let deck = createDeck(deckConfig);
  deck = shuffle(deck);
  const dealResult = deal(deck, 3);

  // Assign hands and reset player state
  for (let i = 0; i < state.players.length; i++) {
    state.players[i]!.hand = dealResult.hands[i]!;
    state.players[i]!.isDown = false;
  }

  state.stock = dealResult.stock;
  state.discard = dealResult.discard;

  // Reset harness state
  state.harness.phase = "AWAITING_DRAW";
  state.harness.awaitingPlayerId = state.players[state.currentPlayerIndex]!.id;
  state.harness.mayIContext = null;
}
