---
description: Use Bun instead of Node.js, npm, pnpm, or vite.
globs: "*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json"
alwaysApply: false
---

# Quick commands

```bash
# Install dependencies
bun install

# Run all tests
bun test

# Run specific test file
bun test core/card/utils.test.ts

# Type check
bun run typecheck

# Play the game via CLI (for testing)
bun cli/play.ts new
bun cli/play.ts status
```

## Game CLI

Two modes for playing:
- **Command mode** (for AI agents): See [docs/agent-game-harness.md](docs/agent-game-harness.md)
- **Interactive mode** (for humans): See [docs/interactive-mode.md](docs/interactive-mode.md)

```bash
bun cli/play.ts new           # Command mode
bun cli/play.ts --interactive # Interactive mode
```

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

We prefer TDD. Write tests first, then implement to make them pass.

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

### Bug Fixes

When fixing bugs or issues, **always try to write a failing test first** that reproduces the bug. This:
- Confirms you understand the bug
- Prevents regressions
- Documents the expected behavior
- Gives confidence the fix actually works

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
