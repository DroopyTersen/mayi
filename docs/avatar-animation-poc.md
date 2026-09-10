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

Each sequence contains **16 frames**. Turn loops last **4 seconds** (4 fps), except Jane and Hannah, whose approved turn loops retain **2 seconds** (8 fps). Lay-down and lay-off reactions last **2 seconds** (8 fps).

- **Turn:** a character's quiet thinking habit, looping while the player is active.
- **Lay down:** a character's distinct celebration.
- **Lay off:** a smaller gesture acknowledging a successful move.
- **Idle / reduced motion:** the original portrait.

The gestures follow the short descriptions in `app/ui/lobby/character.data.ts`:

| Character | Turn | Lay down | Lay off |
|---|---|---|---|
| Curt — experienced veteran | Folds his arms with a knowing smile | Thoughtful beard stroke | Playful finger wag |
| Kate — strategic planner | Adjusts her glasses and studies the table | Squares a card stack and taps it once | Raises one index finger |
| Andrew — quick reflexes | Light finger drumming with a steady gaze | Compact fist pump | Casual two-finger salute |
| Natalie — creative, loves surprises | Peeks over a card | Presents a theatrical card reveal | Palms-up shrug |
| Jane — calm under pressure | Relaxed breathing and slow blink | Excited little shoulder dance | Unhurried mug toast |
| Carter — playful little card shark | Eager shoulder wiggle | Two delighted claps | Proud thumbs-up |
| Hannah — warm and observant | Curious head tilt | Clasps her hands with a pleased smile | Hand to heart and a warm nod |
| Maggie & Theo — attentive dog duo | Slow, gentle nose nudge | Shared paw bump with cards | Gentle nose nudge |

Maggie & Theo remain together in their original overlapping arrangement. Their gestures use canine paws and head movement.

Each frame is a complete portrait on white. The browser displays the entire frame, cropped only at the outer circle, so cards and hands can cross the chest and chin without disappearing. The opaque frame covers the original SVG during playback; the original shows at rest or when reduced motion is requested.

The sheets use the original portraits as identity references. Small blinks, glances, head movements and expressions accompany the gestures while preserving the faces and clothing. The storybook keeps the original beside each animation for checking likeness.

Reactions use confirmed public activity and the acting player's ID, including when laying off onto another player's meld. Game-state and reconnect messages map activity IDs to the same player IDs used by the game view. History present on mount does not replay. Duplicate updates do not restart a reaction. A newer move replaces the current reaction, then playback returns to the current turn state after two seconds.

Images are static local assets; gameplay makes no image-generation requests. The game engine, rules, and model-provider behavior are unchanged. The dev state-injection harness currently omits avatar IDs, so use the preview or an ordinary lobby game to see the artwork.

## Assets and generation

The built-in image tool generated and revised the sheets using the existing family portraits. The full prompt set is in [avatar-animation-prompts.json](avatar-animation-prompts.json).
The `personalityRevision` records the initial character plans and generation requests. The later `feedbackRevision` records the pacing changes, approved clip reassignments, eye corrections, shoulder dance, and cards. Within each revision, `corrections` replace the initial request for the matching character and sequence.

There are 24 runtime assets in `public/avatars/animated/`, each a 512 × 512 atlas of sixteen 128 × 128 cells. Each family character has `<character-id>-turn.webp`, `<character-id>-lay-down.webp`, and `<character-id>-lay-off.webp`.

Export uses nearest-neighbor resizing and lossless WebP to preserve the white background and pixel-art palette. The source portraits remain untouched. Each character's three sheets preload when their avatar appears, so reactions do not wait for a first-use download.

The personality pass replaces the earlier shared gestures using the existing gameplay and storybook playback.

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
- The personality pass was visually compared with all eight original portraits at 96, 64, and 24 pixels. All 24 sheets were checked for sixteen complete cells, the intended gesture, stable character identity, and white backgrounds; browser checks cover all 384 frame positions and return to the turn loop.
- The [browser regression check](avatar-animation-browser-check.js) reproduces the original internal-clipping failure and verifies full-frame rendering, sixteen positions, duration, and neutral white backgrounds. Paste it into the preview's browser console and run `await checkAvatarAnimation()` for a two-second lay-down, or `await checkAvatarAnimation("turn", 4000)` for a four-second turn. Use `2000` for Jane and Hannah's turn loops.
- Browser inspection covers all sixteen frame positions, two-second one-shot playback, repeated reactions, return to idle/turn, and desktop/mobile layout.
- Run the repository checks with `bun test`, `bun run typecheck`, and `bun run build`.

If running a production build while the dev server is open produces an outdated-dependency error, restart development with `bun run dev --force` and refresh the browser.
