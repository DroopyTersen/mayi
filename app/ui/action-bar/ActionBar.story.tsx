import { ActionBar } from "./ActionBar";
import { ViewportComparison } from "~/storybook/ViewportSimulator";

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
          phase="draw"
          isYourTurn={true}
          isDown={false}
          hasDrawn={false}
          canMayI={false}
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
          phase="action"
          isYourTurn={true}
          isDown={false}
          hasDrawn={true}
          canMayI={false}
          onAction={handleAction}
        />
      </section>

      {/* Action Phase - Is Down */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Action Phase (Is Down)</h2>
        <p className="text-sm text-muted-foreground mb-2">
          Your turn, have drawn, already laid down - can lay off or swap jokers.
        </p>
        <ActionBar
          phase="action"
          isYourTurn={true}
          isDown={true}
          hasDrawn={true}
          canMayI={false}
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
          phase="waiting"
          isYourTurn={false}
          isDown={false}
          hasDrawn={false}
          canMayI={true}
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
          phase="waiting"
          isYourTurn={false}
          isDown={false}
          hasDrawn={false}
          canMayI={false}
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
            phase="action"
            isYourTurn={true}
            isDown={true}
            hasDrawn={true}
            canMayI={false}
            onAction={handleAction}
          />
        </ViewportComparison>
      </section>
    </div>
  );
}
