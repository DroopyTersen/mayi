import { useState, useCallback } from "react";
import type { Card } from "core/card/card.types";
import type { AvailableActions } from "core/engine/game-engine.availability";
import { HandDrawer } from "./HandDrawer";
import { GameHeader } from "~/ui/game-status/GameHeader";
import { ViewportSimulator } from "~/storybook/ViewportSimulator";
import { cn } from "~/shadcn/lib/utils";

// Helper to create cards
function card(id: string, rank: Card["rank"], suit: Card["suit"]): Card {
  return { id, rank, suit };
}

// Mock hands of different sizes
const SMALL_HAND: Card[] = [
  card("h1", "4", "hearts"),
  card("h2", "6", "spades"),
  card("h3", "10", "diamonds"),
];

const MEDIUM_HAND: Card[] = [
  card("h1", "4", "hearts"),
  card("h2", "6", "spades"),
  card("h3", "10", "diamonds"),
  card("h4", "K", "clubs"),
  card("h5", "A", "hearts"),
  card("h6", "7", "spades"),
];

const LARGE_HAND: Card[] = [
  card("h1", "4", "hearts"),
  card("h2", "6", "spades"),
  card("h3", "10", "diamonds"),
  card("h4", "K", "clubs"),
  card("h5", "A", "hearts"),
  card("h6", "7", "spades"),
  card("h7", "Q", "diamonds"),
  card("h8", "3", "clubs"),
  card("h9", "9", "hearts"),
  card("h10", "2", "spades"),
  card("h11", "J", "diamonds"),
];

// Mock available actions
const DRAW_PHASE_ACTIONS: AvailableActions = {
  canDrawFromStock: true,
  canDrawFromDiscard: true,
  canDiscard: false,
  canLayDown: false,
  canLayOff: false,
  canMayI: false,
  canSwapJoker: false,
  canAllowMayI: false,
  canClaimMayI: false,
  canReorderHand: true,
  hasPendingMayIRequest: false,
};

const PLAY_PHASE_ACTIONS: AvailableActions = {
  canDrawFromStock: false,
  canDrawFromDiscard: false,
  canDiscard: true,
  canLayDown: true,
  canLayOff: false,
  canMayI: false,
  canSwapJoker: false,
  canAllowMayI: false,
  canClaimMayI: false,
  canReorderHand: true,
  hasPendingMayIRequest: false,
};

const WAITING_ACTIONS: AvailableActions = {
  canDrawFromStock: false,
  canDrawFromDiscard: false,
  canDiscard: false,
  canLayDown: false,
  canLayOff: false,
  canMayI: true,
  canSwapJoker: false,
  canAllowMayI: false,
  canClaimMayI: false,
  canReorderHand: true, // Can still organize hand while waiting
  hasPendingMayIRequest: false,
};

// Mock table content for context
function MockTableContent({ turnStatus, isYourTurn }: { turnStatus: string; isYourTurn: boolean }) {
  return (
    <div className="flex flex-col h-full">
      {/* Header with turn status */}
      <GameHeader
        round={1}
        totalRounds={6}
        contract={{ sets: 2, runs: 0 }}
        turnStatus={turnStatus}
        isYourTurn={isYourTurn}
      />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="border rounded-lg p-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Table</h3>
          <div className="space-y-3">
            <div className="p-3 bg-muted/50 rounded">
              <div className="text-xs text-muted-foreground mb-1">You</div>
              <div className="text-sm">Set: Q Q Q Q | Set: 5 5 5</div>
            </div>
            <div className="p-3 bg-muted/50 rounded">
              <div className="text-xs text-muted-foreground mb-1">Alice</div>
              <div className="text-sm">Set: 8 8 8 8 | Set: 3 3 3</div>
            </div>
            <div className="p-3 bg-muted/50 rounded">
              <div className="text-xs text-muted-foreground mb-1">Bob</div>
              <div className="text-sm">Set: K K K | Set: 9 9 9 9</div>
            </div>
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Players</h3>
          <div className="text-sm space-y-1">
            <div className={cn(isYourTurn && "text-primary font-medium")}>
              You - 6 cards {isYourTurn && "(current)"}
            </div>
            <div className={cn(!isYourTurn && "text-primary font-medium")}>
              Alice - 2 cards {!isYourTurn && "(current)"}
            </div>
            <div>Bob - 4 cards</div>
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Activity</h3>
          <div className="text-sm text-muted-foreground space-y-1">
            <div>Alice drew from stock</div>
            <div>Bob discarded 7♠</div>
            <div>You laid down 2 melds</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Interactive example with real Vaul drawer
function InteractiveDrawerExample({
  hand,
  title,
  availableActions,
  turnStatus,
  isYourTurn,
}: {
  hand: Card[];
  title: string;
  availableActions: AvailableActions;
  turnStatus: string;
  isYourTurn: boolean;
}) {
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [lastAction, setLastAction] = useState<string>("");
  const [container, setContainer] = useState<HTMLDivElement | null>(null);

  // Use callback ref to get container element and trigger re-render
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (node !== null) {
      setContainer(node);
    }
  }, []);

  const handleCardClick = (cardId: string) => {
    setSelectedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  };

  const handleAction = (action: string) => {
    setLastAction(`Action: ${action}`);
    setTimeout(() => setLastAction(""), 2000);
  };

  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold">{title}</h3>
      {lastAction && (
        <div className="text-sm text-green-600 dark:text-green-400">{lastAction}</div>
      )}
      <ViewportSimulator defaultViewport="phone">
        <div ref={containerRef} className="h-[667px] bg-background relative overflow-hidden">
          <MockTableContent turnStatus={turnStatus} isYourTurn={isYourTurn} />
          {container && (
            <HandDrawer
              hand={hand}
              topDiscard={card("d1", "7", "diamonds")}
              selectedCardIds={selectedCardIds}
              onCardClick={handleCardClick}
              onAction={handleAction}
              availableActions={availableActions}
              open={open}
              onOpenChange={setOpen}
              container={container}
            />
          )}
        </div>
      </ViewportSimulator>
    </div>
  );
}

// Fullscreen test - renders drawer using actual window viewport (for mobile testing)
function FullscreenDrawerTest() {
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [lastAction, setLastAction] = useState<string>("");

  const handleCardClick = (cardId: string) => {
    setSelectedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  };

  const handleAction = (action: string) => {
    setLastAction(`Action: ${action}`);
    setTimeout(() => setLastAction(""), 2000);
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      <MockTableContent turnStatus="Your turn - Draw a card" isYourTurn={true} />
      {lastAction && (
        <div className="fixed top-16 left-4 right-4 z-[100] bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 p-2 rounded text-center text-sm">
          {lastAction}
        </div>
      )}
      <HandDrawer
        hand={MEDIUM_HAND}
        topDiscard={card("d1", "7", "diamonds")}
        selectedCardIds={selectedCardIds}
        onCardClick={handleCardClick}
        onAction={handleAction}
        availableActions={DRAW_PHASE_ACTIONS}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  );
}

export function HandDrawerStory() {
  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-bold">HandDrawer - Vaul Default Drawer</h1>
        <p className="text-muted-foreground mt-1">
          A Vaul-based hand drawer for mobile using default open/close behavior and a fixed peek trigger.
        </p>
        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg text-sm">
          <strong>Behavior:</strong>
          <ul className="list-disc ml-5 mt-2 space-y-1">
            <li><strong>Closed:</strong> A fixed peek bar shows a cropped hand preview. Tap it to open.</li>
            <li><strong>Open:</strong> Full hand view with piles + action bar. Swipe down or tap overlay to close.</li>
          </ul>
          <p className="mt-3"><strong>Interactions:</strong></p>
          <ul className="list-disc ml-5 mt-1 space-y-1">
            <li>Tap the peek bar to open</li>
            <li>Swipe down (or tap overlay) to close</li>
            <li>Turn status is shown in the header, not the drawer</li>
          </ul>
        </div>
      </header>

      <section>
        <h2 className="text-lg font-semibold mb-2">Simulated Example</h2>
        <InteractiveDrawerExample
          hand={MEDIUM_HAND}
          title="Your Turn - Draw Phase (Medium Hand)"
          availableActions={DRAW_PHASE_ACTIONS}
          turnStatus="Your turn - Draw a card"
          isYourTurn={true}
        />
      </section>

      {/* Design Notes */}
      <section className="mt-10 p-6 bg-muted/50 rounded-lg">
        <h2 className="text-lg font-semibold mb-3">Design Notes</h2>
        <ul className="space-y-2 text-sm">
          <li>
            <strong>Peek:</strong> Implemented as the `Drawer.Trigger` (not snap points)
          </li>
          <li>
            <strong>Vaul:</strong> Default open/close drawer with overlay
          </li>
          <li>
            <strong>Overlay:</strong> Tap to close (default)
          </li>
          <li>
            <strong>Cards:</strong> Preview is non-interactive; full hand is interactive when open
          </li>
          <li>
            <strong>Piles & ActionBar:</strong> Visible when open
          </li>
          <li>
            <strong>Turn Status:</strong> Moved to GameHeader for mobile
          </li>
        </ul>
      </section>
    </div>
  );
}

// Export fullscreen test as separate story for mobile viewport testing
export function HandDrawerFullscreenTest() {
  return <FullscreenDrawerTest />;
}
