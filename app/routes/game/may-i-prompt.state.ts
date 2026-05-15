import type { Card } from "core/card/card.types";
import type { PlayerView } from "core/engine/game-engine.types";

export interface VisibleMayIPrompt {
  callerId: string;
  callerName: string;
  card: Card;
}

interface VisibleMayIPromptOptions {
  explicitPrompt: VisibleMayIPrompt | null;
  gameState: PlayerView | null;
}

function canRespondToMayIPrompt(gameState: PlayerView): boolean {
  return (
    gameState.availableActions.canAllowMayI ||
    gameState.availableActions.canClaimMayI
  );
}

function getPlayerName(gameState: PlayerView, playerId: string): string | null {
  if (gameState.viewingPlayerId === playerId) {
    return gameState.yourName;
  }

  return (
    gameState.opponents.find((opponent) => opponent.id === playerId)?.name ??
    null
  );
}

export function getVisibleMayIPrompt({
  explicitPrompt,
  gameState,
}: VisibleMayIPromptOptions): VisibleMayIPrompt | null {
  if (explicitPrompt) {
    return explicitPrompt;
  }

  const mayIContext = gameState?.mayIContext;
  if (!gameState || !mayIContext) {
    return null;
  }

  if (
    gameState.phase !== "RESOLVING_MAY_I" ||
    mayIContext.playerBeingPrompted !== gameState.viewingPlayerId ||
    !canRespondToMayIPrompt(gameState)
  ) {
    return null;
  }

  const callerName = getPlayerName(gameState, mayIContext.originalCaller);
  if (!callerName) {
    return null;
  }

  return {
    callerId: mayIContext.originalCaller,
    callerName,
    card: mayIContext.cardBeingClaimed,
  };
}
