# May 12 Architecture Cleanup Todo

**Source:** Review of the last 24 hours of May I fixes and performance investigation.
**Goal:** Remove low-risk complexity introduced during the session while keeping behavior aligned to `docs/house-rules.md`.
**Constraint:** Skip changes that need profiler proof or broader UX decisions.

## Status

| # | Item | Status | Commit |
|---|------|--------|--------|
| 1 | Simplify May-I resolution activity logging | Done | `a3e26bf` |
| 2 | Separate share-card browser side effects from render state | Done | `ef8f675` |
| 3 | Extract connection heartbeat/liveness policy into pure helpers | Done | `38e136d` |
| 4 | Make action bar rendering data-driven | Done | `13f930f` |
| 5 | Share layoff target keyboard/click frame behavior | Done | `f890880` |
| 6 | Extract route-level game session view-state helpers | Done | `1510dd4` |
| 7 | Remove or relax custom memo comparators | Deferred | Needs profiler proof |

## Notes

- The memo comparator cleanup is intentionally deferred. It should be decided from an A/B Chrome Performance profile on a real hand interaction, not from code shape alone.
- The larger route/socket lifecycle split was skipped because it is higher risk than extracting pure formatting and notification state.
- All completed items were kept as atomic commits with focused tests.

## Verification

- `bun run typecheck`
- `bun test`
