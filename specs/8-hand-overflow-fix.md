# Spec: Hand Overflow on iPad with 15+ Cards

**Issue:** #8
**Type:** Bug
**Branch:** `bug/8-hand-overflow-on-ipad-with-15-cards`

---

## Problem

When a player has 15+ cards, the hand overflows the container on iPad (768px) because:
- Large cards are 96px wide with 40px overlap (56px visible per card)
- At 15 cards: 96 + 14 × 56 = 880px > 768px ❌

## Solution

CSS-only approach using:
1. **`data-hand-size` attribute** on container with values: `"normal"` | `"large"` | `"huge"`
2. **Container queries + data attribute selectors** for conditional overlap
3. **Inline style `--overlap-lg`** CSS variable to bridge Tailwind limitations

### Card Count Tiers

| Tier | Card Count | Attribute |
|------|------------|-----------|
| Normal | 1-14 | `data-hand-size="normal"` |
| Large | 15-20 | `data-hand-size="large"` |
| Huge | 21+ | `data-hand-size="huge"` |

### Overlap Matrix

| Container Width | Normal Hand | Large Hand (15-20) | Huge Hand (21+) |
|-----------------|-------------|-------------------|-----------------|
| < 400px (sm) | -ml-5 (20px) | -ml-6 (24px) | -ml-7 (28px) |
| 400-550px (md) | -ml-8 (32px) | -ml-8 (32px) | -ml-10 (40px) |
| >= 550px (lg) | -ml-10 (40px) | -ml-14 (56px) | -ml-16 (64px) |

### Math Verification (768px iPad with large cards @ 96px)

**Normal (14 cards):** 96 + 13 × 56 = 824px (fits with scrolling - but 14 is boundary)
**Large (20 cards) @ -ml-14:** 96 + 19 × 40 = 856px (still slightly over, but much better)
**Large (20 cards) @ -ml-16:** 96 + 19 × 32 = 704px ✅

Actually we need tighter overlap for large hands. Let's use:
- Large hands (15-20): -ml-14 at 550px+ (shows 40px per card)
- Huge hands (21+): -ml-[72px] at 550px+ (shows 24px per card)

### Implementation

Since Tailwind doesn't easily support `group-data-[...]:@[...]` combinations, we'll use a CSS variable approach:

```tsx
// Calculate overlap class based on card count for large containers
const getOverlapLg = (cardCount: number) => {
  if (cardCount > 20) return "-ml-[72px]"; // huge: 24px visible
  if (cardCount > 14) return "-ml-14";      // large: 40px visible
  return "-ml-10";                           // normal: 56px visible
};

// In component:
<div
  className="@container"
  data-hand-size={cards.length > 20 ? "huge" : cards.length > 14 ? "large" : "normal"}
>
  <div className="flex items-end">
    {cards.map((card, index) => (
      <div
        key={card.id}
        className={cn(
          index > 0 && [
            // Mobile (< 400px): mobile-friendly overlap
            "-ml-5",
            // Medium (400-550px): standard medium overlap
            "@[400px]:ml-0 @[400px]:-ml-8",
            // Large (550px+): dynamic based on hand size
            `@[550px]:ml-0 @[550px]:${getOverlapLg(cards.length)}`,
          ]
        )}
        style={{ zIndex: index }}
      >
        {/* card content */}
      </div>
    ))}
  </div>
</div>
```

**Wait**: Dynamic class names in Tailwind don't work well because they're not scanned at build time.

### Better Approach: Pre-defined Classes per Tier

Use THREE separate overlap class patterns, conditionally applied:

```tsx
// Overlap patterns for each hand size tier (all 3 container breakpoints)
const OVERLAP_NORMAL = "-ml-5 @[400px]:ml-0 @[400px]:-ml-8 @[550px]:ml-0 @[550px]:-ml-10";
const OVERLAP_LARGE = "-ml-6 @[400px]:ml-0 @[400px]:-ml-8 @[550px]:ml-0 @[550px]:-ml-14";
const OVERLAP_HUGE = "-ml-7 @[400px]:ml-0 @[400px]:-ml-10 @[550px]:ml-0 @[550px]:-ml-[72px]";

// In component:
const handSize = cards.length > 20 ? "huge" : cards.length > 14 ? "large" : "normal";
const overlapClass = {
  normal: OVERLAP_NORMAL,
  large: OVERLAP_LARGE,
  huge: OVERLAP_HUGE,
}[handSize];

// Then apply:
<div className={cn(index > 0 && overlapClass)}>
```

This works because all three class patterns exist in the source and Tailwind can scan them.

---

## Files to Modify

| File | Changes |
|------|---------|
| `app/ui/player-hand/HandDisplay.tsx` | Add hand size tiers, update overlap logic |
| `app/ui/player-hand/HandDisplay.story.tsx` | Add stories for 15, 20, 25 card hands |

## Implementation Sequence

1. Define overlap constants for each hand size tier
2. Add helper to determine hand size tier from card count
3. Update auto-size mode to use tier-based overlap
4. Add story test cases for large hands
5. Visual verification via storybook

## Verification Steps

| Step | Command | Expected |
|------|---------|----------|
| Type check | `bun run typecheck` | No errors |
| Unit tests | `bun test` | All pass |
| Build | `bun run build` | Success |
| Visual test | Storybook at `/storybook` | 15-20-25 card hands fit in 768px container |

## TDD Plan

This is primarily a CSS change without complex logic, so visual verification is the main test:

- [ ] Add story with 15 cards → verify fits in 768px (ViewportSimulator)
- [ ] Add story with 20 cards → verify fits in 768px
- [ ] Add story with 25 cards → verify fits in 768px (tighter overlap)
- [ ] Verify existing stories still look correct (no regression)

## Acceptance Criteria

- [ ] 15 cards fit on iPad portrait (768px) without overflow
- [ ] 20 cards fit on iPad portrait with acceptable overlap
- [ ] Each card has minimum 20-24px visible for touch target
- [ ] Existing small hand UX unchanged
- [ ] Works in both desktop and mobile views
