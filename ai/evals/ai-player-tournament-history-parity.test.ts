import { describe, expect, it } from "bun:test";
import { convertAgentTestStateToStoredState } from "../../app/party/agent-state.converter";
import type { AgentTestState } from "../../app/party/agent-state.types";
import { PartyGameAdapter } from "../../app/party/party-game-adapter";
import { GameEngine } from "../../core/engine/game-engine";
import type { Card } from "../../core/card/card.types";
import { outputGameStateForLLM } from "../mayIAgent.prompt-renderer";
import { createMayITools } from "../mayIAgent.tools";
import { createAIPlayerTournamentHistory } from "./ai-player-tournament-history";

function storedGame(overrides: Partial<AgentTestState> = {}) {
  return convertAgentTestStateToStoredState({
    players: [
      { id: "a", name: "Alice", isAI: false, isDown: false, hand: [{ id: "held-a", rank: "A", suit: "hearts" }] },
      { id: "b", name: "Bob", isAI: false, isDown: false, hand: [{ id: "held-b", rank: "K", suit: "hearts" }] },
      { id: "c", name: "Carol", isAI: false, isDown: false, hand: [{ id: "held-c", rank: "K", suit: "diamonds" }] },
    ],
    roundNumber: 2,
    stock: [
      { id: "hidden-1", rank: "Q", suit: "clubs" },
      { id: "hidden-2", rank: "J", suit: "clubs" },
      { id: "hidden-3", rank: "9", suit: "clubs" },
    ],
    discard: [{ id: "exposed", rank: "10", suit: "clubs" }],
    table: [],
    turn: { currentPlayerIndex: 0, hasDrawn: false, phase: "awaitingDraw" },
    ...overrides,
  }, "tournament-history-parity");
}

describe("tournament history public observation parity", () => {
  for (const mode of ["runtime", "tools"] as const) {
    it(`keeps every accepted overlapping layoff in ${mode} execution order`, async () => {
      const engine = GameEngine.fromJSON(storedGame({
        players: [
          { id: "a", name: "Alice", isAI: false, isDown: true, hand: [
            { id: "eight", rank: "8", suit: "spades" },
            { id: "nine", rank: "9", suit: "spades" },
            { id: "held", rank: "K", suit: "clubs" },
          ] },
          { id: "b", name: "Bob", isAI: false, isDown: true, hand: [{ id: "held-b", rank: "K", suit: "hearts" }] },
          { id: "c", name: "Carol", isAI: false, isDown: false, hand: [{ id: "held-c", rank: "K", suit: "diamonds" }] },
        ],
        table: [{ id: "run", ownerId: "b", type: "run", cards: [
          { id: "four", rank: "4", suit: "spades" },
          { id: "five", rank: "5", suit: "spades" },
          { id: "six", rank: "6", suit: "spades" },
          { id: "seven", rank: "7", suit: "spades" },
        ] }],
        turn: { currentPlayerIndex: 0, hasDrawn: true, phase: "awaitingAction" },
      }).engineSnapshot);
      try {
        const history = createAIPlayerTournamentHistory(engine);
        const state = history.createRuntime("player-0");
        if (mode === "runtime") {
          expect(await Promise.all([
            state.runtime.executeAction({ type: "LAY_OFF", cardId: "eight", meldId: "run" }),
            state.runtime.executeAction({ type: "LAY_OFF", cardId: "nine", meldId: "run" }),
          ])).toMatchObject([{ ok: true }, { ok: true }]);
        } else {
          const tools = createMayITools(state.runtime, "player-0");
          expect(await Promise.all([
            tools.lay_off.execute!({ cardPosition: 1, meldNumber: 1 }, { toolCallId: "eight", messages: [], context: {} }),
            tools.lay_off.execute!({ cardPosition: 2, meldNumber: 1 }, { toolCallId: "nine", messages: [], context: {} }),
          ])).toMatchObject([{ success: true }, { success: true }]);
        }
        expect(state.attempts.map(attempt => attempt.ok)).toEqual([true, true]);
        expect(engine.getSnapshot().players[0]!.hand.map(card => card.id)).toEqual(["held"]);
        expect(history.getActionLog().map(entry => [entry.action, entry.details])).toEqual([["laid off", "8♠"], ["laid off", "9♠"]]);
      } finally { engine.stop(); }
    });
  }

  it("matches app activity and every player's rendering across real turns", async () => {
    const stored = storedGame();
    const engine = GameEngine.fromJSON(stored.engineSnapshot);
    const adapter = PartyGameAdapter.fromStoredState(stored);
    const history = createAIPlayerTournamentHistory(engine);
    const checkParity = () => {
      const appLog = adapter.getCurrentRoundActivityLogForEngine();
      expect(history.getActionLog()).toEqual(appLog.map(({ id: _id, timestamp: _timestamp, ...entry }) => entry));
      for (const player of engine.getSnapshot().players) {
        expect(outputGameStateForLLM(engine.getSnapshot(), player.id, { actionLog: history.getActionLog() }))
          .toBe(outputGameStateForLLM(adapter.getSnapshot(), player.id, { actionLog: appLog }));
      }
    };
    try {
      checkParity();
      for (const [index, lobbyId] of ["a", "b"].entries()) {
        const runtime = history.createRuntime(`player-${index}`).runtime;
        const before = adapter.getSnapshot();
        const source = index === 0 ? "discard" : "stock";
        expect((await runtime.executeAction({ type: index === 0 ? "DRAW_FROM_DISCARD" : "DRAW_FROM_STOCK" })).ok).toBe(true);
        const drawn = source === "discard" ? adapter.drawFromDiscard(lobbyId)! : adapter.drawFromStock(lobbyId)!;
        adapter.logDraw(lobbyId, before, drawn, source);
        checkParity();
        const cardId = `held-${lobbyId}`;
        expect((await runtime.executeAction({ type: "DISCARD", cardId })).ok).toBe(true);
        const discarded = adapter.discard(lobbyId, cardId)!;
        adapter.logDiscard(lobbyId, drawn, discarded, cardId);
        checkParity();
      }
    } finally {
      engine.stop();
      adapter.stop();
    }
  });

  it("does not expose hidden stock identities before or after another player's draw", async () => {
    const hidden: Card[] = [
      { id: "different-1", rank: "3", suit: "spades" },
      { id: "different-2", rank: "4", suit: "spades" },
      { id: "different-3", rank: "5", suit: "spades" },
    ];
    const engines = [storedGame(), storedGame({ stock: hidden })].map(stored => GameEngine.fromJSON(stored.engineSnapshot));
    const histories = engines.map(createAIPlayerTournamentHistory);
    const prompts = (playerId: string) => engines.map((engine, index) => outputGameStateForLLM(engine.getSnapshot(), playerId, { actionLog: histories[index]!.getActionLog() }));
    try {
      for (const playerId of ["player-0", "player-1", "player-2"]) {
        const [first, second] = prompts(playerId);
        expect(first).toBe(second);
      }
      for (const history of histories) {
        expect((await history.createRuntime("player-0").runtime.executeAction({ type: "DRAW_FROM_STOCK" })).ok).toBe(true);
      }
      expect(histories[0]!.getActionLog()).toEqual(histories[1]!.getActionLog());
      for (const playerId of ["player-1", "player-2"]) {
        const [first, second] = prompts(playerId);
        expect(first).toBe(second);
      }
      const [firstOwnView, secondOwnView] = prompts("player-0");
      expect(firstOwnView).not.toBe(secondOwnView);
    } finally { for (const engine of engines) engine.stop(); }
  });

  it("keeps an observer's input unchanged when opponents hold different private cards", async () => {
    const variants = [storedGame(), storedGame({ players: [
      { id: "a", name: "Alice", isAI: false, isDown: false, hand: [{ id: "held-a", rank: "A", suit: "hearts" }] },
      { id: "b", name: "Bob", isAI: false, isDown: false, hand: [{ id: "different-b", rank: "5", suit: "spades" }] },
      { id: "c", name: "Carol", isAI: false, isDown: false, hand: [{ id: "different-c", rank: "6", suit: "spades" }] },
    ] })];
    const engines = variants.map(stored => GameEngine.fromJSON(stored.engineSnapshot));
    const histories = engines.map(createAIPlayerTournamentHistory);
    const check = () => {
      const views = engines.map((engine, index) => outputGameStateForLLM(engine.getSnapshot(), "player-0", { actionLog: histories[index]!.getActionLog() }));
      expect(views[0]).toBe(views[1]);
      expect(histories[0]!.getActionLog()).toEqual(histories[1]!.getActionLog());
    };
    try {
      check();
      for (const history of histories) {
        expect((await history.createRuntime("player-0").runtime.executeAction({ type: "DRAW_FROM_DISCARD" })).ok).toBe(true);
        expect((await history.createRuntime("player-0").runtime.executeAction({ type: "DISCARD", cardId: "held-a" })).ok).toBe(true);
        expect((await history.createRuntime("player-1").runtime.executeAction({ type: "DRAW_FROM_STOCK" })).ok).toBe(true);
      }
      check();
    } finally { for (const engine of engines) engine.stop(); }
  });
});
