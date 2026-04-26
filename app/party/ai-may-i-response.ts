import type {
  AIActionResult,
  AIActionRuntime,
} from "../../ai/ai-action-runtime.types";
import type { AITurnResult } from "./ai-turn-handler";

export interface SettleAIMayIResponseInput {
  promptedEngineId: string;
  runtime: AIActionRuntime;
  executeResponse: () => Promise<AITurnResult>;
}

export interface SettleAIMayIResponseResult {
  turnResult: AITurnResult;
  defaultAllowed: boolean;
  defaultAllowResult?: AIActionResult;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function stillAwaitingPromptedAI(
  snapshot: Awaited<ReturnType<AIActionRuntime["getSnapshot"]>>,
  promptedEngineId: string
): boolean {
  return (
    snapshot.phase === "RESOLVING_MAY_I" &&
    snapshot.awaitingPlayerId === promptedEngineId
  );
}

export async function settleAIMayIResponse(
  input: SettleAIMayIResponseInput
): Promise<SettleAIMayIResponseResult> {
  let turnResult: AITurnResult;

  try {
    turnResult = await input.executeResponse();
  } catch (error) {
    turnResult = {
      success: false,
      actions: [],
      error: errorMessage(error),
    };
  }

  const snapshot = await input.runtime.getSnapshot();
  if (!stillAwaitingPromptedAI(snapshot, input.promptedEngineId)) {
    return {
      turnResult,
      defaultAllowed: false,
    };
  }

  const defaultAllowResult = await input.runtime.executeAction({ type: "ALLOW_MAY_I" });
  return {
    turnResult,
    defaultAllowed: true,
    defaultAllowResult,
  };
}
