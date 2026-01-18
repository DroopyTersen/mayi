# House Rules Component Design Spec

## Overview
Create a HouseRulesDrawer component that displays a simplified "cheat sheet" version of the game rules.

## Human Decision
**Selected Approach:** JSX-based content (no markdown parsing)

**Rationale:** "I don't want to introduce a third party rendering library. Write a version of house rules in JSX. Clean it up and simplify for presentation if needed. Maybe it's more like a cheat sheet."

## Files to Create
- `HouseRulesContent.tsx` — JSX cheat sheet content
- `HouseRulesDrawer.tsx` — ResponsiveDrawer wrapper
- `HouseRulesDrawer.story.tsx` — Storybook story

## Files to Modify
- `app/ui/game-status/GameHeader.tsx` — Add help icon
- `app/routes/home.tsx` — Add "View House Rules" button

## Content Sections
1. Card Values table
2. Contracts by round
3. Key rules (wilds, May I?, etc.)
4. Hand 6 special rules

## Integration Points
- GameHeader: HelpCircle icon button (ghost variant)
- Home page: "View House Rules" button (outline variant)
