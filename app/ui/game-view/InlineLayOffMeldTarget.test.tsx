import { describe, expect, it } from "bun:test";
import type {
  KeyboardEvent,
  KeyboardEventHandler,
  ReactElement,
  ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LayOffTargetFrame } from "~/ui/lay-off-view/LayOffMeldTarget";
import { InlineLayOffMeldTarget } from "./InlineLayOffMeldTarget";

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
    expect(html).not.toContain("border-blue-500");
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

  it("marks the target as pending when selecting a layoff position", () => {
    const html = renderToStaticMarkup(
      <InlineLayOffMeldTarget
        enabled
        label="Lay off selected card"
        isPending
        onSelect={() => undefined}
      >
        <span>Run</span>
      </InlineLayOffMeldTarget>
    );

    expect(html).toContain("border-solid");
    expect(html).toContain("border-blue-500");
    expect(html).toContain("bg-blue-50");
  });

  it("activates from click, Enter, and Space when enabled", () => {
    let selectionCount = 0;
    const element = InlineLayOffMeldTarget({
      enabled: true,
      label: "Lay off selected card",
      isPending: false,
      onSelect: () => {
        selectionCount += 1;
      },
      children: <span>Run</span>,
    }) as ReactElement<TargetFrameProps>;
    const targetFrame = renderTargetFrame(element);

    targetFrame.props.onClick();

    const enterEvent = createKeyboardEvent("Enter");
    targetFrame.props.onKeyDown(enterEvent);

    const spaceEvent = createKeyboardEvent(" ");
    targetFrame.props.onKeyDown(spaceEvent);

    const tabEvent = createKeyboardEvent("Tab");
    targetFrame.props.onKeyDown(tabEvent);

    expect(selectionCount).toBe(3);
    expect(enterEvent.defaultPrevented).toBe(true);
    expect(spaceEvent.defaultPrevented).toBe(true);
    expect(tabEvent.defaultPrevented).toBe(false);
  });
});
