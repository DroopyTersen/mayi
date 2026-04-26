export type CardSize = "sm" | "md" | "lg";

type HandSizeTier = "normal" | "large" | "huge";

export const STACKED_HAND_FIXED_OVERLAP: Record<CardSize, string> = {
  sm: "-ml-6",
  md: "-ml-8",
  lg: "-ml-10",
};

export const STACKED_HAND_FIXED_HOVER_LIFT: Record<CardSize, string> = {
  sm: "hover:-translate-y-1.5",
  md: "hover:-translate-y-2",
  lg: "hover:-translate-y-3",
};

export const STACKED_HAND_AUTO_HOVER_LIFT =
  "hover:-translate-y-1.5 @[400px]:hover:-translate-y-2 @[550px]:hover:-translate-y-3";

const STACKED_HAND_OVERLAP_TIERS: Record<HandSizeTier, string> = {
  normal: "-ml-5 @[400px]:ml-0 @[400px]:-ml-8 @[550px]:ml-0 @[550px]:-ml-10",
  large: "-ml-6 @[400px]:ml-0 @[400px]:-ml-8 @[550px]:ml-0 @[550px]:-ml-14",
  huge: "-ml-7 @[400px]:ml-0 @[400px]:-ml-10 @[550px]:ml-0 @[550px]:-ml-[72px]",
};

export function getHandSizeTier(cardCount: number): HandSizeTier {
  if (cardCount > 20) return "huge";
  if (cardCount > 14) return "large";
  return "normal";
}

export function getStackedHandOverlapClass(cardCount: number): string {
  return STACKED_HAND_OVERLAP_TIERS[getHandSizeTier(cardCount)];
}
