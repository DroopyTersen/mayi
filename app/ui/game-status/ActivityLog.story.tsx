import { ActivityLog } from "./ActivityLog";
import { ViewportComparison } from "~/storybook/ViewportSimulator";

const SAMPLE_ENTRIES = [
  { id: "1", message: "Game started", timestamp: "2:30 PM" },
  { id: "2", message: "Alice drew from stock", timestamp: "2:31 PM" },
  { id: "3", message: "Alice discarded 7♠", timestamp: "2:31 PM" },
  { id: "4", message: "Bob requested May I?", timestamp: "2:31 PM" },
  { id: "5", message: "Bob picked up 7♠ + penalty card", timestamp: "2:32 PM" },
  { id: "6", message: "Charlie drew from stock", timestamp: "2:32 PM" },
  { id: "7", message: "Charlie laid down: Set of 9s, Run 5-6-7-8♠", timestamp: "2:33 PM" },
  { id: "8", message: "Charlie discarded K♥", timestamp: "2:33 PM" },
];

const ENTRIES_NO_TIMESTAMPS = [
  { id: "1", message: "Alice drew from stock" },
  { id: "2", message: "Alice discarded 7♠" },
  { id: "3", message: "Bob picked up 7♠" },
  { id: "4", message: "Bob laid down: Set of Kings" },
];

export function ActivityLogStory() {
  return (
    <div className="space-y-10 max-w-md">
      <header>
        <h1 className="text-2xl font-bold">ActivityLog</h1>
        <p className="text-muted-foreground mt-1">
          Recent game activity list showing last few moves.
        </p>
      </header>

      {/* Default */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Default (Last 6)</h2>
        <div className="border rounded-lg p-3">
          <ActivityLog entries={SAMPLE_ENTRIES} />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Shows last 6 entries by default.
        </p>
      </section>

      {/* With Timestamps */}
      <section>
        <h2 className="text-lg font-semibold mb-3">With Timestamps</h2>
        <div className="border rounded-lg p-3">
          <ActivityLog entries={SAMPLE_ENTRIES.slice(0, 4)} />
        </div>
      </section>

      {/* Without Timestamps */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Without Timestamps</h2>
        <div className="border rounded-lg p-3">
          <ActivityLog entries={ENTRIES_NO_TIMESTAMPS} />
        </div>
      </section>

      {/* Empty */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Empty</h2>
        <div className="border rounded-lg p-3">
          <ActivityLog entries={[]} />
        </div>
      </section>

      {/* Custom Max Entries */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Custom Max (3 entries)</h2>
        <div className="border rounded-lg p-3">
          <ActivityLog entries={SAMPLE_ENTRIES} maxEntries={3} />
        </div>
      </section>

      {/* Responsive */}
      <section className="max-w-none">
        <h2 className="text-lg font-semibold mb-3">Responsive Comparison</h2>
        <p className="text-sm text-muted-foreground mb-4">
          How the activity log adapts to different container widths.
        </p>
        <ViewportComparison>
          <div className="border rounded-lg p-3">
            <ActivityLog entries={SAMPLE_ENTRIES} />
          </div>
        </ViewportComparison>
      </section>
    </div>
  );
}
