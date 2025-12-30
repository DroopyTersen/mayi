# Orchestrator → CLI Adapter Refactor Plan (House-Rules-First, XState-First)

This plan exists to keep the architecture aligned to `docs/house-rules.md` (the gospel truth) and to eliminate duplicated “game logic” living in the CLI.

**Primary outcome:** the CLI becomes a thin adapter + renderer around `core/engine/game-engine.ts`, and the old CLI “orchestrator” logic is removed.

---

## Scope Decisions (locked)

- **No backwards compatibility for saved games.** Delete `.data/` when needed.
- **CLI command surface can change.** Tests + docs must be updated together.
- **TDD required** (see `CLAUDE.md`): add failing tests first for behavioral changes.

---

## Target Layering (non‑negotiable)

1. **House rules → XState machines** (`core/engine/*`)
   - Rules (validation + effects) must be enforced by guards/actions in machines.
2. **GameEngine is thin** (`core/engine/game-engine.ts`)
   - Sends events, persists/hydrates XState snapshots, extracts `GameSnapshot`.
   - Must not duplicate house-rule logic.
3. **CLI adapter is thinner** (`cli/shared/cli-game-adapter.ts`)
   - Maps CLI-friendly inputs → engine IDs/events.
   - Owns filesystem persistence for CLI (`.data/...`).
   - Owns action logging for CLI.
   - Must not implement rules/validation beyond basic input parsing (e.g. “position out of range”).
4. **Renderers/UI are pure** (`cli/harness/harness.render.ts`, `cli/interactive/*`)
   - Render from `GameSnapshot` only; do not invent phases/rules.

---

## What Was Wrong With `cli/harness/orchestrator.ts`

The orchestrator had drifted into a second engine:

- It implemented turn/phase logic that already exists in XState machines.
- It encoded an outdated “May I window after stock draw” model that conflicted with `docs/house-rules.md` section 7.
- It forced duplicated persistence shapes (and duplicated tests) that didn’t match the new `GameEngine` snapshot model.

This refactor removes that duplication by making `GameEngine` + the XState machines the only rule source.

---

## New Architecture (after refactor)

```
cli/play.ts
  ├─ uses → CliGameAdapter (cli/shared/cli-game-adapter.ts)
  │    ├─ loads/saves → CliGameSave (v3.0) to .data/<gameId>/game-state.json
  │    ├─ appends → .data/<gameId>/game-log.jsonl
  │    └─ wraps → GameEngine (core/engine/game-engine.ts)
  │         └─ wraps → XState actor (core/engine/game.machine.ts → round.machine.ts → turn.machine.ts)
  └─ renders via → cli/harness/harness.render.ts (text + json)
```

---

## CLI Save Format (v3.0)

- File: `.data/<game-id>/game-state.json`
- Type: `CliGameSave` in `cli/shared/cli.types.ts`
- Contains:
  - `engineSnapshot`: XState persisted snapshot from `GameEngine.getPersistedSnapshot()`
  - metadata (`gameId`, `createdAt`, `updatedAt`)

**Migration policy:** delete `.data/` when changing formats.

---

## Detailed Work Plan (with execution status)

### Phase 1 — Make the engine authoritative (no CLI rule logic)

**Goal:** the engine snapshot must expose enough info for the CLI to render without re-validating rules.

Completed:
- [x] **May I resolution moved to RoundMachine** (`core/engine/round.machine.ts`)
  - Engine phase now includes `RESOLVING_MAY_I`.
  - `mayIContext` is extracted from round-level `mayIResolution`.
- [x] **GameEngine exposes `lastError`** (`core/engine/game-engine.types.ts`, `core/engine/game-engine.ts`)
  - CLI displays errors rather than re-implementing validation.
- [x] **Player ownership enforcement** for turn events (`core/engine/turn.machine.ts`)
  - “Wrong player” actions are ignored by guards; errors are recorded.

Verification:
- `bun test core/engine/roundMachine.mayI.test.ts`
- `bun test core/engine/game-engine.xstate.test.ts`

---

### Phase 2 — Replace Orchestrator with a CLI Adapter

**Goal:** delete `cli/harness/orchestrator.ts` and replace with a small adapter around GameEngine.

Completed:
- [x] Added `cli/shared/cli-game-adapter.ts`
  - Wraps `GameEngine`
  - Handles persistence (`saveGameSave` / `loadGameSave`)
  - Maps CLI positions → card IDs
  - Supports May I flow via `callMayI(callerId)`, `allowMayI()`, `claimMayI()`
  - Appends action log entries for gameplay commands
- [x] Deleted `cli/harness/orchestrator.ts` and its tests

Verification:
- `bun test cli/shared/cli-game-adapter.test.ts`

---

### Phase 3 — Unify CLI harness + interactive mode on the same adapter

**Goal:** both modes drive the same `CliGameAdapter` and render from `GameSnapshot`.

Completed:
- [x] Harness renderer updated to use `GameSnapshot` (`cli/harness/harness.render.ts`)
  - Displays `RESOLVING_MAY_I` and `lastError`
- [x] Interactive mode migrated to `CliGameAdapter` (`cli/interactive/interactive.ts`)
  - Handles May I resolution prompts (`allow` / `claim`)
  - Offers the human player a “May I?” prompt at the start of AI turns

Verification:
- Manual: `bun cli/play.ts --interactive`

---

### Phase 4 — Update AI tooling + prompts (new May I model)

**Goal:** AI logic must match `GameSnapshot` phases and May I resolution mechanics.

Completed:
- [x] Tools updated to `allow_may_i` / `claim_may_i` only (`ai/mayIAgent.tools.ts`)
- [x] Prompt updated to remove `MAY_I_WINDOW` + `pass` (`ai/mayIAgent.prompt.ts`)
- [x] AI agent uses `CliGameAdapter` + `GameSnapshot` (`ai/mayIAgent.ts`)

Verification:
- `bun test ai/mayIAgent.llm.test.ts`

---

### Phase 5 — Update CLI command surface + docs

**Goal:** no docs/tests mention removed commands or phases.

Completed:
- [x] CLI commands updated (`cli/play.ts`)
  - Removed: `pass`, `continue`
  - Added: `allow`, `claim`
  - `mayi` now requires explicit caller: `mayi <player-id>`
- [x] Docs updated (`docs/*.md`)
  - Removed references to `MAY_I_WINDOW`, `pass`, `continue`, and the old orchestrator
  - Updated architecture docs to reflect `CliGameAdapter` + `GameEngine`
- [x] `CLAUDE.md` CLI examples updated

Verification:
- `rg -n "MAY_I_WINDOW|pass\\b|continue\\b|cli/harness/orchestrator" docs`

---

### Phase 6 — Quality gates

Completed:
- [x] Tests: `bun test`
- [x] Typecheck: `bun run typecheck`

Environment note:
- In this environment, every shell command prints:
  - `/opt/homebrew/Library/Homebrew/cmd/shellenv.sh: line 18: /bin/ps: Operation not permitted`
  - This does not prevent `bun test` / `bun run typecheck` from succeeding.

---

## Files You Should Read First (junior-dev friendly)

1. `docs/house-rules.md` (rules)
2. `core/engine/round.machine.ts` (May I resolution + discard exposure rules)
3. `core/engine/game-engine.ts` (thin wrapper + snapshot extraction)
4. `cli/shared/cli-game-adapter.ts` (CLI adapter responsibilities)
5. `cli/harness/harness.render.ts` (rendering from `GameSnapshot`)

---

## Future Follow-ups (optional)

- Allow AI to make proactive out-of-turn May I calls (would require a separate “May I decision” loop; `executeTurn` intentionally only acts when awaited).
- Remove legacy/unused engine helpers under `core/engine/*` that predate the XState engine (only if confirmed unused outside tests).
