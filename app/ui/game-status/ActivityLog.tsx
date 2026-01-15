import { cn } from "~/shadcn/lib/utils";

interface LogEntry {
  id: string;
  message: string;
  timestamp?: string;
}

interface ActivityLogProps {
  entries: LogEntry[];
  maxEntries?: number;
  className?: string;
}

export function ActivityLog({
  entries,
  maxEntries = 6,
  className,
}: ActivityLogProps) {
  // Get most recent entries and reverse for display (newest at top)
  // Using slice().reverse() instead of toReversed() for broader browser compatibility
  const displayEntries = entries.slice(-maxEntries).slice().reverse();

  if (displayEntries.length === 0) {
    return (
      <div className={cn("text-sm text-muted-foreground italic", className)}>
        No activity yet
      </div>
    );
  }

  return (
    <div className={cn("space-y-1", className)}>
      {displayEntries.map((entry, index) => {
        const isLatest = index === 0;
        return (
          <div
            key={entry.id}
            className="flex items-baseline gap-2 text-sm"
          >
            {entry.timestamp && (
              <span className="text-xs text-muted-foreground shrink-0 tabular-nums w-14 text-right">
                {entry.timestamp}
              </span>
            )}
            <span
              className={cn(
                isLatest
                  ? "text-foreground font-medium"
                  : "text-muted-foreground"
              )}
            >
              {entry.message}
            </span>
          </div>
        );
      })}
    </div>
  );
}
