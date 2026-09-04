import { describe, expect, it } from "bun:test";
import { GameEngine } from "../core/engine/game-engine";
import type { ToolExecutionResult } from "./mayIAgent.types";
import {
  buildMayICallDecisionPrompt,
  createMayICallDecisionTools,
  getEligibleMayICallerIds,
  stopWhenMayICallDecisionComplete,
} from "./mayIAgent.may-i-call";
import { createAIPlayerGameEngineRuntime } from "./evals/ai-player-game-engine-runtime";

describe("May I call decision", () => {
  it("finds eligible off-turn callers but never the current player", () => {
    const engine = GameEngine.createGame({
      gameId: "may-i-call-eligibility",
      playerNames: ["Alice", "Bob", "Carol"],
      seed: "may-i-call-eligibility",
    });

    try {
      const snapshot = engine.getSnapshot();
      const eligible = getEligibleMayICallerIds(snapshot);

      expect(eligible).not.toContain(snapshot.awaitingPlayerId);
      expect(eligible).toHaveLength(2);
      expect(eligible.every((playerId) => snapshot.players.some((player) => player.id === playerId))).toBe(true);
    } finally {
      engine.stop();
    }
  });

  it("applies a call through the real engine and completes the decision", async () => {
    const engine = GameEngine.createGame({
      gameId: "may-i-call-action",
      playerNames: ["Alice", "Bob", "Carol"],
      seed: "may-i-call-action",
    });

    try {
      const callerId = getEligibleMayICallerIds(engine.getSnapshot())[0];
      expect(callerId).toBeDefined();
      if (callerId === undefined) return;
      const state = createAIPlayerGameEngineRuntime(engine, callerId);
      const tools = createMayICallDecisionTools(state.runtime, callerId);

      const result = (await tools.call_may_i.execute?.(
        {},
        {} as never,
      )) as ToolExecutionResult | undefined;

      expect(result).toMatchObject({ success: true, turnComplete: true });
      expect(state.attempts).toEqual([
        { playerId: callerId, action: { type: "CALL_MAY_I" }, ok: true },
      ]);
      expect(engine.getSnapshot().phase).toBe("RESOLVING_MAY_I");
      expect(engine.getSnapshot().mayIContext?.originalCaller).toBe(callerId);
    } finally {
      engine.stop();
    }
  });

  it("records an explicit pass without mutating the game", async () => {
    const engine = GameEngine.createGame({
      gameId: "may-i-call-pass",
      playerNames: ["Alice", "Bob", "Carol"],
      seed: "may-i-call-pass",
    });

    try {
      const callerId = getEligibleMayICallerIds(engine.getSnapshot())[0];
      expect(callerId).toBeDefined();
      if (callerId === undefined) return;
      const state = createAIPlayerGameEngineRuntime(engine, callerId);
      const tools = createMayICallDecisionTools(state.runtime, callerId);
      const before = engine.getPersistedSnapshot();

      const result = (await tools.pass_may_i.execute?.(
        {},
        {} as never,
      )) as ToolExecutionResult | undefined;

      expect(result).toMatchObject({ success: true, turnComplete: true });
      expect(state.attempts).toEqual([]);
      expect(engine.getPersistedSnapshot()).toEqual(before);
    } finally {
      engine.stop();
    }
  });

  it("renders an explicit call-versus-pass decision without exposing hidden cards", () => {
    const engine = GameEngine.createGame({
      gameId: "may-i-call-prompt",
      playerNames: ["Alice", "Bob", "Carol"],
      seed: "may-i-call-prompt",
    });

    try {
      const snapshot = engine.getSnapshot();
      const callerId = getEligibleMayICallerIds(snapshot)[0];
      expect(callerId).toBeDefined();
      if (callerId === undefined) return;

      const prompt = buildMayICallDecisionPrompt(snapshot, callerId);
      const hiddenOpponentCardIds = snapshot.players
        .filter((player) => player.id !== callerId)
        .flatMap((player) => player.hand.map((card) => card.id));

      expect(prompt).toContain("OUT-OF-TURN MAY I OPPORTUNITY");
      expect(prompt).toContain("one unknown penalty card");
      expect(prompt).toContain("call_may_i or pass_may_i");
      expect(hiddenOpponentCardIds.some((cardId) => prompt.includes(cardId))).toBe(false);
    } finally {
      engine.stop();
    }
  });

  it("stops only after a successful terminal call-or-pass tool result", () => {
    const step = (success: boolean, turnComplete: boolean) =>
      ({
        toolResults: [{ output: { success, turnComplete } }],
      }) as never;

    expect(stopWhenMayICallDecisionComplete({ steps: [] })).toBe(false);
    expect(
      stopWhenMayICallDecisionComplete({ steps: [step(false, false)] }),
    ).toBe(false);
    expect(
      stopWhenMayICallDecisionComplete({ steps: [step(true, true)] }),
    ).toBe(true);
  });
});
