import type { KeyboardEvent, ReactNode } from "react";
import { Plus } from "lucide-react";
import { cn } from "~/shadcn/lib/utils";

interface LayOffMeldTargetProps {
  isActive: boolean;
  ariaLabel: string;
  children: ReactNode;
  onClick: () => void;
  onKeyActivate: () => void;
}

export function LayOffMeldTarget({
  isActive,
  ariaLabel,
  children,
  onClick,
  onKeyActivate,
}: LayOffMeldTargetProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!isActive) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onKeyActivate();
    }
  };

  return (
    <div
      role="button"
      tabIndex={isActive ? 0 : -1}
      aria-disabled={!isActive}
      aria-label={ariaLabel}
      className={cn(
        "p-1.5 rounded-md border transition-colors",
        isActive
          ? "border-primary/50 hover:border-primary hover:bg-primary/5 cursor-pointer"
          : "border-transparent"
      )}
      onClick={onClick}
      onKeyDown={handleKeyDown}
    >
      {children}
      {isActive && (
        <div
          data-testid="layoff-add-target"
          title="Add selected card here"
          className="mt-2 flex h-8 items-center justify-center rounded-md border border-dashed border-primary/60 bg-primary/10 text-primary"
          aria-hidden="true"
        >
          <Plus className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}
