import { createActor } from "xstate";
import type {
  AIActionRuntime,
  AIActionResult,
} from "../ai-action-runtime.types";
import type { GameAction } from "../ai-action-runtime.types";
import type { ActionLogEntry } from "../mayIAgent.prompt-renderer";
import type { Card } from "../../core/card/card.types";
import type { Player } from "../../core/engine/engine.types";
import { ACTIONS_THAT_IGNORE_LAST_ERROR, validateGameActionCommand } from "../../core/engine/game-action.command-policy";
import { projectGameSnapshotFromXState } from "../../core/engine/game-engine.projection";
import type { GameSnapshot } from "../../core/engine/game-engine.types";
import {
  roundMachine,
  type PredefinedRoundState,
  type RoundInput,
} from "../../core/engine/round.machine";
import type {
  AIPlayerEvalCriterionResult,
  AIPlayerEvalScenarioIdentity,
} from "./ai-player-eval-score";

export const AI_PLAYER_FIXED_STATE_SUITE_VERSION = "fixed-state-v2";
/** v3 follows the app's stale-error policy for accepted round-level actions. */
export const AI_PLAYER_FIXED_STATE_RUNTIME_VERSION = "fixed-state-runtime-v4";

export interface AIPlayerFixedStateAttempt {
  action: GameAction;
  ok: boolean;
  error?: string;
}

export interface AIPlayerFixedStateRubricCriterion {
  id: string;
  description: string;
  weight: number;
}

export type AIPlayerFixedStateActor = ReturnType<
  typeof createActor<typeof roundMachine>
>;

export interface AIPlayerFixedStateRuntimeScenario {
  identity: AIPlayerEvalScenarioIdentity;
  input: RoundInput;
  prepare?: (actor: AIPlayerFixedStateActor) => void;
}

export interface AIPlayerFixedStateScenario extends AIPlayerFixedStateRuntimeScenario {
  rubric: readonly AIPlayerFixedStateRubricCriterion[];
  /** Known-good action path used to continuously validate the scenario and grader. */
  referenceActions: readonly GameAction[];
  grade: (
    after: GameSnapshot,
    attempts: readonly AIPlayerFixedStateAttempt[],
  ) => AIPlayerEvalCriterionResult[];
  maxSteps?: number;
  actionLog?: ActionLogEntry[];
}

function card(id: string, rank: Card["rank"], suit: Card["suit"]): Card {
  return { id, rank, suit };
}

function joker(id: string): Card {
  return { id, rank: "Joker", suit: null };
}

function stockPile(topCard: Card): Card[] {
  return [
    topCard,
    card(`${topCard.id}-reserve-1`, "4", "clubs"),
    card(`${topCard.id}-reserve-2`, "5", "diamonds"),
    card(`${topCard.id}-reserve-3`, "6", "spades"),
    card(`${topCard.id}-reserve-4`, "7", "hearts"),
    card(`${topCard.id}-reserve-5`, "8", "clubs"),
  ];
}

function players(hands: Card[][], down: boolean[] = []): Player[] {
  return hands.map((hand, index) => ({
    id: `eval-player-${index}`,
    name: index === 0 ? "Evaluated Player" : `Opponent ${index}`,
    hand,
    isDown: down[index] ?? false,
    totalScore: index === 0 ? 12 : index * 34,
  }));
}

function baseInput(
  roundNumber: RoundInput["roundNumber"],
  state: PredefinedRoundState,
): RoundInput {
  return {
    roundNumber,
    players: players(state.hands, state.playerDownStatus),
    dealerIndex: state.hands.length - 1,
    predefinedState: state,
  };
}

export function projectAIPlayerFixedStateSnapshot(
  actor: AIPlayerFixedStateActor,
): GameSnapshot {
  const roundSnapshot = actor.getPersistedSnapshot() as unknown as {
    value: unknown;
    context: { players: Player[]; roundNumber: number; dealerIndex: number };
    children?: {
      turn?: { snapshot?: { context?: { hand?: Card[]; isDown?: boolean } } };
    };
  };
  const roundContext = actor.getSnapshot().context;
  const projected = projectGameSnapshotFromXState({
    actorSnapshot: {
      value: roundSnapshot.value === "scoring" ? "roundEnd" : "playing",
      context: {
        players: roundContext.players,
        currentRound: roundContext.roundNumber,
        dealerIndex: roundContext.dealerIndex,
        lastError: null,
        roundHistory: [],
      },
    },
    persistedSnapshot: { children: { round: { snapshot: roundSnapshot } } },
    gameId: "ai-player-fixed-state-eval",
    createdAt: "2026-09-02T00:00:00.000Z",
  });
  const turnContext = roundSnapshot.children?.turn?.snapshot?.context;
  const currentId = projected.players[projected.currentPlayerIndex]?.id;

  return {
    ...projected,
    players: projected.players.map((player) =>
      player.id === currentId && turnContext?.hand
        ? {
            ...player,
            hand: turnContext.hand,
            isDown: turnContext.isDown ?? player.isDown,
          }
        : player,
    ),
  };
}

function stableHandOrderKey(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

export function getAIPlayerFixedStateInputForRepetition(
  scenario: AIPlayerFixedStateRuntimeScenario,
  repetition: number,
): RoundInput {
  // Keep recycling reproducible even when a model takes an unexpected branch.
  // Repetitions vary hand order, not the underlying random stream.
  const input: RoundInput = {
    ...scenario.input,
    seed: scenario.input.seed ?? `fixed-state:${scenario.identity.id}`,
  };
  const predefinedState = input.predefinedState;
  const evaluatedHand = predefinedState?.hands[0];
  if (
    predefinedState === undefined ||
    evaluatedHand === undefined ||
    repetition <= 1
  ) {
    return input;
  }

  const orderedEvaluatedHand = [...evaluatedHand].sort((left, right) => {
    const leftKey = stableHandOrderKey(
      `${scenario.identity.id}:${repetition}:${left.id}`,
    );
    const rightKey = stableHandOrderKey(
      `${scenario.identity.id}:${repetition}:${right.id}`,
    );
    return leftKey - rightKey || left.id.localeCompare(right.id);
  });
  const hands = predefinedState.hands.map((hand, index) =>
    index === 0 ? orderedEvaluatedHand : [...hand],
  );

  return {
    ...input,
    players: input.players.map((player, index) => ({
      ...player,
      hand: index === 0 ? orderedEvaluatedHand : [...player.hand],
    })),
    predefinedState: {
      ...predefinedState,
      hands,
    },
  };
}

export function createAIPlayerFixedStateRuntime(
  scenario: AIPlayerFixedStateRuntimeScenario,
  repetition = 1,
  actingPlayerId?: string,
): {
  runtime: AIActionRuntime;
  actor: AIPlayerFixedStateActor;
  attempts: AIPlayerFixedStateAttempt[];
} {
  const actor = createAIPlayerFixedStateActor(scenario, repetition);
  const state = createAIPlayerFixedStateActorRuntime(actor, actingPlayerId);

  return { ...state, actor };
}

export function createAIPlayerFixedStateActor(
  scenario: AIPlayerFixedStateRuntimeScenario,
  repetition = 1,
): AIPlayerFixedStateActor {
  const actor = createActor(roundMachine, {
    input: getAIPlayerFixedStateInputForRepetition(scenario, repetition),
  });
  actor.start();
  scenario.prepare?.(actor);
  return actor;
}

export function createAIPlayerFixedStateActorRuntime(
  actor: AIPlayerFixedStateActor,
  actingPlayerId?: string,
): {
  runtime: AIActionRuntime;
  attempts: AIPlayerFixedStateAttempt[];
} {
  const attempts: AIPlayerFixedStateAttempt[] = [];

  const runtime: AIActionRuntime = {
    async getSnapshot() {
      return projectAIPlayerFixedStateSnapshot(actor);
    },
    async executeAction(action: GameAction): Promise<AIActionResult> {
      const before = projectAIPlayerFixedStateSnapshot(actor);
      const playerId = actingPlayerId ?? before.awaitingPlayerId;
      const validation = validateGameActionCommand(before, playerId, action);
      if (!validation.ok) {
        const error = validation.error;
        attempts.push({ action, ok: false, error });
        return { ok: false, snapshot: before, error };
      }
      switch (action.type) {
        case "DRAW_FROM_STOCK":
          actor.send({ type: "DRAW_FROM_STOCK", playerId });
          break;
        case "DRAW_FROM_DISCARD":
          actor.send({ type: "DRAW_FROM_DISCARD", playerId });
          break;
        case "SKIP":
          actor.send({ type: "SKIP_LAY_DOWN", playerId });
          break;
        case "DISCARD":
          actor.send({ type: "DISCARD", playerId, cardId: action.cardId });
          break;
        case "LAY_DOWN":
          actor.send({ type: "LAY_DOWN", playerId, melds: action.melds });
          break;
        case "LAY_OFF":
          actor.send({
            type: "LAY_OFF",
            playerId,
            cardId: action.cardId,
            meldId: action.meldId,
            position: action.position,
          });
          break;
        case "SWAP_JOKER":
          actor.send({
            type: "SWAP_JOKER",
            playerId,
            jokerCardId: action.jokerCardId,
            meldId: action.meldId,
            swapCardId: action.swapCardId,
          });
          break;
        case "ALLOW_MAY_I":
          actor.send({ type: "ALLOW_MAY_I", playerId });
          break;
        case "CLAIM_MAY_I":
          actor.send({ type: "CLAIM_MAY_I", playerId });
          break;
        case "CALL_MAY_I":
          actor.send({ type: "CALL_MAY_I", playerId });
          break;
        case "REORDER_HAND":
          actor.send({
            type: "REORDER_HAND",
            playerId,
            newOrder: action.cardIds,
          });
          break;
      }

      const after = projectAIPlayerFixedStateSnapshot(actor);
      const { updatedAt: _beforeUpdatedAt, ...stableBefore } = before;
      const { updatedAt: _afterUpdatedAt, ...stableAfter } = after;
      const changed =
        JSON.stringify(stableBefore) !== JSON.stringify(stableAfter);
      const previousHand = before.players.find(
        (player) => player.id === playerId,
      )?.hand;
      // Free organization is successful when the requested order is already
      // present. Snapshot change alone is not proof of command acceptance.
      const validNoOpReorder =
        action.type === "REORDER_HAND" &&
        previousHand !== undefined &&
        previousHand.length === action.cardIds.length &&
        previousHand.every((card, index) => card.id === action.cardIds[index]);
      const ok = (changed || validNoOpReorder) &&
        (!after.lastError || ACTIONS_THAT_IGNORE_LAST_ERROR.has(action.type));
      const result: AIActionResult = ok
        ? { ok: true, snapshot: after }
        : {
            ok: false,
            snapshot: after,
            error: after.lastError ?? "Action was not accepted",
          };
      attempts.push({
        action,
        ok: result.ok,
        ...(result.ok ? {} : { error: result.error }),
      });
      return result;
    },
  };

  return { runtime, attempts };
}

function criterion(
  definition: AIPlayerFixedStateRubricCriterion,
  passed: boolean,
  evidence: string,
): AIPlayerEvalCriterionResult {
  return { ...definition, passed, evidence };
}

function actionOfType<T extends GameAction["type"]>(
  attempts: readonly AIPlayerFixedStateAttempt[],
  type: T,
): Extract<GameAction, { type: T }> | undefined {
  return attempts.find((attempt) => attempt.action.type === type)?.action as
    | Extract<GameAction, { type: T }>
    | undefined;
}

const drawStockSafeDiscardRubric = [
  {
    id: "draw-source",
    description:
      "Draw from stock instead of taking an irrelevant exposed discard.",
    weight: 20,
  },
  {
    id: "discard-liability",
    description: "Discard the highest-point non-contract liability.",
    weight: 80,
  },
] as const;

const laydownExactContractRubric = [
  {
    id: "lay-down",
    description: "Recognize and lay down the complete two-set contract.",
    weight: 80,
  },
  {
    id: "exact-contract",
    description: "Create exactly the two required melds.",
    weight: 20,
  },
] as const;

const drawDiscardCompletesContractRubric = [
  {
    id: "take-contract-card",
    description:
      "Take the exposed king that immediately completes the second set.",
    weight: 40,
  },
  {
    id: "lay-down-after-draw",
    description: "Lay down the completed two-set contract on the same turn.",
    weight: 60,
  },
] as const;

const claimMayICompletesContractRubric = [
  {
    id: "claim-contract-card",
    description:
      "Block the caller and claim the exposed king that completes the contract.",
    weight: 100,
  },
] as const;

const multiDeckDuplicateSetRubric = [
  {
    id: "lay-down-duplicate-suit-set",
    description:
      "Recognize duplicate physical suits as valid members of a multi-deck set.",
    weight: 100,
  },
] as const;

const sameSuitGapNegativeRubric = [
  {
    id: "do-not-lay-invalid-gap",
    description:
      "Do not lay down two same-suit runs separated by only one missing card.",
    weight: 100,
  },
] as const;

const wildRatioValidRubric = [
  {
    id: "balanced-wild-contract",
    description:
      "Use one wild with two natural cards in each set to complete the contract.",
    weight: 100,
  },
] as const;

const wildRatioNegativeRubric = [
  {
    id: "reject-wild-heavy-meld",
    description:
      "Do not lay a set in which wild cards outnumber natural cards.",
    weight: 100,
  },
] as const;

const aceHighRunRubric = [
  {
    id: "ace-high-run",
    description: "Recognize 10-J-Q-K-A of one suit as a valid high-Ace run.",
    weight: 100,
  },
] as const;

const aceLowNegativeRubric = [
  {
    id: "reject-ace-low-run",
    description: "Do not treat A-3-4-5 as a valid run.",
    weight: 100,
  },
] as const;

const sameSuitGapPositiveRubric = [
  {
    id: "accept-two-card-gap",
    description:
      "Lay two same-suit runs when exactly two natural ranks separate them.",
    weight: 100,
  },
] as const;

const layoffAllToGoOutRubric = [
  {
    id: "lay-off-all-cards",
    description: "Lay off every remaining card and go out without a discard.",
    weight: 100,
  },
] as const;

const downPlayerStockOnlyRubric = [
  {
    id: "down-player-draw-stock",
    description:
      "Draw from stock because a down player may not take the discard.",
    weight: 100,
  },
] as const;

const roundSixDeclineMayIRubric = [
  {
    id: "decline-round-six-may-i",
    description:
      "Allow an irrelevant May I in Hand 6 rather than adding two hard-to-meld cards.",
    weight: 100,
  },
] as const;

const mayIResponseRubric = [
  {
    id: "allow-harmful-claim",
    description:
      "Allow an irrelevant exposed queen rather than adding risk by claiming it.",
    weight: 100,
  },
] as const;

const layoffRubric = [
  {
    id: "lay-off-playable-card",
    description:
      "Lay the nine of clubs onto the public club run instead of discarding it.",
    weight: 100,
  },
] as const;

const jokerSwapRubric = [
  {
    id: "swap-joker",
    description:
      "Swap the natural six of hearts for the Joker in the public run.",
    weight: 50,
  },
  {
    id: "use-joker-to-contract",
    description:
      "Use the recovered Joker to complete and lay down the contract.",
    weight: 50,
  },
] as const;

const opponentFeedRubric = [
  {
    id: "avoid-opponent-rank",
    description:
      "Do not discard the seven rank publicly collected by an opponent.",
    weight: 100,
  },
] as const;

const endgamePointDumpRubric = [
  {
    id: "dump-joker",
    description:
      "Discard the 50-point Joker when a down opponent has one card.",
    weight: 100,
  },
] as const;

const roundSixAllCardsRubric = [
  {
    id: "round-six-lay-down",
    description: "Recognize the complete Hand 6 contract and lay it down.",
    weight: 50,
  },
  {
    id: "round-six-use-all-cards",
    description: "Use every card to win without discarding.",
    weight: 50,
  },
] as const;

export const AI_PLAYER_FIXED_STATE_SCENARIOS: readonly AIPlayerFixedStateScenario[] =
  [
    {
      identity: {
        id: "draw-stock-safe-discard",
        split: "development",
        category: "draw-discard",
        description:
          "Ignore an irrelevant discard and shed the highest-point liability.",
      },
      rubric: drawStockSafeDiscardRubric,
      referenceActions: [
        { type: "DRAW_FROM_STOCK" },
        { type: "SKIP" },
        { type: "DISCARD", cardId: "stock-a" },
      ],
      grade: (_after, attempts) => {
        const firstAction = attempts[0]?.action;
        const discarded = actionOfType(attempts, "DISCARD")?.cardId;
        return [
          criterion(
            drawStockSafeDiscardRubric[0],
            firstAction?.type === "DRAW_FROM_STOCK",
            `first action was ${firstAction?.type ?? "missing"}`,
          ),
          criterion(
            drawStockSafeDiscardRubric[1],
            discarded === "stock-a",
            `discarded ${discarded ?? "nothing"} instead of stock-a`,
          ),
        ];
      },
      input: baseInput(1, {
        hands: [
          [
            card("p0-3", "3", "hearts"),
            card("p0-7", "7", "clubs"),
            card("p0-q", "Q", "diamonds"),
          ],
          [card("p1-4", "4", "hearts")],
          [card("p2-5", "5", "clubs")],
        ],
        stock: stockPile(card("stock-a", "A", "spades")),
        discard: [card("discard-4", "4", "hearts")],
      }),
    },
    {
      identity: {
        id: "draw-discard-completes-contract",
        split: "development",
        category: "draw-discard",
        description:
          "Take the exposed card when it completes an immediate contract.",
      },
      rubric: drawDiscardCompletesContractRubric,
      referenceActions: [
        { type: "DRAW_FROM_DISCARD" },
        {
          type: "LAY_DOWN",
          melds: [
            { type: "set", cardIds: ["p0-9c", "p0-9d", "p0-9h"] },
            { type: "set", cardIds: ["p0-kc", "p0-kd", "discard-k"] },
          ],
        },
        { type: "DISCARD", cardId: "p0-3" },
      ],
      grade: (after, attempts) => {
        const firstAction = attempts[0]?.action;
        const player = after.players.find(
          (candidate) => candidate.id === "eval-player-0",
        );
        return [
          criterion(
            drawDiscardCompletesContractRubric[0],
            firstAction?.type === "DRAW_FROM_DISCARD",
            `first action was ${firstAction?.type ?? "missing"}`,
          ),
          criterion(
            drawDiscardCompletesContractRubric[1],
            actionOfType(attempts, "LAY_DOWN") !== undefined &&
              player?.isDown === true,
            `lay down called=${actionOfType(attempts, "LAY_DOWN") !== undefined}; down=${player?.isDown ?? false}`,
          ),
        ];
      },
      input: baseInput(1, {
        hands: [
          [
            card("p0-9c", "9", "clubs"),
            card("p0-9d", "9", "diamonds"),
            card("p0-9h", "9", "hearts"),
            card("p0-kc", "K", "clubs"),
            card("p0-kd", "K", "diamonds"),
            card("p0-3", "3", "hearts"),
          ],
          [card("p1-4", "4", "hearts")],
          [card("p2-5", "5", "clubs")],
        ],
        stock: stockPile(card("stock-a", "A", "spades")),
        discard: [card("discard-k", "K", "spades")],
      }),
    },
    {
      identity: {
        id: "claim-may-i-completes-contract",
        split: "development",
        category: "may-i",
        description:
          "Claim ahead of a May I caller when the exposed card completes a contract.",
      },
      rubric: claimMayICompletesContractRubric,
      referenceActions: [{ type: "CLAIM_MAY_I" }],
      grade: (after, attempts) => {
        const claimed = actionOfType(attempts, "CLAIM_MAY_I") !== undefined;
        const player = after.players.find(
          (candidate) => candidate.id === "eval-player-0",
        );
        const receivedCard =
          player?.hand.some((candidate) => candidate.id === "discard-k") ??
          false;
        return [
          criterion(
            claimMayICompletesContractRubric[0],
            claimed && receivedCard,
            `claimed=${claimed}; received discard-k=${receivedCard}`,
          ),
        ];
      },
      input: baseInput(1, {
        hands: [
          [
            card("p0-9c", "9", "clubs"),
            card("p0-9d", "9", "diamonds"),
            card("p0-9h", "9", "hearts"),
            card("p0-kc", "K", "clubs"),
            card("p0-kd", "K", "diamonds"),
            card("p0-3", "3", "hearts"),
          ],
          [card("p1-4", "4", "hearts")],
          [card("p2-5", "5", "clubs")],
        ],
        stock: stockPile(card("stock-a", "A", "spades")),
        discard: [card("discard-k", "K", "spades")],
      }),
      prepare: (actor) =>
        actor.send({ type: "CALL_MAY_I", playerId: "eval-player-1" }),
      maxSteps: 1,
    },
    {
      identity: {
        id: "laydown-exact-contract",
        split: "development",
        category: "contract",
        description: "Lay down an immediately available two-set contract.",
      },
      rubric: laydownExactContractRubric,
      referenceActions: [
        { type: "DRAW_FROM_STOCK" },
        {
          type: "LAY_DOWN",
          melds: [
            { type: "set", cardIds: ["p0-9c", "p0-9d", "p0-9h"] },
            { type: "set", cardIds: ["p0-kc", "p0-kd", "p0-ks"] },
          ],
        },
        { type: "DISCARD", cardId: "stock-a" },
      ],
      grade: (after, attempts) => {
        const player = after.players.find(
          (candidate) => candidate.id === "eval-player-0",
        );
        return [
          criterion(
            laydownExactContractRubric[0],
            actionOfType(attempts, "LAY_DOWN") !== undefined &&
              player?.isDown === true,
            `lay down called=${actionOfType(attempts, "LAY_DOWN") !== undefined}; down=${player?.isDown ?? false}`,
          ),
          criterion(
            laydownExactContractRubric[1],
            after.table.length === 2,
            `table has ${after.table.length} melds instead of 2`,
          ),
        ];
      },
      input: baseInput(1, {
        hands: [
          [
            card("p0-9c", "9", "clubs"),
            card("p0-9d", "9", "diamonds"),
            card("p0-9h", "9", "hearts"),
            card("p0-kc", "K", "clubs"),
            card("p0-kd", "K", "diamonds"),
            card("p0-ks", "K", "spades"),
            card("p0-3", "3", "hearts"),
          ],
          [card("p1-4", "4", "hearts")],
          [card("p2-5", "5", "clubs")],
        ],
        stock: stockPile(card("stock-a", "A", "spades")),
        discard: [card("discard-6", "6", "hearts")],
      }),
    },
    {
      identity: {
        id: "multi-deck-duplicate-set-contract",
        split: "development",
        category: "contract",
        description:
          "Lay down a set containing two separate copies of the same suit and rank.",
      },
      rubric: multiDeckDuplicateSetRubric,
      referenceActions: [
        { type: "DRAW_FROM_STOCK" },
        {
          type: "LAY_DOWN",
          melds: [
            { type: "set", cardIds: ["p0-7c-a", "p0-7c-b", "p0-7d"] },
            { type: "set", cardIds: ["p0-9c", "p0-9d", "p0-9h"] },
          ],
        },
        { type: "DISCARD", cardId: "stock-a" },
      ],
      grade: (after, attempts) => {
        const duplicateSet = after.table.find((meld) =>
          ["p0-7c-a", "p0-7c-b", "p0-7d"].every((cardId) =>
            meld.cards.some((candidate) => candidate.id === cardId),
          ),
        );
        return [
          criterion(
            multiDeckDuplicateSetRubric[0],
            actionOfType(attempts, "LAY_DOWN") !== undefined &&
              duplicateSet !== undefined,
            `lay down called=${actionOfType(attempts, "LAY_DOWN") !== undefined}; duplicate set present=${duplicateSet !== undefined}`,
          ),
        ];
      },
      input: baseInput(1, {
        hands: [
          [
            card("p0-7c-a", "7", "clubs"),
            card("p0-7c-b", "7", "clubs"),
            card("p0-7d", "7", "diamonds"),
            card("p0-9c", "9", "clubs"),
            card("p0-9d", "9", "diamonds"),
            card("p0-9h", "9", "hearts"),
            card("p0-3", "3", "hearts"),
          ],
          [card("p1-4", "4", "hearts")],
          [card("p2-5", "5", "clubs")],
        ],
        stock: stockPile(card("stock-a", "A", "spades")),
        discard: [card("discard-6", "6", "hearts")],
      }),
    },
    {
      identity: {
        id: "may-i-response",
        split: "development",
        category: "may-i",
        description:
          "Allow an opponent's May I claim when the exposed card is not useful.",
      },
      rubric: mayIResponseRubric,
      referenceActions: [{ type: "ALLOW_MAY_I" }],
      grade: (_after, attempts) => {
        const response = attempts.find(
          (attempt) =>
            attempt.action.type === "ALLOW_MAY_I" ||
            attempt.action.type === "CLAIM_MAY_I",
        )?.action.type;
        return [
          criterion(
            mayIResponseRubric[0],
            response === "ALLOW_MAY_I",
            `May I response was ${response ?? "missing"}`,
          ),
        ];
      },
      input: baseInput(1, {
        hands: [
          [card("p0-3", "3", "hearts")],
          [card("p1-4", "4", "hearts")],
          [card("p2-5", "5", "clubs")],
        ],
        stock: stockPile(card("stock-a", "A", "spades")),
        discard: [card("discard-q", "Q", "diamonds")],
      }),
      prepare: (actor) =>
        actor.send({ type: "CALL_MAY_I", playerId: "eval-player-1" }),
      maxSteps: 1,
    },
    {
      identity: {
        id: "wild-ratio-valid-contract",
        split: "development",
        category: "wild-cards",
        description:
          "Lay two legal sets whose wild-to-natural ratios are balanced.",
      },
      rubric: wildRatioValidRubric,
      referenceActions: [
        { type: "DRAW_FROM_STOCK" },
        {
          type: "LAY_DOWN",
          melds: [
            { type: "set", cardIds: ["p0-7c", "p0-7d", "p0-wild-2"] },
            { type: "set", cardIds: ["p0-qc", "p0-qd", "p0-wild-joker"] },
          ],
        },
        { type: "DISCARD", cardId: "stock-a" },
      ],
      grade: (after, attempts) => {
        const player = after.players.find(
          (candidate) => candidate.id === "eval-player-0",
        );
        const tableCardIds = new Set(
          after.table.flatMap((meld) =>
            meld.cards.map((candidate) => candidate.id),
          ),
        );
        const usedBothWilds =
          tableCardIds.has("p0-wild-2") && tableCardIds.has("p0-wild-joker");
        return [
          criterion(
            wildRatioValidRubric[0],
            actionOfType(attempts, "LAY_DOWN") !== undefined &&
              player?.isDown === true &&
              usedBothWilds,
            `down=${player?.isDown ?? false}; both wilds used=${usedBothWilds}`,
          ),
        ];
      },
      input: baseInput(1, {
        hands: [
          [
            card("p0-7c", "7", "clubs"),
            card("p0-7d", "7", "diamonds"),
            card("p0-wild-2", "2", "spades"),
            card("p0-qc", "Q", "clubs"),
            card("p0-qd", "Q", "diamonds"),
            joker("p0-wild-joker"),
            card("p0-3", "3", "hearts"),
          ],
          [card("p1-4", "4", "hearts")],
          [card("p2-5", "5", "clubs")],
        ],
        stock: stockPile(card("stock-a", "A", "spades")),
        discard: [card("discard-6", "6", "hearts")],
      }),
    },
    {
      identity: {
        id: "wild-ratio-negative-control",
        split: "holdout",
        category: "negative-control",
        description:
          "Reject an apparent set containing one natural and two wild cards.",
      },
      rubric: wildRatioNegativeRubric,
      referenceActions: [
        { type: "DRAW_FROM_STOCK" },
        { type: "SKIP" },
        { type: "DISCARD", cardId: "stock-a" },
      ],
      grade: (after, attempts) => {
        const triedLayDown = actionOfType(attempts, "LAY_DOWN") !== undefined;
        const turnAdvanced = after.awaitingPlayerId !== "eval-player-0";
        return [
          criterion(
            wildRatioNegativeRubric[0],
            !triedLayDown && turnAdvanced,
            `lay down attempted=${triedLayDown}; turn advanced=${turnAdvanced}`,
          ),
        ];
      },
      input: baseInput(1, {
        hands: [
          [
            card("p0-7c", "7", "clubs"),
            card("p0-wild-2", "2", "spades"),
            joker("p0-wild-joker"),
            card("p0-qc", "Q", "clubs"),
            card("p0-qd", "Q", "diamonds"),
            card("p0-qh", "Q", "hearts"),
            card("p0-3", "3", "hearts"),
          ],
          [card("p1-4", "4", "hearts")],
          [card("p2-5", "5", "clubs")],
        ],
        stock: stockPile(card("stock-a", "A", "diamonds")),
        discard: [card("discard-6", "6", "hearts")],
      }),
    },
    {
      identity: {
        id: "ace-high-run-contract",
        split: "holdout",
        category: "contract",
        description:
          "Use a newly drawn Ace to complete a high-Ace run and lay down.",
      },
      rubric: aceHighRunRubric,
      referenceActions: [
        { type: "DRAW_FROM_STOCK" },
        {
          type: "LAY_DOWN",
          melds: [
            { type: "set", cardIds: ["p0-8c", "p0-8d", "p0-8s"] },
            {
              type: "run",
              cardIds: ["p0-hj", "p0-hq", "p0-hk", "p0-ha"],
            },
          ],
        },
        { type: "DISCARD", cardId: "stock-6" },
      ],
      grade: (after, attempts) => {
        const aceRun = after.table.find((meld) =>
          ["p0-hj", "p0-hq", "p0-hk", "p0-ha"].every((cardId) =>
            meld.cards.some((candidate) => candidate.id === cardId),
          ),
        );
        return [
          criterion(
            aceHighRunRubric[0],
            actionOfType(attempts, "LAY_DOWN") !== undefined &&
              aceRun !== undefined,
            `lay down called=${actionOfType(attempts, "LAY_DOWN") !== undefined}; ace run present=${aceRun !== undefined}`,
          ),
        ];
      },
      input: baseInput(2, {
        hands: [
          [
            card("p0-8c", "8", "clubs"),
            card("p0-8d", "8", "diamonds"),
            card("p0-8s", "8", "spades"),
            card("p0-hj", "J", "hearts"),
            card("p0-hq", "Q", "hearts"),
            card("p0-hk", "K", "hearts"),
            card("p0-ha", "A", "hearts"),
            card("p0-3", "3", "clubs"),
          ],
          [card("p1-4", "4", "hearts")],
          [card("p2-5", "5", "clubs")],
        ],
        stock: stockPile(card("stock-6", "6", "clubs")),
        discard: [card("discard-6", "6", "diamonds")],
      }),
    },
    {
      identity: {
        id: "ace-low-negative-control",
        split: "development",
        category: "negative-control",
        description:
          "Reject an apparent run that incorrectly places Ace below 3.",
      },
      rubric: aceLowNegativeRubric,
      referenceActions: [
        { type: "DRAW_FROM_STOCK" },
        { type: "SKIP" },
        { type: "DISCARD", cardId: "stock-6" },
      ],
      grade: (after, attempts) => {
        const triedLayDown = actionOfType(attempts, "LAY_DOWN") !== undefined;
        const turnAdvanced = after.awaitingPlayerId !== "eval-player-0";
        return [
          criterion(
            aceLowNegativeRubric[0],
            !triedLayDown && turnAdvanced,
            `lay down attempted=${triedLayDown}; turn advanced=${turnAdvanced}`,
          ),
        ];
      },
      input: baseInput(2, {
        hands: [
          [
            card("p0-8c", "8", "clubs"),
            card("p0-8d", "8", "diamonds"),
            card("p0-8s", "8", "spades"),
            card("p0-ha", "A", "hearts"),
            card("p0-h3", "3", "hearts"),
            card("p0-h4", "4", "hearts"),
            card("p0-h5", "5", "hearts"),
            card("p0-q", "Q", "clubs"),
          ],
          [card("p1-4", "4", "diamonds")],
          [card("p2-5", "5", "clubs")],
        ],
        stock: stockPile(card("stock-6", "6", "clubs")),
        discard: [card("discard-9", "9", "diamonds")],
      }),
    },
    {
      identity: {
        id: "same-suit-gap-negative-control",
        split: "holdout",
        category: "negative-control",
        description:
          "Reject an apparent two-run contract whose same-suit gap is only one card.",
      },
      rubric: sameSuitGapNegativeRubric,
      referenceActions: [
        { type: "DRAW_FROM_STOCK" },
        { type: "SKIP" },
        { type: "DISCARD", cardId: "stock-a" },
      ],
      grade: (after, attempts) => {
        const triedLayDown = actionOfType(attempts, "LAY_DOWN") !== undefined;
        const turnAdvanced = after.awaitingPlayerId !== "eval-player-0";
        return [
          criterion(
            sameSuitGapNegativeRubric[0],
            !triedLayDown && turnAdvanced,
            `lay down attempted=${triedLayDown}; turn advanced=${turnAdvanced}`,
          ),
        ];
      },
      input: baseInput(3, {
        hands: [
          [
            card("p0-s3", "3", "spades"),
            card("p0-s4", "4", "spades"),
            card("p0-s5", "5", "spades"),
            card("p0-s6", "6", "spades"),
            card("p0-s8", "8", "spades"),
            card("p0-s9", "9", "spades"),
            card("p0-s10", "10", "spades"),
            card("p0-sj", "J", "spades"),
            card("p0-hq", "Q", "hearts"),
          ],
          [card("p1-4", "4", "hearts")],
          [card("p2-5", "5", "clubs")],
        ],
        stock: stockPile(card("stock-a", "A", "diamonds")),
        discard: [card("discard-7c", "7", "clubs")],
      }),
    },
    {
      identity: {
        id: "same-suit-gap-exact-two-contract",
        split: "development",
        category: "contract",
        description:
          "Accept two same-suit runs separated by exactly two natural ranks.",
      },
      rubric: sameSuitGapPositiveRubric,
      referenceActions: [
        { type: "DRAW_FROM_STOCK" },
        {
          type: "LAY_DOWN",
          melds: [
            { type: "run", cardIds: ["p0-s3", "p0-s4", "p0-s5", "p0-s6"] },
            { type: "run", cardIds: ["p0-s9", "p0-s10", "p0-sj", "p0-sq"] },
          ],
        },
        { type: "DISCARD", cardId: "stock-a" },
      ],
      grade: (after, attempts) => {
        const player = after.players.find(
          (candidate) => candidate.id === "eval-player-0",
        );
        return [
          criterion(
            sameSuitGapPositiveRubric[0],
            actionOfType(attempts, "LAY_DOWN") !== undefined &&
              player?.isDown === true &&
              after.table.length === 2,
            `down=${player?.isDown ?? false}; table melds=${after.table.length}`,
          ),
        ];
      },
      input: baseInput(3, {
        hands: [
          [
            card("p0-s3", "3", "spades"),
            card("p0-s4", "4", "spades"),
            card("p0-s5", "5", "spades"),
            card("p0-s6", "6", "spades"),
            card("p0-s9", "9", "spades"),
            card("p0-s10", "10", "spades"),
            card("p0-sj", "J", "spades"),
            card("p0-sq", "Q", "spades"),
            card("p0-3", "3", "hearts"),
          ],
          [card("p1-4", "4", "hearts")],
          [card("p2-5", "5", "clubs")],
        ],
        stock: stockPile(card("stock-a", "A", "diamonds")),
        discard: [card("discard-7c", "7", "clubs")],
      }),
    },
    {
      identity: {
        id: "layoff",
        split: "development",
        category: "layoff",
        description: "Play a legal card onto a public run before discarding.",
      },
      rubric: layoffRubric,
      referenceActions: [
        { type: "DRAW_FROM_STOCK" },
        { type: "LAY_OFF", cardId: "p0-9", meldId: "meld-run" },
        { type: "DISCARD", cardId: "stock-a" },
      ],
      grade: (after, attempts) => {
        const laidOff = actionOfType(attempts, "LAY_OFF")?.cardId;
        const tableContainsCard =
          after.table[0]?.cards.some((candidate) => candidate.id === "p0-9") ??
          false;
        return [
          criterion(
            layoffRubric[0],
            laidOff === "p0-9" && tableContainsCard,
            `laid off ${laidOff ?? "nothing"}; table contains p0-9=${tableContainsCard}`,
          ),
        ];
      },
      input: baseInput(2, {
        hands: [
          [card("p0-9", "9", "clubs"), card("p0-5", "5", "spades")],
          [card("p1-4", "4", "hearts")],
          [card("p2-6", "6", "clubs")],
        ],
        stock: stockPile(card("stock-a", "A", "spades")),
        discard: [card("discard-7", "7", "diamonds")],
        table: [
          {
            id: "meld-run",
            ownerId: "eval-player-1",
            type: "run",
            cards: [
              card("table-5", "5", "clubs"),
              card("table-6", "6", "clubs"),
              card("table-7", "7", "clubs"),
              card("table-8", "8", "clubs"),
            ],
          },
        ],
        playerDownStatus: [true, false, false],
      }),
    },
    {
      identity: {
        id: "joker-swap",
        split: "development",
        category: "joker",
        description:
          "Recover a Joker from a run and use it to complete the contract.",
      },
      rubric: jokerSwapRubric,
      referenceActions: [
        { type: "DRAW_FROM_STOCK" },
        {
          type: "SWAP_JOKER",
          jokerCardId: "table-joker",
          meldId: "meld-joker-run",
          swapCardId: "p0-6h",
        },
        {
          type: "LAY_DOWN",
          melds: [
            { type: "set", cardIds: ["p0-9c", "p0-9d", "table-joker"] },
            { type: "set", cardIds: ["p0-kc", "p0-kd", "p0-kh"] },
          ],
        },
        { type: "DISCARD", cardId: "stock-a" },
      ],
      grade: (after, attempts) => {
        const player = after.players.find(
          (candidate) => candidate.id === "eval-player-0",
        );
        const swap = actionOfType(attempts, "SWAP_JOKER");
        const naturalOnTable =
          after.table[0]?.cards.some((candidate) => candidate.id === "p0-6h") ??
          false;
        return [
          criterion(
            jokerSwapRubric[0],
            swap?.swapCardId === "p0-6h" && naturalOnTable,
            `swap card was ${swap?.swapCardId ?? "missing"}; natural on table=${naturalOnTable}`,
          ),
          criterion(
            jokerSwapRubric[1],
            player?.isDown === true,
            `evaluated player down=${player?.isDown ?? false}`,
          ),
        ];
      },
      input: baseInput(1, {
        hands: [
          [
            card("p0-9c", "9", "clubs"),
            card("p0-9d", "9", "diamonds"),
            card("p0-kc", "K", "clubs"),
            card("p0-kd", "K", "diamonds"),
            card("p0-kh", "K", "hearts"),
            card("p0-6h", "6", "hearts"),
          ],
          [card("p1-4", "4", "diamonds")],
          [card("p2-5", "5", "clubs")],
        ],
        stock: stockPile(card("stock-a", "A", "spades")),
        discard: [card("discard-7", "7", "diamonds")],
        table: [
          {
            id: "meld-joker-run",
            ownerId: "eval-player-1",
            type: "run",
            cards: [
              card("table-3h", "3", "hearts"),
              card("table-4h", "4", "hearts"),
              card("table-5h", "5", "hearts"),
              joker("table-joker"),
              card("table-7h", "7", "hearts"),
            ],
          },
        ],
      }),
    },
    {
      identity: {
        id: "opponent-feed-avoidance",
        split: "holdout",
        category: "opponent-tracking",
        description: "Avoid feeding a rank an opponent publicly collected.",
      },
      rubric: opponentFeedRubric,
      referenceActions: [
        { type: "DRAW_FROM_STOCK" },
        { type: "SKIP" },
        { type: "DISCARD", cardId: "p0-q" },
      ],
      grade: (_after, attempts) => {
        const discarded = actionOfType(attempts, "DISCARD")?.cardId;
        return [
          criterion(
            opponentFeedRubric[0],
            discarded !== undefined && discarded !== "p0-7",
            `discarded ${discarded ?? "nothing"}`,
          ),
        ];
      },
      input: baseInput(1, {
        hands: [
          [card("p0-7", "7", "hearts"), card("p0-q", "Q", "diamonds")],
          [card("p1-4", "4", "hearts")],
          [card("p2-5", "5", "clubs")],
        ],
        stock: stockPile(card("stock-6", "6", "spades")),
        discard: [card("discard-3", "3", "clubs")],
      }),
      actionLog: [
        {
          roundNumber: 1,
          playerId: "eval-player-1",
          playerName: "Opponent 1",
          action: "picked up",
          details: "7♣ from the discard pile",
        },
      ],
    },
    {
      identity: {
        id: "endgame-point-dump",
        split: "development",
        category: "endgame",
        description:
          "Shed a high-point Joker when an opponent can go out imminently.",
      },
      rubric: endgamePointDumpRubric,
      referenceActions: [
        { type: "DRAW_FROM_STOCK" },
        { type: "SKIP" },
        { type: "DISCARD", cardId: "p0-joker" },
      ],
      grade: (_after, attempts) => {
        const discarded = actionOfType(attempts, "DISCARD")?.cardId;
        return [
          criterion(
            endgamePointDumpRubric[0],
            discarded === "p0-joker",
            `discarded ${discarded ?? "nothing"} instead of p0-joker`,
          ),
        ];
      },
      input: baseInput(1, {
        hands: [
          [
            joker("p0-joker"),
            card("p0-3", "3", "hearts"),
            card("p0-4", "4", "clubs"),
          ],
          [card("p1-last", "9", "hearts")],
          [card("p2-5", "5", "clubs")],
        ],
        stock: stockPile(card("stock-6", "6", "spades")),
        discard: [card("discard-8", "8", "diamonds")],
        playerDownStatus: [false, true, false],
      }),
    },
    {
      identity: {
        id: "layoff-all-to-go-out",
        split: "development",
        category: "endgame",
        description:
          "Lay off all remaining cards to end the hand without a discard.",
      },
      rubric: layoffAllToGoOutRubric,
      referenceActions: [
        { type: "DRAW_FROM_STOCK" },
        { type: "LAY_OFF", cardId: "p0-9s", meldId: "meld-nines" },
        { type: "LAY_OFF", cardId: "p0-kh", meldId: "meld-kings" },
        { type: "LAY_OFF", cardId: "stock-ks", meldId: "meld-kings" },
      ],
      grade: (after, attempts) => {
        const player = after.players.find(
          (candidate) => candidate.id === "eval-player-0",
        );
        const laidOffCardIds = attempts
          .filter((attempt) => attempt.action.type === "LAY_OFF")
          .map((attempt) =>
            attempt.action.type === "LAY_OFF" ? attempt.action.cardId : "",
          );
        const laidOffAll = ["p0-9s", "p0-kh", "stock-ks"].every((cardId) =>
          laidOffCardIds.includes(cardId),
        );
        return [
          criterion(
            layoffAllToGoOutRubric[0],
            laidOffAll &&
              player?.hand.length === 0 &&
              after.phase === "ROUND_END",
            `laid off all=${laidOffAll}; hand size=${player?.hand.length ?? "missing"}; phase=${after.phase}`,
          ),
        ];
      },
      input: baseInput(2, {
        hands: [
          [card("p0-9s", "9", "spades"), card("p0-kh", "K", "hearts")],
          [card("p1-4", "4", "hearts")],
          [card("p2-5", "5", "clubs")],
        ],
        stock: stockPile(card("stock-ks", "K", "spades")),
        discard: [card("discard-7", "7", "diamonds")],
        table: [
          {
            id: "meld-nines",
            ownerId: "eval-player-1",
            type: "set",
            cards: [
              card("table-9c", "9", "clubs"),
              card("table-9d", "9", "diamonds"),
              card("table-9h", "9", "hearts"),
            ],
          },
          {
            id: "meld-kings",
            ownerId: "eval-player-2",
            type: "set",
            cards: [
              card("table-kc", "K", "clubs"),
              card("table-kd", "K", "diamonds"),
              card("table-kh", "K", "hearts"),
            ],
          },
        ],
        playerDownStatus: [true, true, true],
      }),
    },
    {
      identity: {
        id: "down-player-stock-only",
        split: "development",
        category: "draw-discard",
        description:
          "Draw from stock even when the discard would be useful because the player is down.",
      },
      rubric: downPlayerStockOnlyRubric,
      referenceActions: [
        { type: "DRAW_FROM_STOCK" },
        { type: "DISCARD", cardId: "stock-q" },
      ],
      grade: (_after, attempts) => {
        const firstAction = attempts[0]?.action;
        return [
          criterion(
            downPlayerStockOnlyRubric[0],
            firstAction?.type === "DRAW_FROM_STOCK",
            `first action was ${firstAction?.type ?? "missing"}`,
          ),
        ];
      },
      input: baseInput(2, {
        hands: [
          [card("p0-5", "5", "spades")],
          [card("p1-4", "4", "hearts")],
          [card("p2-6", "6", "clubs")],
        ],
        stock: stockPile(card("stock-q", "Q", "diamonds")),
        discard: [card("discard-9", "9", "clubs")],
        table: [
          {
            id: "meld-nines",
            ownerId: "eval-player-1",
            type: "set",
            cards: [
              card("table-9c", "9", "clubs"),
              card("table-9d", "9", "diamonds"),
              card("table-9h", "9", "hearts"),
            ],
          },
        ],
        playerDownStatus: [true, true, false],
      }),
    },
    {
      identity: {
        id: "round6-decline-may-i",
        split: "holdout",
        category: "may-i",
        description:
          "Decline an irrelevant Hand 6 May I that would add two cards to the final contract.",
      },
      rubric: roundSixDeclineMayIRubric,
      referenceActions: [{ type: "ALLOW_MAY_I" }],
      grade: (_after, attempts) => {
        const response = attempts.find(
          (attempt) =>
            attempt.action.type === "ALLOW_MAY_I" ||
            attempt.action.type === "CLAIM_MAY_I",
        )?.action.type;
        return [
          criterion(
            roundSixDeclineMayIRubric[0],
            response === "ALLOW_MAY_I",
            `May I response was ${response ?? "missing"}`,
          ),
        ];
      },
      input: baseInput(6, {
        hands: [
          [
            card("p0-7c", "7", "clubs"),
            card("p0-7d", "7", "diamonds"),
            card("p0-7h", "7", "hearts"),
            card("p0-h3", "3", "hearts"),
            card("p0-h4", "4", "hearts"),
            card("p0-h5", "5", "hearts"),
            card("p0-s9", "9", "spades"),
            card("p0-s10", "10", "spades"),
            card("p0-sj", "J", "spades"),
          ],
          [card("p1-4", "4", "diamonds")],
          [card("p2-5", "5", "clubs")],
        ],
        stock: stockPile(card("stock-a", "A", "diamonds")),
        discard: [card("discard-q", "Q", "clubs")],
      }),
      prepare: (actor) =>
        actor.send({ type: "CALL_MAY_I", playerId: "eval-player-1" }),
      maxSteps: 1,
    },
    {
      identity: {
        id: "round6-all-cards",
        split: "holdout",
        category: "round-six",
        description:
          "Use every card in Hand 6 to lay down and win immediately.",
      },
      rubric: roundSixAllCardsRubric,
      referenceActions: [
        { type: "DRAW_FROM_STOCK" },
        {
          type: "LAY_DOWN",
          melds: [
            { type: "set", cardIds: ["set-kc", "set-kd", "set-kh", "set-ks"] },
            { type: "run", cardIds: ["run-h3", "run-h4", "run-h5", "run-h6"] },
            { type: "run", cardIds: ["run-s9", "run-s10", "run-sj", "run-sq"] },
          ],
        },
      ],
      grade: (after, attempts) => {
        const player = after.players.find(
          (candidate) => candidate.id === "eval-player-0",
        );
        return [
          criterion(
            roundSixAllCardsRubric[0],
            actionOfType(attempts, "LAY_DOWN") !== undefined,
            `lay down called=${actionOfType(attempts, "LAY_DOWN") !== undefined}`,
          ),
          criterion(
            roundSixAllCardsRubric[1],
            player?.hand.length === 0 && after.phase === "ROUND_END",
            `hand size=${player?.hand.length ?? "missing"}; phase=${after.phase}`,
          ),
        ];
      },
      input: baseInput(6, {
        hands: [
          [
            card("set-kc", "K", "clubs"),
            card("set-kd", "K", "diamonds"),
            card("set-kh", "K", "hearts"),
            card("run-h3", "3", "hearts"),
            card("run-h4", "4", "hearts"),
            card("run-h5", "5", "hearts"),
            card("run-h6", "6", "hearts"),
            card("run-s9", "9", "spades"),
            card("run-s10", "10", "spades"),
            card("run-sj", "J", "spades"),
            card("run-sq", "Q", "spades"),
          ],
          [card("p1-4", "4", "diamonds")],
          [card("p2-5", "5", "clubs")],
        ],
        stock: stockPile(card("set-ks", "K", "spades")),
        discard: [card("discard-7", "7", "diamonds")],
      }),
    },
  ];

export function getAIPlayerFixedStateScenario(
  scenarioId: string,
): AIPlayerFixedStateScenario {
  const scenario = AI_PLAYER_FIXED_STATE_SCENARIOS.find(
    (candidate) => candidate.identity.id === scenarioId,
  );
  if (!scenario) {
    throw new Error(`Unknown AI player evaluation scenario: ${scenarioId}`);
  }
  return scenario;
}
