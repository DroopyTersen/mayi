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

function expectButtonVariant(html: string, label: string, variant: string) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  expect(html).toMatch(
    new RegExp(`data-variant="${variant}"[^>]*>${escapedLabel}</button>`)
  );
}

function getButtonLabels(html: string): string[] {
  const labels: string[] = [];
  for (const match of html.matchAll(/<button\b[^>]*>(.*?)<\/button>/g)) {
    const [, label = ""] = match;
    labels.push(label.replace(/<[^>]+>/g, ""));
  }
  return labels;
}

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
  it("renders the enabled discard action as a primary button", () => {
    const html = renderToStaticMarkup(
      <ActionBar
        availableActions={{ ...baseActions, canLayOff: true, canDiscard: true }}
        onAction={() => {}}
      />
    );

    expect(html).toMatch(/data-variant="default"[^>]*>Discard<\/button>/);
    expect(html).not.toMatch(/data-variant="outline"[^>]*>Discard<\/button>/);
  });

  it("renders non-discard actions as outline buttons and organize as ghost", () => {
    const html = renderToStaticMarkup(
      <ActionBar
        availableActions={{
          ...baseActions,
          canDrawFromStock: true,
          canDrawFromDiscard: true,
          canLayDown: true,
          canLayOff: true,
          canSwapJoker: true,
          canDiscard: true,
          canMayI: true,
          canAllowMayI: true,
          canClaimMayI: true,
          canReorderHand: true,
        }}
        onAction={() => {}}
      />
    );

    expectButtonVariant(html, "Draw Card", "outline");
    expectButtonVariant(html, "Pick Up Discard", "outline");
    expectButtonVariant(html, "Lay Down", "outline");
    expectButtonVariant(html, "Lay Off", "outline");
    expectButtonVariant(html, "Swap Joker", "outline");
    expectButtonVariant(html, "Discard", "default");
    expectButtonVariant(html, "May I?", "outline");
    expectButtonVariant(html, "Allow", "outline");
    expectButtonVariant(html, "Claim", "outline");
    expectButtonVariant(html, "Organize", "ghost");
  });

  it("preserves action order with pending May I and organize last", () => {
    const html = renderToStaticMarkup(
      <ActionBar
        availableActions={{
          ...baseActions,
          canDrawFromStock: true,
          canDrawFromDiscard: true,
          canLayDown: true,
          canLayOff: true,
          canSwapJoker: true,
          canDiscard: true,
          canMayI: true,
          canAllowMayI: true,
          canClaimMayI: true,
          canReorderHand: true,
          hasPendingMayIRequest: true,
        }}
        onAction={() => {}}
      />
    );

    expect(getButtonLabels(html)).toEqual([
      "Draw Card",
      "Pick Up Discard",
      "Lay Down",
      "Lay Off",
      "Swap Joker",
      "Discard",
      "May I?",
      "Waiting...",
      "Allow",
      "Claim",
      "Organize",
    ]);
    expectButtonVariant(html, "Waiting...", "secondary");
    expectButtonVariant(html, "Organize", "ghost");
  });

  it("hides unavailable actions when action states are provided", () => {
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
        onAction={() => {}}
      />
    );

    expect(html).not.toContain("Lay Off");
  });
});
