# Component Storybook

A lightweight, DIY component showcase system built directly into the app. No external dependencies like Storybook.js required.

## Quick Start

```bash
bun run dev
# Navigate to http://localhost:5173/storybook
```

## Architecture

```
app/storybook/
  StorybookLayout.tsx    # Main layout with sidebar navigation
  ViewportSimulator.tsx  # Responsive testing utilities
app/ui/
  component-name/
    ComponentName.tsx       # The component
    ComponentName.story.tsx # Story file showcasing the component
```

## Writing Stories

Create a `.story.tsx` file alongside your component:

```tsx
// app/ui/my-component/MyComponent.story.tsx
export function MyComponentStory() {
  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-bold">MyComponent</h1>
        <p className="text-muted-foreground mt-1">
          Brief description of the component.
        </p>
      </header>

      <section>
        <h2 className="text-lg font-semibold mb-3">Default</h2>
        <MyComponent />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">With Props</h2>
        <MyComponent variant="primary" />
      </section>
    </div>
  );
}
```

### Register the Story

Add it to `StorybookLayout.tsx`:

```tsx
import { MyComponentStory } from "~/ui/my-component/MyComponent.story";

const STORIES = [
  // ... existing stories
  { path: "my-component", label: "MyComponent", component: MyComponentStory },
];
```

## Viewport Testing

Use `ViewportSimulator` to test responsive behavior:

```tsx
import { ViewportSimulator, ViewportComparison } from "~/storybook/ViewportSimulator";

export function MyComponentStory() {
  return (
    <div className="space-y-10">
      {/* Interactive viewport switcher */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Responsive</h2>
        <ViewportSimulator defaultViewport="phone">
          <MyComponent />
        </ViewportSimulator>
      </section>

      {/* Side-by-side comparison at multiple sizes */}
      <section>
        <h2 className="text-lg font-semibold mb-3">All Viewports</h2>
        <ViewportComparison viewports={["phone", "tablet", "desktop"]}>
          <MyComponent />
        </ViewportComparison>
      </section>
    </div>
  );
}
```

### Available Viewports

| Viewport | Width | Description |
|----------|-------|-------------|
| `phone` | 375px | iPhone SE/Mini |
| `tablet` | 768px | iPad Mini |
| `desktop` | 1024px | Small laptop |
| `full` | 100% | Full width |

### Container Queries

The `ViewportSimulator` uses `container-type: inline-size`, so components using `@container` queries will respond to the simulated width.

## Fullscreen Stories

For testing full-page layouts without the sidebar:

```tsx
const STORIES = [
  {
    path: "my-fullscreen-test",
    label: "Fullscreen Test",
    component: MyFullscreenStory,
    fullscreen: true  // Renders without sidebar
  },
];
```

## Story Patterns

### Show Component States

```tsx
<section>
  <h2 className="text-lg font-semibold mb-3">States</h2>
  <div className="flex gap-4">
    <div className="text-center">
      <Button>Default</Button>
      <p className="text-xs text-muted-foreground mt-1">Default</p>
    </div>
    <div className="text-center">
      <Button disabled>Disabled</Button>
      <p className="text-xs text-muted-foreground mt-1">Disabled</p>
    </div>
  </div>
</section>
```

### Show Size Variants

```tsx
<section>
  <h2 className="text-lg font-semibold mb-3">Sizes</h2>
  <div className="flex gap-4 items-end">
    <div className="text-center">
      <PlayingCard size="sm" />
      <p className="text-xs text-muted-foreground mt-1">sm</p>
    </div>
    <div className="text-center">
      <PlayingCard size="md" />
      <p className="text-xs text-muted-foreground mt-1">md</p>
    </div>
    <div className="text-center">
      <PlayingCard size="lg" />
      <p className="text-xs text-muted-foreground mt-1">lg</p>
    </div>
  </div>
</section>
```

### Interactive Demos

```tsx
export function MyComponentStory() {
  const [value, setValue] = useState("initial");

  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">Interactive</h2>
      <MyComponent value={value} onChange={setValue} />
      <p className="text-xs text-muted-foreground mt-2">
        Current value: {value}
      </p>
    </section>
  );
}
```

## Current Components

The storybook includes stories for:

- **Layout**: GameView, LobbyView
- **Cards**: PlayingCard, HandDisplay, HandDrawer
- **Table**: MeldDisplay, DiscardPileDisplay, PlayerMeldsDisplay, TableDisplay
- **Status**: PlayersTableDisplay, GameHeader, ActivityLog
- **Actions**: ActionBar, ResponsiveDrawer
- **Views**: LayDownView, LayOffView, DiscardView, OrganizeHandView, SwapJokerView, MayIRequestView
