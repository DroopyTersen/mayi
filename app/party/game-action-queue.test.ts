import { describe, expect, it } from "bun:test";
import { GameActionQueue } from "./game-action-queue";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });
  return { promise, resolve, reject };
}

describe("GameActionQueue", () => {
  it("runs tasks in enqueue order and waits for async completion", async () => {
    const queue = new GameActionQueue();
    const firstGate = deferred<void>();
    const order: string[] = [];

    const first = queue.enqueue(async () => {
      order.push("first:start");
      await firstGate.promise;
      order.push("first:end");
      return "first";
    });

    const second = queue.enqueue(async () => {
      order.push("second");
      return "second";
    });

    await Promise.resolve();
    expect(order).toEqual(["first:start"]);

    firstGate.resolve();

    await expect(first).resolves.toBe("first");
    await expect(second).resolves.toBe("second");
    expect(order).toEqual(["first:start", "first:end", "second"]);
  });

  it("continues running later tasks after an earlier task fails", async () => {
    const queue = new GameActionQueue();
    const order: string[] = [];

    const first = queue.enqueue(async () => {
      order.push("first");
      throw new Error("expected failure");
    });

    const second = queue.enqueue(async () => {
      order.push("second");
      return "second";
    });

    await expect(first).rejects.toThrow("expected failure");
    await expect(second).resolves.toBe("second");
    expect(order).toEqual(["first", "second"]);
  });
});
