import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { PlayerView } from "~/party/protocol.types";
import { GameViewMobileDiscardContext, shouldShowMobileDiscardContext } from "./GameViewMobileDiscardContext";

const topDiscard = { id: "discard", rank: "K", suit: "spades" } as const;

function view(overrides: Partial<PlayerView>): PlayerView {
  return {
    topDiscard,
    youAreDown: false,
    yourHand: Array.from({ length: 11 }, (_, index) => ({
      id: `card-${index}`,
      rank: "5",
      suit: "hearts",
    })),
    ...overrides,
  } as PlayerView;
}

describe("shouldShowMobileDiscardContext", () => {
  it("shows discard context after the viewing player is down", () => {
    expect(shouldShowMobileDiscardContext(view({ youAreDown: true }))).toBe(
      true
    );
  });

  it("shows discard context when the hand is small enough to leave room", () => {
    expect(
      shouldShowMobileDiscardContext(
        view({ yourHand: view({}).yourHand.slice(0, 6) })
      )
    ).toBe(true);
  });

  it("hides discard context for a full not-yet-down hand", () => {
    expect(shouldShowMobileDiscardContext(view({}))).toBe(false);
  });
});

describe("GameViewMobileDiscardContext", () => {
  it("renders the discard without disabled dimming when it is context-only", () => {
    const html = renderToStaticMarkup(
      <GameViewMobileDiscardContext
        topDiscard={topDiscard}
        interactiveLabel={undefined}
        onAction={() => undefined}
      />
    );

    expect(html).toContain('data-testid="mobile-discard-context"');
    expect(html).toContain("Discard");
    expect(html).not.toContain("saturate(0.3)");
  });

  it("keeps existing discard actions interactive when available", () => {
    const html = renderToStaticMarkup(
      <GameViewMobileDiscardContext
        topDiscard={topDiscard}
        interactiveLabel="may-i"
        onAction={() => undefined}
      />
    );

    expect(html).toContain("May I?");
  });
});
