/**
 * Unit tests for mayIAgent
 *
 * Tests stopWhenTurnComplete - a pure function that determines
 * when to stop the agent loop.
 */

import { describe, it, expect } from "bun:test";
import { stopWhenTurnComplete } from "./mayIAgent";

/**
 * Helper to create a minimal step with optional turnComplete in tool result
 */
function makeStep(turnComplete?: boolean) {
  if (turnComplete === undefined) {
    return { toolResults: undefined };
  }
  return {
    toolResults: [
      {
        output: {
          success: true,
          message: "OK",
          turnComplete,
        },
      },
    ],
  };
}

describe("stopWhenTurnComplete", () => {
  describe("maxSteps limit", () => {
    it("stops when maxSteps reached", () => {
      const shouldStop = stopWhenTurnComplete(3);
      const steps = [makeStep(false), makeStep(false), makeStep(false)];
      expect(shouldStop({ steps } as never)).toBe(true);
    });

    it("continues when under maxSteps", () => {
      const shouldStop = stopWhenTurnComplete(5);
      const steps = [makeStep(false), makeStep(false)];
      expect(shouldStop({ steps } as never)).toBe(false);
    });

    it("stops exactly at maxSteps boundary", () => {
      const shouldStop = stopWhenTurnComplete(2);
      const oneStep = [makeStep(false)];
      const twoSteps = [makeStep(false), makeStep(false)];

      expect(shouldStop({ steps: oneStep } as never)).toBe(false);
      expect(shouldStop({ steps: twoSteps } as never)).toBe(true);
    });
  });

  describe("turnComplete flag", () => {
    it("stops immediately when turnComplete is true", () => {
      const shouldStop = stopWhenTurnComplete(10);
      const steps = [makeStep(true)];
      expect(shouldStop({ steps } as never)).toBe(true);
    });

    it("continues when turnComplete is false", () => {
      const shouldStop = stopWhenTurnComplete(10);
      const steps = [makeStep(false)];
      expect(shouldStop({ steps } as never)).toBe(false);
    });

    it("stops when turnComplete appears in later step", () => {
      const shouldStop = stopWhenTurnComplete(10);
      const steps = [makeStep(false), makeStep(false), makeStep(true)];
      expect(shouldStop({ steps } as never)).toBe(true);
    });

    it("stops on first turnComplete even if more steps follow", () => {
      const shouldStop = stopWhenTurnComplete(10);
      // First step has turnComplete, should stop there
      const steps = [makeStep(true), makeStep(false)];
      expect(shouldStop({ steps } as never)).toBe(true);
    });
  });

  describe("undefined/empty toolResults", () => {
    it("continues when toolResults is undefined", () => {
      const shouldStop = stopWhenTurnComplete(10);
      const steps = [{ toolResults: undefined }];
      expect(shouldStop({ steps } as never)).toBe(false);
    });

    it("continues when toolResults is empty array", () => {
      const shouldStop = stopWhenTurnComplete(10);
      const steps = [{ toolResults: [] }];
      expect(shouldStop({ steps } as never)).toBe(false);
    });

    it("continues with empty steps array", () => {
      const shouldStop = stopWhenTurnComplete(10);
      expect(shouldStop({ steps: [] } as never)).toBe(false);
    });
  });

  describe("mixed scenarios", () => {
    it("prefers turnComplete over maxSteps if both conditions met", () => {
      const shouldStop = stopWhenTurnComplete(2);
      // Two steps AND turnComplete - both would trigger stop
      const steps = [makeStep(false), makeStep(true)];
      expect(shouldStop({ steps } as never)).toBe(true);
    });

    it("handles step with multiple tool results", () => {
      const shouldStop = stopWhenTurnComplete(10);
      const steps = [
        {
          toolResults: [
            { output: { success: true, turnComplete: false } },
            { output: { success: true, turnComplete: true } },
          ],
        },
      ];
      expect(shouldStop({ steps } as never)).toBe(true);
    });
  });
});
