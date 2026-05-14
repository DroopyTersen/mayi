import {
  executeStoredGameAction,
  type ExecuteStoredGameActionResult,
} from "./game-action-executor";
import type { GameActionQueue } from "./game-action-queue";
import type { RoomPhase } from "./mayi-room.message-handlers";
import type { StoredGameState } from "./party-game-adapter";
import type { GameAction } from "./protocol.types";

export interface SubmitQueuedGameActionInput {
  queue: GameActionQueue;
  getRoomPhase: () => Promise<RoomPhase>;
  callerPlayerId: string | null;
  action: GameAction;
  getState: () => Promise<StoredGameState | null>;
  setState: (state: StoredGameState) => Promise<void>;
}

export function submitQueuedGameAction(
  input: SubmitQueuedGameActionInput
): Promise<ExecuteStoredGameActionResult> {
  return input.queue.enqueue(async () => {
    const roomPhase = await input.getRoomPhase();
    return executeStoredGameAction({
      roomPhase,
      callerPlayerId: input.callerPlayerId,
      action: input.action,
      getState: input.getState,
      setState: input.setState,
    });
  });
}
