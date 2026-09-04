import type { GameSnapshot } from "../../core/engine/game-engine.types";
import { sortHandByRank, sortHandBySuit } from "../../core/engine/hand.reordering";
import type { AIActionRuntime, GameAction } from "../ai-action-runtime.types";
import { getAvailableToolNames } from "../mayIAgent.tool-availability";

/** One ordinary-turn invocation. Measures opportunities, never changes the hand. */
export class AIPlayerOrganizationTracker {
  private expected = false;
  private correct = false;

  constructor(
    private readonly initial: GameSnapshot,
    private readonly playerId: string,
    private readonly order: "rank" | "suit" =
      initial.currentRound === 1 || initial.currentRound === 4 ? "rank" : "suit",
  ) {
    this.observeOpportunity(initial);
  }

  get summary(): { expectedTurns: number; correctTurns: number } {
    return { expectedTurns: Number(this.expected), correctTurns: Number(this.correct) };
  }

  wrap(runtime: AIActionRuntime): AIActionRuntime {
    return {
      getSnapshot: () => runtime.getSnapshot(),
      executeAction: async (action) => {
        const before = await runtime.getSnapshot();
        const result = await runtime.executeAction(action);
        this.observe(action, result.ok, before, result.snapshot);
        return result;
      },
    };
  }

  observe(action: GameAction, ok: boolean, before: GameSnapshot, after: GameSnapshot): void {
    this.observeOpportunity(before);
    this.observeOpportunity(after);
    if (!ok || action.type !== "REORDER_HAND" || !this.canOrganize(before)) return;
    const hand = before.players.find(p => p.id === this.playerId)?.hand;
    if (!hand) return;
    const sorted = this.order === "rank" ? sortHandByRank(hand) : sortHandBySuit(hand);
    if (sorted.length === action.cardIds.length &&
      sorted.every((card, index) => card.id === action.cardIds[index])) this.correct = true;
  }

  private canOrganize(snapshot: GameSnapshot): boolean {
    return snapshot.currentRound === this.initial.currentRound &&
      snapshot.turnNumber === this.initial.turnNumber &&
      getAvailableToolNames(snapshot, this.playerId).includes("organize_hand");
  }

  private observeOpportunity(snapshot: GameSnapshot): void {
    if (this.canOrganize(snapshot)) this.expected = true;
  }
}
