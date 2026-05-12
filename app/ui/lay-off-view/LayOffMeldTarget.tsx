import type { KeyboardEvent, ReactNode } from "react";
import { Plus } from "lucide-react";
import { cn } from "~/shadcn/lib/utils";

interface LayOffTargetFrameProps {
  isActive: boolean;
  ariaLabel: string;
  children: ReactNode;
  onClick: () => void;
  onKeyActivate?: () => void;
  className: string;
  testId?: string;
  showAriaDisabled?: boolean;
}

interface LayOffMeldTargetProps {
  isActive: boolean;
  ariaLabel: string;
  children: ReactNode;
  onClick: () => void;
  onKeyActivate: () => void;
}

export function LayOffTargetFrame({
  isActive,
  ariaLabel,
  children,
  onClick,
  onKeyActivate = onClick,
  className,
  testId,
  showAriaDisabled = false,
}: LayOffTargetFrameProps) {
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
      aria-disabled={showAriaDisabled ? !isActive : undefined}
      aria-label={ariaLabel}
      data-testid={testId}
      className={className}
      onClick={onClick}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
}

export function LayOffMeldTarget({
  isActive,
  ariaLabel,
  children,
  onClick,
  onKeyActivate,
}: LayOffMeldTargetProps) {
  return (
    <LayOffTargetFrame
      isActive={isActive}
      ariaLabel={ariaLabel}
      onClick={onClick}
      onKeyActivate={onKeyActivate}
      showAriaDisabled
      className={cn(
        "p-1.5 rounded-md border transition-colors",
        isActive
          ? "border-primary/50 hover:border-primary hover:bg-primary/5 cursor-pointer"
          : "border-transparent"
      )}
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
    </LayOffTargetFrame>
  );
}
