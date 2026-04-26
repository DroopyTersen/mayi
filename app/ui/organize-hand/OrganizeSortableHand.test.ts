import { describe, expect, it } from "bun:test";
import { KeyboardSensor, PointerSensor } from "@dnd-kit/react";
import { ORGANIZE_HAND_DRAG_SENSORS } from "./organize-hand.drag-sensors";

describe("OrganizeSortableHand drag sensors", () => {
  it("does not let dnd-kit consume Space or Enter before card selection fallback", () => {
    expect(ORGANIZE_HAND_DRAG_SENSORS).toContain(PointerSensor);
    expect(ORGANIZE_HAND_DRAG_SENSORS).not.toContain(KeyboardSensor);
  });
});
