import { ResponsiveDrawer } from "~/ui/responsive-drawer/ResponsiveDrawer";
import { LayDownView } from "./LayDownView";
import type { Card } from "core/card/card.types";

interface StagedMeld {
  type: "set" | "run";
  cards: Card[];
}

interface Contract {
  sets: number;
  runs: number;
}

interface LayDownDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hand: Card[];
  contract: Contract;
  /** Optional initial staged melds (for testing) */
  initialStagedMelds?: StagedMeld[];
  onLayDown: (melds: StagedMeld[]) => void;
  onCancel: () => void;
}

export function LayDownDrawer({
  open,
  onOpenChange,
  hand,
  contract,
  initialStagedMelds,
  onLayDown,
  onCancel,
}: LayDownDrawerProps) {
  return (
    <ResponsiveDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Lay Down"
      description="Arrange your cards into melds"
      className="sm:max-w-lg"
    >
      <LayDownView
        // Bug #34: Vaul drawer keeps content mounted on close.
        // Force remount on open/close transitions so staged state resets.
        key={`${open}-${contract.sets}-${contract.runs}`}
        hand={hand}
        contract={contract}
        initialStagedMelds={initialStagedMelds}
        onLayDown={onLayDown}
        onCancel={onCancel}
      />
    </ResponsiveDrawer>
  );
}
