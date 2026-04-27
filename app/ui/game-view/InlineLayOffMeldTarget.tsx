import type { KeyboardEvent, ReactNode } from "react";
import { cn } from "~/shadcn/lib/utils";

interface InlineLayOffMeldTargetProps {
  enabled: boolean;
  label: string;
  isPending: boolean;
  onSelect: () => void;
  children: ReactNode;
  testId?: string;
}

export function InlineLayOffMeldTarget({
  enabled,
  label,
  isPending,
  onSelect,
  children,
  testId,
}: InlineLayOffMeldTargetProps) {
  if (!enabled) {
    return <>{children}</>;
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    onSelect();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      data-testid={testId}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      className={cn(
        "inline-block -m-1.5 rounded-md border border-dashed border-muted-foreground/30 p-1.5",
        "cursor-pointer bg-background/50 transition-[background-color,border-color,box-shadow]",
        "hover:border-muted-foreground/60 hover:bg-muted/40 focus-visible:outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isPending && "border-solid border-blue-500 bg-blue-50 shadow-sm"
      )}
    >
      {children}
    </div>
  );
}
