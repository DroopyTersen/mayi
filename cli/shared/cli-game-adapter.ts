/**
 * CLI adapter around the core GameEngine.
 *
 * Responsibilities:
 * - File-based persistence to `.data/<gameId>/game-state.json`
 * - Mapping CLI-friendly inputs (hand positions, meld numbers) to engine IDs
 * - Exposing a simple imperative interface for both harness and interactive modes
 *
 * Non-responsibilities:
 * - No gameplay rule validation (XState machines enforce rules)
 * - No dealing/scoring logic (engine owns that)
 */

import { GameEngine } from "../../core/engine/game-engine";
import type { GameSnapshot, MeldSpec } from "../../core/engine/game-engine.types";
import type { RoundNumber } from "../../core/engine/engine.types";
import { isValidRun, isValidSet } from "../../core/meld/meld.validation";
import type { ActionLogEntry, CliGameSave } from "./cli.types";
import { appendActionLog, generateGameId, loadGameSave, saveGameSave } from "./cli.persistence";
import { getNumberedMelds } from "./cli-meld-numbering";
import { renderCard } from "./cli.renderer";

type EnginePersistedSnapshot = ReturnType<GameEngine["getPersistedSnapshot"]>;

export interface NewCliGameOptions {
  gameId?: string;
  playerNames: string[];
  startingRound?: RoundNumber;
}

export class CliGameAdapter {
  private engine: GameEngine | null = null;

  newGame(options: NewCliGameOptions): GameSnapshot {
    const gameId = options.gameId ?? generateGameId();
    const engine = GameEngine.createGame({
      gameId,
      playerNames: options.playerNames,
      startingRound: options.startingRound,
    });

    this.engine = engine;
    const snapshot = engine.getSnapshot();
    this.persist();
    this.logAction(snapshot, "system", "GAME_STARTED", `Players: ${options.playerNames.join(", ")}`);
    return snapshot;
  }

  loadGame(gameId: string): GameSnapshot {
    const save = loadGameSave(gameId);

    // Stop any existing actor before replacing
    this.engine?.stop();

    const engineSnapshot = save.engineSnapshot as EnginePersistedSnapshot;
    const engine = GameEngine.fromPersistedSnapshot(engineSnapshot, save.gameId, save.createdAt);
    this.engine = engine;
    return engine.getSnapshot();
  }

  getSnapshot(): GameSnapshot {
    return this.requireEngine().getSnapshot();
  }

  drawFromStock(): GameSnapshot {
    const engine = this.requireEngine();
    const before = engine.getSnapshot();
    const playerId = before.awaitingPlayerId;
    const after = engine.drawFromStock(playerId);
    this.persist();
    this.logDraw(before, after, playerId, "stock");
    return after;
  }

  drawFromDiscard(): GameSnapshot {
    const engine = this.requireEngine();
    const before = engine.getSnapshot();
    const playerId = before.awaitingPlayerId;
    const after = engine.drawFromDiscard(playerId);
    this.persist();
    this.logDraw(before, after, playerId, "discard");
    return after;
  }

  skip(): GameSnapshot {
    const engine = this.requireEngine();
    const before = engine.getSnapshot();
    const playerId = before.awaitingPlayerId;
    const after = engine.skip(playerId);
    this.persist();
    if (before.turnPhase === "AWAITING_ACTION" && after.turnPhase === "AWAITING_DISCARD") {
      this.logAction(before, playerId, "skipped");
    }
    return after;
  }

  layDown(meldGroups: number[][]): GameSnapshot {
    const engine = this.requireEngine();
    const before = engine.getSnapshot();
    const playerId = before.awaitingPlayerId;
    const player = before.players.find((p) => p.id === playerId);
    if (!player) {
      throw new Error(`Player not found: ${playerId}`);
    }

    const meldSpecs: MeldSpec[] = meldGroups.map((group) => {
      const cards = group.map((pos) => {
        const card = player.hand[pos - 1];
        if (!card) {
          throw new Error(`Card position out of range: ${pos}`);
        }
        return card;
      });

      const canBeSet = isValidSet(cards);
      const canBeRun = isValidRun(cards);

      // Infer type in a deterministic way (engine still validates the rules).
      const type: "set" | "run" =
        canBeSet && !canBeRun ? "set" : canBeRun && !canBeSet ? "run" : "set";

      return { type, cardIds: cards.map((c) => c.id) };
    });

    const after = engine.layDown(playerId, meldSpecs);
    this.persist();
    const beforePlayer = before.players.find((p) => p.id === playerId);
    const afterPlayer = after.players.find((p) => p.id === playerId);
    if (beforePlayer && afterPlayer && !beforePlayer.isDown && afterPlayer.isDown) {
      const details = meldGroups
        .map((group, i) => {
          const spec = meldSpecs[i]!;
          const label = spec.type === "set" ? "Set" : "Run";
          const cards = group
            .map((pos) => player.hand[pos - 1])
            .filter((c): c is NonNullable<typeof c> => Boolean(c))
            .map(renderCard)
            .join(" ");
          return `${label}: ${cards}`;
        })
        .join(" | ");
      this.logAction(before, playerId, "laid down", details || undefined);
    }
    return after;
  }

  layOff(cardPosition: number, meldNumber: number): GameSnapshot {
    const engine = this.requireEngine();
    const before = engine.getSnapshot();
    const playerId = before.awaitingPlayerId;
    const player = before.players.find((p) => p.id === playerId);
    if (!player) {
      throw new Error(`Player not found: ${playerId}`);
    }

    const card = player.hand[cardPosition - 1];
    if (!card) {
      throw new Error(`Card position out of range: ${cardPosition}`);
    }

    const numberedMeld = getNumberedMelds(before.table, before.players).find(
      (m) => m.meldNumber === meldNumber
    );
    if (!numberedMeld) {
      throw new Error(`Meld number out of range: ${meldNumber}`);
    }

    const after = engine.layOff(playerId, card.id, numberedMeld.meld.id);
    this.persist();
    const afterPlayer = after.players.find((p) => p.id === playerId);
    if (afterPlayer && afterPlayer.hand.length === player.hand.length - 1) {
      this.logAction(
        before,
        playerId,
        "laid off",
        `${renderCard(card)} → meld ${meldNumber}`
      );
    }
    return after;
  }

  swap(meldNumber: number, jokerPosition: number, cardPosition: number): GameSnapshot {
    const engine = this.requireEngine();
    const before = engine.getSnapshot();
    const playerId = before.awaitingPlayerId;
    const player = before.players.find((p) => p.id === playerId);
    if (!player) {
      throw new Error(`Player not found: ${playerId}`);
    }

    const swapCard = player.hand[cardPosition - 1];
    if (!swapCard) {
      throw new Error(`Card position out of range: ${cardPosition}`);
    }

    const numberedMeld = getNumberedMelds(before.table, before.players).find(
      (m) => m.meldNumber === meldNumber
    );
    if (!numberedMeld) {
      throw new Error(`Meld number out of range: ${meldNumber}`);
    }

    const jokerCard = numberedMeld.meld.cards[jokerPosition - 1];
    if (!jokerCard) {
      throw new Error(`Joker position out of range: ${jokerPosition}`);
    }

    const after = engine.swap(playerId, numberedMeld.meld.id, jokerCard.id, swapCard.id);
    this.persist();
    // Successful swap keeps hand size the same (swap card played, Joker taken)
    const afterPlayer = after.players.find((p) => p.id === playerId);
    if (afterPlayer && afterPlayer.hand.length === player.hand.length) {
      this.logAction(
        before,
        playerId,
        "swapped Joker",
        `meld ${meldNumber}, ${renderCard(swapCard)} ↔ Joker`
      );
    }
    return after;
  }

  reorderHand(playerId: string, newCardOrder: string[]): GameSnapshot {
    const after = this.requireEngine().reorderHand(playerId, newCardOrder);
    this.persist();
    return after;
  }

  discardCard(position: number): GameSnapshot {
    const engine = this.requireEngine();
    const before = engine.getSnapshot();
    const playerId = before.awaitingPlayerId;
    const player = before.players.find((p) => p.id === playerId);
    if (!player) {
      throw new Error(`Player not found: ${playerId}`);
    }

    const card = player.hand[position - 1];
    if (!card) {
      throw new Error(`Card position out of range: ${position}`);
    }

    const after = engine.discard(playerId, card.id);
    this.persist();

    // Check if discard succeeded by seeing if the card moved to the discard pile
    // OR if the round ended (card would be gone and player dealt new hand)
    const cardInDiscard = after.discard.some((c) => c.id === card.id);
    const roundEnded = after.currentRound !== before.currentRound || after.phase === "GAME_END";

    if (cardInDiscard || roundEnded) {
      this.logAction(before, playerId, "discarded", renderCard(card));

      // If round ended because player went out, log that too
      if (roundEnded && player.hand.length === 1) {
        this.logAction(before, playerId, "went out", `Round ${before.currentRound} complete`);
      }
    }
    return after;
  }

  callMayI(callerId: string): GameSnapshot {
    const engine = this.requireEngine();
    const before = engine.getSnapshot();
    const claimedCard = before.discard[0];

    const after = engine.callMayI(callerId);
    this.persist();

    if (!claimedCard) {
      return after;
    }

    // Only log if May I had an effect (started resolution OR claimed the discard immediately)
    const discardStillHasCard = after.discard.some((c) => c.id === claimedCard.id);
    if (after.phase === "RESOLVING_MAY_I" || !discardStillHasCard) {
      this.logAction(before, callerId, "called May I", renderCard(claimedCard));
    }

    // If the discard was claimed immediately (no prompts), log the winner.
    if (after.phase !== "RESOLVING_MAY_I" && !discardStillHasCard) {
      this.logMayIWinner(before, after, claimedCard.id);
    }

    return after;
  }

  allowMayI(playerId?: string): GameSnapshot {
    const engine = this.requireEngine();
    const before = engine.getSnapshot();
    const responderId = playerId ?? before.awaitingPlayerId;
    const claimedCardId = before.mayIContext?.cardBeingClaimed.id ?? null;
    const after = engine.allowMayI(responderId);
    this.persist();

    if (claimedCardId) {
      this.logAction(before, responderId, "allowed May I");
      if (after.phase !== "RESOLVING_MAY_I") {
        this.logMayIWinner(before, after, claimedCardId);
      }
    }

    return after;
  }

  claimMayI(playerId?: string): GameSnapshot {
    const engine = this.requireEngine();
    const before = engine.getSnapshot();
    const responderId = playerId ?? before.awaitingPlayerId;
    const claimedCardId = before.mayIContext?.cardBeingClaimed.id ?? null;
    const after = engine.claimMayI(responderId);
    this.persist();

    if (claimedCardId) {
      this.logAction(before, responderId, "claimed May I");
      if (after.phase !== "RESOLVING_MAY_I") {
        this.logMayIWinner(before, after, claimedCardId);
      }
    }

    return after;
  }

  private requireEngine(): GameEngine {
    if (!this.engine) {
      throw new Error("No game loaded. Call newGame() or loadGame() first.");
    }
    return this.engine;
  }

  private persist(): void {
    const engine = this.requireEngine();
    const snapshot = engine.getSnapshot();
    const persistedSnapshot = engine.getPersistedSnapshot();

    const save: CliGameSave = {
      version: "3.0",
      gameId: snapshot.gameId,
      createdAt: snapshot.createdAt,
      updatedAt: snapshot.updatedAt,
      engineSnapshot: persistedSnapshot,
    };

    saveGameSave(snapshot.gameId, save);
  }

  private logAction(
    state: GameSnapshot,
    playerId: string,
    action: string,
    details?: string
  ): void {
    const playerName =
      playerId === "system"
        ? "System"
        : state.players.find((p) => p.id === playerId)?.name ?? playerId;

    const entry: ActionLogEntry = {
      timestamp: new Date().toISOString(),
      turnNumber: state.turnNumber,
      roundNumber: state.currentRound,
      playerId,
      playerName,
      action,
      ...(details ? { details } : {}),
    };

    appendActionLog(state.gameId, entry);
  }

  private logDraw(
    before: GameSnapshot,
    after: GameSnapshot,
    playerId: string,
    source: "stock" | "discard"
  ): void {
    const beforePlayer = before.players.find((p) => p.id === playerId);
    const afterPlayer = after.players.find((p) => p.id === playerId);
    if (!beforePlayer || !afterPlayer) return;

    if (afterPlayer.hand.length !== beforePlayer.hand.length + 1) return;

    const beforeIds = new Set(beforePlayer.hand.map((c) => c.id));
    const drawn = afterPlayer.hand.find((c) => !beforeIds.has(c.id));
    if (!drawn) return;

    const action = source === "stock" ? "drew from stock" : "drew from discard";
    this.logAction(before, playerId, action, renderCard(drawn));
  }

  private logMayIWinner(
    before: GameSnapshot,
    after: GameSnapshot,
    claimedCardId: string
  ): void {
    const winner = after.players.find((p) => p.hand.some((c) => c.id === claimedCardId));
    if (!winner) return;

    const beforeWinner = before.players.find((p) => p.id === winner.id);
    const delta =
      beforeWinner && winner.hand.length >= beforeWinner.hand.length
        ? winner.hand.length - beforeWinner.hand.length
        : null;

    const claimedCard =
      winner.hand.find((c) => c.id === claimedCardId) ??
      before.discard.find((c) => c.id === claimedCardId);
    const cardStr = claimedCard ? renderCard(claimedCard) : claimedCardId;

    const details = delta !== null && delta >= 2 ? `${cardStr} (+ penalty)` : cardStr;
    this.logAction(before, winner.id, "won May I", details);
  }
}
