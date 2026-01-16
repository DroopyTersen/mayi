import { Info } from "lucide-react";
import { Button } from "~/shadcn/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/shadcn/components/ui/popover";
import type { UnavailabilityHint } from "core/engine/game-engine.hints";

interface ActionInfoButtonProps {
  /** Array of hints explaining why actions are unavailable */
  hints: UnavailabilityHint[];
  /** Optional class name for the button */
  className?: string;
}

/**
 * Info button that reveals unavailability hints in a popover.
 *
 * Shows a small info icon (ⓘ) that, when clicked, displays a list of
 * unavailable actions and why they're currently blocked.
 *
 * Only renders if there are hints to show.
 */
export function ActionInfoButton({ hints, className }: ActionInfoButtonProps) {
  // Don't render if no hints
  if (hints.length === 0) {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={className}
          aria-label="Show unavailable actions info"
        >
          <Info className="h-4 w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="end">
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Unavailable this turn</h4>
          <ul className="space-y-1 text-sm">
            {hints.map((hint, index) => (
              <li key={index} className="flex flex-col">
                <span className="font-medium">{hint.action}</span>
                <span className="text-muted-foreground text-xs">
                  {hint.reason}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </PopoverContent>
    </Popover>
  );
}
