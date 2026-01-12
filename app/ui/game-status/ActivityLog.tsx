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
  const displayEntries = entries.slice(-maxEntries).toReversed();

  if (displayEntries.length === 0) {
    return (
      <div className={cn("text-sm text-muted-foreground italic", className)}>
        No activity yet
      </div>
    );
  }

  return (
    <div className={cn("space-y-1", className)}>
      {displayEntries.map((entry) => (
        <div
          key={entry.id}
          className="flex items-baseline gap-2 text-sm"
        >
          {entry.timestamp && (
            <span className="text-xs text-muted-foreground shrink-0 tabular-nums w-14 text-right">
              {entry.timestamp}
            </span>
          )}
          <span className="text-foreground">{entry.message}</span>
        </div>
      ))}
    </div>
  );
}
