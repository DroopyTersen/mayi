import { expect, it } from "bun:test";
import { buildSystemPrompt } from "../mayIAgent.prompt";
import { MAYI_AI_PROMPT_VERSION } from "../mayIAgent.prompt-version";
import { loadAIPlayerEvalPromptSelection } from "./ai-player-eval-prompt";
import { parseAIPlayerShortRolloutRunnerArguments, selectAIPlayerShortRolloutSystemPrompt } from "./ai-player-short-rollout-runner";

it("adds a short opponent-opportunity check only to experimental player guidance", async () => {
  const base = { baseVersion: MAYI_AI_PROMPT_VERSION, baseContent: buildSystemPrompt() };
  const control = await loadAIPlayerEvalPromptSelection({ ...base, experiment: undefined });
  const candidate = await loadAIPlayerEvalPromptSelection({ ...base, experiment: {
    id: "public-opportunity-check-v1",
    addendumFile: "ai/evals/prompts/public-opportunity-check-v1.md",
  } });
  expect(candidate.components?.houseRules).toEqual(control.components?.houseRules);
  expect(candidate.components?.toolProtocol).toEqual(control.components?.toolProtocol);
  expect(candidate.components?.playerGuidance.sha256).not.toBe(control.components?.playerGuidance.sha256);
  const guidance = /<player_guidance[^>]*>([\s\S]*?)<\/player_guidance>/;
  expect(candidate.content.match(guidance)?.[1]).toContain(control.content.match(guidance)?.[1]?.trim() ?? "missing");
  const addendum = candidate.experiment?.content ?? "";
  expect(addendum).toContain("already");
  expect(addendum).toContain("enable");
  expect(addendum).toContain("next own turn");
  expect(addendum).toContain("public evidence");
  expect(addendum).toContain("unknown");
  expect(addendum).toContain("win now");
  expect(addendum.split(/\s+/).length).toBeLessThanOrEqual(240);
  expect(addendum).not.toMatch(/contested-run|contract-horizon|shared-run|eval-player|diamonds|spades|87|95|strategy_note/);
  expect(control.content).not.toContain(addendum);

  const args = parseAIPlayerShortRolloutRunnerArguments([
    "--prompt-experiment", "public-opportunity-check-v1",
    "--prompt-addendum-file", "ai/evals/prompts/public-opportunity-check-v1.md",
    "--prompt-scope", "all-candidate-decisions",
  ]);
  expect(args.scratchpad).toBeUndefined();
  expect(args.tacticalPresentation).toBeUndefined();
  expect(args.candidateId).toBe("spark-low");
  for (const kind of ["candidate-turn", "candidate-response", "candidate-may-i"] as const) {
    expect(selectAIPlayerShortRolloutSystemPrompt(kind, control.content, candidate.content, args.promptExperimentScope)).toBe(candidate.content);
  }
});
