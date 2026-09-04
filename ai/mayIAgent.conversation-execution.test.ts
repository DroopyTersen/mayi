import { describe, expect, it } from "bun:test";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { GameEngine } from "../core/engine/game-engine";
import { createAIPlayerGameEngineRuntime } from "./evals/ai-player-game-engine-runtime";
import { AIHandConversation } from "./mayIAgent.conversation";
import { executeTurn } from "./mayIAgent";
import { buildMayICallDecisionPrompt, executeMayICallDecision, getEligibleMayICallerIds } from "./mayIAgent.may-i-call";
import { outputGameStateForLLM } from "./mayIAgent.prompt-renderer";

// The actual SDK attempts a closed local endpoint. No model or transport mock.
const provider = createOpenRouter({ apiKey: "local-context-failure-test", baseURL: "http://127.0.0.1:0/api/v1" });
const model = provider.chat("meta/muse-spark-1.3-contributor");

describe("player API conversation lifecycle", () => {
  for (const kind of ["turn", "may-i-call"] as const) {
    for (const mode of ["fresh", "per-hand"] as const) {
      it(`${kind} ${mode}: captures exact observation and releases context after a real transport failure`, async () => {
        const engine = GameEngine.createGame({ gameId: "api-context", playerNames: ["A", "B", "C"], seed: "api-context" });
        try {
          const snapshot = engine.getSnapshot();
          const playerId = kind === "turn" ? snapshot.awaitingPlayerId! : getEligibleMayICallerIds(snapshot)[0]!;
          const state = createAIPlayerGameEngineRuntime(engine, playerId);
          const conversation = new AIHandConversation({ gameId: snapshot.gameId, playerId, lineageId: "api-test" });
          const decisionContext = { lineageId: "api-test", modelConfigurationSha256: "b".repeat(64), ...(mode === "per-hand" ? { conversation } : {}) };
          const config = { model, modelId: "default:meta", runtime: state.runtime, playerId, telemetry: false, maxRetries: 0, decisionContext };
          const execute = kind === "turn" ? executeTurn : executeMayICallDecision;
          const result = await execute(config);
          expect(result.success).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.decisionContextTrace).toMatchObject({ mode, suppliedHistoryMessageCount: 0, committedHistoryMessageCount: 0, completionValidated: false });
          const observation = kind === "turn" ? outputGameStateForLLM(snapshot, playerId) : buildMayICallDecisionPrompt(snapshot, playerId);
          expect(result.decisionContextTrace?.observationSha256).toBe(new Bun.CryptoHasher("sha256").update(observation).digest("hex"));
          expect(state.attempts).toHaveLength(0);
          // A second actual attempt must not encounter an abandoned history lease.
          const next = await execute(config);
          expect(next.decisionContextTrace?.requestMessageCount).toBe(1);
          expect(next.error).not.toContain("already in flight");
        } finally { engine.stop(); }
      });
    }

    it(`${kind}: other model identities use the same decision context and real provider path`, async () => {
      const engine = GameEngine.createGame({ gameId: "api-context-reject", playerNames: ["A", "B", "C"], seed: "api-context-reject" });
      try {
        const snapshot = engine.getSnapshot();
        const playerId = kind === "turn" ? snapshot.awaitingPlayerId! : getEligibleMayICallerIds(snapshot)[0]!;
        const state = createAIPlayerGameEngineRuntime(engine, playerId);
        const execute = kind === "turn" ? executeTurn : executeMayICallDecision;
        const result = await execute({ model, modelId: "default:openai", playerId, runtime: state.runtime, maxRetries: 0, telemetry: false,
          decisionContext: { lineageId: "api-test", modelConfigurationSha256: "b".repeat(64) } });
        expect(result.success).toBe(false);
        expect(result.decisionContextTrace).toMatchObject({ mode: "fresh", requestMessageCount: 1, completionValidated: false });
        expect(state.attempts).toHaveLength(0);
      } finally { engine.stop(); }
    });
  }
});
