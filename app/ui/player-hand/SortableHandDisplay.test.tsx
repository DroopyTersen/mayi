import { describe, expect, it } from "bun:test";
import { KeyboardSensor, PointerSensor } from "@dnd-kit/react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Card } from "core/card/card.types";
import { SortableHandDisplay } from "./SortableHandDisplay";
import {
  reorderCardsAfterDrag,
  SORTABLE_HAND_DRAG_SENSORS,
} from "./sortable-hand.drag-reorder";

const hand: Card[] = [
  { id: "seven-diamonds-a", rank: "7", suit: "diamonds" },
  { id: "queen-spades", rank: "Q", suit: "spades" },
  { id: "seven-diamonds-b", rank: "7", suit: "diamonds" },
];

describe("SortableHandDisplay", () => {
  it("uses pointer-only sensors so Space and Enter stay available for selection", () => {
    expect(SORTABLE_HAND_DRAG_SENSORS).toContain(PointerSensor);
    expect(SORTABLE_HAND_DRAG_SENSORS).not.toContain(KeyboardSensor);
  });

  it("renders selected cards with shared overlap classes", () => {
    const html = renderToStaticMarkup(
      <SortableHandDisplay
        cards={hand}
        selectedIds={new Set(["queen-spades"])}
        onCardClick={() => undefined}
        onReorder={() => undefined}
      />
    );

    expect(html).toContain('data-testid="sortable-hand-display"');
    expect(html).toContain('data-testid="sortable-hand-card-queen-spades"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("-ml-5");
    expect(html).toContain("@[550px]:hover:-translate-y-3");
  });

  it("marks cards as non-draggable when reorder is disabled", () => {
    const html = renderToStaticMarkup(
      <SortableHandDisplay
        cards={hand}
        selectedIds={new Set(["queen-spades"])}
        onCardClick={() => undefined}
        onReorder={() => undefined}
        reorderEnabled={false}
      />
    );

    expect(html).toContain('data-reorder-enabled="false"');
    expect(html).toContain('data-sortable-disabled="true"');
    expect(html).not.toContain("cursor-grab");
  });

  it("keeps the same array reference when drag is canceled or unchanged", () => {
    expect(
      reorderCardsAfterDrag(hand, { initialIndex: 1, targetIndex: 1 })
    ).toBe(hand);

    expect(
      reorderCardsAfterDrag(
        hand,
        { initialIndex: 0, targetIndex: 2, canceled: true }
      )
    ).toBe(hand);
  });

  it("preserves duplicate visual card identity by stable card id", () => {
    const reordered = reorderCardsAfterDrag(
      hand,
      { initialIndex: 2, targetIndex: 0 }
    );

    expect(reordered[0]).toBe(hand[2]);
    expect(reordered.map((card) => card.id)).toEqual([
      "seven-diamonds-b",
      "seven-diamonds-a",
      "queen-spades",
    ]);
  });
});
