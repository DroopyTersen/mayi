import { describe, it, expect } from "bun:test";
import { createActor } from "xstate";
import { roundMachine } from "./round.machine";
import type { RoundInput, PredefinedRoundState } from "./round.machine";
import type { Player } from "./engine.types";
import type { Card } from "../card/card.types";

function createTestPlayers(count: number): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `player-${i}`,
    name: `Player ${i + 1}`,
    hand: [],
    isDown: false,
    totalScore: 0,
  }));
}

function card(rank: Card["rank"], suit: Card["suit"], id: string): Card {
  return { id, rank, suit };
}

function joker(id: string): Card {
  return { id, rank: "Joker", suit: null };
}

describe("House Rules (docs/house-rules.md)", () => {
  it("HR-2: scoring uses 2=20, Joker=50, A=15, J/Q/K=10, 3-10 face value", () => {
    const predefinedState: PredefinedRoundState = {
      hands: [
        [card("2", "hearts", "p0-2-H")], // 20 pts
        [], // current player will go out
        [joker("p2-joker"), card("A", "spades", "p2-A-S"), card("K", "clubs", "p2-K-C")], // 50+15+10
      ],
      stock: [card("3", "hearts", "stock-draw-3-H")],
      discard: [card("4", "diamonds", "discard-top-4-D")],
    };

    const input: RoundInput = {
      roundNumber: 1,
      players: createTestPlayers(3),
      dealerIndex: 0, // current player = player-1
      predefinedState,
    };

    const actor = createActor(roundMachine, { input });
    actor.start();

    // Player 1 (current) draws 1 card, then discards it to go out.
    actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-1" });
    actor.send({ type: "SKIP_LAY_DOWN" });
    actor.send({ type: "DISCARD", cardId: "stock-draw-3-H" });

    expect(actor.getSnapshot().status).toBe("done");
    const output = actor.getSnapshot().output;
    expect(output?.roundRecord.winnerId).toBe("player-1");
    expect(output?.roundRecord.scores["player-1"]).toBe(0);
    expect(output?.roundRecord.scores["player-0"]).toBe(20);
    expect(output?.roundRecord.scores["player-2"]).toBe(75);
  });

  it("HR-11: reshuffle preserves exposed discard (top discard stays)", () => {
    const predefinedState: PredefinedRoundState = {
      hands: [[], [], []],
      stock: [], // forces reshuffle
      discard: [
        card("9", "clubs", "discard-top-9-C"),
        card("10", "spades", "discard-10-S"),
        card("J", "hearts", "discard-J-H"),
      ],
    };

    const input: RoundInput = {
      roundNumber: 1,
      players: createTestPlayers(3),
      dealerIndex: 0,
      predefinedState,
    };

    const actor = createActor(roundMachine, { input });
    actor.start();

    expect(actor.getSnapshot().context.stock.length).toBe(0);
    expect(actor.getSnapshot().context.discard.map((c) => c.id)).toEqual([
      "discard-top-9-C",
      "discard-10-S",
      "discard-J-H",
    ]);

    actor.send({ type: "RESHUFFLE_STOCK" });

    const ctx = actor.getSnapshot().context;
    expect(ctx.discard).toHaveLength(1);
    expect(ctx.discard[0]!.id).toBe("discard-top-9-C");
    expect(ctx.stock).toHaveLength(2);
    expect(new Set(ctx.stock.map((c) => c.id))).toEqual(new Set(["discard-10-S", "discard-J-H"]));
  });
});

