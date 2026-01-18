import { describe, it, expect } from "bun:test";
import { shouldShowInactivityHint } from "./inactivity-hint.logic";

describe("shouldShowInactivityHint", () => {
  it("returns false when disabled", () => {
    expect(
      shouldShowInactivityHint({
        isEnabled: false,
        message: "Draw a card to start your turn.",
        lastActivityAtMs: 0,
        nowMs: 30000,
        delayMs: 30000,
      })
    ).toBe(false);
  });

  it("returns false when no message is available", () => {
    expect(
      shouldShowInactivityHint({
        isEnabled: true,
        message: null,
        lastActivityAtMs: 0,
        nowMs: 60000,
        delayMs: 30000,
      })
    ).toBe(false);
  });

  it("returns false before the delay elapses", () => {
    expect(
      shouldShowInactivityHint({
        isEnabled: true,
        message: "Discard to end your turn.",
        lastActivityAtMs: 10000,
        nowMs: 35000,
        delayMs: 30000,
      })
    ).toBe(false);
  });

  it("returns true once the delay has elapsed", () => {
    expect(
      shouldShowInactivityHint({
        isEnabled: true,
        message: "Lay down or discard.",
        lastActivityAtMs: 0,
        nowMs: 30000,
        delayMs: 30000,
      })
    ).toBe(true);
  });
});
