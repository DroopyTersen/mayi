import { describe, expect, it } from "bun:test";
import type {
  KeyboardEvent,
  KeyboardEventHandler,
  ReactElement,
  ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LayOffMeldTarget, LayOffTargetFrame } from "./LayOffMeldTarget";

interface TargetFrameProps {
  isActive: boolean;
  ariaLabel: string;
  children: ReactNode;
  onClick: () => void;
  onKeyActivate?: () => void;
  className: string;
  testId?: string;
  showAriaDisabled?: boolean;
}

interface TargetElementProps {
  onClick: () => void;
  onKeyDown: KeyboardEventHandler<HTMLDivElement>;
}

function createKeyboardEvent(key: string) {
  let defaultPrevented = false;
  const event = {
    key,
    preventDefault: () => {
      defaultPrevented = true;
    },
    get defaultPrevented() {
      return defaultPrevented;
    },
  } as KeyboardEvent<HTMLDivElement> & { readonly defaultPrevented: boolean };

  return event;
}

function renderTargetFrame(
  element: ReactElement<TargetFrameProps>
): ReactElement<TargetElementProps> {
  return LayOffTargetFrame(element.props) as ReactElement<TargetElementProps>;
}

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
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-disabled="false"');
    expect(html).toContain('aria-label="Lay off selected card to Andrew run"');
    expect(html).toContain('data-testid="layoff-add-target"');
    expect(html).toContain('title="Add selected card here"');
    expect(html).toContain("border-primary/50");
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
    expect(html).toContain('role="button"');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain("border-transparent");
  });

  it("activates from Enter and Space only while active", () => {
    let activationCount = 0;
    const element = LayOffMeldTarget({
      isActive: true,
      ariaLabel: "Lay off selected card to Andrew run",
      onClick: () => undefined,
      onKeyActivate: () => {
        activationCount += 1;
      },
      children: <span>Run</span>,
    }) as ReactElement<TargetFrameProps>;
    const targetFrame = renderTargetFrame(element);

    const enterEvent = createKeyboardEvent("Enter");
    targetFrame.props.onKeyDown(enterEvent);

    const spaceEvent = createKeyboardEvent(" ");
    targetFrame.props.onKeyDown(spaceEvent);

    const tabEvent = createKeyboardEvent("Tab");
    targetFrame.props.onKeyDown(tabEvent);

    expect(activationCount).toBe(2);
    expect(enterEvent.defaultPrevented).toBe(true);
    expect(spaceEvent.defaultPrevented).toBe(true);
    expect(tabEvent.defaultPrevented).toBe(false);
  });

  it("ignores keyboard activation while inactive", () => {
    let activationCount = 0;
    const element = LayOffMeldTarget({
      isActive: false,
      ariaLabel: "Lay off selected card to Andrew run",
      onClick: () => undefined,
      onKeyActivate: () => {
        activationCount += 1;
      },
      children: <span>Run</span>,
    }) as ReactElement<TargetFrameProps>;
    const targetFrame = renderTargetFrame(element);

    const enterEvent = createKeyboardEvent("Enter");
    targetFrame.props.onKeyDown(enterEvent);

    expect(activationCount).toBe(0);
    expect(enterEvent.defaultPrevented).toBe(false);
  });
});
