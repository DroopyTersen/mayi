# May I? — Backlog

> Last updated: [Ralph updates this timestamp with each commit]

Run `bun run typecheck` to verify your types are correct. In test file we can be lazy with typescript hacks like foo.bar!, but in real source could we should always code like a senior Typescript engineer. Strict types, no any's. No hacks like !.

## Phase 1 Tasks (Card Foundation)

> Card types, deck creation, shuffle, deal, meld validation

- [x] Card utility functions (`isWild`, `isNatural`, `getPointValue`)
- [x] Deck creation (`createDeck`)
- [x] Shuffle function (`shuffle`)
- [x] Deal function (`deal`)
- [x] Review specs/phase1-tests.md and scaffold out all tests (72 todo tests in meld.validation.test.ts)
- [x] Helper functions: `countWildsAndNaturals`, `wildsOutnumberNaturals`
- [x] Set validation (`isValidSet`)
- [x] Run validation (`isValidRun`)
- [x] Rank ordering utilities (`getRankValue`) — needed for run validation
- [x] Joker position identification (`identifyJokerPositions`, `canSwapJokerWithCard`)
- [x] Run extension helpers (`canExtendRun`, `canExtendSet`)
- [x] Hand scoring (`calculateHandScore`)

---

## Phase 2 Tasks (Minimal Playable Turn)

> GameState, Player, TurnState types; stripped-down TurnMachine; hand reordering; basic CLI rendering

- [x] Review specs/phase-2-tests.md and scaffold out all tests (149 todo tests)
- [x] Implement `GameState`, `Player`, `TurnState` types (`core/engine/engine.types.ts`)
- [x] Implement `createInitialGameState` function

### Engine Types (25 tests in engine.types.test.ts)

- [x] Implement `GameState structure` tests (8 tests)
- [x] Implement `Player structure` tests (5 tests)
- [x] Implement `TurnState structure` tests (3 tests)
- [x] Implement `createInitialGameState` tests (9 tests)

### TurnMachine (47 tests in turn.machine.test.ts)

- [x] Create TurnMachine XState machine
- [x] Implement TurnMachine initial state tests (5 tests)
- [x] Implement DRAW_FROM_STOCK command (7 tests)
- [x] Implement DRAW_FROM_DISCARD command (10 tests)
- [x] Implement DISCARD command (13 tests)
- [x] Implement invalid command handling (6 tests)
- [x] Implement turn output (5 tests)
- [x] Fix typecheck errors

### Hand Reordering (28 tests in hand.reordering.test.ts)

- [x] Implement REORDER_HAND command basic functionality (5 tests)
- [x] Ensure REORDER_HAND works in any turn state (5 tests)
- [x] Implement sort by rank functionality (3 tests)
- [x] Implement sort by suit functionality (3 tests)
- [x] Implement move single card functionality (3 tests)
- [x] Implement validation for reorder command (6 tests)
- [x] Handle edge cases (3 tests)
- [x] Fix typecheck errors

### Game Loop (17 tests in game.loop.test.ts)

- [x] Fix typecheck errors
- [x] Implement turn advancement (4 tests)
- [x] Implement state transfer between turns (4 tests)
- [x] Implement initial game setup (4 tests)
- [x] Implement multiple consecutive turns (5 tests)
- [x] Fix typecheck errors

### CLI Renderer (21 tests in cli.renderer.test.ts)

Review specs/command-line-interface.md

- [x] Implement `renderCard` function (9 tests)
- [x] Implement `renderHand` function (3 tests)
- [x] Implement `renderNumberedHand` function (3 tests)
- [x] Implement `renderGameState` function (6 tests)
- [x] Fix typecheck errors

### CLI Input (11 tests in cli.input.test.ts)

- [x] Implement `parseDrawCommand` function (3 tests)
- [x] Implement `parseDiscardCommand` function (4 tests)
- [x] Implement `parseReorderCommand` function (4 tests)
- [x] Fix typecheck errors

### Overall Rule Verification

- [x] Review the /specs/house-rules.md and make sure everything we've implemented is valid according to the rules.

---

## Phase 3 Tasks (Contracts + Laying Down)

> Break down when Phase 2 is complete

- [x] Fix typecheck errors
- [x] Review specs/phase-3-tests.md and scaffold out all tests (283 todo tests)

### Contract Definitions (30 tests in contracts.test.ts)

- [x] Implement CONTRACTS constant (8 tests)
- [x] Implement getContractForRound function (2 tests)
- [x] Implement minimum cards per contract calculation (6 tests)
- [x] Implement validateContract function - correct number of melds (12 tests)
- [x] Implement meld type verification (4 tests)
- [x] Implement card usage validation (3 tests)
- [x] Fix typecheck errors

### Lay Down Command (95 tests in laydown.test.ts)

- [x] Implement drawn state structure (3 tests)
- [x] Implement proceeding without laying down (4 tests)
- [x] Implement LAY_DOWN preconditions (5 tests)
- [x] Implement successful lay down - Round 1 (7 tests)
- [x] Implement successful lay down - Round 2 (4 tests)
- [x] Implement successful lay down - Round 3 (3 tests)
- [x] Implement successful lay down - Round 4 (3 tests)
- [x] Implement successful lay down - Round 5 (2 tests)
- [x] Implement successful lay down - Round 6 (2 tests)
- [x] Fix typecheck errors
- [x] Implement melds with wilds validation (7 tests)
- [x] Implement larger than minimum melds (5 tests)
- [x] Implement card removal from hand (5 tests)
- [x] Implement meld ownership (3 tests)
- [x] Implement wrong number of melds rejection (5 tests)
- [x] Implement invalid individual melds rejection (8 tests)
- [x] Implement card not in hand rejection (4 tests)
- [x] Implement duplicate card usage rejection (2 tests)
- [x] Fix typecheck errors
- [x] Implement already down rejection (3 tests)
- [x] Implement auto-transition to awaitingDiscard (3 tests)
- [x] Implement turn end after laying down (2 tests)
- [ ] Implement cannot lay off on same turn (3 tests) — requires Phase 4 (LAY_OFF command)
- [x] Implement cannot lay down again (2 tests)
- [x] Implement discard after laying down (4 tests)
- [x] Implement turn output reflects lay down (3 tests)
- [x] Fix typecheck errors

### Table Management (17 tests in table.test.ts)

- [x] Fix typecheck errors
- [x] Implement table initial state (2 tests)
- [x] Implement table after first player lays down (3 tests)
- [x] Implement table after multiple players lay down (4 tests)
- [x] Implement table persistence across turns (3 tests)
- [x] Fix typecheck errors
- [x] Implement isDown initial state (2 tests)
- [x] Implement isDown after laying down (3 tests)
- [x] Implement multiple players down tracking (3 tests)
- [ ] Implement round transition isDown reset (1 test) — requires Phase 4+ (round transitions)
- [x] Fix typecheck errors

### Guards (39 tests in guards.test.ts)

- [x] Implement notDownYet guard (3 tests)
- [x] Implement meetsContract guard - round 1 (5 tests)
- [x] Implement meetsContract guard - round 2 (5 tests)
- [x] Fix typecheck errors
- [x] Implement meetsContract guard - round 3 (3 tests)
- [x] Implement meetsContract guard - round 4 (3 tests)
- [x] Implement meetsContract guard - round 5 (3 tests)
- [x] Implement meetsContract guard - round 6 (3 tests)
- [x] Fix typecheck errors
- [x] Implement validMelds guard (5 tests)
- [x] Implement wildsNotOutnumbered guard (4 tests)
- [x] Implement canLayDown composite guard (3 tests)
- [x] Fix typecheck errors

### Lay Down Actions (17 tests in laydown.actions.test.ts)

- [x] Implement hand modification (5 tests)
- [x] Implement table modification (5 tests)
- [x] Implement player state modification (2 tests)
- [x] Implement meld creation (4 tests)
- [x] Fix typecheck errors

### Integration Tests (58 tests in laydown.integration.test.ts)

- [x] Implement round 1 successful lay down flow (8 tests)
- [x] Implement round 2 lay down with wilds (4 tests)
- [x] Implement player chooses not to lay down (7 tests)
- [x] Implement player cannot lay down - missing cards (5 tests)
- [x] Implement multiple turns with lay down (7 tests)
- [x] Fix typecheck errors
- [x] Implement edge case: laying down maximum cards (4 tests)
- [x] Implement edge case: laying down leaves exactly 1 card (5 tests)
- [x] Implement edge case: contract validation prevents over-laying (4 tests)
- [x] Implement edge case: wilds across multiple melds (5 tests)
- [x] Implement edge case: concentrated wilds invalid (5 tests)
- [x] Implement edge case: same rank from multiple decks (4 tests)
- [x] Fix typecheck errors

### CLI Lay Down (19 tests in cli.laydown.test.ts)

> Review specs/command-line-ux.md and make sure we've implemented everything we need to for the cli gameplay

- [x] Implement parseLayDownInput card selection syntax (6 tests)
- [x] Implement meld type inference (3 tests)
- [x] Implement input validation (4 tests)
- [x] Fix typecheck errors
- [x] Implement alternative syntaxes (1 test)
- [x] Implement lay down confirmation flow (5 tests)
- [x] Fix typecheck errors

---

## Phase 4 Tasks (Laying Off + Going Out + Scoring)

> 664 todo tests scaffolded across 6 test files

- [x] Review specs/phase-4-tests.md and scaffold out all tests
- [x] Fix typecheck errors

### Layoff Command (91 tests in layoff.test.ts)

- [x] Implement canLayOffCard guard preconditions (4 tests)
- [x] Implement laying off to sets (6 tests)
- [x] Implement laying off to sets - wild ratio edge cases (6 tests)
- [x] Implement laying off to runs (8 tests)
- [x] Implement run extension boundaries (8 tests)
- [x] Implement laying off to runs - wild ratio edge cases (7 tests)
- [x] Implement card ownership for lay off (5 tests)
- [x] Implement meld ownership - anyone can add to any meld (4 tests)
- [x] Implement LAY_OFF action - successful lay off to set (6 tests)
- [x] Implement LAY_OFF action - successful lay off to run (10 tests)
- [x] Implement multiple lay offs in one turn (7 tests)
- [x] Implement state transitions after lay off (4 tests)
- [x] Implement LAY_OFF rejection - player state (7 tests)
- [x] Implement LAY_OFF rejection - invalid card (2 tests)
- [x] Implement LAY_OFF rejection - invalid meld (2 tests)
- [x] Implement LAY_OFF rejection - card doesn't fit (4 tests)
- [x] Implement LAY_OFF rejection - wild ratio (2 tests)
- [x] Fix typecheck errors

### Going Out (176 tests in goingOut.test.ts)

- [x] Implement going out general rules - definition (4 tests)
- [x] Implement going out general rules - must be down (4 tests)
- [x] Implement going out general rules - paths to going out (5 tests)
- [x] Implement going out rounds 1-5 - via discard (4 tests)
- [x] Implement going out rounds 1-5 - via lay off (5 tests)
- [x] Implement going out rounds 1-5 - sequence via discard (4 tests)
- [x] Implement going out rounds 1-5 - sequence via lay off (3 tests)
- [x] Implement going out rounds 1-5 - player choice (4 tests)
- [x] Implement going out rounds 1-5 - wentOut trigger (4 tests)
- [x] Implement round 6 special rules - normal turns still have discard (4 tests)
- [x] Implement round 6 special rules - cannot discard to go out (4 tests)
- [x] Implement round 6 special rules - must lay off (4 tests)
- [x] Implement round 6 special rules - cannot discard last card (4 tests)
- [x] Implement round 6 special rules - stuck with unlayable card (7 tests)
- [x] Implement round 6 special rules - normal turn with discard (6 tests)
- [x] Implement round 6 special rules - discard allowed with 2+ cards (3 tests)
- [x] Implement GO_OUT command (8 tests)
- [x] Implement GO_OUT with multiple lay offs (4 tests)
- [x] Implement GO_OUT rejected scenarios (5 tests)
- [x] Implement round 6 stuck scenarios (17 tests)
- [x] Implement not down scenarios (14 tests)
- [x] Implement going out on lay down turn (18 tests)
- [x] Implement going out turn output (8 tests)
- [x] Fix typecheck errors

### Scoring (97 tests in scoring.test.ts)

- [x] Implement calculateHandScore - empty hand (2 tests)
- [x] Implement calculateHandScore - number cards (8 tests)
- [x] Implement calculateHandScore - face cards (4 tests)
- [x] Implement calculateHandScore - aces (3 tests)
- [x] Implement calculateHandScore - wild cards (5 tests)
- [x] Implement calculateHandScore - mixed hand totals (8 tests)
- [x] Implement calculateHandScore - realistic hands (5 tests)
- [x] Implement calculateHandScore - worst case hands (5 tests)
- [x] Implement calculateHandScore - edge cases (3 tests)
- [x] Implement calculateRoundScores (11 tests)
- [x] Implement updateTotalScores (14 tests)
- [x] Implement determineWinner (21 tests)
- [x] Fix typecheck errors

### Round End (64 tests in roundEnd.test.ts)

- [x] Implement round end trigger (7 tests)
- [x] Implement round end processing (6 tests)
- [x] Implement RoundRecord (8 tests)
- [x] Implement round transition - to next round (14 tests)
- [x] Implement round transition - to game end (6 tests)
- [x] Implement state reset details (10 tests)
- [x] Fix typecheck errors

### Turn Machine Phase 4 Additions (97 tests in turn.machine.phase4.test.ts)

- [x] Implement drawn state with lay off (12 tests)
- [x] Implement wentOut state (13 tests)
- [x] Implement turnComplete vs wentOut (9 tests)
- [x] Implement round 6 specific behavior (24 tests)
- [x] Implement going out detection (12 tests)
- [x] Implement player not down behavior (11 tests)
- [x] Fix typecheck errors

### Phase 4 Integration Tests (139 tests in phase4.integration.test.ts)

- [x] Implement complete lay off turn flow (21 tests)
- [x] Implement going out scenarios - rounds 1-5 (21 tests)
- [x] Implement going out scenarios - round 6 (31 tests)
- [x] Implement scoring integration (19 tests)
- [x] Implement edge cases (17 tests)
- [x] Fix typecheck errors

### Phase 3 Deferred Tests (4 tests)

> These tests were deferred from Phase 3 because they require Phase 4 functionality

- [x] Implement cannot lay off on same turn (3 tests in laydown.test.ts)
- [x] Implement round transition isDown reset (1 test in table.test.ts)

---

## Phase 5 Tasks (Full Game Loop)

> GameMachine, RoundMachine, dealing, turn/dealer advancement, stock depletion, 6-round flow

- [x] Review specs/phase-5-tests.md and scaffold out all tests (367 todo tests across 8 files)
- [x] Fix typecheck errors

### GameMachine (66 tests in gameMachine.test.ts)

- [x] Implement setup state - initial state (6 tests)
- [x] Implement ADD_PLAYER command (5 tests)
- [x] Implement player limits (3 tests)
- [x] Implement START_GAME command (4 tests)
- [~] Implement START_GAME rejected scenarios (4/5 tests done, 1 todo - error message)
- [x] Implement initializePlayers action (4 tests)
- [x] Implement playing state - entering (2/3 tests, 1 todo - RoundMachine spawning)
- [x] Implement RoundMachine input (3 tests)
- [x] Implement round completion (4 tests)
- [x] Implement roundHistory update (3 tests)
- [x] Implement roundEnd state - game continuation (4 tests)
- [x] Implement incrementRound action (3 tests)
- [x] Implement advanceDealer action (4 tests)
- [x] Implement game end condition (3 tests)
- [x] Implement gameEnd state (4 tests)
- [x] Implement calculateFinalScores action (3 tests)
- [x] Implement final state output (4 tests)
- [x] Implement guards - hasMinPlayers, isGameOver (6 tests)
- [x] Implement context preservation (7 tests)

### RoundMachine (76/85 tests passing, 9 todos)

- [x] Implement initialization - context from input (9 tests)
- [x] Implement first player calculation (3 tests)
- [x] Implement player state reset (3 tests)
- [x] Implement dealing state - entry actions (3 tests)
- [x] Implement dealCards action (5 tests)
- [x] Implement deck configuration (5 tests)
- [x] Implement flipFirstDiscard action (3 tests)
- [x] Implement post-deal state (4 tests)
- [~] Implement active state structure (1/2 tests, 1 todo - TurnMachine spawning)
- [x] Implement TurnMachine invocation (7 tests)
- [~] Implement turn completion - normal (3/4 tests, 1 todo - TurnMachine spawning)
- [x] Implement turn completion - went out (4 tests)
- [x] Implement advanceTurn action (3 tests)
- [x] Implement state updates from turn (5 tests)
- [x] Implement scoring state (2 tests)
- [x] Implement scoreRound action (3 tests)
- [x] Implement RoundRecord creation (3 tests)
- [~] Implement output (2/3 tests, 1 todo - integration)
- [~] Implement stock depletion - detection (1/2 tests, 1 todo - integration)
- [~] Implement reshuffleStock action (2/4 tests, 2 todos)
- [~] Implement reshuffle scenario (0/3 tests, 3 todos)
- [x] Implement guards - wentOut, stockEmpty (5 tests)

### Dealing (33 tests in dealing.test.ts)

- [x] Implement createDeckForPlayerCount - 3-5 players (3 tests)
- [x] Implement createDeckForPlayerCount - 6-8 players (3 tests)
- [x] Implement boundary cases (4 tests)
- [x] Implement deal - card distribution (4 tests)
- [x] Implement dealing order (3 tests)
- [x] Implement remaining cards (2 tests)
- [x] Implement card integrity (4 tests)
- [x] Implement flipFirstDiscard (3 tests)
- [x] Implement initial round state - all player counts (6 tests)

### Turn Advancement (20 tests in turnAdvancement.test.ts)

- [x] Implement clockwise rotation (4 tests)
- [x] Implement wrap-around (2 tests)
- [x] Implement formula verification (2 tests)
- [x] Implement full rotation (2 tests)
- [x] Implement first player each round (3 tests)
- [x] Implement dealer rotation between rounds (4 tests)
- [x] Implement full game dealer rotation (3 tests)

### Round Transition (18 tests in roundTransition.test.ts)

- [x] Implement state reset for new round (5 tests)
- [x] Implement preserved state (4 tests)
- [x] Implement round number progression (2 tests)
- [x] Implement contract progression (1 test)
- [x] Implement score accumulation (2 tests)
- [x] Implement round end to round start flow (4 tests)

### Stock Depletion (18 tests, 4 todos in stockDepletion.test.ts)

- [x] Implement detection during draw (2 tests)
- [x] Implement guard check (1 test)
- [x] Implement reshuffleStock action - basic operation (4 tests)
- [x] Implement preserves top discard (3 tests)
- [x] Implement shuffle randomization (2 tests)
- [x] Implement card integrity (2 tests)
- [~] Implement mid-round reshuffle scenario (1/3 tests, 2 todos - TurnMachine integration)
- [x] Implement discard pile size (2 tests)
- [~] Implement edge cases (2/3 tests, 1 todo - game rule edge case)

### Game End (19 tests in gameEnd.test.ts)

- [x] Implement game end trigger (4 tests)
- [x] Implement final score calculation (2 tests)
- [x] Implement determineWinner - single winner (2 tests)
- [x] Implement determineWinner - ties (4 tests)
- [x] Implement determineWinner - perfect game (1 test)
- [x] Implement gameEnd output (6 tests)

### Phase 5 Integration Tests (70 pass, 11 todo in fullGame.test.ts)

- [x] Implement full game flow - setup to end (4 tests)
- [x] Implement round 1 flow (3 tests)
- [x] Implement full 6 rounds (1 test)
- [x] Implement score accumulation through game (1 test)
- [x] Implement single round flow (4 tests)
- [x] Implement turn sequencing within round (2 tests)
- [x] Implement dealer and first player tracking (3 tests)
- [x] Implement state persistence between turns (7 tests)
- [x] Implement edge cases (6 tests, 1 todo)
- [~] Implement contract enforcement per round (6 todos - future phase)
- [x] Implement complete game simulation (6 tests)
- [x] Implement game state at each phase (8 tests)
- [x] Implement roundHistory completeness (7 tests)
- [x] Implement error handling (11 tests)

> IMPORTANT: Make sure to verify the game works as expected by playing through it manually using the CLI app.

---

## Phase 6 Tasks (May I Mechanic)

> 309 todo tests scaffolded across 8 test files

- [x] Review specs/phase-6-tests.md and scaffold out all tests

### MayIWindowMachine (75 tests in mayIWindow.test.ts) ✓

- [x] Implement initialization - context from input (10 tests)
- [x] Implement initial state (4 tests)
- [x] Implement open state - current player takes discard (5 tests)
- [x] Implement open state - current player draws from stock (4 tests)
- [x] Implement open state - other player calls May I (3 tests)
- [x] Implement open state - multiple players call May I (2 tests)
- [x] Implement open state - current player vetoes (4 tests)
- [x] Implement guards - canCallMayI (3 tests)
- [x] Implement guards - isCurrentPlayer (2 tests)
- [x] Implement resolvingClaims state - entering (2 tests)
- [x] Implement resolvingClaims state - no claimants (3 tests)
- [x] Implement resolvingClaims state - single claimant (3 tests)
- [x] Implement resolvingClaims state - multiple claimants (3 tests)
- [x] Implement resolvingClaims state - veto between non-current players (3 tests)
- [x] Implement priority calculation - basic (3 tests)
- [x] Implement priority calculation - wrap-around (2 tests)
- [x] Implement priority calculation - current player passed (2 tests)
- [x] Implement priority calculation - 5 player scenario (3 tests)
- [x] Implement final states - closedByCurrentPlayer (5 tests)
- [x] Implement final states - resolved (5 tests)
- [x] Implement final states - closedNoClaim (4 tests)

### May I Priority (24 tests in mayIPriority.test.ts) ✓

- [x] Implement getClaimPriority - priority order (3 tests)
- [x] Implement getClaimPriority - wrap-around (2 tests)
- [x] Implement getClaimPriority - excluding discarder (3 tests)
- [x] Implement resolveByPriority - single claimant (1 test)
- [x] Implement resolveByPriority - multiple claimants (4 tests)
- [x] Implement veto scenarios - closer player vetoes (4 tests)
- [x] Implement veto scenarios - current player vetoes (3 tests)
- [x] Implement veto scenarios - cannot veto after passing (2 tests)
- [x] Implement veto scenarios - chain of vetoes (2 tests)

### May I Actions (25 tests in mayIActions.test.ts) ✓

- [x] Implement current player claiming - via DRAW_FROM_DISCARD (5 tests)
- [x] Implement current player claiming - voids other calls (4 tests)
- [x] Implement current player claiming - counts as draw (3 tests)
- [x] Implement non-current player winning - receives discard + penalty (3 tests)
- [x] Implement non-current player winning - discard and stock updated (3 tests)
- [x] Implement non-current player winning - turn order unchanged (3 tests)
- [x] Implement no claims scenario (4 tests)

### May I Rules (34 tests in mayIRules.test.ts) ✓

- [x] Implement eligibility rules - cannot May I own discard (1 test)
- [x] Implement eligibility rules - current player can claim (2 tests)
- [x] Implement eligibility rules - all other players can May I (3 tests)
- [x] Implement timing rules - May I before current player draws (3 tests)
- [x] Implement timing rules - window closes on draw from discard (3 tests)
- [x] Implement timing rules - resolves on draw from stock (4 tests)
- [x] Implement timing rules - loses veto after passing (3 tests)
- [x] Implement unlimited per round (5 tests)
- [x] Implement penalty card rules (6 tests)

### RoundMachine May I Integration (46 tests in roundMachine.mayI.test.ts) ✓

- [x] Implement window opens after discard (3 tests)
- [x] Implement window does NOT open if went out (3 tests)
- [x] Implement MayIWindowMachine input (6 tests)
- [x] Implement CURRENT_PLAYER_CLAIMED outcome (4 tests)
- [x] Implement MAY_I_RESOLVED outcome (5 tests)
- [x] Implement NO_CLAIMS outcome (4 tests)
- [x] Implement turn flow - current player claims (4 tests)
- [x] Implement turn flow - May I won (4 tests)
- [x] Implement turn flow - no May I (3 tests)
- [x] Implement turn flow - current player vetoes (3 tests)
- [x] Implement multiple May I in a round (5 tests)

### TurnMachine May I Awareness (19 tests in turnMachine.mayI.test.ts) ✓

- [x] Implement turn starts in awaitingDraw (3 tests)
- [x] Implement DRAW_FROM_DISCARD during May I window (4 tests)
- [x] Implement DRAW_FROM_STOCK during May I window (4 tests)
- [x] Implement hand state after May I resolution (3 tests)
- [x] Implement discard availability - no May I (2 tests)
- [x] Implement discard availability - May I won (3 tests)

### May I Integration Tests (52 tests in mayIIntegration.test.ts) ✓

- [x] Implement complete flow - current player takes discard (4 tests)
- [x] Implement complete flow - one May I claimant (3 tests)
- [x] Implement complete flow - multiple claimants, priority (3 tests)
- [x] Implement complete flow - current player vetoes (3 tests)
- [x] Implement complete flow - non-current player vetoes (3 tests)
- [x] Implement complete flow - no one wants discard (2 tests)
- [x] Implement complete flow - May I before current player decides (3 tests)
- [x] Implement edge cases - 3 players (3 tests)
- [x] Implement edge cases - 8 players (3 tests)
- [x] Implement edge cases - stock is low (2 tests)
- [x] Implement edge cases - stock is empty (3 tests)
- [x] Implement edge cases - first discard of round (2 tests)
- [x] Implement turn order verification (5 tests)
- [x] Implement strategic scenarios (12 tests)

### CLI May I (34 tests in cli/mayI.test.ts) ✓

- [x] Implement current player decision prompt (2 tests)
- [x] Implement current player decision with pending May I (3 tests)
- [x] Implement May I prompt for other players (3 tests)
- [x] Implement May I resolution display - single winner (3 tests)
- [x] Implement May I resolution display - priority winner (4 tests)
- [x] Implement May I veto display - current player (3 tests)
- [x] Implement May I veto display - non-current player (5 tests)
- [x] Implement no May I claims display (3 tests)
- [x] Implement AI May I summary (4 tests)
- [x] Implement AI veto summary (4 tests)

---

## Phase 7 Tasks (Joker Swapping)

> Joker swapping from runs before laying down. Per house rules:
> - Jokers can be swapped out of runs only, never out of sets
> - You must have the real card that fits the Joker's position in the run
> - You may only swap Jokers if you have NOT laid down yet this hand
> - Once you lay down your contract, you lose the right to perform Joker swaps

### Joker Position Identification (14 tests in meld.joker.test.ts) ✓

> Already implemented in Phase 1!

- [x] Implement identifyJokerPositions - find Jokers in runs (7 tests)
- [x] Implement canSwapJokerWithCard - validation (7 tests)

### Joker Swap Guards (17 tests in jokerSwap.guards.test.ts) ✓

- [x] Implement notDownForJokerSwap guard (3 tests)
- [x] Implement validJokerSwap guard - run only (3 tests)
- [x] Implement validJokerSwap guard - card fits position (3 tests)
- [x] Implement validJokerSwap guard - player has card in hand (3 tests)
- [x] Implement validJokerSwap guard - Joker only (3 tests)
- [x] Implement canPerformJokerSwap composite guard (2 tests)

### SWAP_JOKER Command (18 tests in jokerSwap.command.test.ts) ✓

- [x] Implement SWAP_JOKER in TurnMachine drawn state (4 tests)
- [x] Implement swapJoker action - updates table meld (4 tests)
- [x] Implement swapJoker action - adds Joker to player hand (3 tests)
- [x] Implement swapJoker action - removes swapped card from hand (3 tests)
- [x] Implement rejection scenarios (4 tests)

### Joker Swap Integration (15 tests in jokerSwap.integration.test.ts) ✓

- [x] Implement swap then lay down flow (4 tests)
- [x] Implement multiple swaps in one turn (3 tests)
- [x] Implement cannot swap after laying down (3 tests)
- [x] Implement swap from opponent's run (3 tests)
- [x] Implement edge cases - run boundaries (2 tests)

### CLI Joker Swap (8 tests in cli/jokerSwap.test.ts) ✓

- [x] Implement swap command syntax (2 tests)
- [x] Implement swap display (3 tests)
- [x] Implement swap error messages (3 tests)

---

## Discovered Tasks

> Tasks found during implementation that don't fit current phase

_(none yet)_

## Phase 8 Tasks Final Game End Testing

> Break down when Phase 7 is complete

- [ ]Put everything together and test the game end to end using the CLI app. Add bugs and tasks to backlog for any issues found. Ensure CLI game follows specs/command-line-ux.md. Ensure game follows specs/house-rules.md.

---

## Questions

> Spec clarifications needed

_(none yet)_

---

## Completed Phases

- **Phase 1** (Card Foundation) — v0.1.0
- **Phase 2** (Minimal Playable Turn) — v0.2.0
- **Phase 3** (Contracts + Laying Down) — v0.3.0
- **Phase 4** (Laying Off + Going Out + Scoring) — v0.4.0
- **Phase 5** (Full Game Loop) — v0.5.0
- **Phase 6** (May I Mechanic) — v0.6.0
- **Phase 7** (Joker Swapping) — v0.7.0

---

## Notes

- All specs are in `/specs` folder — READ THEM before implementing
- Tests use Bun's built-in test runner
- Commit after each completed task
- Tag releases at phase completion: `v0.1.0`, `v0.2.0`, etc.
