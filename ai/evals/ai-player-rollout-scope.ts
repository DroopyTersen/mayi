import type { AIPlayerShortRolloutScenario } from "./ai-player-short-rollout-scenario";

export const AI_PLAYER_ROLLOUT_SCOPE_VERSION = "rollout-scope-v2";
export type AIPlayerRolloutScope = "strategy" | "robustness" | "quarantine";
export type AIPlayerRolloutSelectionScope =
  | "strategy"
  | "robustness"
  | "all-eligible";
type Split = "development" | "holdout" | "all";

export interface AIPlayerRolloutScopeDefinition {
  readonly scope: AIPlayerRolloutScope;
  readonly familyId: string;
  /** Independence from the unresolved Hands 1-5 initial-meld extension dispute. */
  readonly ruleStatus: "independent" | "disputed";
  readonly historySource:
    | "replayed-public-actions"
    | "constructed-fixture-history"
    | "no-recorded-prelude";
  readonly physicalInventory: "conserved-108" | "fixture-only";
  readonly reason: string;
}

function classified(
  scope: AIPlayerRolloutScope,
  familyId: string,
  reason: string,
  details: Partial<
    Pick<
      AIPlayerRolloutScopeDefinition,
      "ruleStatus" | "historySource" | "physicalInventory"
    >
  > = {},
): AIPlayerRolloutScopeDefinition {
  return {
    scope,
    familyId,
    reason,
    ruleStatus: "independent",
    historySource: "no-recorded-prelude",
    physicalInventory: "fixture-only",
    ...details,
  };
}

/** Eligibility is prospective and score-blind. Never rewrite historical results. */
export const AI_PLAYER_ROLLOUT_SCOPE: Readonly<
  Record<string, AIPlayerRolloutScopeDefinition>
> = {
  "plan-call-may-i-and-go-out": classified(
    "quarantine",
    "may-i-contract-conversion",
    "Full credit requires a four-card initial Hand 1 set, conflicting with house rules section 8; reduced mechanics fixture.",
    { ruleStatus: "disputed" },
  ),
  "pass-may-i-before-stock-exhaustion": classified(
    "robustness",
    "stock-boundary",
    "Rare exhaustion mechanics fixture with an incomplete deck and reduced not-down hands; not representative strategic play.",
  ),
  "claim-may-i-to-complete-contract": classified(
    "robustness",
    "may-i-priority",
    "Exact-size contract and priority check, but reduced hands/incomplete deck do not represent a reachable ordinary game.",
  ),
  "allow-may-i-to-avoid-joker-liability": classified(
    "robustness",
    "may-i-liability",
    "Useful penalty/allow mechanics check in a reduced-hand, incomplete-deck fixture; not a representative strategic population.",
  ),
  "swap-joker-to-unlock-contract": classified(
    "robustness",
    "joker-swap",
    "Useful swap/reuse sequence with exact minimum melds, but reduced hands and incomplete table/physical inventory are mechanics-only.",
  ),
  "sequence-layoffs-to-go-out": classified(
    "robustness",
    "layoff-sequencing",
    "Useful legal layoff ordering check; incomplete deck and table ownership/contract setup are not realistic game provenance.",
  ),
  "avoid-publicly-collected-rank": classified(
    "quarantine",
    "public-pickup-tracking",
    "Constructed history asserts a 7-diamond pickup missing from every fixture zone, without a disposal trail; tracking evidence needs repair.",
    { historySource: "constructed-fixture-history" },
  ),
  "preserve-future-layoff-cards": classified(
    "robustness",
    "future-layoffs",
    "Exact-size contract and delayed layoff mechanics, but reduced not-down hands and incomplete inventory preclude representative strategy claims.",
  ),
  "include-extended-run-to-go-out": classified(
    "quarantine",
    "extended-initial-contract",
    "Full credit requires an eight-card initial Hand 2 run, conflicting with house rules section 8.",
    { ruleStatus: "disputed" },
  ),
  "prioritize-own-contract-over-public-layoff": classified(
    "quarantine",
    "own-contract-priority",
    "Full credit requires a seven-card initial Hand 2 set, conflicting with house rules section 8.",
    { ruleStatus: "disputed" },
  ),
  "hand6-take-discard-to-win": classified(
    "robustness",
    "hand6-known-discard",
    "Valid immediate Hand 6 all-card contract check, but incomplete deck and excess physical copies make this a mechanics fixture.",
  ),
  "avoid-publicly-collected-run-gap": classified(
    "quarantine",
    "public-pickup-tracking",
    "Synthetic 8-heart/10-heart signals lack replay/disposal provenance and 8-heart is not currently held. Quarantined pending evidence repair, not proof the pickup never happened.",
    { historySource: "constructed-fixture-history" },
  ),
  "respect-same-suit-run-gap": classified(
    "robustness",
    "same-suit-run-gap",
    "Retained holdout for run-gap mechanics; incomplete inventory and excess copies do not establish a realistic strategic position.",
  ),
  "decline-unusable-joker-swap": classified(
    "robustness",
    "joker-liability",
    "Retained holdout for conditional Joker liability; physical-copy inventory is not valid and the continuation is a declared diagnostic.",
  ),
  "hand6-discard-unmeldable-extra": classified(
    "robustness",
    "hand6-all-card-contract",
    "Retained holdout for no partial Hand 6 laydown; incomplete deck/excess copies are mechanics-only rather than representative strategy.",
  ),
  "call-may-i-with-recyclable-stock": classified(
    "robustness",
    "stock-boundary",
    "Retained holdout for stock recycling and claim mechanics; artificial reduced inventory is not ordinary-play evidence.",
  ),
  "hand6-preserve-options-natural": classified(
    "strategy",
    "hand6-draw-coverage",
    "Conserved full deck, eleven-card start, exhaustive public-information next-draw coverage oracle and legal inferior control; natural continuation.",
    { physicalInventory: "conserved-108" },
  ),
  "hand6-preserve-options-wild": classified(
    "strategy",
    "hand6-draw-coverage",
    "Same validated strategic root with a wild continuation; planning coverage and subsequent conversion are graded separately.",
    { physicalInventory: "conserved-108" },
  ),
  "pass-may-i-before-delayed-exhaustion": classified(
    "robustness",
    "stock-boundary",
    "Conserved inventory but deliberately rare claim-heavy exhaustion boundary; owner rejected it as representative skill evidence.",
    { physicalInventory: "conserved-108" },
  ),
  "call-may-i-with-two-more-reserves": classified(
    "robustness",
    "stock-boundary",
    "Larger-reserve reversal of the rare exhaustion boundary; preserve robustness coverage without using it as headline strategy.",
    { physicalInventory: "conserved-108" },
  ),
  "contract-horizon-safe-natural": classified(
    "strategy",
    "contract-horizon",
    "Full physical inventory, replayed public evidence, exact minimum contracts and legal outcome controls; conditional safe natural continuation.",
    {
      physicalInventory: "conserved-108",
      historySource: "replayed-public-actions",
    },
  ),
  "contract-horizon-safe-wild": classified(
    "strategy",
    "contract-horizon",
    "Same contract-planning root with a wild continuation; replayed evidence and legal opposing-contract control, not an independent root.",
    {
      physicalInventory: "conserved-108",
      historySource: "replayed-public-actions",
    },
  ),
  "contract-horizon-known-exit": classified(
    "strategy",
    "contract-horizon",
    "Replayed retained-card evidence establishes an opponent exit; exact minimum contracts and outcome control test the reversed horizon.",
    {
      physicalInventory: "conserved-108",
      historySource: "replayed-public-actions",
    },
  ),
  "shared-run-delay-natural": classified(
    "strategy",
    "shared-run-timing",
    "Deal-reachable physical position and replayed retained-card evidence; responsive own-hand/public-table opponent tests a conditional natural continuation.",
    {
      physicalInventory: "conserved-108",
      historySource: "replayed-public-actions",
    },
  ),
  "shared-run-delay-wild": classified(
    "strategy",
    "shared-run-timing",
    "Same deal-reachable bridge decision with a wild continuation; accepted alternate liability discards and legal losing control.",
    {
      physicalInventory: "conserved-108",
      historySource: "replayed-public-actions",
    },
  ),
  "shared-run-take-immediate-win": classified(
    "strategy",
    "shared-run-timing",
    "Deal-reachable immediate-exit reversal prevents blanket bridge withholding; exact initial contracts and replayed public provenance.",
    {
      physicalInventory: "conserved-108",
      historySource: "replayed-public-actions",
    },
  ),
  "contested-run-diamonds-natural": classified(
    "strategy",
    "contested-run-planning",
    "Full-deal public replay and exact-contract draw coverage distinguish competing run plans; conditional next-draw timing, not global discard safety.",
    {
      physicalInventory: "conserved-108",
      historySource: "replayed-public-actions",
    },
  ),
  "contested-run-diamonds-wild": classified(
    "strategy",
    "contested-run-planning",
    "Same public-evidence root with a wild continuation separates informed commitment from lucky conversion; not an independent root.",
    {
      physicalInventory: "conserved-108",
      historySource: "replayed-public-actions",
    },
  ),
  "contested-run-spades-natural": classified(
    "strategy",
    "contested-run-planning",
    "Suit-mirrored public-pickup root tests available completing copies instead of a fixed suit preference; full-deal replay.",
    {
      physicalInventory: "conserved-108",
      historySource: "replayed-public-actions",
    },
  ),
  "contested-run-stronger-diamonds": classified(
    "strategy",
    "contested-run-planning",
    "Boundary-run reversal retains the stronger contested plan under the explicit exchangeable next-draw model; full-deal replay.",
    {
      physicalInventory: "conserved-108",
      historySource: "replayed-public-actions",
    },
  ),
  "contested-run-high-diamonds-holdout": classified(
    "strategy",
    "contested-run-planning",
    "Rank-shifted near-transfer holdout of public-copy draw coverage, not a previously unseen strategic family; full-deal replay.",
    {
      physicalInventory: "conserved-108",
      historySource: "replayed-public-actions",
    },
  ),
  "contested-run-upper-boundary-holdout": classified(
    "strategy",
    "contested-run-planning",
    "Upper-boundary near-transfer holdout of the stronger contested-plan reversal, not an independent strategic family; full-deal replay.",
    {
      physicalInventory: "conserved-108",
      historySource: "replayed-public-actions",
    },
  ),
};

export function getAIPlayerRolloutScope(
  scenarioId: string,
): AIPlayerRolloutScopeDefinition {
  const definition = AI_PLAYER_ROLLOUT_SCOPE[scenarioId];
  if (!Object.hasOwn(AI_PLAYER_ROLLOUT_SCOPE, scenarioId) || !definition)
    throw new Error(`Unclassified short rollout scenario: ${scenarioId}`);
  return definition;
}

interface SelectionCase extends AIPlayerRolloutScopeDefinition {
  scenarioId: string;
  split: "development" | "holdout";
}
export interface AIPlayerRolloutSelection {
  scopeVersion: string;
  requestedScope: AIPlayerRolloutSelectionScope;
  split: Split;
  fullEligibleSplit: boolean;
  selected: SelectionCase[];
  excluded: (SelectionCase & {
    exclusion: "quarantine" | "split" | "scope" | "not-requested";
  })[];
  coverage: {
    strategyDevelopmentCases: number;
    strategyDevelopmentFamilies: string[];
    strategyHoldoutCases: number;
    strategyHoldoutFamilies: string[];
  };
}

export function buildAIPlayerRolloutSelection(
  scenarios: readonly AIPlayerShortRolloutScenario[],
  options: {
    split: Split;
    scope: AIPlayerRolloutSelectionScope;
    scenarioIds?: readonly string[];
  },
): AIPlayerRolloutSelection {
  const catalog = scenarios.map((scenario) => ({
    scenarioId: scenario.identity.id,
    split: scenario.identity.split,
    ...getAIPlayerRolloutScope(scenario.identity.id),
  }));
  const requested = options.scenarioIds;
  if (requested && new Set(requested).size !== requested.length)
    throw new Error("Duplicate short rollout scenario IDs");
  for (const id of requested ?? []) {
    const entry = catalog.find((item) => item.scenarioId === id);
    if (!entry) throw new Error(`Unknown short rollout scenario: ${id}`);
    if (entry.scope === "quarantine")
      throw new Error(`Scenario ${id} is in quarantine: ${entry.reason}`);
    if (options.split !== "all" && entry.split !== options.split)
      throw new Error(`Scenario ${id} is outside split ${options.split}`);
    if (options.scope !== "all-eligible" && entry.scope !== options.scope)
      throw new Error(`Scenario ${id} is outside scope ${options.scope}`);
  }
  const selected: SelectionCase[] = [];
  const excluded: AIPlayerRolloutSelection["excluded"] = [];
  for (const entry of catalog) {
    const exclusion =
      entry.scope === "quarantine"
        ? "quarantine"
        : options.split !== "all" && entry.split !== options.split
          ? "split"
          : options.scope !== "all-eligible" && entry.scope !== options.scope
            ? "scope"
            : requested && !requested.includes(entry.scenarioId)
              ? "not-requested"
              : undefined;
    if (exclusion) excluded.push({ ...entry, exclusion });
    else selected.push(entry);
  }
  if (selected.length === 0)
    throw new Error(
      `No short rollout scenarios selected for split ${options.split}, scope ${options.scope}`,
    );
  const strategyCases = (split: "development" | "holdout") =>
    catalog.filter(
      (entry) => entry.scope === "strategy" && entry.split === split,
    );
  const families = (split: "development" | "holdout") =>
    [...new Set(strategyCases(split).map((entry) => entry.familyId))].sort();
  return {
    scopeVersion: AI_PLAYER_ROLLOUT_SCOPE_VERSION,
    requestedScope: options.scope,
    split: options.split,
    fullEligibleSplit:
      selected.length ===
      catalog.filter(
        (entry) =>
          entry.scope !== "quarantine" &&
          (options.split === "all" || entry.split === options.split),
      ).length,
    selected,
    excluded,
    coverage: {
      strategyDevelopmentCases: strategyCases("development").length,
      strategyDevelopmentFamilies: families("development"),
      strategyHoldoutCases: strategyCases("holdout").length,
      strategyHoldoutFamilies: families("holdout"),
    },
  };
}

export function summarizeAIPlayerRolloutScopeScores(
  results: readonly { scenarioId: string; qualityPercent: number }[],
) {
  const scoped = results.map((result) => ({
    ...result,
    scope: getAIPlayerRolloutScope(result.scenarioId).scope,
  }));
  if (scoped.some((result) => result.scope === "quarantine"))
    throw new Error(
      "Cannot score quarantine cases in an eligible rollout summary",
    );
  const aggregate = (scope: "strategy" | "robustness") => {
    const entries = scoped.filter((result) => result.scope === scope);
    return {
      caseCount: entries.length,
      qualityPercent:
        entries.length === 0
          ? null
          : entries.reduce(
              (total, result) => total + result.qualityPercent,
              0,
            ) / entries.length,
    };
  };
  return {
    strategy: aggregate("strategy"),
    robustness: aggregate("robustness"),
  };
}
