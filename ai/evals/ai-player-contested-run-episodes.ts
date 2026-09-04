import type { Card } from "../../core/card/card.types";
import { findLayDownCandidates } from "../mayIAgent.contract-candidates";
import { AI_PLAYER_CONTESTED_RUN_SCENARIOS } from "./ai-player-contested-run-scenarios";
import { evaluateHand5DiscardCoverage } from "./ai-player-hand5-draw-coverage";
import type { AIPlayerRolloutActionEvidence } from "./ai-player-rollout-decision-evidence";
import {
  criterion,
  type AIPlayerShortRolloutReferenceDecision,
  type AIPlayerShortRolloutScenario,
} from "./ai-player-short-rollout-scenario";

const rubric = [
  {
    id: "choose-contract-draw-coverage",
    description: "By the second own turn, lay an available exact contract or retain a live route with maximal positive conditional next-stock-draw coverage from the actual public-information hand. No surviving route is a trajectory failure, not necessarily a second-discard error.",
    weight: 50,
  },
  {
    id: "convert-next-turn-contract",
    description: "Lay an exact Hand 5 contract by the third own turn under the declared sampled continuation. Outcome, not proof of a third-turn decision error.",
    weight: 50,
  },
] as const;

function hasExactContract(hand: readonly Card[], playerId: string): boolean {
  return findLayDownCandidates({
    hand: [...hand],
    contract: { roundNumber: 5, sets: 2, runs: 1 },
    playerId,
    limit: Number.MAX_SAFE_INTEGER,
  }).some(candidate => candidate.positionGroups.every((group, index) => group.length === (index < 2 ? 3 : 4)));
}

function exactLaydown(evidence: AIPlayerRolloutActionEvidence): boolean {
  if (!evidence.ok || evidence.action.type !== "LAY_DOWN") return false;
  const melds = evidence.action.melds;
  return melds.length === 3 &&
    melds.filter(meld => meld.type === "set" && meld.cardIds.length === 3).length === 2 &&
    melds.filter(meld => meld.type === "run" && meld.cardIds.length === 4).length === 1;
}

/** The second policy sees its own hand AFTER drawing, never a future stock card. */
function drawAndReturn(playerId: string): AIPlayerShortRolloutReferenceDecision[] {
  return [
    { playerId, kind: "opponent-script", actions: [{ type: "DRAW_FROM_STOCK" }] },
    {
      playerId,
      kind: "opponent-script",
      actions: [],
      opponentPolicy: {
        id: "return-actual-stock-draw-v1",
        selectActions: ({ hand }) => {
          // Engine stock draws append to the hand. No sorting occurs between
          // these two steps; the publicly known earlier pickups stay held.
          const drawn = hand.at(-1);
          if (!drawn) throw new Error("Missing opponent stock draw");
          return [{ type: "SKIP" }, { type: "DISCARD", cardId: drawn.id }];
        },
      },
    },
  ];
}

function extendDevelopmentEpisode(source: typeof AI_PLAYER_CONTESTED_RUN_SCENARIOS[number]): AIPlayerShortRolloutScenario {
  if (source.identity.split !== "development") return source;
  const prelude = source.historyPrelude;
  const root = source.referenceSequence[0];
  const conversion = source.referenceSequence.at(-1);
  if (!prelude || prelude.length !== 25 || !root || !conversion ||
      root.kind !== "candidate-turn" || conversion.kind !== "candidate-turn" ||
      prelude.slice(15, 18).some(step => step.playerId !== source.evaluatedPlayerId) ||
      prelude[24]?.action.type !== "DRAW_FROM_STOCK")
    throw new Error(`Unrecognized contested-run provenance: ${source.identity.id}`);
  const knownPickups = source.diagnostics.publiclyKnownOutsideHand.filter(card => card.id.startsWith("known-pickup-"));
  if (knownPickups.length !== 2) throw new Error("Missing public pickup provenance");
  const opponents = () => [...drawAndReturn("eval-player-1"), ...drawAndReturn("eval-player-2")];
  return {
    ...source,
    identity: { ...source.identity, description: "Three own turns: preserve options, reassess competing runs with public pickups, and convert the actual continuation." },
    objective: "Preserve a live positive-coverage route or lay an exact contract by the second own turn; separately measure actual discard regret and sampled third-turn conversion after a freely chosen earlier turn. Full public activity remains available. This is not a memory-necessity test, global discard-safety oracle, or full-game expected-score estimate.",
    maxCandidateTurns: 3,
    maxModelDecisions: 3,
    historyPrelude: prelude.slice(0, 15),
    rubric,
    referenceSequence: [
      { playerId: source.evaluatedPlayerId, kind: "candidate-turn", actions: prelude.slice(15, 18).map(step => step.action) },
      ...opponents(),
      { ...root, actions: [{ type: "DRAW_FROM_STOCK" }, ...root.actions] },
      ...opponents(),
      conversion,
    ],
    grade: observation => {
      const turns = observation.decisions.filter(decision => decision.playerId === source.evaluatedPlayerId && decision.kind === "candidate-turn");
      const throughSecond = turns.slice(0, 2).flatMap(turn => turn.actionEvidence ?? []);
      const all = turns.slice(0, 3).flatMap(turn => turn.actionEvidence ?? []);
      const completedEarly = throughSecond.some(exactLaydown);
      let coveragePassed = completedEarly;
      let coverageMeasurements: Record<string, number | boolean> = { exactContractLaidBySecond: completedEarly };
      let coverageEvidence = completedEarly ? "Exact contract already laid by the second own turn." : "Missing eligible second-turn discard evidence.";
      const discarded = turns[1]?.actionEvidence?.find(item => item.ok && item.action.type === "DISCARD");
      if (!completedEarly && discarded?.action.type === "DISCARD" && !discarded.before.isDown && discarded.before.hand.length === 12) {
        const view = discarded.before;
        const discardCardId = discarded.action.cardId;
        // The declared opponent policy never claims, recycles, or disposes of
        // these two replay-proven pickups. Everything else exposed is on the
        // current table/discard. No hidden opponent/stock zone is consulted.
        const ownIds = new Set(view.hand.map(card => card.id));
        const publicCards = [...knownPickups, ...view.discard, ...view.table.flatMap(meld => meld.cards)];
        const outside = [...new Map(publicCards.filter(card => !ownIds.has(card.id)).map(card => [card.id, card])).values()];
        const coverage = evaluateHand5DiscardCoverage({ hand: view.hand, visibleOutsideHand: outside });
        const chosen = coverage.candidates.find(candidate => candidate.discardCardId === discardCardId);
        const best = Math.max(...coverage.candidates.map(candidate => candidate.completingDrawCount));
        coveragePassed = !coverage.immediateContractAvailable && coverage.bestDiscardCardIds.includes(discardCardId);
        coverageMeasurements = {
          exactContractLaidBySecond: false,
          chosenCompletingDraws: chosen?.completingDrawCount ?? 0,
          bestCompletingDraws: best,
          unseenCards: coverage.unseenCardCount,
          positiveCoverageAvailable: best > 0,
          coverageRegret: best - (chosen?.completingDrawCount ?? 0),
          skippedReadyContract: coverage.immediateContractAvailable,
        };
        coverageEvidence = `Actual second-turn hand: chosen ${chosen?.completingDrawCount ?? 0}/${coverage.unseenCardCount}, best ${best}/${coverage.unseenCardCount}; skipped ready exact contract=${coverage.immediateContractAvailable}. Conditional survival/no claims/no recycling, not global optimality.`;
      }
      const converted = all.some(exactLaydown);
      const finalDraw = turns[2]?.actionEvidence?.find(item => item.ok && (item.action.type === "DRAW_FROM_STOCK" || item.action.type === "DRAW_FROM_DISCARD"));
      const finalPostDrawView = finalDraw?.after;
      const conversionOpportunity = finalPostDrawView && !finalPostDrawView.isDown && finalPostDrawView.hand.length === 12
        ? hasExactContract(finalPostDrawView.hand, source.evaluatedPlayerId)
        : null;
      const missedConversionOpportunity = converted ? false : conversionOpportunity;
      return [
        { ...criterion(rubric[0], coveragePassed, coverageEvidence), measurements: coverageMeasurements },
        {
          ...criterion(rubric[1], converted, `Exact contract by third own turn=${converted}; conversion opportunity=${conversionOpportunity ?? "unobserved/not applicable"}; missed conversion opportunity=${missedConversionOpportunity ?? "unobserved"}. This sampled outcome can fail after a tied-best earlier choice.`),
          measurements: { exactContractAvailableOnFinalTurn: conversionOpportunity, missedConversionOpportunity, finalDrawObserved: finalDraw !== undefined },
        },
      ];
    },
  };
}

/** Prospective v10 replacement, not extra independent cases; holdouts unchanged. */
export const AI_PLAYER_CONTESTED_RUN_EPISODES: readonly AIPlayerShortRolloutScenario[] =
  AI_PLAYER_CONTESTED_RUN_SCENARIOS.map(extendDevelopmentEpisode);
