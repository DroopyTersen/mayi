import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { PlayerView } from "~/party/protocol.types";
import { GameViewDrawers, getEffectiveActiveDrawer } from "./GameViewDrawers";

const gameState = {
  yourHand: [{ id: "card-1", rank: "K", suit: "diamonds" }],
  contract: { roundNumber: 1, sets: 2, runs: 0 },
  table: [],
} as unknown as PlayerView;

describe("GameViewDrawers", () => {
  it("clears the effective active drawer when drawers are disabled", () => {
    expect(getEffectiveActiveDrawer("discard", false)).toBeNull();
    expect(getEffectiveActiveDrawer("discard", true)).toBe("discard");
  });

  it("suppresses open action drawers while an overlay is active", () => {
    const html = renderToStaticMarkup(
      <GameViewDrawers
        activeDrawer="discard"
        drawersEnabled={false}
        closeDrawer={() => undefined}
        gameState={gameState}
        tablePlayers={[]}
        swappableJokers={[]}
        onLayDown={() => undefined}
        onLayOff={() => undefined}
        onDiscard={() => undefined}
        onSwapJoker={() => undefined}
        onOrganize={() => undefined}
      />
    );

    expect(html).not.toContain("Tap a card to select it");
    expect(html).not.toContain("card-1");
  });
});
