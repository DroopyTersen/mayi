import type { Card } from "../../core/card/card.types";
import type { Player } from "../../core/engine/engine.types";
import type { GameSnapshot } from "../../core/engine/game-engine.types";
import type {
  PredefinedRoundState,
  RoundInput,
} from "../../core/engine/round.machine";
import type {
  AIPlayerEvalCriterionResult,
  AIPlayerEvalScenarioIdentity,
} from "./ai-player-eval-score";
import type {
  AIPlayerFixedStateAttempt,
  AIPlayerFixedStateRubricCriterion,
  AIPlayerFixedStateRuntimeScenario,
} from "./ai-player-fixed-state-scenarios";

export const AI_PLAYER_MAY_I_CALL_SUITE_VERSION = "may-i-call-v1";

export interface AIPlayerMayICallScenario
  extends AIPlayerFixedStateRuntimeScenario {
  identity: AIPlayerEvalScenarioIdentity;
  evaluatedPlayerId: string;
  expectedDecision: "call" | "pass";
  rubric: readonly AIPlayerFixedStateRubricCriterion[];
  grade: (
    decision: "call" | "pass" | "incomplete",
    after: GameSnapshot,
    attempts: readonly AIPlayerFixedStateAttempt[],
  ) => AIPlayerEvalCriterionResult[];
}

function card(id: string, rank: Card["rank"], suit: Card["suit"]): Card {
  return { id, rank, suit };
}

function player(id: string, name: string, hand: Card[], isDown = false): Player {
  return { id, name, hand, isDown, totalScore: 0 };
}

function stock(prefix: string): Card[] {
  return [
    card(`${prefix}-penalty`, "4", "clubs"),
    card(`${prefix}-reserve-1`, "5", "diamonds"),
    card(`${prefix}-reserve-2`, "6", "spades"),
    card(`${prefix}-reserve-3`, "7", "hearts"),
  ];
}

function input(
  roundNumber: RoundInput["roundNumber"],
  evaluatedHand: Card[],
  exposedDiscard: Card,
  options: {
    opponents?: [Card[], Card[]];
    playerDownStatus?: [boolean, boolean, boolean];
    table?: PredefinedRoundState["table"];
  } = {},
): RoundInput {
  const opponents = options.opponents ?? [
    [card(`${exposedDiscard.id}-p1`, "3", "clubs")],
    [card(`${exposedDiscard.id}-p2`, "5", "hearts")],
  ];
  const down = options.playerDownStatus ?? [false, false, false];
  const hands: [Card[], Card[], Card[]] = [
    evaluatedHand,
    opponents[0],
    opponents[1],
  ];
  return {
    roundNumber,
    // Dealer is player 0, so player 1 is current and player 0 is off turn.
    dealerIndex: 0,
    players: [
      player("eval-player-0", "Evaluated Player", hands[0], down[0]),
      player("eval-player-1", "Current Opponent", hands[1], down[1]),
      player("eval-player-2", "Other Opponent", hands[2], down[2]),
    ],
    predefinedState: {
      hands,
      stock: stock(exposedDiscard.id),
      discard: [exposedDiscard],
      playerDownStatus: [...down],
      table: options.table,
    },
  };
}

function scenario(options: {
  id: string;
  split: "development" | "holdout";
  description: string;
  expectedDecision: "call" | "pass";
  input: RoundInput;
}): AIPlayerMayICallScenario {
  const rubric = [
    {
      id: `${options.expectedDecision}-may-i`,
      description: options.description,
      weight: 100,
    },
  ] as const;
  return {
    identity: {
      id: options.id,
      split: options.split,
      category: "may-i-initiation",
      description: options.description,
    },
    evaluatedPlayerId: "eval-player-0",
    expectedDecision: options.expectedDecision,
    rubric,
    input: options.input,
    grade: (decision, after, attempts) => {
      const acceptedCall = attempts.some(
        (attempt) => attempt.action.type === "CALL_MAY_I" && attempt.ok,
      );
      const callReachedEngine =
        after.mayIContext?.originalCaller === "eval-player-0" || acceptedCall;
      const passed =
        decision === options.expectedDecision &&
        (decision !== "call" || callReachedEngine);
      return [
        {
          ...rubric[0],
          passed,
          evidence: `expected=${options.expectedDecision}; decision=${decision}; acceptedCall=${acceptedCall}`,
        },
      ];
    },
  };
}

export const AI_PLAYER_MAY_I_CALL_SCENARIOS: readonly AIPlayerMayICallScenario[] = [
  scenario({
    id: "call-contract-completing-set",
    split: "development",
    description:
      "Call May I when the exposed king completes the second set required for Hand 1.",
    expectedDecision: "call",
    input: input(
      1,
      [
        card("call-set-7c", "7", "clubs"),
        card("call-set-7d", "7", "diamonds"),
        card("call-set-7h", "7", "hearts"),
        card("call-set-kc", "K", "clubs"),
        card("call-set-kd", "K", "diamonds"),
        card("call-set-3h", "3", "hearts"),
        card("call-set-4s", "4", "spades"),
        card("call-set-5d", "5", "diamonds"),
        card("call-set-8c", "8", "clubs"),
        card("call-set-9s", "9", "spades"),
        card("call-set-jh", "J", "hearts"),
      ],
      card("call-set-discard-k", "K", "spades"),
    ),
  }),
  scenario({
    id: "pass-unrelated-discard",
    split: "development",
    description:
      "Pass when an exposed queen does not materially advance either required set.",
    expectedDecision: "pass",
    input: input(
      1,
      [
        card("pass-q-7c", "7", "clubs"),
        card("pass-q-7d", "7", "diamonds"),
        card("pass-q-9c", "9", "clubs"),
        card("pass-q-9d", "9", "diamonds"),
        card("pass-q-3h", "3", "hearts"),
        card("pass-q-4s", "4", "spades"),
        card("pass-q-5d", "5", "diamonds"),
        card("pass-q-6c", "6", "clubs"),
        card("pass-q-8s", "8", "spades"),
        card("pass-q-jh", "J", "hearts"),
        card("pass-q-kc", "K", "clubs"),
      ],
      card("pass-q-discard", "Q", "spades"),
    ),
  }),
  scenario({
    id: "pass-endgame-single-card-opponent",
    split: "development",
    description:
      "Pass on a merely speculative eight when a down opponent has one card left.",
    expectedDecision: "pass",
    input: input(
      2,
      [
        card("endgame-5c", "5", "clubs"),
        card("endgame-5d", "5", "diamonds"),
        card("endgame-6h", "6", "hearts"),
        card("endgame-7h", "7", "hearts"),
        card("endgame-9h", "9", "hearts"),
        card("endgame-3s", "3", "spades"),
        card("endgame-4d", "4", "diamonds"),
        card("endgame-10c", "10", "clubs"),
        card("endgame-js", "J", "spades"),
        card("endgame-qd", "Q", "diamonds"),
        card("endgame-kc", "K", "clubs"),
      ],
      card("endgame-discard-8", "8", "clubs"),
      {
        opponents: [
          [card("endgame-current-4", "4", "hearts")],
          [card("endgame-other-last", "3", "diamonds")],
        ],
        playerDownStatus: [false, false, true],
        table: [
          {
            id: "endgame-other-set",
            ownerId: "eval-player-2",
            type: "set",
            cards: [
              card("endgame-table-9c", "9", "clubs"),
              card("endgame-table-9d", "9", "diamonds"),
              card("endgame-table-9s", "9", "spades"),
            ],
          },
          {
            id: "endgame-other-run",
            ownerId: "eval-player-2",
            type: "run",
            cards: [
              card("endgame-table-5s", "5", "spades"),
              card("endgame-table-6s", "6", "spades"),
              card("endgame-table-7s", "7", "spades"),
              card("endgame-table-8s", "8", "spades"),
            ],
          },
        ],
      },
    ),
  }),
  scenario({
    id: "call-hand4-third-set",
    split: "development",
    description:
      "Call May I when the exposed king completes the third set required for Hand 4.",
    expectedDecision: "call",
    input: input(
      4,
      [
        card("hand4-4c", "4", "clubs"),
        card("hand4-4d", "4", "diamonds"),
        card("hand4-4h", "4", "hearts"),
        card("hand4-7c", "7", "clubs"),
        card("hand4-7d", "7", "diamonds"),
        card("hand4-7h", "7", "hearts"),
        card("hand4-kc", "K", "clubs"),
        card("hand4-kd", "K", "diamonds"),
        card("hand4-3s", "3", "spades"),
        card("hand4-5s", "5", "spades"),
        card("hand4-9s", "9", "spades"),
      ],
      card("hand4-discard-k", "K", "spades"),
    ),
  }),
  scenario({
    id: "pass-hand6-extra-card-risk",
    split: "holdout",
    description:
      "Pass on an unrelated king in Hand 6 rather than adding two more cards to the all-card contract.",
    expectedDecision: "pass",
    input: input(
      6,
      [
        card("hand6-pass-3h", "3", "hearts"),
        card("hand6-pass-4h", "4", "hearts"),
        card("hand6-pass-6h", "6", "hearts"),
        card("hand6-pass-9d", "9", "diamonds"),
        card("hand6-pass-10d", "10", "diamonds"),
        card("hand6-pass-qd", "Q", "diamonds"),
        card("hand6-pass-7c", "7", "clubs"),
        card("hand6-pass-7d", "7", "diamonds"),
        card("hand6-pass-3s", "3", "spades"),
        card("hand6-pass-8c", "8", "clubs"),
        card("hand6-pass-js", "J", "spades"),
      ],
      card("hand6-pass-discard-k", "K", "clubs"),
    ),
  }),
  scenario({
    id: "call-mixed-contract-run-completion",
    split: "holdout",
    description:
      "Call May I when the exposed eight completes the run alongside an existing set for Hand 2.",
    expectedDecision: "call",
    input: input(
      2,
      [
        card("mixed-call-9c", "9", "clubs"),
        card("mixed-call-9d", "9", "diamonds"),
        card("mixed-call-9s", "9", "spades"),
        card("mixed-call-5h", "5", "hearts"),
        card("mixed-call-6h", "6", "hearts"),
        card("mixed-call-7h", "7", "hearts"),
        card("mixed-call-3c", "3", "clubs"),
        card("mixed-call-4d", "4", "diamonds"),
        card("mixed-call-10s", "10", "spades"),
        card("mixed-call-jc", "J", "clubs"),
        card("mixed-call-qd", "Q", "diamonds"),
      ],
      card("mixed-call-discard-8h", "8", "hearts"),
    ),
  }),
];

export function getAIPlayerMayICallScenario(
  scenarioId: string,
): AIPlayerMayICallScenario {
  const scenario = AI_PLAYER_MAY_I_CALL_SCENARIOS.find(
    (candidate) => candidate.identity.id === scenarioId,
  );
  if (scenario === undefined) {
    throw new Error(`Unknown AI player May I call scenario: ${scenarioId}`);
  }
  return scenario;
}
