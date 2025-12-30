import { DiscardPileDisplay } from "./DiscardPileDisplay";
import type { Card } from "core/card/card.types";
import { ViewportComparison } from "~/storybook/ViewportSimulator";

const SAMPLE_CARD: Card = { id: "1", rank: "7", suit: "hearts" };
const FACE_CARD: Card = { id: "2", rank: "K", suit: "spades" };
const WILD_CARD: Card = { id: "3", rank: "2", suit: "diamonds" };
const JOKER: Card = { id: "4", rank: "Joker", suit: null };

export function DiscardPileDisplayStory() {
  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-bold">DiscardPileDisplay</h1>
        <p className="text-muted-foreground mt-1">
          Discard pile with stack effect showing top card.
        </p>
      </header>

      {/* Default */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Default</h2>
        <DiscardPileDisplay topCard={SAMPLE_CARD} />
        <p className="text-xs text-muted-foreground mt-2">
          7 of hearts on top of the pile.
        </p>
      </section>

      {/* Sizes */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Sizes</h2>
        <div className="flex gap-6 items-end">
          <div className="text-center">
            <DiscardPileDisplay topCard={SAMPLE_CARD} size="sm" />
            <p className="text-xs text-muted-foreground mt-2">Small</p>
          </div>
          <div className="text-center">
            <DiscardPileDisplay topCard={SAMPLE_CARD} size="md" />
            <p className="text-xs text-muted-foreground mt-2">Medium</p>
          </div>
          <div className="text-center">
            <DiscardPileDisplay topCard={SAMPLE_CARD} size="lg" />
            <p className="text-xs text-muted-foreground mt-2">Large</p>
          </div>
        </div>
      </section>

      {/* Different Cards */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Different Top Cards</h2>
        <div className="flex gap-6">
          <div className="text-center">
            <DiscardPileDisplay topCard={SAMPLE_CARD} />
            <p className="text-xs text-muted-foreground mt-2">Number</p>
          </div>
          <div className="text-center">
            <DiscardPileDisplay topCard={FACE_CARD} />
            <p className="text-xs text-muted-foreground mt-2">Face Card</p>
          </div>
          <div className="text-center">
            <DiscardPileDisplay topCard={WILD_CARD} />
            <p className="text-xs text-muted-foreground mt-2">Wild 2</p>
          </div>
          <div className="text-center">
            <DiscardPileDisplay topCard={JOKER} />
            <p className="text-xs text-muted-foreground mt-2">Joker</p>
          </div>
        </div>
      </section>

      {/* Empty Pile */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Empty Pile</h2>
        <div className="flex gap-6 items-end">
          <div className="text-center">
            <DiscardPileDisplay topCard={null} size="sm" />
            <p className="text-xs text-muted-foreground mt-2">Small</p>
          </div>
          <div className="text-center">
            <DiscardPileDisplay topCard={null} size="md" />
            <p className="text-xs text-muted-foreground mt-2">Medium</p>
          </div>
          <div className="text-center">
            <DiscardPileDisplay topCard={null} size="lg" />
            <p className="text-xs text-muted-foreground mt-2">Large</p>
          </div>
        </div>
      </section>

      {/* Interactive with Pickup Label */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Interactive: Pickup</h2>
        <div className="flex gap-6 items-end">
          <div className="text-center">
            <DiscardPileDisplay
              topCard={FACE_CARD}
              size="sm"
              interactiveLabel="pickup"
              onClick={() => alert("Pickup clicked!")}
            />
            <p className="text-xs text-muted-foreground mt-2">Small</p>
          </div>
          <div className="text-center">
            <DiscardPileDisplay
              topCard={FACE_CARD}
              size="md"
              interactiveLabel="pickup"
              onClick={() => alert("Pickup clicked!")}
            />
            <p className="text-xs text-muted-foreground mt-2">Medium</p>
          </div>
          <div className="text-center">
            <DiscardPileDisplay
              topCard={FACE_CARD}
              size="lg"
              interactiveLabel="pickup"
              onClick={() => alert("Pickup clicked!")}
            />
            <p className="text-xs text-muted-foreground mt-2">Large</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          For current player's turn - tap to draw from discard.
        </p>
      </section>

      {/* Interactive with May I? Label */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Interactive: May I?</h2>
        <div className="flex gap-6 items-end">
          <div className="text-center">
            <DiscardPileDisplay
              topCard={WILD_CARD}
              size="sm"
              interactiveLabel="may-i"
              onClick={() => alert("May I? clicked!")}
            />
            <p className="text-xs text-muted-foreground mt-2">Small</p>
          </div>
          <div className="text-center">
            <DiscardPileDisplay
              topCard={WILD_CARD}
              size="md"
              interactiveLabel="may-i"
              onClick={() => alert("May I? clicked!")}
            />
            <p className="text-xs text-muted-foreground mt-2">Medium</p>
          </div>
          <div className="text-center">
            <DiscardPileDisplay
              topCard={WILD_CARD}
              size="lg"
              interactiveLabel="may-i"
              onClick={() => alert("May I? clicked!")}
            />
            <p className="text-xs text-muted-foreground mt-2">Large</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          For other player's turn - tap to request "May I?".
        </p>
      </section>

      {/* Responsive */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Responsive Comparison</h2>
        <p className="text-sm text-muted-foreground mb-4">
          How the discard pile adapts to different container widths.
        </p>
        <ViewportComparison>
          <div className="flex justify-center p-4">
            <DiscardPileDisplay
              topCard={FACE_CARD}
              size="md"
              interactiveLabel="pickup"
              onClick={() => alert("Pickup!")}
            />
          </div>
        </ViewportComparison>
      </section>
    </div>
  );
}
