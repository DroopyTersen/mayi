import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { LayOffMeldTarget } from "./LayOffMeldTarget";

describe("LayOffMeldTarget", () => {
  it("renders a distinct add target when a selected card can be staged", () => {
    const html = renderToStaticMarkup(
      <LayOffMeldTarget
        isActive
        ariaLabel="Lay off selected card to Andrew run"
        onClick={() => undefined}
        onKeyActivate={() => undefined}
      >
        <span>Run</span>
      </LayOffMeldTarget>
    );

    expect(html).toContain('role="button"');
    expect(html).toContain('aria-label="Lay off selected card to Andrew run"');
    expect(html).toContain('data-testid="layoff-add-target"');
    expect(html).toContain('title="Add selected card here"');
  });

  it("does not show the add target when no card is selected", () => {
    const html = renderToStaticMarkup(
      <LayOffMeldTarget
        isActive={false}
        ariaLabel="Lay off selected card to Andrew run"
        onClick={() => undefined}
        onKeyActivate={() => undefined}
      >
        <span>Run</span>
      </LayOffMeldTarget>
    );

    expect(html).not.toContain('data-testid="layoff-add-target"');
    expect(html).toContain('aria-disabled="true"');
  });
});
