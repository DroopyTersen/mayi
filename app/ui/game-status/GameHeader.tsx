import { Link } from "react-router";
import { cn } from "~/shadcn/lib/utils";

interface Contract {
  sets: number;
  runs: number;
}

interface GameHeaderProps {
  round?: number;
  totalRounds?: number;
  contract?: Contract;
  /** Turn status text - shown on mobile below the main header info */
  turnStatus?: string;
  /** Whether it's the viewing player's turn - affects turn status styling */
  isYourTurn?: boolean;
  className?: string;
}

function formatContract(contract: Contract): string {
  const parts: string[] = [];
  if (contract.sets > 0) {
    parts.push(`${contract.sets} set${contract.sets > 1 ? "s" : ""}`);
  }
  if (contract.runs > 0) {
    parts.push(`${contract.runs} run${contract.runs > 1 ? "s" : ""}`);
  }
  return parts.join(" + ");
}

export function GameHeader({
  round,
  totalRounds,
  contract,
  turnStatus,
  isYourTurn,
  className,
}: GameHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col items-center py-2 px-4",
        "bg-muted/50 border-b",
        className
      )}
    >
      {/* Main header row */}
      <div className="flex items-center justify-center gap-3">
        <Link
          to="/"
          className="font-bold text-lg tracking-wide hover:text-primary transition-colors"
        >
          MAY I?
        </Link>
        {round != null && totalRounds != null && contract && (
          <>
            <span className="text-muted-foreground">—</span>
            <span className="text-sm">
              Round {round} of {totalRounds}
            </span>
            <span className="text-muted-foreground">—</span>
            <span className="text-sm font-medium">{formatContract(contract)}</span>
          </>
        )}
      </div>

      {/* Turn status row - shown on mobile */}
      {turnStatus && (
        <div
          className={cn(
            "text-sm mt-1",
            isYourTurn ? "text-primary font-medium" : "text-muted-foreground"
          )}
        >
          {turnStatus}
        </div>
      )}
    </header>
  );
}
