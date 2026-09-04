import { describe, expect, it } from "bun:test";
import { convertAgentTestStateToStoredState } from "../../app/party/agent-state.converter";
import type { AgentTestState } from "../../app/party/agent-state.types";
import type { Card } from "../../core/card/card.types";
import { GameEngine } from "../../core/engine/game-engine";
import { outputGameStateForLLM } from "../mayIAgent.prompt-renderer";
import { createMayICallDecisionTools } from "../mayIAgent.may-i-call";
import { createAIPlayerTournamentHistory } from "./ai-player-tournament-history";

const card = (id: string, rank: Card["rank"], suit: Card["suit"]): Card => ({ id, rank, suit });

function injectedGame(overrides: Partial<AgentTestState> = {}) {
  const stored = convertAgentTestStateToStoredState({
    players: [
      { id: "a", name: "Alice", isAI: false, isDown: false, hand: [card("held", "A", "hearts")] },
      { id: "b", name: "Bob", isAI: false, isDown: true, hand: [card("bob", "K", "hearts")] },
      { id: "c", name: "Carol", isAI: false, isDown: false, hand: [card("carol", "K", "diamonds")] },
      { id: "d", name: "Dan", isAI: false, isDown: false, hand: [card("dan", "K", "clubs")] },
    ],
    roundNumber: 2,
    stock: [card("private-penalty", "Q", "clubs"), card("private-next", "J", "clubs")],
    discard: [card("exposed", "10", "clubs")], table: [],
    turn: { currentPlayerIndex: 0, hasDrawn: true, phase: "awaitingAction" },
    ...overrides,
  }, "tournament-history-transition");
  return GameEngine.fromJSON(stored.engineSnapshot);
}

describe("tournament public-history transitions", () => {
  it("records a Joker swap and consecutive layoffs from their individual snapshots", async () => {
    const engine = injectedGame({
      players: [
        { id: "a", name: "Alice", isAI: false, isDown: false, hand: [card("real-6", "6", "spades"), card("ace", "A", "hearts")] },
        { id: "b", name: "Bob", isAI: false, isDown: true, hand: [card("nine", "9", "spades"), card("ten", "10", "spades"), card("bob", "K", "hearts")] },
        { id: "c", name: "Carol", isAI: false, isDown: false, hand: [card("carol", "K", "diamonds")] },
      ],
      table: [{ id: "run", ownerId: "b", type: "run", cards: [card("five", "5", "spades"), card("joker", "Joker", null), card("seven", "7", "spades"), card("eight", "8", "spades")] }],
    });
    try {
      const history = createAIPlayerTournamentHistory(engine);
      const alice = history.createRuntime("player-0").runtime;
      expect((await alice.executeAction({ type: "SWAP_JOKER", meldId: "run", jokerCardId: "joker", swapCardId: "real-6" })).ok).toBe(true);
      expect(history.getActionLog()[0]).toMatchObject({ action: "swapped Joker", details: "6♠ into Bob's run" });
      expect((await alice.executeAction({ type: "DISCARD", cardId: "ace" })).ok).toBe(true);
      const bob = history.createRuntime("player-1").runtime;
      expect((await bob.executeAction({ type: "DRAW_FROM_STOCK" })).ok).toBe(true);
      expect((await bob.executeAction({ type: "LAY_OFF", cardId: "nine", meldId: "run" })).ok).toBe(true);
      expect((await bob.executeAction({ type: "LAY_OFF", cardId: "ten", meldId: "run" })).ok).toBe(true);
      expect(history.getActionLog().slice(-2).map(e => [e.action, e.details])).toEqual([["laid off", "9♠"], ["laid off", "10♠"]]);
      expect(history.getActionLog()).toHaveLength(5);
    } finally { engine.stop(); }
  });

  it("retains a hand-ending layoff in historical evidence but not next-hand player input", async () => {
    const engine = injectedGame({
      players: [
        { id: "a", name: "Alice", isAI: false, isDown: true, hand: [card("eight", "8", "spades")] },
        { id: "b", name: "Bob", isAI: false, isDown: true, hand: [card("bob", "K", "hearts")] },
        { id: "c", name: "Carol", isAI: false, isDown: false, hand: [card("carol", "K", "diamonds")] },
      ],
      table: [{ id: "run", ownerId: "b", type: "run", cards: [card("four", "4", "spades"), card("five", "5", "spades"), card("six", "6", "spades"), card("seven", "7", "spades")] }],
    });
    try {
      const history = createAIPlayerTournamentHistory(engine);
      expect((await history.createRuntime("player-0").runtime.executeAction({ type: "LAY_OFF", cardId: "eight", meldId: "run" })).ok).toBe(true);
      expect(engine.getSnapshot().currentRound).toBe(3);
      expect(history.getActionLog()).toEqual([]);
      expect(history.getRecordedActivity().map(e => [e.roundNumber, e.action, e.details])).toEqual([[2, "laid off", "8♠"], [2, "went out!", undefined]]);
      expect(outputGameStateForLLM(engine.getSnapshot(), "player-0", { actionLog: history.getActionLog() })).not.toContain("laid off 8♠");
    } finally { engine.stop(); }
  });

  it("records final Hand6 laydown before the engine clears its table", async () => {
    const set = [card("7h1", "7", "hearts"), card("7d", "7", "diamonds"), card("7c", "7", "clubs"), card("7h2", "7", "hearts")];
    const first = [card("4s", "4", "spades"), card("5s", "5", "spades"), card("6s", "6", "spades"), card("7s", "7", "spades")];
    const second = [card("9d", "9", "diamonds"), card("10d", "10", "diamonds"), card("jd", "J", "diamonds"), card("qd", "Q", "diamonds")];
    const engine = injectedGame({ roundNumber: 6, players: [
      { id: "a", name: "Alice", isAI: false, isDown: false, hand: [...set, ...first, ...second] },
      { id: "b", name: "Bob", isAI: false, isDown: false, hand: [card("bob", "K", "hearts")] },
      { id: "c", name: "Carol", isAI: false, isDown: false, hand: [card("carol", "K", "diamonds")] },
    ] });
    try {
      const history = createAIPlayerTournamentHistory(engine);
      expect((await history.createRuntime("player-0").runtime.executeAction({ type: "LAY_DOWN", melds: [
        { type: "set", cardIds: set.map(c => c.id) }, { type: "run", cardIds: first.map(c => c.id) }, { type: "run", cardIds: second.map(c => c.id) },
      ] })).ok).toBe(true);
      expect(engine.getSnapshot().phase).toBe("GAME_END");
      expect(history.getActionLog().map(e => e.action)).toEqual(["laid down contract", "went out!"]);
      expect(history.getActionLog()[0]!.details).toBe("7♥ 7♦ 7♣ 7♥ 4♠ 5♠ 6♠ 7♠ 9♦ 10♦ J♦ Q♦");
    } finally { engine.stop(); }
  });

  it("records immediate May I ownership and keeps pass/rejected calls private", async () => {
    const engine = injectedGame();
    try {
      const history = createAIPlayerTournamentHistory(engine);
      const runtime = history.createRuntime("player-2").runtime;
      const tools = createMayICallDecisionTools(runtime, "player-2");
      expect(await tools.pass_may_i.execute!({}, { toolCallId: "pass", messages: [], context: {} })).toMatchObject({ success: true });
      expect(history.getActionLog()).toEqual([]);
      expect((await runtime.executeAction({ type: "CALL_MAY_I" })).ok).toBe(true);
      expect(history.getActionLog().map(e => [e.playerId, e.action, e.details])).toEqual([
        ["player-2", "called May I", "10♣"], ["player-2", "took the May I card", "10♣"],
      ]);
      expect(JSON.stringify(history.getRecordedActivity())).not.toContain("Q♣");
      expect((await runtime.executeAction({ type: "CALL_MAY_I" })).ok).toBe(false);
      expect(history.getActionLog()).toHaveLength(2);
    } finally { engine.stop(); }
  });

  it("retains a successful May I transfer after an invalid contract attempt", async () => {
    const engine = injectedGame();
    try {
      const history = createAIPlayerTournamentHistory(engine);
      expect((await history.createRuntime("player-0").runtime.executeAction({
        type: "LAY_DOWN", melds: [
          { type: "set", cardIds: ["missing-1", "missing-2", "missing-3"] },
          { type: "run", cardIds: ["missing-4", "missing-5", "missing-6", "missing-7"] },
        ],
      })).ok).toBe(false);
      expect(history.getActionLog()).toEqual([]);
      expect((await history.createRuntime("player-2").runtime.executeAction({ type: "CALL_MAY_I" })).ok).toBe(true);
      expect(history.getActionLog().map(entry => entry.action)).toEqual(["called May I", "took the May I card"]);
    } finally { engine.stop(); }
  });

  for (const response of ["ALLOW_MAY_I", "CLAIM_MAY_I"] as const) {
    it(`records ${response} after a stale error without duplicating a fallback`, async () => {
      const engine = injectedGame({ players: [
        { id: "a", name: "Alice", isAI: false, isDown: false, hand: [card("held", "A", "hearts")] },
        { id: "b", name: "Bob", isAI: false, isDown: false, hand: [card("bob", "K", "hearts")] },
        { id: "c", name: "Carol", isAI: false, isDown: false, hand: [card("carol", "K", "diamonds")] },
        { id: "d", name: "Dan", isAI: false, isDown: false, hand: [card("dan", "K", "clubs")] },
      ] });
      try {
        const history = createAIPlayerTournamentHistory(engine);
        expect((await history.createRuntime("player-0").runtime.executeAction({ type: "LAY_DOWN", melds: [{ type: "set", cardIds: ["missing-1", "missing-2", "missing-3"] }] })).ok).toBe(false);
        expect(engine.getSnapshot().lastError).toBeTruthy();
        expect((await history.createRuntime("player-2").runtime.executeAction({ type: "CALL_MAY_I" })).ok).toBe(true);
        expect(engine.getSnapshot().phase).toBe("RESOLVING_MAY_I");
        const responder = history.createRuntime("player-1");
        expect((await responder.runtime.executeAction({ type: response })).ok).toBe(true);
        expect(engine.getSnapshot().phase).toBe("ROUND_ACTIVE");
        expect(history.getActionLog().map(entry => entry.action)).toEqual(["called May I", response === "ALLOW_MAY_I" ? "allowed May I" : "claimed May I", "took the May I card"]);
        expect(history.getActionLog().at(-1)?.playerId).toBe(response === "ALLOW_MAY_I" ? "player-2" : "player-1");
        expect((await responder.runtime.executeAction({ type: response })).ok).toBe(false);
        expect(history.getActionLog()).toHaveLength(3);
      } finally { engine.stop(); }
    });
  }

  for (const action of ["DRAW_FROM_STOCK", "CALL_MAY_I", "ALLOW_MAY_I", "CLAIM_MAY_I"] as const) {
    it(`does not attribute a ${action} exhaustion event to the newly dealt hand`, async () => {
      const engine = injectedGame({
        stock: action === "DRAW_FROM_STOCK" ? [card("last", "Q", "clubs")] : [],
        turn: { currentPlayerIndex: 0, hasDrawn: action !== "DRAW_FROM_STOCK", phase: action === "DRAW_FROM_STOCK" ? "awaitingDraw" : "awaitingAction" },
        players: [
          { id: "a", name: "Alice", isAI: false, isDown: false, hand: [card("held", "A", "hearts")] },
          { id: "b", name: "Bob", isAI: false, isDown: false, hand: [card("bob", "K", "hearts")] },
          { id: "c", name: "Carol", isAI: false, isDown: false, hand: [card("carol", "K", "diamonds")] },
          { id: "d", name: "Dan", isAI: false, isDown: false, hand: [card("dan", "K", "clubs")] },
        ],
      });
      try {
        const history = createAIPlayerTournamentHistory(engine);
        if (action === "ALLOW_MAY_I" || action === "CLAIM_MAY_I") expect((await history.createRuntime("player-2").runtime.executeAction({ type: "CALL_MAY_I" })).ok).toBe(true);
        const playerId = action === "DRAW_FROM_STOCK" ? "player-0" : "player-1";
        expect((await history.createRuntime(playerId).runtime.executeAction({ type: action })).ok).toBe(true);
        expect(engine.getSnapshot().currentRound).toBe(3);
        expect(history.getActionLog()).toEqual([]);
        expect(history.getRecordedActivity().every(e => e.roundNumber === 2)).toBe(true);
        expect(history.getRecordedActivity().some(e => e.action === "took the May I card")).toBe(false);
      } finally { engine.stop(); }
    });
  }
});
