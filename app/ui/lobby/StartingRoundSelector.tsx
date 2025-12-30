import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/shadcn/components/ui/select";
import { Label } from "~/shadcn/components/ui/label";
import type { RoundNumber } from "../../../core/engine/engine.types";
import { cn } from "~/shadcn/lib/utils";

/**
 * Contract descriptions for each round
 */
const ROUND_CONTRACTS: Record<RoundNumber, string> = {
  1: "2 sets",
  2: "1 set + 1 run",
  3: "2 runs",
  4: "3 sets",
  5: "2 sets + 1 run",
  6: "1 set + 2 runs",
};

interface StartingRoundSelectorProps {
  value: RoundNumber;
  onChange: (round: RoundNumber) => void;
  disabled?: boolean;
  className?: string;
}

export function StartingRoundSelector({
  value,
  onChange,
  disabled,
  className,
}: StartingRoundSelectorProps) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor="starting-round">Starting Round</Label>
      <Select
        value={value.toString()}
        onValueChange={(v) => onChange(parseInt(v, 10) as RoundNumber)}
        disabled={disabled}
      >
        <SelectTrigger id="starting-round" className="w-full">
          <SelectValue placeholder="Select starting round" />
        </SelectTrigger>
        <SelectContent>
          {([1, 2, 3, 4, 5, 6] as RoundNumber[]).map((round) => (
            <SelectItem key={round} value={round.toString()}>
              <span className="flex items-center gap-2">
                <span className="font-medium">Round {round}</span>
                <span className="text-muted-foreground">
                  — {ROUND_CONTRACTS[round]}
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Contract: {ROUND_CONTRACTS[value]}
      </p>
    </div>
  );
}

/**
 * Export contract descriptions for use in other components
 */
export { ROUND_CONTRACTS };
