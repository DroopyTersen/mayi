import type { GameSnapshot } from "../../core/engine/game-engine.types";
import {
  validateCardZones,
  zonesFromGameSnapshot,
  type CardInvariantReport,
} from "../../core/engine/card-state.invariants";
import {
  handleGameActionMessage,
  type GameActionDomainEvent,
  type RoomPhase,
} from "./mayi-room.message-handlers";
import { PartyGameAdapter, type StoredGameState } from "./party-game-adapter";
import type { GameAction } from "../../core/engine/game-action.command";
import type { ErrorMessage } from "./protocol.types";

export interface ExecuteStoredGameActionInput {
  roomPhase: RoomPhase;
  callerPlayerId: string | null;
  action: GameAction;
  getState: () => Promise<StoredGameState | null>;
  setState: (state: StoredGameState) => Promise<void>;
}

export type ExecuteStoredGameActionResult =
  | {
      ok: false;
      state: null;
      snapshot: null;
      revisionBefore: number | null;
      revisionAfter: null;
      outboundMessages: [ErrorMessage];
      sideEffects: [];
      invariantReport?: CardInvariantReport;
    }
  | {
      ok: true;
      state: StoredGameState;
      snapshot: GameSnapshot;
      revisionBefore: number;
      revisionAfter: number;
      outboundMessages: [];
      sideEffects: GameActionDomainEvent[];
    };

function buildErrorMessage(error: string, message: string): ErrorMessage {
  return { type: "ERROR", error, message };
}

function revisionOf(state: StoredGameState | null): number {
  return state?.revision ?? 0;
}

function validateStoredGameState(state: StoredGameState): {
  snapshot: GameSnapshot;
  invariantReport: CardInvariantReport;
} {
  const adapter = PartyGameAdapter.fromStoredState(state);
  const snapshot = adapter.getSnapshot();
  return {
    snapshot,
    invariantReport: validateCardZones(zonesFromGameSnapshot(snapshot)),
  };
}

function removeCommittedStateEvent(
  sideEffects: GameActionDomainEvent[]
): GameActionDomainEvent[] {
  return sideEffects.filter((effect) => effect.type !== "gameStateCommitted");
}

export async function executeStoredGameAction(
  input: ExecuteStoredGameActionInput
): Promise<ExecuteStoredGameActionResult> {
  const currentState = await input.getState();
  const revisionBefore = currentState ? revisionOf(currentState) : null;

  const result = handleGameActionMessage({
    state: {
      roomPhase: input.roomPhase,
      callerPlayerId: input.callerPlayerId,
      gameState: currentState,
      action: input.action,
    },
  });

  if (!result.ok) {
    return {
      ok: false,
      state: null,
      snapshot: null,
      revisionBefore,
      revisionAfter: null,
      outboundMessages: result.outboundMessages,
      sideEffects: [],
    };
  }

  const revisionAfter = revisionOf(currentState) + 1;
  const nextState: StoredGameState = {
    ...result.nextState.gameState,
    revision: revisionAfter,
  };
  const { snapshot, invariantReport } = validateStoredGameState(nextState);

  if (!invariantReport.ok) {
    return {
      ok: false,
      state: null,
      snapshot: null,
      revisionBefore: revisionOf(currentState),
      revisionAfter: null,
      outboundMessages: [
        buildErrorMessage(
          "CARD_INVARIANT_VIOLATION",
          "Action produced invalid card state"
        ),
      ],
      sideEffects: [],
      invariantReport,
    };
  }

  await input.setState(nextState);

  return {
    ok: true,
    state: nextState,
    snapshot,
    revisionBefore: revisionOf(currentState),
    revisionAfter,
    outboundMessages: [],
    sideEffects: removeCommittedStateEvent(result.sideEffects),
  };
}
