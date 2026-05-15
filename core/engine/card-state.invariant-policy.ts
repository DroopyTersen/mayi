import type { CardInvariantReport } from "./card-state.invariants";

export type CardInvariantPolicy = "warn" | "reject" | "test-fail";

export type CardInvariantPolicyResult =
  | { ok: true }
  | {
      ok: false;
      error: "CARD_INVARIANT_VIOLATION";
      invariantReport: CardInvariantReport;
    };

export interface ApplyCardInvariantPolicyOptions {
  policy: CardInvariantPolicy;
  warn?: (message?: unknown, ...optionalParams: unknown[]) => void;
  message?: string;
  context?: Record<string, unknown>;
}

export function applyCardInvariantPolicy(
  report: CardInvariantReport,
  options: ApplyCardInvariantPolicyOptions
): CardInvariantPolicyResult {
  if (report.ok) {
    return { ok: true };
  }

  switch (options.policy) {
    case "warn":
      (options.warn ?? console.warn)(
        options.message ?? "Card invariant violation",
        {
          ...(options.context ?? {}),
          cardInvariantViolations: report.violations,
        }
      );
      return { ok: true };

    case "reject":
      return {
        ok: false,
        error: "CARD_INVARIANT_VIOLATION",
        invariantReport: report,
      };

    case "test-fail":
      throw new Error(
        `Card invariant violation: ${report.violations
          .map((violation) => violation.cardId)
          .join(", ")}`
      );
  }
}
