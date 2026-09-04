import { expect, it } from "bun:test";
import { buildSystemPrompt } from "../mayIAgent.prompt";
import { MAYI_AI_PROMPT_VERSION } from "../mayIAgent.prompt-version";
import {
  createAIPlayerEvalPromptSelection,
  loadAIPlayerEvalPromptSelection,
} from "./ai-player-eval-prompt";

it("loads conditional plan valuation solely into player guidance, preserving rules and organization", async () => {
  const baseContent = buildSystemPrompt();
  const baseline = createAIPlayerEvalPromptSelection({
    baseVersion: MAYI_AI_PROMPT_VERSION,
    baseContent,
  });
  const experiment = await loadAIPlayerEvalPromptSelection({
    baseVersion: MAYI_AI_PROMPT_VERSION,
    baseContent,
    experiment: {
      id: "conditional-plan-value-v1",
      addendumFile: "ai/evals/prompts/conditional-plan-value-v1.md",
    },
  });
  expect(experiment.components?.houseRules).toEqual(baseline.components?.houseRules);
  expect(experiment.components?.toolProtocol).toEqual(baseline.components?.toolProtocol);
  expect(experiment.components?.playerGuidance.sha256).not.toBe(baseline.components?.playerGuidance.sha256);
  const organization = (text: string) => text.match(
    /## Hand organization policy\n([\s\S]*?)\n## Action preferences/,
  )?.[1];
  expect(organization(experiment.content)).toBe(organization(baseContent));
  const addendum = experiment.experiment?.content ?? "";
  expect(addendum).toContain("conditional preferences");
  expect(addendum).toContain("next own turn");
  expect(addendum).toContain("public evidence");
  expect(addendum).not.toMatch(/contested-run|contract-horizon|shared-run|eval-player|diamonds|spades|87|95/);
  expect(experiment.content).toContain(addendum);
});
