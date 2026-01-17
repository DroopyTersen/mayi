import { Trophy } from "lucide-react";
import { cn } from "~/shadcn/lib/utils";

interface WinnerBannerProps {
  winnerName: string;
  isYou: boolean;
  roundNumber: number;
  className?: string;
}

export function WinnerBanner({
  winnerName,
  isYou,
  roundNumber,
  className,
}: WinnerBannerProps) {
  return (
    <div className={cn("text-center space-y-3", className)}>
      {/* Trophy icon */}
      <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
        <Trophy className="w-7 h-7 text-primary" />
      </div>

      {/* Round complete title */}
      <h2 className="text-xl font-semibold">Round {roundNumber} Complete!</h2>

      {/* Winner announcement */}
      <p className="text-lg text-muted-foreground">
        {isYou ? (
          <span className="text-primary font-semibold">
            You went out!
          </span>
        ) : (
          <>
            <span className="font-semibold">{winnerName}</span> went out!
          </>
        )}
      </p>
    </div>
  );
}
