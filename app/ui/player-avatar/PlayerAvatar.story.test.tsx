import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router";
import { StorybookLayout } from "~/storybook/StorybookLayout";
import { ALL_CHARACTERS } from "~/ui/lobby/character.data";
import { PlayerAvatarStory } from "./PlayerAvatar.story";

describe("PlayerAvatarStory", () => {
  it("renders inside the normal storybook navigation", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/storybook/avatar-animation"]}>
        <Routes><Route path="/storybook/*" element={<StorybookLayout />} /></Routes>
      </MemoryRouter>
    );

    expect(html.includes('href="/storybook/playing-card"')).toBe(true);
    expect(html.includes('href="/storybook/character-picker"')).toBe(true);
  });

  it("makes every game character available in the animation preview", () => {
    const html = renderToStaticMarkup(<MemoryRouter><PlayerAvatarStory /></MemoryRouter>);

    for (const character of ALL_CHARACTERS) {
      const escapedName = renderToStaticMarkup(<>{character.name}</>);
      expect(html.includes(escapedName)).toBe(true);
    }
  });
});
