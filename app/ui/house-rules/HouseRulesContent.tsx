/**
 * House Rules Cheat Sheet - JSX content for the rules drawer
 * A simplified reference guide for May I? game rules
 */
export function HouseRulesContent() {
  return (
    <div className="space-y-6 text-sm">
      {/* Goal */}
      <section>
        <h3 className="font-semibold text-base mb-2">Goal</h3>
        <p className="text-muted-foreground">
          Complete all 6 hands. The player with the{" "}
          <span className="font-medium text-foreground">lowest total score</span>{" "}
          wins.
        </p>
      </section>

      {/* Card Values */}
      <section>
        <h3 className="font-semibold text-base mb-2">Card Values</h3>
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
      </section>

      {/* Contracts */}
      <section>
        <h3 className="font-semibold text-base mb-2">Contracts by Hand</h3>
        <table className="w-full border-collapse">
          <thead className="sr-only">
            <tr>
              <th scope="col">Hand</th>
              <th scope="col">Contract</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="py-1.5 font-medium">1</td>
              <td className="py-1.5">2 sets</td>
            </tr>
            <tr className="border-b">
              <td className="py-1.5 font-medium">2</td>
              <td className="py-1.5">1 set + 1 run</td>
            </tr>
            <tr className="border-b">
              <td className="py-1.5 font-medium">3</td>
              <td className="py-1.5">2 runs</td>
            </tr>
            <tr className="border-b">
              <td className="py-1.5 font-medium">4</td>
              <td className="py-1.5">3 sets</td>
            </tr>
            <tr className="border-b">
              <td className="py-1.5 font-medium">5</td>
              <td className="py-1.5">2 sets + 1 run</td>
            </tr>
            <tr>
              <td className="py-1.5 font-medium">6</td>
              <td className="py-1.5">1 set + 2 runs *</td>
            </tr>
          </tbody>
        </table>
        <p className="text-xs text-muted-foreground mt-2">
          <span className="font-medium">Set:</span> 3+ cards of same rank
          &nbsp;|&nbsp;
          <span className="font-medium">Run:</span> 4+ cards in sequence, same
          suit
        </p>
      </section>

      {/* Key Rules */}
      <section>
        <h3 className="font-semibold text-base mb-2">Key Rules</h3>
        <ul className="space-y-2">
          <li className="flex gap-2">
            <span className="text-primary font-medium shrink-0">Draw first</span>
            <span className="text-muted-foreground">
              — Always draw before any other action
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-primary font-medium shrink-0">Lay down</span>
            <span className="text-muted-foreground">
              — Must have exact contract, no extras
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-primary font-medium shrink-0">Lay off</span>
            <span className="text-muted-foreground">
              — Add to melds on turns after laying down
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-primary font-medium shrink-0">Wilds</span>
            <span className="text-muted-foreground">
              — 2s and Jokers. Can&apos;t outnumber naturals when laying down
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-primary font-medium shrink-0">May I?</span>
            <span className="text-muted-foreground">
              — Take discard out of turn (+1 penalty card)
            </span>
          </li>
        </ul>
      </section>

      {/* Hand 6 Special Rules */}
      <section className="rounded-lg bg-muted/50 p-3 border">
        <h3 className="font-semibold text-base mb-2">Hand 6 - Final Hand</h3>
        <ul className="space-y-1.5 text-muted-foreground">
          <li>
            <span className="text-foreground font-medium">Must use ALL cards</span>{" "}
            — every card in your hand must form melds
          </li>
          <li>
            <span className="text-foreground font-medium">No laying off</span> —
            no melds exist until someone wins
          </li>
          <li>
            <span className="text-foreground font-medium">Lay down = win</span> —
            whoever lays down first wins the hand
          </li>
          <li>
            <span className="text-foreground font-medium">May I? is risky</span> —
            adds cards you must incorporate
          </li>
        </ul>
      </section>
    </div>
  );
}
