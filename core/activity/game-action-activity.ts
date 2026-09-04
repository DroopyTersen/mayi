import { formatCardText } from "../card/card-text.utils";
import type { GameAction } from "../engine/game-action.command";
import type { GameSnapshot } from "../engine/game-engine.types";
import type { BaseActivityLogEntry } from "./activity-log.format";

export type PublicGameActivity = Omit<BaseActivityLogEntry, "timestamp">;

/** Projection needs the accepted action kind, not its already-applied meld spec. */
export type GameActivityAction =
  | Exclude<GameAction, { type: "LAY_DOWN" | "LAY_OFF" }>
  | { type: "LAY_DOWN" }
  | Omit<Extract<GameAction, { type: "LAY_OFF" }>, "meldId">;

/** Public facts from an accepted action. Never include private draw identities. */
export function projectGameActionActivity({
  playerId,
  action,
  before,
  after,
}: {
  playerId: string;
  action: GameActivityAction;
  before: GameSnapshot;
  after: GameSnapshot;
}): PublicGameActivity[] {
  const entries: PublicGameActivity[] = [];
  const previous = before.players.find((player) => player.id === playerId);
  const current = after.players.find((player) => player.id === playerId);
  if (!previous) return entries;
  const record = (action: string, details?: string, ownerId = playerId) => {
    entries.push({
      roundNumber: before.currentRound,
      turnNumber: before.turnNumber,
      playerId: ownerId,
      playerName:
        before.players.find((player) => player.id === ownerId)?.name ?? ownerId,
      action,
      ...(details ? { details } : {}),
    });
  };
  const ended =
    after.currentRound !== before.currentRound ||
    after.phase === "GAME_END" ||
    after.phase === "ROUND_END";
  const won =
    after.roundHistory.some(
      (round) =>
        round.roundNumber === before.currentRound &&
        round.winnerId === playerId,
    ) ||
    (after.phase === "ROUND_END" && current?.hand.length === 0);

  switch (action.type) {
    case "DRAW_FROM_STOCK":
    case "DRAW_FROM_DISCARD": {
      if (
        action.type === "DRAW_FROM_STOCK" &&
        before.stock.length > 0 &&
        ended
      ) {
        record("drew from the draw pile");
        break;
      }
      if (!current || current.hand.length !== previous.hand.length + 1) break;
      const previousIds = new Set(previous.hand.map((card) => card.id));
      const drawn = current.hand.find((card) => !previousIds.has(card.id));
      if (drawn) {
        if (action.type === "DRAW_FROM_STOCK")
          record("drew from the draw pile");
        else record("took from discard", formatCardText(drawn));
      }
      break;
    }
    case "DISCARD": {
      const card = previous.hand.find((card) => card.id === action.cardId);
      if (after.discard.some((card) => card.id === action.cardId) || ended) {
        if (card) record("discarded", formatCardText(card));
        if (previous.hand.length === 1 && ended) record("went out!");
      }
      break;
    }
    case "LAY_DOWN": {
      if (!previous.isDown && won) {
        record(
          "laid down contract",
          previous.hand.map(formatCardText).join(" "),
        );
        record("went out!");
      } else if (!previous.isDown && current?.isDown) {
        const oldIds = new Set(before.table.map((meld) => meld.id));
        const details = after.table
          .filter((meld) => meld.ownerId === playerId && !oldIds.has(meld.id))
          .map(
            (meld) =>
              `${meld.type}: ${meld.cards.map(formatCardText).join(" ")}`,
          )
          .join("; ");
        record("laid down contract", details);
      }
      break;
    }
    case "LAY_OFF": {
      if (
        (won && previous.hand.length === 1) ||
        current?.hand.length === previous.hand.length - 1
      ) {
        const card = previous.hand.find((card) => card.id === action.cardId);
        if (card) {
          record(
            `laid off${action.position === "start" ? " at start" : ""}`,
            formatCardText(card),
          );
          if (won && previous.hand.length === 1) record("went out!");
        }
      }
      break;
    }
    case "SWAP_JOKER": {
      const oldMeld = before.table.find((meld) => meld.id === action.meldId);
      const newMeld = after.table.find((meld) => meld.id === action.meldId);
      const card = previous.hand.find((card) => card.id === action.swapCardId);
      if (
        oldMeld &&
        newMeld &&
        card &&
        current &&
        oldMeld.cards.some((card) => card.id === action.jokerCardId) &&
        !newMeld.cards.some((card) => card.id === action.jokerCardId) &&
        newMeld.cards.some((card) => card.id === action.swapCardId) &&
        current.hand.some((card) => card.id === action.jokerCardId) &&
        !current.hand.some((card) => card.id === action.swapCardId)
      ) {
        const owner = before.players.find(
          (player) => player.id === newMeld.ownerId,
        );
        const label = owner
          ? `${owner.name}'s ${newMeld.type}`
          : `${newMeld.type} ${newMeld.id}`;
        record("swapped Joker", `${formatCardText(card)} into ${label}`);
      }
      break;
    }
    case "CALL_MAY_I":
      if (before.discard[0])
        record("called May I", formatCardText(before.discard[0]));
      break;
    case "ALLOW_MAY_I":
      record("allowed May I");
      break;
    case "CLAIM_MAY_I":
      if (before.mayIContext)
        record(
          "claimed May I",
          formatCardText(before.mayIContext.cardBeingClaimed),
        );
      break;
    case "SKIP":
    case "REORDER_HAND":
      break;
  }

  if (
    (action.type === "CALL_MAY_I" ||
      action.type === "ALLOW_MAY_I" ||
      action.type === "CLAIM_MAY_I") &&
    after.currentRound === before.currentRound
  ) {
    const publicCard =
      before.mayIContext?.cardBeingClaimed ?? before.discard[0];
    if (publicCard) {
      const recipient = after.players.find(
        (player) =>
          player.hand.some((card) => card.id === publicCard.id) &&
          !before.players
            .find((previous) => previous.id === player.id)
            ?.hand.some((card) => card.id === publicCard.id),
      );
      if (recipient)
        record("took the May I card", formatCardText(publicCard), recipient.id);
    }
  }
  return entries;
}
