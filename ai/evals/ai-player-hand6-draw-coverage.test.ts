import { describe, expect, it } from "bun:test";
import type { Card } from "../../core/card/card.types";
import { evaluateHand6DiscardCoverage } from "./ai-player-hand6-draw-coverage";
import {
  createAIPlayerFixedStateActor,
  createAIPlayerFixedStateActorRuntime,
  projectAIPlayerFixedStateSnapshot,
} from "./ai-player-fixed-state-scenarios";
import { card, roundInput } from "./ai-player-short-rollout-scenario";

const hand: Card[] = [
  card("9c", "9", "clubs"),
  card("9d", "9", "diamonds"),
  ...(["3", "4", "5", "6", "8", "9"] as const).map((rank) =>
    card(`${rank}h`, rank, "hearts"),
  ),
  ...(["4", "5", "6", "7"] as const).map((rank) =>
    card(`${rank}s`, rank, "spades"),
  ),
];
const visible = [card("opening", "A", "clubs")];

describe("Hand 6 evaluator-only next-draw coverage", () => {
  it("counts all unseen physical copies, not one favorable hidden stock draw", () => {
    const coverage = evaluateHand6DiscardCoverage({
      hand,
      visibleOutsideHand: visible,
    });
    expect(coverage.unseenCardCount).toBe(95);
    expect(coverage.bestDiscardCardIds).toEqual(["8h"]);
    expect(
      coverage.candidates.find((candidate) => candidate.discardCardId === "8h")
        ?.winningDrawCount,
    ).toBe(23);
    expect(
      coverage.candidates.find((candidate) => candidate.discardCardId === "3h")
        ?.winningDrawCount,
    ).toBe(14);
    expect(
      coverage.candidates.find((candidate) => candidate.discardCardId === "9h")
        ?.winningDrawCount,
    ).toBe(0);
  });

  it("subtracts only observed cards and is independent of hand positions", () => {
    const coverage = evaluateHand6DiscardCoverage({
      hand: [...hand].reverse(),
      visibleOutsideHand: [...visible, card("seen-7h", "7", "hearts")],
    });
    expect(coverage.unseenCardCount).toBe(94);
    expect(coverage.bestDiscardCardIds).toEqual(["8h"]);
    expect(
      coverage.candidates.find((candidate) => candidate.discardCardId === "8h")
        ?.winningDrawCount,
    ).toBe(22);
    expect(
      coverage.candidates.find((candidate) => candidate.discardCardId === "3h")
        ?.winningDrawCount,
    ).toBe(13);
  });

  it("rejects impossible inventories and unsupported hand sizes instead of returning false certainty", () => {
    expect(() =>
      evaluateHand6DiscardCoverage({ hand, visibleOutsideHand: [hand[0]!] }),
    ).toThrow("duplicate card ID");
    expect(() =>
      evaluateHand6DiscardCoverage({
        hand,
        visibleOutsideHand: [
          card("extra-1", "9", "clubs"),
          card("extra-2", "9", "clubs"),
        ],
      }),
    ).toThrow("card multiplicity");
    expect(() =>
      evaluateHand6DiscardCoverage({
        hand: hand.slice(0, 10),
        visibleOutsideHand: [],
      }),
    ).toThrow("12, 14, or 16");
  });

  it("provides an engine-legal all-card win for every claimed winning draw", async () => {
    const coverage = evaluateHand6DiscardCoverage({
      hand,
      visibleOutsideHand: visible,
    });
    for (const candidate of coverage.candidates) {
      for (const draw of candidate.winningDraws) {
        const kept = hand.filter(
          (entry) => entry.id !== candidate.discardCardId,
        );
        const drawn = card("future-draw", draw.rank, draw.suit);
        const afterDraw = [...kept, drawn];
        const actor = createAIPlayerFixedStateActor({
          identity: {
            id: "coverage-witness",
            split: "development",
            category: "oracle",
            description: "Validate a coverage witness through the real engine.",
          },
          input: roundInput({
            roundNumber: 6,
            hands: [
              kept,
              [card("p1", "K", "clubs")],
              [card("p2", "Q", "clubs")],
            ],
            stock: [drawn, card("reserve", "K", "diamonds")],
            discard: visible,
          }),
        });
        try {
          const { runtime } = createAIPlayerFixedStateActorRuntime(
            actor,
            "eval-player-0",
          );
          expect(
            (await runtime.executeAction({ type: "DRAW_FROM_STOCK" })).ok,
          ).toBe(true);
          expect(
            (
              await runtime.executeAction({
                type: "LAY_DOWN",
                melds: draw.positionGroups.map((positions, index) => ({
                  type: index === 0 ? "set" : "run",
                  cardIds: positions.map(
                    (position) => afterDraw[position - 1]!.id,
                  ),
                })),
              })
            ).ok,
          ).toBe(true);
          expect(
            projectAIPlayerFixedStateSnapshot(actor).players[0]?.hand,
          ).toHaveLength(0);
        } finally {
          actor.stop();
        }
      }
    }
  });
});
