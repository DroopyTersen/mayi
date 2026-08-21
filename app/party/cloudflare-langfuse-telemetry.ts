import { tracing } from "cloudflare:workers";
import {
  createLangfuseAITelemetry,
  type LangfuseGameContext,
} from "../../ai/langfuse-ai-telemetry";

export function createCloudflareLangfuseTelemetry(
  context: LangfuseGameContext,
) {
  return createLangfuseAITelemetry(
    {
      enterSpan: (name, callback) => tracing.enterSpan(name, callback),
    },
    context,
  );
}
