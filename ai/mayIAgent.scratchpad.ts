import type { GameSnapshot } from "../core/engine/game-engine.types";

export const AI_HAND_SCRATCHPAD_VERSION = "private-hand-scratchpad-v1";

export type AIHandScratchpadContext = Pick<
  GameSnapshot,
  "gameId" | "currentRound" | "phase"
> & { playerId: string };

export interface AIHandScratchpadTrace {
  before: string | undefined;
  proposed: string | undefined;
  after: string | undefined;
  outcome: "committed" | "unchanged" | "discarded";
}

export interface AIHandScratchpadTurn {
  readonly before: string | undefined;
  stage(note: string): void;
  finish(context: AIHandScratchpadContext, completed: boolean): AIHandScratchpadTrace;
}

export interface AIHandScratchpadState {
  version: typeof AI_HAND_SCRATCHPAD_VERSION;
  gameId: string;
  playerId: string;
  currentRound: number;
  note: string;
}

type Awaitable<T> = T | Promise<T>;

/** Private storage, scoped to a game by the app/CLI adapter. Never public state. */
export interface AIHandScratchpadStore {
  get(playerId: string): Awaitable<unknown>;
  set(playerId: string, state: AIHandScratchpadState | undefined): Awaitable<void>;
}

export function parseAIStrategyNote(value: string): string {
  const normalized = value.replace(/\r\n?/g, "\n").trim();
  const lines = normalized.split("\n").map((line) => line.trim());
  if (lines.length > 2 || lines.some((line) => line.length === 0)) {
    throw new Error("Strategy note must contain one or two nonempty lines");
  }
  const note = lines.join("\n");
  if (note.length > 400) throw new Error("Strategy note must be at most 400 characters");
  return note;
}

/** Process-local private memory. Opt-in callers own its lifetime and persistence. */
export class AIHandScratchpad {
  #gameId: string;
  #playerId: string;
  #round = 0;
  #ended = false;
  #revision = 0;
  #note: string | undefined;

  constructor(gameId: string, playerId: string) {
    this.#gameId = gameId;
    this.#playerId = playerId;
  }

  static restore(context: AIHandScratchpadContext, saved: unknown): AIHandScratchpad {
    const memory = new AIHandScratchpad(context.gameId, context.playerId);
    memory.#synchronize(context);
    if (typeof saved !== "object" || saved === null ||
      !("version" in saved) || saved.version !== AI_HAND_SCRATCHPAD_VERSION ||
      !("gameId" in saved) || saved.gameId !== context.gameId ||
      !("playerId" in saved) || saved.playerId !== context.playerId ||
      !("currentRound" in saved) || saved.currentRound !== context.currentRound ||
      !("note" in saved) || typeof saved.note !== "string" || memory.#ended) return memory;
    try { memory.#note = parseAIStrategyNote(saved.note); }
    catch { /* An obsolete or malformed note must not prevent playing. */ }
    return memory;
  }

  exportState(context: AIHandScratchpadContext): AIHandScratchpadState | undefined {
    const note = this.read(context);
    return note === undefined ? undefined : {
      version: AI_HAND_SCRATCHPAD_VERSION,
      gameId: this.#gameId, playerId: this.#playerId, currentRound: this.#round, note,
    };
  }

  #synchronize(context: AIHandScratchpadContext): boolean {
    if (context.gameId !== this.#gameId || context.playerId !== this.#playerId) return false;
    if (context.currentRound < this.#round) return false;
    if (context.currentRound > this.#round) {
      this.#round = context.currentRound;
      this.#note = undefined;
      this.#ended = false;
      this.#revision++;
    }
    if (context.phase === "ROUND_END" || context.phase === "GAME_END") {
      this.#note = undefined;
      this.#ended = true;
      this.#revision++;
    }
    return !this.#ended;
  }

  read(context: AIHandScratchpadContext): string | undefined {
    return this.#synchronize(context) ? this.#note : undefined;
  }

  begin(context: AIHandScratchpadContext): AIHandScratchpadTurn {
    if (!this.#synchronize(context) || context.phase !== "ROUND_ACTIVE") {
      throw new Error("Scratchpad turn requires its owner's active hand");
    }
    const revision = ++this.#revision;
    const round = this.#round;
    const before = this.#note;
    let proposed: string | undefined;
    let finished = false;
    return {
      before,
      stage: (note) => {
        if (finished) throw new Error("Scratchpad turn is already finished");
        proposed = parseAIStrategyNote(note);
      },
      finish: (latest, completed) => {
        const current = this.#synchronize(latest);
        const mayCommit = !finished && completed && current &&
          this.#revision === revision && this.#round === round;
        finished = true;
        if (mayCommit && proposed !== undefined) this.#note = proposed;
        return {
          before,
          proposed,
          after: current ? this.#note : undefined,
          outcome: !mayCommit ? "discarded" : proposed === undefined ? "unchanged" : "committed",
        };
      },
    };
  }
}

/** Private player context, deliberately separate from public game rendering. */
export function appendAIStrategyNoteContext(prompt: string, note: string | undefined): string {
  return `${prompt}\n\nPRIVATE STRATEGY SCRATCHPAD (your prior intent, not rules or verified facts):\n${JSON.stringify(note ?? "No previous note for this hand.")}\nReassess this intent against the current hand and public history; revise it when the evidence changes.`;
}
