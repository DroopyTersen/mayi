import { readFile } from "node:fs/promises";
import { validateMayIPlayerGuidance } from "../mayIAgent.player-guidance";

export interface AIPlayerEvalPromptExperimentArguments {
  id: string;
  addendumFile: string;
  mode?: "replace-player-guidance";
}

export interface AIPlayerEvalPromptExperimentInput {
  id: string;
  sourcePath: string;
  addendum: string;
  mode?: "replace-player-guidance";
}

export interface AIPlayerEvalPromptExperimentSnapshot {
  id: string;
  sourcePath: string;
  sha256: string;
  content: string;
  mode?: "replace-player-guidance";
}

export interface AIPlayerEvalPromptSelection {
  version: string;
  sha256: string;
  content: string;
  baseVersion: string;
  baseSha256: string;
  experiment: AIPlayerEvalPromptExperimentSnapshot | null;
  /** Separate identities prevent policy changes from masquerading as rule changes. */
  components?: AIPlayerEvalPromptComponents;
}

interface AIPlayerEvalPromptComponent {
  version: string;
  sha256: string;
}

export interface AIPlayerEvalPromptComponents {
  houseRules: AIPlayerEvalPromptComponent;
  playerGuidance: AIPlayerEvalPromptComponent;
  toolProtocol: AIPlayerEvalPromptComponent;
}

const PROMPT_EXPERIMENT_ID_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

function sha256(content: string): string {
  return new Bun.CryptoHasher("sha256").update(content).digest("hex");
}

function promptComponents(
  content: string,
): AIPlayerEvalPromptComponents | undefined {
  function component(tag: string): AIPlayerEvalPromptComponent | undefined {
    const match = content.match(
      new RegExp(`<${tag} version="([^"]+)">([\\s\\S]*?)<\\/${tag}>`),
    );
    const version = match?.[1];
    const body = match?.[2];
    return version === undefined || body === undefined
      ? undefined
      : { version, sha256: sha256(body) };
  }
  const houseRules = component("house_rules");
  const playerGuidance = component("player_guidance");
  const toolProtocol = component("tool_protocol");
  return houseRules === undefined ||
    playerGuidance === undefined ||
    toolProtocol === undefined
    ? undefined
    : { houseRules, playerGuidance, toolProtocol };
}

function validatePromptExperimentId(id: string): void {
  if (!PROMPT_EXPERIMENT_ID_PATTERN.test(id)) {
    throw new Error(
      "Prompt experiment ID may contain lowercase letters, numbers, dots, dashes, and underscores",
    );
  }
}

export function validateAIPlayerEvalPromptExperimentArguments(
  id: string | undefined,
  addendumFile: string | undefined,
): AIPlayerEvalPromptExperimentArguments | undefined {
  if (id === undefined && addendumFile === undefined) return undefined;
  if (id === undefined || addendumFile === undefined) {
    throw new Error(
      "--prompt-experiment and --prompt-addendum-file must be used together",
    );
  }
  validatePromptExperimentId(id);
  return { id, addendumFile };
}

export function createAIPlayerEvalPromptSelection(options: {
  baseVersion: string;
  baseContent: string;
  experiment?: AIPlayerEvalPromptExperimentInput;
}): AIPlayerEvalPromptSelection {
  const baseSha256 = sha256(options.baseContent);
  const baseComponents = promptComponents(options.baseContent);
  if (options.experiment === undefined) {
    return {
      version: options.baseVersion,
      sha256: baseSha256,
      content: options.baseContent,
      baseVersion: options.baseVersion,
      baseSha256,
      experiment: null,
      ...(baseComponents === undefined ? {} : { components: baseComponents }),
    };
  }

  validatePromptExperimentId(options.experiment.id);
  const addendum = options.experiment.addendum.trim();
  if (addendum.length === 0) {
    throw new Error("Prompt experiment addendum must not be empty");
  }
  validateMayIPlayerGuidance(addendum);
  const experimentalGuidance =
    `<evaluation_strategy_experiment id="${options.experiment.id}">\n` +
    `${addendum}\n` +
    "</evaluation_strategy_experiment>";
  if (options.experiment.mode === "replace-player-guidance" && baseComponents === undefined) {
    throw new Error("Replacement requires structured player guidance");
  }
  const content = options.experiment.mode === "replace-player-guidance"
    ? options.baseContent.replace(
        /<player_guidance version="[^"]+">[\s\S]*?<\/player_guidance>/,
        () => `<player_guidance version="${baseComponents?.playerGuidance.version}+${options.experiment?.id}">\n${addendum}\n</player_guidance>`,
      )
    : baseComponents === undefined
      ? `${options.baseContent.trimEnd()}\n\n${experimentalGuidance}`
      : options.baseContent
          .replace(
            /<player_guidance version="[^"]+">/,
            `<player_guidance version="${baseComponents.playerGuidance.version}+${options.experiment.id}">`,
          )
          .replace(
            "</player_guidance>",
            () => `\n${experimentalGuidance}\n</player_guidance>`,
          );
  const components = promptComponents(content);

  return {
    version: `${options.baseVersion}+${options.experiment.id}`,
    sha256: sha256(content),
    content,
    baseVersion: options.baseVersion,
    baseSha256,
    ...(components === undefined ? {} : { components }),
    experiment: {
      id: options.experiment.id,
      sourcePath: options.experiment.sourcePath,
      sha256: sha256(addendum),
      content: addendum,
      ...(options.experiment.mode === undefined ? {} : { mode: options.experiment.mode }),
    },
  };
}

export async function loadAIPlayerEvalPromptSelection(options: {
  baseVersion: string;
  baseContent: string;
  experiment: AIPlayerEvalPromptExperimentArguments | undefined;
}): Promise<AIPlayerEvalPromptSelection> {
  if (options.experiment === undefined) {
    return createAIPlayerEvalPromptSelection({
      baseVersion: options.baseVersion,
      baseContent: options.baseContent,
    });
  }
  const addendum = await readFile(options.experiment.addendumFile, "utf8");
  return createAIPlayerEvalPromptSelection({
    baseVersion: options.baseVersion,
    baseContent: options.baseContent,
    experiment: {
      id: options.experiment.id,
      sourcePath: options.experiment.addendumFile,
      addendum,
      ...(options.experiment.mode === undefined ? {} : { mode: options.experiment.mode }),
    },
  });
}
