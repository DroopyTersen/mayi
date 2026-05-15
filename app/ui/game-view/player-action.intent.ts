import type { GameAction } from "core/engine/game-action.command";
import type { ActiveDrawer } from "./game-view.types";

export type PlayerActionMeldIntent = {
  type: "set" | "run";
  cardIds: string[];
};

export type PlayerActionIntent =
  | { type: "drawStock" }
  | { type: "pickUpDiscard" }
  | { type: "mayI" }
  | { type: "skip" }
  | { type: "allowMayI" }
  | { type: "claimMayI" }
  | { type: "discard"; cardId?: string }
  | { type: "layDown"; melds?: PlayerActionMeldIntent[] }
  | {
      type: "layOff";
      cardId?: string;
      meldId?: string;
      position?: "start" | "end";
    }
  | {
      type: "swapJoker";
      meldId?: string;
      jokerCardId?: string;
      swapCardId?: string;
    }
  | { type: "organize" }
  | { type: "reorderHand"; cardIds: string[] };

export type PlayerActionResolution =
  | { kind: "command"; action: GameAction }
  | { kind: "openDrawer"; drawer: Exclude<ActiveDrawer, null> }
  | { kind: "invalid"; error: PlayerActionIntentError };

export type PlayerActionIntentError =
  | "DISCARD_REQUIRES_CARD"
  | "LAY_DOWN_REQUIRES_MELDS"
  | "LAY_DOWN_REQUIRES_CARD_IDS"
  | "LAY_OFF_REQUIRES_CARD_AND_MELD"
  | "SWAP_JOKER_REQUIRES_MELD_JOKER_AND_SWAP_CARD"
  | "REORDER_HAND_REQUIRES_CARD_IDS";

export function createDiscardIntent(cardId: string): PlayerActionIntent {
  return { type: "discard", cardId };
}

export function createLayDownIntent(
  melds: PlayerActionMeldIntent[]
): PlayerActionIntent {
  return { type: "layDown", melds };
}

export function createLayOffIntent(
  cardId: string,
  meldId: string,
  position?: "start" | "end"
): PlayerActionIntent {
  return { type: "layOff", cardId, meldId, position };
}

export function createSwapJokerIntent(
  meldId: string,
  jokerCardId: string,
  swapCardId: string
): PlayerActionIntent {
  return { type: "swapJoker", meldId, jokerCardId, swapCardId };
}

export function createReorderHandIntent(
  newOrder: Array<{ id: string }>
): PlayerActionIntent {
  return { type: "reorderHand", cardIds: newOrder.map((card) => card.id) };
}

function getOnlySelectedCardId(
  selectedCardIds: ReadonlySet<string>
): string | null {
  if (selectedCardIds.size !== 1) {
    return null;
  }

  const result = selectedCardIds.values().next();
  return result.done ? null : result.value;
}

function hasValue(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

function hasCardIds(cardIds: string[]): boolean {
  return cardIds.length > 0 && cardIds.every(hasValue);
}

function resolveDiscardIntent(
  intent: Extract<PlayerActionIntent, { type: "discard" }>,
  selectedCardIds: ReadonlySet<string>
): PlayerActionResolution {
  const cardId = intent.cardId ?? getOnlySelectedCardId(selectedCardIds);

  if (cardId) {
    return {
      kind: "command",
      action: { type: "DISCARD", cardId },
    };
  }

  return { kind: "openDrawer", drawer: "discard" };
}

export function resolvePlayerActionIntent(
  intent: PlayerActionIntent,
  selectedCardIds: ReadonlySet<string>
): PlayerActionResolution {
  switch (intent.type) {
    case "drawStock":
      return { kind: "command", action: { type: "DRAW_FROM_STOCK" } };

    case "pickUpDiscard":
      return { kind: "command", action: { type: "DRAW_FROM_DISCARD" } };

    case "mayI":
      return { kind: "command", action: { type: "CALL_MAY_I" } };

    case "skip":
      return { kind: "command", action: { type: "SKIP" } };

    case "allowMayI":
      return { kind: "command", action: { type: "ALLOW_MAY_I" } };

    case "claimMayI":
      return { kind: "command", action: { type: "CLAIM_MAY_I" } };

    case "discard":
      return resolveDiscardIntent(intent, selectedCardIds);

    case "layDown": {
      if (!intent.melds) {
        return { kind: "openDrawer", drawer: "layDown" };
      }
      if (intent.melds.length === 0) {
        return { kind: "invalid", error: "LAY_DOWN_REQUIRES_MELDS" };
      }
      if (intent.melds.some((meld) => !hasCardIds(meld.cardIds))) {
        return { kind: "invalid", error: "LAY_DOWN_REQUIRES_CARD_IDS" };
      }

      return {
        kind: "command",
        action: { type: "LAY_DOWN", melds: intent.melds },
      };
    }

    case "layOff": {
      if (!intent.cardId && !intent.meldId) {
        return { kind: "openDrawer", drawer: "layOff" };
      }
      if (!hasValue(intent.cardId) || !hasValue(intent.meldId)) {
        return { kind: "invalid", error: "LAY_OFF_REQUIRES_CARD_AND_MELD" };
      }

      return {
        kind: "command",
        action: {
          type: "LAY_OFF",
          cardId: intent.cardId,
          meldId: intent.meldId,
          position: intent.position,
        },
      };
    }

    case "swapJoker": {
      if (!intent.meldId && !intent.jokerCardId && !intent.swapCardId) {
        return { kind: "openDrawer", drawer: "swapJoker" };
      }
      if (
        !hasValue(intent.meldId) ||
        !hasValue(intent.jokerCardId) ||
        !hasValue(intent.swapCardId)
      ) {
        return {
          kind: "invalid",
          error: "SWAP_JOKER_REQUIRES_MELD_JOKER_AND_SWAP_CARD",
        };
      }

      return {
        kind: "command",
        action: {
          type: "SWAP_JOKER",
          meldId: intent.meldId,
          jokerCardId: intent.jokerCardId,
          swapCardId: intent.swapCardId,
        },
      };
    }

    case "organize":
      return { kind: "openDrawer", drawer: "organize" };

    case "reorderHand":
      if (!hasCardIds(intent.cardIds)) {
        return { kind: "invalid", error: "REORDER_HAND_REQUIRES_CARD_IDS" };
      }

      return {
        kind: "command",
        action: { type: "REORDER_HAND", cardIds: intent.cardIds },
      };
  }
}
