import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { TableDisplayStory } from "./TableDisplay.story";

describe("TableDisplayStory", () => {
  it("renders composed inline lay-off targets in a legal viewing-player turn", () => {
    const html = renderToStaticMarkup(TableDisplayStory());

    expect(html).toContain("Inline Lay Off Targets");
    expect(html).toContain("Kate is viewing, down, has drawn");
    expect(html).toContain("(you)");
    expect(html).toContain("Lay off selected card to Kate&#x27;s set");
  });

  it("uses avatar ids that exist in public assets", () => {
    const html = renderToStaticMarkup(TableDisplayStory());

    expect(html).toContain("/avatars/curt.svg");
    expect(html).toContain("/avatars/kate.svg");
    expect(html).toContain("/avatars/andrew.svg");
    expect(html).toContain("/avatars/natalie.svg");
  });
});
