import { WinnerBanner } from "./WinnerBanner";

export function WinnerBannerStory() {
  return (
    <div className="space-y-8 p-4">
      <h2 className="text-lg font-semibold">WinnerBanner</h2>

      <div className="space-y-6">
        {/* You won */}
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground mb-4">You went out (winner is you)</p>
          <WinnerBanner
            winnerName="Alice"
            isYou={true}
            roundNumber={3}
          />
        </div>

        {/* Someone else won */}
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground mb-4">Someone else went out</p>
          <WinnerBanner
            winnerName="Bob"
            isYou={false}
            roundNumber={1}
          />
        </div>

        {/* Final round */}
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground mb-4">Final round (Round 6)</p>
          <WinnerBanner
            winnerName="Charlie"
            isYou={false}
            roundNumber={6}
          />
        </div>
      </div>
    </div>
  );
}

export const meta = {
  title: "WinnerBanner",
  component: WinnerBanner,
};
