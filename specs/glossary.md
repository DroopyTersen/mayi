# May I? — Glossary & Data Model

A contract rummy style game where you “May I?” to grab discards out of turn and race to lay down specific combinations.

---

## Game Structure

| Term      | Code Name | Definition                                                   |
| --------- | --------- | ------------------------------------------------------------ |
| **Game**  | `Game`    | A complete session of 6 rounds                               |
| **Round** | `Round`   | One of the 6 rounds, each with its own contract              |
| **Turn**  | `Turn`    | One player’s action cycle: draw → (optional plays) → discard |
| **Deal**  | `deal()`  | The act of distributing cards at the start of a round        |

---

## Cards & Properties

| Term            | Code Name       | Definition                                                     |
| --------------- | --------------- | -------------------------------------------------------------- |
| **Card**        | `Card`          | A single playing card                                          |
| **Rank**        | `rank`          | The value of a card (A, K, Q, J, 10–3). Note: 2 is always wild |
| **Suit**        | `suit`          | Hearts, Diamonds, Clubs, Spades (null for Joker)               |
| **Wild**        | `isWild`        | A card that substitutes for any rank/suit (all 2s and Jokers)  |
| **Natural**     | `isNatural`     | A non-wild card                                                |
| **Joker**       | `rank: 'Joker'` | The most powerful wild; 50 points if stuck in hand             |
| **Point value** | `pointValue`    | The scoring cost of a card left in hand                        |

### Point Values

| Card     | Points     |
| -------- | ---------- |
| 3–10     | Face value |
| J, Q, K  | 10         |
| Ace      | 15         |
| 2 (wild) | 2          |
| Joker    | 50         |

---

## Zones

| Term        | Code Name | Definition                                                               |
| ----------- | --------- | ------------------------------------------------------------------------ |
| **Stock**   | `stock`   | The face-down pile you draw from                                         |
| **Discard** | `discard` | The face-up pile where players discard; only top card visible/accessible |
| **Hand**    | `hand`    | The cards a player is currently holding                                  |
| **Table**   | `table`   | All melds that have been laid down by all players                        |

---

## Combinations

| Term         | Code Name     | Definition                                                       |
| ------------ | ------------- | ---------------------------------------------------------------- |
| **Meld**     | `Meld`        | Any valid combination on the table (parent type for Set and Run) |
| **Set**      | `type: 'set'` | 3+ cards of the same rank, any suits                             |
| **Run**      | `type: 'run'` | 4+ cards of the same suit in consecutive rank order              |
| **Contract** | `Contract`    | The specific meld requirements for a given round                 |

### Meld Rules

- In any meld, **wilds cannot outnumber natural cards**
- Valid: 9♣ 9♦ Joker (2 natural, 1 wild)
- Invalid: 9♣ Joker Joker (1 natural, 2 wild)

---

## Actions

| Term             | Code Name     | Definition                                                   |
| ---------------- | ------------- | ------------------------------------------------------------ |
| **Draw**         | `draw()`      | Take one card from stock or discard to start your turn       |
| **Discard**      | `discard()`   | Place one card on discard pile to end your turn              |
| **Lay down**     | `layDown()`   | Play your contract melds from hand to table (once per round) |
| **Lay off**      | `layOff()`    | Add cards to existing melds on the table                     |
| **May I**        | `mayI()`      | Claim the exposed discard out of turn (discard + 1 penalty card). Only available when current player drew from stock. Can be vetoed by any player closer in turn order. |
| **Penalty card** | `penaltyCard` | The extra card drawn from stock when you May I               |
| **Swap**         | `swapJoker()` | Replace a Joker in a run with the natural card it represents |
| **Go out**       | `goOut()`     | Empty your hand to end the round                             |

### Action Rules

- **Lay down**: Must satisfy entire contract in one play. Cannot lay off on the same turn you lay down.
- **Lay off**: Only allowed on turns _after_ you’ve laid down.
- **Swap Joker**: Only allowed if you have NOT laid down yet. Jokers can only be swapped out of runs, never sets.
- **May I**: Only available when the discard is "exposed" (current player drew from stock, not from discard). Any non-current player may call May I to claim the exposed discard + 1 penalty card. Can be vetoed by any player closer in turn order — if current player vetoes, they take the discard as their draw (no penalty); if another player vetoes, they effectively May I themselves (discard + penalty). Once the current player draws from stock, they forfeit veto rights.
- **Go out (Round 6)**: No final discard required—must play all cards to melds.

---

## Player States

| Term         | Code Name       | Definition                                     |
| ------------ | --------------- | ---------------------------------------------- |
| **Down**     | `isDown: true`  | Player has laid down their contract this round |
| **Not down** | `isDown: false` | Player hasn’t yet laid down                    |

Note: “Going out” is an event that ends the round, not a persistent player state.

---

## Scoring

| Term            | Code Name    | Definition                                                                           |
| --------------- | ------------ | ------------------------------------------------------------------------------------ |
| **Round score** | `roundScore` | Points from cards left in hand when someone goes out (0 for the player who went out) |
| **Total score** | `totalScore` | Cumulative score across all rounds played                                            |

**Lowest total score after 6 rounds wins.**

---

## Contracts by Round

| Round | Contract                              | Code                   |
| ----- | ------------------------------------- | ---------------------- |
| 1     | 2 sets                                | `{ sets: 2, runs: 0 }` |
| 2     | 1 set + 1 run                         | `{ sets: 1, runs: 1 }` |
| 3     | 2 runs                                | `{ sets: 0, runs: 2 }` |
| 4     | 3 sets                                | `{ sets: 3, runs: 0 }` |
| 5     | 2 sets + 1 run                        | `{ sets: 2, runs: 1 }` |
| 6     | 1 set + 2 runs (no discard to go out) | `{ sets: 1, runs: 2 }` |

---

## Entity Model

```
Game
├── players: Player[]
├── currentRound: 1–6
├── dealerIndex: number
├── stock: Card[]
├── discard: Card[]
├── table: Meld[]
├── roundHistory: RoundRecord[]

Player
├── id: string
├── name: string
├── hand: Card[]
├── isDown: boolean
├── totalScore: number

Card
├── suit: 'hearts' | 'diamonds' | 'clubs' | 'spades' | null
├── rank: 'A' | 'K' | 'Q' | 'J' | '10'–'3' | '2' | 'Joker'
├── isWild: boolean         // derived: rank === '2' || rank === 'Joker'
├── pointValue: number      // derived

Meld
├── type: 'set' | 'run'
├── cards: Card[]
├── ownerId: string         // which player laid it down

Contract
├── roundNumber: 1–6
├── sets: number
├── runs: number

RoundRecord
├── roundNumber: 1–6
├── scores: Map<playerId, number>
```

---

## Setup Reference

| Players | Decks            | Jokers |
| ------- | ---------------- | ------ |
| 3–5     | 2 standard decks | 4      |
| 6–8     | 3 standard decks | 6      |

Cards dealt per player per round: **11**
