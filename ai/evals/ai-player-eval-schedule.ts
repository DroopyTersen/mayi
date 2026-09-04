export const AI_PLAYER_EVAL_EXECUTION_SCHEDULE_VERSION =
  "rotating-interleaved-v1";

export interface AIPlayerEvalExecutionScheduleEntry<
  CandidateId extends string = string,
  ScenarioId extends string = string,
> {
  candidateId: CandidateId;
  scenarioId: ScenarioId;
  repetition: number;
}

export function createAIPlayerEvalExecutionSchedule<
  CandidateId extends string,
  ScenarioId extends string,
>(
  candidateIds: readonly CandidateId[],
  scenarioIds: readonly ScenarioId[],
  repetitions: number,
): Array<AIPlayerEvalExecutionScheduleEntry<CandidateId, ScenarioId>> {
  if (!Number.isInteger(repetitions) || repetitions <= 0) {
    throw new Error("Repetitions must be a positive integer");
  }
  if (candidateIds.length === 0) {
    throw new Error("At least one candidate is required");
  }

  const schedule: Array<
    AIPlayerEvalExecutionScheduleEntry<CandidateId, ScenarioId>
  > = [];
  let matchedCaseIndex = 0;
  for (let repetition = 1; repetition <= repetitions; repetition++) {
    for (const scenarioId of scenarioIds) {
      const leadIndex = matchedCaseIndex % candidateIds.length;
      for (let offset = 0; offset < candidateIds.length; offset++) {
        const candidateId =
          candidateIds[(leadIndex + offset) % candidateIds.length];
        if (candidateId === undefined) {
          throw new Error("Evaluation schedule candidate index is invalid");
        }
        schedule.push({ candidateId, scenarioId, repetition });
      }
      matchedCaseIndex++;
    }
  }
  return schedule;
}
