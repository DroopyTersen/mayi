import { describe, expect, it } from "bun:test";
import {
  applyCardInvariantPolicy,
  type CardInvariantPolicy,
} from "./card-state.invariant-policy";
import type { CardInvariantReport } from "./card-state.invariants";

const okReport: CardInvariantReport = {
  ok: true,
  violations: [],
};

const duplicateReport: CardInvariantReport = {
  ok: false,
  violations: [
    {
      type: "duplicate-card-id",
      cardId: "duplicate-card",
      zones: ["hand:player-0", "discard"],
    },
  ],
};

describe("applyCardInvariantPolicy", () => {
  it("accepts clean reports for every policy", () => {
    const policies: CardInvariantPolicy[] = ["warn", "reject", "test-fail"];

    expect(
      policies.map((policy) => applyCardInvariantPolicy(okReport, { policy }))
    ).toEqual([
      { ok: true },
      { ok: true },
      { ok: true },
    ]);
  });

  it("warns and continues for projection seams", () => {
    const warnings: unknown[][] = [];
    const result = applyCardInvariantPolicy(duplicateReport, {
      policy: "warn",
      warn: (message, ...optionalParams) => {
        warnings.push([message, ...optionalParams]);
      },
      message: "Duplicate cards detected in projection",
      context: { gameId: "policy-test" },
    });

    expect(result).toEqual({ ok: true });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.[0]).toBe("Duplicate cards detected in projection");
  });

  it("rejects for persistence commit seams", () => {
    expect(
      applyCardInvariantPolicy(duplicateReport, { policy: "reject" })
    ).toEqual({
      ok: false,
      error: "CARD_INVARIANT_VIOLATION",
      invariantReport: duplicateReport,
    });
  });

  it("throws for test-fail seams", () => {
    expect(() =>
      applyCardInvariantPolicy(duplicateReport, { policy: "test-fail" })
    ).toThrow("Card invariant violation");
  });
});
