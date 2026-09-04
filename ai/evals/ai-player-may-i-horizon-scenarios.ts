import {
  createDeck,
  createSeededRandom,
  shuffle,
} from "../../core/card/card.deck";
import type { Card } from "../../core/card/card.types";
import type { Meld } from "../../core/meld/meld.types";
import {
  criterion,
  mayIDecision,
  roundInput,
  type AIPlayerShortRolloutScenario,
} from "./ai-player-short-rollout-scenario";

const PLAYER = "eval-player-0";

function mayIHorizonScenario(
  reserveCount: 2 | 4,
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
  const sevens = [
    take("candidate-7c", "7", "clubs"),
    take("candidate-7d", "7", "diamonds"),
    take("candidate-7h", "7", "hearts"),
  ];
  const nines = [
    take("candidate-9c", "9", "clubs"),
    take("candidate-9d", "9", "diamonds"),
  ];
  const hand = [
    ...sevens,
    ...nines,
    take("candidate-3h", "3", "hearts"),
    take("candidate-4d", "4", "diamonds"),
    take("candidate-5s", "5", "spades"),
    take("candidate-6c", "6", "clubs"),
    take("candidate-10h", "10", "hearts"),
    take("candidate-8d", "8", "diamonds"),
  ];
  const exposed = take("exposed-9h", "9", "hearts");
  const penalty = take("last-stock-ace", "A", "clubs");
  const reserves = [
    take("reserve-4c", "4", "clubs"),
    take("reserve-5c", "5", "clubs"),
  ];
  if (reserveCount === 4)
    reserves.push(
      take("reserve-6c", "6", "clubs"),
      take("reserve-8c", "8", "clubs"),
    );
  const opponent1Discard = take("opponent-1-discard", "K", "clubs");
  const opponent2Discard = take("opponent-2-discard", "Q", "clubs");
  const opponent3Discard = take("opponent-3-discard", "K", "diamonds");
  const table: Meld[] = (["J", "K", "Q", "A", "3", "5"] as const).map(
    (rank, index) => ({
      id: `table-${rank}`,
      ownerId: `eval-player-${Math.floor(index / 2) + 1}`,
      type: "set",
      cards: (["diamonds", "hearts", "spades"] as const).map((suit) =>
        take(`table-${rank}-${suit}`, rank, suit),
      ),
    }),
  );
  const remaining = shuffle(
    deck,
    createSeededRandom("may-i-horizon-inventory-v1"),
  );
  const opponent1Hand = [opponent1Discard, ...remaining.splice(0, 24)];
  const opponent2Hand = [opponent2Discard, ...remaining.splice(0, 24)];
  const opponent3Hand = [opponent3Discard, ...remaining];
  const rubric = [
    {
      id:
        reserveCount === 2
          ? "avoid-delayed-forced-scoring"
          : "realize-contract-before-horizon",
      description:
        reserveCount === 2
          ? "Pass: calling adds two cards and forces scoring on the current down player's mandatory draw before the caller can act."
          : "Claim the completing nine and lay down the exact two minimum sets on the next own turn, while the extra reserve keeps play alive.",
      weight: 100,
    },
  ] as const;
  return {
    identity: {
      id:
        reserveCount === 2
          ? "pass-may-i-before-delayed-exhaustion"
          : "call-may-i-with-two-more-reserves",
      split: "development",
      category: "delayed-stock-horizon",
      description:
        "Trace the penalty draw, automatic recycling, and mandatory opponent draws before judging whether a completing discard can be used.",
    },
    assessment: "scripted-outcome",
    evaluatedPlayerId: PLAYER,
    objective:
      "Rare stock-exhaustion boundary: distinguish immediate recycling from surviving to the next own turn. Full inventory entails large opponent hands after repeated earlier claims; this is not representative opening play.",
    organizationOrder: "rank",
    maxCandidateTurns: reserveCount === 2 ? 0 : 1,
    maxModelDecisions: reserveCount === 2 ? 1 : 2,
    rubric,
    input: {
      ...roundInput({
        roundNumber: 1,
        dealerIndex: 0,
        hands: [hand, opponent1Hand, opponent2Hand, opponent3Hand],
        stock: [penalty],
        discard: [exposed, ...reserves],
        down: [false, true, true, true],
        table,
      }),
      seed: "may-i-horizon-recycle-v1",
    },
    referenceSequence:
      reserveCount === 2
        ? [
            {
              playerId: PLAYER,
              kind: "candidate-may-i",
              mayIDecision: "pass",
              actions: [],
            },
            {
              playerId: "eval-player-1",
              kind: "opponent-script",
              actions: [{ type: "DRAW_FROM_STOCK" }],
            },
          ]
        : [
            {
              playerId: PLAYER,
              kind: "candidate-may-i",
              mayIDecision: "call",
              actions: [{ type: "CALL_MAY_I" }],
            },
            {
              playerId: "eval-player-1",
              kind: "opponent-script",
              actions: [
                { type: "DRAW_FROM_STOCK" },
                { type: "DISCARD", cardId: opponent1Discard.id },
              ],
            },
            {
              playerId: "eval-player-2",
              kind: "opponent-script",
              actions: [
                { type: "DRAW_FROM_STOCK" },
                { type: "DISCARD", cardId: opponent2Discard.id },
              ],
            },
            {
              playerId: "eval-player-3",
              kind: "opponent-script",
              actions: [
                { type: "DRAW_FROM_STOCK" },
                { type: "DISCARD", cardId: opponent3Discard.id },
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
                    { type: "set", cardIds: sevens.map((card) => card.id) },
                    {
                      type: "set",
                      cardIds: [...nines, exposed].map((card) => card.id),
                    },
                  ],
                },
                { type: "DISCARD", cardId: penalty.id },
              ],
            },
          ],
    grade: (observation) => {
      const candidate = observation.snapshot.players.find(
        (player) => player.id === PLAYER,
      );
      const passed =
        reserveCount === 2
          ? mayIDecision(observation) === "pass" &&
            observation.snapshot.phase === "ROUND_ACTIVE" &&
            candidate?.hand.length === hand.length
          : candidate?.isDown === true;
      return [
        criterion(
          rubric[0],
          passed,
          `decision=${mayIDecision(observation)}; final phase=${observation.snapshot.phase}; down=${candidate?.isDown}; held=${candidate?.hand.length}`,
        ),
      ];
    },
  };
}

export const AI_PLAYER_MAY_I_HORIZON_SCENARIOS: readonly AIPlayerShortRolloutScenario[] =
  [mayIHorizonScenario(2), mayIHorizonScenario(4)];
