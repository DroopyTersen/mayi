import type { Card } from "core/card/card.types";
import { ChevronUp, Hand } from "lucide-react";
import { HandDisplay } from "~/ui/player-hand/HandDisplay";
import { ViewportSimulator } from "~/storybook/ViewportSimulator";
import { cn } from "~/shadcn/lib/utils";

/**
 * Mockup variants for the mobile hand drawer peek bar.
 *
 * Constraints (per user feedback):
 * - Drawer is tap-to-open, NOT swipe — affordances should look tappable, not draggable
 * - Should appear to float over the game table (shadow above, top-rounded corners)
 * - Turn status moves out of the header into this peek (mobile equivalent of the
 *   desktop ActionBar leadingSlot pattern)
 */

const SAMPLE_HAND: Card[] = [
  { id: "c1", suit: "spades", rank: "9" },
  { id: "c2", suit: "hearts", rank: "9" },
  { id: "c3", suit: "clubs", rank: "9" },
  { id: "c4", suit: "diamonds", rank: "9" },
  { id: "c5", suit: "spades", rank: "10" },
  { id: "c6", suit: "hearts", rank: "10" },
  { id: "c7", suit: "spades", rank: "2" },
  { id: "c8", suit: "clubs", rank: "2" },
];

const ONE_CARD_HAND: Card[] = [{ id: "c1", suit: "hearts", rank: "3" }];

function FakeTable() {
  return (
    <div className="h-[420px] bg-muted/30 p-4 flex items-center justify-center">
      <p className="text-sm text-muted-foreground">(game table content)</p>
    </div>
  );
}

interface PeekShellProps {
  children: React.ReactNode;
  /** Use raised shadow when not "in drawer", to suggest floating over table */
  className?: string;
}

/** Wraps any peek variant: top-rounded, shadow-above, full width, fixed bottom. */
function PeekShell({ children, className }: PeekShellProps) {
  return (
    <div
      className={cn(
        "relative",
        // top-rounded corners
        "rounded-t-2xl overflow-hidden",
        // shadow above so it floats over the table
        "shadow-[0_-8px_24px_-8px_rgb(0_0_0/0.18),0_-2px_6px_-2px_rgb(0_0_0/0.08)]",
        className
      )}
    >
      {children}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Variant A — CTA Button (minimalist)
 * ────────────────────────────────────────────────────────────────────────── */

interface VariantAProps {
  cardCount: number;
  turnStatus: string;
  isYourTurn: boolean;
}

function VariantA({ cardCount, turnStatus, isYourTurn }: VariantAProps) {
  return (
    <PeekShell>
      <button
        type="button"
        className={cn(
          "w-full flex items-center justify-between gap-3 px-5 py-4",
          "border-t",
          isYourTurn
            ? "bg-primary/10 border-primary/30 hover:bg-primary/15 active:bg-primary/20"
            : "bg-background hover:bg-muted active:bg-muted/80",
          "transition-colors"
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={cn(
              "size-9 rounded-full flex items-center justify-center shrink-0",
              isYourTurn
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            )}
          >
            <Hand className="size-5" />
          </div>
          <div className="flex flex-col items-start text-left min-w-0">
            <span
              className={cn(
                "text-[11px] uppercase tracking-wide",
                isYourTurn ? "text-primary" : "text-muted-foreground"
              )}
            >
              {isYourTurn ? "Your turn" : "Waiting"}
            </span>
            <span className="text-sm font-medium truncate">
              {turnStatus}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={cn(
              "px-2.5 py-1 rounded-full text-xs font-semibold tabular-nums",
              "bg-background border"
            )}
          >
            {cardCount} {cardCount === 1 ? "card" : "cards"}
          </span>
        </div>
      </button>
    </PeekShell>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Variant B — Hand Preview (shows cards but as a button)
 * ────────────────────────────────────────────────────────────────────────── */

interface VariantBProps {
  hand: Card[];
  turnStatus: string;
  isYourTurn: boolean;
}

function VariantB({ hand, turnStatus, isYourTurn }: VariantBProps) {
  return (
    <PeekShell>
      <button
        type="button"
        className={cn(
          "w-full text-left",
          "bg-background hover:bg-muted/40 active:bg-muted/60 transition-colors",
          "border-t"
        )}
      >
        <div className="px-4 pt-3 pb-1 flex items-center justify-between">
          <span
            className={cn(
              "text-sm font-medium",
              isYourTurn ? "text-primary" : "text-muted-foreground"
            )}
          >
            {turnStatus}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="tabular-nums">{hand.length}</span>
            <Hand className="size-3.5" />
          </span>
        </div>
        <div className="h-[56px] overflow-hidden px-3 pb-2">
          <HandDisplay
            cards={hand}
            size="sm"
            className="justify-center items-start pointer-events-none"
          />
        </div>
      </button>
    </PeekShell>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Variant C — Two-Tier (status banner + tappable hand row)
 * ────────────────────────────────────────────────────────────────────────── */

interface VariantCProps {
  hand: Card[];
  turnStatus: string;
  isYourTurn: boolean;
}

function VariantC({ hand, turnStatus, isYourTurn }: VariantCProps) {
  return (
    <PeekShell>
      <div className="bg-background border-t">
        {/* Status strip — always visible, mirrors desktop action-bar leadingSlot */}
        <div
          className={cn(
            "px-4 py-1.5 text-center text-xs font-medium",
            isYourTurn
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          )}
        >
          {turnStatus}
        </div>
        {/* Tappable hand strip */}
        <button
          type="button"
          className={cn(
            "w-full flex items-center gap-3 px-4 py-2",
            "hover:bg-muted/40 active:bg-muted/60 transition-colors"
          )}
        >
          <span className="text-xs text-muted-foreground shrink-0">
            <span className="tabular-nums font-semibold text-foreground">
              {hand.length}
            </span>{" "}
            {hand.length === 1 ? "card" : "cards"}
          </span>
          <div className="h-[48px] overflow-hidden flex-1 min-w-0">
            <HandDisplay
              cards={hand}
              size="sm"
              className="items-start pointer-events-none"
            />
          </div>
          <ChevronUp className="size-4 text-muted-foreground shrink-0" />
        </button>
      </div>
    </PeekShell>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Story
 * ────────────────────────────────────────────────────────────────────────── */

export function HandPeekMockupStory() {
  return (
    <div className="space-y-12 max-w-3xl">
      <header>
        <h1 className="text-2xl font-bold">Hand Peek (Mockup)</h1>
        <p className="text-muted-foreground mt-1 max-w-xl">
          Tap-to-open variants for the mobile hand drawer peek. All three are
          styled as buttons (no drag-handle pill, no swipe affordance), have
          top-rounded corners, and a shadow above so they appear to float over
          the game table. Turn status moves out of the header and into the
          peek — the mobile equivalent of the desktop ActionBar leadingSlot.
        </p>
      </header>

      {/* ── Variant A ──────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold">Variant A — CTA Button</h2>
        <p className="text-sm text-muted-foreground mb-3">
          Minimalist. Hand icon, status, card count pill. No cards visible
          until the drawer opens. Reads unmistakably as a button.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ViewportSimulator defaultViewport="phone">
            <FakeTable />
            <VariantA
              cardCount={11}
              turnStatus="Draw a card"
              isYourTurn={true}
            />
          </ViewportSimulator>
          <ViewportSimulator defaultViewport="phone">
            <FakeTable />
            <VariantA
              cardCount={11}
              turnStatus="Primus is drawing…"
              isYourTurn={false}
            />
          </ViewportSimulator>
        </div>
      </section>

      {/* ── Variant B ──────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold">Variant B — Hand Preview</h2>
        <p className="text-sm text-muted-foreground mb-3">
          Status text on top, real cards below. Whole bar is one big button —
          no handle pill, hover/press states make tappability clear.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ViewportSimulator defaultViewport="phone">
            <FakeTable />
            <VariantB
              hand={SAMPLE_HAND}
              turnStatus="Your turn — Draw a card"
              isYourTurn={true}
            />
          </ViewportSimulator>
          <ViewportSimulator defaultViewport="phone">
            <FakeTable />
            <VariantB
              hand={ONE_CARD_HAND}
              turnStatus="Primus is drawing…"
              isYourTurn={false}
            />
          </ViewportSimulator>
        </div>
      </section>

      {/* ── Variant C ──────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold">Variant C — Two-Tier</h2>
        <p className="text-sm text-muted-foreground mb-3">
          Skinny status banner pinned across the top (high-contrast when it's
          your turn), tappable hand row below with a subtle chevron. Status is
          always-visible without bloating the peek height.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ViewportSimulator defaultViewport="phone">
            <FakeTable />
            <VariantC
              hand={SAMPLE_HAND}
              turnStatus="Your turn — Draw a card"
              isYourTurn={true}
            />
          </ViewportSimulator>
          <ViewportSimulator defaultViewport="phone">
            <FakeTable />
            <VariantC
              hand={SAMPLE_HAND}
              turnStatus="Primus is drawing…"
              isYourTurn={false}
            />
          </ViewportSimulator>
        </div>
      </section>

      {/* ── Side-by-side at one card ──────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold">Edge case — 1 card in hand</h2>
        <p className="text-sm text-muted-foreground mb-3">
          The original screenshot showed a single lonely card. Here's how each
          variant handles it.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ViewportSimulator defaultViewport="phone" showControls={false}>
            <FakeTable />
            <VariantA
              cardCount={1}
              turnStatus="Lay down or discard"
              isYourTurn={true}
            />
          </ViewportSimulator>
          <ViewportSimulator defaultViewport="phone" showControls={false}>
            <FakeTable />
            <VariantB
              hand={ONE_CARD_HAND}
              turnStatus="Your turn — Discard"
              isYourTurn={true}
            />
          </ViewportSimulator>
          <ViewportSimulator defaultViewport="phone" showControls={false}>
            <FakeTable />
            <VariantC
              hand={ONE_CARD_HAND}
              turnStatus="Your turn — Discard"
              isYourTurn={true}
            />
          </ViewportSimulator>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          A doesn't depend on card count. B and C show one card, but the
          surrounding button chrome makes it clear it's tappable.
        </p>
      </section>
    </div>
  );
}
