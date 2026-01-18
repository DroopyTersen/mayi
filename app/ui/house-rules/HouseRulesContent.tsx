/**
 * House Rules - Comprehensive JSX version of Grandma Jeanne's House Rules
 * A complete reference guide for May I? game rules
 */
export function HouseRulesContent() {
  return (
    <div className="space-y-8 text-sm">
      {/* Basics */}
      <section>
        <h3 className="font-semibold text-base mb-3 text-primary">1. Basics</h3>
        <dl className="space-y-2">
          <div>
            <dt className="font-medium inline">Players:</dt>
            <dd className="inline text-muted-foreground"> 3 to 8</dd>
          </div>
          <div>
            <dt className="font-medium">Decks:</dt>
            <dd className="text-muted-foreground ml-4">
              <ul className="list-disc list-inside">
                <li>3 to 5 players: 2 standard decks + 4 Jokers</li>
                <li>6 to 8 players: 3 decks + 6 Jokers</li>
              </ul>
            </dd>
          </div>
          <div>
            <dt className="font-medium inline">Hands:</dt>
            <dd className="inline text-muted-foreground"> 6 hands total</dd>
          </div>
          <div>
            <dt className="font-medium inline">Cards dealt:</dt>
            <dd className="inline text-muted-foreground">
              {" "}
              11 cards to each player every hand
            </dd>
          </div>
          <div>
            <dt className="font-medium inline">Goal:</dt>
            <dd className="inline text-muted-foreground">
              {" "}
              After all 6 hands, the player with the{" "}
              <span className="font-medium text-foreground">lowest total score</span>{" "}
              wins.
            </dd>
          </div>
        </dl>
      </section>

      {/* Card Ranks, Wilds, and Points */}
      <section>
        <h3 className="font-semibold text-base mb-3 text-primary">
          2. Card Ranks, Wilds, and Points
        </h3>

        <h4 className="font-medium mb-2">Rank Order (high to low)</h4>
        <p className="text-muted-foreground font-mono mb-4">
          A K Q J 10 9 8 7 6 5 4 3 2
        </p>

        <h4 className="font-medium mb-2">Wild Cards</h4>
        <ul className="list-disc list-inside text-muted-foreground mb-4">
          <li>All 2s</li>
          <li>All Jokers</li>
        </ul>

        <h4 className="font-medium mb-2">Card Values for Scoring</h4>
        <table className="w-full border-collapse">
          <thead className="sr-only">
            <tr>
              <th scope="col">Card</th>
              <th scope="col">Points</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="py-1.5 text-muted-foreground">3-10</td>
              <td className="py-1.5 text-right">Face value</td>
            </tr>
            <tr className="border-b">
              <td className="py-1.5 text-muted-foreground">J, Q, K</td>
              <td className="py-1.5 text-right">10 points</td>
            </tr>
            <tr className="border-b">
              <td className="py-1.5 text-muted-foreground">Ace</td>
              <td className="py-1.5 text-right">15 points</td>
            </tr>
            <tr className="border-b">
              <td className="py-1.5 text-muted-foreground">2 (wild)</td>
              <td className="py-1.5 text-right font-medium">20 points</td>
            </tr>
            <tr>
              <td className="py-1.5 text-muted-foreground">Joker (wild)</td>
              <td className="py-1.5 text-right font-medium text-destructive">
                50 points
              </td>
            </tr>
          </tbody>
        </table>
        <p className="text-xs text-muted-foreground mt-2 italic">
          Jokers are powerful but brutal if stuck in your hand at the end.
        </p>
      </section>

      {/* Contracts by Hand */}
      <section>
        <h3 className="font-semibold text-base mb-3 text-primary">
          3. Contracts by Hand
        </h3>

        <h4 className="font-medium mb-2">Definitions</h4>
        <ul className="space-y-2 mb-4">
          <li>
            <span className="font-medium">Set (group):</span>{" "}
            <span className="text-muted-foreground">
              3 or more cards of the same rank, any suits. Duplicate suits are
              allowed (e.g., 7&#9824; 7&#9824; 7&#9830; is valid).
            </span>
          </li>
          <li>
            <span className="font-medium">Run (sequence):</span>{" "}
            <span className="text-muted-foreground">
              4 or more cards of the same suit in consecutive order
            </span>
          </li>
        </ul>

        <h4 className="font-medium mb-2">6 Hand Sequence</h4>
        <table className="w-full border-collapse mb-4">
          <thead className="sr-only">
            <tr>
              <th scope="col">Hand</th>
              <th scope="col">Contract</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="py-1.5 font-medium w-16">Hand 1</td>
              <td className="py-1.5">2 sets</td>
            </tr>
            <tr className="border-b">
              <td className="py-1.5 font-medium">Hand 2</td>
              <td className="py-1.5">1 set + 1 run</td>
            </tr>
            <tr className="border-b">
              <td className="py-1.5 font-medium">Hand 3</td>
              <td className="py-1.5">2 runs</td>
            </tr>
            <tr className="border-b">
              <td className="py-1.5 font-medium">Hand 4</td>
              <td className="py-1.5">3 sets</td>
            </tr>
            <tr className="border-b">
              <td className="py-1.5 font-medium">Hand 5</td>
              <td className="py-1.5">2 sets + 1 run</td>
            </tr>
            <tr>
              <td className="py-1.5 font-medium">Hand 6</td>
              <td className="py-1.5">1 set + 2 runs (special rules)</td>
            </tr>
          </tbody>
        </table>

        <p className="text-muted-foreground mb-4">
          You must have the entire contract in your hand before you can lay down.
        </p>

        <div className="rounded-lg bg-muted/50 p-3 border">
          <h4 className="font-medium mb-2">Same-Suit Run Gap Rule</h4>
          <p className="text-muted-foreground mb-2">
            When a contract requires 2 runs and both runs are of the same suit,
            there must be a gap of at least 2 cards between them.
          </p>
          <ul className="text-xs space-y-1">
            <li className="text-green-600 dark:text-green-400">
              &#10003; Valid: 3&#9824;-6&#9824; and 9&#9824;-Q&#9824; (gap of 7&#9824; 8&#9824;)
            </li>
            <li className="text-destructive">
              &#10007; Invalid: 3&#9824;-6&#9824; and 8&#9824;-J&#9824; (gap of only 7&#9824;)
            </li>
            <li className="text-destructive">
              &#10007; Invalid: 3&#9824;-6&#9824; and 7&#9824;-10&#9824; (no gap - could be one run)
            </li>
          </ul>
        </div>
      </section>

      {/* Setup and Deal */}
      <section>
        <h3 className="font-semibold text-base mb-3 text-primary">
          4. Setup and Deal
        </h3>
        <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
          <li>Shuffle all decks together.</li>
          <li>
            Each player draws a card; high card deals the first hand. Dealer
            rotates left each hand.
          </li>
          <li>Dealer gives 11 cards to each player.</li>
          <li>Place the remaining stack face down as the stock pile.</li>
          <li>Turn the top stock card face up to start the discard pile.</li>
        </ol>
      </section>

      {/* Turn Structure */}
      <section>
        <h3 className="font-semibold text-base mb-3 text-primary">
          5. Turn Structure (Hands 1-5)
        </h3>
        <p className="text-muted-foreground mb-3">Play goes clockwise.</p>

        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 border border-amber-200 dark:border-amber-900 mb-4">
          <p className="font-medium text-amber-800 dark:text-amber-200">
            IMPORTANT: You must always draw first. Before you can lay down, lay
            off, or discard, you must draw a card.
          </p>
        </div>

        <h4 className="font-medium mb-2">On Your Turn</h4>
        <ol className="list-decimal list-inside space-y-3 text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">
              Draw exactly one card
            </span>{" "}
            (REQUIRED as first action):
            <ul className="list-disc list-inside ml-4 mt-1">
              <li>Either the top card of the stock pile</li>
              <li>
                Or the top card of the discard pile (if not taken via &ldquo;May
                I?&rdquo;)
              </li>
              <li>
                Once you have laid down (&ldquo;down&rdquo;), you may only draw
                from the stock pile
              </li>
            </ul>
          </li>
          <li>
            <span className="font-medium text-foreground">Optionally lay down</span>{" "}
            (only after drawing):
            <ul className="list-disc list-inside ml-4 mt-1">
              <li>If you have not laid down yet this hand</li>
              <li>
                And you can fully satisfy the contract for that hand in one go
              </li>
            </ul>
          </li>
          <li>
            <span className="font-medium text-foreground">
              No lay off on the same turn you lay down
            </span>
            :
            <ul className="list-disc list-inside ml-4 mt-1">
              <li>
                On the turn you first lay down your contract, you lay down only
                the contract
              </li>
              <li>
                You may NOT immediately add extra cards to your own or others&apos;
                melds that same turn
              </li>
            </ul>
          </li>
          <li>
            <span className="font-medium text-foreground">Lay off</span> (future
            turns only, after drawing):
            <ul className="list-disc list-inside ml-4 mt-1">
              <li>Starting on your next turn after laying down, you may:</li>
              <li>Draw first (always required)</li>
              <li>
                Then add cards to any existing melds on the table (yours or
                others)
              </li>
              <li>Then discard</li>
            </ul>
          </li>
          <li>
            <span className="font-medium text-foreground">
              Discard one card to end your turn
            </span>
            :
            <ul className="list-disc list-inside ml-4 mt-1">
              <li>One card face up on the discard pile</li>
              <li>
                Exception: You may go out without a discard if you play all your
                cards to melds
              </li>
            </ul>
          </li>
        </ol>
      </section>

      {/* Wild Card Rules */}
      <section>
        <h3 className="font-semibold text-base mb-3 text-primary">
          6. Wild Card Rules
        </h3>
        <p className="text-muted-foreground mb-3">Wilds are 2s and Jokers.</p>

        <ul className="space-y-2 mb-4">
          <li className="text-muted-foreground">
            Wilds can stand in for any rank and suit in a set or a run.
          </li>
          <li>
            <span className="font-medium text-foreground">
              When laying down your contract
            </span>
            , wilds cannot outnumber natural cards:
            <ul className="list-disc list-inside ml-4 mt-1 text-muted-foreground">
              <li className="text-green-600 dark:text-green-400">
                OK: 9&#9827; 9&#9830; Joker (2 natural, 1 wild)
              </li>
              <li className="text-destructive">
                Not OK: 9&#9827; Joker Joker (1 natural, 2 wild)
              </li>
            </ul>
          </li>
          <li>
            <span className="font-medium text-foreground">
              When laying off to existing melds
            </span>
            , the wild ratio rule does NOT apply:
            <ul className="list-disc list-inside ml-4 mt-1 text-muted-foreground">
              <li>You can add wilds to melds freely, even if wilds end up outnumbering naturals</li>
            </ul>
          </li>
        </ul>

        <div className="rounded-lg bg-muted/50 p-3 border">
          <h4 className="font-medium mb-2">Joker Swapping (Family Rule)</h4>
          <ul className="space-y-1.5 text-muted-foreground">
            <li>Jokers can be swapped out of runs only, never out of sets.</li>
            <li>
              To swap: The Joker must be clearly acting as a specific missing
              card in a valid run. You play the real card into that run and take
              the Joker into your hand.
            </li>
            <li className="font-medium text-foreground">
              Important: You may only swap Jokers if you have not laid down yet
              this hand.
            </li>
            <li className="italic">
              Note: Joker swapping is not possible in Hand 6 because there are no
              melds on the table until someone wins.
            </li>
          </ul>
        </div>
      </section>

      {/* The May I? Rule */}
      <section>
        <h3 className="font-semibold text-base mb-3 text-primary">
          7. The &ldquo;May I?&rdquo; Rule
        </h3>

        <h4 className="font-medium mb-2">When is a discard &ldquo;exposed&rdquo;?</h4>
        <p className="text-muted-foreground mb-2">
          A discard is exposed from the moment the previous player discards it
          until someone claims it.
        </p>
        <p className="text-muted-foreground mb-4">A discard stops being exposed when:</p>
        <ul className="list-disc list-inside text-muted-foreground mb-4 ml-2">
          <li>The current player draws from the discard pile (they claimed it)</li>
          <li>Someone wins a May I? claim (they claimed it)</li>
          <li>The current player discards (new turn, new exposed card)</li>
        </ul>

        <h4 className="font-medium mb-2">When can you call May I?</h4>
        <ul className="space-y-1 text-muted-foreground mb-4">
          <li className="text-green-600 dark:text-green-400">
            &#10003; BEFORE the current player draws - yes
          </li>
          <li className="text-green-600 dark:text-green-400">
            &#10003; AFTER the current player draws from stock - yes (discard still exposed)
          </li>
          <li className="text-destructive">
            &#10007; AFTER the current player draws from discard - no (they claimed it)
          </li>
          <li className="text-destructive">
            &#10007; AFTER the current player discards - no (new turn)
          </li>
        </ul>

        <h4 className="font-medium mb-2">Who is &ldquo;in line&rdquo; for the discard?</h4>
        <p className="text-muted-foreground mb-2">
          Everyone in line has the right to claim the exposed discard, with earlier
          players having priority.
        </p>
        <ul className="list-disc list-inside text-muted-foreground mb-4 ml-2">
          <li>
            The current player is first in line - but loses their spot after
            drawing from stock
          </li>
          <li>Then players in turn order after the current player</li>
          <li className="font-medium text-foreground">
            Down players are NOT in line at all - they can&apos;t claim discards AND
            they can&apos;t block others
          </li>
        </ul>

        <h4 className="font-medium mb-2">What happens when someone calls May I?</h4>
        <p className="text-muted-foreground mb-2">
          The system cycles through each player ahead of the caller:
        </p>
        <ul className="list-disc list-inside text-muted-foreground mb-4 ml-2">
          <li>
            If that player is not in line (down, or current player who drew from
            stock), skip them
          </li>
          <li>
            If that player IS in line, they are asked: &ldquo;Do you want to claim
            this card instead?&rdquo;
          </li>
          <li>If they say yes - they win the claim (caller loses)</li>
          <li>If they say no - continue to next player</li>
        </ul>
        <p className="text-muted-foreground mb-4">
          If no one ahead claims it, the original caller wins.
        </p>

        <h4 className="font-medium mb-2">What claiming costs</h4>
        <ul className="list-disc list-inside text-muted-foreground mb-4 ml-2">
          <li>
            <span className="font-medium text-foreground">Current player</span>{" "}
            (drawing from discard): Gets the card as their normal draw - no penalty
          </li>
          <li>
            <span className="font-medium text-foreground">Anyone else</span> (via
            May I?): Gets the discard + 1 penalty card from stock
          </li>
        </ul>

        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">No limit</span> on May I?
          usage per hand.
        </p>
      </section>

      {/* Laying Down */}
      <section>
        <h3 className="font-semibold text-base mb-3 text-primary">
          8. Laying Down (Initial Meld) - Hands 1-5
        </h3>
        <p className="text-muted-foreground mb-2">To lay down:</p>
        <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground mb-4">
          <li>It must be your turn, after you draw.</li>
          <li>
            You must lay down <span className="font-medium text-foreground">exactly</span>{" "}
            the contract for that hand - no more, no less.
          </li>
          <li>
            Lay those cards face up in front of you, clearly separated into sets
            and runs.
          </li>
          <li>On this turn, you only lay down the contract. No laying off extras yet.</li>
          <li>Discard one card to end your turn.</li>
        </ol>

        <p className="text-muted-foreground mb-4">
          <span className="font-medium text-foreground">Important:</span> Even if
          you have cards that could extend one of your melds, you must wait until
          your next turn to lay them off.
        </p>

        <h4 className="font-medium mb-2">After Laying Down</h4>
        <ul className="list-disc list-inside text-muted-foreground">
          <li>You are considered &ldquo;down&rdquo; for this hand.</li>
          <li>On later turns, you can lay off extras and try to empty your hand.</li>
        </ul>
      </section>

      {/* Laying Off */}
      <section>
        <h3 className="font-semibold text-base mb-3 text-primary">
          9. Laying Off (Adding to Melds) - Hands 1-5 Only
        </h3>
        <p className="text-muted-foreground mb-3">
          Starting from your next turn after laying down:
        </p>
        <p className="text-muted-foreground mb-3">
          On your turn, after drawing, you may:
        </p>
        <ul className="list-disc list-inside space-y-1.5 text-muted-foreground mb-4 ml-2">
          <li>
            <span className="font-medium text-foreground">
              Wild ratio rules do NOT apply when laying off.
            </span>{" "}
            You may add any number of wilds to existing melds.
          </li>
          <li>
            Add cards to any valid melds on the table:
            <ul className="list-disc list-inside ml-4 mt-1">
              <li>
                Extend runs (e.g. add 5&#9824; or 10&#9824; to a 6&#9824; 7&#9824;
                8&#9824; 9&#9824; run)
              </li>
              <li>
                Extend sets (e.g. add another 8 of a different suit to a set of
                8s)
              </li>
              <li>Add wilds freely (no ratio limits)</li>
            </ul>
          </li>
        </ul>
        <p className="text-muted-foreground">Then discard one card.</p>
        <p className="text-muted-foreground italic mt-2">
          Note: Laying off does not exist in Hand 6.
        </p>
      </section>

      {/* Going Out */}
      <section>
        <h3 className="font-semibold text-base mb-3 text-primary">10. Going Out</h3>
        <p className="text-muted-foreground mb-3">
          A hand ends when someone goes out.
        </p>

        <h4 className="font-medium mb-2">Hands 1-5</h4>
        <p className="text-muted-foreground mb-4">To go out:</p>
        <ul className="list-disc list-inside text-muted-foreground mb-4 ml-2">
          <li>On your turn you draw</li>
          <li>Play cards (lay off, use wilds, etc.) until you have one card left</li>
          <li>Discard your last card</li>
          <li>Everyone else then scores the remaining cards in their hand</li>
        </ul>
      </section>

      {/* Hand 6 Special Rules */}
      <section className="rounded-lg bg-primary/5 p-4 border border-primary/20">
        <h3 className="font-semibold text-base mb-3 text-primary">
          Hand 6 - The Final Hand
        </h3>
        <p className="text-muted-foreground mb-3">
          Hand 6 works fundamentally differently from Hands 1-5:
        </p>

        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 border border-amber-200 dark:border-amber-900 mb-4">
          <p className="font-medium text-amber-800 dark:text-amber-200">
            The core rule: You cannot lay down unless you use EVERY card in your
            hand.
          </p>
        </div>

        <p className="text-muted-foreground mb-2">This means:</p>
        <ul className="list-disc list-inside text-muted-foreground mb-4 ml-2">
          <li>You start with 11 cards. After drawing, you have 12 cards.</li>
          <li>
            To lay down, ALL 12 cards must form valid melds (1 set + 2 runs).
          </li>
          <li>
            The minimum contract is 3 + 4 + 4 = 11 cards, so you must extend at
            least one meld by one card.
          </li>
          <li>When you lay down, you immediately win. There is no discard after.</li>
          <li>
            <span className="font-medium text-foreground">
              Laying down = going out.
            </span>{" "}
            They are the same action in Hand 6.
          </li>
        </ul>

        <h4 className="font-medium mb-2">What This Means for Gameplay</h4>
        <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">
              No one is ever &ldquo;down&rdquo; until someone wins.
            </span>
            <ul className="list-disc list-inside ml-4 mt-1">
              <li>The table stays empty of melds the entire hand.</li>
              <li>Everyone can draw from either stock or discard pile.</li>
              <li>Everyone can call May I? and veto.</li>
            </ul>
          </li>
          <li>
            <span className="font-medium text-foreground">
              No laying off exists in Hand 6.
            </span>{" "}
            There are no melds on the table to lay off to.
          </li>
          <li>
            <span className="font-medium text-foreground">
              No Joker swapping in Hand 6.
            </span>{" "}
            There are no runs on the table to swap Jokers from.
          </li>
          <li>
            <span className="font-medium text-foreground">May I? is extra risky.</span>
            <ul className="list-disc list-inside ml-4 mt-1">
              <li>Each May I? gives you 2 extra cards (discard + penalty).</li>
              <li>If you May I? once, you now have 14 cards that must ALL be used.</li>
              <li>All these cards must fit into your 1 set + 2 runs.</li>
            </ul>
          </li>
          <li>
            <span className="font-medium text-foreground">Typical turn in Hand 6:</span>
            <ul className="list-disc list-inside ml-4 mt-1">
              <li>Draw a card (from stock or discard)</li>
              <li>Check: Can ALL 12+ cards form 1 set + 2 runs?</li>
              <li>If YES: Lay down everything and win!</li>
              <li>If NO: Discard one card, next player&apos;s turn.</li>
            </ul>
          </li>
          <li>
            <span className="font-medium text-foreground">
              Strategic considerations:
            </span>
            <ul className="list-disc list-inside ml-4 mt-1">
              <li>
                Sometimes winning Hand 6 is unlikely. Players may shift strategy
                to minimize points.
              </li>
              <li>
                Discarding high-value cards (even wilds!) reduces your score if
                someone else goes out.
              </li>
              <li>
                But beware: discarding a wild might let another player pick it up
                and win!
              </li>
            </ul>
          </li>
        </ol>

        <h4 className="font-medium mt-4 mb-2">Example of Going Out in Hand 6</h4>
        <ul className="list-disc list-inside text-muted-foreground">
          <li>You have 12 cards after drawing.</li>
          <li>
            You form: 7&#9824; 7&#9830; 7&#9827; 7&#9829; (4-card set) + 4&#9829;
            5&#9829; 6&#9829; 7&#9829; (4-card run) + 9&#9830; 10&#9830; J&#9830;
            Q&#9830; (4-card run)
          </li>
          <li>All 12 cards are used. You lay them all down and win!</li>
        </ul>
      </section>

      {/* Stock Pile Depletion */}
      <section>
        <h3 className="font-semibold text-base mb-3 text-primary">
          11. Stock Pile Depletion
        </h3>
        <p className="text-muted-foreground mb-3">
          <span className="font-medium text-foreground">
            The stock pile should never be empty.
          </span>{" "}
          When the last card is drawn from the stock:
        </p>
        <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground mb-4">
          <li>Immediately take the discard pile (except the top exposed card).</li>
          <li>Shuffle those cards.</li>
          <li>Place them face down as the new stock pile.</li>
          <li>The exposed discard remains on the discard pile.</li>
        </ol>
        <p className="text-muted-foreground">
          This happens automatically - no player action is required.
        </p>
        <p className="text-xs text-muted-foreground mt-2 italic">
          Extremely rare edge case: If somehow there are no cards to replenish
          (all cards are in players&apos; hands), the hand ends immediately and all
          players score what they hold.
        </p>
      </section>

      {/* Scoring and Winning */}
      <section>
        <h3 className="font-semibold text-base mb-3 text-primary">
          12. Scoring and Winning
        </h3>
        <p className="text-muted-foreground mb-3">After each hand:</p>
        <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground mb-4">
          <li>
            The player who went out scores{" "}
            <span className="font-medium text-foreground">0 points</span>.
          </li>
          <li>
            All other players add up the point values of the cards left in their
            hand.
          </li>
        </ol>

        <table className="w-full border-collapse mb-4">
          <thead className="sr-only">
            <tr>
              <th scope="col">Card</th>
              <th scope="col">Points</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="py-1.5 text-muted-foreground">3-10</td>
              <td className="py-1.5 text-right">Face value</td>
            </tr>
            <tr className="border-b">
              <td className="py-1.5 text-muted-foreground">J, Q, K</td>
              <td className="py-1.5 text-right">10 points</td>
            </tr>
            <tr className="border-b">
              <td className="py-1.5 text-muted-foreground">Ace</td>
              <td className="py-1.5 text-right">15 points</td>
            </tr>
            <tr className="border-b">
              <td className="py-1.5 text-muted-foreground">2 (wild)</td>
              <td className="py-1.5 text-right font-medium">20 points</td>
            </tr>
            <tr>
              <td className="py-1.5 text-muted-foreground">Joker (wild)</td>
              <td className="py-1.5 text-right font-medium text-destructive">
                50 points
              </td>
            </tr>
          </tbody>
        </table>

        <p className="text-muted-foreground">
          Write down running totals. After all 6 hands, the player with the{" "}
          <span className="font-medium text-foreground">lowest total score</span> is
          the winner.
        </p>
      </section>
    </div>
  );
}
