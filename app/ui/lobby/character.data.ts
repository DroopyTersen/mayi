export type CharacterCategory = "family" | "hoyle";

export interface Character {
  id: string;
  name: string;
  description: string;
  category: CharacterCategory;
  avatarPath: string;
}

export const FAMILY_CHARACTERS: Character[] = [
  {
    id: "curt",
    name: "Curt",
    description: "The patriarch with decades of card game wisdom",
    category: "family",
    avatarPath: "/avatars/curt.svg",
  },
  {
    id: "kate",
    name: "Kate",
    description: "Strategic thinker who always has a plan",
    category: "family",
    avatarPath: "/avatars/kate.svg",
  },
  {
    id: "andrew",
    name: "Andrew",
    description: "Tech-savvy player with quick reflexes",
    category: "family",
    avatarPath: "/avatars/andrew.svg",
  },
  {
    id: "natalie",
    name: "Natalie",
    description: "Creative player who loves surprises",
    category: "family",
    avatarPath: "/avatars/natalie.svg",
  },
  {
    id: "jane",
    name: "Jane",
    description: "Calm and collected under pressure",
    category: "family",
    avatarPath: "/avatars/jane.svg",
  },
];

export const HOYLE_CHARACTERS: Character[] = [
  {
    id: "bart",
    name: "Bart",
    description: "Southern born and bred. Don't let the accent fool you.",
    category: "hoyle",
    avatarPath: "/avatars/bart.svg",
  },
  {
    id: "primus",
    name: "Primus",
    description: "Logical, calculating, speaks in a mechanical manner.",
    category: "hoyle",
    avatarPath: "/avatars/primus.svg",
  },
  {
    id: "maurice",
    name: "Maurice",
    description: "Communicates through his puppet. French accent and flair.",
    category: "hoyle",
    avatarPath: "/avatars/maurice.svg",
  },
  {
    id: "langley",
    name: "Langley",
    description: "Pompous lawyer who sounds like Thurston Howell III.",
    category: "hoyle",
    avatarPath: "/avatars/langley.svg",
  },
  {
    id: "ethel",
    name: "Ethel",
    description: "One tough cookie - sweet exterior, fierce competitor.",
    category: "hoyle",
    avatarPath: "/avatars/ethel.svg",
  },
  {
    id: "jasper",
    name: "Jasper",
    description: "Yapping old guy - talkative, opinionated, full of stories.",
    category: "hoyle",
    avatarPath: "/avatars/jasper.svg",
  },
  {
    id: "elayne",
    name: "Elayne",
    description: "Tough Brooklynite. Sassy, confident, takes no nonsense.",
    category: "hoyle",
    avatarPath: "/avatars/elayne.svg",
  },
  {
    id: "robin",
    name: "Robin",
    description: "Park ranger - outdoorsy, wholesome, calm under pressure.",
    category: "hoyle",
    avatarPath: "/avatars/robin.svg",
  },
];

export const ALL_CHARACTERS: Character[] = [
  ...FAMILY_CHARACTERS,
  ...HOYLE_CHARACTERS,
];

export function getCharacterById(id: string): Character | undefined {
  return ALL_CHARACTERS.find((c) => c.id === id);
}
