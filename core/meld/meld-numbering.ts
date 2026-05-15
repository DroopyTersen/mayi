import type { Player } from "../engine/engine.types";
import type { Meld } from "./meld.types";

export interface NumberedMeld {
  meldNumber: number;
  meld: Meld;
  owner: Player | null;
}

/**
 * Deterministic meld numbering for player-facing command surfaces.
 *
 * Rule: meld numbers follow `table[]` order; the engine is the source of truth.
 */
export function getNumberedMelds(
  table: Meld[],
  players: Player[]
): NumberedMeld[] {
  return table.map((meld, index) => ({
    meldNumber: index + 1,
    meld,
    owner: players.find((p) => p.id === meld.ownerId) ?? null,
  }));
}
