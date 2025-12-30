---
description: Use Bun instead of Node.js, npm, pnpm, or vite.
globs: "*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json"
alwaysApply: false
---

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
