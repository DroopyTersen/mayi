import { expect, it } from "bun:test";
import { GameEngine } from "../../core/engine/game-engine";
import { AIHandConversation } from "../mayIAgent.conversation";
import { executeTurn } from "../mayIAgent";
import { executeMayICallDecision, getEligibleMayICallerIds } from "../mayIAgent.may-i-call";
import { createAIPlayerEvalModel } from "./ai-player-fixed-state-runner";
import { createAIPlayerEvalModelConfigurationSnapshot } from "./ai-player-model-configuration";
import { AI_PLAYER_EVAL_CANDIDATES } from "./ai-player-eval-candidates";
import { AI_PLAYER_SHORT_ROLLOUT_SCENARIOS } from "./ai-player-short-rollout-scenarios";
import { createAIPlayerRolloutHistory } from "./ai-player-rollout-history";
import { createAIPlayerGameEngineRuntime } from "./ai-player-game-engine-runtime";

const live = process.env.RUN_MUSE_HAND_CONTEXT_TESTS === "1" && Boolean(process.env.OPENROUTER_API_KEY);
const configuration = createAIPlayerEvalModelConfigurationSnapshot("default:meta", "low", { retainReasoning: true });
const model = () => createAIPlayerEvalModel(AI_PLAYER_EVAL_CANDIDATES["spark-low"], { retainReasoning: true });

for (const mode of ["fresh", "per-hand"] as const) {
  for (const cancelAfterTool of [false, true]) {
    it.skipIf(!live)(`${mode}: real hand-ending tool ${cancelAfterTool ? "with late cancellation" : "remains a successful game decision"}`, async () => {
      // This existing engine edge fixture tests lifecycle only, not strategy quality.
      const scenario = AI_PLAYER_SHORT_ROLLOUT_SCENARIOS.find(s => s.identity.id === "swap-joker-to-unlock-contract");
      if (!scenario) throw new Error("Missing terminal-draw fixture");
      const history = await createAIPlayerRolloutHistory(scenario, 1);
      try {
        const { runtime } = history.createRuntime(scenario.evaluatedPlayerId);
        const initial = await runtime.getSnapshot();
        const lineageId = "hand-ending-api-probe";
        const conversation = new AIHandConversation({ gameId: initial.gameId, playerId: scenario.evaluatedPlayerId, lineageId });
        const cancellation = new AbortController();
        let toolCompleted = false;
        const result = await executeTurn({
          model: model(), modelId: "default:meta", runtime, playerId: scenario.evaluatedPlayerId,
          systemPrompt: "Transport lifecycle test. Draw from stock once with the available tool. Do not narrate.",
          maxRetries: 0, abortSignal: AbortSignal.any([cancellation.signal, AbortSignal.timeout(30_000)]),
          telemetry: { onToolExecutionEnd() { toolCompleted = true; if (cancelAfterTool) cancellation.abort(); } },
          decisionContext: { lineageId, modelConfigurationSha256: configuration.sha256, ...(mode === "per-hand" ? { conversation } : {}) },
        });
        expect(toolCompleted).toBe(true);
        expect((await runtime.getSnapshot()).phase).toBe("ROUND_END");
        expect(result.success).toBe(!cancelAfterTool);
        expect(Boolean(result.aborted)).toBe(cancelAfterTool);
        expect(result.decisionContextTrace?.committedHistoryMessageCount).toBe(0);
        expect(result.decisionContextTrace?.outcome).toBe(mode === "per-hand" ? "reset" : "not-retained");
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        await Bun.write(`.data/ai-evals/hand-conversation-v1-20260904/terminal-${mode}-${cancelAfterTool}-${stamp}.json`, JSON.stringify({
          createdAt: new Date().toISOString(), mode, cancelAfterTool, toolCompleted, finalPhase: "ROUND_END",
          success: result.success, aborted: result.aborted ?? false, trace: result.decisionContextTrace,
          metrics: result.metrics, usageAvailable: result.metrics !== undefined, modelConfiguration: configuration,
          scope: "Real engine and SDK lifecycle proof; terminal-draw fixture is not strategic evidence. No opaque payloads stored.",
        }, null, 2));
      } finally { history.actor.stop(); }
    }, 30_000);
  }

  it.skipIf(!live)(`${mode}: real May I pass cannot commit after late cancellation`, async () => {
    const engine = GameEngine.createGame({ gameId: "may-i-pass-abort-probe", playerNames: ["A", "B", "C"], seed: "pass-abort" });
    try {
      const initial = engine.getSnapshot();
      const playerId = getEligibleMayICallerIds(initial)[0]!;
      const { runtime } = createAIPlayerGameEngineRuntime(engine, playerId);
      const lineageId = "pass-abort-api-probe";
      const conversation = new AIHandConversation({ gameId: initial.gameId, playerId, lineageId });
      const cancellation = new AbortController();
      let toolCompleted = false;
      let observedToolName: string | undefined;
      const result = await executeMayICallDecision({
        model: model(), modelId: "default:meta", runtime, playerId,
        systemPrompt: "Transport lifecycle test. Pass this May I opportunity with pass_may_i. Do not narrate.",
        maxRetries: 0, abortSignal: AbortSignal.any([cancellation.signal, AbortSignal.timeout(30_000)]),
        telemetry: { onToolExecutionEnd(event) { toolCompleted = true; observedToolName = event.toolOutput.toolName; cancellation.abort(); } },
        decisionContext: { lineageId, modelConfigurationSha256: configuration.sha256, ...(mode === "per-hand" ? { conversation } : {}) },
      });
      expect(toolCompleted).toBe(true);
      expect(observedToolName).toBe("pass_may_i");
      expect(result.success).toBe(false);
      expect(result.aborted).toBe(true);
      expect(result.decisionContextTrace?.committedHistoryMessageCount).toBe(0);
      expect(result.decisionContextTrace?.completionValidated).toBe(false);
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      await Bun.write(`.data/ai-evals/hand-conversation-v1-20260904/pass-abort-${mode}-${stamp}.json`, JSON.stringify({
        createdAt: new Date().toISOString(), mode, toolCompleted, observedToolName, success: result.success, aborted: result.aborted,
        trace: result.decisionContextTrace, metrics: result.metrics, usageAvailable: result.metrics !== undefined,
        scope: "Real May I API and SDK late-cancellation proof, not a gameplay result.",
      }, null, 2));
    } finally { engine.stop(); }
  }, 30_000);
}
