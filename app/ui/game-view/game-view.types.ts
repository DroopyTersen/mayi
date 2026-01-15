/**
 * Shared types for GameView components
 */

export type ActiveDrawer =
  | "layDown"
  | "layOff"
  | "discard"
  | "swapJoker"
  | "organize"
  | null;

export interface ActivityEntry {
  id: string;
  message: string;
  timestamp?: string;
}

/**
 * Player info used by PlayersTableDisplay
 */
export interface PlayerDisplayInfo {
  id: string;
  name: string;
  avatarId?: string;
  cardCount: number;
  isDown: boolean;
  score: number;
}

/**
 * Simplified player info for TableDisplay (just identity)
 */
export interface TablePlayerInfo {
  id: string;
  name: string;
  avatarId?: string;
}
