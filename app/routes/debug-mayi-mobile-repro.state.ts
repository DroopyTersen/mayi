import type { Card } from "core/card/card.types";
import type {
  ActionAvailabilityState,
  ActionId,
  AvailableActions,
} from "core/engine/game-engine.availability";
import type { PlayerView } from "core/engine/game-engine.types";
import type { Meld } from "core/meld/meld.types";

export type MayIMobileReproSurface = "drawer" | "dialog" | "stacked";
export type MayIMobileReproOutcome = "prompt" | "allowed" | "claimed";

const ACTION_LABELS: Record<ActionId, string> = {
  drawStock: "Draw Card",
  pickUpDiscard: "Pick Up Discard",
  layDown: "Lay Down",
  layOff: "Lay Off",
  swapJoker: "Swap Joker",
  discard: "Discard",
  mayI: "May I?",
  allowMayI: "Allow",
  claimMayI: "Claim",
  reorderHand: "Organize",
};

const ACTION_ORDER: ActionId[] = [
  "drawStock",
  "pickUpDiscard",
  "layDown",
  "layOff",
  "swapJoker",
  "discard",
  "mayI",
  "allowMayI",
  "claimMayI",
  "reorderHand",
];

const baseAvailableActions: AvailableActions = {
  canDrawFromStock: false,
  canDrawFromDiscard: false,
  canLayDown: false,
  canLayOff: false,
  canSwapJoker: false,
  canDiscard: false,
  canMayI: false,
  canAllowMayI: false,
  canClaimMayI: false,
  canReorderHand: false,
  hasPendingMayIRequest: false,
  shouldNudgeDiscard: false,
};

const claimedDiscard = card("discard-4-D", "4", "diamonds");
const nextDiscard = card("discard-K-H", "K", "hearts");

function card(id: string, rank: Card["rank"], suit: Card["suit"]): Card {
  return { id, rank, suit };
}

function createActionStates(
  availableIds: ReadonlySet<ActionId>
): ActionAvailabilityState[] {
  return ACTION_ORDER.map((id) => ({
    id,
    label: ACTION_LABELS[id],
    status: availableIds.has(id) ? "available" : "hidden",
  }));
}

function createAvailableActions(
  overrides: Partial<AvailableActions>
): AvailableActions {
  return {
    ...baseAvailableActions,
    ...overrides,
  };
}

function createRobinHand(outcome: MayIMobileReproOutcome): Card[] {
  const hand = [
    card("robin-6-D", "6", "diamonds"),
    card("robin-6-C", "6", "clubs"),
    card("robin-10-H", "10", "hearts"),
    card("robin-10-C-1", "10", "clubs"),
    card("robin-10-C-2", "10", "clubs"),
    card("robin-A-H", "A", "hearts"),
    card("robin-A-S", "A", "spades"),
    card("robin-A-C-1", "A", "clubs"),
    card("robin-A-C-2", "A", "clubs"),
    card("robin-9-C", "9", "clubs"),
    card("robin-8-S", "8", "spades"),
    card("robin-7-S", "7", "spades"),
    card("robin-3-D", "3", "diamonds"),
  ];

  return outcome === "claimed" ? [...hand, claimedDiscard] : hand;
}

function createKateTable(): Meld[] {
  return [
    {
      id: "kate-set-kings",
      type: "set",
      ownerId: "player-1",
      cards: [
        card("kate-table-K-C", "K", "clubs"),
        card("kate-table-K-H", "K", "hearts"),
        card("kate-table-K-C-2", "K", "clubs"),
      ],
    },
    {
      id: "kate-set-tens",
      type: "set",
      ownerId: "player-1",
      cards: [
        card("kate-table-2-S", "2", "spades"),
        card("kate-table-10-S", "10", "spades"),
        card("kate-table-10-D", "10", "diamonds"),
      ],
    },
    {
      id: "kate-set-eights",
      type: "set",
      ownerId: "player-1",
      cards: [
        card("kate-table-8-C-1", "8", "clubs"),
        card("kate-table-8-C-2", "8", "clubs"),
        card("kate-table-8-D", "8", "diamonds"),
      ],
    },
  ];
}

function createPromptState() {
  const availableActions = createAvailableActions({
    canAllowMayI: true,
    canClaimMayI: true,
  });

  return {
    phase: "RESOLVING_MAY_I" as const,
    turnPhase: "AWAITING_DRAW" as const,
    topDiscard: claimedDiscard,
    discardCount: 2,
    stockCount: 3,
    availableActions,
    actionStates: createActionStates(new Set(["allowMayI", "claimMayI"])),
    mayIContext: {
      originalCaller: "player-0",
      cardBeingClaimed: claimedDiscard,
      playersToCheck: ["player-2"],
      currentPromptIndex: 0,
      playerBeingPrompted: "player-2",
      playersWhoAllowed: [],
      winner: null,
      outcome: null,
    },
  };
}

function createAllowedState() {
  const availableActions = createAvailableActions({
    canDrawFromStock: true,
  });

  return {
    phase: "ROUND_ACTIVE" as const,
    turnPhase: "AWAITING_DRAW" as const,
    topDiscard: nextDiscard,
    discardCount: 1,
    stockCount: 2,
    availableActions,
    actionStates: createActionStates(new Set(["drawStock"])),
    mayIContext: null,
  };
}

function createClaimedState() {
  const availableActions = createAvailableActions({
    canLayDown: true,
    canDiscard: true,
  });

  return {
    phase: "ROUND_ACTIVE" as const,
    turnPhase: "AWAITING_ACTION" as const,
    topDiscard: nextDiscard,
    discardCount: 1,
    stockCount: 3,
    availableActions,
    actionStates: createActionStates(new Set(["layDown", "discard"])),
    mayIContext: null,
  };
}

export function parseMayIMobileReproSurface(
  value: string | null
): MayIMobileReproSurface {
  return value === "dialog" || value === "stacked" ? value : "drawer";
}

export function createMayIMobileReproPlayerView(
  outcome: MayIMobileReproOutcome
): PlayerView {
  const state =
    outcome === "allowed"
      ? createAllowedState()
      : outcome === "claimed"
        ? createClaimedState()
        : createPromptState();

  return {
    gameId: "mayi-mobile-repro",
    viewingPlayerId: "player-2",
    yourName: "Robin",
    yourAvatarId: "robin",
    yourHand: createRobinHand(outcome),
    isYourTurn: true,
    youAreDown: false,
    yourTotalScore: 31,
    opponents: [
      {
        id: "player-0",
        name: "Curt",
        avatarId: "curt",
        handCount: outcome === "allowed" ? 13 : 11,
        isDown: false,
        totalScore: 34,
        isDealer: false,
        isCurrentPlayer: false,
      },
      {
        id: "player-1",
        name: "Kate",
        avatarId: "kate",
        handCount: 2,
        isDown: true,
        totalScore: 14,
        isDealer: true,
        isCurrentPlayer: false,
      },
    ],
    currentRound: 4,
    contract: { roundNumber: 4, sets: 3, runs: 0 },
    phase: state.phase,
    turnPhase: state.turnPhase,
    turnNumber: 1,
    awaitingPlayerId: "player-2",
    stockCount: state.stockCount,
    topDiscard: state.topDiscard,
    discardCount: state.discardCount,
    table: createKateTable(),
    roundHistory: [],
    mayIContext: state.mayIContext,
    availableActions: state.availableActions,
    actionStates: state.actionStates,
    unavailabilityHints: [],
    turnOrder: ["player-0", "player-1", "player-2"],
  };
}
