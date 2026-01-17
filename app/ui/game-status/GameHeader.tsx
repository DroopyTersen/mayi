import { useState } from "react";
import { Link } from "react-router";
import { HelpCircle } from "lucide-react";
import { cn } from "~/shadcn/lib/utils";
import { Button } from "~/shadcn/components/ui/button";
import { HouseRulesDrawer } from "~/ui/house-rules/HouseRulesDrawer";

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
  const [rulesOpen, setRulesOpen] = useState(false);

  return (
    <header
      className={cn(
        "flex flex-col items-center py-2 px-4 relative",
        "bg-muted/50 border-b",
        className
      )}
    >
      {/* Help icon - positioned in top right */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
        onClick={() => setRulesOpen(true)}
      >
        <HelpCircle className="h-5 w-5" />
        <span className="sr-only">View house rules</span>
      </Button>
      <HouseRulesDrawer open={rulesOpen} onOpenChange={setRulesOpen} />

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
