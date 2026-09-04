import { expect, test } from "bun:test";
import { MAYI_NOTEBOOK_GUIDANCE, MAYI_NOTEBOOK_EXAMPLES, buildMayINotebookGuidance } from "./mayIAgent.notebook-guidance";
import { parseAIStrategyNote } from "./mayIAgent.scratchpad";
import { buildSystemPrompt } from "./mayIAgent.prompt";
import { createAIPlayerEvalPromptSelection } from "./evals/ai-player-eval-prompt";

test("notebook instructions reuse private model-written memory and distinguish facts from beliefs", () => {
  for (const label of ["Observed:", "Suspected:", "Plan:", "Reconsider:"]) expect(MAYI_NOTEBOOK_GUIDANCE).toContain(label);
  expect(MAYI_NOTEBOOK_GUIDANCE).toContain("strategy_note");
  expect(MAYI_NOTEBOOK_GUIDANCE).toContain("400 characters");
  expect(MAYI_NOTEBOOK_GUIDANCE).toContain("public history");
  expect(MAYI_NOTEBOOK_GUIDANCE).toContain("not verified facts");
  expect(MAYI_NOTEBOOK_GUIDANCE).toContain("your own hand or public observations");
});

test("worked examples fit the existing two-line notebook without embedding benchmark identities", () => {
  expect(MAYI_NOTEBOOK_EXAMPLES.length).toBeGreaterThanOrEqual(4);
  for (const example of MAYI_NOTEBOOK_EXAMPLES) {
    expect(parseAIStrategyNote(example.note)).toBe(example.note);
    expect(example.note.split("\n")).toHaveLength(2);
    expect(example.observation.length).toBeGreaterThan(20);
    expect(example.decision.length).toBeGreaterThan(20);
  }
  expect(buildMayINotebookGuidance(true).startsWith(buildMayINotebookGuidance(false))).toBe(true);
  expect(buildMayINotebookGuidance(false)).not.toContain("Worked examples");
  expect(buildMayINotebookGuidance(true)).toContain("Worked examples");
  expect(buildMayINotebookGuidance(true)).not.toMatch(/eval-player|contested-run|contract-horizon|shared-run|future-p1-draw|fixture|rubric/);
});

test("both notebook variants preserve the baseline rules, tactical guidance and organization", () => {
  const baseContent = buildSystemPrompt();
  const baseline = createAIPlayerEvalPromptSelection({ baseContent, baseVersion: "test" });
  for (const examples of [false, true]) {
    const selection = createAIPlayerEvalPromptSelection({ baseContent, baseVersion: "test", experiment: { id: "notebook-test", sourcePath: "test", addendum: buildMayINotebookGuidance(examples) } });
    expect(selection.components?.houseRules).toEqual(baseline.components?.houseRules);
    expect(selection.components?.toolProtocol).toEqual(baseline.components?.toolProtocol);
    expect(selection.content.replace(/\n<evaluation_strategy_experiment[\s\S]*?<\/evaluation_strategy_experiment>\n/, "").replace('player-guidance-v1+notebook-test', 'player-guidance-v1')).toBe(baseContent);
  }
});
