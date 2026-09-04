import { describe, expect, it } from "bun:test";
import { GameEngine } from "../../core/engine/game-engine";
import { formatCardText } from "../../core/card/card-text.utils";
import { outputGameStateForLLM } from "../mayIAgent.prompt-renderer";
import { createAIPlayerTournamentHistory } from "./ai-player-tournament-history";

function createGame() {
  return GameEngine.createGame({
    gameId: "tournament-public-history", playerNames: ["Alice", "Bob", "Carol"],
    startingRound: 1, seed: "tournament-public-history-v1",
  });
}

describe("tournament canonical public history", () => {
  it("records each accepted public action with card details but conceals stock draws", async () => {
    const engine = createGame();
    try {
      const history = createAIPlayerTournamentHistory(engine);
      const before = engine.getSnapshot();
      const playerId = before.awaitingPlayerId;
      const state = history.createRuntime(playerId);
      expect((await state.runtime.executeAction({ type: "DRAW_FROM_STOCK" })).ok).toBe(true);
      expect(history.getActionLog()).toEqual([{
        roundNumber: 1, turnNumber: before.turnNumber, playerId,
        playerName: "Bob", action: "drew from the draw pile",
      }]);
      const drawn = engine.getSnapshot().players.find(p => p.id === playerId)!.hand.find(card => !before.players.find(p => p.id === playerId)!.hand.some(old => old.id === card.id))!;
      expect((await state.runtime.executeAction({ type: "DISCARD", cardId: drawn.id })).ok).toBe(true);
      expect(history.getActionLog()[1]).toMatchObject({ playerId, action: "discarded", details: formatCardText(drawn) });
      const nextId = engine.getSnapshot().awaitingPlayerId;
      expect((await history.createRuntime(nextId).runtime.executeAction({ type: "DRAW_FROM_DISCARD" })).ok).toBe(true);
      expect(history.getActionLog()[2]).toMatchObject({ playerId: nextId, action: "took from discard", details: formatCardText(drawn) });
      expect(history.getRecordedActivity()).toEqual(history.getActionLog());
      expect(state.attempts).toHaveLength(2);
    } finally { engine.stop(); }
  });

  it("retains more than ten current-hand events and returns independent copies", async () => {
    const engine = createGame();
    try {
      const history = createAIPlayerTournamentHistory(engine);
      for (let turn = 0; turn < 8; turn++) {
        const playerId = engine.getSnapshot().awaitingPlayerId;
        const { runtime } = history.createRuntime(playerId);
        expect((await runtime.executeAction({ type: "DRAW_FROM_STOCK" })).ok).toBe(true);
        const card = engine.getSnapshot().players.find(p => p.id === playerId)!.hand[0]!;
        expect((await runtime.executeAction({ type: "DISCARD", cardId: card.id })).ok).toBe(true);
      }
      const saved = history.getActionLog();
      expect(saved).toHaveLength(16);
      for (const player of engine.getSnapshot().players) {
        const prompt = outputGameStateForLLM(engine.getSnapshot(), player.id, {
          actionLog: history.getActionLog(),
        });
        const publicLines = prompt.split("\n").filter(line => line.includes("drew from the draw pile") || line.includes("discarded"));
        expect(publicLines).toHaveLength(16);
      }
      saved[0]!.action = "tampered";
      saved.length = 0;
      const recorded = history.getRecordedActivity();
      recorded[0]!.action = "tampered";
      recorded.length = 0;
      expect(history.getActionLog()).toHaveLength(16);
      expect(history.getActionLog()[0]!.action).toBe("drew from the draw pile");
      expect(history.getRecordedActivity()[0]!.action).toBe("drew from the draw pile");
    } finally { engine.stop(); }
  });

  it("omits rejected actions and private reordering without hiding their runtime attempts", async () => {
    const engine = createGame();
    try {
      const history = createAIPlayerTournamentHistory(engine);
      const playerId = engine.getSnapshot().awaitingPlayerId;
      const { runtime, attempts } = history.createRuntime(playerId);
      expect((await runtime.executeAction({ type: "DISCARD", cardId: "missing" })).ok).toBe(false);
      expect(history.getActionLog()).toEqual([]);
      expect((await runtime.executeAction({ type: "DRAW_FROM_STOCK" })).ok).toBe(true);
      const cardIds = engine.getSnapshot().players.find(p => p.id === playerId)!.hand.map(c => c.id).reverse();
      expect((await runtime.executeAction({ type: "REORDER_HAND", cardIds })).ok).toBe(true);
      expect(history.getActionLog()).toHaveLength(1);
      expect(attempts).toHaveLength(3);
      expect(attempts[0]!.ok).toBe(false);
    } finally { engine.stop(); }
  });

  it("records a priority claim's actual recipient without disclosing the penalty card", async () => {
    const engine = createGame();
    try {
      const history = createAIPlayerTournamentHistory(engine);
      const exposed = engine.getSnapshot().discard[0]!;
      const beforeClaim = engine.getSnapshot();
      expect((await history.createRuntime("player-0").runtime.executeAction({ type: "CALL_MAY_I" })).ok).toBe(true);
      expect((await history.createRuntime("player-1").runtime.executeAction({ type: "ALLOW_MAY_I" })).ok).toBe(true);
      expect((await history.createRuntime("player-2").runtime.executeAction({ type: "CLAIM_MAY_I" })).ok).toBe(true);
      expect(history.getActionLog()).toEqual([
        expect.objectContaining({ playerId: "player-0", action: "called May I", details: formatCardText(exposed) }),
        expect.objectContaining({ playerId: "player-1", action: "allowed May I" }),
        expect.objectContaining({ playerId: "player-2", action: "claimed May I", details: formatCardText(exposed) }),
        expect.objectContaining({ playerId: "player-2", action: "took the May I card", details: formatCardText(exposed) }),
      ]);
      const newCards = engine.getSnapshot().players[2]!.hand.filter(c => !beforeClaim.players[2]!.hand.some(old => old.id === c.id));
      expect(newCards).toHaveLength(2);
      expect(history.getActionLog().flatMap(e => e.details === undefined ? [] : [e.details])).toEqual([formatCardText(exposed), formatCardText(exposed), formatCardText(exposed)]);
    } finally { engine.stop(); }
  });
});
