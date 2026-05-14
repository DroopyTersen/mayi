import type { Card } from "../card/card.types";
import type { Meld } from "../meld/meld.types";
import { shuffle } from "../card/card.deck";
import type { Player } from "./engine.types";
import { reorderHand } from "./hand.reordering";

export interface RoundCardState {
  players: Player[];
  currentPlayerIndex: number;
  stock: Card[];
  discard: Card[];
  table: Meld[];
}

export interface RoundCardStatePatch {
  players?: Player[];
  stock?: Card[];
  discard?: Card[];
  table?: Meld[];
  endRoundDueToStockExhaustion?: boolean;
}

export type RoundCardStateResult =
  | { success: true; patch: RoundCardStatePatch }
  | { success: false; error: string };

export type ShuffleCards = (cards: Card[]) => Card[];

export function replenishRoundStockAfterDraw(
  stock: Card[],
  discard: Card[],
  shuffleCards: ShuffleCards = shuffle
): { stock: Card[]; discard: Card[] } {
  if (stock.length > 0 || discard.length <= 1) {
    return { stock, discard };
  }

  const topDiscard = discard[0];
  const cardsToReshuffle = discard.slice(1);
  return {
    stock: shuffleCards(cardsToReshuffle),
    discard: topDiscard ? [topDiscard] : [],
  };
}

export function applyRoundDrawFromStock(
  state: RoundCardState,
  shuffleCards: ShuffleCards = shuffle
): RoundCardStateResult {
  const currentPlayer = state.players[state.currentPlayerIndex];
  if (!currentPlayer) {
    return { success: false, error: "Current player not found" };
  }

  const drawnCard = state.stock[0];
  if (!drawnCard) {
    return { success: false, error: "Stock is empty" };
  }

  const hand = [...currentPlayer.hand, drawnCard];
  const replenished = replenishRoundStockAfterDraw(
    state.stock.slice(1),
    state.discard,
    shuffleCards
  );

  return {
    success: true,
    patch: {
      players: state.players.map((player, index) =>
        index === state.currentPlayerIndex ? { ...player, hand } : player
      ),
      stock: replenished.stock,
      discard: replenished.discard,
      endRoundDueToStockExhaustion:
        replenished.stock.length === 0 && replenished.discard.length <= 1,
    },
  };
}

export function applyRoundDrawFromDiscard(state: RoundCardState): RoundCardStateResult {
  const currentPlayer = state.players[state.currentPlayerIndex];
  if (!currentPlayer) {
    return { success: false, error: "Current player not found" };
  }
  if (currentPlayer.isDown) {
    return { success: false, error: "Down players cannot draw from discard" };
  }

  const drawnCard = state.discard[0];
  if (!drawnCard) {
    return { success: false, error: "Discard is empty" };
  }

  return {
    success: true,
    patch: {
      players: state.players.map((player, index) =>
        index === state.currentPlayerIndex
          ? { ...player, hand: [...currentPlayer.hand, drawnCard] }
          : player
      ),
      discard: state.discard.slice(1),
    },
  };
}

export function applyRoundDiscard(
  state: RoundCardState,
  cardId: string
): RoundCardStateResult {
  const currentPlayer = state.players[state.currentPlayerIndex];
  if (!currentPlayer) {
    return { success: false, error: "Current player not found" };
  }

  const card = currentPlayer.hand.find((handCard) => handCard.id === cardId);
  if (!card) {
    return { success: false, error: "Card is not in current player's hand" };
  }

  let removed = false;
  return {
    success: true,
    patch: {
      players: state.players.map((player, index) =>
        index === state.currentPlayerIndex
          ? {
              ...player,
              hand: player.hand.filter((handCard) => {
                if (!removed && handCard.id === cardId) {
                  removed = true;
                  return false;
                }
                return true;
              }),
            }
          : player
      ),
      discard: [card, ...state.discard],
    },
  };
}

export function applyRoundReorderHand(
  state: RoundCardState,
  playerId: string,
  newOrder: string[]
): RoundCardStateResult {
  const playerIndex = state.players.findIndex((player) => player.id === playerId);
  if (playerIndex === -1) {
    return { success: false, error: "Player not found" };
  }

  const player = state.players[playerIndex]!;
  const result = reorderHand(player.hand, newOrder);
  if (!result.success) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    patch: {
      players: state.players.map((candidate, index) =>
        index === playerIndex ? { ...candidate, hand: result.hand } : candidate
      ),
    },
  };
}

export function applyRoundLayDown(
  state: RoundCardState,
  usedCardIds: string[],
  newMelds: Meld[]
): RoundCardStateResult {
  const currentPlayer = state.players[state.currentPlayerIndex];
  if (!currentPlayer) {
    return { success: false, error: "Current player not found" };
  }

  const usedCardIdSet = new Set(usedCardIds);
  if (usedCardIdSet.size !== usedCardIds.length) {
    return { success: false, error: "Duplicate card IDs in laydown" };
  }

  const handCardIds = new Set(currentPlayer.hand.map((handCard) => handCard.id));
  for (const usedCardId of usedCardIdSet) {
    if (!handCardIds.has(usedCardId)) {
      return { success: false, error: "Laydown card is not in current player's hand" };
    }
  }

  return {
    success: true,
    patch: {
      players: state.players.map((player, index) =>
        index === state.currentPlayerIndex
          ? {
              ...player,
              hand: player.hand.filter((handCard) => !usedCardIdSet.has(handCard.id)),
              isDown: true,
            }
          : player
      ),
      table: [...state.table, ...newMelds],
    },
  };
}

export function applyRoundLayOff(
  state: RoundCardState,
  cardId: string,
  updatedMeld: Meld
): RoundCardStateResult {
  const currentPlayer = state.players[state.currentPlayerIndex];
  if (!currentPlayer) {
    return { success: false, error: "Current player not found" };
  }

  const card = currentPlayer.hand.find((handCard) => handCard.id === cardId);
  if (!card) {
    return { success: false, error: "Layoff card is not in current player's hand" };
  }
  if (!state.table.some((meld) => meld.id === updatedMeld.id)) {
    return { success: false, error: "Target meld not found" };
  }

  let removed = false;
  return {
    success: true,
    patch: {
      players: state.players.map((player, index) =>
        index === state.currentPlayerIndex
          ? {
              ...player,
              hand: player.hand.filter((handCard) => {
                if (!removed && handCard.id === cardId) {
                  removed = true;
                  return false;
                }
                return true;
              }),
            }
          : player
      ),
      table: state.table.map((meld) => (meld.id === updatedMeld.id ? updatedMeld : meld)),
    },
  };
}

export function applyRoundSwapJoker(
  state: RoundCardState,
  meldId: string,
  jokerCardId: string,
  swapCardId: string
): RoundCardStateResult {
  const currentPlayer = state.players[state.currentPlayerIndex];
  if (!currentPlayer) {
    return { success: false, error: "Current player not found" };
  }

  const targetMeld = state.table.find((meld) => meld.id === meldId);
  if (!targetMeld) {
    return { success: false, error: "Target meld not found" };
  }

  const jokerCard = targetMeld.cards.find((card) => card.id === jokerCardId);
  if (!jokerCard) {
    return { success: false, error: "Joker card not found in target meld" };
  }

  const swapCard = currentPlayer.hand.find((card) => card.id === swapCardId);
  if (!swapCard) {
    return { success: false, error: "Swap card is not in current player's hand" };
  }

  return {
    success: true,
    patch: {
      players: state.players.map((player, index) =>
        index === state.currentPlayerIndex
          ? {
              ...player,
              hand: [
                ...currentPlayer.hand.filter((handCard) => handCard.id !== swapCardId),
                jokerCard,
              ],
            }
          : player
      ),
      table: state.table.map((meld) => {
        if (meld.id !== meldId) return meld;
        return {
          ...meld,
          cards: meld.cards.map((card) => (card.id === jokerCardId ? swapCard : card)),
        };
      }),
    },
  };
}
