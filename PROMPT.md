# May I? Card Game App

We are working on implementing a card game app that allows families to play together over the internet.

## 0. Ground Yourself in Specs

Before any work, study the specifications:

- `@docs/house-rules.md` — game rules as played by the family
- `@docs/glossary.md` — terminology and data model
- `@specs/tech-design.md` — architecture and type definitions
- `@specs/implementation-plan.md` — phased build approach

Then review the `@backlog.md` file to understand the current state of the implementation, and what work is left to do.

Optionally, the following specs are available for reference if they are relevant to the task at hand:

- `@specs/xstate-draft.md` — state machine design. don't use this for the actual implementation, it's a draft. Search the web for latest docs, best practices and implementation examples.
- `@specs/command-line-ux.md` — CLI interface design. How the CLI app should look, feel and behave.

---

## 1. Your Task

Implement the May I? card game engine following the phased implementation plan. The phases are:

1. **Card Foundation** — types, deck, shuffle, deal, meld validation
2. **Minimal Playable Turn** — basic TurnMachine, simple CLI
3. **Contracts + Laying Down** — contract validation, lay down logic
4. **Laying Off + Going Out + Scoring** — extend turns, scoring
5. **Full Game Loop** — RoundMachine, GameMachine, 6-round flow
6. **May I Mechanic** — MayIWindowMachine, interrupt handling
7. **Joker Swapping** — swap joker from runs before laying down

You can stop after you have completed Phase 7 of /specs/implementation-plan.md

Work through these phases sequentially. Do NOT skip ahead. Each phase builds on the previous.

---

## 2. How to Work

### Pick Up Work from Backlog

1. Read `@Backlog.md` to find the current phase and available tasks
2. Choose ONE task to implement (the highest priority incomplete task)
3. If no tasks exist for the current phase, your job is to **break down the phase** into concrete tasks and update `@Backlog.md`
4. Before implementing, search the codebase to confirm the task is not already done

### Do the Work

1. Study relevant specs before writing code
2. Implement the task with tests (TDD whenever possible)
3. Run tests to verify your implementation. `bun run typecheck` to verify your types are correct. Never get lazy on types and use `any`.
4. If tests fail, fix them before moving on

### After Each Task

1. Run `bun test` to confirm all tests pass
2. Run `bun run typecheck` to verify your types are correct. Never get lazy on types and use `any`.
3. If applicable, play through the game manually using the CLI app.
4. Update `@backlog.md`:
   - Mark completed task as `[x]`
   - Add any new tasks you discovered
   - Note any blockers or questions
5. Commit your changes:
   ```bash
   git add -A
   git commit -m "feat(<scope>): <description>"
   git push
   ```

---

## 3. Backlog Management Rules

The `@backlog.md` is your source of truth. Keep it updated.

### Task States

- `[ ]` — Not started
- `[~]` — In progress (only ONE at a time)
- `[x]` — Complete
- `[!]` — Blocked (add note explaining why)

### When Breaking Down a Phase

If a phase has no tasks, break it down by:

1. Reading the phase description in `@specs/implementation-plan.md`
2. Reading relevant sections of `@specs/tech-design.md`
3. Creating concrete, testable tasks
4. Ordering tasks by dependency (what must exist first?)

### Discovering New Work

As you implement, you'll find things that need to be done. Add them to the backlog:

- Missing types? Add a task.
- Edge case not covered? Add a task.
- Spec unclear? Add a `[?]` question to the Questions section.

### Typechecking

Run `bun run typecheck` to verify your types are correct. In test file we can be lazy with typescript hacks like foo.bar!, but in real source could we should always code like a senior Typescript engineer. Strict types, no any's. No hacks like !.

## 4. Code Quality Rules

### Project Structure

```
/core
  /card       — Card types and utilities
  /meld       — Meld validation
  /engine     — XState machines and game logic
  index.ts    — Public exports

/cli
  index.ts    — CLI entry point
  renderer.ts — ASCII rendering
  input.ts    — Player input
  game-loop.ts — Orchestration

/specs        — All specification documents (READ ONLY)
```

### Testing

- Rely on TDD and Bun tests to guide your implementation. This gives us a quick, high confidence verification loop.
- Colocate tests next to the file they test.
- Test file goes next to source: `foo.ts` → `foo.test.ts`

### Types

- Follow type definitions in `@specs/tech-design.md` as much as possible. Don't treat it as gospel, it's a starting point.
- Derived properties (isWild, pointValue) are pure functions, not stored
- Use branded types for IDs where appropriate

### XState

- Follow machine designs in `@specs/Xstate_Code.md`
- Guards are pure functions
- Actions use `assign()` for state updates
- Machines are testable in isolation

---

## 5. Critical Rules

1. **ONE TASK PER LOOP** — Pick one thing, complete it, commit it.

2. **SEARCH BEFORE IMPLEMENTING** — Don't assume something doesn't exist. Use ripgrep/search to check.

3. **SPECS ARE TRUTH** — If your implementation doesn't match specs, the implementation is wrong.

4. **TESTS ARE BACKPRESSURE** — If tests fail, you're not done. Fix them.

5. **COMMIT FREQUENTLY** — Small, working commits. Every completed task = commit.

6. **UPDATE BACKLOG** — The backlog is how future-you knows what happened. Keep it current.

7. **NO PLACEHOLDERS** — Full implementations only. No `// TODO` stubs that break the game.

8. **CAPTURE LEARNINGS** — If you discover something important (edge case, spec clarification), document it in code comments or update specs.

9. **VERIFICATION** - Tests are the best and fastest way to verify your implementation. Use TDD whenever possible. However, in later phases we'll have a CLI version of of app you can invoke and play through to very the game actually works as expected. You should do both!

---

## 6. When Stuck

1. Re-read the relevant spec
2. Look at test fixtures for examples
3. Check if there's a simpler approach
4. If truly blocked, mark task as `[!]` with explanation and move to next task
5. Never spin endlessly — if 3 attempts fail, document and move on

---

## 7. Phase Completion Checklist

Before moving to the next phase:

1. All tasks for current phase are `[x]` complete
2. All tests pass (`bun test`)
3. Code matches specs
4. Backlog is updated with next phase breakdown
5. Create a git tag: `git tag v0.<phase>.0`

---

## 8. Remember

You are building a card game that a family will play together over the internet. The rules in `@docs/house-rules.md` are the real rules — this is how Grandma plays. Get it right.

The goal is a working game, not perfect code. Ship incrementally. Each phase should leave the codebase in a working state.

Now, read `@Backlog.md` and get to work.

REMEMBER! Do one thing at a time, find a good commit point and stop, commit, update Backlog.md and then end your turn. The next time we run we'll pick up where you left off.
