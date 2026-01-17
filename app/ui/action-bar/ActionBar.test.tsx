import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type {
  ActionAvailabilityState,
  AvailableActions,
} from "core/engine/game-engine.availability";
import { ActionBar } from "./ActionBar";

const baseActions: AvailableActions = {
  canDrawFromStock: false,
  canDrawFromDiscard: false,
  canLayDown: false,
  canLayOff: false,
  canSwapJoker: false,
  canDiscard: false,
  canMayI: false,
  canAllowMayI: false,
  canClaimMayI: false,
  canReorderHand: false,
  hasPendingMayIRequest: false,
  shouldNudgeDiscard: false,
};

describe("ActionBar touch-optimized mode", () => {
  it("marks content as no-drag and uses mobile-sized buttons", () => {
    const html = renderToStaticMarkup(
      <ActionBar
        availableActions={{ ...baseActions, canDiscard: true }}
        onAction={() => {}}
        touchOptimized
      />
    );

    expect(html).toContain("data-vaul-no-drag");
    expect(html).toContain('data-size="mobile"');
    expect(html).toContain("h-11");
  });
});

describe("ActionBar action state rendering", () => {
  it("renders unavailable actions as disabled buttons when provided", () => {
    const actionStates: ActionAvailabilityState[] = [
      { id: "drawStock", label: "Draw Card", status: "available" },
      {
        id: "layOff",
        label: "Lay Off",
        status: "unavailable",
        reason: "Lay down your contract first",
      },
    ];

    const html = renderToStaticMarkup(
      <ActionBar
        availableActions={{ ...baseActions, canDrawFromStock: true }}
        actionStates={actionStates}
        unavailabilityHints={[
          { action: "Lay Off", reason: "Lay down your contract first" },
        ]}
        onAction={() => {}}
      />
    );

    expect(html).toContain("Lay Off");
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Lay Off<\/button>/);
  });
});
