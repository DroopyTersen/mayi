import type { ReactNode } from "react";
import { cn } from "~/shadcn/lib/utils";
import { LayOffTargetFrame } from "~/ui/lay-off-view/LayOffMeldTarget";

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

  return (
    <LayOffTargetFrame
      isActive
      ariaLabel={label}
      onClick={onSelect}
      testId={testId}
      className={cn(
        "inline-block -m-1.5 rounded-md border border-dashed border-muted-foreground/30 p-1.5",
        "cursor-pointer bg-background/50 transition-[background-color,border-color,box-shadow]",
        "hover:border-muted-foreground/60 hover:bg-muted/40 focus-visible:outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isPending && "border-solid border-blue-500 bg-blue-50 shadow-sm"
      )}
    >
      {children}
    </LayOffTargetFrame>
  );
}
