import { describe, expect, it } from "bun:test";
import type { Card } from "../../core/card/card.types";
import type { AIActionRuntime } from "../../ai/ai-action-runtime.types";
import { createMayITools } from "../../ai/mayIAgent.tools";
import { convertAgentTestStateToStoredState } from "./agent-state.converter";
import { executeGameAction } from "./game-actions";
import { PartyGameAdapter } from "./party-game-adapter";

const card = (id: string, rank: Card["rank"], suit: Card["suit"]): Card => ({
  id,
  rank,
  suit,
});

describe("initial laydown through player action paths", () => {
  for (const isAI of [false, true]) {
    it(`rejects oversized sets through the ${isAI ? "AI tool" : "human action"} and accepts a corrected contract`, async () => {
      const hand = [
        card("jc", "J", "clubs"),
        card("jd", "J", "diamonds"),
        card("jh", "J", "hearts"),
        card("js", "J", "spades"),
        card("10c", "10", "clubs"),
        card("10d", "10", "diamonds"),
        card("10h", "10", "hearts"),
        card("10s", "10", "spades"),
        card("joker", "Joker", null),
        card("3c", "3", "clubs"),
        card("5h", "5", "hearts"),
        card("ks", "K", "spades"),
      ];
      const adapter = PartyGameAdapter.fromStoredState(
        convertAgentTestStateToStoredState({
          players: [
            {
              id: "player",
              name: "Player",
              isAI,
              ...(isAI ? { aiModelId: "default:openai" } : {}),
              isDown: false,
              hand,
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
          roundNumber: 1,
          stock: [card("8c", "8", "clubs")],
          discard: [card("6c", "6", "clubs")],
          table: [],
          turn: { currentPlayerIndex: 0, hasDrawn: true, phase: "awaitingAction" },
        }, "initial-laydown-regression")
      );
      try {
        const engineId = adapter.lobbyIdToEngineId("player")!;
        // A real engine-backed runtime: every tool action uses the production handler.
        const runtime: AIActionRuntime = {
          getSnapshot: async () => adapter.getSnapshot(),
          executeAction: async (action) => {
            const result = executeGameAction(adapter, "player", action);
            return result.success
              ? { ok: true, snapshot: result.snapshot }
              : {
                  ok: false,
                  snapshot: result.snapshot ?? adapter.getSnapshot(),
                  error: result.error,
                };
          },
        };
        const tools = createMayITools(runtime, engineId);
        const layDown = async (groups: number[][]) =>
          isAI
            ? await tools.lay_down.execute!(
                { melds: groups },
                { toolCallId: "laydown-regression", messages: [], context: {} }
              )
            : executeGameAction(adapter, "player", {
                type: "LAY_DOWN",
                melds: groups.map((positions) => ({
                  type: "set",
                  cardIds: positions.map((position) => hand[position - 1]!.id),
                })),
              });

        expect(await layDown([[1, 2, 3, 4], [5, 6, 7, 8, 9]])).toMatchObject({ success: false });
        const rejected = adapter.getSnapshot();
        expect(rejected.players[0]?.isDown).toBe(false);
        expect(rejected.players[0]?.hand).toEqual(hand);
        expect(rejected.table).toEqual([]);
        expect(rejected.turnPhase).toBe("AWAITING_ACTION");
        expect(rejected.lastError).toContain("exactly 3 cards");
        expect(adapter.getCurrentRoundActivityLog()).toEqual([]);

        expect(await layDown([[1, 2, 3], [5, 6, 7]])).toMatchObject({ success: true });
        const accepted = adapter.getSnapshot();
        expect(accepted.players[0]?.isDown).toBe(true);
        expect(accepted.players[0]?.hand).toHaveLength(6);
        expect(accepted.table.map((meld) => meld.cards.length)).toEqual([3, 3]);
        expect(accepted.turnPhase).toBe("AWAITING_DISCARD");
        executeGameAction(adapter, "player", {
          type: "LAY_OFF",
          cardId: "js",
          meldId: accepted.table[0]!.id,
        });
        expect(adapter.getSnapshot().table).toEqual(accepted.table);
        expect(adapter.getSnapshot().players[0]?.hand).toEqual(accepted.players[0]?.hand);
      } finally {
        adapter.stop();
      }
    });
  }
});
