import {
  createDeck,
  createSeededRandom,
  shuffle,
} from "../../core/card/card.deck";
import type { Card } from "../../core/card/card.types";
import { resolveRunInsertPosition } from "../../core/engine/layoff";
import type { Meld } from "../../core/meld/meld.types";
import type { GameAction } from "../ai-action-runtime.types";
import {
  criterion,
  roundInput,
  wentOut,
  type AIPlayerShortRolloutScenario,
} from "./ai-player-short-rollout-scenario";

const PLAYER = "eval-player-0";

function sharedRunScenario(
  branch: "delay-natural" | "delay-wild" | "take-immediate-win",
): AIPlayerShortRolloutScenario {
  const immediate = branch === "take-immediate-win";
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
  const candidateHand = [
    take("candidate-5s", "5", "spades"),
    take("candidate-other", immediate ? "10" : "K", "clubs"),
    take("candidate-prior-qs", "Q", "spades"),
    take("candidate-prior-qh", "Q", "hearts"),
  ];
  const opponentSet = (["clubs", "diamonds", "hearts"] as const).map((suit) =>
    take(`opponent-7-${suit}`, "7", suit),
  );
  const opponentRun = (["9", "10", "J", "Q"] as const).map((rank) =>
    take(`opponent-${rank}d`, rank, "diamonds"),
  );
  const opponentHand = [
    ...opponentSet,
    ...opponentRun,
    take("opponent-prior-3c", "3", "clubs"),
    take("opponent-prior-8c", "8", "clubs"),
    take("opponent-prior-9c", "9", "clubs"),
    take("opponent-prior-ah", "A", "hearts"),
  ];
  const otherHand = (["3", "4", "5", "6"] as const).map((rank) =>
    take(`other-${rank}d`, rank, "diamonds"),
  );
  const table: Meld[] = [
    {
      id: "public-queens",
      ownerId: PLAYER,
      type: "set",
      cards: (["clubs", "diamonds", "hearts"] as const).map((suit) =>
        take(`public-Q-${suit}`, "Q", suit),
      ),
    },
    {
      id: "public-spades",
      ownerId: PLAYER,
      type: "run",
      cards: (["6", "7", "8", "9"] as const).map((rank) =>
        take(`public-${rank}s`, rank, "spades"),
      ),
    },
    {
      id: "public-jacks",
      ownerId: "eval-player-2",
      type: "set",
      cards: (["clubs", "hearts", "spades"] as const).map((suit) =>
        take(`public-J-${suit}`, "J", suit),
      ),
    },
    {
      id: "public-clubs",
      ownerId: "eval-player-2",
      type: "run",
      cards: (["4", "5", "6", "7"] as const).map((rank) =>
        take(`public-${rank}c`, rank, "clubs"),
      ),
    },
  ];
  const pickup = take("known-4s", "4", "spades");
  const stockPrefix = [
    take("prelude-p2-first", "6", "hearts"),
    take("prelude-p0-draw", "K", "hearts"),
    take("prelude-p1-draw", "K", "diamonds"),
    take("prelude-p2-second", "8", "hearts"),
    take("root-draw", "A", "clubs"),
    take("next-p1-draw", "10", "hearts"),
    take("next-p2-draw", "K", "hearts"),
    branch === "delay-wild"
      ? take("future-draw", "Joker", null)
      : take("future-draw", "Q", "clubs"),
  ];
  const step = (playerId: string, action: GameAction) => ({ playerId, action });
  const historyPrelude = [
    step("eval-player-1", { type: "DRAW_FROM_DISCARD" }),
    step("eval-player-1", {
      type: "LAY_DOWN",
      melds: [
        { type: "set", cardIds: opponentSet.map((card) => card.id) },
        { type: "run", cardIds: opponentRun.map((card) => card.id) },
      ],
    }),
    step("eval-player-1", { type: "DISCARD", cardId: "opponent-prior-ah" }),
    step("eval-player-2", { type: "DRAW_FROM_STOCK" }),
    step("eval-player-2", { type: "DISCARD", cardId: "prelude-p2-first" }),
    step(PLAYER, { type: "DRAW_FROM_STOCK" }),
    step(PLAYER, {
      type: "LAY_OFF",
      cardId: "candidate-prior-qs",
      meldId: "public-queens",
    }),
    step(PLAYER, {
      type: "LAY_OFF",
      cardId: "candidate-prior-qh",
      meldId: "public-queens",
    }),
    step(PLAYER, { type: "DISCARD", cardId: "prelude-p0-draw" }),
    step("eval-player-1", { type: "DRAW_FROM_STOCK" }),
    step("eval-player-1", {
      type: "LAY_OFF",
      cardId: "opponent-prior-3c",
      meldId: "public-clubs",
      position: "start",
    }),
    step("eval-player-1", {
      type: "LAY_OFF",
      cardId: "opponent-prior-8c",
      meldId: "public-clubs",
    }),
    step("eval-player-1", {
      type: "LAY_OFF",
      cardId: "opponent-prior-9c",
      meldId: "public-clubs",
    }),
    step("eval-player-1", { type: "DISCARD", cardId: "prelude-p1-draw" }),
    step("eval-player-2", { type: "DRAW_FROM_STOCK" }),
    step("eval-player-2", { type: "DISCARD", cardId: "prelude-p2-second" }),
    step(PLAYER, { type: "DRAW_FROM_STOCK" }),
  ];
  const rubric = [
    {
      id: immediate ? "take-certain-exit" : "preserve-and-convert-exit-chance",
      description: immediate
        ? "Go out immediately when the bridge and the other card both lay off."
        : "Avoid enabling the known opponent card before the next turn, then go out under the declared nonterminal draw continuation.",
      weight: 100,
    },
  ] as const;
  return {
    identity: {
      id: `shared-run-${branch}`,
      split: "development",
      category: "shared-run-timing",
      description:
        "A public run extension changes the next opponent's exit options; choose when to open it.",
    },
    assessment: "scripted-outcome",
    evaluatedPlayerId: PLAYER,
    objective: immediate
      ? "Both candidate cards play now, so take the certain immediate win rather than withholding a bridge."
      : "The next player's known retained 4-spade can be played if 5-spade extends the public 6-9 run. Withhold 5-spade until it enables the candidate's own exit. Outcomes are conditional on declared opponent draws; no claim of global expected-score optimality.",
    organizationOrder: "suit",
    maxCandidateTurns: immediate ? 1 : 2,
    maxModelDecisions: immediate ? 1 : 2,
    rubric,
    historyPrelude,
    input: {
      ...roundInput({
        roundNumber: 2,
        dealerIndex: 0,
        hands: [candidateHand, opponentHand, otherHand],
        stock: [
          ...stockPrefix,
          ...shuffle(deck, createSeededRandom("shared-run-v1")),
        ],
        discard: [pickup],
        down: [true, false, true],
        table,
      }),
      seed: "shared-run-v1",
    },
    referenceSequence: immediate
      ? [
          {
            playerId: PLAYER,
            kind: "candidate-turn",
            actions: [
              {
                type: "LAY_OFF",
                cardId: "candidate-5s",
                meldId: "public-spades",
                position: "start",
              },
              {
                type: "LAY_OFF",
                cardId: "candidate-other",
                meldId: "public-clubs",
              },
              { type: "DISCARD", cardId: "root-draw" },
            ],
          },
        ]
      : [
          {
            playerId: PLAYER,
            kind: "candidate-turn",
            actions: [{ type: "DISCARD", cardId: "root-draw" }],
          },
          {
            playerId: "eval-player-1",
            kind: "opponent-script",
            actions: [{ type: "DRAW_FROM_STOCK" }],
          },
          {
            playerId: "eval-player-1",
            kind: "opponent-script",
            actions: [{ type: "DISCARD", cardId: "next-p1-draw" }],
            opponentPolicy: {
              id: "play-known-run-card-if-enabled-v1",
              selectActions: ({ hand, table }) => {
                const card = hand.find((card) => card.id === "known-4s");
                const meld = table.find((meld) => meld.id === "public-spades");
                const position =
                  card && meld ? resolveRunInsertPosition(card, meld) : null;
                return [
                  ...(card && meld && position
                    ? [
                        {
                          type: "LAY_OFF" as const,
                          cardId: card.id,
                          meldId: meld.id,
                          position,
                        },
                      ]
                    : []),
                  { type: "DISCARD", cardId: "next-p1-draw" },
                ];
              },
            },
          },
          {
            playerId: "eval-player-2",
            kind: "opponent-script",
            actions: [
              { type: "DRAW_FROM_STOCK" },
              { type: "DISCARD", cardId: "next-p2-draw" },
            ],
          },
          {
            playerId: PLAYER,
            kind: "candidate-turn",
            actions: [
              { type: "DRAW_FROM_STOCK" },
              {
                type: "LAY_OFF",
                cardId: "future-draw",
                meldId: "public-queens",
              },
              {
                type: "LAY_OFF",
                cardId: "candidate-5s",
                meldId: "public-spades",
                position: "start",
              },
              { type: "DISCARD", cardId: "candidate-other" },
            ],
          },
        ],
    grade: (observation) =>
      rubric.map((rule) =>
        criterion(
          rule,
          wentOut(observation, PLAYER),
          `Candidate ${wentOut(observation, PLAYER) ? "went out" : "did not go out"} within the declared ${immediate ? "one" : "two"}-turn horizon.`,
        ),
      ),
  };
}

export const AI_PLAYER_SHARED_RUN_SCENARIOS: readonly AIPlayerShortRolloutScenario[] =
  [
    sharedRunScenario("delay-natural"),
    sharedRunScenario("delay-wild"),
    sharedRunScenario("take-immediate-win"),
  ];
