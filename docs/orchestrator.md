# CLI Adapter Architecture (formerly “Orchestrator”)

This repo follows a strict layering rule:

1. `docs/house-rules.md` is the source of truth.
2. **XState machines** in `core/engine/*` implement those rules.
3. `core/engine/game-engine.ts` is a **thin wrapper** around the machines (persistence + read model).
4. The CLI provides adapters/rendering only — it must not re-implement rules.

The old `cli/harness/orchestrator.ts` has been removed. Its responsibilities are now split cleanly between:

- **GameEngine** (core): authoritative rules + XState persistence/hydration
- **CliGameAdapter** (cli): CLI-friendly inputs + filesystem persistence + action log

---

## Key Types

### Game Snapshot (`core/engine/game-engine.types.ts`)

All CLI modes render from `GameSnapshot`:

- `phase`: `"ROUND_ACTIVE" | "RESOLVING_MAY_I" | "ROUND_END" | "GAME_END"`
- `turnPhase`: `"AWAITING_DRAW" | "AWAITING_ACTION" | "AWAITING_DISCARD"` (meaningful when `phase === "ROUND_ACTIVE"`)
- `awaitingPlayerId`: the player who must respond next (current player, or prompted player during May I resolution)
- `mayIContext`: populated when `phase === "RESOLVING_MAY_I"`
- `lastError`: machine-provided error message (CLI should display it, not revalidate)

### CLI Save Format (`cli/shared/cli.types.ts`)

CLI persistence is a single file per game:

- Path: `.data/<game-id>/game-state.json`
- Type: `CliGameSave` (version `"3.0"`)
- Contains `engineSnapshot` (XState persisted snapshot from GameEngine)

No backward compatibility is required. Deleting `.data/` is the supported “migration”.

---

## Key Files

| File | Responsibility |
|------|----------------|
| `core/engine/game.machine.ts` | Game lifecycle (6 rounds) |
| `core/engine/round.machine.ts` | Round lifecycle + May I resolution |
| `core/engine/turn.machine.ts` | Turn rules (draw → act → discard) |
| `core/engine/game-engine.ts` | Thin wrapper (commands + snapshot extraction + hydration) |
| `cli/shared/cli-game-adapter.ts` | CLI adapter (positions → IDs, save/load, action log) |
| `cli/harness/harness.render.ts` | Text/JSON rendering from `GameSnapshot` |
| `cli/play.ts` | CLI entry point (command mode + interactive mode launcher) |

---

## CLI Commands (command mode / harness)

```bash
# New game + list games
bun cli/play.ts new
bun cli/play.ts list

# Read state
bun cli/play.ts <game-id> status
bun cli/play.ts <game-id> status --json

# Turn flow
bun cli/play.ts <game-id> draw stock
bun cli/play.ts <game-id> draw discard
bun cli/play.ts <game-id> laydown "1,2,3" "4,5,6,7"
bun cli/play.ts <game-id> layoff <card-pos> <meld-number>
bun cli/play.ts <game-id> swap <meld-number> <joker-pos> <card-pos>
bun cli/play.ts <game-id> skip
bun cli/play.ts <game-id> discard <card-pos>

# May I (round-level resolution)
bun cli/play.ts <game-id> mayi <player-id>
bun cli/play.ts <game-id> allow
bun cli/play.ts <game-id> claim
```

Notes:
- There is no `pass` and no `continue`. Round transitions are automatic.
- `mayi <player-id>` can be attempted whenever the discard is exposed; the engine will ignore invalid calls.

---

## May I Resolution Model

May I is handled in `RoundMachine` as a dedicated `resolvingMayI` sub-state:

- `CALL_MAY_I` starts resolution and captures the exposed discard
- The engine computes `playersToCheck` (priority order) based on:
  - current player (only if they have not drawn from stock)
  - players after the current player up to the caller
  - skipping “down” players
- The engine prompts one player at a time (`awaitingPlayerId = playerBeingPrompted`)
- Each prompted player responds:
  - `ALLOW_MAY_I` → continue
  - `CLAIM_MAY_I` → they win immediately (blocking caller)
- Winner gets:
  - current player claim: discard as their normal draw (no penalty)
  - otherwise: discard + 1 penalty card from stock

The CLI’s job is only:
- initiating `mayi <player-id>`
- sending `allow` / `claim` when prompted
- rendering `mayIContext` so UIs can explain what is happening
