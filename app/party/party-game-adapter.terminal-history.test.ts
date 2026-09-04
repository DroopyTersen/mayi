import { describe, expect, it } from "bun:test";
import type { Card } from "../../core/card/card.types";
import type { AgentTestState } from "./agent-state.types";
import { convertAgentTestStateToStoredState } from "./agent-state.converter";
import { PartyGameAdapter } from "./party-game-adapter";
import { executeGameAction } from "./game-actions";

const card = (id: string, rank: Card["rank"], suit: Card["suit"]): Card => ({
  id,
  rank,
  suit,
});

function createAdapter(overrides: Partial<AgentTestState> = {}) {
  return PartyGameAdapter.fromStoredState(
    convertAgentTestStateToStoredState(
      {
        players: [
          {
            id: "alice",
            name: "Alice",
            isAI: false,
            isDown: false,
            hand: [card("ah", "A", "hearts")],
          },
          {
            id: "bob",
            name: "Bob",
            isAI: false,
            isDown: false,
            hand: [card("kh", "K", "hearts")],
          },
          {
            id: "carol",
            name: "Carol",
            isAI: false,
            isDown: false,
            hand: [card("kd", "K", "diamonds")],
          },
          {
            id: "dave",
            name: "Dave",
            isAI: false,
            isDown: false,
            hand: [card("ks", "K", "spades")],
          },
        ],
        roundNumber: 2,
        stock: [card("qc", "Q", "clubs"), card("jc", "J", "clubs")],
        discard: [card("10c", "10", "clubs")],
        table: [],
        turn: {
          currentPlayerIndex: 0,
          hasDrawn: true,
          phase: "awaitingAction",
        },
        ...overrides,
      },
      "terminal-history",
    ),
  );
}

describe("public terminal action history", () => {
  it("records the last-card layoff before the next hand replaces the table", () => {
    const adapter = createAdapter({
      players: [
        {
          id: "alice",
          name: "Alice",
          isAI: false,
          isDown: true,
          hand: [card("8s", "8", "spades")],
        },
        {
          id: "bob",
          name: "Bob",
          isAI: false,
          isDown: true,
          hand: [card("kh", "K", "hearts")],
        },
        {
          id: "carol",
          name: "Carol",
          isAI: false,
          isDown: false,
          hand: [card("kd", "K", "diamonds")],
        },
      ],
      table: [
        {
          id: "run",
          ownerId: "bob",
          type: "run",
          cards: [
            card("4s", "4", "spades"),
            card("5s", "5", "spades"),
            card("6s", "6", "spades"),
            card("7s", "7", "spades"),
          ],
        },
      ],
    });
    try {
      const result = executeGameAction(adapter, "alice", {
        type: "LAY_OFF",
        cardId: "8s",
        meldId: "run",
      });
      expect(result.success).toBe(true);
      expect(adapter.getSnapshot().currentRound).toBe(3);
      const entries = adapter
        .getStoredState()
        .activityLog.filter((e) => e.playerId === "alice");
      expect(entries.map((e) => e.action)).toEqual(["laid off", "went out!"]);
      expect(entries[0]?.details).toBe("8♠");
      expect(entries.every((e) => e.roundNumber === 2)).toBe(true);
      expect(adapter.getCurrentRoundActivityLog()).toEqual([]);
    } finally {
      adapter.stop();
    }
  });

  it("records all public winning Hand6 melds after the engine clears the table", () => {
    const set = [
      card("7h1", "7", "hearts"),
      card("7d", "7", "diamonds"),
      card("7c", "7", "clubs"),
      card("7h2", "7", "hearts"),
    ];
    const run1 = [
      card("4s", "4", "spades"),
      card("5s", "5", "spades"),
      card("6s", "6", "spades"),
      card("7s", "7", "spades"),
    ];
    const run2 = [
      card("9d", "9", "diamonds"),
      card("10d", "10", "diamonds"),
      card("jd", "J", "diamonds"),
      card("qd", "Q", "diamonds"),
    ];
    const adapter = createAdapter({
      roundNumber: 6,
      players: [
        {
          id: "alice",
          name: "Alice",
          isAI: false,
          isDown: false,
          hand: [...set, ...run1, ...run2],
        },
        {
          id: "bob",
          name: "Bob",
          isAI: false,
          isDown: false,
          hand: [card("kh", "K", "hearts")],
        },
        {
          id: "carol",
          name: "Carol",
          isAI: false,
          isDown: false,
          hand: [card("kd", "K", "diamonds")],
        },
      ],
    });
    try {
      const result = executeGameAction(adapter, "alice", {
        type: "LAY_DOWN",
        melds: [
          { type: "set", cardIds: set.map((c) => c.id) },
          { type: "run", cardIds: run1.map((c) => c.id) },
          { type: "run", cardIds: run2.map((c) => c.id) },
        ],
      });
      expect(result.success).toBe(true);
      expect(adapter.getSnapshot().phase).toBe("GAME_END");
      const entries = adapter.getCurrentRoundActivityLog();
      expect(entries.map((e) => e.action)).toEqual([
        "laid down contract",
        "went out!",
      ]);
      expect(entries[0]?.details).toContain("7♥ 7♦ 7♣ 7♥");
      expect(entries[0]?.details).toContain("9♦ 10♦ J♦ Q♦");
      expect(entries.every((e) => e.roundNumber === 6)).toBe(true);
    } finally {
      adapter.stop();
    }
  });

  it("records actual ownership when a May I resolves without a prompt", () => {
    const adapter = createAdapter();
    try {
      expect(
        executeGameAction(adapter, "bob", { type: "CALL_MAY_I" }).success,
      ).toBe(true);
      expect(
        adapter.getSnapshot().players[1]?.hand.some((c) => c.id === "10c"),
      ).toBe(true);
      const entries = adapter.getCurrentRoundActivityLog();
      expect(entries.map((e) => [e.playerId, e.action, e.details])).toEqual([
        ["bob", "called May I", "10♣"],
        ["bob", "took the May I card", "10♣"],
      ]);
      expect(JSON.stringify(entries)).not.toContain("Q♣");
    } finally {
      adapter.stop();
    }
  });

  for (const decision of [
    "CALL_MAY_I",
    "ALLOW_MAY_I",
    "CLAIM_MAY_I",
  ] as const) {
    it(`does not invent a next-hand pickup when ${decision} exhausts stock`, () => {
      const adapter = createAdapter({ stock: [] });
      try {
        if (decision !== "CALL_MAY_I")
          expect(
            executeGameAction(adapter, "carol", { type: "CALL_MAY_I" }).success,
          ).toBe(true);
        if (decision === "CLAIM_MAY_I") {
          // Alice already drew; the off-turn Bob needs the unavailable penalty card.
          expect(
            executeGameAction(adapter, "bob", { type: "CLAIM_MAY_I" }).success,
          ).toBe(true);
        } else if (decision === "ALLOW_MAY_I") {
          expect(
            executeGameAction(adapter, "bob", { type: "ALLOW_MAY_I" }).success,
          ).toBe(true);
        } else
          expect(
            executeGameAction(adapter, "bob", { type: "CALL_MAY_I" }).success,
          ).toBe(true);
        expect(adapter.getSnapshot().currentRound).toBe(3);
        expect(adapter.getCurrentRoundActivityLog()).toEqual([]);
        expect(
          adapter
            .getStoredState()
            .activityLog.some((e) => e.action === "took the May I card"),
        ).toBe(false);
        expect(
          adapter
            .getStoredState()
            .activityLog.filter((e) => e.playerId !== "system")
            .every((e) => e.roundNumber === 2),
        ).toBe(true);
      } finally {
        adapter.stop();
      }
    });
  }

  it("keeps a stock-exhausting draw out of the newly dealt hand", () => {
    const hand = (
      ["3", "4", "5", "6", "7", "8", "9", "10", "J", "Q"] as const
    ).map((rank) => card(`held-${rank}`, rank, "hearts"));
    const adapter = createAdapter({
      players: [
        { id: "alice", name: "Alice", isAI: false, isDown: true, hand },
        {
          id: "bob",
          name: "Bob",
          isAI: false,
          isDown: false,
          hand: [card("kh", "K", "hearts")],
        },
        {
          id: "carol",
          name: "Carol",
          isAI: false,
          isDown: false,
          hand: [card("kd", "K", "diamonds")],
        },
      ],
      stock: [card("last-stock", "Q", "clubs")],
      turn: { currentPlayerIndex: 0, hasDrawn: false, phase: "awaitingDraw" },
    });
    try {
      expect(
        executeGameAction(adapter, "alice", { type: "DRAW_FROM_STOCK" })
          .success,
      ).toBe(true);
      expect(adapter.getSnapshot().currentRound).toBe(3);
      expect(adapter.getCurrentRoundActivityLog()).toEqual([]);
      const draw = adapter
        .getStoredState()
        .activityLog.find((e) => e.playerId === "alice");
      expect(draw?.action).toBe("drew from the draw pile");
      expect(draw?.roundNumber).toBe(2);
      expect(draw?.details).toBeUndefined();
    } finally {
      adapter.stop();
    }
  });
});
