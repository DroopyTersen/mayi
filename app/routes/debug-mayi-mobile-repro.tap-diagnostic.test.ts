import { describe, expect, it } from "bun:test";
import {
  formatHitTestProbeResult,
  formatTapDiagnosticSnapshot,
  getHitTestProbeStatus,
  truncateLabel,
  type HitTestProbeResult,
  type TapDiagnosticSnapshot,
} from "./debug-mayi-mobile-repro.tap-diagnostic";

describe("formatTapDiagnosticSnapshot", () => {
  it("summarizes disabled hit targets and viewport dimensions", () => {
    const snapshot: TapDiagnosticSnapshot = {
      eventType: "pointerdown",
      x: 302,
      y: 611,
      target: {
        label: "Draw Card",
        tagName: "button",
        disabled: true,
        pointerEvents: "none",
      },
      hit: {
        label: "Drawer overlay",
        tagName: "div",
        disabled: false,
        pointerEvents: "auto",
      },
      viewport: {
        innerWidth: 390,
        innerHeight: 659,
        visualWidth: 390,
        visualHeight: 566,
        visualOffsetTop: 0,
      },
    };

    expect(formatTapDiagnosticSnapshot(snapshot)).toBe(
      "pointerdown @ 302,611 | target: Draw Card <button> disabled pe:none | hit: Drawer overlay <div> enabled pe:auto | viewport: 390x659 visual 390x566 offsetTop 0"
    );
  });
});

describe("getHitTestProbeStatus", () => {
  it("passes when the hit element is the target or inside it, even with differing labels", () => {
    const result: HitTestProbeResult = {
      label: "Claim",
      center: { x: 302, y: 611 },
      target: {
        label: "Claim",
        tagName: "button",
        disabled: false,
        pointerEvents: "auto",
      },
      hit: {
        label: "claim-icon",
        tagName: "span",
        disabled: false,
        pointerEvents: "auto",
      },
      hitMatchesTarget: true,
    };

    expect(getHitTestProbeStatus(result)).toBe("pass");
  });

  it("reports blocked when an unrelated element is the top hit target", () => {
    const result: HitTestProbeResult = {
      label: "Draw Card",
      center: { x: 302, y: 611 },
      target: {
        label: "Draw Card",
        tagName: "button",
        disabled: false,
        pointerEvents: "auto",
      },
      hit: {
        label: "Drawer overlay",
        tagName: "div",
        disabled: false,
        pointerEvents: "auto",
      },
      hitMatchesTarget: false,
    };

    expect(getHitTestProbeStatus(result)).toBe("blocked");
  });

  it("reports disabled when the target is really disabled, even if the hit matches", () => {
    const result: HitTestProbeResult = {
      label: "Draw Card",
      center: { x: 302, y: 611 },
      target: {
        label: "Draw Card",
        tagName: "button",
        disabled: true,
        pointerEvents: "auto",
      },
      hit: {
        label: "Draw Card",
        tagName: "button",
        disabled: true,
        pointerEvents: "auto",
      },
      hitMatchesTarget: true,
    };

    expect(getHitTestProbeStatus(result)).toBe("disabled");
  });

  it("classifies pointer-events none under an overlay as blocked, not disabled", () => {
    const result: HitTestProbeResult = {
      label: "Allow",
      center: { x: 200, y: 400 },
      target: {
        label: "Allow",
        tagName: "button",
        disabled: false,
        pointerEvents: "none",
      },
      hit: {
        label: "Drawer overlay",
        tagName: "div",
        disabled: false,
        pointerEvents: "auto",
      },
      hitMatchesTarget: false,
    };

    expect(getHitTestProbeStatus(result)).toBe("blocked");
  });

  it("reports off-viewport when the center resolves but elementFromPoint returned null", () => {
    const result: HitTestProbeResult = {
      label: "Discard",
      center: { x: 302, y: 900 },
      target: {
        label: "Discard",
        tagName: "button",
        disabled: false,
        pointerEvents: "auto",
      },
      hit: null,
      hitMatchesTarget: false,
    };

    expect(getHitTestProbeStatus(result)).toBe("off-viewport");
  });

  it("reports missing when the button was not found", () => {
    const result: HitTestProbeResult = {
      label: "Lay Down",
      center: null,
      target: null,
      hit: null,
      hitMatchesTarget: false,
    };

    expect(getHitTestProbeStatus(result)).toBe("missing");
  });
});

describe("formatHitTestProbeResult", () => {
  it("formats using the precomputed status and keeps pointer-events in the readout", () => {
    const result: HitTestProbeResult = {
      label: "Claim",
      center: { x: 302, y: 611 },
      target: {
        label: "Claim",
        tagName: "button",
        disabled: false,
        pointerEvents: "auto",
      },
      hit: {
        label: "Claim",
        tagName: "button",
        disabled: false,
        pointerEvents: "auto",
      },
      hitMatchesTarget: true,
    };

    expect(formatHitTestProbeResult(result, "pass")).toBe(
      "Claim: PASS center 302,611 target Claim <button> enabled pe:auto hit Claim <button> enabled pe:auto"
    );
  });

  it("renders null hit as none for off-viewport rows", () => {
    const result: HitTestProbeResult = {
      label: "Discard",
      center: { x: 302, y: 900 },
      target: {
        label: "Discard",
        tagName: "button",
        disabled: false,
        pointerEvents: "auto",
      },
      hit: null,
      hitMatchesTarget: false,
    };

    expect(formatHitTestProbeResult(result, "off-viewport")).toBe(
      "Discard: OFF-VIEWPORT center 302,900 target Discard <button> enabled pe:auto hit none"
    );
  });

  it("renders missing rows with placeholder fields", () => {
    const result: HitTestProbeResult = {
      label: "Lay Down",
      center: null,
      target: null,
      hit: null,
      hitMatchesTarget: false,
    };

    expect(formatHitTestProbeResult(result, "missing")).toBe(
      "Lay Down: MISSING center missing target missing hit none"
    );
  });
});

describe("truncateLabel", () => {
  it("returns text unchanged when at or under the limit", () => {
    expect(truncateLabel("Allow May I", 60)).toBe("Allow May I");
    expect(truncateLabel("a".repeat(60), 60)).toBe("a".repeat(60));
  });

  it("truncates to the limit with a trailing ellipsis when over", () => {
    expect(truncateLabel("a".repeat(61), 60)).toBe(`${"a".repeat(59)}…`);
    expect(truncateLabel("abcdef", 4)).toBe("abc…");
  });

  it("defaults the limit to 60 characters", () => {
    const long = "x".repeat(100);
    expect(truncateLabel(long)).toHaveLength(60);
    expect(truncateLabel(long).endsWith("…")).toBe(true);
  });
});
