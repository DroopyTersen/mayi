# Orchestrator Split - Future Refactor Proposal

## Current State

`cli/harness/orchestrator.ts` (~1081 lines) is a monolith that mixes:
1. **Game engine logic** (state transitions, rules, validation)
2. **CLI-specific concerns** (persistence, action logging, rendering helpers)

## Proposed Split

### Option 1: Extract Pure Game Engine to Core

```
core/engine/
├── game.machine.ts        # Pure state machine (new)
├── game.actions.ts        # State transition implementations (new)
├── game.guards.ts         # Validation logic (new)
└── game.types.ts          # Extended types (existing)

cli/harness/
├── orchestrator.ts        # CLI wrapper around core engine (slimmed down)
├── harness.render.ts      # Rendering (existing)
└── harness.state.ts       # State helpers (existing)
```

**Benefits:**
- Core engine becomes reusable for web app / PartyKit
- Matches tech-design.md architecture vision
- Enables proper XState machine in core

**Drawbacks:**
- Major refactor (~500+ lines to move)
- Need to carefully separate concerns
- May break existing CLI functionality during transition

### Option 2: Keep Orchestrator, Extract Actions

```
cli/harness/
├── orchestrator.ts        # Main class (slimmed to ~400 lines)
├── orchestrator.actions.ts # Command handlers extracted
├── orchestrator.mayi.ts   # May I window logic extracted
├── orchestrator.round.ts  # Round management extracted
└── harness.render.ts      # Rendering (existing)
```

**Benefits:**
- Less disruptive refactor
- Orchestrator stays as CLI-specific coordinator
- Easier to understand individual pieces

**Drawbacks:**
- Doesn't move toward transport-agnostic core
- Still CLI-coupled

## Recommendation

For now: **Do nothing** (keep current monolith)

When building web app: **Option 1** - extract pure engine to core

The orchestrator works and has tests. Splitting it should be done when there's a concrete need (web app development) rather than speculatively.

## Code Analysis

### What Belongs in Core (Pure Game Logic)

Lines in orchestrator.ts that are pure game logic:
- `newGame()` - deck creation, dealing, initial state
- `drawFromStock()` / `drawFromDiscard()` - draw rules
- `layDown()` - contract validation, meld creation
- `layOff()` - layoff validation
- `swap()` - joker swap rules
- `discardCard()` - discard rules, turn advancement
- `handleWentOut()` - round end scoring
- May I window logic - priority, resolution

### What Should Stay in CLI

Lines that are CLI-specific:
- `loadGame()` / `save()` - file persistence
- `appendActionLog()` calls - CLI logging
- `getPersistedState()` - serialization for file storage
- `getStateView()` - rendering data extraction

## Implementation Notes

If splitting in the future:

1. **Create core/engine/game.machine.ts**
   - Pure state machine definition
   - No I/O, no persistence, no logging
   - Returns events/state changes

2. **Orchestrator becomes adapter**
   - Wraps core game machine
   - Adds CLI persistence layer
   - Adds action logging
   - Translates commands to machine events

3. **Web app uses same core**
   - PartyKit server wraps core machine
   - Different persistence (D1 instead of files)
   - Different logging (WebSocket broadcasts)

## Related Files

- `/Users/drew/code/mayi/specs/tech-design.md` - Original architecture vision
- `/Users/drew/code/mayi/core/engine/` - Existing core engine (XState machine stubs)
- `/Users/drew/code/mayi/cli/harness/orchestrator.ts` - Current implementation

---

*This document describes a future refactor. Current priority is CLI folder consolidation.*
