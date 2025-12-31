import { ActionBar } from "./ActionBar";
import { ViewportComparison } from "~/storybook/ViewportSimulator";
import type { AvailableActions } from "core/engine/game-engine.availability";

// Helper to create available actions with defaults
function createAvailableActions(overrides: Partial<AvailableActions> = {}): AvailableActions {
  return {
    canDrawFromStock: false,
    canDrawFromDiscard: false,
    canLayDown: false,
    canLayOff: false,
    canSwapJoker: false,
    canDiscard: false,
    canMayI: false,
    canAllowMayI: false,
    canClaimMayI: false,
    ...overrides,
  };
}

export function ActionBarStory() {
  const handleAction = (action: string) => {
    alert(`Action: ${action}`);
  };

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-bold">ActionBar</h1>
        <p className="text-muted-foreground mt-1">
          Bottom action buttons that change based on game phase.
        </p>
      </header>

      {/* Draw Phase */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Draw Phase</h2>
        <p className="text-sm text-muted-foreground mb-2">
          Your turn, need to draw a card.
        </p>
        <ActionBar
          availableActions={createAvailableActions({
            canDrawFromStock: true,
            canDrawFromDiscard: true,
          })}
          onAction={handleAction}
        />
      </section>

      {/* Action Phase - Not Down */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Action Phase (Not Down)</h2>
        <p className="text-sm text-muted-foreground mb-2">
          Your turn, have drawn, haven't laid down yet.
        </p>
        <ActionBar
          availableActions={createAvailableActions({
            canLayDown: true,
            canDiscard: true,
          })}
          onAction={handleAction}
        />
      </section>

      {/* Action Phase - Is Down */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Action Phase (Is Down)</h2>
        <p className="text-sm text-muted-foreground mb-2">
          Your turn, have drawn, already laid down - can lay off.
        </p>
        <ActionBar
          availableActions={createAvailableActions({
            canLayOff: true,
            canDiscard: true,
          })}
          onAction={handleAction}
        />
      </section>

      {/* Waiting - Can May I */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Waiting (Can May I)</h2>
        <p className="text-sm text-muted-foreground mb-2">
          Not your turn, but you can request "May I?".
        </p>
        <ActionBar
          availableActions={createAvailableActions({
            canMayI: true,
          })}
          onAction={handleAction}
        />
      </section>

      {/* Waiting - Cannot May I */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Waiting (No Actions)</h2>
        <p className="text-sm text-muted-foreground mb-2">
          Not your turn, no May I available.
        </p>
        <ActionBar
          availableActions={createAvailableActions()}
          onAction={handleAction}
        />
      </section>

      {/* May I Resolution - Allow/Claim */}
      <section>
        <h2 className="text-lg font-semibold mb-3">May I Resolution</h2>
        <p className="text-sm text-muted-foreground mb-2">
          You're being prompted to allow or claim during May I resolution.
        </p>
        <ActionBar
          availableActions={createAvailableActions({
            canAllowMayI: true,
            canClaimMayI: true,
          })}
          onAction={handleAction}
        />
      </section>

      {/* Responsive */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Responsive Comparison</h2>
        <p className="text-sm text-muted-foreground mb-4">
          How the action bar adapts to different container widths.
        </p>
        <ViewportComparison>
          <ActionBar
            availableActions={createAvailableActions({
              canLayOff: true,
              canDiscard: true,
            })}
            onAction={handleAction}
          />
        </ViewportComparison>
      </section>
    </div>
  );
}
