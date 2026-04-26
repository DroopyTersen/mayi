import type { PlayerView } from "~/party/protocol.types";
import type { SwappableJoker } from "~/ui/swap-joker-view/swap-joker-view.types";
import type { ActiveDrawer, TablePlayerInfo } from "./game-view.types";
import { ResponsiveDrawer } from "~/ui/responsive-drawer/ResponsiveDrawer";
import { LayDownDrawer } from "~/ui/lay-down-view/LayDownDrawer";
import { LayOffView } from "~/ui/lay-off-view/LayOffView";
import { DiscardView } from "~/ui/discard-view/DiscardView";
import { SwapJokerView } from "~/ui/swap-joker-view/SwapJokerView";
import { OrganizeHandView } from "~/ui/organize-hand/OrganizeHandView";

interface MeldSubmission {
  type: "set" | "run";
  cards: Array<{ id: string }>;
}

interface GameViewDrawersProps {
  activeDrawer: ActiveDrawer;
  drawersEnabled?: boolean;
  closeDrawer: () => void;
  gameState: PlayerView;
  tablePlayers: TablePlayerInfo[];
  swappableJokers: SwappableJoker[];
  onLayDown: (melds: Array<MeldSubmission>) => void;
  onLayOff: (
    cardId: string,
    meldId: string,
    position?: "start" | "end"
  ) => void;
  onDiscard: (cardId: string) => void;
  onSwapJoker: (
    meldId: string,
    jokerCardId: string,
    swapCardId: string
  ) => void;
  onOrganize: (newOrder: Array<{ id: string }>) => void;
}

export function getEffectiveActiveDrawer(
  activeDrawer: ActiveDrawer,
  drawersEnabled: boolean
): ActiveDrawer {
  return drawersEnabled ? activeDrawer : null;
}

/**
 * Groups all action drawers (layDown, layOff, discard, swapJoker, organize).
 * Each drawer is controlled by the activeDrawer state.
 */
export function GameViewDrawers({
  activeDrawer,
  drawersEnabled = true,
  closeDrawer,
  gameState,
  tablePlayers,
  swappableJokers,
  onLayDown,
  onLayOff,
  onDiscard,
  onSwapJoker,
  onOrganize,
}: GameViewDrawersProps) {
  const effectiveActiveDrawer = getEffectiveActiveDrawer(
    activeDrawer,
    drawersEnabled
  );

  return (
    <>
      {/* Lay Down Drawer */}
      <LayDownDrawer
        open={effectiveActiveDrawer === "layDown"}
        onOpenChange={(open) => !open && closeDrawer()}
        hand={gameState.yourHand}
        contract={gameState.contract}
        onLayDown={onLayDown}
        onCancel={closeDrawer}
      />

      {/* Lay Off Drawer */}
      <ResponsiveDrawer
        open={effectiveActiveDrawer === "layOff"}
        onOpenChange={(open) => !open && closeDrawer()}
        title="Lay Off"
        description="Add cards to existing melds"
        className="sm:max-w-lg"
        bare
      >
        <LayOffView
          hand={gameState.yourHand}
          tableMelds={gameState.table}
          players={tablePlayers}
          viewingPlayerId={gameState.viewingPlayerId}
          onLayOff={onLayOff}
          onDone={closeDrawer}
          onCancel={closeDrawer}
        />
      </ResponsiveDrawer>

      {/* Discard Drawer */}
      <ResponsiveDrawer
        open={effectiveActiveDrawer === "discard"}
        onOpenChange={(open) => !open && closeDrawer()}
        title="Discard"
        description="Tap a card to select it, then confirm"
        className="sm:max-w-lg"
      >
        <DiscardView
          hand={gameState.yourHand}
          showHeader={false}
          onDiscard={onDiscard}
          onCancel={closeDrawer}
        />
      </ResponsiveDrawer>

      {/* Swap Joker Drawer */}
      <ResponsiveDrawer
        open={effectiveActiveDrawer === "swapJoker"}
        onOpenChange={(open) => !open && closeDrawer()}
        title="Swap Joker"
        description="Replace a joker with a natural card"
        className="sm:max-w-lg"
      >
        <SwapJokerView
          hand={gameState.yourHand}
          meldsWithJokers={gameState.table.filter((m) =>
            m.cards.some((c) => c.rank === "Joker")
          )}
          swappableJokers={swappableJokers}
          onSwap={onSwapJoker}
          onCancel={closeDrawer}
        />
      </ResponsiveDrawer>

      {/* Organize Hand Drawer */}
      <ResponsiveDrawer
        open={effectiveActiveDrawer === "organize"}
        onOpenChange={(open) => !open && closeDrawer()}
        title="Organize Hand"
        description="Drag cards to reorder, use arrows as a fallback, or sort automatically"
        className="sm:max-w-lg"
      >
        <OrganizeHandView
          hand={gameState.yourHand}
          showHeader={false}
          onSave={onOrganize}
          onCancel={closeDrawer}
        />
      </ResponsiveDrawer>
    </>
  );
}
