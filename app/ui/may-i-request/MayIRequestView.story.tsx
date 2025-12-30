import { MayIRequestView } from "./MayIRequestView";
import type { Card } from "core/card/card.types";
import { ViewportComparison } from "~/storybook/ViewportSimulator";

const DISCARD_CARD: Card = { id: "1", rank: "K", suit: "hearts" };
const WILD_CARD: Card = { id: "2", rank: "2", suit: "diamonds" };
const JOKER: Card = { id: "3", rank: "Joker", suit: null };

export function MayIRequestViewStory() {
  const handleAllow = () => {
    alert("Allowed May I");
  };

  const handleMayIInstead = () => {
    alert("May I Instead!");
  };

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-bold">MayIRequestView</h1>
        <p className="text-muted-foreground mt-1">
          Blocking prompt when someone calls "May I?"
        </p>
      </header>

      {/* Can May I Instead */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Can May I Instead</h2>
        <div className="flex justify-center">
          <MayIRequestView
            requesterName="Alice"
            discardCard={DISCARD_CARD}
            canMayIInstead={true}
            onAllow={handleAllow}
            onMayIInstead={handleMayIInstead}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          You can either allow or take the card yourself.
        </p>
      </section>

      {/* Cannot May I Instead */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Cannot May I Instead</h2>
        <div className="flex justify-center">
          <MayIRequestView
            requesterName="Bob"
            discardCard={DISCARD_CARD}
            canMayIInstead={false}
            onAllow={handleAllow}
            onMayIInstead={handleMayIInstead}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Already used May I this round.
        </p>
      </section>

      {/* With Timeout */}
      <section>
        <h2 className="text-lg font-semibold mb-3">With Timeout</h2>
        <div className="flex justify-center">
          <MayIRequestView
            requesterName="Charlie"
            discardCard={DISCARD_CARD}
            canMayIInstead={true}
            timeoutSeconds={15}
            onAllow={handleAllow}
            onMayIInstead={handleMayIInstead}
          />
        </div>
      </section>

      {/* Wild Card Request */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Wild Card Request</h2>
        <div className="flex justify-center">
          <MayIRequestView
            requesterName="Diana"
            discardCard={WILD_CARD}
            canMayIInstead={true}
            onAllow={handleAllow}
            onMayIInstead={handleMayIInstead}
          />
        </div>
      </section>

      {/* Joker Request */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Joker Request</h2>
        <div className="flex justify-center">
          <MayIRequestView
            requesterName="Eve"
            discardCard={JOKER}
            canMayIInstead={true}
            onAllow={handleAllow}
            onMayIInstead={handleMayIInstead}
          />
        </div>
      </section>

      {/* Responsive */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Responsive Comparison</h2>
        <p className="text-sm text-muted-foreground mb-4">
          How the May I request view adapts to different container widths.
        </p>
        <ViewportComparison>
          <div className="flex justify-center p-4">
            <MayIRequestView
              requesterName="Alice"
              discardCard={DISCARD_CARD}
              canMayIInstead={true}
              onAllow={handleAllow}
              onMayIInstead={handleMayIInstead}
            />
          </div>
        </ViewportComparison>
      </section>
    </div>
  );
}
