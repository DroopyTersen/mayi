import { describe, expect, it } from "bun:test";
import { createAIPlayerRolloutHistory } from "./ai-player-rollout-history";
import { AI_PLAYER_SHARED_RUN_SCENARIOS } from "./ai-player-shared-run-scenarios";
import { projectAIPlayerFixedStateSnapshot } from "./ai-player-fixed-state-scenarios";
import {
  isAIPlayerRolloutComplete,
  resolveAIPlayerRolloutActions,
} from "./ai-player-rollout-policy";

describe("bounded responsive opponent policies", () => {
  it("uses only the opponent hand and public table, with no mutable engine references", async () => {
    const state = await createAIPlayerRolloutHistory(
      AI_PLAYER_SHARED_RUN_SCENARIOS[0]!,
    );
    try {
      const snapshot = projectAIPlayerFixedStateSnapshot(state.actor);
      const actions = resolveAIPlayerRolloutActions(
        {
          playerId: "eval-player-1",
          kind: "opponent-script",
          actions: [],
          opponentPolicy: {
            id: "view-contract-check",
            selectActions: (view) => {
              expect(Object.keys(view).sort()).toEqual(["hand", "table"]);
              expect(view.hand.map((card) => card.id)).toEqual(["known-4s"]);
              // Deliberate mutation of a copied object must not affect the input.
              view.hand[0]!.rank = "A";
              return [{ type: "DISCARD", cardId: view.hand[0]!.id }];
            },
          },
        },
        snapshot,
      );
      expect(actions).toEqual([{ type: "DISCARD", cardId: "known-4s" }]);
      expect(snapshot.players[1]!.hand[0]!.rank).toBe("4");
      expect(
        resolveAIPlayerRolloutActions(
          {
            playerId: "eval-player-0",
            kind: "candidate-turn",
            actions: [{ type: "DISCARD", cardId: "root-draw" }],
          },
          snapshot,
        ),
      ).toEqual([{ type: "DISCARD", cardId: "root-draw" }]);
      expect(
        isAIPlayerRolloutComplete({
          snapshot,
          maxModelDecisions: 2,
          decisions: [
            {
              playerId: "eval-player-0",
              kind: "candidate-turn",
              success: true,
            },
          ],
        }),
      ).toBe(false);
      expect(
        isAIPlayerRolloutComplete({
          snapshot,
          maxModelDecisions: 1,
          decisions: [
            {
              playerId: "eval-player-0",
              kind: "candidate-turn",
              success: true,
            },
          ],
        }),
      ).toBe(true);
      expect(
        isAIPlayerRolloutComplete({
          snapshot,
          maxModelDecisions: 1,
          opponentActionsLegal: false,
          decisions: [
            {
              playerId: "eval-player-0",
              kind: "candidate-turn",
              success: true,
            },
          ],
        }),
      ).toBe(false);
    } finally {
      state.actor.stop();
    }
  });
});
