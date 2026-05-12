import { afterEach, describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ShareLinkCard } from "./ShareLinkCard";

const originalNavigator = globalThis.navigator;

afterEach(() => {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: originalNavigator,
  });
});

describe("ShareLinkCard", () => {
  it("renders separate controls for copying the link and room code", () => {
    const html = renderToStaticMarkup(
      <ShareLinkCard roomId="HNPXR6" shareUrl="https://mayi.test/game/HNPXR6" />
    );

    expect(html).toContain("Copy Link");
    expect(html).toContain("Copy Code");
    expect(html).toContain("HNPXR6");
  });

  it("only renders native sharing when the browser supports it", () => {
    const withoutNativeShare = renderToStaticMarkup(
      <ShareLinkCard roomId="HNPXR6" shareUrl="https://mayi.test/game/HNPXR6" />
    );

    expect(withoutNativeShare).not.toContain("Share Link");

    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        clipboard: { writeText: async () => {} },
        share: async () => {},
      },
    });

    const withNativeShare = renderToStaticMarkup(
      <ShareLinkCard roomId="HNPXR6" shareUrl="https://mayi.test/game/HNPXR6" />
    );

    expect(withNativeShare).toContain("Share Link");
  });
});
