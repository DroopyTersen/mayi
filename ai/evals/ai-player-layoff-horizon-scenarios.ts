import {
  createDeck,
  createSeededRandom,
  shuffle,
} from "../../core/card/card.deck";
import type { Card } from "../../core/card/card.types";
import type { Meld } from "../../core/meld/meld.types";
import { calculateHandScore } from "../../core/scoring/scoring";
import type { GameAction } from "../ai-action-runtime.types";
import {
  criterion,
  roundInput,
  wentOut,
  type AIPlayerShortRolloutScenario,
} from "./ai-player-short-rollout-scenario";

const PLAYER = "eval-player-0";
type HistoryAction = Extract<
  GameAction,
  {
    type:
      | "DRAW_FROM_STOCK"
      | "DRAW_FROM_DISCARD"
      | "LAY_DOWN"
      | "LAY_OFF"
      | "DISCARD";
  }
>;
interface HistoryStep {
  playerId: string;
  action: HistoryAction;
}
export interface AIPlayerLayoffHorizonScenario extends AIPlayerShortRolloutScenario {
  /** Evaluator-only replay provenance for the public history, never player advice. */
  historyPrelude: readonly HistoryStep[];
}

function layoffHorizonScenario(
  branch: "safe-natural" | "safe-wild" | "known-exit",
): AIPlayerLayoffHorizonScenario {
  const urgent = branch === "known-exit";
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
  const sevens = [
    take("candidate-7c", "7", "clubs"),
    take("candidate-7d", "7", "diamonds"),
    take("candidate-7h", "7", "hearts"),
  ];
  const nines = [
    take("candidate-9c", "9", "clubs"),
    take("candidate-9d", "9", "diamonds"),
    take("candidate-9h", "9", "hearts"),
  ];
  const run = (["4", "5", "6", "7"] as const).map((rank) =>
    take(`candidate-${rank}s`, rank, "spades"),
  );
  const queen = take("candidate-qc", "Q", "clubs");
  const candidateHand = [...sevens, ...nines, ...run, queen];
  const publicNines = (["clubs", "diamonds", "hearts"] as const).map((suit) =>
    take(`public-9-${suit}`, "9", suit),
  );
  const publicHearts = (["10", "J", "Q", "K"] as const).map((rank) =>
    take(`public-${rank}h`, rank, "hearts"),
  );
  const priorLayoffs = [
    take("prior-4c", "4", "clubs"),
    take("prior-3c", "3", "clubs"),
    take("prior-qs", "Q", "spades"),
  ];
  const firstDiscard = take("prior-ad", "A", "diamonds");
  const opponent1Hand = [
    ...publicNines,
    ...publicHearts,
    ...priorLayoffs,
    firstDiscard,
  ];
  if (!urgent)
    opponent1Hand.push(
      take("safe-6d", "6", "diamonds"),
      take("safe-8d", "8", "diamonds"),
    );
  const opponent2Hand = [
    take("other-4d", "4", "diamonds"),
    take("other-5d", "5", "diamonds"),
    take("other-8d", "8", "diamonds"),
    take("other-10d", "10", "diamonds"),
  ];
  const table: Meld[] = [
    {
      id: "public-queens",
      ownerId: "eval-player-2",
      type: "set",
      cards: (["clubs", "diamonds", "hearts"] as const).map((suit) =>
        take(`public-Q-${suit}`, "Q", suit),
      ),
    },
    {
      id: "public-clubs",
      ownerId: "eval-player-2",
      type: "run",
      cards: (["5", "6", "7", "8"] as const).map((rank) =>
        take(`public-${rank}c`, rank, "clubs"),
      ),
    },
  ];
  const pickup = take("public-pickup-9s", "9", "spades");
  const stockPrefix = [
    take("history-other-draw", "3", "diamonds"),
    take("history-candidate-draw", "8", "hearts"),
    take("history-p1-draw", "K", "diamonds"),
    take("history-opening", "A", "clubs"),
    take("root-draw", "K", "clubs"),
    take("next-p1-draw", "10", "clubs"),
    take("next-p2-draw", "J", "clubs"),
    branch === "safe-wild"
      ? take("future-draw", "Joker", null)
      : take("future-draw", "3", "hearts"),
  ];
  const meld = (type: "set" | "run", cards: readonly Card[]) => ({
    type,
    cardIds: cards.map((card) => card.id),
  });
  const historyPrelude: HistoryStep[] = [
    { playerId: "eval-player-1", action: { type: "DRAW_FROM_DISCARD" } },
    {
      playerId: "eval-player-1",
      action: {
        type: "LAY_DOWN",
        melds: [meld("set", publicNines), meld("run", publicHearts)],
      },
    },
    {
      playerId: "eval-player-1",
      action: { type: "DISCARD", cardId: firstDiscard.id },
    },
    { playerId: "eval-player-2", action: { type: "DRAW_FROM_STOCK" } },
    {
      playerId: "eval-player-2",
      action: { type: "DISCARD", cardId: "history-other-draw" },
    },
    { playerId: PLAYER, action: { type: "DRAW_FROM_STOCK" } },
    {
      playerId: PLAYER,
      action: { type: "DISCARD", cardId: "history-candidate-draw" },
    },
    { playerId: "eval-player-1", action: { type: "DRAW_FROM_STOCK" } },
    {
      playerId: "eval-player-1",
      action: {
        type: "LAY_OFF",
        cardId: "prior-4c",
        meldId: "public-clubs",
        position: "start",
      },
    },
    {
      playerId: "eval-player-1",
      action: {
        type: "LAY_OFF",
        cardId: "prior-3c",
        meldId: "public-clubs",
        position: "start",
      },
    },
    {
      playerId: "eval-player-1",
      action: { type: "LAY_OFF", cardId: "prior-qs", meldId: "public-queens" },
    },
    {
      playerId: "eval-player-1",
      action: { type: "DISCARD", cardId: "history-p1-draw" },
    },
    { playerId: "eval-player-2", action: { type: "DRAW_FROM_STOCK" } },
    {
      playerId: "eval-player-2",
      action: { type: "DISCARD", cardId: "history-opening" },
    },
    { playerId: PLAYER, action: { type: "DRAW_FROM_STOCK" } },
  ];
  const rubric = [
    {
      id: urgent ? "minimize-known-exit-penalty" : "preserve-next-turn-exit",
      description: urgent
        ? "Minimize retained penalty when the next opponent can exit using a card inferable from public transfers."
        : "Choose a contract that leaves a complete next-turn disposal plan and execute it under the fixed nonterminal continuation.",
      weight: 100,
    },
  ] as const;
  const firstActions: GameAction[] = [
    {
      type: "LAY_DOWN",
      melds: [meld("set", urgent ? nines : sevens), meld("run", run)],
    },
    { type: "DISCARD", cardId: "root-draw" },
  ];
  return {
    identity: {
      id: `contract-horizon-${branch}`,
      split: "development",
      category: "contract-vs-opponent-horizon",
      description:
        "Trade retained point value against a next-turn exit, using public history and the opponent's remaining card count.",
    },
    assessment: "scripted-outcome",
    evaluatedPlayerId: PLAYER,
    objective: urgent
      ? "The public nine remained through both prior turns; with one card left, the next opponent exits after its draw. Laying nines leaves31 points versus37 for sevens."
      : "Laying sevens leaves three nines and a queen that all fit existing public melds next turn. Laying nines strands the sevens, despite initially retaining fewer points. Outcomes are conditional on the scripted opponents and next draw.",
    organizationOrder: "suit",
    maxCandidateTurns: urgent ? 1 : 2,
    maxModelDecisions: urgent ? 1 : 2,
    rubric,
    historyPrelude,
    input: {
      ...roundInput({
        roundNumber: 2,
        dealerIndex: 0,
        hands: [candidateHand, opponent1Hand, opponent2Hand],
        stock: [
          ...stockPrefix,
          ...shuffle(deck, createSeededRandom("contract-horizon-v1")),
        ],
        discard: [pickup],
        down: [false, false, true],
        table,
      }),
      seed: "contract-horizon-v1",
    },
    prepare: (actor) => {
      for (const step of historyPrelude)
        actor.send({ ...step.action, playerId: step.playerId });
    },
    referenceSequence: [
      { playerId: PLAYER, kind: "candidate-turn", actions: firstActions },
      {
        playerId: "eval-player-1",
        kind: "opponent-script",
        actions: [
          { type: "DRAW_FROM_STOCK" },
          {
            type: "LAY_OFF",
            cardId: pickup.id,
            meldId: "meld-eval-player-1-2",
          },
          { type: "DISCARD", cardId: "next-p1-draw" },
        ],
      },
      ...(urgent
        ? []
        : [
            {
              playerId: "eval-player-2",
              kind: "opponent-script" as const,
              actions: [
                { type: "DRAW_FROM_STOCK" } as const,
                { type: "DISCARD", cardId: "next-p2-draw" } as const,
              ],
            },
            {
              playerId: PLAYER,
              kind: "candidate-turn" as const,
              actions: [
                { type: "DRAW_FROM_STOCK" } as const,
                ...nines.map((card) => ({
                  type: "LAY_OFF" as const,
                  cardId: card.id,
                  meldId: "meld-eval-player-1-2",
                })),
                {
                  type: "LAY_OFF",
                  cardId: queen.id,
                  meldId: "public-queens",
                } as const,
                { type: "DISCARD", cardId: "future-draw" } as const,
              ],
            },
          ]),
    ],
    grade: (observation) => {
      const candidate = observation.snapshot.players.find(
        (player) => player.id === PLAYER,
      );
      const points =
        candidate === undefined
          ? undefined
          : calculateHandScore(candidate.hand);
      return [
        criterion(
          rubric[0],
          urgent
            ? observation.snapshot.phase === "ROUND_END" &&
                points !== undefined &&
                points <= 31
            : wentOut(observation, PLAYER),
          urgent
            ? `retained penalty=${points}; optimum=31; phase=${observation.snapshot.phase}`
            : `went out by second own turn=${wentOut(observation, PLAYER)}`,
        ),
      ];
    },
  };
}

export const AI_PLAYER_LAYOFF_HORIZON_SCENARIOS: readonly AIPlayerLayoffHorizonScenario[] =
  [
    layoffHorizonScenario("safe-natural"),
    layoffHorizonScenario("safe-wild"),
    layoffHorizonScenario("known-exit"),
  ];
