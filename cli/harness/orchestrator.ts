/**
 * Orchestrator for the May I? game
 *
 * Manages game flow and state transitions. Designed to be transport-agnostic:
 * - CLI harness: file-based persistence
 * - Interactive mode: file-based persistence with REPL
 * - WebSocket (PartyKit): in-memory state, D1 persistence, broadcast updates
 *
 * The Orchestrator provides:
 * - Unified command interface (draw, laydown, discard, etc.)
 * - State serialization for persistence/broadcast
 * - Phase tracking for UI prompts
 *
 * For WebSocket integration:
 * - Use `getSerializableState()` for broadcasting to clients
 * - Use `Orchestrator.fromState()` to restore from D1
 * - Each command returns the updated state for immediate broadcast
 */

import type { Card } from "../../core/card/card.types";
import type { Meld } from "../../core/meld/meld.types";
import type { Player, RoundNumber, RoundRecord } from "../../core/engine/engine.types";
import type {
  DecisionPhase,
  OrchestratorSnapshot,
  OrchestratorPhase,
  MayIContext,
  CommandResult,
  PersistedGameState,
} from "../shared/cli.types";
import { getDeckConfig } from "../../core/engine/round.machine";
import { CONTRACTS, type Contract } from "../../core/engine/contracts";
import { createDeck, shuffle, deal } from "../../core/card/card.deck";
import { renderCard } from "../shared/cli.renderer";
import {
  saveOrchestratorSnapshot,
  loadOrchestratorSnapshot,
  appendActionLog,
  savedGameExists,
  generateGameId,
} from "../shared/cli.persistence";
import { isValidSet, isValidRun } from "../../core/meld/meld.validation";
import { canLayOffToSet, canLayOffToRun, getRunInsertPosition } from "../../core/engine/layoff";
import { canSwapJokerWithCard, identifyJokerPositions } from "../../core/meld/meld.joker";
import { calculateHandScore } from "../../core/scoring/scoring";
import { gameMachine } from "../../core/engine/game.machine";

/**
 * Game state view - unified view of current game state
 * This is what the rendering layer uses
 */
export interface GameStateView {
  gameId: string;
  currentRound: RoundNumber;
  contract: Contract;
  players: Player[];
  currentPlayerIndex: number;
  dealerIndex: number;
  stock: Card[];
  discard: Card[];
  table: Meld[];
  roundHistory: RoundRecord[];
  phase: DecisionPhase;
  awaitingPlayerId: string;
  mayIContext: MayIContext | null;
  turnNumber: number;
}

/**
 * Serializable state for WebSocket broadcast / D1 persistence
 * This is the minimal state needed to restore an orchestrator
 */
export interface SerializableGameState {
  version: "2.0";
  gameId: string;
  phase: OrchestratorPhase;
  harnessPhase: DecisionPhase;
  turnNumber: number;
  players: Player[];
  currentRound: RoundNumber;
  dealerIndex: number;
  currentPlayerIndex: number;
  stock: Card[];
  discard: Card[];
  table: Meld[];
  roundHistory: RoundRecord[];
  awaitingPlayerId: string;
  mayIContext: MayIContext | null;
  hasDrawn: boolean;
  laidDownThisTurn: boolean;
  lastDiscardedByPlayerId: string | null;
}

/**
 * Orchestrator class manages the game flow and state transitions
 */
export class Orchestrator {
  // Orchestrator-level state
  private gameId: string = "";
  private phase: OrchestratorPhase = "IDLE";
  private harnessPhase: DecisionPhase = "AWAITING_DRAW";
  private awaitingPlayerId: string = "";
  private turnNumber: number = 1;
  private mayIContext: MayIContext | null = null;

  // Core game state
  private players: Player[] = [];
  private currentRound: RoundNumber = 1;
  private dealerIndex: number = 0;
  private currentPlayerIndex: number = 0;
  private stock: Card[] = [];
  private discard: Card[] = [];
  private table: Meld[] = [];
  private roundHistory: RoundRecord[] = [];

  // Turn-scoped flags (reset each turn)
  private hasDrawn: boolean = false;
  private laidDownThisTurn: boolean = false;

  // Track who discarded last (null for deal discard at game start)
  private lastDiscardedByPlayerId: string | null = null;

  /**
   * Static factory to create orchestrator from serialized state
   * Used for WebSocket/PartyKit: restore state from D1 or broadcast
   */
  static fromState(state: SerializableGameState): Orchestrator {
    const orchestrator = new Orchestrator();
    orchestrator.restoreFromState(state);
    return orchestrator;
  }

  /**
   * Get serializable state for WebSocket broadcast or D1 persistence
   * Does not include functions or internal references
   */
  getSerializableState(): SerializableGameState {
    return {
      version: "2.0",
      gameId: this.gameId,
      phase: this.phase,
      harnessPhase: this.harnessPhase,
      turnNumber: this.turnNumber,
      players: this.players,
      currentRound: this.currentRound,
      dealerIndex: this.dealerIndex,
      currentPlayerIndex: this.currentPlayerIndex,
      stock: this.stock,
      discard: this.discard,
      table: this.table,
      roundHistory: this.roundHistory,
      awaitingPlayerId: this.awaitingPlayerId,
      mayIContext: this.mayIContext,
      hasDrawn: this.hasDrawn,
      laidDownThisTurn: this.laidDownThisTurn,
      lastDiscardedByPlayerId: this.lastDiscardedByPlayerId,
    };
  }

  /**
   * Create a new game with the specified players
   * @param playerNames - Array of player names (3-8 players)
   * @param startingRound - Optional round to start at (1-6, default: 1)
   */
  newGame(playerNames: string[], startingRound: RoundNumber = 1): GameStateView {
    if (playerNames.length < 3 || playerNames.length > 8) {
      throw new Error("May I requires 3-8 players");
    }
    this.gameId = generateGameId();
    this.phase = "ROUND_ACTIVE";
    this.turnNumber = 1;
    this.mayIContext = null;
    this.currentRound = startingRound;
    this.table = [];

    // Calculate dealer position (rotates each round, so advance by startingRound - 1)
    this.dealerIndex = (startingRound - 1) % playerNames.length;

    // Create players
    this.players = playerNames.map((name, index) => ({
      id: `player-${index}`,
      name,
      hand: [],
      isDown: false,
      totalScore: 0,
    }));

    // Fabricate round history for previous rounds (all zero scores)
    this.roundHistory = [];
    for (let r = 1; r < startingRound; r++) {
      const fabricatedScores: Record<string, number> = {};
      for (const player of this.players) {
        fabricatedScores[player.id] = 0;
      }
      this.roundHistory.push({
        roundNumber: r as RoundNumber,
        scores: fabricatedScores,
        winnerId: this.players[0]!.id,
      });
    }

    // Deal cards
    this.dealRound();

    // First player is left of dealer
    this.currentPlayerIndex = (this.dealerIndex + 1) % this.players.length;
    this.harnessPhase = "AWAITING_DRAW";
    this.awaitingPlayerId = this.players[this.currentPlayerIndex]!.id;
    this.hasDrawn = false;
    this.laidDownThisTurn = false;
    this.lastDiscardedByPlayerId = null; // Deal discard doesn't belong to any player

    // Log game start
    const roundSuffix = startingRound > 1 ? ` (starting at Round ${startingRound})` : "";
    this.logAction("system", "System", "GAME_STARTED", `Players: ${playerNames.join(", ")}${roundSuffix}`);

    // Save state
    this.save();

    return this.getStateView();
  }

  /**
   * Load existing game from persistence
   */
  loadGame(gameId: string): GameStateView {
    if (!savedGameExists(gameId)) {
      throw new Error(`No game found with ID: ${gameId}`);
    }

    const snapshot = loadOrchestratorSnapshot(gameId);
    this.restoreFromSnapshot(snapshot);

    return this.getStateView();
  }

  /**
   * Get current game state for rendering
   */
  getStateView(): GameStateView {
    const state = this.getSerializableState();
    return {
      gameId: state.gameId,
      currentRound: state.currentRound,
      contract: CONTRACTS[state.currentRound],
      players: state.players,
      currentPlayerIndex: state.currentPlayerIndex,
      dealerIndex: state.dealerIndex,
      stock: state.stock,
      discard: state.discard,
      table: state.table,
      roundHistory: state.roundHistory,
      phase: state.harnessPhase,
      awaitingPlayerId: state.awaitingPlayerId,
      mayIContext: state.mayIContext,
      turnNumber: state.turnNumber,
    };
  }

  /**
   * Get PersistedGameState for backward compatibility with rendering
   */
  getPersistedState(): PersistedGameState {
    const state = this.getSerializableState();
    const now = new Date().toISOString();
    return {
      version: "1.0",
      gameId: state.gameId,
      seed: null,
      createdAt: now,
      updatedAt: now,
      currentRound: state.currentRound,
      contract: CONTRACTS[state.currentRound],
      players: state.players,
      currentPlayerIndex: state.currentPlayerIndex,
      dealerIndex: state.dealerIndex,
      stock: state.stock,
      discard: state.discard,
      table: state.table,
      roundHistory: state.roundHistory,
      harness: {
        phase: state.harnessPhase,
        awaitingPlayerId: state.awaitingPlayerId,
        mayIContext: state.mayIContext,
        turnNumber: state.turnNumber,
      },
    };
  }

  /**
   * Get the awaiting player
   */
  getAwaitingPlayer(): Player | undefined {
    return this.players.find((p) => p.id === this.awaitingPlayerId);
  }

  /**
   * Get the current player
   */
  getCurrentPlayer(): Player {
    return this.players[this.currentPlayerIndex]!;
  }

  // --- Command handlers ---

  /**
   * Draw from stock
   */
  drawFromStock(): CommandResult {
    this.requirePhase("AWAITING_DRAW");

    // Try to replenish stock first if empty
    this.replenishStockIfNeeded();

    if (this.stock.length === 0) {
      return { success: false, message: "Stock is empty and cannot be replenished!", error: "stock_empty" };
    }

    const player = this.getAwaitingPlayer()!;
    const card = this.stock.shift()!;
    player.hand.push(card);
    this.hasDrawn = true;

    // Replenish again after drawing in case that was the last card
    this.replenishStockIfNeeded();

    this.logAction(player.id, player.name, "drew from stock", renderCard(card));

    // After drawing from stock, May I window opens for the discard
    if (this.discard.length > 0) {
      this.openMayIWindow();
    } else {
      this.harnessPhase = "AWAITING_ACTION";
    }

    this.save();
    return { success: true, message: `${player.name} drew ${renderCard(card)} from stock.` };
  }

  /**
   * Draw from discard
   */
  drawFromDiscard(): CommandResult {
    this.requirePhase("AWAITING_DRAW");

    if (this.discard.length === 0) {
      return { success: false, message: "Discard pile is empty!", error: "discard_empty" };
    }

    const player = this.getAwaitingPlayer()!;

    // DOWN players cannot draw from discard
    if (player.isDown) {
      return {
        success: false,
        message: "You cannot draw from discard when you are down. Down players may only draw from stock.",
        error: "down_player_discard",
      };
    }

    const card = this.discard.shift()!;
    player.hand.push(card);
    this.hasDrawn = true;

    this.logAction(player.id, player.name, "drew from discard", renderCard(card));

    this.harnessPhase = "AWAITING_ACTION";
    this.save();

    return { success: true, message: `${player.name} took ${renderCard(card)} from discard.` };
  }

  /**
   * Lay down melds
   */
  layDown(meldGroups: number[][]): CommandResult {
    this.requirePhase("AWAITING_ACTION");

    const player = this.getAwaitingPlayer()!;
    if (player.isDown) {
      return { success: false, message: "Already laid down this round. Use 'layoff' to add cards to melds.", error: "already_down" };
    }

    // Validate positions
    for (const group of meldGroups) {
      for (const pos of group) {
        const posError = this.validatePosition(pos, player.hand.length, "Position");
        if (posError) return posError;
      }
    }

    // Check for duplicates
    const allPositions = meldGroups.flat();
    const uniquePositions = new Set(allPositions);
    if (uniquePositions.size !== allPositions.length) {
      return { success: false, message: "Duplicate card positions in melds", error: "duplicate_positions" };
    }

    // Round 6: must use ALL cards in hand
    if (this.currentRound === 6 && allPositions.length !== player.hand.length) {
      return {
        success: false,
        message: `Round 6 requires laying down ALL ${player.hand.length} cards. You specified ${allPositions.length}.`,
        error: "round_6_incomplete",
      };
    }

    // Build melds
    const melds: Meld[] = [];
    for (const group of meldGroups) {
      const cards = group.map((pos) => player.hand[pos - 1]!);

      // Infer meld type
      const nonWildCards = cards.filter((c) => c.rank !== "Joker" && c.rank !== "2");
      let meldType: "set" | "run";
      if (nonWildCards.length === 0) {
        meldType = "set";
      } else {
        const firstRank = nonWildCards[0]!.rank;
        const allSameRank = nonWildCards.every((c) => c.rank === firstRank);
        meldType = allSameRank ? "set" : "run";
      }

      // Validate
      if (meldType === "set" && !isValidSet(cards)) {
        return { success: false, message: `Invalid set: ${cards.map(renderCard).join(" ")}`, error: "invalid_set" };
      }
      if (meldType === "run" && !isValidRun(cards)) {
        return { success: false, message: `Invalid run: ${cards.map(renderCard).join(" ")}`, error: "invalid_run" };
      }

      melds.push({
        id: `meld-${crypto.randomUUID().slice(0, 8)}`,
        type: meldType,
        cards,
        ownerId: player.id,
      });
    }

    // Rounds 1-5: Melds must be exact minimum size (sets = 3, runs = 4)
    // Round 6: Melds can be any valid size since you must use ALL cards
    if (this.currentRound !== 6) {
      for (const meld of melds) {
        if (meld.type === "set" && meld.cards.length !== 3) {
          return {
            success: false,
            message: `Sets in the contract must be exactly 3 cards. You provided ${meld.cards.length} cards: ${meld.cards.map(renderCard).join(" ")}`,
            error: "set_wrong_size",
          };
        }
        if (meld.type === "run" && meld.cards.length !== 4) {
          return {
            success: false,
            message: `Runs in the contract must be exactly 4 cards. You provided ${meld.cards.length} cards: ${meld.cards.map(renderCard).join(" ")}`,
            error: "run_wrong_size",
          };
        }
      }
    }

    // Validate contract
    const contract = CONTRACTS[this.currentRound];
    const setsNeeded = contract.sets;
    const runsNeeded = contract.runs;
    const setsProvided = melds.filter((m) => m.type === "set").length;
    const runsProvided = melds.filter((m) => m.type === "run").length;

    if (setsProvided !== setsNeeded || runsProvided !== runsNeeded) {
      return {
        success: false,
        message: `Contract requires ${setsNeeded} set(s) and ${runsNeeded} run(s)`,
        error: "contract_not_met",
      };
    }

    // Apply the laydown
    const usedCardIds = new Set(melds.flatMap((m) => m.cards.map((c) => c.id)));
    player.hand = player.hand.filter((c) => !usedCardIds.has(c.id));
    this.table.push(...melds);
    player.isDown = true;
    this.laidDownThisTurn = true;

    this.logAction(
      player.id,
      player.name,
      "laid down contract",
      melds.map((m) => `${m.type}: ${m.cards.map(renderCard).join(" ")}`).join(", ")
    );

    // Check if went out
    // In Round 6, hand will always be empty after laying down (required to use all cards)
    if (player.hand.length === 0) {
      this.handleWentOut(player.id);
    } else {
      // Rounds 1-5: go to discard phase
      this.harnessPhase = "AWAITING_DISCARD";
    }

    this.save();

    const meldStr = melds.map((m) => `  ${m.type}: ${m.cards.map(renderCard).join(" ")}`).join("\n");
    return { success: true, message: `${player.name} laid down their contract!\n${meldStr}` };
  }

  /**
   * Skip laying down
   */
  skip(): CommandResult {
    this.requirePhase("AWAITING_ACTION");

    const player = this.getAwaitingPlayer()!;
    this.logAction(player.id, player.name, "skipped laying down");

    this.harnessPhase = "AWAITING_DISCARD";
    this.save();

    return { success: true, message: `${player.name} skipped laying down.` };
  }

  /**
   * Discard a card
   */
  discardCard(position: number): CommandResult {
    this.requirePhase("AWAITING_DISCARD");

    const player = this.getAwaitingPlayer()!;
    const posError = this.validatePosition(position, player.hand.length, "Position");
    if (posError) return posError;

    // Note: In Round 6, players in AWAITING_DISCARD are never "down" because
    // laying down = going out. No special Round 6 logic needed here.

    const card = player.hand.splice(position - 1, 1)[0]!;
    this.discard.unshift(card);
    this.lastDiscardedByPlayerId = player.id;

    this.logAction(player.id, player.name, "discarded", renderCard(card));

    // Check if went out
    if (player.hand.length === 0) {
      this.handleWentOut(player.id);
    } else {
      this.advanceToNextPlayer();
    }

    this.save();
    return { success: true, message: `${player.name} discarded ${renderCard(card)}.` };
  }

  /**
   * Lay off a card to a meld
   */
  layOff(cardPos: number, meldNum: number): CommandResult {
    this.requirePhase("AWAITING_ACTION");

    // Round 6: laying off is not allowed (no melds on table until someone wins)
    if (this.currentRound === 6) {
      return {
        success: false,
        message: "Laying off is not allowed in Round 6. You must lay down all cards at once to win.",
        error: "round_6_no_layoff",
      };
    }

    const player = this.getAwaitingPlayer()!;
    if (!player.isDown) {
      return { success: false, message: "Must lay down contract before laying off cards", error: "not_down" };
    }

    // Cannot lay off on the same turn you lay down (house rule)
    if (this.laidDownThisTurn) {
      return {
        success: false,
        message: "Cannot lay off on the same turn you laid down",
        error: "laid_down_this_turn"
      };
    }

    const cardPosError = this.validatePosition(cardPos, player.hand.length, "Card position");
    if (cardPosError) return cardPosError;
    const meldError = this.validatePosition(meldNum, this.table.length, "Meld number");
    if (meldError) return { ...meldError, error: "meld_out_of_range" };

    const card = player.hand[cardPos - 1]!;
    const meld = this.table[meldNum - 1]!;

    // Check if card can be laid off
    let canLayOff = false;
    if (meld.type === "set") {
      canLayOff = canLayOffToSet(card, meld);
    } else {
      canLayOff = canLayOffToRun(card, meld);
    }

    if (!canLayOff) {
      return { success: false, message: `${renderCard(card)} cannot be added to that ${meld.type}`, error: "card_doesnt_fit" };
    }

    // Apply lay off
    player.hand.splice(cardPos - 1, 1);
    if (meld.type === "run") {
      const insertPos = getRunInsertPosition(card, meld);
      if (insertPos === "low") {
        meld.cards.unshift(card);
      } else {
        meld.cards.push(card);
      }
    } else {
      meld.cards.push(card);
    }

    this.logAction(player.id, player.name, "laid off", `${renderCard(card)} to meld ${meldNum}`);

    // Check if went out
    if (player.hand.length === 0) {
      this.handleWentOut(player.id);
    }

    this.save();
    return { success: true, message: `${player.name} laid off ${renderCard(card)} to meld ${meldNum}.` };
  }

  /**
   * Call May I
   */
  callMayI(): CommandResult {
    this.requirePhase("MAY_I_WINDOW");

    const ctx = this.mayIContext!;
    const player = this.getAwaitingPlayer()!;

    if (player.id === ctx.currentPlayerId) {
      return { success: false, message: "Current player should use 'take' or 'pass', not 'mayi'", error: "wrong_command" };
    }

    // DOWN players cannot call May I
    if (player.isDown) {
      return {
        success: false,
        message: "You cannot call May I when you are down. Down players cannot draw from the discard pile.",
        error: "down_player_mayi",
      };
    }

    // Add to claimants
    ctx.claimants.push(player.id);
    this.logAction(player.id, player.name, "called May I", renderCard(ctx.discardedCard));

    // Advance May I window
    this.advanceMayIWindow();

    this.save();
    return { success: true, message: `${player.name} called "May I!" for ${renderCard(ctx.discardedCard)}.` };
  }

  /**
   * Pass on May I
   */
  pass(): CommandResult {
    this.requirePhase("MAY_I_WINDOW");

    const ctx = this.mayIContext!;
    const player = this.getAwaitingPlayer()!;

    this.logAction(player.id, player.name, "passed on May I", renderCard(ctx.discardedCard));

    if (player.id === ctx.currentPlayerId) {
      ctx.currentPlayerPassed = true;
    }

    // Advance May I window
    this.advanceMayIWindow();

    this.save();
    return { success: true, message: `${player.name} passed.` };
  }

  /**
   * Continue to next round
   */
  continue(): CommandResult {
    this.requirePhase("ROUND_END");

    if (this.currentRound >= 6) {
      this.phase = "GAME_END";
      this.harnessPhase = "GAME_END";
      this.save();
      return { success: true, message: "Game complete!" };
    }

    this.setupNewRound();
    this.logAction("system", "System", "started round", `Round ${this.currentRound}`);

    this.save();
    return { success: true, message: `Starting Round ${this.currentRound}...` };
  }

  /**
   * Reorder the human player's hand
   * This is a "free action" that can be done at any time without consuming the turn
   */
  reorderHand(newHand: Card[]): CommandResult {
    const player = this.players.find((p) => p.id === "player-0");
    if (!player) {
      return { success: false, message: "Player not found", error: "player_not_found" };
    }

    // Validate same cards
    if (newHand.length !== player.hand.length) {
      return { success: false, message: "Card count mismatch", error: "card_count_mismatch" };
    }

    const oldIds = new Set(player.hand.map((c) => c.id));
    const newIds = new Set(newHand.map((c) => c.id));

    for (const id of newIds) {
      if (!oldIds.has(id)) {
        return { success: false, message: `Card ${id} not in hand`, error: "card_not_in_hand" };
      }
    }

    for (const id of oldIds) {
      if (!newIds.has(id)) {
        return { success: false, message: `Card ${id} missing from new order`, error: "card_missing" };
      }
    }

    player.hand = newHand;
    this.save();

    return { success: true, message: "Hand reordered." };
  }

  /**
   * Swap a Joker from a meld
   */
  swap(meldNum: number, jokerPos: number, cardPos: number): CommandResult {
    this.requirePhase("AWAITING_ACTION");

    // Round 6: swapping is not allowed (no melds on table)
    if (this.currentRound === 6) {
      return {
        success: false,
        message: "Joker swapping is not allowed in Round 6 (no melds on table until someone wins).",
        error: "round_6_no_swap",
      };
    }

    const player = this.getAwaitingPlayer()!;

    // Per house rules: can only swap if NOT down yet
    if (player.isDown) {
      return {
        success: false,
        message: "Cannot swap Jokers after laying down. You must swap before laying down your contract.",
        error: "already_down",
      };
    }

    const meldError = this.validatePosition(meldNum, this.table.length, "Meld number");
    if (meldError) return { ...meldError, error: "meld_out_of_range" };
    const cardPosError = this.validatePosition(cardPos, player.hand.length, "Card position");
    if (cardPosError) return cardPosError;

    const meld = this.table[meldNum - 1]!;
    const swapCard = player.hand[cardPos - 1]!;

    if (meld.type !== "run") {
      return { success: false, message: "Joker swapping only works on runs, not sets", error: "not_a_run" };
    }

    // Find the joker at specified position
    const positions = identifyJokerPositions(meld);
    const jokerPosition = positions.find((p) => p.positionIndex === jokerPos - 1);
    if (!jokerPosition) {
      return { success: false, message: `No swappable Joker at position ${jokerPos} in meld ${meldNum}`, error: "no_joker" };
    }

    if (!jokerPosition.isJoker) {
      return { success: false, message: "Only Jokers can be swapped, not 2s (wild but not Joker)", error: "not_joker" };
    }

    // Check if swap card fits
    if (!canSwapJokerWithCard(meld, jokerPosition.wildCard, swapCard)) {
      return {
        success: false,
        message: `${renderCard(swapCard)} cannot replace Joker at position ${jokerPos}. Need ${jokerPosition.actingAsRank}${jokerPosition.actingAsSuit}`,
        error: "card_doesnt_fit",
      };
    }

    // Perform swap
    const jokerCard = jokerPosition.wildCard;
    const jokerIndex = meld.cards.findIndex((c) => c.id === jokerCard.id);
    meld.cards[jokerIndex] = swapCard;
    player.hand.splice(cardPos - 1, 1);
    player.hand.push(jokerCard);

    this.logAction(player.id, player.name, "swapped Joker", `${renderCard(swapCard)} for Joker from meld ${meldNum}`);

    this.save();
    return { success: true, message: `${player.name} swapped ${renderCard(swapCard)} for Joker from meld ${meldNum}!\n  Joker added to hand.` };
  }

  // --- Internal helpers ---

  private requirePhase(expected: DecisionPhase): void {
    if (this.harnessPhase !== expected) {
      throw new Error(
        `Invalid command for current phase. Expected: ${expected}, Current: ${this.harnessPhase}`
      );
    }
  }

  /**
   * Validate position is within 1-based range. Returns error result if invalid.
   */
  private validatePosition(pos: number, max: number, label: string): CommandResult | null {
    if (pos < 1 || pos > max) {
      return {
        success: false,
        message: `${label} ${pos} is out of range (1-${max})`,
        error: "position_out_of_range",
      };
    }
    return null;
  }

  private logAction(playerId: string, playerName: string, action: string, details?: string): void {
    appendActionLog(this.gameId, {
      timestamp: new Date().toISOString(),
      turnNumber: this.turnNumber,
      roundNumber: this.currentRound,
      playerId,
      playerName,
      action,
      details,
    });
  }

  private dealRound(): void {
    const deckConfig = getDeckConfig(this.players.length);
    let deck = createDeck(deckConfig);
    deck = shuffle(deck);
    const dealResult = deal(deck, this.players.length);

    for (let i = 0; i < this.players.length; i++) {
      this.players[i]!.hand = dealResult.hands[i]!;
      this.players[i]!.isDown = false;
    }

    this.stock = dealResult.stock;
    this.discard = dealResult.discard;
    this.table = [];
  }

  private openMayIWindow(): void {
    const currentPlayer = this.getCurrentPlayer();
    const discardedCard = this.discard[0]!;

    // Build priority order - exclude current player, player who just discarded, and down players
    const awaitingResponseFrom: string[] = [];
    for (let i = 1; i < this.players.length; i++) {
      const idx = (this.currentPlayerIndex + i) % this.players.length;
      const player = this.players[idx]!;
      // Don't ask the player who just discarded - they wouldn't want their own card back
      // (lastDiscardedByPlayerId is null for deal discard at game start)
      // Don't ask down players - they cannot draw from discard pile (house rule)
      if (player.id !== this.lastDiscardedByPlayerId && !player.isDown) {
        awaitingResponseFrom.push(player.id);
      }
    }

    // If no one can respond to May I, skip the window entirely
    if (awaitingResponseFrom.length === 0) {
      this.harnessPhase = "AWAITING_ACTION";
      return;
    }

    this.mayIContext = {
      discardedCard,
      discardedByPlayerId: this.lastDiscardedByPlayerId ?? "",
      currentPlayerId: currentPlayer.id,
      currentPlayerIndex: this.currentPlayerIndex,
      awaitingResponseFrom,
      claimants: [],
      currentPlayerPassed: true,
    };

    this.harnessPhase = "MAY_I_WINDOW";
    this.phase = "MAY_I_WINDOW";
    this.awaitingPlayerId = awaitingResponseFrom[0]!;
  }

  private advanceMayIWindow(): void {
    const ctx = this.mayIContext!;
    ctx.awaitingResponseFrom.shift();

    if (ctx.awaitingResponseFrom.length === 0) {
      this.resolveMayIWindow();
    } else {
      this.awaitingPlayerId = ctx.awaitingResponseFrom[0]!;
    }
  }

  private resolveMayIWindow(): void {
    const ctx = this.mayIContext!;

    if (ctx.claimants.length > 0) {
      const winnerId = ctx.claimants[0]!;
      const winner = this.players.find((p) => p.id === winnerId)!;

      const discardCard = this.discard.shift()!;
      winner.hand.push(discardCard);

      // Try to replenish stock before drawing penalty card
      this.replenishStockIfNeeded();

      if (this.stock.length > 0) {
        const penaltyCard = this.stock.shift()!;
        winner.hand.push(penaltyCard);
        // Replenish after penalty draw in case that was the last card
        this.replenishStockIfNeeded();
        // Only show the discard card publicly - penalty card is private to the winner
        this.logAction(winnerId, winner.name, "won May I", `${renderCard(discardCard)} + penalty card`);
      } else {
        this.logAction(winnerId, winner.name, "won May I", `${renderCard(discardCard)} (no penalty - stock empty)`);
      }
    } else {
      this.logAction("system", "System", "May I window closed", "no claims");
    }

    // Close window and proceed
    this.mayIContext = null;
    this.phase = "ROUND_ACTIVE";
    this.harnessPhase = "AWAITING_ACTION";
    this.awaitingPlayerId = this.players[this.currentPlayerIndex]!.id;
  }

  private advanceToNextPlayer(): void {
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    this.harnessPhase = "AWAITING_DRAW";
    this.awaitingPlayerId = this.players[this.currentPlayerIndex]!.id;
    this.turnNumber++;
    this.hasDrawn = false;
    this.laidDownThisTurn = false;
  }

  /**
   * Replenish the stock pile from the discard pile if needed.
   * Per house rules: When the stock is empty, take all but the top discard card,
   * shuffle them, and place them face down as the new stock.
   */
  private replenishStockIfNeeded(): void {
    if (this.stock.length === 0 && this.discard.length > 1) {
      // Keep the top discard exposed
      const exposedDiscard = this.discard.shift()!;

      // Take remaining discard pile and shuffle into new stock
      const cardsToShuffle = [...this.discard];
      this.discard = [exposedDiscard];
      this.stock = shuffle(cardsToShuffle);

      this.logAction("system", "System", "reshuffled stock", `${cardsToShuffle.length} cards from discard pile`);
    }
  }

  private handleWentOut(winnerId: string): void {
    const winner = this.players.find((p) => p.id === winnerId)!;
    this.logAction(winnerId, winner.name, "went out!", "");

    // Calculate scores
    const scores: Record<string, number> = {};
    for (const player of this.players) {
      if (player.id === winnerId) {
        scores[player.id] = 0;
      } else {
        scores[player.id] = calculateHandScore(player.hand);
      }
      player.totalScore += scores[player.id]!;
    }

    // Add round record
    this.roundHistory.push({
      roundNumber: this.currentRound,
      scores,
      winnerId,
    });

    this.phase = "ROUND_END";
    this.harnessPhase = "ROUND_END";
    this.mayIContext = null;
  }

  private setupNewRound(): void {
    const nextRound = (this.currentRound + 1) as RoundNumber;

    this.dealerIndex = (this.dealerIndex + 1) % this.players.length;
    this.currentPlayerIndex = (this.dealerIndex + 1) % this.players.length;
    this.currentRound = nextRound;

    this.dealRound();

    this.phase = "ROUND_ACTIVE";
    this.harnessPhase = "AWAITING_DRAW";
    this.awaitingPlayerId = this.players[this.currentPlayerIndex]!.id;
    this.mayIContext = null;
    this.hasDrawn = false;
    this.laidDownThisTurn = false;
    this.lastDiscardedByPlayerId = null; // Deal discard doesn't belong to any player
  }

  private save(): void {
    const snapshot = this.createSnapshot();
    saveOrchestratorSnapshot(this.gameId, snapshot);
  }

  private createSnapshot(): OrchestratorSnapshot {
    const now = new Date().toISOString();
    return {
      version: "2.0",
      gameId: this.gameId,
      createdAt: now,
      updatedAt: now,
      phase: this.phase,
      gameSnapshot: this.getSerializableState(),
      turnNumber: this.turnNumber,
      mayIContext: this.mayIContext,
    };
  }

  private restoreFromSnapshot(snapshot: OrchestratorSnapshot): void {
    const gs = snapshot.gameSnapshot as SerializableGameState & {
      // v1 compat fields
      _v1Compat?: boolean;
      gameContext?: { players: Player[]; currentRound: RoundNumber; dealerIndex: number; roundHistory: RoundRecord[] };
      roundState?: { stock: Card[]; discard: Card[]; table: Meld[]; currentPlayerIndex: number };
    };

    // Handle v1 compatibility format
    if (gs._v1Compat && gs.gameContext && gs.roundState) {
      this.gameId = snapshot.gameId;
      this.phase = snapshot.phase;
      this.turnNumber = snapshot.turnNumber;
      this.mayIContext = snapshot.mayIContext;
      this.players = gs.gameContext.players;
      this.currentRound = gs.gameContext.currentRound as RoundNumber;
      this.dealerIndex = gs.gameContext.dealerIndex;
      this.roundHistory = gs.gameContext.roundHistory;
      this.stock = gs.roundState.stock;
      this.discard = gs.roundState.discard;
      this.table = gs.roundState.table;
      this.currentPlayerIndex = gs.roundState.currentPlayerIndex;
      this.harnessPhase = (gs as { harnessPhase?: DecisionPhase }).harnessPhase ?? "AWAITING_DRAW";
      this.awaitingPlayerId = (gs as { awaitingPlayerId?: string }).awaitingPlayerId ?? this.players[this.currentPlayerIndex]?.id ?? "";
      this.hasDrawn = false;
      this.laidDownThisTurn = false;
    } else {
      // v2 format - restore from SerializableGameState
      this.restoreFromState(gs);
    }
  }

  /**
   * Restore orchestrator fields from a SerializableGameState
   * Used by both fromState() and restoreFromSnapshot()
   */
  private restoreFromState(state: SerializableGameState): void {
    this.gameId = state.gameId;
    this.phase = state.phase;
    this.harnessPhase = state.harnessPhase;
    this.turnNumber = state.turnNumber;
    this.players = state.players;
    this.currentRound = state.currentRound;
    this.dealerIndex = state.dealerIndex;
    this.currentPlayerIndex = state.currentPlayerIndex;
    this.stock = state.stock;
    this.discard = state.discard;
    this.table = state.table;
    this.roundHistory = state.roundHistory;
    this.awaitingPlayerId = state.awaitingPlayerId;
    this.mayIContext = state.mayIContext;
    this.hasDrawn = state.hasDrawn;
    this.laidDownThisTurn = state.laidDownThisTurn;
    this.lastDiscardedByPlayerId = state.lastDiscardedByPlayerId;
  }
}

/**
 * Singleton orchestrator instance for CLI usage
 */
let orchestratorInstance: Orchestrator | null = null;

export function getOrchestrator(): Orchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new Orchestrator();
  }
  return orchestratorInstance;
}
