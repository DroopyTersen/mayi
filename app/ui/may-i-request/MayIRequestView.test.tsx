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
    it("shows a normal discard pickup label when isCurrentPlayer=true", () => {
      const html = renderToStaticMarkup(
        <MayIRequestView {...defaultProps} isCurrentPlayer={true} />
      );

      expect(html).toContain("Pick Up Discard");
      expect(html).not.toContain("Claim Instead");
    });

    it("shows a claim label with penalty when isCurrentPlayer=false", () => {
      const html = renderToStaticMarkup(
        <MayIRequestView {...defaultProps} isCurrentPlayer={false} />
      );

      expect(html).toContain("Claim Instead (+ penalty)");
      expect(html).not.toContain("Pick Up Discard");
    });

    it("defaults to the non-current claim label", () => {
      const html = renderToStaticMarkup(<MayIRequestView {...defaultProps} />);

      expect(html).toContain("Claim Instead (+ penalty)");
      expect(html).not.toContain("Pick Up Discard");
    });

    it("uses a clear allow label", () => {
      const html = renderToStaticMarkup(<MayIRequestView {...defaultProps} />);

      expect(html).toContain("Allow May I");
    });
  });

  describe("canMayIInstead=false hides the action button entirely", () => {
    it("does not mention a May I usage limit", () => {
      const html = renderToStaticMarkup(
        <MayIRequestView {...defaultProps} canMayIInstead={false} />
      );

      expect(html).not.toContain("Pick Up Discard");
      expect(html).not.toContain("Claim Instead");
      expect(html).not.toContain("already used your May I");
      expect(html).toContain("You cannot claim this discard right now");
    });
  });
});
