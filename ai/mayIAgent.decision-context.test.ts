import { describe, expect, it } from "bun:test";
import type { AssistantModelMessage, ToolModelMessage } from "ai";
import { GameEngine } from "../core/engine/game-engine";
import { AIHandConversation } from "./mayIAgent.conversation";
import { beginAIPlayerDecisionContext } from "./mayIAgent.decision-context";
import { createAIPlayerGameEngineRuntime } from "./evals/ai-player-game-engine-runtime";
import { buildMayICallDecisionPrompt, createMayICallDecisionTools, getEligibleMayICallerIds } from "./mayIAgent.may-i-call";

const configurationSha256 = "a".repeat(64);
const digest = (value: unknown) => new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex");

function setup() {
  const engine = GameEngine.createGame({ gameId: "conversation-context", playerNames: ["A", "B", "C"], seed: "context" });
  const snapshot = engine.getSnapshot();
  const playerId = getEligibleMayICallerIds(snapshot)[0]!;
  const state = createAIPlayerGameEngineRuntime(engine, playerId);
  const conversation = new AIHandConversation({ gameId: snapshot.gameId, playerId, lineageId: "trial-1" });
  const options = { lineageId: "trial-1", modelConfigurationSha256: configurationSha256, conversation };
  const observation = buildMayICallDecisionPrompt(snapshot, playerId);
  return { engine, snapshot, playerId, ...state, options, observation,
    input: { options, snapshot, playerId, modelId: "default:meta", systemPrompt: "unchanged rules", observation, kind: "may-i-call" as const } };
}

async function realDecision(state: ReturnType<typeof setup>, name: "pass_may_i" | "call_may_i") {
  const output = await createMayICallDecisionTools(state.runtime, state.playerId)[name].execute!({}, {} as never);
  const messages: (AssistantModelMessage | ToolModelMessage)[] = [
    { role: "assistant", content: [{ type: "tool-call", toolCallId: "actual-tool", toolName: name, input: {} }] },
    { role: "tool", content: [{ type: "tool-result", toolCallId: "actual-tool", toolName: name, output: { type: "json", value: JSON.parse(JSON.stringify(output)) } }] },
  ];
  return { responseMessages: messages, completed: true, mayICallDecision: name === "pass_may_i" ? "pass" as const : "call" as const };
}

describe("actual player decision context", () => {
  for (const mode of ["fresh", "per-hand"] as const) {
    it(`${mode}: rejects a reported completion with a missing terminal tool result`, async () => {
      const s = setup();
      try {
        const decision = await beginAIPlayerDecisionContext({ ...s.input, options: { ...s.options, conversation: mode === "fresh" ? undefined : s.options.conversation } });
        const result = await realDecision(s, "pass_may_i");
        result.responseMessages.pop();
        expect(await decision.finish({ ...result, latestSnapshot: await s.runtime.getSnapshot() })).toMatchObject({ completed: false, trace: { completionValidated: false, committedHistoryMessageCount: 0 } });
      } finally { s.engine.stop(); }
    });
  }

  it("captures finish inputs before asynchronous hashing so hashes describe the committed messages", async () => {
    const s = setup();
    try {
      const decision = await beginAIPlayerDecisionContext(s.input);
      const result = await realDecision(s, "pass_may_i");
      const originalMessages = structuredClone(result.responseMessages);
      const latestSnapshot = await s.runtime.getSnapshot();
      const pending = decision.finish({ ...result, latestSnapshot });
      result.responseMessages.push({ role: "assistant", content: "caller mutation" });
      latestSnapshot.gameId = "foreign-after-finish";
      const finished = await pending;
      expect(finished).toMatchObject({ completed: true, trace: { outcome: "committed", responseMessageCount: 2, responseMessagesSha256: digest(originalMessages) } });
      const next = await beginAIPlayerDecisionContext(s.input);
      expect(next.messages?.slice(1, -1)).toEqual(originalMessages);
      await next.finish({ latestSnapshot: s.snapshot, responseMessages: [], completed: false });
    } finally { s.engine.stop(); }
  });

  it("captures the exact May I observation and gives empty-history arms identical message hashes", async () => {
    const s = setup();
    try {
      const treatment = await beginAIPlayerDecisionContext(s.input);
      const control = await beginAIPlayerDecisionContext({ ...s.input, options: { ...s.options, conversation: undefined } });
      expect(treatment.messages).toEqual([{ role: "user", content: s.observation }]);
      expect(control.messages).toBeUndefined(); // preserve ordinary prompt transport
      const result = await realDecision(s, "pass_may_i");
      const latestSnapshot = await s.runtime.getSnapshot();
      const a = await treatment.finish({ ...result, latestSnapshot });
      const b = await control.finish({ ...result, latestSnapshot });
      expect(a.trace.requestMessagesSha256).toBe(b.trace.requestMessagesSha256);
      expect(a.trace.observationSha256).toBe(new Bun.CryptoHasher("sha256").update(s.observation).digest("hex"));
      expect(a.trace.observationSha256).not.toBe(digest(s.snapshot));
      expect(a.trace).toMatchObject({ mode: "per-hand", outcome: "committed", suppliedHistoryMessageCount: 0, committedHistoryMessageCount: 3 });
      expect(b.trace).toMatchObject({ mode: "fresh", outcome: "not-retained", committedHistoryMessageCount: 0 });
      expect(a.completed).toBe(true);
      const next = await beginAIPlayerDecisionContext({ ...s.input, observation: "next exact observation" });
      expect(next.messages).toEqual([{ role: "user", content: s.observation }, ...result.responseMessages, { role: "user", content: "next exact observation" }]);
      const stopped = await next.finish({ latestSnapshot, responseMessages: [], completed: false });
      expect(stopped.trace.suppliedHistorySha256).toBe(digest([{ role: "user", content: s.observation }, ...result.responseMessages]));
      expect(JSON.stringify(stopped.trace)).not.toContain("next exact observation");
    } finally { s.engine.stop(); }
  });

  it("commits a successful real call even though calling removes the opportunity", async () => {
    const s = setup();
    try {
      const decision = await beginAIPlayerDecisionContext(s.input);
      const result = await realDecision(s, "call_may_i");
      const latestSnapshot = await s.runtime.getSnapshot();
      expect(latestSnapshot.phase).toBe("RESOLVING_MAY_I");
      expect(getEligibleMayICallerIds(latestSnapshot)).not.toContain(s.playerId);
      expect(await decision.finish({ ...result, latestSnapshot })).toMatchObject({ completed: true, trace: { outcome: "committed" } });
    } finally { s.engine.stop(); }
  });

  it("does not commit a stale pass after the exposed discard was taken", async () => {
    const s = setup();
    try {
      const decision = await beginAIPlayerDecisionContext(s.input);
      const result = await realDecision(s, "pass_may_i");
      const current = createAIPlayerGameEngineRuntime(s.engine, s.snapshot.awaitingPlayerId!);
      expect((await current.runtime.executeAction({ type: "DRAW_FROM_DISCARD" })).ok).toBe(true);
      expect(await decision.finish({ ...result, latestSnapshot: await s.runtime.getSnapshot() })).toMatchObject({ completed: false, trace: { outcome: "discarded", reason: "incomplete", committedHistoryMessageCount: 0 } });
    } finally { s.engine.stop(); }
  });

  it("keeps a pass valid when the current player merely draws from stock", async () => {
    const s = setup();
    try {
      const decision = await beginAIPlayerDecisionContext(s.input);
      const result = await realDecision(s, "pass_may_i");
      const current = createAIPlayerGameEngineRuntime(s.engine, s.snapshot.awaitingPlayerId!);
      expect((await current.runtime.executeAction({ type: "DRAW_FROM_STOCK" })).ok).toBe(true);
      expect(await decision.finish({ ...result, latestSnapshot: await s.runtime.getSnapshot() })).toMatchObject({ completed: true, trace: { outcome: "committed" } });
    } finally { s.engine.stop(); }
  });

  for (const failure of ["abort", "snapshot-unavailable", "incomplete"] as const) {
    it(`releases the lease without appending on ${failure}`, async () => {
      const s = setup();
      try {
        const decision = await beginAIPlayerDecisionContext(s.input);
        const result = await realDecision(s, "pass_may_i");
        const controller = new AbortController();
        if (failure === "abort") controller.abort();
        const finished = await decision.finish({ ...result, completed: failure !== "incomplete", latestSnapshot: failure === "snapshot-unavailable" ? undefined : await s.runtime.getSnapshot(), abortSignal: controller.signal });
        expect(finished).toMatchObject({ completed: false, trace: { outcome: "discarded", committedHistoryMessageCount: 0 } });
        const next = await beginAIPlayerDecisionContext(s.input);
        expect(next.messages).toHaveLength(1);
        await next.finish({ latestSnapshot: s.snapshot, responseMessages: [], completed: false });
      } finally { s.engine.stop(); }
    });
  }

  it("uses the same private decision-context lifecycle for other configured models", async () => {
    const s = setup();
    try {
      const next = await beginAIPlayerDecisionContext({ ...s.input, modelId: "default:openai" });
      expect(next.messages).toHaveLength(1);
      await next.finish({ latestSnapshot: s.snapshot, responseMessages: [], completed: false });
    } finally { s.engine.stop(); }
  });

  for (const invalid of ["model", "configuration-hash", "lineage"] as const) {
    it(`rejects ${invalid} before acquiring a conversation lease`, async () => {
      const s = setup();
      try {
        await expect(beginAIPlayerDecisionContext({ ...s.input,
          ...(invalid === "model" ? { modelId: undefined } : {}),
          options: { ...s.options,
            ...(invalid === "configuration-hash" ? { modelConfigurationSha256: "not-a-hash" } : {}),
            ...(invalid === "lineage" ? { lineageId: "" } : {}),
          },
        })).rejects.toThrow();
        expect(s.attempts).toHaveLength(0);
        const next = await beginAIPlayerDecisionContext(s.input);
        await next.finish({ latestSnapshot: s.snapshot, responseMessages: [], completed: false });
      } finally { s.engine.stop(); }
    });
  }
});
