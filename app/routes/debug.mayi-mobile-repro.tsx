import { useMemo, useState } from "react";
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

export default function DebugMayIMobileRepro({
  loaderData,
}: Route.ComponentProps) {
  const [outcome, setOutcome] = useState<MayIMobileReproOutcome>("prompt");
  const [drawerOpen, setDrawerOpen] = useState(loaderData.surface !== "dialog");
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(
    new Set()
  );
  const [lastAction, setLastAction] = useState("No action yet");

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
      <div className="fixed inset-x-2 top-2 z-[70] rounded-md border bg-background/95 p-3 text-sm shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-medium">May-I mobile repro</div>
            <div data-testid="mayi-mobile-repro-status" className="text-muted-foreground">
              Surface: {loaderData.surface} · {lastAction}
            </div>
          </div>
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
