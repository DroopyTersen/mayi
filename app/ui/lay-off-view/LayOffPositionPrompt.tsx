import { Button } from "~/shadcn/components/ui/button";
import { cn } from "~/shadcn/lib/utils";

interface LayOffPositionPromptProps {
  onSelect: (position: "start" | "end") => void;
  onCancel: () => void;
  className?: string;
}

export function LayOffPositionPrompt({
  onSelect,
  onCancel,
  className,
}: LayOffPositionPromptProps) {
  return (
    <div
      className={cn(
        "p-3 rounded-lg border border-primary bg-primary/5",
        className
      )}
    >
      <p className="text-sm text-center mb-2">
        Where should this wild card go?
      </p>
      <div className="flex justify-center gap-2">
        <Button variant="outline" size="sm" onClick={() => onSelect("start")}>
          Start
        </Button>
        <Button variant="outline" size="sm" onClick={() => onSelect("end")}>
          End
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
