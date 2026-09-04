import type { AIPlayerEvalCriterionResult } from "./ai-player-eval-score";
import {
  projectAIPlayerFixedStateSnapshot,
  type AIPlayerFixedStateAttempt,
} from "./ai-player-fixed-state-scenarios";
import {
  allCardActions,
  card,
  criterion,
  joker,
  mayIDecision,
  roundInput,
  successfulAction,
  successfulCardAction,
  wentOut,
  type AIPlayerShortRolloutDecisionRecord,
  type AIPlayerShortRolloutReferenceResult,
  type AIPlayerShortRolloutScenario,
  type AIPlayerRolloutAttempt,
} from "./ai-player-short-rollout-scenario";
import { AI_PLAYER_SHORT_ROLLOUT_CHALLENGE_SCENARIOS } from "./ai-player-short-rollout-challenge-scenarios";
import { AI_PLAYER_STRATEGIC_ROLLOUT_SCENARIOS } from "./ai-player-strategic-rollout-scenarios";
import { AI_PLAYER_MAY_I_HORIZON_SCENARIOS } from "./ai-player-may-i-horizon-scenarios";
import { AI_PLAYER_LAYOFF_HORIZON_SCENARIOS } from "./ai-player-layoff-horizon-scenarios";
import { AI_PLAYER_SHARED_RUN_SCENARIOS } from "./ai-player-shared-run-scenarios";
import { AI_PLAYER_CONTESTED_RUN_EPISODES } from "./ai-player-contested-run-episodes";
import { AI_PLAYER_ROLLOUT_OBSERVATION_VERSION, createAIPlayerRolloutHistory } from "./ai-player-rollout-history";
import type { ActionLogEntry } from "../mayIAgent.prompt-renderer";
import { AIPlayerRolloutDecisionRecorder } from "./ai-player-rollout-decision-evidence";
import { isAIPlayerRolloutComplete, isAIPlayerRolloutTerminal, resolveAIPlayerRolloutActions } from "./ai-player-rollout-policy";

export const AI_PLAYER_SHORT_ROLLOUT_SUITE_VERSION = "short-rollout-v11";

const planMayIRubric = [
  { id: "protect-plan", description: "Preserve both pairs.", weight: 20 },
  {
    id: "call-contract-card",
    description: "Call May I for the exposed nine.",
    weight: 30,
  },
  {
    id: "convert-to-win",
    description: "Convert the plan into going out next turn.",
    weight: 50,
  },
] as const;

const passExhaustionRubric = [
  {
    id: "pass-before-scoring",
    description:
      "Pass because taking the last penalty card immediately forces scoring.",
    weight: 100,
  },
] as const;

const claimContractRubric = [
  {
    id: "claim-with-priority",
    description: "Use current-player priority to claim the contract card.",
    weight: 40,
  },
  {
    id: "claim-then-win",
    description: "Lay down and go out after claiming.",
    weight: 60,
  },
] as const;

const allowLiabilityRubric = [
  {
    id: "allow-joker-liability",
    description:
      "Allow rather than take a Joker and the final stock card before scoring.",
    weight: 100,
  },
] as const;

const jokerSwapRubric = [
  {
    id: "take-set-card",
    description: "Take the exposed nine that completes the set.",
    weight: 20,
  },
  {
    id: "swap-natural",
    description: "Replace the table Joker with the natural six of hearts.",
    weight: 25,
  },
  {
    id: "reuse-joker",
    description: "Use the recovered Joker in the contract run.",
    weight: 25,
  },
  {
    id: "swap-go-out",
    description: "Convert the tactic into going out.",
    weight: 30,
  },
] as const;

const layoffSequenceRubric = [
  {
    id: "natural-extensions",
    description: "Lay every constrained natural extension.",
    weight: 40,
  },
  {
    id: "joker-after-naturals",
    description: "Lay the flexible Joker without blocking a natural.",
    weight: 20,
  },
  {
    id: "layoff-go-out",
    description: "Empty the hand through the layoff sequence.",
    weight: 40,
  },
] as const;

const opponentPickupRubric = [
  {
    id: "avoid-collected-rank",
    description: "Do not feed the seven rank an opponent publicly collected.",
    weight: 60,
  },
  {
    id: "discard-safe-liability",
    description: "Discard the higher-point safe queen instead.",
    weight: 40,
  },
] as const;

const futureLayoffRubric = [
  {
    id: "complete-own-contract",
    description: "Lay down the complete contract immediately.",
    weight: 30,
  },
  {
    id: "preserve-public-layoffs",
    description:
      "Keep cards that fit public melds when doing so does not weaken the contract.",
    weight: 30,
  },
  {
    id: "future-layoffs-win",
    description: "Use the saved cards next turn to go out.",
    weight: 40,
  },
] as const;

export const AI_PLAYER_SHORT_ROLLOUT_SCENARIOS: readonly AIPlayerShortRolloutScenario[] =
  [
    {
      identity: {
        id: "plan-call-may-i-and-go-out",
        split: "development",
        category: "multi-turn-planning",
        description:
          "Preserve two pairs, call for the second set, and go out next turn.",
      },
      evaluatedPlayerId: "eval-player-0",
      assessment: "scripted-outcome",
      objective:
        "The winning line preserves both pairs, calls for the exposed nine, and uses the next seven to go out.",
      organizationOrder: "rank",
      maxCandidateTurns: 2,
      maxModelDecisions: 3,
      rubric: planMayIRubric,
      input: roundInput({
        roundNumber: 1,
        hands: [
          [
            card("p0-7h", "7", "hearts"),
            card("p0-7d", "7", "diamonds"),
            card("p0-9h", "9", "hearts"),
            card("p0-9d", "9", "diamonds"),
            card("p0-kc", "K", "clubs"),
          ],
          [card("p1-9s", "9", "spades"), card("p1-qh", "Q", "hearts")],
          [card("p2-3c", "3", "clubs"), card("p2-jd", "J", "diamonds")],
        ],
        stock: [
          card("p0-first-7s", "7", "spades"),
          card("p1-draw-4c", "4", "clubs"),
          card("p0-penalty-5d", "5", "diamonds"),
          card("p2-draw-6s", "6", "spades"),
          card("p0-next-7c", "7", "clubs"),
          card("reserve-8h", "8", "hearts"),
        ],
        discard: [card("opening-qc", "Q", "clubs")],
      }),
      referenceSequence: [
        {
          playerId: "eval-player-0",
          kind: "candidate-turn",
          actions: [
            { type: "DRAW_FROM_STOCK" },
            { type: "SKIP" },
            { type: "DISCARD", cardId: "p0-kc" },
          ],
        },
        {
          playerId: "eval-player-1",
          kind: "opponent-script",
          actions: [
            { type: "DRAW_FROM_STOCK" },
            { type: "SKIP" },
            { type: "DISCARD", cardId: "p1-9s" },
          ],
        },
        {
          playerId: "eval-player-0",
          kind: "candidate-may-i",
          mayIDecision: "call",
          actions: [{ type: "CALL_MAY_I" }],
        },
        {
          playerId: "eval-player-2",
          kind: "opponent-script",
          actions: [{ type: "ALLOW_MAY_I" }],
        },
        {
          playerId: "eval-player-2",
          kind: "opponent-script",
          actions: [
            { type: "DRAW_FROM_STOCK" },
            { type: "SKIP" },
            { type: "DISCARD", cardId: "p2-draw-6s" },
          ],
        },
        {
          playerId: "eval-player-0",
          kind: "candidate-turn",
          actions: [
            { type: "DRAW_FROM_STOCK" },
            {
              type: "LAY_DOWN",
              melds: [
                {
                  type: "set",
                  cardIds: ["p0-7h", "p0-7d", "p0-first-7s", "p0-next-7c"],
                },
                {
                  type: "set",
                  cardIds: ["p0-9h", "p0-9d", "p1-9s"],
                },
              ],
            },
            { type: "DISCARD", cardId: "p0-penalty-5d" },
          ],
        },
      ],
      grade: (observation) => [
        criterion(
          planMayIRubric[0],
          successfulCardAction(observation, "DISCARD", "p0-kc"),
          `discarded isolated king=${successfulCardAction(observation, "DISCARD", "p0-kc")}`,
        ),
        criterion(
          planMayIRubric[1],
          mayIDecision(observation) === "call",
          `May I decision=${mayIDecision(observation) ?? "missing"}`,
        ),
        criterion(
          planMayIRubric[2],
          wentOut(observation, "eval-player-0"),
          `went out=${wentOut(observation, "eval-player-0")}`,
        ),
      ],
    },
    {
      identity: {
        id: "pass-may-i-before-stock-exhaustion",
        split: "development",
        category: "may-i-initiation",
        description:
          "Decline a tempting Hand 6 Joker because its penalty forces scoring.",
      },
      evaluatedPlayerId: "eval-player-0",
      assessment: "tactical",
      objective:
        "Calling takes the Joker and final stock card, immediately ending the hand before either can be melded and adding 53 points.",
      organizationOrder: "suit",
      maxCandidateTurns: 0,
      maxModelDecisions: 1,
      rubric: passExhaustionRubric,
      input: roundInput({
        roundNumber: 6,
        dealerIndex: 0,
        hands: [
          [
            card("pass-kc", "K", "clubs"),
            card("pass-kd", "K", "diamonds"),
            card("pass-kh", "K", "hearts"),
            card("pass-4h", "4", "hearts"),
            card("pass-5h", "5", "hearts"),
            card("pass-6h", "6", "hearts"),
            card("pass-7h", "7", "hearts"),
            card("pass-9s", "9", "spades"),
            card("pass-10s", "10", "spades"),
            card("pass-js", "J", "spades"),
            card("pass-qs", "Q", "spades"),
          ],
          [card("pass-p1-4c", "4", "clubs"), card("pass-p1-5c", "5", "clubs")],
          [
            card("pass-p2-6d", "6", "diamonds"),
            card("pass-p2-7d", "7", "diamonds"),
          ],
        ],
        stock: [card("pass-last-stock", "3", "clubs")],
        discard: [joker("pass-exposed-joker")],
      }),
      referenceSequence: [
        {
          playerId: "eval-player-0",
          kind: "candidate-may-i",
          mayIDecision: "pass",
          actions: [],
        },
        {
          playerId: "eval-player-1",
          kind: "opponent-script",
          actions: [{ type: "ALLOW_MAY_I" }],
        },
        {
          playerId: "eval-player-2",
          kind: "opponent-script",
          actions: [{ type: "ALLOW_MAY_I" }],
        },
      ],
      grade: (observation) => [
        criterion(
          passExhaustionRubric[0],
          mayIDecision(observation) === "pass",
          `May I decision=${mayIDecision(observation) ?? "missing"}`,
        ),
      ],
    },
    {
      identity: {
        id: "claim-may-i-to-complete-contract",
        split: "development",
        category: "may-i-response",
        description:
          "Use current-player priority to block a caller and immediately win.",
      },
      evaluatedPlayerId: "eval-player-0",
      assessment: "tactical",
      objective:
        "The exposed nine is a penalty-free current-player draw that completes both sets; allowing gives away the winning card.",
      organizationOrder: "rank",
      maxCandidateTurns: 1,
      maxModelDecisions: 2,
      rubric: claimContractRubric,
      input: roundInput({
        roundNumber: 1,
        hands: [
          [
            card("claim-7h", "7", "hearts"),
            card("claim-7d", "7", "diamonds"),
            card("claim-7c", "7", "clubs"),
            card("claim-9h", "9", "hearts"),
            card("claim-9d", "9", "diamonds"),
            card("claim-kc", "K", "clubs"),
          ],
          [
            card("claim-p1-4c", "4", "clubs"),
            card("claim-p1-5c", "5", "clubs"),
          ],
          [
            card("claim-p2-6d", "6", "diamonds"),
            card("claim-p2-8d", "8", "diamonds"),
          ],
        ],
        stock: [card("claim-stock-3s", "3", "spades")],
        discard: [card("claim-exposed-9s", "9", "spades")],
      }),
      prepare: (actor) =>
        actor.send({ type: "CALL_MAY_I", playerId: "eval-player-2" }),
      referenceSequence: [
        {
          playerId: "eval-player-0",
          kind: "candidate-response",
          actions: [{ type: "CLAIM_MAY_I" }],
        },
        {
          // Only reached if the candidate allows instead of claiming. The
          // runners skip allow-only steps after a claim resolves the contest.
          playerId: "eval-player-1",
          kind: "opponent-script",
          actions: [{ type: "ALLOW_MAY_I" }],
        },
        {
          playerId: "eval-player-0",
          kind: "candidate-turn",
          actions: [
            {
              type: "LAY_DOWN",
              melds: [
                {
                  type: "set",
                  cardIds: ["claim-7h", "claim-7d", "claim-7c"],
                },
                {
                  type: "set",
                  cardIds: ["claim-9h", "claim-9d", "claim-exposed-9s"],
                },
              ],
            },
            { type: "DISCARD", cardId: "claim-kc" },
          ],
        },
      ],
      grade: (observation) => [
        criterion(
          claimContractRubric[0],
          successfulAction(observation, "CLAIM_MAY_I") !== undefined,
          `claimed=${successfulAction(observation, "CLAIM_MAY_I") !== undefined}`,
        ),
        criterion(
          claimContractRubric[1],
          wentOut(observation, "eval-player-0"),
          `went out=${wentOut(observation, "eval-player-0")}`,
        ),
      ],
    },
    {
      identity: {
        id: "allow-may-i-to-avoid-joker-liability",
        split: "development",
        category: "may-i-response",
        description:
          "Allow rather than take a Joker and the final stock card before scoring.",
      },
      evaluatedPlayerId: "eval-player-0",
      assessment: "tactical",
      objective:
        "Either winner exhausts stock and ends the hand; allowing transfers 53 points of new liability to the caller.",
      organizationOrder: "suit",
      maxCandidateTurns: 0,
      maxModelDecisions: 1,
      rubric: allowLiabilityRubric,
      input: roundInput({
        roundNumber: 5,
        dealerIndex: 1,
        down: [false, false, true],
        hands: [
          [
            card("allow-p2-ah", "A", "hearts"),
            card("allow-p2-kh", "K", "hearts"),
            card("allow-p2-qh", "Q", "hearts"),
          ],
          [
            card("allow-p0-4h", "4", "hearts"),
            card("allow-p0-5h", "5", "hearts"),
          ],
          [
            card("allow-p1-6c", "6", "clubs"),
            card("allow-p1-7c", "7", "clubs"),
          ],
        ],
        stock: [card("allow-last-stock", "3", "clubs")],
        discard: [joker("allow-exposed-joker")],
      }),
      prepare: (actor) =>
        actor.send({ type: "CALL_MAY_I", playerId: "eval-player-1" }),
      referenceSequence: [
        {
          playerId: "eval-player-0",
          kind: "candidate-response",
          actions: [{ type: "ALLOW_MAY_I" }],
        },
      ],
      grade: (observation) => [
        criterion(
          allowLiabilityRubric[0],
          successfulAction(observation, "ALLOW_MAY_I") !== undefined,
          `allowed=${successfulAction(observation, "ALLOW_MAY_I") !== undefined}`,
        ),
      ],
    },
    {
      identity: {
        id: "swap-joker-to-unlock-contract",
        split: "development",
        category: "joker-swap",
        description: "Combine a discard pickup and exact Joker swap to go out.",
      },
      evaluatedPlayerId: "eval-player-0",
      assessment: "tactical",
      objective:
        "The exposed nine completes the set; swapping six of hearts recovers the only card that completes the spade run.",
      organizationOrder: "suit",
      maxCandidateTurns: 1,
      maxModelDecisions: 1,
      rubric: jokerSwapRubric,
      input: roundInput({
        roundNumber: 2,
        hands: [
          [
            card("swap-9c", "9", "clubs"),
            card("swap-9d", "9", "diamonds"),
            card("swap-8s", "8", "spades"),
            card("swap-9s", "9", "spades"),
            card("swap-10s", "10", "spades"),
            card("swap-6h", "6", "hearts"),
            card("swap-kc", "K", "clubs"),
          ],
          [
            card("swap-p1-4d", "4", "diamonds"),
            card("swap-p1-5d", "5", "diamonds"),
          ],
          [card("swap-p2-6c", "6", "clubs"), card("swap-p2-7c", "7", "clubs")],
        ],
        stock: [card("swap-stock-3d", "3", "diamonds")],
        discard: [card("swap-exposed-9h", "9", "hearts")],
        table: [
          {
            id: "swap-heart-run",
            ownerId: "eval-player-1",
            type: "run",
            cards: [
              card("swap-table-4h", "4", "hearts"),
              card("swap-table-5h", "5", "hearts"),
              joker("swap-table-joker"),
              card("swap-table-7h", "7", "hearts"),
            ],
          },
        ],
      }),
      referenceSequence: [
        {
          playerId: "eval-player-0",
          kind: "candidate-turn",
          actions: [
            { type: "DRAW_FROM_DISCARD" },
            {
              type: "SWAP_JOKER",
              jokerCardId: "swap-table-joker",
              meldId: "swap-heart-run",
              swapCardId: "swap-6h",
            },
            {
              type: "LAY_DOWN",
              melds: [
                {
                  type: "set",
                  cardIds: ["swap-9c", "swap-9d", "swap-exposed-9h"],
                },
                {
                  type: "run",
                  cardIds: [
                    "swap-8s",
                    "swap-9s",
                    "swap-10s",
                    "swap-table-joker",
                  ],
                },
              ],
            },
            { type: "DISCARD", cardId: "swap-kc" },
          ],
        },
      ],
      grade: (observation) => {
        const swap = successfulAction(observation, "SWAP_JOKER");
        const usedJoker = observation.snapshot.table.some(
          (meld) =>
            meld.ownerId === "eval-player-0" &&
            meld.cards.some((entry) => entry.id === "swap-table-joker"),
        );
        return [
          criterion(
            jokerSwapRubric[0],
            observation.candidateAttempts[0]?.action.type ===
              "DRAW_FROM_DISCARD",
            `first action=${observation.candidateAttempts[0]?.action.type ?? "missing"}`,
          ),
          criterion(
            jokerSwapRubric[1],
            swap?.swapCardId === "swap-6h",
            `swap card=${swap?.swapCardId ?? "missing"}`,
          ),
          criterion(jokerSwapRubric[2], usedJoker, `used Joker=${usedJoker}`),
          criterion(
            jokerSwapRubric[3],
            wentOut(observation, "eval-player-0"),
            `went out=${wentOut(observation, "eval-player-0")}`,
          ),
        ];
      },
    },
    {
      identity: {
        id: "sequence-layoffs-to-go-out",
        split: "development",
        category: "layoff-planning",
        description:
          "Play constrained natural extensions before a flexible Joker.",
      },
      evaluatedPlayerId: "eval-player-0",
      assessment: "tactical",
      objective:
        "Using the Joker too early occupies a natural rank; naturals first keeps every card playable and empties the hand.",
      organizationOrder: "suit",
      maxCandidateTurns: 1,
      maxModelDecisions: 1,
      rubric: layoffSequenceRubric,
      input: roundInput({
        roundNumber: 1,
        down: [true, false, false],
        hands: [
          [
            card("layoff-3s", "3", "spades"),
            card("layoff-4s", "4", "spades"),
            joker("layoff-joker"),
            card("layoff-kc", "K", "clubs"),
          ],
          [
            card("layoff-p1-4d", "4", "diamonds"),
            card("layoff-p1-5d", "5", "diamonds"),
          ],
          [
            card("layoff-p2-6c", "6", "clubs"),
            card("layoff-p2-7c", "7", "clubs"),
          ],
        ],
        stock: [
          card("layoff-9s", "9", "spades"),
          card("layoff-reserve-10d", "10", "diamonds"),
        ],
        discard: [card("layoff-qh", "Q", "hearts")],
        table: [
          {
            id: "layoff-spade-run",
            ownerId: "eval-player-1",
            type: "run",
            cards: [
              card("layoff-table-5s", "5", "spades"),
              card("layoff-table-6s", "6", "spades"),
              card("layoff-table-7s", "7", "spades"),
              card("layoff-table-8s", "8", "spades"),
            ],
          },
        ],
      }),
      referenceSequence: [
        {
          playerId: "eval-player-0",
          kind: "candidate-turn",
          actions: [
            { type: "DRAW_FROM_STOCK" },
            {
              type: "LAY_OFF",
              cardId: "layoff-4s",
              meldId: "layoff-spade-run",
              position: "start",
            },
            {
              type: "LAY_OFF",
              cardId: "layoff-3s",
              meldId: "layoff-spade-run",
              position: "start",
            },
            {
              type: "LAY_OFF",
              cardId: "layoff-9s",
              meldId: "layoff-spade-run",
              position: "end",
            },
            {
              type: "LAY_OFF",
              cardId: "layoff-joker",
              meldId: "layoff-spade-run",
              position: "end",
            },
            { type: "DISCARD", cardId: "layoff-kc" },
          ],
        },
      ],
      grade: (observation) => [
        criterion(
          layoffSequenceRubric[0],
          allCardActions(observation, "LAY_OFF", [
            "layoff-4s",
            "layoff-3s",
            "layoff-9s",
          ]),
          `all natural extensions=${allCardActions(observation, "LAY_OFF", ["layoff-4s", "layoff-3s", "layoff-9s"])}`,
        ),
        criterion(
          layoffSequenceRubric[1],
          successfulCardAction(observation, "LAY_OFF", "layoff-joker"),
          `Joker laid off=${successfulCardAction(observation, "LAY_OFF", "layoff-joker")}`,
        ),
        criterion(
          layoffSequenceRubric[2],
          wentOut(observation, "eval-player-0"),
          `went out=${wentOut(observation, "eval-player-0")}`,
        ),
      ],
    },
    {
      identity: {
        id: "avoid-publicly-collected-rank",
        split: "development",
        category: "opponent-inference",
        description:
          "Infer an opponent's kept rank from a public discard pickup and avoid feeding it.",
      },
      evaluatedPlayerId: "eval-player-0",
      assessment: "strategic-preference",
      objective:
        "Prefer discarding the higher-point queen over the seven an opponent publicly collected. This is a defensive heuristic, not proof of the opponent's hidden needs.",
      organizationOrder: "rank",
      maxCandidateTurns: 1,
      maxModelDecisions: 1,
      rubric: opponentPickupRubric,
      actionLog: [
        {
          roundNumber: 1,
          playerId: "eval-player-1",
          playerName: "Scripted Opponent 1",
          action: "picked up from discard",
          details: "7♦",
        },
      ],
      input: roundInput({
        roundNumber: 1,
        hands: [
          [
            card("infer-9c", "9", "clubs"),
            card("infer-9d", "9", "diamonds"),
            card("infer-kc", "K", "clubs"),
            card("infer-kd", "K", "diamonds"),
            card("infer-7c", "7", "clubs"),
            card("infer-qh", "Q", "hearts"),
          ],
          [
            card("infer-p1-4c", "4", "clubs"),
            card("infer-p1-5c", "5", "clubs"),
          ],
          [
            card("infer-p2-6d", "6", "diamonds"),
            card("infer-p2-8d", "8", "diamonds"),
          ],
        ],
        stock: [
          card("infer-stock-3s", "3", "spades"),
          card("infer-reserve-5h", "5", "hearts"),
        ],
        discard: [card("infer-discard-4h", "4", "hearts")],
      }),
      referenceSequence: [
        {
          playerId: "eval-player-0",
          kind: "candidate-turn",
          actions: [
            { type: "DRAW_FROM_STOCK" },
            { type: "SKIP" },
            { type: "DISCARD", cardId: "infer-qh" },
          ],
        },
      ],
      grade: (observation) => {
        const fedSeven = successfulCardAction(
          observation,
          "DISCARD",
          "infer-7c",
        );
        const discardedQueen = successfulCardAction(
          observation,
          "DISCARD",
          "infer-qh",
        );
        return [
          criterion(
            opponentPickupRubric[0],
            !fedSeven,
            `fed collected seven=${fedSeven}`,
          ),
          criterion(
            opponentPickupRubric[1],
            discardedQueen,
            `discarded safe queen=${discardedQueen}`,
          ),
        ];
      },
    },
    {
      identity: {
        id: "preserve-future-layoff-cards",
        split: "development",
        category: "future-layoff-planning",
        description:
          "Lay down without discarding cards that can be used on public melds next turn.",
      },
      evaluatedPlayerId: "eval-player-0",
      assessment: "scripted-outcome",
      objective:
        "The own contract is already complete; keeping K clubs and 3 hearts costs no contract equity and creates a forced next-turn win on public sets.",
      organizationOrder: "suit",
      maxCandidateTurns: 2,
      maxModelDecisions: 2,
      rubric: futureLayoffRubric,
      input: roundInput({
        roundNumber: 2,
        hands: [
          [
            card("future-9c", "9", "clubs"),
            card("future-9d", "9", "diamonds"),
            card("future-9h", "9", "hearts"),
            card("future-4s", "4", "spades"),
            card("future-5s", "5", "spades"),
            card("future-6s", "6", "spades"),
            card("future-7s", "7", "spades"),
            card("future-kc", "K", "clubs"),
            card("future-3h", "3", "hearts"),
          ],
          [
            card("future-p1-4d", "4", "diamonds"),
            card("future-p1-5d", "5", "diamonds"),
          ],
          [
            card("future-p2-6c", "6", "clubs"),
            card("future-p2-7c", "7", "clubs"),
          ],
        ],
        stock: [
          card("future-first-qh", "Q", "hearts"),
          card("future-p1-draw", "8", "diamonds"),
          card("future-p2-draw", "10", "clubs"),
          card("future-next-ks", "K", "spades"),
          card("future-reserve-5c", "5", "clubs"),
        ],
        discard: [card("future-opening-jd", "J", "diamonds")],
        table: [
          {
            id: "future-kings",
            ownerId: "eval-player-1",
            type: "set",
            cards: [
              card("future-table-kh", "K", "hearts"),
              card("future-table-kd", "K", "diamonds"),
              card("future-table-ks", "K", "spades"),
            ],
          },
          {
            id: "future-threes",
            ownerId: "eval-player-2",
            type: "set",
            cards: [
              card("future-table-3s", "3", "spades"),
              card("future-table-3d", "3", "diamonds"),
              card("future-table-3c", "3", "clubs"),
            ],
          },
        ],
      }),
      referenceSequence: [
        {
          playerId: "eval-player-0",
          kind: "candidate-turn",
          actions: [
            { type: "DRAW_FROM_STOCK" },
            {
              type: "LAY_DOWN",
              melds: [
                {
                  type: "set",
                  cardIds: ["future-9c", "future-9d", "future-9h"],
                },
                {
                  type: "run",
                  cardIds: ["future-4s", "future-5s", "future-6s", "future-7s"],
                },
              ],
            },
            { type: "DISCARD", cardId: "future-first-qh" },
          ],
        },
        {
          playerId: "eval-player-1",
          kind: "opponent-script",
          actions: [{ type: "DRAW_FROM_STOCK" }],
        },
        {
          playerId: "eval-player-1",
          kind: "opponent-script",
          actions: [],
          opponentPolicy: {
            id: "discard-actual-drawn-card-v1",
            selectActions: ({ hand }) => {
              const drawn = hand.at(-1);
              if (!drawn) throw new Error("Opponent has no drawn card to discard");
              return [{ type: "SKIP" }, { type: "DISCARD", cardId: drawn.id }];
            },
          },
        },
        {
          playerId: "eval-player-2",
          kind: "opponent-script",
          actions: [{ type: "DRAW_FROM_STOCK" }],
        },
        {
          playerId: "eval-player-2",
          kind: "opponent-script",
          actions: [],
          opponentPolicy: {
            id: "discard-actual-drawn-card-v1",
            selectActions: ({ hand }) => {
              const drawn = hand.at(-1);
              if (!drawn) throw new Error("Opponent has no drawn card to discard");
              return [{ type: "SKIP" }, { type: "DISCARD", cardId: drawn.id }];
            },
          },
        },
        {
          playerId: "eval-player-0",
          kind: "candidate-turn",
          actions: [
            { type: "DRAW_FROM_STOCK" },
            { type: "LAY_OFF", cardId: "future-kc", meldId: "future-kings" },
            {
              type: "LAY_OFF",
              cardId: "future-next-ks",
              meldId: "future-kings",
            },
            { type: "LAY_OFF", cardId: "future-3h", meldId: "future-threes" },
          ],
        },
      ],
      grade: (observation) => {
        const laidDown =
          successfulAction(observation, "LAY_DOWN") !== undefined;
        const savedCardsUsed = allCardActions(observation, "LAY_OFF", [
          "future-kc",
          "future-3h",
        ]);
        return [
          criterion(
            futureLayoffRubric[0],
            laidDown,
            `laid down own contract=${laidDown}`,
          ),
          criterion(
            futureLayoffRubric[1],
            savedCardsUsed,
            `saved public layoff cards used=${savedCardsUsed}`,
          ),
          criterion(
            futureLayoffRubric[2],
            wentOut(observation, "eval-player-0"),
            `went out=${wentOut(observation, "eval-player-0")}`,
          ),
        ];
      },
    },
    ...AI_PLAYER_SHORT_ROLLOUT_CHALLENGE_SCENARIOS,
    ...AI_PLAYER_STRATEGIC_ROLLOUT_SCENARIOS,
    ...AI_PLAYER_MAY_I_HORIZON_SCENARIOS,
    ...AI_PLAYER_LAYOFF_HORIZON_SCENARIOS,
    ...AI_PLAYER_SHARED_RUN_SCENARIOS,
    ...AI_PLAYER_CONTESTED_RUN_EPISODES,
  ];

export function scoreAIPlayerShortRolloutCriteria(
  criteria: readonly AIPlayerEvalCriterionResult[],
): number {
  const totalWeight = criteria.reduce((sum, result) => sum + result.weight, 0);
  if (totalWeight === 0) return 0;
  const passedWeight = criteria.reduce(
    (sum, result) => sum + (result.passed ? result.weight : 0),
    0,
  );
  return (passedWeight / totalWeight) * 100;
}

export async function runAIPlayerShortRolloutReference(
  scenario: AIPlayerShortRolloutScenario,
): Promise<AIPlayerShortRolloutReferenceResult> {
  const history = await createAIPlayerRolloutHistory(scenario);
  const { actor } = history;
  const decisionHistories: ActionLogEntry[][] = [];
  const candidateAttempts: AIPlayerFixedStateAttempt[] = [];
  const attempts: AIPlayerRolloutAttempt[] = [];
  const decisions: AIPlayerShortRolloutDecisionRecord[] = [];
  let legal = true;
  let opponentActionsLegal = true;

  try {
    for (const decision of scenario.referenceSequence) {
      const before = projectAIPlayerFixedStateSnapshot(actor);
      if (isAIPlayerRolloutTerminal(before)) break;
      const plannedActions = resolveAIPlayerRolloutActions(decision, before);
      if (
        decision.kind === "opponent-script" &&
        plannedActions.every((action) => action.type === "ALLOW_MAY_I") &&
        before.phase !== "RESOLVING_MAY_I"
      )
        continue;
      const state = history.createRuntime(decision.playerId);
      const recorder = new AIPlayerRolloutDecisionRecorder(decision.playerId);
      const runtime = decision.kind === "opponent-script" ? state.runtime : recorder.wrap(state.runtime);
      if (decision.kind !== "opponent-script") decisionHistories.push(history.getActionLog());
      let success = true;
      for (const action of plannedActions) {
        const current = projectAIPlayerFixedStateSnapshot(actor);
        if (isAIPlayerRolloutTerminal(current)) break;
        const result = await runtime.executeAction(action);
        if (!result.ok) {
          success = false;
          legal = false;
          if (decision.kind === "opponent-script") opponentActionsLegal = false;
        }
      }
      attempts.push(...state.attempts.map(attempt => ({ ...attempt, playerId: decision.playerId, kind: decision.kind })));
      if (decision.kind !== "opponent-script") {
        candidateAttempts.push(...state.attempts);
        decisions.push({
          playerId: decision.playerId,
          kind: decision.kind,
          success,
          actionEvidence: recorder.evidence,
          ...(decision.mayIDecision === undefined
            ? {}
            : { mayIDecision: decision.mayIDecision }),
        });
      }
    }

    const snapshot = projectAIPlayerFixedStateSnapshot(actor);
    const criteria = scenario.grade({ snapshot, candidateAttempts, decisions });
    const winner = snapshot.players.find(
      (candidate) => candidate.hand.length === 0,
    );
    const completed = isAIPlayerRolloutComplete({ snapshot, decisions, maxModelDecisions: scenario.maxModelDecisions, opponentActionsLegal });
    return {
      attempts,
      decisions,
      finalSnapshot: snapshot,
      observationVersion: AI_PLAYER_ROLLOUT_OBSERVATION_VERSION,
      decisionHistories,
      candidateTurns: decisions.filter(
        (decision) => decision.kind === "candidate-turn",
      ).length,
      modelDecisions: decisions.length,
      completed,
      legal,
      qualityPercent: completed && legal ? scoreAIPlayerShortRolloutCriteria(criteria) : 0,
      criteria,
      winnerPlayerId: winner?.id,
    };
  } finally {
    actor.stop();
  }
}
