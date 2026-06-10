import { useCallback, useEffect, useMemo, useState } from "react";
import type { Route } from "./+types/debug.mayi-mobile-repro";
import type { GameAction } from "core/engine/game-action.command";
import { HandDrawer } from "~/ui/hand-drawer/HandDrawer";
import { MayIPromptDialog } from "~/ui/may-i-request/MayIPromptDialog";
import { getVisibleMayIPrompt } from "./game/may-i-prompt.state";
import {
  createMayIMobileReproPlayerView,
  parseMayIMobileReproSurface,
  type MayIMobileReproOutcome,
} from "./debug-mayi-mobile-repro.state";
import {
  resolvePlayerActionIntent,
  type PlayerActionIntent,
} from "~/ui/game-view/player-action.intent";
import {
  formatHitTestProbeResult,
  formatTapDiagnosticSnapshot,
  getHitTestProbeStatus,
  truncateLabel,
  type HitTestProbeResult,
  type HitTestProbeStatus,
  type TapDiagnosticSnapshot,
  type TapDiagnosticTarget,
} from "./debug-mayi-mobile-repro.tap-diagnostic";

export function loader({ request }: Route.LoaderArgs) {
  if (import.meta.env.MODE === "production") {
    throw new Response("Not Found", { status: 404 });
  }

  const url = new URL(request.url);
  return {
    surface: parseMayIMobileReproSurface(url.searchParams.get("surface")),
  };
}

function getActionLabel(action: GameAction): string {
  switch (action.type) {
    case "ALLOW_MAY_I":
      return "ALLOW_MAY_I fired";
    case "CLAIM_MAY_I":
      return "CLAIM_MAY_I fired";
    default:
      return `${action.type} fired`;
  }
}

function toggleSelectedCard(
  selectedCardIds: ReadonlySet<string>,
  cardId: string
): Set<string> {
  return selectedCardIds.has(cardId) ? new Set() : new Set([cardId]);
}

function getElementLabel(element: Element): string {
  const ariaLabel = element.getAttribute("aria-label");
  if (ariaLabel) {
    return ariaLabel;
  }

  const testId = element.getAttribute("data-testid");
  if (testId) {
    return testId;
  }

  const text = normalizeElementText(element);
  if (text) {
    return truncateLabel(text);
  }

  return "unlabeled";
}

function getDiagnosticTarget(element: Element): TapDiagnosticTarget {
  const closestInteractive = element.closest(
    "button,a,[role='button'],[data-testid]"
  );
  const target = closestInteractive ?? element;
  const htmlTarget = target instanceof HTMLElement ? target : null;
  const disabled =
    htmlTarget instanceof HTMLButtonElement
      ? htmlTarget.disabled
      : htmlTarget?.getAttribute("aria-disabled") === "true";

  return {
    label: getElementLabel(target),
    tagName: target.tagName.toLowerCase(),
    disabled,
    pointerEvents: htmlTarget
      ? window.getComputedStyle(htmlTarget).pointerEvents
      : "unknown",
  };
}

// TapDiagnosticSnapshot requires non-null target/hit, so the real-tap path
// keeps a "none" sentinel; probe results carry honest nulls instead.
function getDiagnosticTargetOrNone(element: Element | null): TapDiagnosticTarget {
  if (!element) {
    return {
      label: "none",
      tagName: "none",
      disabled: false,
      pointerEvents: "unknown",
    };
  }

  return getDiagnosticTarget(element);
}

function getTargetElement(target: EventTarget | null): Element | null {
  return target instanceof Element ? target : null;
}

function normalizeElementText(element: Element): string {
  return element.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

function isVisibleElement(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);

  return (
    rect.width > 0 &&
    rect.height > 0 &&
    style.display !== "none" &&
    style.visibility !== "hidden"
  );
}

function collectVisibleButtonsByText(): Map<string, HTMLButtonElement> {
  const visibleButtonsByText = new Map<string, HTMLButtonElement>();

  for (const button of Array.from(document.querySelectorAll("button"))) {
    const text = normalizeElementText(button);
    if (!visibleButtonsByText.has(text) && isVisibleElement(button)) {
      visibleButtonsByText.set(text, button);
    }
  }

  return visibleButtonsByText;
}

function findVisibleCardButtonById(cardId: string): HTMLButtonElement | null {
  const button = document.querySelector<HTMLButtonElement>(
    `button[data-card-id="${cardId}"]`
  );

  return button && isVisibleElement(button) ? button : null;
}

function getElementCenter(element: HTMLElement): { x: number; y: number } {
  const rect = element.getBoundingClientRect();

  return {
    x: Math.round(rect.left + rect.width / 2),
    y: Math.round(rect.top + rect.height / 2),
  };
}

function createHitTestProbeResult({
  label,
  element,
}: {
  label: string;
  element: HTMLElement | null;
}): HitTestProbeResult {
  if (!element) {
    return {
      label,
      center: null,
      target: null,
      hit: null,
      hitMatchesTarget: false,
    };
  }

  const center = getElementCenter(element);
  const hitElement = document.elementFromPoint(center.x, center.y);

  return {
    label,
    center,
    target: getDiagnosticTarget(element),
    hit: hitElement ? getDiagnosticTarget(hitElement) : null,
    hitMatchesTarget:
      hitElement !== null &&
      (element === hitElement || element.contains(hitElement)),
  };
}

const TEXT_PROBE_LABELS = [
  "Allow",
  "Claim",
  "Draw Card",
  "Lay Down",
  "Discard",
  "Allow May I",
  "Pick Up Discard",
];

function collectHitTestProbeResults(): HitTestProbeResult[] {
  const panel = document.querySelector<HTMLElement>(
    '[data-testid="mayi-mobile-repro-panel"]'
  );
  const previousPanelPointerEvents = panel?.style.pointerEvents ?? "";

  // elementFromPoint skips pointer-events:none elements, so hiding the panel
  // during the sweep keeps it from reporting itself as the blocker.
  if (panel) {
    panel.style.pointerEvents = "none";
  }

  try {
    const visibleButtonsByText = collectVisibleButtonsByText();

    return [
      ...TEXT_PROBE_LABELS.map((label) => ({
        label,
        element: visibleButtonsByText.get(label) ?? null,
      })),
      { label: "Stock pile", element: findVisibleCardButtonById("stock") },
    ].map(createHitTestProbeResult);
  } finally {
    if (panel) {
      panel.style.pointerEvents = previousPanelPointerEvents;
    }
  }
}

function createTapDiagnosticSnapshot(
  event: PointerEvent | MouseEvent
): TapDiagnosticSnapshot {
  const visualViewport = window.visualViewport;

  return {
    eventType: event.type,
    x: Math.round(event.clientX),
    y: Math.round(event.clientY),
    target: getDiagnosticTargetOrNone(getTargetElement(event.target)),
    hit: getDiagnosticTargetOrNone(
      document.elementFromPoint(event.clientX, event.clientY)
    ),
    viewport: {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      visualWidth: Math.round(visualViewport?.width ?? window.innerWidth),
      visualHeight: Math.round(visualViewport?.height ?? window.innerHeight),
      visualOffsetTop: Math.round(visualViewport?.offsetTop ?? 0),
    },
  };
}

function getHitTestStatusClass(status: HitTestProbeStatus): string {
  switch (status) {
    case "pass":
      return "text-emerald-700";
    case "blocked":
      return "text-destructive";
    case "disabled":
      return "text-amber-700";
    case "missing":
      return "text-muted-foreground";
    case "off-viewport":
      return "text-muted-foreground";
  }
}

export default function DebugMayIMobileRepro({
  loaderData,
}: Route.ComponentProps) {
  const [outcome, setOutcome] = useState<MayIMobileReproOutcome>("prompt");
  const [drawerOpen, setDrawerOpen] = useState(loaderData.surface !== "dialog");
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(
    new Set()
  );
  const [lastAction, setLastAction] = useState("No action yet");
  const [lastTapDiagnostic, setLastTapDiagnostic] = useState(
    "Tap diagnostic: waiting"
  );
  const [hitTestResults, setHitTestResults] = useState<HitTestProbeResult[]>(
    []
  );

  const gameState = useMemo(
    () => createMayIMobileReproPlayerView(outcome),
    [outcome]
  );
  const visibleMayIPrompt = useMemo(
    () =>
      getVisibleMayIPrompt({
        explicitPrompt: null,
        gameState,
      }),
    [gameState]
  );
  const refreshHitTests = useCallback(() => {
    const results = collectHitTestProbeResults();
    // Bail out when nothing changed so the periodic sweep doesn't re-render.
    setHitTestResults((previous) =>
      JSON.stringify(previous) === JSON.stringify(results) ? previous : results
    );
  }, []);

  useEffect(() => {
    let pendingFrameId: number | null = null;

    const scheduleRefresh = () => {
      if (pendingFrameId !== null) {
        return;
      }
      pendingFrameId = window.requestAnimationFrame(() => {
        pendingFrameId = null;
        refreshHitTests();
      });
    };

    const updateDiagnostic = (event: PointerEvent | MouseEvent) => {
      setLastTapDiagnostic(
        formatTapDiagnosticSnapshot(createTapDiagnosticSnapshot(event))
      );
      scheduleRefresh();
    };

    const visualViewport = window.visualViewport;
    // The drawer animates for 500ms; the interval covers the settle window
    // after any open/close/state change without dep-churn re-subscribes.
    const intervalId = window.setInterval(scheduleRefresh, 500);

    document.addEventListener("pointerdown", updateDiagnostic, true);
    document.addEventListener("click", updateDiagnostic, true);
    window.addEventListener("resize", scheduleRefresh);
    window.addEventListener("scroll", scheduleRefresh, true);
    visualViewport?.addEventListener("resize", scheduleRefresh);
    visualViewport?.addEventListener("scroll", scheduleRefresh);
    scheduleRefresh();

    return () => {
      if (pendingFrameId !== null) {
        window.cancelAnimationFrame(pendingFrameId);
      }
      window.clearInterval(intervalId);
      document.removeEventListener("pointerdown", updateDiagnostic, true);
      document.removeEventListener("click", updateDiagnostic, true);
      window.removeEventListener("resize", scheduleRefresh);
      window.removeEventListener("scroll", scheduleRefresh, true);
      visualViewport?.removeEventListener("resize", scheduleRefresh);
      visualViewport?.removeEventListener("scroll", scheduleRefresh);
    };
  }, [refreshHitTests]);

  const applyAction = (action: GameAction) => {
    setLastAction(getActionLabel(action));
    if (action.type === "ALLOW_MAY_I") {
      setOutcome("allowed");
      return;
    }
    if (action.type === "CLAIM_MAY_I") {
      setOutcome("claimed");
    }
  };

  const handleDrawerAction = (intent: PlayerActionIntent) => {
    const resolution = resolvePlayerActionIntent(intent, selectedCardIds);
    if (resolution.kind === "command") {
      applyAction(resolution.action);
      return;
    }
    setLastAction(`${intent.type} opened ${resolution.kind}`);
  };

  const handleCardClick = (cardId: string) => {
    setSelectedCardIds((current) => toggleSelectedCard(current, cardId));
  };

  const showDrawer = loaderData.surface !== "dialog";
  const showDialog =
    loaderData.surface !== "drawer" &&
    outcome === "prompt" &&
    visibleMayIPrompt;

  return (
    <main className="min-h-[100dvh] bg-background text-foreground">
      <div
        data-testid="mayi-mobile-repro-panel"
        className="fixed inset-x-2 top-2 z-[70] rounded-md border bg-background/95 p-3 text-sm shadow-sm backdrop-blur"
      >
        {/* Controls stay above the variable-height readout so growing
            diagnostic text cannot shift them between pointerdown and
            pointerup (which manufactured ghost-taps on these controls). */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-medium">May-I mobile repro</div>
          <div className="flex gap-2">
            <a className="underline" href="?surface=drawer">
              Drawer
            </a>
            <a className="underline" href="?surface=dialog">
              Dialog
            </a>
            <a className="underline" href="?surface=stacked">
              Stacked
            </a>
            <button
              type="button"
              className="underline"
              onClick={refreshHitTests}
            >
              Run hit test
            </button>
            <button
              type="button"
              className="underline"
              onClick={() => {
                setOutcome("prompt");
                setLastAction("Reset");
                setDrawerOpen(loaderData.surface !== "dialog");
              }}
            >
              Reset
            </button>
          </div>
        </div>
        <div
          data-testid="mayi-mobile-repro-status"
          className="text-muted-foreground"
        >
          Surface: {loaderData.surface} · {lastAction}
        </div>
        <div
          data-testid="mayi-mobile-repro-tap-diagnostic"
          className="mt-1 min-h-[3.5rem] max-w-[min(88vw,48rem)] break-words font-mono text-[11px] leading-tight text-muted-foreground"
        >
          {lastTapDiagnostic}
        </div>
        <div
          data-testid="mayi-mobile-repro-hit-tests"
          className="mt-2 grid max-w-[min(88vw,56rem)] gap-1 font-mono text-[10px] leading-tight"
        >
          {hitTestResults.map((result) => {
            const status = getHitTestProbeStatus(result);

            return (
              <div key={result.label} className={getHitTestStatusClass(status)}>
                {formatHitTestProbeResult(result, status)}
              </div>
            );
          })}
        </div>
      </div>

      <section className="mx-auto max-w-3xl px-4 pb-44 pt-24">
        <div className="rounded-md border bg-card p-4">
          <div className="text-sm text-muted-foreground">
            Round 4 of 6 · 3 sets
          </div>
          <h1 className="mt-1 text-xl font-semibold">
            Curt called May I for 4 diamonds
          </h1>
          <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <div>
              <div className="font-medium">Curt</div>
              <div className="text-muted-foreground">11 cards · score 34</div>
            </div>
            <div>
              <div className="font-medium">Kate</div>
              <div className="text-muted-foreground">Down · score 14</div>
            </div>
            <div>
              <div className="font-medium">Robin</div>
              <div className="text-muted-foreground">You · score 31</div>
            </div>
          </div>
        </div>
      </section>

      {showDrawer && (
        <HandDrawer
          hand={gameState.yourHand}
          topDiscard={gameState.topDiscard}
          selectedCardIds={selectedCardIds}
          onCardClick={handleCardClick}
          onAction={handleDrawerAction}
          availableActions={gameState.availableActions}
          actionStates={gameState.actionStates}
          unavailabilityHints={gameState.unavailabilityHints}
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          turnStatus="Robin: respond to May I"
          isYourTurn={gameState.isYourTurn}
        />
      )}

      {showDialog && (
        <MayIPromptDialog
          open={true}
          callerName={visibleMayIPrompt.callerName}
          card={visibleMayIPrompt.card}
          canMayIInstead={true}
          isCurrentPlayer={true}
          onAllow={() => applyAction({ type: "ALLOW_MAY_I" })}
          onMayIInstead={() => applyAction({ type: "CLAIM_MAY_I" })}
        />
      )}
    </main>
  );
}
