# UI Components Implementation Plan

This document captures the plan for implementing the May I? web app UI components, including a "Storybook-like" component showcase for visual testing.

## Goals

1. Build a set of React components that render the game UI based on the UX spec (`specs/web-app-ux.md`)
2. Create a component showcase route (`/storybook/*`) for visual testing in isolation
3. Focus on presentation and responsiveness, not server integration or WebSocket wiring
4. Use container queries for responsive layouts within components

---

## Design Principles

From `specs/web-app-ux.md`:

- **Information-dense but friendly** — Show all relevant game state clearly
- **Always-visible state** — Players see table, players, hand, and actions without navigation
- **Explicit over clever** — Clear button taps and wizard flows, not drag-and-drop
- **Responsive, not separate** — Same information on all screen sizes, just compressed on mobile
- **Friendly aesthetic** — Family card game feel, not technical/terminal

---

## File Organization

```
app/
├── shadcn/                          # shadcn/ui components (managed by CLI)
│   ├── components/ui/
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── dialog.tsx               # Add when needed
│   │   └── drawer.tsx               # Add when needed (Vaul)
│   ├── lib/
│   │   └── utils.ts
│   └── hooks/                       # shadcn hooks if any
│
├── ui/                              # Our custom UI components
│   ├── shared/                      # Shared utilities (non-shadcn)
│   │   ├── ResponsiveDrawer.tsx     # Dialog on desktop, Drawer on mobile
│   │   └── useMediaQuery.ts         # Colocated hook
│   │
│   ├── game-table/                  # Table area components
│   │   ├── TableDisplay.tsx
│   │   ├── TableDisplay.story.tsx
│   │   ├── MeldDisplay.tsx
│   │   ├── MeldDisplay.story.tsx
│   │   ├── PlayerMeldsDisplay.tsx
│   │   ├── PlayerMeldsDisplay.story.tsx
│   │   ├── DiscardPileDisplay.tsx
│   │   └── DiscardPileDisplay.story.tsx
│   │
│   ├── player-hand/                 # Hand area components
│   │   ├── HandDisplay.tsx
│   │   ├── HandDisplay.story.tsx
│   │   └── useHandSelection.ts      # Colocated if needed
│   │
│   ├── playing-card/                # Card component
│   │   ├── PlayingCard.tsx
│   │   └── PlayingCard.story.tsx
│   │
│   ├── players-panel/               # Players info area
│   │   ├── PlayersTableDisplay.tsx
│   │   └── PlayersTableDisplay.story.tsx
│   │
│   ├── action-bar/                  # Bottom actions
│   │   ├── ActionBar.tsx
│   │   └── ActionBar.story.tsx
│   │
│   ├── activity-log/                # Activity log
│   │   ├── ActivityLog.tsx
│   │   └── ActivityLog.story.tsx
│   │
│   ├── game-header/                 # Header
│   │   ├── GameHeader.tsx
│   │   └── GameHeader.story.tsx
│   │
│   ├── lay-down/                    # Lay down view
│   │   ├── LayDownView.tsx
│   │   ├── LayDownView.story.tsx
│   │   ├── MeldStagingArea.tsx      # Sub-component
│   │   └── useMeldBuilder.ts        # Colocated hook
│   │
│   ├── lay-off/                     # Lay off view
│   │   ├── LayOffView.tsx
│   │   └── LayOffView.story.tsx
│   │
│   ├── discard/                     # Discard view
│   │   ├── DiscardView.tsx
│   │   └── DiscardView.story.tsx
│   │
│   ├── organize-hand/               # Organize hand view
│   │   ├── OrganizeHandView.tsx
│   │   └── OrganizeHandView.story.tsx
│   │
│   ├── swap-joker/                  # Swap joker view
│   │   ├── SwapJokerView.tsx
│   │   └── SwapJokerView.story.tsx
│   │
│   └── may-i-request/               # May I request dialog
│       ├── MayIRequestView.tsx
│       └── MayIRequestView.story.tsx
│
├── storybook/                       # Component showcase
│   ├── StorybookLayout.tsx          # Layout with sidebar nav
│   └── StorybookIndex.tsx           # Landing page / overview
│
├── routes/
│   ├── home.tsx
│   ├── game.$roomId.tsx
│   └── storybook.tsx                # Splat route handler
│
└── routes.ts                        # Add splat route for storybook
```

---

## Coding Conventions

### File Naming
- PascalCase file names matching the component name
- Example: `PlayingCard.tsx` exports `export function PlayingCard() {}`

### Exports
- Use **named exports**, not default exports
- File name matches the named export

### Story Files
- Use dot notation: `PlayingCard.story.tsx`
- Export a single component that renders multiple instances/states

### Imports
- shadcn components: `import { Button } from "~/shadcn/components/ui/button"`
- Custom UI: `import { PlayingCard } from "~/ui/playing-card/PlayingCard"`

---

## Responsive Breakpoints

| Name | Width | Use Case |
|------|-------|----------|
| Phone | 375px | iPhone SE, small Android |
| Tablet Portrait | 768px | iPad portrait |
| Tablet Landscape | 1024px | iPad landscape |
| Desktop | 1280px+ | Laptops, monitors |

### Container Queries (Not Media Queries)

Use Tailwind's container query syntax for component-level responsiveness:

```tsx
// Parent: mark as container
<div className="@container">
  {/* Children: respond to container width, not viewport */}
  <div className="flex flex-col @md:flex-row @lg:gap-4">
    ...
  </div>
</div>
```

This allows components to be responsive even when rendered in modals or constrained spaces.

---

## Component Specifications

### PlayingCard

Single playing card display.

```tsx
interface PlayingCardProps {
  card: Card;                    // From core/card/card.types.ts
  size?: "sm" | "md" | "lg";
  selected?: boolean;
  onClick?: () => void;
}
```

**Visual:**
- Rank and suit displayed
- Red text for hearts/diamonds, black for clubs/spades
- "JKR" for Jokers
- Selected state: highlighted border or background

**Sizes:**
- `sm`: ~48x68px (for melds, discard pile)
- `md`: ~64x90px (default, hand cards)
- `lg`: ~80x112px (featured display)

---

### HandDisplay

Player's hand as fanned/overlapping cards.

```tsx
interface HandDisplayProps {
  cards: Card[];
  selectedIds?: Set<string>;
  onCardClick?: (cardId: string) => void;
}
```

**Visual:**
- Cards overlap horizontally (negative margin)
- Horizontal scroll on mobile if needed
- Selected cards visually distinct

---

### DiscardPileDisplay

Discard pile with stack effect.

```tsx
interface DiscardPileDisplayProps {
  topCard: Card | null;
}
```

**Visual:**
- Top card fully visible
- 2-3 cards visible behind (offset) to show it's a pile

---

### MeldDisplay

Single meld (set or run).

```tsx
interface MeldDisplayProps {
  meld: Meld;                    // From core/meld/meld.types.ts
  label?: string;                // "Set" or "Run"
}
```

**Visual:**
- Cards in tight horizontal row (less overlap than hand)
- Optional label showing meld type

---

### PlayerMeldsDisplay

All melds for one player.

```tsx
interface PlayerMeldsDisplayProps {
  playerName: string;
  melds: Meld[];
}
```

**Visual:**
- Player name as header
- Each meld rendered below with type label
- Bordered container grouping

---

### TableDisplay

All melds on the table grouped by player.

```tsx
interface TableDisplayProps {
  melds: Meld[];
  players: { id: string; name: string }[];
}
```

**Visual:**
- Groups melds by `ownerId`
- Renders `PlayerMeldsDisplay` for each player with melds
- Shows "No melds" for players without melds (optional)

---

### PlayersTableDisplay

Table showing all players' status.

```tsx
interface PlayersTableDisplayProps {
  players: Array<{
    id: string;
    name: string;
    cardCount: number;
    isDown: boolean;
    score: number;
    isCurrentPlayer: boolean;
  }>;
  currentPlayerId: string;
}
```

**Visual:**
- Table with columns: Name, Cards, Down?, Score
- Current player row highlighted
- Checkmark for "down", dash for "not down"

---

### ActionBar

Bottom action buttons that change based on game phase.

```tsx
interface ActionBarProps {
  phase: "draw" | "action" | "waiting";
  isYourTurn: boolean;
  isDown: boolean;
  hasDrawn: boolean;
  canMayI: boolean;
  onAction: (action: string) => void;
}
```

**Buttons by phase:**
- **draw phase**: [Draw Stock] [Pick Up Discard]
- **action phase (not down)**: [Lay Down] [Discard]
- **action phase (down)**: [Lay Off] [Discard]
- **waiting (not your turn)**: [May I?] (if eligible)
- Always available: [Organize]

---

### ActivityLog

Recent game activity list.

```tsx
interface ActivityLogProps {
  entries: Array<{
    id: string;
    message: string;
    timestamp?: string;
  }>;
}
```

**Visual:**
- Last 5-6 entries
- Simple text list
- Optional timestamps

---

### GameHeader

Round information header.

```tsx
interface GameHeaderProps {
  round: number;
  totalRounds: number;
  contract: { sets: number; runs: number };
}
```

**Visual:**
- "MAY I? — Round 2 of 6 — 1 set + 1 run"

---

### ResponsiveDrawer (Shared)

Dialog on desktop, bottom drawer on mobile.

```tsx
interface ResponsiveDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
}
```

Uses `useMediaQuery` hook to determine screen size and renders either shadcn Dialog or Drawer (Vaul).

---

### View Components

All views use `ResponsiveDrawer` as their container and `@container` queries for internal layout.

#### LayDownView
Wizard for laying down contract melds.
- Shows staging areas for required melds (based on contract)
- Tap card → add to selected meld
- Real-time validation per meld
- Submit button disabled until all melds valid

#### LayOffView
Add cards to existing table melds (only when down).
- Shows all table melds
- Tap card in hand → tap meld to add
- Validation on attempt

#### DiscardView
Select card to discard.
- Shows hand
- Tap card to discard and end turn

#### OrganizeHandView
Reorder/sort hand.
- Manual reorder with left/right buttons
- Sort by rank button
- Sort by suit button

#### SwapJokerView
Swap natural card for Joker in run.
- Shows runs with Jokers
- Shows which natural card would replace
- Tap to swap

#### MayIRequestView
Blocking prompt when someone calls May I.
- Shows who wants to May I and which card
- [Allow] [May I Instead] buttons
- Optional timeout indicator

---

## Storybook Route

### Route Configuration

```ts
// app/routes.ts
import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("game/:roomId", "routes/game.$roomId.tsx"),
  route("storybook/*", "storybook/StorybookLayout.tsx"),
] satisfies RouteConfig;
```

### StorybookLayout

```tsx
// app/storybook/StorybookLayout.tsx
import { useParams, Link, Outlet } from "react-router";

const STORIES = [
  { path: "playing-card", label: "PlayingCard" },
  { path: "hand-display", label: "HandDisplay" },
  { path: "discard-pile", label: "DiscardPileDisplay" },
  { path: "meld-display", label: "MeldDisplay" },
  { path: "table-display", label: "TableDisplay" },
  { path: "players-table", label: "PlayersTableDisplay" },
  { path: "action-bar", label: "ActionBar" },
  { path: "activity-log", label: "ActivityLog" },
  { path: "game-header", label: "GameHeader" },
  { path: "responsive-drawer", label: "ResponsiveDrawer" },
  { path: "lay-down-view", label: "LayDownView" },
  { path: "lay-off-view", label: "LayOffView" },
  { path: "discard-view", label: "DiscardView" },
  { path: "organize-hand-view", label: "OrganizeHandView" },
  { path: "may-i-request-view", label: "MayIRequestView" },
];

export function StorybookLayout() {
  const params = useParams();
  const currentPath = params["*"] || "";

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <nav className="w-64 border-r p-4 overflow-y-auto">
        <h1 className="font-bold mb-4">Components</h1>
        <ul className="space-y-1">
          {STORIES.map((story) => (
            <li key={story.path}>
              <Link
                to={`/storybook/${story.path}`}
                className={currentPath === story.path ? "font-bold" : ""}
              >
                {story.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Content */}
      <main className="flex-1 p-6 overflow-y-auto">
        {/* Dynamically render story based on path */}
        <StoryContent path={currentPath} />
      </main>
    </div>
  );
}
```

### Story File Pattern

Each `.story.tsx` exports a component rendering multiple instances:

```tsx
// app/ui/playing-card/PlayingCard.story.tsx
import { PlayingCard } from "./PlayingCard";

export function PlayingCardStory() {
  return (
    <div className="space-y-8">
      <section>
        <h3 className="text-sm font-semibold mb-2">Sizes</h3>
        <div className="flex gap-4 items-end">
          <PlayingCard card={{ id: "1", rank: "K", suit: "hearts" }} size="sm" />
          <PlayingCard card={{ id: "2", rank: "K", suit: "hearts" }} size="md" />
          <PlayingCard card={{ id: "3", rank: "K", suit: "hearts" }} size="lg" />
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-2">Suits</h3>
        <div className="flex gap-2">
          <PlayingCard card={{ id: "1", rank: "9", suit: "hearts" }} />
          <PlayingCard card={{ id: "2", rank: "9", suit: "diamonds" }} />
          <PlayingCard card={{ id: "3", rank: "9", suit: "clubs" }} />
          <PlayingCard card={{ id: "4", rank: "9", suit: "spades" }} />
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-2">Special Cards</h3>
        <div className="flex gap-2">
          <PlayingCard card={{ id: "1", rank: "Joker", suit: null }} />
          <PlayingCard card={{ id: "2", rank: "2", suit: "clubs" }} />
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-2">States</h3>
        <div className="flex gap-2">
          <PlayingCard card={{ id: "1", rank: "A", suit: "spades" }} />
          <PlayingCard card={{ id: "2", rank: "A", suit: "spades" }} selected />
        </div>
      </section>
    </div>
  );
}
```

---

## Implementation Order

Suggested order based on dependencies:

1. **PlayingCard** — Foundation component, no dependencies
2. **HandDisplay** — Uses PlayingCard
3. **MeldDisplay** — Uses PlayingCard
4. **DiscardPileDisplay** — Uses PlayingCard
5. **PlayerMeldsDisplay** — Uses MeldDisplay
6. **TableDisplay** — Uses PlayerMeldsDisplay
7. **PlayersTableDisplay** — Standalone table
8. **GameHeader** — Standalone header
9. **ActivityLog** — Standalone list
10. **ActionBar** — Standalone buttons
11. **ResponsiveDrawer** — Shared container for views
12. **DiscardView** — Simple view (uses HandDisplay, PlayingCard)
13. **OrganizeHandView** — Uses HandDisplay
14. **LayOffView** — Uses HandDisplay, TableDisplay
15. **SwapJokerView** — Uses PlayingCard, MeldDisplay
16. **LayDownView** — Most complex (uses PlayingCard, MeldStagingArea)
17. **MayIRequestView** — Uses PlayingCard

---

## Testing Plan

For each component, test at these viewport sizes using Chrome extension:

| Breakpoint | Width | Height |
|------------|-------|--------|
| Phone | 375px | 667px |
| Tablet Portrait | 768px | 1024px |
| Tablet Landscape | 1024px | 768px |
| Desktop | 1280px | 800px |

### What to Verify
- Visual appearance matches mockups
- Container query breakpoints trigger correctly
- Text is readable at all sizes
- Interactive elements are tappable (min 44x44px on mobile)
- No horizontal overflow/scroll issues
- Selected/highlighted states are visible

---

## Dependencies to Add

```bash
# For ResponsiveDrawer (if not already installed)
bunx shadcn@latest add dialog
bunx shadcn@latest add drawer
```

---

## Open Questions (Resolved)

1. ~~Light vs Dark Mode~~ → Light theme matching mockups
2. ~~Component naming~~ → TypeName + "Display" suffix when needed
3. ~~Storybook route structure~~ → Splat route with sidebar nav
4. ~~Mode components~~ → Using "View" suffix (LayDownView, etc.)
5. ~~Responsive approach~~ → Container queries, not media queries

---

## References

- [UX Specification](./web-app-ux.md)
- [Mockups](./mockups/)
- [Tailwind Container Queries](https://tailwindcss.com/docs/responsive-design)
- [shadcn/ui Drawer](https://ui.shadcn.com/docs/components/drawer)
- [React Router Splat Routes](https://reactrouter.com/api/framework-conventions/routes.ts)
