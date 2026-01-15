---
description: Use Bun instead of Node.js, npm, pnpm, or vite.
globs: "*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json"
alwaysApply: false
---

# Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | [Bun](https://bun.sh) |
| Web Framework | [React Router 7](https://reactrouter.com) + Vite |
| Deployment | [Cloudflare Workers](https://developers.cloudflare.com/workers/) |
| Realtime | [PartyKit](https://partykit.io) (WebSockets via `partyserver`) |
| State Machine | [XState v5](https://stately.ai/docs) |
| AI | [Vercel AI SDK](https://sdk.vercel.ai) (Anthropic, OpenAI, Google, xAI) |
| UI Components | [shadcn/ui](https://ui.shadcn.com) (new-york style) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com) |
| Component Primitives | [Radix UI](https://radix-ui.com) |
| Icons | [Lucide React](https://lucide.dev) |
| Validation | [Zod](https://zod.dev) |

## Project Structure

```
app/           Web app (React Router, deployed to Cloudflare Workers)
  routes/      Page routes
  ui/          Game-specific UI components (PlayingCard, HandDisplay, etc.)
  storybook/   DIY component showcase (no external deps)
  shadcn/      shadcn/ui components (Button, Card, Input, etc.)
  party/       PartyServer WebSocket rooms
  workers/     Cloudflare Worker entry point
core/          Game engine (cards, melds, XState machines)
cli/           CLI harness and interactive mode
ai/            LLM-powered AI players
docs/          Documentation
specs/         Design specs and plans
```

# Quick commands

```bash
# Install dependencies
bun install

# Run all tests (fast, skips integration tests)
bun test

# Run specific test file
bun test core/card/utils.test.ts

# Run integration tests (makes real LLM API calls, slow)
RUN_INTEGRATION_TESTS=1 bun test ai/

# Type check
bun run typecheck

# Play the game via CLI (for testing)
bun cli/play.ts new
# Use the printed game ID (or run list)
bun cli/play.ts list
bun cli/play.ts <game-id> status
```

## Game CLI

Two modes for playing:
- **Command mode** (for AI agents): See [docs/agent-game-harness.md](docs/agent-game-harness.md)
- **Interactive mode** (for humans): See [docs/interactive-mode.md](docs/interactive-mode.md)

```bash
bun cli/play.ts new           # Command mode
bun cli/play.ts --interactive # Interactive mode
```

## Testing with Custom Game States

For testing specific scenarios, create a game state file directly to bypass random dealing:

```bash
# Create test directory and state file
mkdir -p .data/my-test
# Write game-state.json with desired state

# Load and play from that state
bun cli/play.ts my-test status
bun cli/play.ts my-test draw stock
```

See [docs/agent-game-harness.md](docs/agent-game-harness.md#custom-test-states) for complete format documentation.

# Build

bun run build
Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Bun automatically loads .env, so don't use dotenv.

## Typescript

Run `bun run typecheck` to verify your types are correct. In test file we can be lazy with typescript hacks like foo.bar!, but in real source could we should always code like a senior Typescript engineer. Strict types, no any's. No hacks like !.

## Testing

### ⚠️ MANDATORY: Test-Driven Development (TDD)

**ALWAYS write a failing test FIRST before writing ANY implementation code. No exceptions.**

When a bug is reported or a feature is requested:
1. **STOP.** Do NOT touch implementation code yet.
2. **Write a failing test** that reproduces the bug or specifies the new behavior.
3. **Run the test** to confirm it fails (red).
4. **Only then** write the implementation to make it pass (green).
5. **Refactor** if needed while keeping tests green.

**Even if the fix seems "obvious" — write the test first.**

This is critical because:
- Confirms you actually understand the problem before solving it
- Prevents regressions forever
- Documents expected behavior as executable specifications
- Gives confidence the fix actually works
- Often reveals edge cases or misunderstandings early

**If you skip writing a test first, you are doing it wrong. Go back and write the test.**

### Test Runner

Use `bun test` as the test runner. It is Jest-compatible and supports TypeScript natively.

- Run specific tests surgically: `bun test <path-to-test-file>`
- Colocate tests with source files (e.g., `foo.ts` and `foo.test.ts`)

### Writing Tests

```ts
import { describe, it, expect } from "bun:test";

describe("feature", () => {
  it("should do something", () => {
    expect(true).toBe(true);
  });
});
```

### No Mocking

- Never use spies, mocks, stubs, or any form of mocking unless explicitly requested
- Avoid `jest.mock`, `sinon`, or Bun's `mock()` function without direct instructions
- Prefer integration tests that verify real behavior over mocked unit tests

### TDD Workflow

1. Write a failing test that describes the desired behavior
2. Implement the minimum code to make the test pass
3. Refactor while keeping tests green
4. Repeat

### Bug Fixes — TEST FIRST, NO EXCEPTIONS

When fixing bugs: **STOP. Write a failing test FIRST.**

Do NOT:
- Jump straight to reading implementation code
- Start "exploring" where the bug might be
- Write a fix and then add a test after

DO:
1. Write a test that fails because of the bug
2. Run it, see it fail
3. Only then fix the code
4. Run the test, see it pass

This applies even if you think you know exactly what's wrong. The test comes first.

## File Naming

Avoid generic file names like `types.ts`, `utils.ts`, `helpers.ts`, or `constants.ts`. Prefix with the domain even if the parent folder already indicates it:

- `card/card.types.ts` not `card/types.ts`
- `game/game.utils.ts` not `game/utils.ts`
- `player/player.constants.ts` not `player/constants.ts`

Why: Makes cmd+p / ctrl+p file finding useful. Searching "card types" finds `card.types.ts` but not `types.ts`.

## No Barrel Files

Never create barrel files (`index.ts` files that re-export from multiple files).

- Never create `index.ts` files that use `export * from` or `export { ... } from`
- Import directly from the specific file path instead of relying on barrel exports
- Use direct imports: `import { foo } from "./foo"` instead of `import { foo } from "."`

Why: Barrel files create circular import issues, hurt tree-shaking, slow build times, and break IDE tooling.

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.md`.

## Command Execution

- Never run commands with long timeouts that cause waiting/blocking
- If a test suite is large or slow, run specific tests with `--test-name-pattern` instead of the whole file
- Prefer `| head -N` to limit output rather than waiting for full completion

## UI Components with shadcn/ui

**Reference**: https://ui.shadcn.com/llms.txt

shadcn/ui is a collection of reusable components built on Radix UI and Tailwind CSS. Components are copied into the codebase (not installed as a package), making them fully customizable.

### Adding Components

```bash
bunx shadcn@latest add button    # Add a component
bunx shadcn@latest add card input # Add multiple components
```

Components are installed to `app/shadcn/components/ui/`.

### Using shadcn Components

```tsx
import { Button } from "~/shadcn/components/ui/button";
import { Card } from "~/shadcn/components/ui/card";
import { cn } from "~/shadcn/lib/utils";  // For merging class names

// Use the cn() utility to merge Tailwind classes
<Button className={cn("my-custom-class", conditionalClass && "active")}>
  Click me
</Button>
```

### Component Organization

- **`app/shadcn/`** — shadcn/ui base components (Button, Card, Input, etc.)
- **`app/ui/`** — Game-specific components built on top of shadcn (PlayingCard, HandDisplay, etc.)

Game components in `app/ui/` should:
1. Import shadcn primitives from `~/shadcn/components/ui/`
2. Use the `cn()` utility from `~/shadcn/lib/utils` for class merging
3. Follow the same patterns as shadcn (variants via CVA, composable APIs)

### Component Storybook

A lightweight DIY component showcase at `/storybook` (no Storybook.js dependency). Each component in `app/ui/` has a colocated `.story.tsx` file.

```bash
bun run dev
# Navigate to http://localhost:5173/storybook
```

See [docs/component-storybook.md](docs/component-storybook.md) for writing stories and using the ViewportSimulator.

### Configuration

The `components.json` at project root configures shadcn:
- Style: `new-york`
- Aliases: `~/shadcn/components`, `~/shadcn/lib/utils`
- CSS: `app/app.css`
- Icons: `lucide`

## Web App Development

### Running the Dev Server

```bash
bun run dev      # Start React Router dev server
bun run build    # Build for production
bun run preview  # Preview production build
bun run deploy   # Deploy to Cloudflare Workers
```

### Type Generation

```bash
bun run cf-typegen  # Generate Cloudflare + React Router types
bun run typecheck   # Full type check
```

### PartyKit WebSockets

WebSocket rooms are defined in `app/party/`. The worker entry point (`app/workers/app.ts`) routes WebSocket upgrades to PartyServer before falling through to React Router.

```tsx
// Client-side connection
import PartySocket from "partysocket";

const socket = new PartySocket({
  host: window.location.host,
  room: "my-room-id",
  party: "mayi-room",
});
```

### Agent Web Testing Harness

For testing AI agents through the web UI, use the agent harness routes (dev mode only).

```bash
# Start the dev server
bun run dev

# Quick start: auto-creates a 3-player game (1 human + 2 Grok AI)
# Open in browser: http://localhost:5173/game/agent/new

# Custom state: inject a specific game situation for testing
# 1. Create your AgentTestState JSON
# 2. Base64url encode it
# 3. Navigate to: http://localhost:5173/game/agent/state/<encoded-state>
```

**Key routes:**
- `/game/agent/new` — Quick start with default 3-player game
- `/game/agent/state/:state` — Inject custom game state (base64url-encoded JSON)

**Custom state example (agent about to lay down):**
```javascript
const state = {
  players: [
    { id: "agent", name: "Agent", isAI: false, hand: [...], isDown: false },
    { id: "ai-1", name: "Grok-1", isAI: true, aiModelId: "default:grok", hand: [...], isDown: false },
    { id: "ai-2", name: "Grok-2", isAI: true, aiModelId: "default:grok", hand: [...], isDown: false },
  ],
  roundNumber: 1,
  stock: [...],
  discard: [...],
  table: [],
  turn: { currentPlayerIndex: 0, hasDrawn: true, phase: "awaitingAction" }
};
// Encode: btoa(JSON.stringify(state)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
```

See [docs/agent-web-testing.md](docs/agent-web-testing.md) for complete format documentation, validation rules, and the WebSocket protocol.
