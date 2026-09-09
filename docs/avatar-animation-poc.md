# Family avatar animation proof of concept

Branch: `avatar-animation-poc`

## Try it locally

```sh
bun run dev
```

Open [the animation preview](http://localhost:5173/storybook/avatar-animation).
Choose Andrew or Jane, start or pause their turn, and play the lay-down or lay-off reaction.
The page compares the original portrait with the animation and shows both actual game sizes.

In a normal local game, select Andrew or Jane in the character picker. Their avatars animate in the meld area and player status table. Other characters keep their existing portraits.

## Behavior

Each sequence contains **16 frames at 8 fps**, lasting **2 seconds**.

- **Turn:** subtle shoulder motion and a blink, looping while the player is active.
- **Lay down:** a brief card-fan gesture and blink.
- **Lay off:** a small thumbs-up and wink.
- **Idle / reduced motion:** the original portrait.

Each frame is a complete portrait on white. The browser displays the entire frame, cropped only at the outer circle, so cards and hands can cross the chest and chin without disappearing. The opaque frame covers the original SVG during playback; the original shows at rest or when reduced motion is requested.

The revised sheets use the original portraits as identity references and limit facial movement to eyelids. Their likeness is generated artwork, so compare it with the originals before expanding the family set.

Reactions use confirmed public activity and the acting player's ID, including when laying off onto another player's meld. History present on mount does not replay. Duplicate updates do not restart a reaction. A newer move replaces the current reaction, then playback returns to the current turn state after two seconds.

No game engine, rule, server protocol, or model-provider behavior changes are required. Images are static local assets; gameplay makes no image-generation requests. The dev state-injection harness currently omits avatar IDs, so use the preview or an ordinary lobby game to see the artwork.

## Assets and generation

The built-in image tool generated and revised the sheets using the existing family portraits. The full prompt set is in [avatar-animation-prompts.json](avatar-animation-prompts.json).

Runtime assets, each a 512 × 512 atlas of sixteen 128 × 128 cells:

- `public/avatars/animated/andrew-turn.webp`
- `public/avatars/animated/andrew-lay-down.webp`
- `public/avatars/animated/andrew-lay-off.webp`
- `public/avatars/animated/jane-turn.webp`
- `public/avatars/animated/jane-lay-down.webp`
- `public/avatars/animated/jane-lay-off.webp`

Export uses nearest-neighbor resizing and lossless WebP to preserve the white background and pixel-art palette. The source portraits remain untouched. Each character's three sheets preload when their avatar appears, so reactions do not wait for a first-use download.

This remains a two-character art and interaction experiment.

## Verification

- Failing tests were written before the component and event integration, then brought to green.
- Tests cover acting-player identity, both lay-off positions, duplicate/history boundaries, the first confirmed event, original-portrait fallback, and consistent targeting in both tables.
- The [browser regression check](avatar-animation-browser-check.js) reproduces the original internal-clipping failure and verifies full-frame rendering, sixteen positions over two seconds, and neutral white frame backgrounds. Paste it into the preview's browser console, run `await checkAvatarAnimation()`, and repeat after selecting Jane.
- Browser inspection covers all sixteen frame positions, two-second one-shot playback, repeated reactions, return to idle/turn, and desktop/mobile layout.
- Run the repository checks with `bun test`, `bun run typecheck`, and `bun run build`.

If running a production build while the dev server is open produces an outdated-dependency error, restart development with `bun run dev --force` and refresh the browser.
