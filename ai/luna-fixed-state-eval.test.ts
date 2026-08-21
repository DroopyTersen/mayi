/**
 * Deterministic Luna quality probes.
 *
 * The legality assertions run on every test invocation. The live cases use
 * the real Responses model only when RUN_INTEGRATION_TESTS=1 and write one
 * JSONL record per scenario under .data/ai-evals/.
 */
import { describe, expect, it } from "bun:test";
import { mkdir, appendFile } from "node:fs/promises";
import { createActor } from "xstate";
import type { GameAction } from "./ai-action-runtime.types";
import { executeTurn } from "./mayIAgent";
import { modelRegistry } from "./modelRegistry";
import type { AIActionRuntime, AIActionResult } from "./ai-action-runtime.types";
import type { ActionLogEntry } from "./mayIAgent.prompt-renderer";
import { roundMachine, type PredefinedRoundState, type RoundInput } from "../core/engine/round.machine";
import type { Card } from "../core/card/card.types";
import type { Player } from "../core/engine/engine.types";
import type { GameSnapshot } from "../core/engine/game-engine.types";
import { validateContractMelds } from "../core/engine/contracts";
import { isValidRun, isValidSet } from "../core/meld/meld.validation";
import type { Meld } from "../core/meld/meld.types";
import { projectGameSnapshotFromXState } from "../core/engine/game-engine.projection";

const live = process.env.RUN_INTEGRATION_TESTS === "1";
const EVAL_DIR = ".data/ai-evals";
const EVAL_FILE = `${EVAL_DIR}/luna-fixed-state-quality.jsonl`;

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
    name: index === 0 ? "Luna" : `Opponent ${index}`,
    hand,
    isDown: down[index] ?? false,
    totalScore: index === 0 ? 12 : index * 34,
  }));
}

function createRuntime(input: RoundInput): {
  runtime: AIActionRuntime;
  actor: ReturnType<typeof createActor<typeof roundMachine>>;
  attempts: Array<{ action: GameAction; ok: boolean; error?: string }>;
} {
  const actor = createActor(roundMachine, { input });
  actor.start();
  const attempts: Array<{ action: GameAction; ok: boolean; error?: string }> = [];

  function snapshot() {
    const roundSnapshot = actor.getPersistedSnapshot() as unknown as {
      value: unknown;
      context: { players: Player[]; roundNumber: number; dealerIndex: number };
      children?: { turn?: { snapshot?: { context?: { hand?: Card[]; isDown?: boolean } } } };
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
      gameId: "luna-fixed-state-eval",
      createdAt: "2026-08-21T00:00:00.000Z",
    });
    const turnContext = roundSnapshot.children?.turn?.snapshot?.context;
    const currentId = projected.players[projected.currentPlayerIndex]?.id;
    return {
      ...projected,
      players: projected.players.map((player) =>
        player.id === currentId && turnContext?.hand
          ? { ...player, hand: turnContext.hand, isDown: turnContext.isDown ?? player.isDown }
          : player,
      ),
    };
  }

  const runtime: AIActionRuntime = {
    async getSnapshot() {
      return snapshot();
    },
    async executeAction(action: GameAction): Promise<AIActionResult> {
      const before = snapshot();
      const playerId = before.awaitingPlayerId;
      switch (action.type) {
        case "DRAW_FROM_STOCK": actor.send({ type: "DRAW_FROM_STOCK", playerId }); break;
        case "DRAW_FROM_DISCARD": actor.send({ type: "DRAW_FROM_DISCARD", playerId }); break;
        case "SKIP": actor.send({ type: "SKIP_LAY_DOWN", playerId }); break;
        case "DISCARD": actor.send({ type: "DISCARD", playerId, cardId: action.cardId }); break;
        case "LAY_DOWN": actor.send({ type: "LAY_DOWN", playerId, melds: action.melds }); break;
        case "LAY_OFF": actor.send({ type: "LAY_OFF", playerId, cardId: action.cardId, meldId: action.meldId, position: action.position }); break;
        case "SWAP_JOKER": actor.send({ type: "SWAP_JOKER", playerId, jokerCardId: action.jokerCardId, meldId: action.meldId, swapCardId: action.swapCardId }); break;
        case "ALLOW_MAY_I": actor.send({ type: "ALLOW_MAY_I", playerId }); break;
        case "CLAIM_MAY_I": actor.send({ type: "CLAIM_MAY_I", playerId }); break;
        case "CALL_MAY_I": actor.send({ type: "CALL_MAY_I", playerId }); break;
      }
      const after = snapshot();
      const changed = JSON.stringify(before) !== JSON.stringify(after);
      const ok = changed && !after.lastError;
      const result: AIActionResult = ok
        ? { ok: true, snapshot: after }
        : { ok: false, snapshot: after, error: after.lastError ?? "Action was not accepted" };
      attempts.push({
        action,
        ok: result.ok,
        ...(result.ok ? {} : { error: result.error }),
      });
      return result;
    },
  };
  return { runtime, actor, attempts };
}

function baseInput(roundNumber: 1 | 2 | 6, state: PredefinedRoundState): RoundInput {
  return {
    roundNumber,
    players: players(state.hands, state.playerDownStatus),
    dealerIndex: state.hands.length - 1,
    predefinedState: state,
  };
}

function recordSummary(snapshot: Awaited<ReturnType<AIActionRuntime["getSnapshot"]>>) {
  return {
    phase: snapshot.phase,
    turnPhase: snapshot.turnPhase,
    awaitingPlayerId: snapshot.awaitingPlayerId,
    handSizes: snapshot.players.map((player) => player.hand.length),
    stock: snapshot.stock.length,
    discard: snapshot.discard.length,
    tableMelds: snapshot.table.length,
  };
}

interface EvalScenario {
  id: string;
  rubric: string;
  input: RoundInput;
  assertOutcome: (
    after: GameSnapshot,
    attempts: Array<{ action: GameAction; ok: boolean }>,
  ) => void;
  prepare?: (actor: ReturnType<typeof createActor<typeof roundMachine>>) => void;
  maxSteps?: number;
  actionLog?: ActionLogEntry[];
}

const scenarios: EvalScenario[] = [
  {
    id: "draw-stock-safe-discard",
    rubric: "draw from stock, then discard the highest-point non-contract liability",
    assertOutcome: (after, attempts) => {
      expect(attempts[0]?.action.type).toBe("DRAW_FROM_STOCK");
      expect(attempts.find((attempt) => attempt.action.type === "DISCARD")?.action).toEqual({
        type: "DISCARD",
        cardId: "stock-a",
      });
      expect(after.awaitingPlayerId).not.toBe("eval-player-0");
    },
    input: baseInput(1, {
      hands: [
        [card("p0-3", "3", "hearts"), card("p0-7", "7", "clubs"), card("p0-q", "Q", "diamonds")],
        [card("p1-4", "4", "hearts")], [card("p2-5", "5", "clubs")],
      ],
      stock: stockPile(card("stock-a", "A", "spades")),
      discard: [card("discard-4", "4", "hearts")],
    }),
  },
  {
    id: "laydown-exact-contract",
    rubric: "lay down two valid sets after drawing",
    assertOutcome: (after, attempts) => {
      const player = after.players.find((candidate) => candidate.id === "eval-player-0");
      expect(attempts.some((attempt) => attempt.action.type === "LAY_DOWN")).toBe(true);
      expect(player?.isDown).toBe(true);
      expect(after.table).toHaveLength(2);
      expect(after.awaitingPlayerId).not.toBe("eval-player-0");
    },
    input: baseInput(1, {
      hands: [
        [card("p0-9c", "9", "clubs"), card("p0-9d", "9", "diamonds"), card("p0-9h", "9", "hearts"), card("p0-kc", "K", "clubs"), card("p0-kd", "K", "diamonds"), card("p0-ks", "K", "spades"), card("p0-3", "3", "hearts")],
        [card("p1-4", "4", "hearts")], [card("p2-5", "5", "clubs")],
      ],
      stock: stockPile(card("stock-a", "A", "spades")), discard: [card("discard-6", "6", "hearts")],
    }),
  },
  {
    id: "may-i-response",
    rubric: "respond to a May I prompt without exposing private hands",
    assertOutcome: (_after, attempts) => {
      const successful = attempts.filter((attempt) => attempt.ok);
      expect(successful).toHaveLength(1);
      expect(successful[0]?.action.type).toMatch(/^(ALLOW|CLAIM)_MAY_I$/);
    },
    input: baseInput(1, {
      hands: [
        [card("p0-3", "3", "hearts")], [card("p1-4", "4", "hearts")], [card("p2-5", "5", "clubs")],
      ], stock: stockPile(card("stock-a", "A", "spades")), discard: [card("discard-q", "Q", "diamonds")],
    }),
    prepare: (actor: ReturnType<typeof createActor<typeof roundMachine>>) => actor.send({ type: "CALL_MAY_I", playerId: "eval-player-1" }),
    maxSteps: 1,
  },
  {
    id: "layoff",
    rubric: "use a legal layoff instead of discarding a playable card",
    assertOutcome: (after, attempts) => {
      expect(attempts.some((attempt) => attempt.action.type === "LAY_OFF")).toBe(true);
      expect(after.table[0]?.cards.some((candidate) => candidate.id === "p0-9")).toBe(true);
      expect(after.awaitingPlayerId).not.toBe("eval-player-0");
    },
    input: baseInput(2, {
      hands: [
        [card("p0-9", "9", "clubs"), card("p0-5", "5", "spades")], [card("p1-4", "4", "hearts")], [card("p2-6", "6", "clubs")],
      ], stock: stockPile(card("stock-a", "A", "spades")), discard: [card("discard-7", "7", "diamonds")],
      table: [{ id: "meld-run", ownerId: "eval-player-1", type: "run", cards: [card("table-5", "5", "clubs"), card("table-6", "6", "clubs"), card("table-7", "7", "clubs"), card("table-8", "8", "clubs")] }],
      playerDownStatus: [true, false, false],
    }),
  },
  {
    id: "joker-swap",
    rubric: "swap a Joker from a run when it unlocks the player's contract",
    assertOutcome: (after, attempts) => {
      const player = after.players.find((candidate) => candidate.id === "eval-player-0");
      expect(attempts.some((attempt) => attempt.action.type === "SWAP_JOKER")).toBe(true);
      expect(after.table[0]?.cards.some((candidate) => candidate.id === "p0-6h")).toBe(true);
      expect(player?.isDown).toBe(true);
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
      table: [{
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
      }],
    }),
  },
  {
    id: "opponent-feed-avoidance",
    rubric: "avoid discarding a rank an opponent publicly collected",
    assertOutcome: (after) => {
      expect(after.discard[0]?.id).not.toBe("p0-7");
      expect(after.awaitingPlayerId).not.toBe("eval-player-0");
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
    actionLog: [{
      roundNumber: 1,
      playerId: "eval-player-1",
      playerName: "Opponent 1",
      action: "picked up",
      details: "7♣ from the discard pile",
    }],
  },
  {
    id: "endgame-point-dump",
    rubric: "dump a 50-point Joker when an opponent is one card from going out",
    assertOutcome: (after) => {
      expect(after.discard[0]?.id).toBe("p0-joker");
      expect(after.awaitingPlayerId).not.toBe("eval-player-0");
    },
    input: baseInput(1, {
      hands: [
        [joker("p0-joker"), card("p0-3", "3", "hearts"), card("p0-4", "4", "clubs")],
        [card("p1-last", "9", "hearts")],
        [card("p2-5", "5", "clubs")],
      ],
      stock: stockPile(card("stock-6", "6", "spades")),
      discard: [card("discard-8", "8", "diamonds")],
      playerDownStatus: [false, true, false],
    }),
  },
  {
    id: "round6-all-cards",
    rubric: "lay down all cards in Hand 6 and win without discard",
    assertOutcome: (after, attempts) => {
      const player = after.players.find((candidate) => candidate.id === "eval-player-0");
      expect(attempts.some((attempt) => attempt.action.type === "LAY_DOWN")).toBe(true);
      expect(player?.hand).toHaveLength(0);
      expect(after.phase).toBe("ROUND_END");
      expect(after.table).toHaveLength(3);
    },
    input: baseInput(6, {
      hands: [
        [card("set-kc", "K", "clubs"), card("set-kd", "K", "diamonds"), card("set-kh", "K", "hearts"), card("run-h3", "3", "hearts"), card("run-h4", "4", "hearts"), card("run-h5", "5", "hearts"), card("run-h6", "6", "hearts"), card("run-s9", "9", "spades"), card("run-s10", "10", "spades"), card("run-sj", "J", "spades"), card("run-sq", "Q", "spades")],
        [card("p1-4", "4", "diamonds")], [card("p2-5", "5", "clubs")],
      ], stock: stockPile(card("set-ks", "K", "spades")), discard: [card("discard-7", "7", "diamonds")],
    }),
  },
] as const;

function countToolRetries(
  toolCalls: readonly string[],
  attempts: readonly { ok: boolean }[],
): number {
  const successfulActions = attempts.filter((attempt) => attempt.ok).length;
  return Math.max(0, toolCalls.length - successfulActions);
}

describe("fixed-state AI legality fixtures", () => {
  it("counts tool calls rejected before the engine as retries", () => {
    expect(
      countToolRetries(
        ["draw_from_stock({})", "lay_down(invalid)", "lay_down(corrected)"],
        [{ ok: true }, { ok: true }],
      ),
    ).toBe(1);
  });

  it("projects the real round-machine turn phase after an action", async () => {
    const { runtime, actor } = createRuntime(
      baseInput(1, {
        hands: [
          [card("p0-3", "3", "hearts")],
          [card("p1-4", "4", "hearts")],
          [card("p2-5", "5", "clubs")],
        ],
        stock: stockPile(card("stock-a", "A", "spades")),
        discard: [card("discard-2", "2", "hearts")],
      }),
    );

    const before = await runtime.getSnapshot();
    const result = await runtime.executeAction({ type: "DRAW_FROM_STOCK" });

    expect(before.turnPhase).toBe("AWAITING_DRAW");
    expect(result.ok).toBe(true);
    expect(result.snapshot.turnPhase).toBe("AWAITING_ACTION");
    expect(result.snapshot.players[0]?.hand).toHaveLength(2);
    actor.stop();
  });

  it("covers the critical engine legality matrix without an API key", () => {
    const validSet: Meld = { id: "set", ownerId: "p", type: "set", cards: [card("1", "9", "clubs"), card("2", "9", "clubs"), card("3", "9", "diamonds")] };
    const validRun: Meld = { id: "run", ownerId: "p", type: "run", cards: [card("4", "3", "hearts"), card("5", "4", "hearts"), card("6", "5", "hearts"), card("7", "6", "hearts")] };
    expect(isValidSet(validSet.cards)).toBe(true);
    expect(isValidRun(validRun.cards)).toBe(true);
    expect(validateContractMelds({ roundNumber: 2, sets: 1, runs: 1 }, [validSet, validRun]).valid).toBe(true);
    expect(isValidRun([card("8", "A", "spades"), card("9", "3", "spades"), card("10", "4", "spades"), card("11", "5", "spades")])).toBe(false);
    expect(isValidSet([card("12", "9", "clubs"), joker("13"), joker("14")])).toBe(false);
    expect(isValidSet([card("15", "9", "clubs"), card("16", "9", "clubs"), joker("17")])).toBe(true);

    const lowSpadeRun: Meld = {
      id: "low-spades",
      ownerId: "p",
      type: "run",
      cards: [
        card("s3", "3", "spades"),
        card("s4", "4", "spades"),
        card("s5", "5", "spades"),
        card("s6", "6", "spades"),
      ],
    };
    const oneGapSpadeRun: Meld = {
      id: "one-gap-spades",
      ownerId: "p",
      type: "run",
      cards: [
        card("s8", "8", "spades"),
        card("s9", "9", "spades"),
        card("s10", "10", "spades"),
        card("sj", "J", "spades"),
      ],
    };
    const twoGapSpadeRun: Meld = {
      id: "two-gap-spades",
      ownerId: "p",
      type: "run",
      cards: [
        card("s9b", "9", "spades"),
        card("s10b", "10", "spades"),
        card("sjb", "J", "spades"),
        card("sqb", "Q", "spades"),
      ],
    };
    expect(validateContractMelds({ roundNumber: 3, sets: 0, runs: 2 }, [lowSpadeRun, oneGapSpadeRun]).valid).toBe(false);
    expect(validateContractMelds({ roundNumber: 3, sets: 0, runs: 2 }, [lowSpadeRun, twoGapSpadeRun]).valid).toBe(true);
  });
});

describe.skipIf(!live)("GPT-5.6 Luna fixed-state evaluations", () => {
  for (const scenario of scenarios) {
    it(scenario.id, async () => {
      const { runtime, actor, attempts } = createRuntime(scenario.input);
      scenario.prepare?.(actor);
      const before = await runtime.getSnapshot();
      const started = Date.now();
      const result = await executeTurn({
        model: modelRegistry.languageModel("default:openai"),
        modelId: "default:openai",
        runtime,
        playerId: "eval-player-0",
        playerName: "Luna",
        debug: false,
        telemetry: true,
        maxRetries: 1,
        maxSteps: scenario.maxSteps,
        actionLog: scenario.actionLog,
      });
      const after = await runtime.getSnapshot();
      const metrics = result.metrics;
      if (!result.success) {
        console.error(`[Luna eval] ${scenario.id} did not complete`, {
          error: result.error,
          actions: result.actions,
          attempts,
        });
      }
      expect(result.success).toBe(true);
      expect(after.lastError).toBeNull();
      expect(attempts.every((attempt) => attempt.ok)).toBe(true);
      scenario.assertOutcome(after, attempts);
      const legal = result.success && !after.lastError && attempts.every((attempt) => attempt.ok);

      const record = {
        schemaVersion: 2,
        scenarioId: scenario.id,
        rubric: scenario.rubric,
        before: recordSummary(before),
        after: recordSummary(after),
        actions: result.actions,
        actionAttempts: attempts,
        success: result.success,
        legal,
        qualityPassed: legal,
        retries: countToolRetries(result.actions, attempts),
        latencyMs: Date.now() - started,
        providerLatencyMs: metrics?.providerDurationMs,
        tokens: {
          input: metrics?.inputTokens,
          noCache: metrics?.noCacheInputTokens,
          cacheRead: metrics?.cacheReadInputTokens,
          cacheWrite: metrics?.cacheWriteInputTokens,
          output: metrics?.outputTokens,
          reasoning: metrics?.reasoningOutputTokens,
        },
      };
      await mkdir(EVAL_DIR, { recursive: true });
      await appendFile(EVAL_FILE, `${JSON.stringify(record)}\n`);
      actor.stop();
    }, 120_000);
  }
});
