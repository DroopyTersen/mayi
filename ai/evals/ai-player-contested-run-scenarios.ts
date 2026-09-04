import {
  createDeck,
  createSeededRandom,
  shuffle,
} from "../../core/card/card.deck";
import type { Card } from "../../core/card/card.types";
import { normalizeRunCards } from "../../core/meld/run.normalizer";
import type { GameAction } from "../ai-action-runtime.types";
import {
  evaluateHand5DiscardCoverage,
  type Hand5DrawCoverage,
} from "./ai-player-hand5-draw-coverage";
import {
  criterion,
  roundInput,
  successfulAction,
  type AIPlayerShortRolloutScenario,
} from "./ai-player-short-rollout-scenario";

type RunSuit = "diamonds" | "spades";
interface ContestedRunConfiguration {
  id: string;
  split: "development" | "holdout";
  setRanks: readonly [Card["rank"], Card["rank"]];
  diamonds: readonly [Card["rank"], Card["rank"], Card["rank"]];
  spades: readonly [Card["rank"], Card["rank"], Card["rank"]];
  pickupSuit: RunSuit;
  pickupRanks: readonly [Card["rank"], Card["rank"]];
  preferredSuit: RunSuit;
  futureRank: Card["rank"];
  expectedBestCount: number;
  expectedOtherCount: number;
}

interface ContestedRunScenario extends AIPlayerShortRolloutScenario {
  /** Evaluator-only evidence; never included in the model prompt. */
  diagnostics: {
    rootHand: Card[];
    publiclyKnownOutsideHand: Card[];
    futureDraw: Card;
    referenceDiscardId: string;
    inferiorDiscardId: string;
    expectedBestCount: number;
    expectedOtherCount: number;
  };
}

const PLAYER = "eval-player-0";
const rubric = [
  {
    id: "choose-contract-draw-coverage",
    description:
      "Maximize next-stock-draw exact-contract availability from public card evidence, conditional on survival without claims/recycling.",
    weight: 50,
  },
  {
    id: "convert-next-turn-contract",
    description:
      "Lay down the exact Hand 5 contract by the second own turn under the declared continuation.",
    weight: 50,
  },
] as const;

function contestedRunScenario(
  config: ContestedRunConfiguration,
): ContestedRunScenario {
  const deck = createDeck({ deckCount: 2, jokerCount: 4 });
  function take(id: string, rank: Card["rank"], suit: Card["suit"]): Card {
    const index = deck.findIndex(
      (card) => card.rank === rank && card.suit === suit,
    );
    if (index < 0) throw new Error(`Unavailable physical card ${rank}:${suit}`);
    const [card] = deck.splice(index, 1);
    if (!card) throw new Error("Missing allocated card");
    return { ...card, id };
  }
  const sets = config.setRanks.map((rank) =>
    (["clubs", "diamonds", "hearts"] as const).map((suit) =>
      take(`candidate-${rank}-${suit}`, rank, suit),
    ),
  );
  const runs = {
    diamonds: config.diamonds.map((rank) =>
      take(`candidate-${rank}-diamonds`, rank, "diamonds"),
    ),
    spades: config.spades.map((rank) =>
      take(`candidate-${rank}-spades`, rank, "spades"),
    ),
  };
  const rootHand = [...sets.flat(), ...runs.diamonds, ...runs.spades];
  // The contested run's missing card arrives only at the scored root. Earlier
  // public endpoint disposal must not require skipping a ready contract.
  const rootDraw = runs[config.pickupSuit][2];
  if (!rootDraw) throw new Error("Missing root draw");
  const candidateHand = rootHand.filter((card) => card.id !== rootDraw.id);
  const pickup1 = take(
    "known-pickup-1",
    config.pickupRanks[0],
    config.pickupSuit,
  );
  const pickup2 = take(
    "known-pickup-2",
    config.pickupRanks[1],
    config.pickupSuit,
  );
  const p1Discard1 = take("prelude-p1-discard-1", "A", "clubs");
  const p1Discard2 = take("prelude-p1-discard-2", "A", "diamonds");
  const p2Draw1 = take("prelude-p2-draw-1", "A", "hearts");
  const p2Draw2 = take("prelude-p2-draw-2", "A", "spades");
  const p0Draw2 = take("prelude-p0-draw-2", "J", "clubs");
  const p1Draw3 = take("prelude-p1-draw-3", "J", "diamonds");
  const p2Draw3 = take("prelude-p2-draw-3", "J", "hearts");
  const nextP1 = take("next-p1-draw", "J", "spades");
  const nextP2 = take("next-p2-draw", "A", "clubs");
  const futureDraw = take(
    "future-draw",
    config.futureRank,
    config.futureRank === "Joker" ? null : config.preferredSuit,
  );
  const remainder = shuffle(deck, createSeededRandom("contested-run-v1"));
  const opponent1 = [p1Discard1, p1Discard2, ...remainder.splice(0, 9)];
  const opponent2 = remainder.splice(0, 11);
  const publiclyKnownOutsideHand = [
    pickup1,
    pickup2,
    p1Discard1,
    p1Discard2,
    p2Draw1,
    p2Draw2,
    p0Draw2,
    p1Draw3,
    p2Draw3,
  ];
  const historyPrelude: { playerId: string; action: GameAction }[] = [];
  const turn = (
    playerId: string,
    draw: "DRAW_FROM_STOCK" | "DRAW_FROM_DISCARD",
    discardId: string,
  ) =>
    historyPrelude.push(
      { playerId, action: { type: draw } },
      { playerId, action: { type: "SKIP" } },
      { playerId, action: { type: "DISCARD", cardId: discardId } },
    );
  turn("eval-player-1", "DRAW_FROM_DISCARD", p1Discard1.id);
  turn("eval-player-2", "DRAW_FROM_STOCK", p2Draw1.id);
  turn(PLAYER, "DRAW_FROM_STOCK", pickup2.id);
  turn("eval-player-1", "DRAW_FROM_DISCARD", p1Discard2.id);
  turn("eval-player-2", "DRAW_FROM_STOCK", p2Draw2.id);
  turn(PLAYER, "DRAW_FROM_STOCK", p0Draw2.id);
  turn("eval-player-1", "DRAW_FROM_STOCK", p1Draw3.id);
  turn("eval-player-2", "DRAW_FROM_STOCK", p2Draw3.id);
  historyPrelude.push({
    playerId: PLAYER,
    action: { type: "DRAW_FROM_STOCK" },
  });
  const abandonedSuit =
    config.preferredSuit === "diamonds" ? "spades" : "diamonds";
  const referenceDiscard = runs[abandonedSuit][2];
  const inferiorDiscard = runs[config.preferredSuit][2];
  const finalDiscard = runs[abandonedSuit][1];
  if (!referenceDiscard || !inferiorDiscard || !finalDiscard)
    throw new Error("Missing commitment card");
  const normalized = normalizeRunCards([
    ...runs[config.preferredSuit],
    futureDraw,
  ]);
  if (!normalized.success) throw new Error("Missing legal reference run");
  let coverage: Hand5DrawCoverage | undefined;
  return {
    identity: {
      id: config.id,
      split: config.split,
      category: "public-availability-planning",
      description:
        "Preserve one of two competing runs using public pickups, without abandoning a stronger contested plan blindly.",
    },
    assessment: "scripted-outcome",
    evaluatedPlayerId: PLAYER,
    objective:
      "Compare exact next-draw contract coverage using only observable physical cards, then lay down after the declared nonterminal opponent turns. This measures conditional contract timing, not global discard safety, opponent intent, or full-game expected score.",
    organizationOrder: "suit",
    maxCandidateTurns: 2,
    maxModelDecisions: 2,
    rubric,
    historyPrelude,
    diagnostics: {
      rootHand,
      publiclyKnownOutsideHand,
      futureDraw,
      referenceDiscardId: referenceDiscard.id,
      inferiorDiscardId: inferiorDiscard.id,
      expectedBestCount: config.expectedBestCount,
      expectedOtherCount: config.expectedOtherCount,
    },
    input: roundInput({
      roundNumber: 5,
      dealerIndex: 0,
      hands: [candidateHand, opponent1, opponent2],
      table: [],
      stock: [
        p2Draw1,
        pickup2,
        p2Draw2,
        p0Draw2,
        p1Draw3,
        p2Draw3,
        rootDraw,
        nextP1,
        nextP2,
        futureDraw,
        ...remainder,
      ],
      discard: [pickup1],
      down: [false, false, false],
    }),
    referenceSequence: [
      {
        playerId: PLAYER,
        kind: "candidate-turn",
        actions: [
          { type: "SKIP" },
          { type: "DISCARD", cardId: referenceDiscard.id },
        ],
      },
      {
        playerId: "eval-player-1",
        kind: "opponent-script",
        actions: [
          { type: "DRAW_FROM_STOCK" },
          { type: "SKIP" },
          { type: "DISCARD", cardId: nextP1.id },
        ],
      },
      {
        playerId: "eval-player-2",
        kind: "opponent-script",
        actions: [
          { type: "DRAW_FROM_STOCK" },
          { type: "SKIP" },
          { type: "DISCARD", cardId: nextP2.id },
        ],
      },
      {
        playerId: PLAYER,
        kind: "candidate-turn",
        actions: [
          { type: "DRAW_FROM_STOCK" },
          {
            type: "LAY_DOWN",
            melds: [
              ...sets.map((cards) => ({
                type: "set" as const,
                cardIds: cards.map((card) => card.id),
              })),
              { type: "run", cardIds: normalized.cards.map((card) => card.id) },
            ],
          },
          { type: "DISCARD", cardId: finalDiscard.id },
        ],
      },
    ],
    grade: (observation) => {
      coverage ??= evaluateHand5DiscardCoverage({
        hand: rootHand,
        visibleOutsideHand: publiclyKnownOutsideHand,
      });
      const discarded = successfulAction(observation, "DISCARD")?.cardId;
      const chosen = coverage.candidates.find(
        (candidate) => candidate.discardCardId === discarded,
      );
      const best = Math.max(
        ...coverage.candidates.map(
          (candidate) => candidate.completingDrawCount,
        ),
      );
      const laidDown =
        observation.snapshot.players.find((player) => player.id === PLAYER)
          ?.isDown === true;
      return [
        criterion(
          rubric[0],
          discarded !== undefined &&
            coverage.bestDiscardCardIds.includes(discarded),
          `Chosen ${chosen?.completingDrawCount ?? 0}/${coverage.unseenCardCount} completing draws; best ${best}/${coverage.unseenCardCount}. Conditional on the stated survival/no-claim model.`,
        ),
        criterion(
          rubric[1],
          laidDown,
          `Candidate contract ${laidDown ? "laid down" : "not laid down"} by the second own turn under the declared continuation.`,
        ),
      ];
    },
  };
}

const standard = {
  setRanks: ["Q", "K"],
  diamonds: ["5", "6", "7"],
  spades: ["5", "6", "7"],
  pickupRanks: ["4", "8"],
  expectedBestCount: 16,
  expectedOtherCount: 14,
} as const;
export const AI_PLAYER_CONTESTED_RUN_SCENARIOS: readonly ContestedRunScenario[] =
  [
    contestedRunScenario({
      ...standard,
      id: "contested-run-diamonds-natural",
      split: "development",
      pickupSuit: "diamonds",
      preferredSuit: "spades",
      futureRank: "8",
    }),
    contestedRunScenario({
      ...standard,
      id: "contested-run-diamonds-wild",
      split: "development",
      pickupSuit: "diamonds",
      preferredSuit: "spades",
      futureRank: "Joker",
    }),
    contestedRunScenario({
      ...standard,
      id: "contested-run-spades-natural",
      split: "development",
      pickupSuit: "spades",
      preferredSuit: "diamonds",
      futureRank: "8",
    }),
    contestedRunScenario({
      ...standard,
      id: "contested-run-stronger-diamonds",
      split: "development",
      spades: ["3", "4", "5"],
      pickupRanks: ["4", "10"],
      pickupSuit: "diamonds",
      preferredSuit: "diamonds",
      futureRank: "8",
      expectedBestCount: 15,
    }),
    contestedRunScenario({
      ...standard,
      id: "contested-run-high-diamonds-holdout",
      split: "holdout",
      setRanks: ["3", "4"],
      diamonds: ["9", "10", "J"],
      spades: ["9", "10", "J"],
      pickupRanks: ["8", "Q"],
      pickupSuit: "diamonds",
      preferredSuit: "spades",
      futureRank: "Q",
    }),
    contestedRunScenario({
      ...standard,
      id: "contested-run-upper-boundary-holdout",
      split: "holdout",
      setRanks: ["3", "4"],
      diamonds: ["9", "10", "J"],
      spades: ["Q", "K", "A"],
      pickupRanks: ["8", "6"],
      pickupSuit: "diamonds",
      preferredSuit: "diamonds",
      futureRank: "Q",
      expectedBestCount: 15,
    }),
  ];
