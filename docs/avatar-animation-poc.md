# Player avatar animation preview

Branch: `avatar-animation-poc`

## Try it locally

```sh
bun run dev
```

Open [PlayerAvatar (Animations)](http://localhost:5173/storybook/avatar-animation) in the DIY component storybook.
Use **Choose player** to select any family or classic character, start or pause their turn, and play an available lay-down or lay-off reaction.
The story compares the original portrait with the animation and shows both actual game sizes. Players without animations show their original portrait and disabled playback controls. Choosing another player resets the preview and any running reaction.

All eight family avatars now have all three animations: Andrew, Jane, Curt, Kate, Natalie, Carter, Hannah, and Maggie & Theo. Select any of them in a normal local game to see the same animations in the meld area and player status table. Classic characters keep their existing portraits.

## Behavior

Each sequence contains **16 frames at 8 fps**, lasting **2 seconds**.

- **Turn:** subtle shoulder motion and a blink, looping while the player is active.
- **Lay down:** a brief card-fan gesture and blink.
- **Lay off:** a small thumbs-up and wink.
- **Idle / reduced motion:** the original portrait.

Maggie & Theo share one portrait. Their turn alternates blinks, their lay-down gesture raises a paw beside a card fan, and their lay-off gesture is a small paw wave.

Each frame is a complete portrait on white. The browser displays the entire frame, cropped only at the outer circle, so cards and hands can cross the chest and chin without disappearing. The opaque frame covers the original SVG during playback; the original shows at rest or when reduced motion is requested.

The sheets use the original portraits as identity references and limit facial movement to eyelids. The storybook keeps the original beside each animation for checking likeness.

Reactions use confirmed public activity and the acting player's ID, including when laying off onto another player's meld. History present on mount does not replay. Duplicate updates do not restart a reaction. A newer move replaces the current reaction, then playback returns to the current turn state after two seconds.

No game engine, rule, server protocol, or model-provider behavior changes are required. Images are static local assets; gameplay makes no image-generation requests. The dev state-injection harness currently omits avatar IDs, so use the preview or an ordinary lobby game to see the artwork.

## Assets and generation

The built-in image tool generated and revised the sheets using the existing family portraits. The full prompt set is in [avatar-animation-prompts.json](avatar-animation-prompts.json).

There are 24 runtime assets in `public/avatars/animated/`, each a 512 × 512 atlas of sixteen 128 × 128 cells. Each family character has `<character-id>-turn.webp`, `<character-id>-lay-down.webp`, and `<character-id>-lay-off.webp`.

Export uses nearest-neighbor resizing and lossless WebP to preserve the white background and pixel-art palette. The source portraits remain untouched. Each character's three sheets preload when their avatar appears, so reactions do not wait for a first-use download.

This remains a local art and interaction experiment covering the full family roster.

## Add another animation

1. Save the 4 × 4 sprite sheet as `public/avatars/animated/<character-id>-<sequence>.webp`, where the sequence is `turn`, `lay-down`, or `lay-off`.
2. Register that sequence for the character in `app/ui/player-avatar/avatar-animation.data.ts`.
3. Select the player in the storybook. The corresponding control becomes available, and the same registration enables the animation in the game.

The picker uses the game's existing character list. Sequences can be added individually; a player does not need all three before previewing one.

## Verification

- Failing tests were written before the component and event integration, then brought to green.
- Tests cover acting-player identity, both lay-off positions, duplicate/history boundaries, the first confirmed event, original-portrait fallback, and consistent targeting in both tables.
- Story tests cover normal sidebar navigation and availability of every game character. Browser checks also cover switching players during a reaction and disabling unavailable sequences.
- Family asset tests require every family character to have all three registered sheets and readable generation prompts.
- The [browser regression check](avatar-animation-browser-check.js) reproduces the original internal-clipping failure and verifies full-frame rendering, sixteen positions over two seconds, and neutral white frame backgrounds. Paste it into the preview's browser console, run `await checkAvatarAnimation()`, and repeat after selecting another family player.
- Browser inspection covers all sixteen frame positions, two-second one-shot playback, repeated reactions, return to idle/turn, and desktop/mobile layout.
- Run the repository checks with `bun test`, `bun run typecheck`, and `bun run build`.

If running a production build while the dev server is open produces an outdated-dependency error, restart development with `bun run dev --force` and refresh the browser.
