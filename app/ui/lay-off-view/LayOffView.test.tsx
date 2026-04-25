import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { Card } from "core/card/card.types";
import type { Meld } from "core/meld/meld.types";
import { LayOffView } from "./LayOffView";

const card = (id: string, rank: Card["rank"], suit: Card["suit"]): Card => ({
  id,
  rank,
  suit,
});

describe("LayOffView", () => {
  it("renders the selectable hand without overlapping hit targets", () => {
    const hand = [
      card("q-clubs-1", "Q", "clubs"),
      card("q-diamonds-1", "Q", "diamonds"),
      card("seven-hearts-1", "7", "hearts"),
    ];
    const tableMelds: Meld[] = [
      {
        id: "meld-q",
        type: "set",
        ownerId: "player-1",
        cards: [
          card("q-hearts-1", "Q", "hearts"),
          card("q-spades-1", "Q", "spades"),
          card("q-clubs-2", "Q", "clubs"),
        ],
      },
    ];

    const html = renderToStaticMarkup(
      <LayOffView
        hand={hand}
        tableMelds={tableMelds}
        players={[{ id: "player-1", name: "Agent" }]}
        viewingPlayerId="player-1"
        onLayOff={() => undefined}
        onDone={() => undefined}
        onCancel={() => undefined}
      />
    );

    const selectableHandHtml = html.split("Table melds")[0] ?? "";
    expect(selectableHandHtml).toContain("flex-wrap");
    expect(selectableHandHtml).toContain("gap-1");
    expect(selectableHandHtml).not.toContain("-ml-");
  });

  it("renders an explicit meld target instead of relying on disabled card clicks", () => {
    const hand = [card("k-spades-1", "K", "spades")];
    const tableMelds: Meld[] = [
      {
        id: "meld-kings",
        type: "set",
        ownerId: "player-2",
        cards: [
          card("k-hearts-1", "K", "hearts"),
          card("k-diamonds-1", "K", "diamonds"),
          card("k-clubs-1", "K", "clubs"),
        ],
      },
    ];

    const html = renderToStaticMarkup(
      <LayOffView
        hand={hand}
        tableMelds={tableMelds}
        players={[
          { id: "player-1", name: "Agent" },
          { id: "player-2", name: "Grok-2" },
        ]}
        viewingPlayerId="player-1"
        onLayOff={() => undefined}
        onDone={() => undefined}
        onCancel={() => undefined}
      />
    );

    expect(html).toContain('role="button"');
    expect(html).toContain('aria-label="Lay off selected card to Grok-2 set"');
    expect(html).toContain('aria-disabled="true"');
  });
});
