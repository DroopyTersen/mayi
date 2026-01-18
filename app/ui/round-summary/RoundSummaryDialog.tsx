import { useEffect, useState } from "react";
import type { Card } from "core/card/card.types";
import type { Meld } from "core/meld/meld.types";
import { Card as CardUI, CardContent, CardHeader } from "~/shadcn/components/ui/card";
import { TableDisplay } from "~/ui/game-table/TableDisplay";
import { WinnerBanner } from "./WinnerBanner";
import { ScoreBreakdown } from "./ScoreBreakdown";
import { RemainingHandsDisplay } from "./RemainingHandsDisplay";
import { cn } from "~/shadcn/lib/utils";

interface Player {
  id: string;
  name: string;
  avatarId?: string;
}

interface RoundSummaryDialogProps {
  /** Round number that just ended */
  roundNumber: number;
  /** Lobby ID of the player who went out */
  winnerId: string;
  /** All melds on the table at round end */
  tableMelds: Meld[];
  /** Map of lobby player IDs to their remaining cards */
  playerHands: Record<string, Card[]>;
  /** Map of lobby player IDs to their current total scores */
  scores: Record<string, number>;
  /** Map of lobby player IDs to their display names */
  playerNames: Record<string, string>;
  /** Map of lobby player IDs to their avatar IDs */
  playerAvatars: Record<string, string | undefined>;
  /** The viewing player's lobby ID */
  currentPlayerId: string;
  /** Duration of the countdown in seconds (default: 15) */
  countdownSeconds?: number;
  className?: string;
}

export function RoundSummaryDialog({
  roundNumber,
  winnerId,
  tableMelds,
  playerHands,
  scores,
  playerNames,
  playerAvatars,
  currentPlayerId,
  countdownSeconds = 15,
  className,
}: RoundSummaryDialogProps) {
  const [countdown, setCountdown] = useState(countdownSeconds);

  // Countdown timer - no callback, no manual dismiss
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, []); // Empty deps - runs once on mount

  const winnerName = playerNames[winnerId] ?? "Unknown";
  const isYouWinner = winnerId === currentPlayerId;

  // Build players array for TableDisplay
  const players: Player[] = Object.entries(playerNames).map(([id, name]) => ({
    id,
    name,
    avatarId: playerAvatars[id],
  }));

  // Check if there are any melds to display
  const hasMelds = tableMelds.length > 0;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm overflow-auto py-4",
        className
      )}
    >
      <CardUI className="w-full max-w-2xl mx-4 animate-in fade-in zoom-in duration-300 max-h-[90vh] overflow-auto">
        <CardHeader className="pb-2">
          <WinnerBanner
            winnerName={winnerName}
            isYou={isYouWinner}
            roundNumber={roundNumber}
          />
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Scores */}
          <ScoreBreakdown
            scores={scores}
            playerNames={playerNames}
            winnerId={winnerId}
            currentPlayerId={currentPlayerId}
          />

          {/* Table melds (if any) */}
          {hasMelds && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                Table Melds
              </h3>
              <div className="border rounded-lg p-3 bg-muted/30">
                <TableDisplay
                  melds={tableMelds}
                  players={players}
                  viewingPlayerId={currentPlayerId}
                />
              </div>
            </div>
          )}

          {/* Remaining cards */}
          <RemainingHandsDisplay
            playerHands={playerHands}
            playerNames={playerNames}
            winnerId={winnerId}
            currentPlayerId={currentPlayerId}
          />

          {/* Next round countdown */}
          <div className="text-center text-sm text-muted-foreground pt-2 border-t">
            {countdown > 0
              ? `Next round starting in ${countdown}...`
              : "Starting now..."}
          </div>
        </CardContent>
      </CardUI>
    </div>
  );
}
