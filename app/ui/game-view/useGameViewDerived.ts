import { useMemo } from "react";
import type { PlayerView } from "~/party/protocol.types";
import type { SwappableJoker } from "~/ui/swap-joker-view/swap-joker-view.types";
import type { PlayerDisplayInfo, TablePlayerInfo } from "./game-view.types";
import { identifyJokerPositions } from "core/meld/meld.joker";
import {
  getDiscardInteractiveLabel,
  getTurnPhaseText,
} from "./game-view.utils";

interface UseGameViewDerivedOptions {
  gameState: PlayerView;
}

export interface UseGameViewDerivedReturn {
  /** Jokers in melds that can be swapped with cards from player's hand */
  swappableJokers: SwappableJoker[];
  /** All players ordered by turn order, for PlayersTableDisplay */
  allPlayers: PlayerDisplayInfo[];
  /** Simple player info (id, name, avatarId) for TableDisplay */
  tablePlayers: TablePlayerInfo[];
  /** Label for discard pile interaction ("pickup" | "may-i" | undefined) */
  discardInteractiveLabel: "pickup" | "may-i" | undefined;
  /** Player whose turn it is (for display) */
  awaitingPlayer: { name: string; avatarId?: string } | undefined;
  /** Text describing current turn phase */
  turnPhaseText: string;
  /** ID of the player whose turn it is */
  currentPlayerId: string | undefined;
}

/**
 * Computes derived values from game state.
 * All values are memoized to prevent unnecessary recalculation.
 */
export function useGameViewDerived({
  gameState,
}: UseGameViewDerivedOptions): UseGameViewDerivedReturn {
  // Compute swappable jokers - find jokers in runs where player has matching natural card
  const swappableJokers = useMemo((): SwappableJoker[] => {
    const result: SwappableJoker[] = [];

    for (const meld of gameState.table) {
      if (meld.type !== "run") continue;

      const positions = identifyJokerPositions(meld);
      for (const pos of positions) {
        if (!pos.isJoker) continue; // Only actual Jokers, not 2s

        // Check if player has a matching natural card in hand
        const hasMatchingCard = gameState.yourHand.some(
          (c) => c.rank === pos.actingAsRank && c.suit === pos.actingAsSuit
        );
        if (hasMatchingCard) {
          result.push({
            meldId: meld.id,
            jokerCardId: pos.wildCard.id,
            jokerIndex: pos.positionIndex,
            replacementRank: pos.actingAsRank,
            replacementSuit: pos.actingAsSuit,
          });
        }
      }
    }
    return result;
  }, [gameState.table, gameState.yourHand]);

  // Build players list for TableDisplay and PlayersTableDisplay
  // Players are ordered by turnOrder from the game state
  const allPlayers = useMemo((): PlayerDisplayInfo[] => {
    const self: PlayerDisplayInfo = {
      id: gameState.viewingPlayerId,
      name: gameState.yourName,
      avatarId: gameState.yourAvatarId,
      cardCount: gameState.yourHand.length,
      isDown: gameState.youAreDown,
      score: gameState.yourTotalScore,
    };
    const othersMap = new Map<string, PlayerDisplayInfo>(
      gameState.opponents.map((opp) => [
        opp.id,
        {
          id: opp.id,
          name: opp.name,
          avatarId: opp.avatarId,
          cardCount: opp.handCount,
          isDown: opp.isDown,
          score: opp.totalScore,
        },
      ])
    );

    // Order players by turnOrder (if available), otherwise fall back to self-first
    if (gameState.turnOrder && gameState.turnOrder.length > 0) {
      return gameState.turnOrder.map((playerId) =>
        playerId === gameState.viewingPlayerId
          ? self
          : (othersMap.get(playerId) as PlayerDisplayInfo)
      );
    }

    // Fallback for older state without turnOrder
    return [self, ...Array.from(othersMap.values())];
  }, [gameState]);

  // Build simple players list for TableDisplay (id, name, avatarId)
  const tablePlayers = useMemo((): TablePlayerInfo[] => {
    return allPlayers.map((p) => ({
      id: p.id,
      name: p.name,
      avatarId: p.avatarId,
    }));
  }, [allPlayers]);

  // Current player (the one whose turn it is)
  const currentPlayerId = gameState.awaitingPlayerId;

  // Interactive discard label - driven by availableActions
  const discardInteractiveLabel = useMemo(
    () => getDiscardInteractiveLabel(gameState.availableActions),
    [gameState.availableActions]
  );

  // Info about the player whose turn it is
  const awaitingPlayer = useMemo(() => {
    if (gameState.isYourTurn) {
      return { name: gameState.yourName, avatarId: gameState.yourAvatarId };
    }
    const opponent = gameState.opponents.find((o) => o.id === currentPlayerId);
    return opponent
      ? { name: opponent.name, avatarId: opponent.avatarId }
      : undefined;
  }, [
    gameState.opponents,
    gameState.isYourTurn,
    gameState.yourName,
    gameState.yourAvatarId,
    currentPlayerId,
  ]);

  // Turn phase text for display
  const turnPhaseText = useMemo(
    () =>
      getTurnPhaseText(
        gameState.isYourTurn,
        gameState.turnPhase,
        awaitingPlayer?.name
      ),
    [gameState.isYourTurn, gameState.turnPhase, awaitingPlayer?.name]
  );

  return {
    swappableJokers,
    allPlayers,
    tablePlayers,
    discardInteractiveLabel,
    awaitingPlayer,
    turnPhaseText,
    currentPlayerId,
  };
}
