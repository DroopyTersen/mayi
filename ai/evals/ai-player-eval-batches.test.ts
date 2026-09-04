import { describe, expect, it } from "bun:test";
import { runAIPlayerEvalBatches } from "./ai-player-eval-batches";

describe("bounded evaluation batches", () => {
  it("runs independent jobs concurrently within the limit and preserves result order", async () => {
    let active = 0;
    let peak = 0;
    const results = await runAIPlayerEvalBatches(
      [1, 2, 3, 4, 5],
      2,
      async (value) => {
        active++;
        peak = Math.max(peak, active);
        await Promise.resolve();
        await Promise.resolve();
        active--;
        return value * value;
      },
    );
    expect(results).toEqual([1, 4, 9, 16, 25]);
    expect(peak).toBe(2);
    expect(active).toBe(0);
  });

  it("rejects invalid limits even for an empty suite", async () => {
    for (const limit of [0, -1, 1.5]) {
      await expect(
        runAIPlayerEvalBatches([], limit, async () => 1),
      ).rejects.toThrow("Concurrency");
    }
  });

  it("drains the active batch before reporting a failed job and starts no later batch", async () => {
    const started: number[] = [];
    const finished: number[] = [];
    await expect(
      runAIPlayerEvalBatches([1, 2, 3], 2, async (value) => {
        started.push(value);
        if (value === 1) throw new Error("failed job");
        await Promise.resolve();
        await Promise.resolve();
        finished.push(value);
        return value;
      }),
    ).rejects.toThrow("failed job");
    expect(started).toEqual([1, 2]);
    expect(finished).toEqual([2]);
  });
});
