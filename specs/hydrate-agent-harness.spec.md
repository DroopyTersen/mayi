# Hydrate Agent Harness with Predefined Game State

## Problem Statement

When developing and testing gameplay features via the CLI agent harness, it's often necessary to validate behavior in very specific game scenarios. Currently, the only way to reach these scenarios is to:

1. Start a new game from round 1
2. Play through many turns (often with random chance)
3. Hope the desired conditions arise naturally

This is **slow, unreliable, and frustrating** for feature development.

### Example: Testing Wild Card Lay-off Position (specs/wild-layoff-position.spec.md)

To test whether a wild card can be laid off at the start vs end of a run, you need:
- A player who is already "down" (has laid down their contract)
- A run on the table that can be extended at both ends (e.g., 5♠ 6♠ 7♠ 8♠)
- A wild card (2 or Joker) in the player's hand
- It to be that player's turn, in the AWAITING_ACTION phase

Getting to this state naturally requires:
- Playing through multiple turns
- Getting lucky with dealt cards
- Making the right plays to go down
- Having the right table state when testing

This can take 10+ minutes per attempt, and may not even produce the exact scenario needed.

---

## Goal

Allow the CLI agent harness to be **started with a predefined game state**, similar to how tests use `PredefinedRoundState` to create deterministic scenarios.

```bash
# New command format
bun cli/play.ts new --scenario wild-layoff-test

# Or from a JSON file
bun cli/play.ts new --state ./scenarios/wild-layoff.json
```

---

## Current Implementation

### Test Fixtures (What Exists)

**File:** `core/engine/test.fixtures.ts`

The test suite already has robust infrastructure for creating specific game states:

```typescript
export interface PredefinedRoundState {
  hands: Card[][];              // Cards for each player (by position)
  stock: Card[];                // Stock pile
  discard: Card[];              // Discard pile (top card first)
  table?: Meld[];               // Melds on table (optional)
  playerDownStatus?: boolean[]; // Which players are down (optional)
}
```

Helper functions exist for common scenarios:
- `createBasicThreePlayerState()` - Standard dealt hands
- `createAboutToGoOutState()` - Player ready to complete contract
- `createPlayerDownState()` - Player already laid down, with melds on table
- `createCanGoOutState()` - Player can go out via lay-offs
- `createMayIScenarioState()` - Good discard for May I testing
- `createCanLayDownState()` - Player has valid contract melds

### Round Machine Integration

**File:** `core/engine/round.machine.ts`

The `RoundMachine` accepts `predefinedState` in its input:

```typescript
export interface RoundInput {
  roundNumber: RoundNumber;
  players: Player[];
  dealerIndex: number;
  predefinedState?: PredefinedRoundState;  // ← Bypasses random dealing
}
```

When `predefinedState` is provided, the `dealCards` action uses it instead of shuffling/dealing:

```typescript
dealCards: assign(({ context }) => {
  if (context.predefinedState) {
    const predefined = context.predefinedState;
    const playersWithHands = context.players.map((player, index) => ({
      ...player,
      hand: predefined.hands[index] ?? [],
      isDown: predefined.playerDownStatus?.[index] ?? player.isDown,
    }));
    return {
      players: playersWithHands,
      stock: predefined.stock,
      discard: predefined.discard,
      table: predefined.table ?? [],
    };
  }
  // ... normal random dealing
});
```

### What's Missing

1. **GameEngine doesn't expose predefinedState**: The public `GameEngine.createGame()` API doesn't accept a `predefinedState` option.

2. **GameMachine doesn't pass predefinedState to rounds**: Even if we added it to `createGame()`, the game machine would need to pass it through when spawning round machines.

3. **CLI has no way to specify a scenario**: The `bun cli/play.ts new` command only accepts `--players` and `--round` flags.

4. **No scenario file format**: There's no defined JSON schema for specifying a complete game scenario.

---

## Proposed Solution

### Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Scenario source | File path (JSON) | Flexible, shareable, version-controlled |
| Scope | Round-level hydration | Leverages existing `PredefinedRoundState` |
| Turn phase | Start at beginning of turn | Simplest; player draws first |
| Named scenarios | Optional built-in presets | Common test cases ready to use |

### Scenario File Format

```json
{
  "version": "1.0",
  "description": "Wild card lay-off position test",
  "players": ["Alice", "Bob", "Carol"],
  "round": 3,
  "dealerIndex": 0,
  "state": {
    "hands": [
      [
        { "rank": "2", "suit": "clubs" },
        { "rank": "3", "suit": "spades" },
        { "rank": "7", "suit": "hearts" }
      ],
      [
        { "rank": "5", "suit": "diamonds" },
        { "rank": "6", "suit": "diamonds" }
      ],
      [
        { "rank": "K", "suit": "hearts" },
        { "rank": "K", "suit": "diamonds" }
      ]
    ],
    "stock": [
      { "rank": "10", "suit": "hearts" },
      { "rank": "J", "suit": "hearts" }
    ],
    "discard": [
      { "rank": "4", "suit": "clubs" }
    ],
    "table": [
      {
        "type": "run",
        "cards": [
          { "rank": "5", "suit": "spades" },
          { "rank": "6", "suit": "spades" },
          { "rank": "7", "suit": "spades" },
          { "rank": "8", "suit": "spades" }
        ],
        "ownerId": "player-0"
      }
    ],
    "playerDownStatus": [true, false, false]
  }
}
```

Notes:
- Card IDs are auto-generated from rank/suit (e.g., `"5-spades"` or `"5-spades-0"` for duplicates)
- `ownerId` uses player index format (`player-0`, `player-1`, etc.)
- Jokers: `{ "rank": "JOKER", "suit": null }`

---

## Implementation Plan

### Phase 1: Core Engine Changes

#### 1.1 Extend GameEngine.createGame()

**File:** `core/engine/game-engine.ts`

```typescript
export interface CreateGameOptions {
  playerNames: string[];
  startingRound?: RoundNumber;
  gameId?: string;
  predefinedState?: PredefinedRoundState;  // NEW
}

static createGame(options: CreateGameOptions): GameEngine {
  // ... existing validation ...

  const actor = createActor(gameMachine, {
    input: {
      startingRound,
      predefinedState: options.predefinedState,  // Pass through
    },
  });
  // ...
}
```

#### 1.2 Pass predefinedState through GameMachine

**File:** `core/engine/game.machine.ts`

Update `GameMachineInput` to accept `predefinedState`:

```typescript
export interface GameMachineInput {
  startingRound?: RoundNumber;
  predefinedState?: PredefinedRoundState;  // NEW
}
```

When spawning the round actor, pass it through:

```typescript
spawnRound: assign({
  roundActor: ({ context, spawn }) =>
    spawn(roundMachine, {
      input: {
        roundNumber: context.currentRound,
        players: context.players,
        dealerIndex: context.dealerIndex,
        predefinedState: context.predefinedState ?? undefined,  // NEW
      },
    }),
}),
```

Note: `predefinedState` should only be used for the **first round** after creation. Subsequent rounds should deal normally.

### Phase 2: CLI Changes

#### 2.1 Add --state flag to 'new' command

**File:** `cli/play.ts`

```bash
bun cli/play.ts new --state ./scenarios/wild-layoff.json
```

Implementation:
```typescript
// Parse --state flag
const stateIdx = args.indexOf("--state");
let scenarioPath: string | undefined;
if (stateIdx !== -1) {
  scenarioPath = args[stateIdx + 1];
  if (!scenarioPath) {
    throw new Error("--state requires a file path");
  }
}

if (scenarioPath) {
  const scenario = loadScenario(scenarioPath);
  const state = adapter.newGameWithScenario(scenario);
  // ...
}
```

#### 2.2 Add scenario loading to CliGameAdapter

**File:** `cli/shared/cli-game-adapter.ts`

```typescript
newGameWithScenario(scenario: GameScenario): GameSnapshot {
  const predefinedState = scenarioToPredefinedState(scenario);

  const engine = GameEngine.createGame({
    gameId: generateGameId(),
    playerNames: scenario.players,
    startingRound: scenario.round,
    predefinedState,
  });
  // ... rest of newGame logic
}
```

#### 2.3 Add scenario file parsing

**File:** `cli/shared/cli-scenario.ts` (new file)

```typescript
export interface GameScenario {
  version: string;
  description?: string;
  players: string[];
  round: RoundNumber;
  dealerIndex?: number;
  state: {
    hands: CardSpec[][];
    stock: CardSpec[];
    discard: CardSpec[];
    table?: MeldSpec[];
    playerDownStatus?: boolean[];
  };
}

interface CardSpec {
  rank: Card["rank"];
  suit: Suit | null;
}

interface MeldSpec {
  type: "set" | "run";
  cards: CardSpec[];
  ownerId: string;
}

export function loadScenario(filePath: string): GameScenario {
  const content = Bun.file(filePath).text();
  const parsed = JSON.parse(content);
  return validateScenario(parsed);
}

export function scenarioToPredefinedState(scenario: GameScenario): PredefinedRoundState {
  // Convert CardSpec[] to Card[] with generated IDs
  // Convert MeldSpec[] to Meld[] with generated IDs
  // Return PredefinedRoundState
}
```

### Phase 3: Built-in Scenarios (Optional)

Add a `cli/scenarios/` directory with pre-built scenario files:

```
cli/scenarios/
  wild-layoff-both-ends.json    # Wild can go to start or end of run
  may-i-resolution.json         # Player 2 wants the discard
  about-to-go-out.json          # Player can win this turn
  stock-nearly-empty.json       # Tests reshuffle behavior
```

Access via shorthand:
```bash
bun cli/play.ts new --scenario wild-layoff-both-ends
```

---

## Test Cases

```typescript
describe("CLI with --state flag", () => {
  it("creates game with specified hands", () => {
    // Run CLI with --state flag
    // Verify player hands match scenario
  });

  it("creates game with melds on table", () => {
    // Verify table state matches scenario
  });

  it("respects playerDownStatus", () => {
    // Verify isDown flags are set correctly
  });

  it("rejects invalid scenario files", () => {
    // Missing required fields
    // Invalid card ranks/suits
    // Hand count doesn't match player count
  });
});
```

---

## Files to Modify

| File | Change Type | Priority |
|------|-------------|----------|
| `core/engine/game-engine.ts` | Add `predefinedState` to `CreateGameOptions` | P0 |
| `core/engine/game.machine.ts` | Pass `predefinedState` to round machine | P0 |
| `cli/shared/cli-scenario.ts` | New file: scenario parsing/validation | P1 |
| `cli/shared/cli-game-adapter.ts` | Add `newGameWithScenario()` method | P1 |
| `cli/play.ts` | Add `--state` and `--scenario` flags | P1 |
| `cli/scenarios/*.json` | Built-in scenario files | P2 |
| `docs/agent-game-harness.md` | Document new CLI flags | P2 |

---

## Open Questions

1. **Scenario for mid-turn state?**
   - Should scenarios be able to specify the current turn phase (e.g., AWAITING_DISCARD)?
   - Current proposal: Always start at beginning of turn (player must draw first)
   - Alternative: Allow `turnPhase` in scenario to start mid-turn

2. **Multi-round scenarios?**
   - Should scenarios be able to specify player scores from previous rounds?
   - Current proposal: Scores start at 0
   - Alternative: Allow `playerScores: number[]` in scenario

3. **Card ID generation strategy?**
   - Simple: `"5-spades"`, `"K-hearts"`, `"JOKER-0"`
   - Collision handling: Append index for duplicates (`"5-spades-0"`, `"5-spades-1"`)
   - Alternative: Allow explicit IDs in scenario file

4. **Scenario validation strictness?**
   - Should we validate that the scenario is "legal" (e.g., correct number of cards for round)?
   - Or allow "impossible" scenarios for edge case testing?

---

## Example Usage

### Testing Wild Card Position Selection

```bash
# Create scenario file
cat > /tmp/wild-layoff.json << 'EOF'
{
  "version": "1.0",
  "description": "Test wild lay-off at start vs end of run",
  "players": ["Alice", "Bob", "Carol"],
  "round": 1,
  "dealerIndex": 2,
  "state": {
    "hands": [
      [
        { "rank": "2", "suit": "clubs" },
        { "rank": "3", "suit": "spades" }
      ],
      [{ "rank": "5", "suit": "diamonds" }],
      [{ "rank": "K", "suit": "hearts" }]
    ],
    "stock": [
      { "rank": "10", "suit": "hearts" },
      { "rank": "J", "suit": "hearts" }
    ],
    "discard": [{ "rank": "4", "suit": "clubs" }],
    "table": [
      {
        "type": "run",
        "cards": [
          { "rank": "5", "suit": "spades" },
          { "rank": "6", "suit": "spades" },
          { "rank": "7", "suit": "spades" },
          { "rank": "8", "suit": "spades" }
        ],
        "ownerId": "player-0"
      }
    ],
    "playerDownStatus": [true, false, false]
  }
}
EOF

# Start game with scenario
bun cli/play.ts new --state /tmp/wild-layoff.json

# Game ID is printed, use it for subsequent commands
bun cli/play.ts abc123 status
bun cli/play.ts abc123 draw stock
bun cli/play.ts abc123 layoff 1 1 start   # Lay off 2♣ to meld 1 at START
bun cli/play.ts abc123 layoff 1 1         # Lay off 3♠ (natural card, position auto-determined)
```

---

## Future Considerations

- **Web UI scenario loading**: Allow scenarios to be loaded via the web app for testing
- **Snapshot export**: Add a command to export current game state as a scenario file
- **AI testing harness**: Use scenarios to benchmark AI player performance in specific situations
