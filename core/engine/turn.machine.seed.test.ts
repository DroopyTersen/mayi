import { describe, expect, it } from "bun:test";
import { createActor } from "xstate";
import type { Card } from "../card/card.types";
import { turnMachine, type TurnInput } from "./turn.machine";

function recyclingInput(seed?: string): TurnInput & { seed?: string } {
  const discard: Card[] = ["3", "4", "5", "6", "7", "8", "9", "10"].map(
    (rank, index) => ({ id: `discard-${index}`, rank: rank as Card["rank"], suit: "clubs" }),
  );
  return {
    playerId: "player-1",
    hand: [{ id: "held", rank: "K", suit: "hearts" }],
    stock: [{ id: "last-stock", rank: "A", suit: "spades" }],
    discard,
    roundNumber: 1,
    isDown: false,
    table: [],
    seed,
  };
}

describe("turn stock-recycling seeds", () => {
  it("preserves the seed and repeats the same shuffle without changing card ownership", () => {
    const input = recyclingInput("recycle-test");
    let expectedStock: Card[] | undefined;
    for (let replay = 0; replay < 8; replay++) {
      const actor = createActor(turnMachine, { input }).start();
      try {
        expect(actor.getSnapshot().context.seed).toBe(input.seed);
        actor.send({ type: "DRAW_FROM_STOCK" });
        const { hand, stock, discard } = actor.getSnapshot().context;
        expect(hand).toEqual([...input.hand, ...input.stock]);
        expect(discard).toEqual(input.discard.slice(0, 1));
        expect(stock.map((card) => card.id).sort()).toEqual(
          input.discard.slice(1).map((card) => card.id).sort(),
        );
        if (expectedStock) expect(stock).toEqual(expectedStock);
        else expectedStock = stock;
      } finally {
        actor.stop();
      }
    }
  });

  it("resumes a serialized seeded turn with the same recycling order", () => {
    const input = recyclingInput("persisted-recycle-test");
    const original = createActor(turnMachine, { input }).start();
    const saved = JSON.parse(JSON.stringify(original.getPersistedSnapshot()));
    const restored = createActor(turnMachine, { input, snapshot: saved }).start();
    try {
      expect(restored.getSnapshot().context.seed).toBe(input.seed);
      original.send({ type: "DRAW_FROM_STOCK" });
      restored.send({ type: "DRAW_FROM_STOCK" });
      expect(restored.getSnapshot().context).toEqual(original.getSnapshot().context);
    } finally {
      original.stop();
      restored.stop();
    }
  });

  it("uses the seed rather than a fixed recycling order", () => {
    const orders = new Set<string>();
    for (let index = 0; index < 8; index++) {
      const actor = createActor(turnMachine, { input: recyclingInput(`seed-${index}`) }).start();
      try {
        actor.send({ type: "DRAW_FROM_STOCK" });
        orders.add(actor.getSnapshot().context.stock.map((card) => card.id).join(","));
      } finally {
        actor.stop();
      }
    }
    expect(orders.size).toBeGreaterThan(1);
  });

  it("supports legacy serialized turns without a seed", () => {
    const input = recyclingInput();
    const original = createActor(turnMachine, { input }).start();
    const saved = JSON.parse(JSON.stringify(original.getPersistedSnapshot()));
    delete saved.context.seed;
    original.stop();
    const restored = createActor(turnMachine, { input, snapshot: saved }).start();
    try {
      restored.send({ type: "DRAW_FROM_STOCK" });
      const { hand, stock, discard, hasDrawn } = restored.getSnapshot().context;
      expect(hasDrawn).toBe(true);
      expect(hand).toEqual([...input.hand, ...input.stock]);
      expect(discard).toEqual(input.discard.slice(0, 1));
      expect(stock.map((card) => card.id).sort()).toEqual(
        input.discard.slice(1).map((card) => card.id).sort(),
      );
    } finally {
      restored.stop();
    }
  });
});
