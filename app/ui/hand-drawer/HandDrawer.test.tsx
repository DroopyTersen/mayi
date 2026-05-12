import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { AvailableActions } from "core/engine/game-engine.availability";
import type { Card } from "core/card/card.types";
import { HandDrawer } from "./HandDrawer";

const actions = {
  canDrawFromStock: true,
  canReorderHand: true,
} as AvailableActions;

const hand: Card[] = [
  { id: "mobile-a", rank: "4", suit: "hearts" },
  { id: "mobile-b", rank: "9", suit: "clubs" },
];

const topDiscard: Card = { id: "discard-a", rank: "K", suit: "spades" };

describe("HandDrawer", () => {
  it("keeps the closed mobile peek display-only instead of sortable", () => {
    const html = renderToStaticMarkup(
      <HandDrawer
        hand={hand}
        topDiscard={null}
        selectedCardIds={new Set()}
        onCardClick={() => undefined}
        onAction={() => undefined}
        availableActions={actions}
        open={false}
        onOpenChange={() => undefined}
      />
    );

    expect(html).toContain('aria-label="Open hand"');
    expect(html).toContain('data-card-id="mobile-a"');
    expect(html).not.toContain('data-testid="sortable-hand-display"');
    expect(html).not.toContain("data-sortable-disabled");
    expect(html).not.toContain('data-testid="mobile-hand-peek-discard"');
  });

  it("shows the discard in the closed peek when fewer than five cards remain", () => {
    const html = renderToStaticMarkup(
      <HandDrawer
        hand={hand}
        topDiscard={topDiscard}
        selectedCardIds={new Set()}
        onCardClick={() => undefined}
        onAction={() => undefined}
        availableActions={actions}
        open={false}
        onOpenChange={() => undefined}
      />
    );

    expect(html).toContain('data-testid="mobile-hand-peek-discard"');
    expect(html).toContain('data-card-id="discard-a"');
  });

  it("anchors the peek discard apart from the centered hand", () => {
    const html = renderToStaticMarkup(
      <HandDrawer
        hand={hand}
        topDiscard={topDiscard}
        selectedCardIds={new Set()}
        onCardClick={() => undefined}
        onAction={() => undefined}
        availableActions={actions}
        open={false}
        onOpenChange={() => undefined}
      />
    );

    expect(html).toContain("absolute left-4");
    expect(html).toContain("pointer-events-none");
  });

  it("does not show the discard in the closed peek for five-card hands", () => {
    const fiveCardHand: Card[] = [
      ...hand,
      { id: "mobile-c", rank: "10", suit: "diamonds" },
      { id: "mobile-d", rank: "J", suit: "hearts" },
      { id: "mobile-e", rank: "Q", suit: "spades" },
    ];

    const html = renderToStaticMarkup(
      <HandDrawer
        hand={fiveCardHand}
        topDiscard={topDiscard}
        selectedCardIds={new Set()}
        onCardClick={() => undefined}
        onAction={() => undefined}
        availableActions={actions}
        open={false}
        onOpenChange={() => undefined}
      />
    );

    expect(html).not.toContain('data-testid="mobile-hand-peek-discard"');
  });
});
