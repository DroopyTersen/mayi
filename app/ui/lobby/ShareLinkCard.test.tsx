import { afterEach, describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  canUseNativeShare,
  ShareLinkCard,
  ShareLinkCardView,
} from "./ShareLinkCard";

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

  it("omits native sharing from static markup to avoid hydration mismatch", () => {
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

    expect(withNativeShare).not.toContain("Share Link");
  });
});

describe("ShareLinkCardView", () => {
  it("renders the native share control only when presentation props allow it", () => {
    const withoutNativeShare = renderToStaticMarkup(
      <ShareLinkCardView
        roomId="HNPXR6"
        url="https://mayi.test/game/HNPXR6"
        copied={null}
        canNativeShare={false}
        onCopyLink={() => {}}
        onCopyCode={() => {}}
        onNativeShare={() => {}}
      />
    );

    expect(withoutNativeShare).not.toContain("Share Link");

    const withNativeShare = renderToStaticMarkup(
      <ShareLinkCardView
        roomId="HNPXR6"
        url="https://mayi.test/game/HNPXR6"
        copied={null}
        canNativeShare={true}
        onCopyLink={() => {}}
        onCopyCode={() => {}}
        onNativeShare={() => {}}
      />
    );

    expect(withNativeShare).toContain("Share Link");
  });
});

describe("canUseNativeShare", () => {
  it("detects native share support from a navigator-like object", () => {
    expect(canUseNativeShare({ share: async () => undefined })).toBe(true);
    expect(canUseNativeShare(undefined)).toBe(false);
  });
});
