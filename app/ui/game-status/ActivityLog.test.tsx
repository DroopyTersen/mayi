import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ActivityLog } from "./ActivityLog";

describe("ActivityLog history", () => {
  it("keeps six recent entries visible and exposes older entries in a scrollable disclosure", () => {
    const entries = Array.from({ length: 30 }, (_, index) => ({
      id: `event-${index}`,
      message: `Public event ${index}.`,
    }));
    const html = renderToStaticMarkup(
      <ActivityLog entries={entries} maxEntries={6} />,
    );
    expect(html).toContain("Public event 0.");
    expect(html).toContain("Public event 29.");
    expect(html).toContain("Earlier activity (24)");
    expect(html).toContain("<details");
    expect(html).not.toContain("<details open");
    expect(html).toContain("overflow-y-auto");
    expect(html.indexOf("Public event 29.")).toBeLessThan(
      html.indexOf("Public event 0."),
    );
    expect(entries[0]?.id).toBe("event-0");
  });

  it("does not show an empty older-history control", () => {
    const html = renderToStaticMarkup(
      <ActivityLog entries={[{ id: "one", message: "Alice discarded 8♦" }]} />,
    );
    expect(html).toContain("Alice discarded 8♦");
    expect(html).not.toContain("<details");
  });
});
