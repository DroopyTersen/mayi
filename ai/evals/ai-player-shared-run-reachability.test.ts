import { expect, it } from "bun:test";
import type { GameSnapshot } from "../../core/engine/game-engine.types";
import type { GameAction } from "../ai-action-runtime.types";
import {
  createAIPlayerFixedStateActor,
  createAIPlayerFixedStateActorRuntime,
  projectAIPlayerFixedStateSnapshot,
} from "./ai-player-fixed-state-scenarios";
import { createAIPlayerRolloutHistory } from "./ai-player-rollout-history";
import { AI_PLAYER_SHARED_RUN_SCENARIOS } from "./ai-player-shared-run-scenarios";
import { roundInput } from "./ai-player-short-rollout-scenario";

it("reaches every shared-run card position from a legal eleven-card deal", async () => {
  for (const scenario of AI_PLAYER_SHARED_RUN_SCENARIOS) {
    const initial = scenario.input.predefinedState!;
    const table = initial.table!;
    const combined = initial.hands.map((hand, index) => [
      ...hand,
      ...table
        .filter((meld) => meld.ownerId === `eval-player-${index}`)
        .flatMap((meld) => meld.cards),
    ]);
    const allCards = [...combined.flat(), ...initial.discard];
    const take = (id: string) => allCards.find((card) => card.id === id)!;
    const x = take("opponent-7-clubs");
    const y = take("public-J-clubs");
    const z = take("public-Q-clubs");
    const d = take("known-4s");
    const hands = [
      [...combined[0]!.filter((card) => card.id !== z.id), d],
      [...combined[1]!.filter((card) => card.id !== x.id), y],
      [...combined[2]!.filter((card) => card.id !== y.id), z],
    ];
    expect(hands.map((hand) => hand.length)).toEqual([11, 11, 11]);
    const actor = createAIPlayerFixedStateActor({
      identity: scenario.identity,
      input: roundInput({
        roundNumber: 2,
        dealerIndex: 0,
        hands,
        stock: initial.stock,
        discard: [x],
        down: [false, false, false],
        table: [],
      }),
    });
    const target = await createAIPlayerRolloutHistory(scenario);
    try {
      const melds = (playerId: string) =>
        table
          .filter((meld) => meld.ownerId === playerId)
          .map((meld) => ({
            type: meld.type,
            cardIds: meld.cards.map((card) => card.id),
          }));
      const prefix: { playerId: string; action: GameAction }[] = [
        { playerId: "eval-player-1", action: { type: "DRAW_FROM_DISCARD" } },
        { playerId: "eval-player-1", action: { type: "SKIP" } },
        {
          playerId: "eval-player-1",
          action: { type: "DISCARD", cardId: y.id },
        },
        { playerId: "eval-player-2", action: { type: "DRAW_FROM_DISCARD" } },
        {
          playerId: "eval-player-2",
          action: { type: "LAY_DOWN", melds: melds("eval-player-2") },
        },
        {
          playerId: "eval-player-2",
          action: { type: "DISCARD", cardId: z.id },
        },
        { playerId: "eval-player-0", action: { type: "DRAW_FROM_DISCARD" } },
        {
          playerId: "eval-player-0",
          action: { type: "LAY_DOWN", melds: melds("eval-player-0") },
        },
        {
          playerId: "eval-player-0",
          action: { type: "DISCARD", cardId: d.id },
        },
      ];
      const execute = async (step: (typeof prefix)[number]) => {
        const state = createAIPlayerFixedStateActorRuntime(
          actor,
          step.playerId,
        );
        expect((await state.runtime.executeAction(step.action)).ok).toBe(true);
      };
      for (const step of prefix) await execute(step);
      const generated = projectAIPlayerFixedStateSnapshot(actor).table;
      const meldIds = new Map(
        table.map((meld) => [
          meld.id,
          generated.find(
            (candidate) => candidate.cards[0]!.id === meld.cards[0]!.id,
          )!.id,
        ]),
      );
      for (const step of scenario.historyPrelude!) {
        const action =
          "meldId" in step.action
            ? { ...step.action, meldId: meldIds.get(step.action.meldId)! }
            : step.action;
        await execute({ ...step, action });
      }
      // Meld IDs/display order and extra historical prefix are not claimed to
      // match the fixture observation; the physical position and turn must.
      const position = (snapshot: GameSnapshot) => ({
        hands: snapshot.players.map((player) =>
          player.hand.map((card) => card.id).sort(),
        ),
        down: snapshot.players.map((player) => player.isDown),
        table: snapshot.table
          .map((meld) => ({
            ownerId: meld.ownerId,
            type: meld.type,
            cards: meld.cards.map((card) => card.id),
          }))
          .sort((left, right) => left.cards[0]!.localeCompare(right.cards[0]!)),
        stock: snapshot.stock.map((card) => card.id),
        discard: snapshot.discard.map((card) => card.id),
        phase: snapshot.phase,
        turnPhase: snapshot.turnPhase,
        currentPlayerIndex: snapshot.currentPlayerIndex,
      });
      expect(position(projectAIPlayerFixedStateSnapshot(actor))).toEqual(
        position(projectAIPlayerFixedStateSnapshot(target.actor)),
      );
    } finally {
      actor.stop();
      target.actor.stop();
    }
  }
});
