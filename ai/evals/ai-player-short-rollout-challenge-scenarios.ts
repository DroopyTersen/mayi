import type { Card } from "../../core/card/card.types";
import type { Meld } from "../../core/meld/meld.types";
import { calculateHandScore } from "../../core/scoring/scoring";
import {
  card,
  criterion,
  joker,
  mayIDecision,
  roundInput,
  successfulAction,
  successfulCardAction,
  wentOut,
  type AIPlayerShortRolloutScenario,
} from "./ai-player-short-rollout-scenario";

const PLAYER = "eval-player-0";

function suited(
  prefix: string,
  ranks: Card["rank"][],
  suit: Card["suit"],
): Card[] {
  return ranks.map((rank) =>
    card(`${prefix}-${rank.toLowerCase()}`, rank, suit),
  );
}

function setCards(prefix: string, rank: Card["rank"], count = 3): Card[] {
  const suits = ["clubs", "diamonds", "hearts", "spades"] as const;
  return Array.from({ length: count }, (_, index) =>
    card(`${prefix}-${index}`, rank, suits[index % suits.length] ?? "clubs"),
  );
}

function idleHand(prefix: string): Card[] {
  return [
    ...suited(`${prefix}-c`, ["3", "5", "8", "J"], "clubs"),
    ...suited(`${prefix}-d`, ["4", "6", "9", "Q"], "diamonds"),
    ...suited(`${prefix}-h`, ["7", "10", "K"], "hearts"),
  ];
}

function opponents(): Card[][] {
  return [idleHand("other-1"), idleHand("other-2")];
}

function contractMeld(type: "set" | "run", cards: readonly Card[]) {
  return { type, cardIds: cards.map((card) => card.id) };
}

function tableSet(id: string, rank: Card["rank"]): Meld {
  return {
    id,
    type: "set",
    ownerId: "eval-player-1",
    cards: setCards(id, rank),
  };
}

const extendedSet = setCards("extended-set", "7");
const extendedRun = suited(
  "extended-run",
  ["3", "4", "5", "6", "7", "8", "9", "10"],
  "spades",
);
const ownSet = setCards("own-set", "9", 7);
const ownRun = suited("own-run", ["4", "5", "6", "7"], "hearts");
const sixSet = setCards("six-set", "7");
const sixLow = suited("six-low", ["3", "4", "5", "6"], "spades");
const sixHigh = suited("six-high", ["10", "J", "Q", "K"], "hearts");
const gapLow = suited("gap-low", ["3", "4", "5", "6"], "spades");
const gapHigh = suited("gap-high", ["9", "10", "J", "Q"], "spades");
const extraSet = setCards("extra-set", "7");
const extraLow = suited("extra-low", ["3", "4", "5", "6"], "spades");
const extraHigh = suited("extra-high", ["9", "10", "J", "Q"], "hearts");

const exitRubric = [
  {
    id: "immediate-exit",
    description: "Use a legal complete contract and go out immediately.",
    weight: 100,
  },
] as const;
const drawWinRubric = [
  {
    id: "take-known-completion",
    description: "Take the public Ace that completes an all-card contract.",
    weight: 40,
  },
  {
    id: "all-card-exit",
    description: "Lay down all twelve cards and win without a discard.",
    weight: 60,
  },
] as const;
const defenseRubric = [
  {
    id: "protect-inferred-gap",
    description:
      "Avoid feeding the nine between an opponent's two public pickups (a heuristic).",
    weight: 60,
  },
  {
    id: "shed-safe-liability",
    description:
      "Prefer the isolated king over lower-point leftovers (a heuristic).",
    weight: 40,
  },
] as const;
const gapRubric = [
  {
    id: "respect-two-rank-gap",
    description: "Lay down two legal runs with two missing ranks between them.",
    weight: 70,
  },
  {
    id: "keep-future-extension",
    description:
      "Retain the eight for a later extension and the diamond pair, shedding the unconnected drawn card.",
    weight: 30,
  },
] as const;
const declineRubric = [
  {
    id: "minimize-forced-horizon-score",
    description:
      "Minimize retained penalty under the scripted next-opponent exit, without taking an unusable Joker.",
    weight: 100,
  },
] as const;
const extraRubric = [
  {
    id: "no-partial-laydown",
    description: "Do not attempt an eleven-card partial Hand 6 contract.",
    weight: 60,
  },
  {
    id: "shed-unmeldable-extra",
    description:
      "Prefer discarding the isolated Ace while preserving all three minimum melds.",
    weight: 40,
  },
] as const;
const recycleRubric = [
  {
    id: "call-completion-with-reserve",
    description:
      "Prefer calling for a contract-completing card when the discard reserve avoids immediate scoring.",
    weight: 70,
  },
  {
    id: "recycle-not-exhaustion",
    description:
      "Successfully claim the nine and replenish the stock without ending the hand.",
    weight: 30,
  },
] as const;

/**
 * New v3 fixtures start the candidate with eleven cards. Opponent scripts and
 * grading text are evaluator-only; the model receives only ordinary public state.
 * Holdouts must not drive prompt edits or configuration selection.
 */
export const AI_PLAYER_SHORT_ROLLOUT_CHALLENGE_SCENARIOS: readonly AIPlayerShortRolloutScenario[] =
  [
    {
      identity: {
        id: "include-extended-run-to-go-out",
        split: "development",
        category: "extended-contract",
        description:
          "Extend the initial run beyond its minimum instead of leaving playable cards stranded.",
      },
      assessment: "tactical",
      evaluatedPlayerId: PLAYER,
      objective:
        "The three-card set plus eight-card run uses all eleven original cards; discard the drawn king and win.",
      organizationOrder: "suit",
      maxCandidateTurns: 1,
      maxModelDecisions: 1,
      rubric: exitRubric,
      input: roundInput({
        roundNumber: 2,
        hands: [[...extendedSet, ...extendedRun], ...opponents()],
        stock: [
          card("extended-k", "K", "clubs"),
          card("reserve", "3", "diamonds"),
        ],
        discard: [card("opening", "Q", "hearts")],
      }),
      referenceSequence: [
        {
          playerId: PLAYER,
          kind: "candidate-turn",
          actions: [
            { type: "DRAW_FROM_STOCK" },
            {
              type: "LAY_DOWN",
              melds: [
                contractMeld("set", extendedSet),
                contractMeld("run", extendedRun),
              ],
            },
            { type: "DISCARD", cardId: "extended-k" },
          ],
        },
      ],
      grade: (observation) => [
        criterion(
          exitRubric[0],
          wentOut(observation, PLAYER),
          `candidate empty=${wentOut(observation, PLAYER)}`,
        ),
      ],
    },
    {
      identity: {
        id: "prioritize-own-contract-over-public-layoff",
        split: "development",
        category: "contract-vs-future-layoff",
        description:
          "Use a card needed by the own contract even though it also fits an opponent's public run.",
      },
      assessment: "tactical",
      evaluatedPlayerId: PLAYER,
      objective:
        "Seven of hearts is essential to the own four-card run. Using it in the contract wins now; hoarding it for a future layoff prevents laying down.",
      organizationOrder: "suit",
      maxCandidateTurns: 1,
      maxModelDecisions: 1,
      rubric: exitRubric,
      input: roundInput({
        roundNumber: 2,
        hands: [[...ownSet, ...ownRun], ...opponents()],
        down: [false, true, false],
        stock: [card("own-k", "K", "clubs"), card("reserve", "3", "diamonds")],
        discard: [card("opening", "Q", "spades")],
        table: [
          tableSet("public-fours", "4"),
          {
            id: "public-hearts",
            type: "run",
            ownerId: "eval-player-1",
            cards: suited("public-hearts", ["8", "9", "10", "J"], "hearts"),
          },
        ],
      }),
      referenceSequence: [
        {
          playerId: PLAYER,
          kind: "candidate-turn",
          actions: [
            { type: "DRAW_FROM_STOCK" },
            {
              type: "LAY_DOWN",
              melds: [contractMeld("set", ownSet), contractMeld("run", ownRun)],
            },
            { type: "DISCARD", cardId: "own-k" },
          ],
        },
      ],
      grade: (observation) => [
        criterion(
          exitRubric[0],
          wentOut(observation, PLAYER),
          `candidate empty=${wentOut(observation, PLAYER)}`,
        ),
      ],
    },
    {
      identity: {
        id: "hand6-take-discard-to-win",
        split: "development",
        category: "hand-six-known-win",
        description:
          "Take a known discard that creates an extended all-card Hand 6 contract.",
      },
      assessment: "tactical",
      evaluatedPlayerId: PLAYER,
      objective:
        "The public Ace extends the heart run. Take it and lay all twelve cards in a set and two runs, with no final discard.",
      organizationOrder: "suit",
      maxCandidateTurns: 1,
      maxModelDecisions: 1,
      rubric: drawWinRubric,
      input: roundInput({
        roundNumber: 6,
        hands: [[...sixSet, ...sixLow, ...sixHigh], ...opponents()],
        stock: [
          card("six-stock-k", "K", "clubs"),
          card("reserve", "3", "diamonds"),
        ],
        discard: [card("six-ace", "A", "hearts")],
      }),
      referenceSequence: [
        {
          playerId: PLAYER,
          kind: "candidate-turn",
          actions: [
            { type: "DRAW_FROM_DISCARD" },
            {
              type: "LAY_DOWN",
              melds: [
                contractMeld("set", sixSet),
                contractMeld("run", sixLow),
                contractMeld("run", [
                  ...sixHigh,
                  card("six-ace", "A", "hearts"),
                ]),
              ],
            },
          ],
        },
      ],
      grade: (observation) => [
        criterion(
          drawWinRubric[0],
          successfulAction(observation, "DRAW_FROM_DISCARD") !== undefined,
          "known discard draw",
        ),
        criterion(
          drawWinRubric[1],
          wentOut(observation, PLAYER),
          `candidate empty=${wentOut(observation, PLAYER)}`,
        ),
      ],
    },
    {
      identity: {
        id: "avoid-publicly-collected-run-gap",
        split: "development",
        category: "opponent-run-inference",
        description:
          "Infer a possible run gap from two public pickups while preserving own run progress.",
      },
      assessment: "strategic-preference",
      evaluatedPlayerId: PLAYER,
      objective:
        "Prefer discarding the isolated king, not nine of hearts between the opponent's public eight and ten. Hidden needs remain uncertain; this is a defensive preference.",
      organizationOrder: "suit",
      maxCandidateTurns: 1,
      maxModelDecisions: 1,
      rubric: defenseRubric,
      actionLog: ["8♥", "10♥"].map((details) => ({
        roundNumber: 3,
        playerId: "eval-player-1",
        playerName: "Scripted Opponent 1",
        action: "picked up from discard",
        details,
      })),
      input: roundInput({
        roundNumber: 3,
        hands: [
          [
            ...suited("defense-s", ["3", "4", "5"], "spades"),
            ...suited("defense-d", ["9", "10", "J"], "diamonds"),
            card("defense-9h", "9", "hearts"),
            card("defense-kc", "K", "clubs"),
            ...suited("defense-c", ["3", "6", "8"], "clubs"),
          ],
          ...opponents(),
        ],
        stock: [
          card("defense-6s", "6", "spades"),
          card("reserve", "3", "diamonds"),
        ],
        discard: [card("opening", "4", "hearts")],
      }),
      referenceSequence: [
        {
          playerId: PLAYER,
          kind: "candidate-turn",
          actions: [
            { type: "DRAW_FROM_STOCK" },
            { type: "SKIP" },
            { type: "DISCARD", cardId: "defense-kc" },
          ],
        },
      ],
      grade: (observation) => [
        criterion(
          defenseRubric[0],
          successfulAction(observation, "DISCARD") !== undefined &&
            !successfulCardAction(observation, "DISCARD", "defense-9h"),
          "completed a discard without feeding nine of hearts",
        ),
        criterion(
          defenseRubric[1],
          successfulCardAction(observation, "DISCARD", "defense-kc"),
          "discarded isolated king",
        ),
      ],
    },
    {
      identity: {
        id: "respect-same-suit-run-gap",
        split: "holdout",
        category: "same-suit-run-gap",
        description:
          "Split same-suit runs legally while retaining a later extension outside the contract.",
      },
      assessment: "tactical",
      evaluatedPlayerId: PLAYER,
      objective:
        "Use 3–6 and 9–Q spades, leaving both 7 and 8 absent between runs. The eight cannot join the upper initial run; keeping it over the king is a strategic tie-breaker.",
      organizationOrder: "suit",
      maxCandidateTurns: 1,
      maxModelDecisions: 1,
      rubric: gapRubric,
      input: roundInput({
        roundNumber: 3,
        hands: [
          [
            ...gapLow,
            card("gap-8", "8", "spades"),
            ...gapHigh,
            ...suited("gap-d", ["9", "10"], "diamonds"),
          ],
          ...opponents(),
        ],
        stock: [card("gap-k", "K", "clubs"), card("reserve", "3", "diamonds")],
        discard: [card("opening", "4", "hearts")],
      }),
      referenceSequence: [
        {
          playerId: PLAYER,
          kind: "candidate-turn",
          actions: [
            { type: "DRAW_FROM_STOCK" },
            {
              type: "LAY_DOWN",
              melds: [
                contractMeld("run", gapLow),
                contractMeld("run", gapHigh),
              ],
            },
            { type: "DISCARD", cardId: "gap-k" },
          ],
        },
      ],
      grade: (observation) => {
        const hand = observation.snapshot.players[0]?.hand ?? [];
        const expectedRemainder = ["gap-8", "gap-d-9", "gap-d-10"];
        return [
          criterion(
            gapRubric[0],
            successfulAction(observation, "LAY_DOWN") !== undefined,
            "legal two-run contract",
          ),
          criterion(
            gapRubric[1],
            hand.length === expectedRemainder.length &&
              hand.every((card) => expectedRemainder.includes(card.id)),
            `retained cards=${hand.map((card) => card.id).join(",")}`,
          ),
        ];
      },
    },
    {
      identity: {
        id: "decline-unusable-joker-swap",
        split: "holdout",
        category: "joker-liability-horizon",
        description:
          "Avoid an unusable Joker before a scripted opponent goes out.",
      },
      assessment: "scripted-outcome",
      evaluatedPlayerId: PLAYER,
      objective:
        "Conditional on the fixed next-opponent exit, discarding Ace without swapping yields 82 points versus at least 91 after swapping. The opponent's exit is not promised to the model; this is a short-horizon outcome probe, not universal dominance.",
      organizationOrder: "suit",
      maxCandidateTurns: 1,
      maxModelDecisions: 1,
      rubric: declineRubric,
      input: roundInput({
        roundNumber: 5,
        hands: [
          [
            card("liability-6h", "6", "hearts"),
            card("liability-as", "A", "spades"),
            card("liability-9c", "9", "clubs"),
            card("liability-qd", "Q", "diamonds"),
            card("liability-3c", "3", "clubs"),
            card("liability-4d", "4", "diamonds"),
            card("liability-5s", "5", "spades"),
            card("liability-7c", "7", "clubs"),
            card("liability-8d", "8", "diamonds"),
            card("liability-10s", "10", "spades"),
            card("liability-kh", "K", "hearts"),
          ],
          [card("liability-other-8", "8", "clubs")],
          idleHand("other-2"),
        ],
        down: [false, true, false],
        stock: [
          card("liability-draw-j", "J", "clubs"),
          card("liability-other-draw", "K", "clubs"),
          card("reserve", "3", "diamonds"),
        ],
        discard: [card("opening", "4", "hearts")],
        table: [
          tableSet("liability-eights", "8"),
          tableSet("liability-jacks", "J"),
          {
            id: "liability-run",
            ownerId: "eval-player-1",
            type: "run",
            cards: [
              card("liability-table-5", "5", "hearts"),
              joker("liability-joker"),
              card("liability-table-7", "7", "hearts"),
              card("liability-table-8", "8", "hearts"),
            ],
          },
        ],
      }),
      prepare: (actor) =>
        actor.send({ type: "DRAW_FROM_STOCK", playerId: PLAYER }),
      referenceSequence: [
        {
          playerId: PLAYER,
          kind: "candidate-turn",
          actions: [
            { type: "SKIP" },
            { type: "DISCARD", cardId: "liability-as" },
          ],
        },
        {
          playerId: "eval-player-1",
          kind: "opponent-script",
          actions: [
            { type: "DRAW_FROM_STOCK" },
            {
              type: "LAY_OFF",
              cardId: "liability-other-8",
              meldId: "liability-eights",
            },
            { type: "DISCARD", cardId: "liability-other-draw" },
          ],
        },
      ],
      grade: (observation) => {
        const hand = observation.snapshot.players.find(
          (player) => player.id === PLAYER,
        )?.hand;
        const score = hand === undefined ? undefined : calculateHandScore(hand);
        return [
          criterion(
            declineRubric[0],
            score === 82 && wentOut(observation, "eval-player-1"),
            `retained penalty=${score}; scripted opponent exited=${wentOut(observation, "eval-player-1")}`,
          ),
        ];
      },
    },
    {
      identity: {
        id: "hand6-discard-unmeldable-extra",
        split: "holdout",
        category: "hand-six-no-partial-contract",
        description:
          "Reject a tempting minimum contract that leaves an extra unmeldable card in Hand 6.",
      },
      assessment: "tactical",
      evaluatedPlayerId: PLAYER,
      objective:
        "All eleven original cards form the minimum contract, but the drawn Ace cannot join it. No partial Hand 6 laydown is legal; prefer shedding the isolated Ace.",
      organizationOrder: "suit",
      maxCandidateTurns: 1,
      maxModelDecisions: 1,
      rubric: extraRubric,
      input: roundInput({
        roundNumber: 6,
        hands: [[...extraSet, ...extraLow, ...extraHigh], ...opponents()],
        stock: [
          card("extra-ace", "A", "clubs"),
          card("reserve", "3", "diamonds"),
        ],
        discard: [card("opening", "4", "hearts")],
      }),
      prepare: (actor) =>
        actor.send({ type: "DRAW_FROM_STOCK", playerId: PLAYER }),
      referenceSequence: [
        {
          playerId: PLAYER,
          kind: "candidate-turn",
          actions: [{ type: "SKIP" }, { type: "DISCARD", cardId: "extra-ace" }],
        },
      ],
      grade: (observation) => [
        criterion(
          extraRubric[0],
          successfulAction(observation, "DISCARD") !== undefined &&
            !observation.candidateAttempts.some(
              (attempt) => attempt.action.type === "LAY_DOWN",
            ),
          "completed without a partial contract attempt",
        ),
        criterion(
          extraRubric[1],
          successfulCardAction(observation, "DISCARD", "extra-ace"),
          "discarded isolated Ace",
        ),
      ],
    },
    {
      identity: {
        id: "call-may-i-with-recyclable-stock",
        split: "holdout",
        category: "may-i-recycling-boundary",
        description:
          "Distinguish last-stock-card danger from a safely recyclable discard reserve.",
      },
      assessment: "strategic-preference",
      evaluatedPlayerId: PLAYER,
      objective:
        "Prefer calling for the nine that completes the contract. Unlike the exhaustion trap, the visible discard reserve replenishes stock. Calling is a strategic preference, not a guaranteed win before the down opponents act.",
      organizationOrder: "rank",
      maxCandidateTurns: 0,
      maxModelDecisions: 1,
      rubric: recycleRubric,
      input: roundInput({
        roundNumber: 1,
        dealerIndex: 0,
        hands: [
          [
            ...setCards("recycle-sevens", "7"),
            ...setCards("recycle-nines", "9", 2),
            card("recycle-3c", "3", "clubs"),
            card("recycle-4d", "4", "diamonds"),
            card("recycle-5s", "5", "spades"),
            card("recycle-6c", "6", "clubs"),
            card("recycle-8d", "8", "diamonds"),
            card("recycle-qc", "Q", "clubs"),
          ],
          ...opponents(),
        ],
        down: [false, true, true],
        stock: [card("recycle-penalty", "3", "hearts")],
        discard: [
          card("recycle-nine", "9", "hearts"),
          ...suited("recycle-reserve", ["4", "5", "6", "8"], "hearts"),
        ],
        table: [
          tableSet("recycle-fours", "4"),
          tableSet("recycle-fives", "5"),
          { ...tableSet("recycle-kings", "K"), ownerId: "eval-player-2" },
          { ...tableSet("recycle-jacks", "J"), ownerId: "eval-player-2" },
        ],
      }),
      referenceSequence: [
        {
          playerId: PLAYER,
          kind: "candidate-may-i",
          mayIDecision: "call",
          actions: [{ type: "CALL_MAY_I" }],
        },
      ],
      grade: (observation) => {
        const claimed =
          observation.snapshot.players[0]?.hand.some(
            (card) => card.id === "recycle-nine",
          ) === true;
        const active = observation.snapshot.phase === "ROUND_ACTIVE";
        return [
          criterion(
            recycleRubric[0],
            mayIDecision(observation) === "call",
            `May I=${mayIDecision(observation)}`,
          ),
          criterion(
            recycleRubric[1],
            claimed && active,
            `claimed=${claimed}; round active=${active}`,
          ),
        ];
      },
    },
  ];
