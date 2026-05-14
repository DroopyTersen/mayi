import type { GameSnapshot } from "../core/engine/game-engine.types";
import type { GameAction } from "../core/engine/game-action.command";

export type AIActionResult =
  | { ok: true; snapshot: GameSnapshot }
  | { ok: false; snapshot: GameSnapshot; error: string };

export interface AIActionRuntime {
  getSnapshot(): Promise<GameSnapshot>;
  executeAction(action: GameAction): Promise<AIActionResult>;
}

export type { GameAction };
