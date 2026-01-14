import { useMemo, useState } from "react";
import { Button } from "~/shadcn/components/ui/button";
import type { Card } from "core/card/card.types";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "~/shadcn/components/ui/drawer";
import { LayDownView } from "./LayDownView";

interface Contract {
  sets: number;
  runs: number;
}

const CONTRACT: Contract = { sets: 1, runs: 1 };

// Hand includes multiple Ks to mirror the original report, but the repro harness
// focuses on duplicate *ids* staged multiple times (UI-only).
const HAND: Card[] = [
  { id: "s7", rank: "7", suit: "spades" },
  { id: "ks", rank: "K", suit: "spades" },
  { id: "d4", rank: "4", suit: "diamonds" },
  { id: "d6", rank: "6", suit: "diamonds" },
  { id: "d10", rank: "10", suit: "diamonds" },
  { id: "kd1", rank: "K", suit: "diamonds" },
  { id: "kd2", rank: "K", suit: "diamonds" },
  { id: "kd3", rank: "K", suit: "diamonds" },
  { id: "c5", rank: "5", suit: "clubs" },
  { id: "c6", rank: "6", suit: "clubs" },
  { id: "c7", rank: "7", suit: "clubs" },
  { id: "c3", rank: "3", suit: "clubs" },
  { id: "d2", rank: "2", suit: "diamonds" },
];

function getStagedCounts(cardIds: string[]) {
  if (typeof document === "undefined") return new Map<string, number>();

  const counts = new Map<string, number>();
  for (const id of cardIds) {
    counts.set(id, 0);
  }

  // Only count cards that are rendered inside the staged meld areas.
  const meldRoots = Array.from(document.querySelectorAll('[data-testid^="meld-"]'));
  for (const meldRoot of meldRoots) {
    for (const id of cardIds) {
      const count = meldRoot.querySelectorAll(`button[data-card-id="${id}"]`).length;
      counts.set(id, (counts.get(id) ?? 0) + count);
    }
  }

  return counts;
}

function dispatchBurstClicks(cardId: string, times: number) {
  if (typeof document === "undefined") return;

  // Prefer the first match (hand renders above staging in LayDownView).
  const target = document.querySelector(`button[data-card-id="${cardId}"]`) as HTMLButtonElement | null;
  if (!target) return;

  for (let i = 0; i < times; i++) {
    target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  }
}

export function LayDownBug34ReproStory() {
  const [open, setOpen] = useState(false);
  const [instanceKey, setInstanceKey] = useState(0);
  const [statsTick, setStatsTick] = useState(0);

  const trackedCardIds = useMemo(() => ["kd1"], []);
  const stagedCounts = useMemo(() => getStagedCounts(trackedCardIds), [trackedCardIds, open, statsTick]);

  const refreshStats = () => setStatsTick((t) => t + 1);

  const simulateFailedLayDown = () => {
    // Mirrors GameView behavior: close immediately after "lay down" is attempted,
    // without resetting LayDownView state.
    setOpen(false);
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Bug #34: Lay Down Repro</h1>
        <p className="text-muted-foreground mt-1">
          This story uses the Vaul drawer directly so it stays mounted across close/open.
        </p>
      </header>

      <section className="space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <Button onClick={() => setOpen(true)}>Open Drawer</Button>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={!open}>
            Close
          </Button>
          <Button variant="outline" onClick={simulateFailedLayDown} disabled={!open}>
            Close (Simulate Failed Lay Down)
          </Button>
          <Button variant="outline" onClick={() => setInstanceKey((k) => k + 1)}>
            Force Remount
          </Button>
          <Button variant="outline" onClick={refreshStats}>
            Refresh Stats
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              dispatchBurstClicks("kd1", 8);
              refreshStats();
            }}
            disabled={!open}
            title="Attempts to send multiple click events to the same card before React re-renders"
          >
            Burst-click K♦(kd1) 8x
          </Button>
        </div>

        <div className="rounded-lg border p-3 text-sm space-y-1">
          <div className="font-medium">Observed (DOM) staged counts</div>
          <div className="text-muted-foreground">
            These counts only include cards inside meld staging areas. If you see `kd1` &gt; 1, the UI staged the same
            card id multiple times.
          </div>
          <div className="mt-1">
            <span className="font-mono">kd1</span>: {stagedCounts.get("kd1") ?? 0}
          </div>
        </div>
      </section>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="flex flex-col sm:max-w-lg">
          <DrawerHeader className="text-left flex-shrink-0">
            <DrawerTitle>Lay Down</DrawerTitle>
            <DrawerDescription>
              Repro: open → stage cards → close → reopen (state persists). Try burst-click to attempt duplication.
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-4 flex-1 min-h-0 overflow-hidden flex flex-col">
            <LayDownView
              key={instanceKey}
              hand={HAND}
              contract={CONTRACT}
              onLayDown={() => setOpen(false)}
              onCancel={() => setOpen(false)}
            />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

