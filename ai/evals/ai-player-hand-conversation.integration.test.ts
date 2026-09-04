import { expect, it } from "bun:test";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import { defaultSettingsMiddleware, wrapLanguageModel } from "ai";
import { AI_MODEL_CATALOG } from "../ai-model-catalog";
import { GameEngine } from "../../core/engine/game-engine";
import { AIHandConversation } from "../mayIAgent.conversation";
import { executeTurn } from "../mayIAgent";
import { executeMayICallDecision, buildMayICallDecisionPrompt } from "../mayIAgent.may-i-call";
import { outputGameStateForLLM } from "../mayIAgent.prompt-renderer";
import { createOpenRouterMuseChatSettings } from "../openrouter-muse-profile";
import { createAIPlayerGameEngineRuntime } from "./ai-player-game-engine-runtime";
import { createAIPlayerEvalModelConfigurationSnapshot } from "./ai-player-model-configuration";

const live = process.env.RUN_MUSE_HAND_CONTEXT_TESTS === "1" && Boolean(process.env.OPENROUTER_API_KEY);
const digest = (value: unknown) => new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex");
const textDigest = (value: string) => new Bun.CryptoHasher("sha256").update(value).digest("hex");
const messageSchema = z.object({
  role: z.string(), content: z.unknown().optional(), tool_call_id: z.string().optional(),
  tool_calls: z.array(z.object({ id: z.string(), function: z.object({ name: z.string(), arguments: z.string() }) })).optional(),
  reasoning_details: z.array(z.object({ type: z.string(), format: z.string().optional(), data: z.string().optional() }).passthrough()).optional(),
}).passthrough();
const requestSchema = z.object({ messages: z.array(messageSchema), tools: z.array(z.object({ function: z.object({ name: z.string() }).passthrough() }).passthrough()) }).passthrough();
const responseSchema = z.object({ id: z.string(), choices: z.array(z.object({ message: messageSchema })), usage: z.unknown().optional() });
type Exchange = { request: z.infer<typeof requestSchema>; requestBodySha256: string; response: z.infer<typeof responseSchema> };

function parsePrivate<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new Error("Unexpected live transport shape (private payload omitted)");
  return result.data;
}

function contentText(content: unknown): string {
  if (typeof content === "string") return content;
  const parsed = z.array(z.object({ type: z.string(), text: z.string().optional() })).safeParse(content);
  return parsed.success ? parsed.data.map(p => p.text ?? "").join("") : "";
}

it("does not discard tool schemas or descriptions from the wire-equivalence check", () => {
  const request = { messages: [{ role: "user", content: "test" }], tools: [{ type: "function", function: {
    name: "discard", description: "Discard one card", strict: true,
    parameters: { type: "object", properties: { position: { type: "integer", minimum: 1 } }, required: ["position"] },
  } }] };
  expect(parsePrivate(requestSchema, request)).toEqual(request);
});

const systemPrompt = `This is a transport integration test, not a gameplay benchmark.
Use real tools and obey their current availability. Never answer with prose.
If call_may_i and pass_may_i are available, choose pass_may_i.
On an ordinary turn draw from stock, organize by rank, then discard position 1.
Do not lay down, call May I, or swap Jokers. Do not repeat an already completed action.
Use current state, not stale positions from earlier observations.`;

it.skipIf(!live)("replays exact per-assistant reasoning and terminal results across real ordinary and May I player decisions", async () => {
  const modelConfig = createAIPlayerEvalModelConfigurationSnapshot("default:meta", "low", { retainReasoning: true });
  function setup(mode: "fresh" | "per-hand") {
    const exchanges: Exchange[] = [];
    const provider = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
      // Transparent real HTTP inspection, with no substituted responses or model.
      fetch: Object.assign(async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        if (typeof init?.body !== "string") throw new Error("Expected serialized request");
        const request = parsePrivate(requestSchema, JSON.parse(init.body));
        const response = await fetch(input, init);
        if (!response.ok) throw new Error(`Live provider returned HTTP ${response.status}`);
        exchanges.push({ request, requestBodySha256: textDigest(init.body), response: parsePrivate(responseSchema, await response.clone().json()) });
        return response;
      }, { preconnect: fetch.preconnect }),
    });
    const engine = GameEngine.createGame({ gameId: "hand-context-wire-proof", playerNames: ["A", "B", "C"], seed: "hand-context-wire-proof" });
    const playerId = engine.getSnapshot().awaitingPlayerId!;
    const state = createAIPlayerGameEngineRuntime(engine, playerId);
    const conversation = new AIHandConversation({ gameId: engine.getSnapshot().gameId, playerId, lineageId: "serialized-wire-proof" });
    return { engine, playerId, exchanges, state, config: {
      model: wrapLanguageModel({
        model: provider.chat("meta/muse-spark-1.3-contributor", createOpenRouterMuseChatSettings("low", { retainReasoning: true })),
        middleware: defaultSettingsMiddleware({ settings: AI_MODEL_CATALOG["default:meta"].settings }),
      }),
      modelId: "default:meta", runtime: state.runtime, playerId, systemPrompt, telemetry: false,
      maxRetries: 0, abortSignal: AbortSignal.timeout(60_000),
      decisionContext: { lineageId: "serialized-wire-proof", modelConfigurationSha256: modelConfig.sha256, ...(mode === "per-hand" ? { conversation } : {}) },
    } };
  }
  const treatment = setup("per-hand");
  const control = setup("fresh");
  try {
    const observation1 = outputGameStateForLLM(treatment.engine.getSnapshot(), treatment.playerId);
    const [first, controlFirst] = await Promise.all([executeTurn(treatment.config), executeTurn(control.config)]);
    expect(first.success).toBe(true);
    expect(controlFirst.success).toBe(true);
    expect(first.decisionContextTrace?.outcome).toBe("committed");
    expect(treatment.exchanges[0]?.requestBodySha256).toBe(control.exchanges[0]?.requestBodySha256);
    for (const exchange of [...treatment.exchanges, ...control.exchanges]) {
      expect(exchange.request.temperature).toBe(modelConfig.configuration.modelSettings.temperature);
      expect(exchange.request.max_tokens).toBe(modelConfig.configuration.modelSettings.maxOutputTokens);
    }
    const firstCount = treatment.exchanges.length;
    async function advanceOtherPlayer() {
      const playerId = treatment.engine.getSnapshot().awaitingPlayerId!;
      expect(playerId).not.toBe(treatment.playerId);
      const other = createAIPlayerGameEngineRuntime(treatment.engine, playerId);
      expect((await other.runtime.executeAction({ type: "DRAW_FROM_STOCK" })).ok).toBe(true);
      const cardId = (await other.runtime.getSnapshot()).players.find(p => p.id === playerId)!.hand[0]!.id;
      expect((await other.runtime.executeAction({ type: "DISCARD", cardId })).ok).toBe(true);
    }
    // A player cannot claim their own discard. Wait for another real discard.
    await advanceOtherPlayer();
    const observation2 = buildMayICallDecisionPrompt(treatment.engine.getSnapshot(), treatment.playerId);
    const second = await executeMayICallDecision(treatment.config);
    expect(second.success).toBe(true);
    expect(second.decision).toBe("pass");
    expect(second.decisionContextTrace?.suppliedHistoryMessageCount).toBe(first.decisionContextTrace?.committedHistoryMessageCount);
    expect(second.decisionContextTrace?.observationSha256).toBe(textDigest(observation2));
    const secondCount = treatment.exchanges.length;
    // Advance the two other players with legal engine actions, not invented snapshots.
    await advanceOtherPlayer();
    const observation3 = outputGameStateForLLM(treatment.engine.getSnapshot(), treatment.playerId);
    const third = await executeTurn(treatment.config);
    expect(third.success).toBe(true);
    expect(third.decisionContextTrace?.suppliedHistoryMessageCount).toBe(second.decisionContextTrace?.committedHistoryMessageCount);
    expect(third.decisionContextTrace?.observationSha256).toBe(textDigest(observation3));

    let encryptedBlocksChecked = 0;
    const prior: z.infer<typeof messageSchema>[] = [];
    for (const exchange of treatment.exchanges) {
      expect(exchange.request.temperature).toBe(modelConfig.configuration.modelSettings.temperature);
      expect(exchange.request.max_tokens).toBe(modelConfig.configuration.modelSettings.maxOutputTokens);
      const assistantMessages = exchange.request.messages.filter(m => m.role === "assistant");
      expect(assistantMessages.length).toBe(prior.length);
      for (let i = 0; i < prior.length; i++) {
        // Hash comparisons ensure failures never print opaque reasoning payloads.
        expect(digest(assistantMessages[i]?.reasoning_details)).toBe(digest(prior[i]?.reasoning_details));
        expect(digest(assistantMessages[i]?.tool_calls)).toBe(digest(prior[i]?.tool_calls));
        encryptedBlocksChecked += prior[i]?.reasoning_details?.filter(b => b.type === "reasoning.encrypted" && b.format === "meta-responses-v1" && Boolean(b.data)).length ?? 0;
        for (const call of prior[i]?.tool_calls ?? []) {
          const results = exchange.request.messages.filter(m => m.role === "tool" && m.tool_call_id === call.id);
          expect(results.length).toBe(1);
        }
      }
      const message = exchange.response.choices[0]?.message;
      if (!message) throw new Error("Missing assistant response");
      prior.push(message);
    }
    expect(encryptedBlocksChecked).toBeGreaterThan(0);
    const mayIRequest = treatment.exchanges[firstCount]!.request;
    const nextTurnRequest = treatment.exchanges[secondCount]!.request;
    expect(mayIRequest.tools.map(t => t.function.name)).toEqual(["call_may_i", "pass_may_i"]);
    expect(nextTurnRequest.tools.map(t => t.function.name)).toContain("draw_from_stock");
    expect(nextTurnRequest.tools.map(t => t.function.name)).not.toContain("pass_may_i");
    const observations = nextTurnRequest.messages.filter(m => m.role === "user").map(m => textDigest(contentText(m.content)));
    expect(observations).toEqual([observation1, observation2, observation3].map(textDigest));
    for (const index of [firstCount - 1, secondCount - 1]) {
      const terminal = treatment.exchanges[index]!.response.choices[0]!.message.tool_calls!.at(-1)!;
      const next = treatment.exchanges[index + 1]!.request;
      const terminalResults = next.messages.filter(m => m.role === "tool" && m.tool_call_id === terminal.id);
      expect(terminalResults.length).toBe(1);
      const output = JSON.parse(contentText(terminalResults[0]!.content));
      expect(output.success === true && output.turnComplete === true).toBe(true);
    }
    expect(treatment.state.attempts.every(a => a.ok)).toBe(true);
    const artifact = {
      createdAt: new Date().toISOString(), model: modelConfig.configuration, modelConfigurationSha256: modelConfig.sha256,
      firstRequestWireEquivalent: true, catalogSettingsVerifiedOnWire: true, exactPerAssistantReasoningReplay: true, exactToolCallResultLinkage: true,
      exactObservationSequence: true, terminalResultsExactlyOnce: true, toolSetTransitions: ["ordinary", "may-i", "ordinary"],
      encryptedBlocksChecked, decisions: [first, second, third].map(r => ({ success: r.success, trace: r.decisionContextTrace, metrics: r.metrics })),
      exchanges: treatment.exchanges.map(e => ({ responseId: e.response.id, requestBodySha256: e.requestBodySha256, messageCount: e.request.messages.length, usage: e.response.usage })),
      control: { firstRequestBodySha256: control.exchanges[0]?.requestBodySha256, success: controlFirst.success, trace: controlFirst.decisionContextTrace, metrics: controlFirst.metrics },
      limits: "Real provider and real player APIs, no mocks. Transport proof only, using test instructions; not gameplay improvement. Opaque payloads and credentials omitted.",
    };
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    await Bun.write(`.data/ai-evals/hand-conversation-v1-20260904/player-wire-proof-${stamp}.json`, JSON.stringify(artifact, null, 2));
  } finally { treatment.engine.stop(); control.engine.stop(); }
}, 60_000);
