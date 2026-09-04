import type { Card } from "../../core/card/card.types";
import type { GameSnapshot } from "../../core/engine/game-engine.types";
import type { Meld } from "../../core/meld/meld.types";
import type { AIActionRuntime, GameAction } from "../ai-action-runtime.types";

/** Evaluator evidence, never appended to the player's prompt. No hidden zones. */
export interface AIPlayerRolloutActionView {
  hand: Card[];
  isDown: boolean;
  discard: Card[];
  table: Meld[];
  roundNumber: number;
  turnNumber: number;
}

export interface AIPlayerRolloutActionEvidence {
  action: GameAction;
  ok: boolean;
  error?: string;
  before: AIPlayerRolloutActionView;
  after: AIPlayerRolloutActionView;
}

export class AIPlayerRolloutDecisionRecorder {
  private readonly records: AIPlayerRolloutActionEvidence[] = [];

  constructor(private readonly playerId: string) {}

  private view(snapshot: GameSnapshot): AIPlayerRolloutActionView {
    const player = snapshot.players.find(player => player.id === this.playerId);
    if (!player) throw new Error(`Missing evaluated player ${this.playerId}`);
    return structuredClone({
      hand: player.hand,
      isDown: player.isDown,
      discard: snapshot.discard,
      table: snapshot.table,
      roundNumber: snapshot.currentRound,
      turnNumber: snapshot.turnNumber,
    });
  }

  wrap(runtime: AIActionRuntime): AIActionRuntime {
    return {
      getSnapshot: () => runtime.getSnapshot(),
      executeAction: async action => {
        const before = this.view(await runtime.getSnapshot());
        const result = await runtime.executeAction(action);
        this.records.push({
          action: structuredClone(action),
          ok: result.ok,
          ...(result.ok ? {} : { error: result.error }),
          before,
          after: this.view(result.snapshot),
        });
        return result;
      },
    };
  }

  get evidence(): AIPlayerRolloutActionEvidence[] {
    return structuredClone(this.records);
  }
}
