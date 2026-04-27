import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { InlineLayOffMeldTarget } from "./InlineLayOffMeldTarget";

describe("InlineLayOffMeldTarget", () => {
  it("wraps children in an accessible target only when enabled", () => {
    const html = renderToStaticMarkup(
      <InlineLayOffMeldTarget
        enabled
        label="Lay off selected card to Alice's set"
        isPending={false}
        onSelect={() => undefined}
        testId="inline-layoff-target-meld-1"
      >
        <span>Set</span>
      </InlineLayOffMeldTarget>
    );

    expect(html).toContain('role="button"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-label="Lay off selected card to Alice&#x27;s set"');
    expect(html).toContain('data-testid="inline-layoff-target-meld-1"');
  });

  it("renders children directly when disabled", () => {
    const html = renderToStaticMarkup(
      <InlineLayOffMeldTarget
        enabled={false}
        label="Lay off selected card"
        isPending={false}
        onSelect={() => undefined}
      >
        <span data-testid="plain-meld">Set</span>
      </InlineLayOffMeldTarget>
    );

    expect(html).toContain('data-testid="plain-meld"');
    expect(html).not.toContain('role="button"');
  });
});
