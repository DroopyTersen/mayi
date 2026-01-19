import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { Card } from "core/card/card.types";
import { HandDisplay } from "./HandDisplay";

const SINGLE_CARD_HAND: Card[] = [{ id: "card-1", suit: "hearts", rank: "7" }];

describe("HandDisplay auto mode fallback", () => {
  it("renders a single PlayingCard per card when container queries are unavailable", () => {
    const html = renderToStaticMarkup(
      <HandDisplay cards={SINGLE_CARD_HAND} size="auto" />
    );
    const matches = html.match(/data-card-id="card-1"/g) ?? [];
    expect(matches.length).toBe(1);
  });
});
