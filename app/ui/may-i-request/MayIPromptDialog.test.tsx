import { describe, it, expect } from "bun:test";
import { AUTO_ALLOW_SECONDS } from "./MayIPromptDialog";

describe("MayIPromptDialog", () => {
  describe("timeout constant", () => {
    it("should export AUTO_ALLOW_SECONDS as 60 (per house rules)", () => {
      // Verify the timeout is 60 seconds, not 15
      expect(AUTO_ALLOW_SECONDS).toBe(60);
    });
  });

  // Note: The isCurrentPlayer button text logic is tested in MayIRequestView.test.tsx
  // MayIPromptDialog simply passes the prop through to MayIRequestView.
  // Testing the Dialog component itself requires a DOM environment (portals),
  // which is verified through manual/integration testing.
});
