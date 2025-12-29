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
- [x] Implement START_GAME rejected scenarios (5 tests)
- [x] Implement initializePlayers action (4 tests)
- [!] Implement playing state - entering (2/3 tests, 1 blocked - RoundMachine spawning)
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
- [!] Implement active state structure (1/2 tests, 1 blocked - TurnMachine spawning)
- [x] Implement TurnMachine invocation (7 tests)
- [!] Implement turn completion - normal (3/4 tests, 1 blocked - TurnMachine spawning)
- [x] Implement turn completion - went out (4 tests)
- [x] Implement advanceTurn action (3 tests)
- [x] Implement state updates from turn (5 tests)
- [x] Implement scoring state (2 tests)
- [x] Implement scoreRound action (3 tests)
- [x] Implement RoundRecord creation (3 tests)
- [!] Implement output (2/3 tests, 1 blocked - parent-child integration)
- [!] Implement stock depletion - detection (1/2 tests, 1 blocked - TurnMachine integration)
- [x] Implement reshuffleStock action (4 tests)
- [x] Implement reshuffle scenario (3 tests)
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
- [!] Implement mid-round reshuffle scenario (1/3 tests, 2 blocked - TurnMachine integration)
- [x] Implement discard pile size (2 tests)
- [x] Implement edge cases (3 tests)

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
- [!] Implement edge cases (5/6 tests, 1 blocked - stock reshuffle integration)
- [x] Implement contract enforcement per round (6 tests)
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

### Error Message Improvements (10 tests) ✓

> These tests verify that specific, helpful error messages are provided to users.
> **Implementation**: Added `lastError: string | null` to TurnContext and GameContext with setLayDownError, setLayOffError, and setStartGameError actions.

- [x] `laydown.test.ts:1808` - Contract requirement error message
- [x] `laydown.test.ts:2072` - Invalid meld error message (which meld is invalid)
- [x] `laydown.test.ts:2414` - Already laid down error message
- [x] `laydown.test.ts:2503` - Goes out immediately if hand empty after laydown (no discard)
- [x] `layoff.test.ts:1297` - Error: "must be down from a previous turn to lay off"
- [x] `layoff.test.ts:1325` - Error: "cannot lay off on same turn as laying down"
- [x] `layoff.test.ts:1438` - Error: "card not in hand"
- [x] `layoff.test.ts:1478` - Error: "meld not found"
- [x] `layoff.test.ts:1559` - Error: "card does not fit this meld"
- [x] `layoff.test.ts:1600` - Error: "would make wilds outnumber naturals"
- [x] `gameMachine.test.ts:220` - Error: "minimum 3 players required"
- [x] `layoff.test.ts:1171` - Going out triggered immediately if hand becomes empty

### Contract Validation Tests (4 tests) ✓

> Tests in contracts.test.ts that verify meld validation during contract validation

- [x] `contracts.test.ts:277` - Rejects if any set is invalid
- [x] `contracts.test.ts:278` - Rejects if any run is invalid
- [x] `contracts.test.ts:279` - Rejects if any meld has wilds outnumbering naturals
- [x] `contracts.test.ts:280` - All melds checked, not just first one

### Stock Depletion & Reshuffle Tests (3 tests) — BLOCKED

> Integration tests for stock depletion handling.
> **Status**: BLOCKED — Requires TurnMachine to notify RoundMachine when stock is empty during draw. Current architecture uses manual coordination via harness, not XState actor communication.

- [!] `stockDepletion.test.ts:58` - Reshuffle happens before draw completes (requires TurnMachine↔RoundMachine integration)
- [!] `stockDepletion.test.ts:237` - Next player draws → reshuffle occurs automatically (requires machine spawning)
- [!] `stockDepletion.test.ts:238` - Game continues normally after reshuffle (requires machine spawning)
- [x] `stockDepletion.test.ts:284` - Round ends immediately when reshuffle impossible (conceptual test)

### Going Out Tests (11 tests) ✓

> Tests for going out scenarios and round endings

- [x] `goingOut.test.ts:70` - Going out ends the round immediately
- [x] `goingOut.test.ts:74` - Other players score their remaining cards
- [x] `goingOut.test.ts:201` - Exception: go out on same turn as laying down
- [x] `goingOut.test.ts:314` - Round ends (via discard)
- [x] `goingOut.test.ts:459` - Round ends (via layoff)
- [x] `goingOut.test.ts:5590` - Parent machine handles wentOut flag differently
- [x] `goingOut.test.ts:5596` - When turn outputs wentOut: true
- [x] `goingOut.test.ts:5599` - Round machine transitions to scoring state
- [x] `goingOut.test.ts:5602` - No more turns for any player
- [x] `goingOut.test.ts:5605` - Scoring begins immediately

### Round End & Scoring Tests (6 tests) ✓

> Tests for RoundRecord and scoring audit trail

- [x] `roundEnd.test.ts:453` - Winner scores 0
- [x] `roundEnd.test.ts:454` - All other players score their hand values
- [x] `roundEnd.test.ts:455` - No player skipped
- [x] `roundEnd.test.ts:628` - Can calculate any player's score at any point
- [x] `roundEnd.test.ts:629` - Can identify who won each round
- [x] `roundEnd.test.ts:630` - Full audit trail of game

### Full Game Contract Enforcement Tests (10 tests)

> Tests verifying correct contracts are enforced per round

- [!] `fullGame.test.ts:973` - Stock runs out → reshuffle triggered (BLOCKED: requires TurnMachine↔RoundMachine integration)
- [x] `fullGame.test.ts:999` - Round 1: players must lay down 2 sets
- [x] `fullGame.test.ts:1000` - Round 1: 1 set insufficient
- [x] `fullGame.test.ts:1001` - Round 1: sets + runs insufficient (wrong combination)
- [x] `fullGame.test.ts:1005` - Round 2: players must lay down 1 set + 1 run
- [x] `fullGame.test.ts:1006` - Round 2: 2 sets insufficient, 2 runs insufficient
- [x] `fullGame.test.ts:1010` - Round 3: players must lay down 2 runs
- [x] `fullGame.test.ts:1014` - Round 4: players must lay down 3 sets
- [x] `fullGame.test.ts:1018` - Round 5: players must lay down 2 sets + 1 run
- [x] `fullGame.test.ts:1022` - Round 6: players must lay down 1 set + 2 runs
- [x] `fullGame.test.ts:1023` - Round 6: minimum 11 cards, special going out rules

### RoundMachine & TurnMachine Spawning Tests (5 tests) — BLOCKED

> Tests for child machine spawning/integration.
> **Status**: BLOCKED — Current architecture uses event-based coordination via harness. Implementing XState `spawn()` would require significant refactoring.

- [!] `gameMachine.test.ts:291` - Spawns RoundMachine with current round context (requires XState spawn)
- [!] `roundMachine.test.ts:550` - Spawns TurnMachine for current player's turn (requires XState spawn)
- [!] `roundMachine.test.ts:726` - Spawn new TurnMachine for next player (requires XState spawn)
- [!] `roundMachine.test.ts:1333` - Triggers roundEnd in GameMachine (requires parent-child communication)
- [!] `roundMachine.test.ts:1357` - Stock empty checked when player draws from stock (requires machine integration)
- [x] `roundMachine.test.ts:1379-1380` - Reshuffle shuffles cards and places as new stock
- [x] `roundMachine.test.ts:1399-1401` - Reshuffle scenario (20 cards → 19 shuffled)

### Turn Machine Stock Depletion Test (1 test) ✓

> Stock empty handling in TurnMachine.
> **Implementation**: Added `canDrawFromStock` guard that blocks draw when stock is empty, sets error message. RoundMachine is responsible for reshuffle before turn starts.

- [x] `turn.machine.test.ts:142` - Blocks draw and sets error when stock is empty

---

## Future Work: XState Actor Spawning (9 blocked tests)

> The remaining 9 `it.todo` tests require implementing XState actor spawning between machines. Current architecture uses event-based coordination via CLI harness.

### What Would Be Needed

1. **GameMachine spawns RoundMachine**
   - Use XState `spawn()` in playing state entry action
   - Subscribe to RoundMachine output for ROUND_COMPLETE events

2. **RoundMachine spawns TurnMachine**
   - Use XState `spawn()` when entering active state
   - Create new TurnMachine for each player's turn
   - Subscribe to TurnMachine output for TURN_COMPLETE events

3. **Stock Depletion Integration**
   - RoundMachine monitors TurnMachine for stock depletion
   - On stock empty, pause turn and trigger reshuffle
   - Resume turn with refilled stock

### Current Status

The game works correctly with manual coordination via the CLI harness (`harness/play.ts`). The harness:
- Creates machines as needed
- Forwards events between machines
- Handles stock depletion by checking before each turn

### Test Count Summary

- **1849 passing tests** (all core game logic, after Round 6 rewrite)
- **9 blocked todos** (XState spawning integration)

---

## Phase 8 Tasks (Exhaustive Harness Testing)

> End-to-end testing using the CLI harness. See [docs/agent-game-harness.md](docs/agent-game-harness.md) for harness documentation.
>
> **When issues are found**: Add bugs to the "Bug Tracking" section below. Add new tasks to "Discovered Tasks" section if they require implementation work. Fix bugs before continuing with testing. Ensure game follows specs/house-rules.md and CLI follows specs/command-line-ux.md.

### Harness Setup

- [x] Start fresh game with `bun harness/play.ts new`
- [x] Verify status display shows correct initial state
- [x] Verify JSON output works with `status --json`
- [x] Verify log command works

### Round 1 Testing (Contract: 2 sets) ✓

- [x] Play through complete Round 1 with one player going out (Bob went out with 0 pts)
- [x] Test laying down exactly 2 sets (minimum 3 cards each)
- [x] Test laying down sets with wilds (verify wilds don't outnumber naturals)
- [x] Test laying down larger sets (4+ cards) — tested with 4, 5, and 6 card sets during layoff
- [x] Test rejection: attempt to lay down with only 1 set (got "Contract requires 2 set(s), but got 1")
- [x] Test rejection: attempt to lay down with invalid set (got "Invalid run: J♥ 9♠ 8♦")
- [x] Test layoff after going down (add 4th card to a set, Bob laid off 8♣ to Alice's 8s)
- [x] Verify round scoring is calculated correctly (Alice: 7, Bob: 0, Carol: 27)
- [x] Verify round history is recorded
- [x] Test layoff with duplicate cards from second deck (Alice laid off Q♣ to Carol's 5-Queen set)
- [x] Test DOWN player cannot call May I (verified error message)
- [x] Test DOWN player cannot draw from discard (verified error message)

### Round 2 Testing (Contract: 1 set + 1 run) ✓

- [x] Play through complete Round 2 (Alice laid down 8s set + 3-6 clubs run with wilds)
- [x] Test laying down 1 set + 1 run (minimum 3 + 4 cards)
- [x] Test run with wilds in middle positions (Alice: 3♣-4♣-2♥(5♣)-2♥(6♣))
- [ ] Test run with Ace-low (A-2-3)
- [x] Test run with Ace-high (Q-K-A) — Carol's run 10-J-Q-K goes high
- [x] Test rejection: attempt to lay down 2 sets instead (got "Contract requires 1 set(s), but got 2")
- [x] Test rejection: attempt to lay down 2 runs instead (got "Invalid run" for invalid second meld, contract validation works)
- [x] Test DOWN player cannot draw from discard (harness blocks with error message)
- [x] Test DOWN player cannot call May I (harness blocks with error message)
- [x] Test run extension at high end (7♠ added to 3♠-4♠-5♠-6♠ → 3♠-4♠-5♠-6♠-7♠)
- [x] Test wild card extending run (2♥ wild extending run at high end)
- [x] Test layoff to run (extend at either end) — Carol extended 10-J-Q-K to 10-J-Q-K-A
- [x] Verify dealer advances correctly (Carol went first)
- [x] Test duplicate card rejection in run (6♠ cannot be added when 6♠ already in run - got "6♠ cannot be added to that run")

### Round 3 Testing (Contract: 2 runs)

- [~] Play through complete Round 3 (in progress)
- [ ] Test laying down 2 runs (minimum 4 cards each)
- [ ] Test runs in different suits
- [ ] Test layoff to both runs in same turn
- [x] Test rejection: attempt to lay down sets (got "Invalid run" when trying to lay down non-consecutive cards)

### Round 4 Testing (Contract: 3 sets)

- [ ] Play through complete Round 4
- [ ] Test laying down exactly 3 sets
- [ ] Test sets using cards from both decks (duplicate ranks)
- [ ] Test going out immediately after laying down

### Round 5 Testing (Contract: 2 sets + 1 run) ✓

- [x] Play through complete Round 5 (Carol went out via layoff + discard)
- [x] Test laying down 2 sets + 1 run (Carol: 3s set with wilds, Qs set with wilds, 3-6♦ run)
- [x] Test complex meld combinations with wilds (4 wilds used across melds)
- [x] Test multiple layoffs in single turn (2♥ and Joker laid off to sets)
- [x] Test wild layoff to run (2♦ laid off as 7♦, extending run)
- [x] Test going out via discard in Round 5 (confirmed working)

### Round 6 Testing (Contract: 1 set + 2 runs, must lay down ALL cards to win)

> Round 6 was rewritten: must lay down ALL 12 cards at once to win. No layoff, no swap, no "stuck".
> See `specs/round-6-transition.md` for the corrected rules.
> Harness correctly shows "⚠️ Must lay down ALL cards to win!" warning banner.

- [x] Verify harness shows Round 6 special warning (confirmed: "⚠️ Must lay down ALL cards to win!")
- [x] Verify layDown requires ALL cards in Round 6
- [x] Verify layOff blocked in Round 6 (no melds on table until someone wins)
- [x] Verify swap blocked in Round 6 (no melds on table)
- [x] Verify "stuck" command removed (was incorrect behavior)
- [x] Unit tests updated for correct Round 6 behavior
- [ ] (Optional) Play through complete Round 6 manually - requires all 12 cards in valid melds
- [ ] Verify game ends after Round 6

### May I Mechanic Testing

- [x] Test current player takes discard (no May I window) — verified Carol took 6♥ directly
- [x] Test current player draws from stock (May I window opens) — verified May I window opens after stock draw
- [x] Test single May I claimant wins — Carol called May I for Q♠, won it
- [ ] Test multiple May I claimants - priority resolution
- [ ] Test current player vetoes May I claim
- [ ] Test non-current player vetoes (closer to current player)
- [x] Test penalty card drawn with May I win — Carol got Q♠ + penalty card (went from 11 to 13 cards)
- [ ] Test May I when stock is low (< 3 cards)
- [x] Test no claims - window closes normally — verified multiple pass scenarios
- [ ] Test May I multiple times in same round
- [x] Test DOWN player blocked from calling May I (verified error message)

### Joker Swap Testing

- [ ] Test swap Joker from run before laying down
- [ ] Test swap Joker from opponent's run
- [ ] Test multiple swaps in same turn
- [ ] Test rejection: cannot swap from set
- [ ] Test rejection: cannot swap after laying down
- [ ] Test rejection: wrong card for Joker position
- [ ] Test swap then use Joker in own laydown

### Scoring Verification

- [x] Verify number cards score face value (2-10) — Alice had 7♦ = 7 pts
- [x] Verify face cards score 10 points (J, Q, K) — Carol's 7s scored 21 pts total
- [ ] Verify Aces score 15 points
- [ ] Verify Jokers score 50 points
- [ ] Verify Twos (wild) score 20 points
- [x] Verify winner scores 0 for round — Bob went out with 0 pts
- [x] Verify total scores accumulate across rounds — scores carried from R1 to R2
- [ ] Verify lowest total score wins

### Edge Cases

- [ ] Test going out on same turn as laying down
- [ ] Test going out with exactly 0 cards after layoff
- [ ] Test stock depletion and reshuffle
- [x] Test first player after dealer rotation (Carol went first in Round 2)
- [ ] Test 3-player priority wrap-around for May I
- [x] Test layoff to opponent's meld (Bob laid off cards to Alice's sets)
- [x] Test duplicate cards from two decks in same set (Aces set has A♠ twice)

### Game Completion

- [ ] Play complete 6-round game
- [ ] Verify final standings display
- [ ] Verify winner determination (lowest score)
- [ ] Verify tie-breaking if applicable
- [ ] Start new game after completion

### Bug Tracking

> Record any bugs found during testing here

- [x] **Harness swap command not implemented**: ~~The harness CLI shows `swap <meld> <pos> <card>` as an available command when player hasn't laid down, but running `bun harness/play.ts swap 2 3 1` returns "Unknown command: swap".~~ — Fixed: Added `handleSwap` function to harness/play.ts.
- [x] **Run extension bug**: ~~After adding 8♦ to a 9♦-Q♦ run (extending low), the next extension attempt (7♦) failed~~ — Fixed: Added `getRunInsertPosition()` to core/engine/layoff.ts and updated harness to insert cards at correct position (prepend for low extension, append for high extension).
- [x] **DOWN player can call May I**: ~~Carol called May I while DOWN~~ — Fixed in engine guards + harness `handleMayI()` now checks `player.isDown` before allowing May I call.
- [x] **DOWN player can draw from discard**: ~~Carol drew from discard pile while DOWN~~ — Fixed in engine guards + harness `handleDraw()` now checks `player.isDown` before allowing discard draw.
- [x] **Round 6 discard not fully blocked**: ~~Harness only blocked discard for down players with 1 card~~ — Fixed: Round 6 now properly blocks ALL discarding. `skip` ends turn immediately in Round 6, and `stuck` command available for down players with 1 card.
- [ ] **Minor UX: mayi shown to DOWN players**: Harness shows "mayi | pass" commands during May I window even for DOWN players who cannot call May I. Low priority - the engine correctly rejects the call, but showing the option is confusing.

---

## Phase 9 Tasks (Implementation Fixes)

> Critical bug fixes and rule corrections discovered during play-testing. See specs for details:
> - `specs/round-6-transition.md` — Round 6 is fundamentally broken
> - `specs/implementation-fixes.md` — Additional bugs

### Round 6 Complete Rewrite (CRITICAL) ✓

> Round 6 is fundamentally broken. See `specs/round-6-transition.md` for full details.

**Current (Wrong)**: Players lay down contract, then lay off cards on subsequent turns. "stuck" command exists.

**Correct**: No one is ever "down" until victory. Must lay down ALL 12+ cards at once. Laying down = going out.

- [x] Remove `stuck()` command entirely from orchestrator
- [x] Remove `stuck` from CLI commands and help text
- [x] Modify `layDown()` for Round 6: require ALL cards form valid melds
- [x] Round 6 `layDown()` should end round immediately (no discard phase)
- [x] Disable `layOff()` in Round 6 (return error: no melds on table)
- [x] Disable `swap()` in Round 6 (return error: no melds on table)
- [x] Ensure all players can draw from discard in Round 6 (no one is "down")
- [x] Ensure all players can call May I in Round 6 (no one is "down")
- [x] Update tests for new Round 6 behavior
- [x] Update harness rendering for Round 6 (no layoff/swap options)
- [ ] Update `docs/orchestrator.md` to reflect changes

### May I "Take" Command Bug (HIGH)

> Current player can draw from stock AND take discard = 2 cards. Wrong!
> See `specs/implementation-fixes.md` Section 1.

- [ ] Remove `take()` command or fix to prevent double-draw
- [ ] Current player vetoes by calling `drawFromDiscard()` instead of `drawFromStock()`
- [ ] Once player draws from stock, they forfeit veto rights
- [ ] Update harness CLI to not show "take" during May I window
- [ ] Add test: current player cannot take after drawing from stock

### Exact Contract Enforcement (MEDIUM)

> Rounds 1-5: Sets must be exactly 3 cards, runs exactly 4 cards when laying down.
> See `specs/implementation-fixes.md` Section 2.

- [ ] Add meld size validation in `layDown()` for Rounds 1-5
- [ ] Sets must be exactly 3 cards when laying down contract
- [ ] Runs must be exactly 4 cards when laying down contract
- [ ] Round 6 can have extended melds (since all cards must be used)
- [ ] Add tests for exact contract enforcement

### Wild Ratio Only Applies to Laydown (MEDIUM)

> When laying off, wild ratio rule does NOT apply. You can add wilds freely.
> See `specs/implementation-fixes.md` Section 4.

- [ ] Remove wild ratio check from `canLayOffToSet()` in `core/engine/layoff.ts`
- [ ] Remove wild ratio check from `canLayOffToRun()` in `core/engine/layoff.ts`
- [ ] Remove wild ratio check from `getRunInsertPosition()` in `core/engine/layoff.ts`
- [ ] Update tests that expect wild ratio enforcement on layoff

### Stock Auto-Replenishment (LOW)

> Stock should never be empty. Auto-reshuffle discard when depleted.
> See `specs/implementation-fixes.md` Section 3.

- [ ] Add `replenishStockIfNeeded()` helper method
- [ ] Call after every stock draw (including May I penalty)
- [ ] Keep top discard exposed, shuffle rest into new stock
- [ ] Add tests for stock replenishment

### Documentation Updates

- [ ] Update `specs/house-rules.md` if any rules need further clarification
- [ ] Update `docs/orchestrator.md` with corrected command list

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
- **Agent Game Harness**: See [docs/agent-game-harness.md](docs/agent-game-harness.md) for CLI harness documentation
