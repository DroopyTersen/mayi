import { describe, it, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MayIRequestView } from "./MayIRequestView";
import type { Card } from "core/card/card.types";

const mockCard: Card = {
  id: "test-card",
  suit: "hearts",
  rank: "7",
};

describe("MayIRequestView", () => {
  const defaultProps = {
    requesterName: "Alice",
    discardCard: mockCard,
    canMayIInstead: true,
    onAllow: () => {},
    onMayIInstead: () => {},
  };

  describe("button text based on isCurrentPlayer", () => {
    it("should show 'Pick Up' when isCurrentPlayer=true", () => {
      const html = renderToStaticMarkup(
        <MayIRequestView {...defaultProps} isCurrentPlayer={true} />
      );

      expect(html).toContain("Pick Up");
      expect(html).not.toContain("May I Instead!");
    });

    it("should show 'May I Instead!' when isCurrentPlayer=false", () => {
      const html = renderToStaticMarkup(
        <MayIRequestView {...defaultProps} isCurrentPlayer={false} />
      );

      expect(html).toContain("May I Instead!");
      expect(html).not.toContain("Pick Up");
    });

    it("should default to 'May I Instead!' when isCurrentPlayer is undefined (backward compatible)", () => {
      const html = renderToStaticMarkup(<MayIRequestView {...defaultProps} />);

      expect(html).toContain("May I Instead!");
      expect(html).not.toContain("Pick Up");
    });
  });

  describe("canMayIInstead=false hides the action button entirely", () => {
    it("should not show Pick Up or May I Instead when canMayIInstead=false", () => {
      const html = renderToStaticMarkup(
        <MayIRequestView {...defaultProps} canMayIInstead={false} />
      );

      // Neither button should appear
      expect(html).not.toContain("Pick Up");
      expect(html).not.toContain("May I Instead!");
      // But the "used your May I" message should appear
      expect(html).toContain("already used your May I");
    });
  });
});
