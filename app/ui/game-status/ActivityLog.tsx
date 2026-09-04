import { cn } from "~/shadcn/lib/utils";

interface LogEntry {
  id: string;
  message: string;
  timestamp?: string;
}

interface ActivityLogProps {
  entries: LogEntry[];
  /** Recent entries shown immediately; older activity remains expandable. */
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
  const earlierEntries = entries
    .slice(0, Math.max(0, entries.length - maxEntries))
    .reverse();

  if (displayEntries.length === 0) {
    return (
      <div className={cn("text-sm text-muted-foreground italic", className)}>
        No activity yet
      </div>
    );
  }

  return (
    <div className={cn("space-y-1", className)}>
      {displayEntries.map((entry, index) => (
        <ActivityLogRow key={entry.id} entry={entry} isLatest={index === 0} />
      ))}
      {earlierEntries.length > 0 && (
        <details className="pt-2">
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
            Earlier activity ({earlierEntries.length})
          </summary>
          <div
            className="mt-2 max-h-64 overflow-y-auto overscroll-contain space-y-1 pr-2"
            role="region"
            aria-label="Earlier activity this hand"
            tabIndex={0}
          >
            {earlierEntries.map((entry) => (
              <ActivityLogRow key={entry.id} entry={entry} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function ActivityLogRow({
  entry,
  isLatest = false,
}: {
  entry: LogEntry;
  isLatest?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2 text-sm">
      {entry.timestamp && (
        <span className="text-xs text-muted-foreground shrink-0 tabular-nums w-14 text-right">
          {entry.timestamp}
        </span>
      )}
      <span
        className={cn(
          isLatest ? "text-foreground font-medium" : "text-muted-foreground",
        )}
      >
        {entry.message}
      </span>
    </div>
  );
}
