import { describe, expect, it } from "bun:test";
import { AI_PLAYER_LAYOFF_HORIZON_SCENARIOS } from "./ai-player-layoff-horizon-scenarios";
import {
  createAIPlayerFixedStateActor,
  projectAIPlayerFixedStateSnapshot,
} from "./ai-player-fixed-state-scenarios";
import {
  createAIPlayerRolloutHistory,
  AI_PLAYER_ROLLOUT_OBSERVATION_VERSION,
} from "./ai-player-rollout-history";
import { runAIPlayerShortRolloutReference } from "./ai-player-short-rollout-scenarios";
import { AI_PLAYER_SHORT_ROLLOUT_SCENARIOS } from "./ai-player-short-rollout-scenarios";
import { createDeck } from "../../core/card/card.deck";
import { roundInput } from "./ai-player-short-rollout-scenario";

describe("short rollout public-history fidelity", () => {
  it("records real May I transfers after a rejected laydown leaves a stale engine error", async () => {
    const scenario = AI_PLAYER_SHORT_ROLLOUT_SCENARIOS.find(
      (entry) =>
        entry.identity.id === "prioritize-own-contract-over-public-layoff",
    )!;
    const deck = createDeck({ deckCount: 2, jokerCount: 4 });
    const state = await createAIPlayerRolloutHistory({
      ...scenario,
      prepare: undefined,
      historyPrelude: undefined,
      actionLog: [],
      input: roundInput({
        roundNumber: 2,
        hands: [deck.slice(0, 11), deck.slice(11, 22), deck.slice(22, 33)],
        stock: deck.slice(34),
        discard: deck.slice(33, 34),
      }),
    });
    try {
      const current = projectAIPlayerFixedStateSnapshot(state.actor);
      const currentPlayer = state.createRuntime(current.awaitingPlayerId);
      if (current.turnPhase === "AWAITING_DRAW")
        expect(
          (
            await currentPlayer.runtime.executeAction({
              type: "DRAW_FROM_STOCK",
            })
          ).ok,
        ).toBe(true);
      expect(
        (
          await currentPlayer.runtime.executeAction({
            type: "LAY_DOWN",
            melds: [
              { type: "set", cardIds: ["not-in-hand", "nor-this", "or-this"] },
              {
                type: "run",
                cardIds: ["missing-4", "missing-5", "missing-6", "missing-7"],
              },
            ],
          })
        ).ok,
      ).toBe(false);
      expect(
        projectAIPlayerFixedStateSnapshot(state.actor).lastError,
      ).toBeTruthy();
      const caller = state.createRuntime("eval-player-2");
      const call = await caller.runtime.executeAction({ type: "CALL_MAY_I" });
      expect(call.ok).toBe(true);
      while (
        projectAIPlayerFixedStateSnapshot(state.actor).phase ===
        "RESOLVING_MAY_I"
      ) {
        const responder = projectAIPlayerFixedStateSnapshot(
          state.actor,
        ).awaitingPlayerId;
        expect(
          (
            await state
              .createRuntime(responder)
              .runtime.executeAction({ type: "ALLOW_MAY_I" })
          ).ok,
        ).toBe(true);
      }
      expect(
        state.getActionLog().some((entry) => entry.action === "called May I"),
      ).toBe(true);
      expect(
        state
          .getActionLog()
          .some((entry) => entry.action === "took the May I card"),
      ).toBe(true);
    } finally {
      state.actor.stop();
    }
  });
  it("uses evolving public observations in the reference harness", async () => {
    const result = await runAIPlayerShortRolloutReference(
      AI_PLAYER_LAYOFF_HORIZON_SCENARIOS[0]!,
    );
    expect(result.observationVersion).toBe(
      AI_PLAYER_ROLLOUT_OBSERVATION_VERSION,
    );
    expect(result.decisionHistories).toHaveLength(2);
    expect(result.decisionHistories[0]).toHaveLength(15);
    expect(result.decisionHistories[1]!.length).toBeGreaterThan(15);
    expect(
      result.decisionHistories[1]!.some(
        (entry) => entry.action === "laid off" && entry.details === "9♠",
      ),
    ).toBe(true);
  });
  it("replays the real prelude without grouped history or changing the decision state", async () => {
    expect(AI_PLAYER_ROLLOUT_OBSERVATION_VERSION).toBe(
      "public-action-history-v1",
    );
    for (const scenario of AI_PLAYER_LAYOFF_HORIZON_SCENARIOS) {
      for (const repetition of [1, 2, 3, 4]) {
        const legacy = createAIPlayerFixedStateActor(scenario, repetition);
        const state = await createAIPlayerRolloutHistory(scenario, repetition);
        try {
          const { updatedAt: _legacyTime, ...oldSnapshot } =
            projectAIPlayerFixedStateSnapshot(legacy);
          const { updatedAt: _newTime, ...newSnapshot } =
            projectAIPlayerFixedStateSnapshot(state.actor);
          expect(newSnapshot).toEqual(oldSnapshot);
          const history = state.getActionLog();
          expect(history).toHaveLength(15);
          expect(history[0]).toMatchObject({
            playerId: "eval-player-1",
            action: "took from discard",
            details: "9♠",
          });
          expect(history[1]?.details).toBe("set: 9♣ 9♦ 9♥; run: 10♥ J♥ Q♥ K♥");
          expect(
            history
              .slice(-10)
              .some((entry) => entry.action === "took from discard"),
          ).toBe(false);
          expect(
            history
              .filter((entry) => entry.action === "drew from the draw pile")
              .every((entry) => entry.details === undefined),
          ).toBe(true);
        } finally {
          legacy.stop();
          state.actor.stop();
        }
      }
    }
  });

  it("appends actual candidate and opponent actions before the next decision, with immutable reads", async () => {
    const scenario = AI_PLAYER_LAYOFF_HORIZON_SCENARIOS[0]!;
    const state = await createAIPlayerRolloutHistory(scenario);
    try {
      const firstRead = state.getActionLog();
      for (const decision of scenario.referenceSequence.slice(0, 3)) {
        const runtime = state.createRuntime(decision.playerId);
        for (const action of decision.actions)
          expect((await runtime.runtime.executeAction(action)).ok).toBe(true);
      }
      expect(firstRead).toHaveLength(15);
      const laterRead = state.getActionLog();
      expect(laterRead.length).toBeGreaterThan(firstRead.length);
      expect(
        laterRead.some(
          (entry) =>
            entry.playerId === "eval-player-1" &&
            entry.action === "laid off" &&
            entry.details === "9♠",
        ),
      ).toBe(true);
      expect(
        laterRead.some(
          (entry) =>
            entry.playerId === "eval-player-0" &&
            entry.action === "laid down contract",
        ),
      ).toBe(true);
      const priorLength = laterRead.length;
      laterRead[0]!.action = "tampered";
      const rejected = await state
        .createRuntime("eval-player-0")
        .runtime.executeAction({ type: "DISCARD", cardId: "not-a-card" });
      expect(rejected.ok).toBe(false);
      expect(state.getActionLog()).toHaveLength(priorLength);
      expect(state.getActionLog()[0]?.action).toBe("took from discard");
    } finally {
      state.actor.stop();
    }
  });
});
