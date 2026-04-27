import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { Meld } from "core/meld/meld.types";
import { TableDisplay } from "./TableDisplay";

const melds: Meld[] = [
  {
    id: "meld-1",
    type: "set",
    ownerId: "player-1",
    cards: [
      { id: "9-hearts", rank: "9", suit: "hearts" },
      { id: "9-clubs", rank: "9", suit: "clubs" },
      { id: "9-spades", rank: "9", suit: "spades" },
    ],
  },
];

describe("TableDisplay", () => {
  it("lets callers compose custom meld rendering without replacing table layout", () => {
    const html = renderToStaticMarkup(
      <TableDisplay
        melds={melds}
        players={[{ id: "player-1", name: "Alice" }]}
        renderMeld={({ meld, player }) => (
          <span
            data-testid={`custom-meld-${meld.id}`}
            data-player-name={player.name}
          >
            custom {meld.type}
          </span>
        )}
      />
    );

    expect(html).toContain('data-testid="custom-meld-meld-1"');
    expect(html).toContain('data-player-name="Alice"');
    expect(html).toContain("custom set");
  });
});
