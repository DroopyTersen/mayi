import { afterEach, describe, expect, it } from "bun:test";
import {
  AI_PLAYER_FIXED_STATE_SUITE_VERSION,
  AI_PLAYER_FIXED_STATE_RUNTIME_VERSION,
  AI_PLAYER_FIXED_STATE_SCENARIOS,
  createAIPlayerFixedStateRuntime,
  getAIPlayerFixedStateInputForRepetition,
  getAIPlayerFixedStateScenario,
} from "./ai-player-fixed-state-scenarios";
import { scoreAIPlayerEvalCase } from "./ai-player-eval-score";

describe("AI player fixed-state scenarios", () => {
  const actors: Array<{ stop: () => void }> = [];

  afterEach(() => {
    for (const actor of actors) actor.stop();
    actors.length = 0;
  });

  it("has a stable, weighted development and holdout catalog", () => {
    expect(AI_PLAYER_FIXED_STATE_RUNTIME_VERSION).toBe(
      "fixed-state-runtime-v4",
    );
    expect(AI_PLAYER_FIXED_STATE_SUITE_VERSION).toBe("fixed-state-v2");
    expect(AI_PLAYER_FIXED_STATE_SCENARIOS.length).toBeGreaterThanOrEqual(20);
    expect(
      AI_PLAYER_FIXED_STATE_SCENARIOS.some(
        (scenario) => scenario.identity.split === "development",
      ),
    ).toBe(true);
    expect(
      AI_PLAYER_FIXED_STATE_SCENARIOS.some(
        (scenario) => scenario.identity.split === "holdout",
      ),
    ).toBe(true);

    const ids = AI_PLAYER_FIXED_STATE_SCENARIOS.map(
      (scenario) => scenario.identity.id,
    );
    expect(ids).toEqual(
      expect.arrayContaining([
        "draw-discard-completes-contract",
        "claim-may-i-completes-contract",
        "multi-deck-duplicate-set-contract",
        "same-suit-gap-negative-control",
        "wild-ratio-valid-contract",
        "wild-ratio-negative-control",
        "ace-high-run-contract",
        "ace-low-negative-control",
        "same-suit-gap-exact-two-contract",
        "layoff-all-to-go-out",
        "down-player-stock-only",
        "round6-decline-may-i",
      ]),
    );
    expect(new Set(ids).size).toBe(ids.length);
    expect(
      getAIPlayerFixedStateScenario("ace-high-run-contract").identity.split,
    ).toBe("holdout");
    expect(
      getAIPlayerFixedStateScenario("ace-low-negative-control").identity.split,
    ).toBe("development");

    for (const scenario of AI_PLAYER_FIXED_STATE_SCENARIOS) {
      expect(
        scenario.rubric.reduce(
          (total, criterion) => total + criterion.weight,
          0,
        ),
      ).toBe(100);
      expect(scenario.rubric.every((criterion) => criterion.weight > 0)).toBe(
        true,
      );
    }
  });

  it("seeds every eval fixture without changing explicit seeds or the source input", () => {
    const scenario = getAIPlayerFixedStateScenario("draw-stock-safe-discard");
    const original = structuredClone(scenario.input);
    for (const repetition of [1, 2, 3, 4]) {
      expect(getAIPlayerFixedStateInputForRepetition(scenario, repetition).seed).toBe(
        `fixed-state:${scenario.identity.id}`,
      );
      expect(getAIPlayerFixedStateInputForRepetition({
        ...scenario,
        input: { ...scenario.input, seed: "explicit-fixture-seed" },
      }, repetition).seed).toBe("explicit-fixture-seed");
    }
    expect(scenario.input).toEqual(original);
    expect(getAIPlayerFixedStateInputForRepetition({
      ...scenario,
      input: { ...scenario.input, predefinedState: undefined },
    }, 1).seed).toBe(`fixed-state:${scenario.identity.id}`);
  });

  it("has a legal, full-credit reference trajectory for every scenario", async () => {
    for (const scenario of AI_PLAYER_FIXED_STATE_SCENARIOS) {
      const referenceActions = Reflect.get(
        scenario,
        "referenceActions",
      ) as unknown;
      expect(Array.isArray(referenceActions)).toBe(true);
      if (!Array.isArray(referenceActions)) continue;

      for (const repetition of [1, 2]) {
        const state = createAIPlayerFixedStateRuntime(scenario, repetition);
        actors.push(state.actor);
        for (const action of referenceActions) {
          const result = await state.runtime.executeAction(action);
          expect(result.ok).toBe(true);
        }

        const after = await state.runtime.getSnapshot();
        expect(
          scenario
            .grade(after, state.attempts)
            .every((criterion) => criterion.passed),
        ).toBe(true);
      }
    }
  });

  it("uses deterministic, paired hand-order variants across repetitions", () => {
    const scenario = getAIPlayerFixedStateScenario("round6-all-cards");
    const original = scenario.input.predefinedState?.hands[0]?.map(
      (card) => card.id,
    );
    const first = getAIPlayerFixedStateInputForRepetition(scenario, 1);
    const secondA = getAIPlayerFixedStateInputForRepetition(scenario, 2);
    const secondB = getAIPlayerFixedStateInputForRepetition(scenario, 2);

    expect(first.predefinedState?.hands[0]?.map((card) => card.id)).toEqual(
      original,
    );
    expect(secondA.predefinedState?.hands[0]?.map((card) => card.id)).toEqual(
      secondB.predefinedState?.hands[0]?.map((card) => card.id),
    );
    expect(
      secondA.predefinedState?.hands[0]?.map((card) => card.id),
    ).not.toEqual(original);
  });

  it("can evaluate an explicitly selected off-turn May I caller", async () => {
    const scenario = getAIPlayerFixedStateScenario("draw-stock-safe-discard");
    const state = createAIPlayerFixedStateRuntime(scenario, 1, "eval-player-1");
    actors.push(state.actor);

    const result = await state.runtime.executeAction({ type: "CALL_MAY_I" });
    const after = await state.runtime.getSnapshot();

    expect(result.ok).toBe(true);
    expect(after.phase).toBe("RESOLVING_MAY_I");
    expect(after.mayIContext?.originalCaller).toBe("eval-player-1");
  });

  it("does not count timestamp-only projection changes as an accepted action", async () => {
    const scenario = getAIPlayerFixedStateScenario("draw-stock-safe-discard");
    const state = createAIPlayerFixedStateRuntime(scenario);
    actors.push(state.actor);

    const result = await state.runtime.executeAction({ type: "CALL_MAY_I" });

    expect(result.ok).toBe(false);
    expect(state.attempts).toEqual([
      {
        action: { type: "CALL_MAY_I" },
        ok: false,
        error: "CANNOT_CALL_MAY_I_ON_OWN_TURN",
      },
    ]);
  });

  it("forwards free hand reordering through the fixed-state runtime", async () => {
    const scenario = getAIPlayerFixedStateScenario("draw-stock-safe-discard");
    const state = createAIPlayerFixedStateRuntime(scenario);
    actors.push(state.actor);

    expect(
      (await state.runtime.executeAction({ type: "DRAW_FROM_STOCK" })).ok,
    ).toBe(true);
    const drawn = await state.runtime.getSnapshot();
    const reorderedIds = [...(drawn.players[0]?.hand ?? [])]
      .reverse()
      .map((card) => card.id);

    const result = await state.runtime.executeAction({
      type: "REORDER_HAND",
      cardIds: reorderedIds,
    });
    const after = await state.runtime.getSnapshot();

    expect(result.ok).toBe(true);
    expect(after.players[0]?.hand.map((card) => card.id)).toEqual(reorderedIds);
    const noOp = await state.runtime.executeAction({
      type: "REORDER_HAND",
      cardIds: reorderedIds,
    });
    expect(noOp.ok).toBe(true);
    const invalid = await state.runtime.executeAction({
      type: "REORDER_HAND",
      cardIds: [...reorderedIds.slice(1), "not-in-this-hand"],
    });
    expect(invalid.ok).toBe(false);
  });

  it("grades taking an exposed card that immediately completes the contract", async () => {
    const scenario = getAIPlayerFixedStateScenario(
      "draw-discard-completes-contract",
    );
    const state = createAIPlayerFixedStateRuntime(scenario);
    actors.push(state.actor);

    expect(
      (await state.runtime.executeAction({ type: "DRAW_FROM_DISCARD" })).ok,
    ).toBe(true);
    expect(
      (
        await state.runtime.executeAction({
          type: "LAY_DOWN",
          melds: [
            { type: "set", cardIds: ["p0-9c", "p0-9d", "p0-9h"] },
            {
              type: "set",
              cardIds: ["p0-kc", "p0-kd", "discard-k"],
            },
          ],
        })
      ).ok,
    ).toBe(true);

    const after = await state.runtime.getSnapshot();
    expect(
      scenario
        .grade(after, state.attempts)
        .every((criterion) => criterion.passed),
    ).toBe(true);
  });

  it("grades blocking a May I caller when the exposed card completes the contract", async () => {
    const scenario = getAIPlayerFixedStateScenario(
      "claim-may-i-completes-contract",
    );
    const state = createAIPlayerFixedStateRuntime(scenario);
    actors.push(state.actor);

    expect(
      (await state.runtime.executeAction({ type: "CLAIM_MAY_I" })).ok,
    ).toBe(true);

    const after = await state.runtime.getSnapshot();
    expect(scenario.grade(after, state.attempts)).toEqual([
      expect.objectContaining({
        id: "claim-contract-card",
        passed: true,
      }),
    ]);
  });

  it("grades the invalid same-suit gap as a negative control", async () => {
    const scenario = getAIPlayerFixedStateScenario(
      "same-suit-gap-negative-control",
    );
    const state = createAIPlayerFixedStateRuntime(scenario);
    actors.push(state.actor);

    await state.runtime.executeAction({ type: "DRAW_FROM_STOCK" });
    await state.runtime.executeAction({ type: "SKIP" });
    await state.runtime.executeAction({ type: "DISCARD", cardId: "stock-a" });

    const after = await state.runtime.getSnapshot();
    expect(state.attempts.every((attempt) => attempt.ok)).toBe(true);
    expect(scenario.grade(after, state.attempts)).toEqual([
      expect.objectContaining({
        id: "do-not-lay-invalid-gap",
        passed: true,
      }),
    ]);
  });

  it("grades a legal contract that uses balanced wild cards", async () => {
    const scenario = getAIPlayerFixedStateScenario("wild-ratio-valid-contract");
    const state = createAIPlayerFixedStateRuntime(scenario);
    actors.push(state.actor);

    await state.runtime.executeAction({ type: "DRAW_FROM_STOCK" });
    expect(
      (
        await state.runtime.executeAction({
          type: "LAY_DOWN",
          melds: [
            { type: "set", cardIds: ["p0-7c", "p0-7d", "p0-wild-2"] },
            { type: "set", cardIds: ["p0-qc", "p0-qd", "p0-wild-joker"] },
          ],
        })
      ).ok,
    ).toBe(true);

    const after = await state.runtime.getSnapshot();
    expect(
      scenario
        .grade(after, state.attempts)
        .every((criterion) => criterion.passed),
    ).toBe(true);
  });

  it("grades the ace as high in a contract run", async () => {
    const scenario = getAIPlayerFixedStateScenario("ace-high-run-contract");
    const state = createAIPlayerFixedStateRuntime(scenario);
    actors.push(state.actor);

    await state.runtime.executeAction({ type: "DRAW_FROM_STOCK" });
    expect(
      (
        await state.runtime.executeAction({
          type: "LAY_DOWN",
          melds: [
            { type: "set", cardIds: ["p0-8c", "p0-8d", "p0-8s"] },
            {
              type: "run",
              cardIds: ["p0-hj", "p0-hq", "p0-hk", "p0-ha"],
            },
          ],
        })
      ).ok,
    ).toBe(true);

    const after = await state.runtime.getSnapshot();
    expect(
      scenario
        .grade(after, state.attempts)
        .every((criterion) => criterion.passed),
    ).toBe(true);
  });

  it("grades same-suit runs with an exact two-card gap as a legal contract", async () => {
    const scenario = getAIPlayerFixedStateScenario(
      "same-suit-gap-exact-two-contract",
    );
    const state = createAIPlayerFixedStateRuntime(scenario);
    actors.push(state.actor);

    await state.runtime.executeAction({ type: "DRAW_FROM_STOCK" });
    expect(
      (
        await state.runtime.executeAction({
          type: "LAY_DOWN",
          melds: [
            {
              type: "run",
              cardIds: ["p0-s3", "p0-s4", "p0-s5", "p0-s6"],
            },
            {
              type: "run",
              cardIds: ["p0-s9", "p0-s10", "p0-sj", "p0-sq"],
            },
          ],
        })
      ).ok,
    ).toBe(true);

    const after = await state.runtime.getSnapshot();
    expect(
      scenario
        .grade(after, state.attempts)
        .every((criterion) => criterion.passed),
    ).toBe(true);
  });

  it("grades laying off every remaining card to go out", async () => {
    const scenario = getAIPlayerFixedStateScenario("layoff-all-to-go-out");
    const state = createAIPlayerFixedStateRuntime(scenario);
    actors.push(state.actor);

    await state.runtime.executeAction({ type: "DRAW_FROM_STOCK" });
    await state.runtime.executeAction({
      type: "LAY_OFF",
      cardId: "p0-9s",
      meldId: "meld-nines",
    });
    await state.runtime.executeAction({
      type: "LAY_OFF",
      cardId: "p0-kh",
      meldId: "meld-kings",
    });
    expect(
      (
        await state.runtime.executeAction({
          type: "LAY_OFF",
          cardId: "stock-ks",
          meldId: "meld-kings",
        })
      ).ok,
    ).toBe(true);

    const after = await state.runtime.getSnapshot();
    expect(
      scenario
        .grade(after, state.attempts)
        .every((criterion) => criterion.passed),
    ).toBe(true);
  });

  it("grades the intended safe draw and discard through the real round machine", async () => {
    const scenario = getAIPlayerFixedStateScenario("draw-stock-safe-discard");
    const state = createAIPlayerFixedStateRuntime(scenario);
    actors.push(state.actor);

    expect(
      (await state.runtime.executeAction({ type: "DRAW_FROM_STOCK" })).ok,
    ).toBe(true);
    expect((await state.runtime.executeAction({ type: "SKIP" })).ok).toBe(true);
    expect(
      (
        await state.runtime.executeAction({
          type: "DISCARD",
          cardId: "stock-a",
        })
      ).ok,
    ).toBe(true);

    const after = await state.runtime.getSnapshot();
    const criteria = scenario.grade(after, state.attempts);
    expect(criteria.every((criterion) => criterion.passed)).toBe(true);
    expect(
      scoreAIPlayerEvalCase({
        schemaVersion: 1,
        runId: "test-run",
        candidate: {
          id: "spark-minimal",
          modelId: "default:meta",
          provider: "openrouter",
          reasoningEffort: "minimal",
          promptVersion: "house-rules-v3",
        },
        scenario: scenario.identity,
        repetition: 1,
        completed: true,
        legal: true,
        criteria,
        failureMode: "none",
        retries: 0,
        timing: {
          turnDurationMs: 1,
          providerDurationMs: 1,
          toolExecutionDurationMs: 0,
          orchestrationDurationMs: 0,
          pacingDelayMs: 0,
        },
        usage: {
          inputTokens: undefined,
          noCacheInputTokens: undefined,
          cacheReadInputTokens: undefined,
          cacheWriteInputTokens: undefined,
          outputTokens: undefined,
          reasoningOutputTokens: undefined,
          totalTokens: undefined,
        },
        providerReportedCostUsd: undefined,
        reconstructedCostUsd: undefined,
        inputState: "Rendered state shown to the evaluated player.",
        outcome: {
          phase: after.phase,
          turnPhase: after.turnPhase,
          awaitingPlayerId: after.awaitingPlayerId,
          evaluatedPlayerHandCardIds:
            after.players
              .find((player) => player.id === "eval-player-0")
              ?.hand.map((card) => card.id) ?? [],
          tableMeldCount: after.table.length,
          topDiscardCardId: after.discard[0]?.id ?? null,
          lastError: after.lastError,
        },
        actions: [],
        warnings: [],
      }).qualityPercent,
    ).toBe(100);
  });

  it("records a strategic failure even when every action is legal", async () => {
    const scenario = getAIPlayerFixedStateScenario("draw-stock-safe-discard");
    const state = createAIPlayerFixedStateRuntime(scenario);
    actors.push(state.actor);

    await state.runtime.executeAction({ type: "DRAW_FROM_STOCK" });
    await state.runtime.executeAction({ type: "SKIP" });
    await state.runtime.executeAction({ type: "DISCARD", cardId: "p0-q" });

    const after = await state.runtime.getSnapshot();
    const criteria = scenario.grade(after, state.attempts);
    expect(state.attempts.every((attempt) => attempt.ok)).toBe(true);
    expect(
      criteria.find((criterion) => criterion.id === "discard-liability"),
    ).toMatchObject({
      passed: false,
      evidence: "discarded p0-q instead of stock-a",
    });
  });
});
