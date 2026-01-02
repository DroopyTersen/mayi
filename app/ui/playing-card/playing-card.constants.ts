/**
 * Shared constants for playing card sizing.
 * Used by PlayingCard, DiscardPileDisplay, StockPileDisplay, etc.
 */

export const CARD_DIMENSIONS = {
  sm: { width: 48, height: 68 },
  md: { width: 64, height: 90 },
  lg: { width: 96, height: 134 },
} as const;

export type CardSize = keyof typeof CARD_DIMENSIONS;

/**
 * Breakpoint for mobile/desktop layout switching.
 * Used consistently across all responsive components.
 */
export const MOBILE_BREAKPOINT = 1024;

/**
 * Media query string for useMediaQuery hook.
 * Returns true when viewport is mobile-sized (< 1024px).
 */
export const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;
