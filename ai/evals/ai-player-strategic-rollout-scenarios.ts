import {
  createDeck,
  createSeededRandom,
  shuffle,
} from "../../core/card/card.deck";
import type { Card } from "../../core/card/card.types";
import { findLayDownCandidates } from "../mayIAgent.contract-candidates";
import {
  evaluateHand6DiscardCoverage,
  type Hand6DrawCoverage,
} from "./ai-player-hand6-draw-coverage";
import {
  criterion,
  roundInput,
  successfulAction,
  wentOut,
  type AIPlayerShortRolloutScenario,
} from "./ai-player-short-rollout-scenario";

const PLAYER = "eval-player-0";
const rubric = [
  {
    id: "preserve-winning-draw-coverage",
    description:
      "Maximize next-draw all-card wins under the declared exchangeable unseen-card distribution, conditional on surviving to that draw.",
    weight: 50,
  },
  {
    id: "convert-next-turn-opportunity",
    description:
      "Execute an all-card win on the second own turn in this fixed nonterminal-opponent continuation.",
    weight: 50,
  },
] as const;

function hand6PlanningScenario(
  branch: "natural" | "wild",
): AIPlayerShortRolloutScenario {
  const deck = createDeck({ deckCount: 2, jokerCount: 4 });
  function take(id: string, rank: Card["rank"], suit: Card["suit"]): Card {
    const index = deck.findIndex(
      (card) => card.rank === rank && card.suit === suit,
    );
    if (index < 0) throw new Error(`Unavailable physical card ${rank}:${suit}`);
    const [card] = deck.splice(index, 1);
    if (card === undefined) throw new Error("Missing allocated card");
    return { ...card, id };
  }
  const hand = [
    take("plan-9c", "9", "clubs"),
    take("plan-9d", "9", "diamonds"),
    ...(["3", "4", "5", "6", "9"] as const).map((rank) =>
      take(`plan-${rank}h`, rank, "hearts"),
    ),
    ...(["4", "5", "6", "7"] as const).map((rank) =>
      take(`plan-${rank}s`, rank, "spades"),
    ),
  ];
  const firstDraw = take("plan-8h", "8", "hearts");
  const opening = take("opening", "A", "clubs");
  const opponent1Draw = take("opponent-1-draw", "K", "clubs");
  const opponent2Draw = take("opponent-2-draw", "Q", "clubs");
  const futureDraw =
    branch === "natural"
      ? take("future-draw", "9", "spades")
      : take("future-draw", "Joker", null);
  const remainder = shuffle(
    deck,
    createSeededRandom("strategic-hand6-inventory-v1"),
  );
  const opponents = [remainder.splice(0, 11), remainder.splice(0, 11)];
  const root = [...hand, firstDraw];
  let coverage: Hand6DrawCoverage | undefined;
  const getCoverage = () =>
    (coverage ??= evaluateHand6DiscardCoverage({
      hand: root,
      visibleOutsideHand: [opening],
    }));
  const kept = root.filter((card) => card.id !== firstDraw.id);
  const nextHand = [...kept, futureDraw];
  const win = findLayDownCandidates({
    hand: nextHand,
    contract: { roundNumber: 6, sets: 1, runs: 2 },
    playerId: PLAYER,
    limit: 1,
  })[0];
  if (win === undefined)
    throw new Error(`Missing Hand 6 reference win for ${branch}`);
  return {
    identity: {
      id: `hand6-preserve-options-${branch}`,
      split: "development",
      category: "multi-turn-option-preservation",
      description:
        "Reassign an overlapping card to preserve more next-draw wins, then convert the opportunity on the next turn.",
    },
    assessment: "scripted-outcome",
    evaluatedPlayerId: PLAYER,
    objective:
      "Compare every legal discard over the full 95-card unseen population, then win after two fixed nonterminal opponent turns. The planning score is conditional one-draw coverage, not full-game optimality or the luck of this branch.",
    organizationOrder: "suit",
    maxCandidateTurns: 2,
    maxModelDecisions: 2,
    rubric,
    input: roundInput({
      roundNumber: 6,
      hands: [hand, ...opponents],
      stock: [
        firstDraw,
        opponent1Draw,
        opponent2Draw,
        futureDraw,
        ...remainder,
      ],
      discard: [opening],
    }),
    prepare: (actor) =>
      actor.send({ type: "DRAW_FROM_STOCK", playerId: PLAYER }),
    referenceSequence: [
      {
        playerId: PLAYER,
        kind: "candidate-turn",
        actions: [{ type: "SKIP" }, { type: "DISCARD", cardId: firstDraw.id }],
      },
      {
        playerId: "eval-player-1",
        kind: "opponent-script",
        actions: [
          { type: "DRAW_FROM_STOCK" },
          { type: "SKIP" },
          { type: "DISCARD", cardId: opponent1Draw.id },
        ],
      },
      {
        playerId: "eval-player-2",
        kind: "opponent-script",
        actions: [
          { type: "DRAW_FROM_STOCK" },
          { type: "SKIP" },
          { type: "DISCARD", cardId: opponent2Draw.id },
        ],
      },
      {
        playerId: PLAYER,
        kind: "candidate-turn",
        actions: [
          { type: "DRAW_FROM_STOCK" },
          {
            type: "LAY_DOWN",
            melds: win.positionGroups.map((positions, index) => ({
              type: index === 0 ? "set" : "run",
              cardIds: positions.map((position) => {
                const card = nextHand[position - 1];
                if (card === undefined)
                  throw new Error("Invalid reference position");
                return card.id;
              }),
            })),
          },
        ],
      },
    ],
    grade: (observation) => {
      const coverage = getCoverage();
      const discarded = successfulAction(observation, "DISCARD")?.cardId;
      const chosen = coverage.candidates.find(
        (entry) => entry.discardCardId === discarded,
      );
      const best = Math.max(
        ...coverage.candidates.map((entry) => entry.winningDrawCount),
      );
      return [
        criterion(
          rubric[0],
          discarded !== undefined &&
            coverage.bestDiscardCardIds.includes(discarded),
          `chosen=${chosen?.winningDrawCount ?? 0}/${coverage.unseenCardCount}; best=${best}/${coverage.unseenCardCount}; conditional next-draw wins, not full-game value`,
        ),
        criterion(
          rubric[1],
          wentOut(observation, PLAYER),
          `went out by second own turn=${wentOut(observation, PLAYER)}`,
        ),
      ];
    },
  };
}

/** Evaluator-only continuations and oracle; never include these in player guidance. */
export const AI_PLAYER_STRATEGIC_ROLLOUT_SCENARIOS: readonly AIPlayerShortRolloutScenario[] =
  [hand6PlanningScenario("natural"), hand6PlanningScenario("wild")];
