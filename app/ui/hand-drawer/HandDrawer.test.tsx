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
  });
});
