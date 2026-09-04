import { describe, expect, it } from "bun:test";
import type { GameSnapshot } from "../../core/engine/game-engine.types";
import { outputGameStateForLLM } from "../mayIAgent.prompt-renderer";
import type { AIPlayerEvalCaseResult } from "./ai-player-eval-score";
import {
  AI_PLAYER_FIXED_STATE_SCENARIOS,
  createAIPlayerFixedStateRuntime,
  type AIPlayerFixedStateScenario,
} from "./ai-player-fixed-state-scenarios";
import {
  auditRecordedAIPlayerEvalCase,
  certifyFrozenLunaBaseline,
} from "./ai-player-luna-baseline-certifier";

function outcome(snapshot: GameSnapshot): AIPlayerEvalCaseResult["outcome"] {
  const evaluatedPlayer = snapshot.players.find(
    (player) => player.id === "eval-player-0",
  );
  return {
    phase: snapshot.phase,
    turnPhase: snapshot.turnPhase,
    awaitingPlayerId: snapshot.awaitingPlayerId,
    evaluatedPlayerHandCardIds:
      evaluatedPlayer?.hand.map((card) => card.id) ?? [],
    tableMeldCount: snapshot.table.length,
    topDiscardCardId: snapshot.discard[0]?.id ?? null,
    lastError: snapshot.lastError,
  };
}

async function referenceCase(
  scenario: AIPlayerFixedStateScenario,
  runId: string,
): Promise<AIPlayerEvalCaseResult> {
  const state = createAIPlayerFixedStateRuntime(scenario, 1);
  try {
    const before = await state.runtime.getSnapshot();
    for (const action of scenario.referenceActions) {
      await state.runtime.executeAction(action);
    }
    const after = await state.runtime.getSnapshot();
    return {
      schemaVersion: 1,
      runId,
      candidate: {
        id: "luna-xhigh-baseline",
        modelId: "default:openai",
        provider: "openai",
        reasoningEffort: "xhigh",
        promptVersion: "house-rules-v3",
      },
      scenario: scenario.identity,
      repetition: 1,
      completed: true,
      legal: state.attempts.every((attempt) => attempt.ok),
      criteria: scenario.grade(after, state.attempts),
      failureMode: "none",
      retries: 0,
      timing: {
        turnDurationMs: 8_000,
        providerDurationMs: 7_500,
        toolExecutionDurationMs: 100,
        orchestrationDurationMs: 400,
        pacingDelayMs: 0,
      },
      usage: {
        inputTokens: 1_000,
        noCacheInputTokens: 1_000,
        cacheReadInputTokens: 0,
        cacheWriteInputTokens: 0,
        outputTokens: 100,
        reasoningOutputTokens: 50,
        totalTokens: 1_100,
      },
      providerReportedCostUsd: undefined,
      reconstructedCostUsd: 0.001,
      inputState: outputGameStateForLLM(before, "eval-player-0", {
        actionLog: scenario.actionLog,
      }),
      outcome: outcome(after),
      actions: ["draw_from_stock({})", 'discard({"position":4})'],
      warnings: [],
    };
  } finally {
    state.actor.stop();
  }
}

function safeDiscardScenario(): AIPlayerFixedStateScenario {
  const scenario = AI_PLAYER_FIXED_STATE_SCENARIOS.find(
    (candidate) => candidate.identity.id === "draw-stock-safe-discard",
  );
  if (scenario === undefined) throw new Error("Missing safe-discard scenario");
  return scenario;
}

describe("frozen Luna baseline certification", () => {
  it("replays retained positional tool calls through the current harness", async () => {
    const scenario = safeDiscardScenario();
    const recorded = await referenceCase(scenario, "legacy-luna");

    await expect(
      auditRecordedAIPlayerEvalCase(recorded, scenario),
    ).resolves.toEqual({
      caseKey: "draw-stock-safe-discard:1",
      inputStateMatches: true,
      legalMatches: true,
      rubricMatches: true,
      outcomeMatches: true,
      passed: true,
    });
  });

  it("detects a retained action transcript that no longer reproduces", async () => {
    const scenario = safeDiscardScenario();
    const recorded = await referenceCase(scenario, "legacy-luna");
    recorded.actions = ["draw_from_stock({})", 'discard({"position":1})'];

    await expect(
      auditRecordedAIPlayerEvalCase(recorded, scenario),
    ).resolves.toMatchObject({
      caseKey: "draw-stock-safe-discard:1",
      inputStateMatches: true,
      legalMatches: true,
      rubricMatches: false,
      outcomeMatches: false,
      passed: false,
    });
  });

  it("replaces a repaired case and emits one current-harness baseline", async () => {
    const scenario = safeDiscardScenario();
    const primary = await referenceCase(scenario, "luna-original");
    primary.scenario = { ...primary.scenario, split: "holdout" };
    primary.reconstructedCostUsd = 0.001;
    const repaired = structuredClone(primary);
    repaired.runId = "luna-repair";
    repaired.reconstructedCostUsd = 0.002;

    const certified = await certifyFrozenLunaBaseline({
      runId: "luna-frozen-baseline-certified-v4",
      primary: { runId: "luna-original", cases: [primary] },
      replacements: [{ runId: "luna-repair", cases: [repaired] }],
      scenarios: [scenario],
      prompt: {
        version: "house-rules-v3",
        sha256: "prompt-sha",
        content: "frozen prompt",
      },
      certifiedAt: "2026-09-03T12:00:00.000Z",
    });

    expect(certified.manifest).toMatchObject({
      schemaVersion: 1,
      runId: "luna-frozen-baseline-certified-v4",
      harnessVersion: "ai-player-eval-harness-v3",
      suiteVersion: "fixed-state-v2",
      split: "all",
      certification: {
        certifiedAt: "2026-09-03T12:00:00.000Z",
        primaryRunId: "luna-original",
        replacementRunIds: ["luna-repair"],
        replayedCaseCount: 1,
        replacementCaseKeys: ["draw-stock-safe-discard:1"],
      },
    });
    const manifestCandidate = certified.manifest.candidates[0];
    expect(manifestCandidate.modelConfiguration.resolvedModelId).toBe(
      "gpt-5.6-luna",
    );
    expect(manifestCandidate.modelConfiguration.transport).toBe("responses");
    expect(manifestCandidate.modelConfigurationSha256).toMatch(
      /^[a-f0-9]{64}$/,
    );
    expect(certified.cases).toHaveLength(1);
    expect(certified.cases[0]).toMatchObject({
      runId: "luna-frozen-baseline-certified-v4",
      scenario: scenario.identity,
      reconstructedCostUsd: 0.002,
    });
    expect(certified.cases[0]?.candidate.modelConfigurationSha256).toBe(
      manifestCandidate.modelConfigurationSha256,
    );
    expect(certified.summary.candidates[0]).toMatchObject({
      candidateId: "luna-xhigh-baseline",
      caseCount: 1,
      qualityPercent: 100,
    });
  });

  it("refuses missing cases, unexpected replacements, and failed replays", async () => {
    const scenario = safeDiscardScenario();
    const primary = await referenceCase(scenario, "luna-original");
    const broken = structuredClone(primary);
    broken.actions = ["draw_from_stock({})", 'discard({"position":1})'];

    const baseOptions = {
      runId: "certified",
      prompt: {
        version: "house-rules-v3",
        sha256: "prompt-sha",
        content: "frozen prompt",
      },
      certifiedAt: "2026-09-03T12:00:00.000Z",
    } as const;

    await expect(
      certifyFrozenLunaBaseline({
        ...baseOptions,
        primary: { runId: "luna-original", cases: [] },
        replacements: [],
        scenarios: [scenario],
      }),
    ).rejects.toThrow(
      "Missing frozen baseline case: draw-stock-safe-discard:1",
    );

    await expect(
      certifyFrozenLunaBaseline({
        ...baseOptions,
        primary: { runId: "luna-original", cases: [primary] },
        replacements: [
          {
            runId: "unexpected-repair",
            cases: [
              {
                ...primary,
                scenario: { ...primary.scenario, id: "unknown-case" },
              },
            ],
          },
        ],
        scenarios: [scenario],
      }),
    ).rejects.toThrow("Unexpected replacement case: unknown-case:1");

    await expect(
      certifyFrozenLunaBaseline({
        ...baseOptions,
        primary: { runId: "luna-original", cases: [broken] },
        replacements: [],
        scenarios: [scenario],
      }),
    ).rejects.toThrow(
      "Frozen baseline replay failed for draw-stock-safe-discard:1",
    );
  });
});
