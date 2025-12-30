import { cn } from "~/shadcn/lib/utils";

interface Contract {
  sets: number;
  runs: number;
}

interface GameHeaderProps {
  round: number;
  totalRounds: number;
  contract: Contract;
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
  className,
}: GameHeaderProps) {
  return (
    <header
      className={cn(
        "flex items-center justify-center gap-3 py-2 px-4",
        "bg-muted/50 border-b",
        className
      )}
    >
      <span className="font-bold text-lg tracking-wide">MAY I?</span>
      <span className="text-muted-foreground">—</span>
      <span className="text-sm">
        Round {round} of {totalRounds}
      </span>
      <span className="text-muted-foreground">—</span>
      <span className="text-sm font-medium">{formatContract(contract)}</span>
    </header>
  );
}
