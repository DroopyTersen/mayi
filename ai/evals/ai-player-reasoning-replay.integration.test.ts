import { expect, it } from "bun:test";
import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";
import { createAIPlayerEvalModel } from "./ai-player-fixed-state-runner";
import { AI_PLAYER_EVAL_CANDIDATES } from "./ai-player-eval-candidates";

const live = process.env.RUN_MUSE_REPLAY_TESTS === "1" && Boolean(process.env.OPENROUTER_API_KEY);
const reasoningBlock = z.object({ type: z.string(), format: z.string().optional(), id: z.string().optional(), data: z.string().optional() }).passthrough();
const requestSchema = z.object({ model: z.string(), reasoning: z.object({ effort: z.string(), exclude: z.boolean() }), messages: z.array(z.object({ role: z.string(), reasoning_details: z.array(reasoningBlock).optional() }).passthrough()) });
const responseSchema = z.object({ id: z.string(), model: z.string(), provider: z.string().optional(), choices: z.array(z.object({ message: z.object({ reasoning_details: z.array(reasoningBlock).optional() }).passthrough() })), usage: z.unknown().optional() });
const digest = (value: unknown) => new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex");
const decode = (body: unknown): unknown => typeof body === "string" ? JSON.parse(body) : body;

it.skipIf(!live)("preserves exact encrypted Meta blocks through real AI SDK tool steps and caller-managed follow-up history", async () => {
  const model = createAIPlayerEvalModel(AI_PLAYER_EVAL_CANDIDATES["spark-low"], { retainReasoning: true });
  const submissions: number[] = [];
  const tools = { submit: tool({ description: "Submit the calculated integer.", inputSchema: z.object({ value: z.number().int() }), execute: async ({ value }) => { submissions.push(value); return { accepted: true, next: "Add 137 to the submitted integer and submit that result." }; } }) };
  const prompt = "Compute 37*43 + 29*31 and submit the integer. Then follow the tool result once and submit the new integer. Do not narrate reasoning.";
  const first = await generateText({ model, prompt, tools, toolChoice: "auto", stopWhen: stepCountIs(2), include: { requestBody: true, responseBody: true }, maxRetries: 0, abortSignal: AbortSignal.timeout(60_000) }).catch(error => { throw new Error(error instanceof Error ? error.message : String(error)); });
  const firstStep = first.steps[0], secondStep = first.steps[1];
  if (!firstStep || !secondStep) throw new Error("Expected two real provider steps");
  const requests = first.steps.map(s => requestSchema.parse(decode(s.request.body)));
  const responses = first.steps.map(s => responseSchema.parse(s.response.body));
  const firstBlocks = responses[0]?.choices[0]?.message.reasoning_details ?? [];
  const probeStamp = new Date().toISOString().replace(/[:.]/g, "-");
  await Bun.write(`.data/ai-evals/muse-continuity-feasibility-20260904/sdk-observation-${probeStamp}.json`, JSON.stringify({
    requests: requests.map(r => ({ model: r.model, reasoning: r.reasoning, messages: r.messages.map(m => ({ role: m.role, reasoning: m.reasoning_details?.map(b => ({ type: b.type, format: b.format, dataLength: b.data?.length })) })) })),
    responses: responses.map(r => ({ id: r.id, model: r.model, provider: r.provider, usage: r.usage, messages: r.choices.map(c => ({ keys: Object.keys(c.message), reasoning: c.message.reasoning_details?.map(b => ({ type: b.type, format: b.format, dataLength: b.data?.length })) })) })),
    submissions,
  }, null, 2));
  expect(firstBlocks.some(b => b.type === "reasoning.encrypted" && b.format === "meta-responses-v1" && Boolean(b.data))).toBe(true);
  expect(digest(requests[1]?.messages.find(m => m.role === "assistant")?.reasoning_details)).toBe(digest(firstBlocks));
  expect(submissions).toEqual([2490, 2627]);
  for (const request of requests) expect(request.reasoning).toEqual({ effort: "low", exclude: false });

  // Feasibility only: explicitly supply history; the game player does not yet do this.
  const second = await generateText({ model, messages: [{ role: "user", content: prompt }, ...first.responseMessages, { role: "user", content: "Ignore the last tool next instruction. Add 17 to the most recent submitted value and submit it." }], tools, toolChoice: "auto", stopWhen: stepCountIs(1), include: { requestBody: true, responseBody: true }, maxRetries: 0, abortSignal: AbortSignal.timeout(60_000) }).catch(error => { throw new Error(error instanceof Error ? error.message : String(error)); });
  const replay = requestSchema.parse(decode(second.finalStep.request.body));
  expect(submissions).toEqual([2490, 2627, 2644]);
  const replayBlocks = replay.messages.filter(m => m.role === "assistant").flatMap(m => m.reasoning_details ?? []);
  const emittedBlocks = responses.flatMap(r => r.choices[0]?.message.reasoning_details ?? []);
  expect(digest(replayBlocks)).toBe(digest(emittedBlocks));
  // A response may contain several consecutive encrypted items, not one per call.
  expect(replayBlocks.filter(b => b.type === "reasoning.encrypted").length).toBeGreaterThanOrEqual(2);
  const summary = {
    createdAt: new Date().toISOString(), model: replay.model, provider: responses[0]?.provider,
    exactWithinTurnReplay: true, exactCallerManagedCrossCallReplay: true, submissions,
    steps: first.steps.map((s, i) => ({ id: s.response.id, reasoning: requests[i]?.reasoning, receivedBlockHash: digest(responses[i]?.choices[0]?.message.reasoning_details ?? []), usage: responses[i]?.usage })),
    crossCall: { id: second.finalStep.response.id, replayedBlockHash: digest(replayBlocks), blockCount: replayBlocks.length, usage: second.usage },
    caveat: "Real HTTP through installed AI SDK/provider, no mocks. Confirms opaque blocks are returned and sent unmodified; does not prove causal gameplay benefit or inspect internal reasoning. No game cross-turn memory implemented.",
  };
  const runStamp = new Date().toISOString().replace(/[:.]/g, "-");
  await Bun.write(`.data/ai-evals/muse-continuity-feasibility-20260904/sdk-tool-replay-${runStamp}.json`, JSON.stringify(summary, null, 2));
}, 60_000);
