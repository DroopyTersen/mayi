/**
 * Card type definitions for May I? card game
 */

export type Suit = "hearts" | "diamonds" | "clubs" | "spades";

export type Rank =
  | "A"
  | "K"
  | "Q"
  | "J"
  | "10"
  | "9"
  | "8"
  | "7"
  | "6"
  | "5"
  | "4"
  | "3"
  | "2"
  | "Joker";

export interface Card {
  id: string;
  suit: Suit | null; // null for Joker
  rank: Rank;
}
