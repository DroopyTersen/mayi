# LayOff Dialog Layout Fix

**Date**: 2026-01-14
**Status**: Planned

## Problem

The LayOff dialog (desktop) should have a fixed-header layout where:
- Hand display stays fixed at top
- Melds section scrolls in the middle
- Cancel/Done buttons stay fixed at bottom

Currently, when there are many players/melds, the entire content scrolls together instead of just the melds section.

## Root Cause

`ResponsiveDrawer` wraps children in a div with `overflow-y-auto`:

```tsx
// ResponsiveDrawer.tsx line 65 (desktop)
<div className="py-4 flex-1 min-h-0 overflow-y-auto">{children}</div>

// Line 82 (mobile)
<div className="px-4 pb-4 flex-1 min-h-0 overflow-y-auto">{children}</div>
```

This creates nested scroll containers since `LayOffView` has its own internal scroll structure:

```tsx
<div className="flex flex-col flex-1 min-h-0">
  <div className="flex-shrink-0 pb-3 border-b">...hand (fixed)...</div>
  <div className="flex-1 overflow-y-auto py-3 min-h-0">...melds (scrolls)...</div>
  <div className="flex-shrink-0 pt-3 border-t">...buttons (fixed)...</div>
</div>
```

The outer `overflow-y-auto` wrapper can capture scroll events and cause the inner fixed header/footer to scroll away.

## Solution

Change `overflow-y-auto` to `overflow-hidden` in ResponsiveDrawer's content wrapper:

**File**: `app/ui/responsive-drawer/ResponsiveDrawer.tsx`

```diff
// Line 65 (desktop)
-<div className="py-4 flex-1 min-h-0 overflow-y-auto">{children}</div>
+<div className="py-4 flex-1 min-h-0 overflow-hidden">{children}</div>

// Line 82 (mobile)
-<div className="px-4 pb-4 flex-1 min-h-0 overflow-y-auto">{children}</div>
+<div className="px-4 pb-4 flex-1 min-h-0 overflow-hidden">{children}</div>
```

This lets child components manage their own scrolling while preventing content overflow.

## Impact

Views using ResponsiveDrawer:
- **LayDownView** - Has internal scroll, will work correctly
- **LayOffView** - Has internal scroll, will work correctly
- **DiscardView** - Compact layout, fits without scrolling
- **SwapJokerView** - Compact layout, fits without scrolling
- **OrganizeHandView** - Compact layout, fits without scrolling

## Testing

1. Run dev server: `bun run dev` → navigate to `/storybook`
2. Test LayOffView "Interactive Dialog (Many Melds)" story
3. Verify: Hand stays at top, melds scroll, buttons stay at bottom
4. Test LayDownView "Interactive Dialog (4 Melds)" story - same behavior
5. Verify other dialogs (Discard, SwapJoker, Organize) still work
