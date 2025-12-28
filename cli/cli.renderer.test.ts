import { describe, it, expect } from "bun:test";

describe("renderCard", () => {
  it.todo("renders 9H as '9\u2665'", () => {});

  it.todo("renders 10D as '10\u2666'", () => {});

  it.todo("renders JS as 'J\u2660'", () => {});

  it.todo("renders QC as 'Q\u2663'", () => {});

  it.todo("renders KH as 'K\u2665'", () => {});

  it.todo("renders AD as 'A\u2666'", () => {});

  it.todo("renders 2S as '2\u2660'", () => {});

  it.todo("renders Joker as 'Joker'", () => {});

  it.todo("uses unicode suit symbols", () => {});
});

describe("renderHand", () => {
  it.todo("displays cards in order", () => {});

  it.todo("separates cards with spaces", () => {});

  it.todo("example: '3\u2665 5\u2666 9\u2663 J\u2660 Joker'", () => {});
});

describe("renderNumberedHand (for selection)", () => {
  it.todo("displays position numbers with cards", () => {});

  it.todo(
    "example: '1:3\u2665 2:5\u2666 3:9\u2663 4:J\u2660 5:Joker'",
    () => {}
  );

  it.todo("positions are 1-indexed for human readability", () => {});
});

describe("renderGameState", () => {
  it.todo("shows current round", () => {});

  it.todo("shows all players with card counts", () => {});

  it.todo("shows current player indicator", () => {});

  it.todo("shows discard pile top card", () => {});

  it.todo("shows stock pile count", () => {});

  it.todo("shows current player's hand", () => {});
});
