import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { Card } from "core/card/card.types";
import { OrganizeHandView } from "./OrganizeHandView";

const longHand: Card[] = [
  { id: "1", rank: "J", suit: "spades" },
  { id: "2", rank: "K", suit: "spades" },
  { id: "3", rank: "2", suit: "clubs" },
  { id: "4", rank: "J", suit: "hearts" },
  { id: "5", rank: "4", suit: "diamonds" },
  { id: "6", rank: "5", suit: "diamonds" },
  { id: "7", rank: "6", suit: "diamonds" },
  { id: "8", rank: "7", suit: "diamonds" },
  { id: "9", rank: "9", suit: "diamonds" },
  { id: "10", rank: "10", suit: "diamonds" },
  { id: "11", rank: "J", suit: "diamonds" },
  { id: "12", rank: "3", suit: "clubs" },
  { id: "13", rank: "9", suit: "clubs" },
  { id: "14", rank: "10", suit: "clubs" },
  { id: "15", rank: "Q", suit: "clubs" },
  { id: "16", rank: "K", suit: "clubs" },
  { id: "17", rank: "A", suit: "hearts" },
  { id: "18", rank: "8", suit: "spades" },
  { id: "19", rank: "2", suit: "hearts" },
  { id: "20", rank: "5", suit: "clubs" },
  { id: "21", rank: "7", suit: "spades" },
  { id: "22", rank: "Q", suit: "diamonds" },
  { id: "23", rank: "Joker", suit: null },
];

describe("OrganizeHandView", () => {
  it("wraps very long hands in a horizontal scroll region", () => {
    const html = renderToStaticMarkup(
      <OrganizeHandView
        hand={longHand}
        onSave={() => {}}
        onCancel={() => {}}
        showHeader={false}
      />
    );

    expect(html).toContain('data-testid="organize-hand-scroll"');
    expect(html).toContain("overflow-x-auto");
    expect(html).toContain("justify-start");
    expect(html).toContain("w-max");
  });

  it("renders a sortable drag hand while keeping arrow fallback controls", () => {
    const html = renderToStaticMarkup(
      <OrganizeHandView
        hand={longHand.slice(0, 3)}
        onSave={() => {}}
        onCancel={() => {}}
        showHeader={false}
      />
    );

    expect(html).toContain('data-testid="organize-sortable-hand"');
    expect(html).toContain(
      'aria-label="Select J of spades at position 1 to move with arrow controls"'
    );
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain(">Left<");
    expect(html).toContain(">Right<");
  });
});
