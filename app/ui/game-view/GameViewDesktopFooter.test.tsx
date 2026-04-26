import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { Card } from "core/card/card.types";
import type { PlayerView } from "~/party/protocol.types";
import { GameViewDesktopFooter } from "./GameViewDesktopFooter";

function card(id: string, rank: Card["rank"], suit: Card["suit"]): Card {
  return { id, rank, suit };
}

function createGameState(canReorderHand: boolean): PlayerView {
  return {
    yourHand: [
      card("card-a", "4", "hearts"),
      card("card-b", "8", "clubs"),
      card("card-c", "4", "hearts"),
    ],
    isYourTurn: true,
    topDiscard: card("discard", "K", "spades"),
    availableActions: {
      canDrawFromStock: false,
      canDrawFromDiscard: false,
      canLayDown: true,
      canLayOff: false,
      canSwapJoker: false,
      canDiscard: true,
      canMayI: false,
      canAllowMayI: false,
      canClaimMayI: false,
      canReorderHand,
      hasPendingMayIRequest: false,
      shouldNudgeDiscard: false,
    },
    unavailabilityHints: [],
  } as unknown as PlayerView;
}

function renderFooter(
  canReorderHand: boolean,
  selectedCardIds: Set<string> = new Set()
) {
  return renderToStaticMarkup(
    <GameViewDesktopFooter
      gameState={createGameState(canReorderHand)}
      selectedCardIds={selectedCardIds}
      turnPhaseText={canReorderHand ? "Your turn - Discard" : "Waiting"}
      discardInteractiveLabel={undefined}
      onCardClick={() => undefined}
      onAction={() => undefined}
      onReorderHand={() => undefined}
    />
  );
}

describe("GameViewDesktopFooter", () => {
  it("renders the shared sortable hand when direct reorder is available", () => {
    const html = renderFooter(true, new Set(["card-b"]));

    expect(html).toContain('data-testid="sortable-hand-display"');
    expect(html).toContain('data-reorder-enabled="true"');
    expect(html).toContain('data-testid="sortable-hand-card-card-b"');
    expect(html).toContain('aria-pressed="true"');
  });

  it("keeps the desktop hand selectable but non-draggable when reorder is unavailable", () => {
    const html = renderFooter(false);

    expect(html).toContain('data-testid="sortable-hand-display"');
    expect(html).toContain('data-reorder-enabled="false"');
    expect(html).toContain('data-sortable-disabled="true"');
  });
});
