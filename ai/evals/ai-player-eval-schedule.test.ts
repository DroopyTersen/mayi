import { describe, expect, it } from "bun:test";
import {
  AI_PLAYER_EVAL_EXECUTION_SCHEDULE_VERSION,
  createAIPlayerEvalExecutionSchedule,
} from "./ai-player-eval-schedule";

describe("AI player evaluation execution schedule", () => {
  it("interleaves matched cases and rotates the leading candidate", () => {
    expect(AI_PLAYER_EVAL_EXECUTION_SCHEDULE_VERSION).toBe(
      "rotating-interleaved-v1",
    );
    expect(
      createAIPlayerEvalExecutionSchedule(
        ["spark-minimal", "spark-medium", "spark-xhigh"],
        ["case-a", "case-b"],
        2,
      ),
    ).toEqual([
      { candidateId: "spark-minimal", scenarioId: "case-a", repetition: 1 },
      { candidateId: "spark-medium", scenarioId: "case-a", repetition: 1 },
      { candidateId: "spark-xhigh", scenarioId: "case-a", repetition: 1 },
      { candidateId: "spark-medium", scenarioId: "case-b", repetition: 1 },
      { candidateId: "spark-xhigh", scenarioId: "case-b", repetition: 1 },
      { candidateId: "spark-minimal", scenarioId: "case-b", repetition: 1 },
      { candidateId: "spark-xhigh", scenarioId: "case-a", repetition: 2 },
      { candidateId: "spark-minimal", scenarioId: "case-a", repetition: 2 },
      { candidateId: "spark-medium", scenarioId: "case-a", repetition: 2 },
      { candidateId: "spark-minimal", scenarioId: "case-b", repetition: 2 },
      { candidateId: "spark-medium", scenarioId: "case-b", repetition: 2 },
      { candidateId: "spark-xhigh", scenarioId: "case-b", repetition: 2 },
    ]);
  });

  it("schedules every candidate exactly once for every matched case", () => {
    const schedule = createAIPlayerEvalExecutionSchedule(
      ["a", "b", "c", "d"],
      ["x", "y", "z"],
      3,
    );
    expect(schedule).toHaveLength(36);

    for (let repetition = 1; repetition <= 3; repetition++) {
      for (const scenarioId of ["x", "y", "z"]) {
        expect(
          schedule
            .filter(
              (entry) =>
                entry.repetition === repetition &&
                entry.scenarioId === scenarioId,
            )
            .map((entry) => entry.candidateId)
            .sort(),
        ).toEqual(["a", "b", "c", "d"]);
      }
    }
  });

  it("rejects an invalid repetition count", () => {
    expect(() =>
      createAIPlayerEvalExecutionSchedule(["a"], ["x"], 0),
    ).toThrow("Repetitions must be a positive integer");
    expect(() =>
      createAIPlayerEvalExecutionSchedule([], ["x"], 1),
    ).toThrow("At least one candidate is required");
  });
});
