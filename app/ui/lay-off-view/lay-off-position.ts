import type { Card } from "core/card/card.types";
import type { Meld } from "core/meld/meld.types";
import {
  getRunInsertPosition,
  needsPositionChoice,
} from "core/engine/layoff";

export type LayOffPositionDecision =
  | { kind: "ready"; position?: "start" | "end" }
  | { kind: "needsPosition" };

function toLayOffPosition(
  insertPosition: "low" | "high" | null
): "start" | "end" | undefined {
  if (insertPosition === "low") {
    return "start";
  }
  if (insertPosition === "high") {
    return "end";
  }
  return undefined;
}

export function getLayOffPositionDecision(
  card: Card,
  meld: Meld
): LayOffPositionDecision {
  if (meld.type === "set") {
    return { kind: "ready", position: undefined };
  }

  if (needsPositionChoice(card, meld)) {
    return { kind: "needsPosition" };
  }

  return {
    kind: "ready",
    position: toLayOffPosition(getRunInsertPosition(card, meld)),
  };
}
