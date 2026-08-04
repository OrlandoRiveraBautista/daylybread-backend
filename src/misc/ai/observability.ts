import { AiFeature } from "./config";

type AiLogEvent = {
  feature: AiFeature;
  userId?: string;
  latencyMs: number;
  ok: boolean;
  model?: string;
  streaming?: boolean;
  errorName?: string;
  meta?: Record<string, string | number | boolean | undefined>;
};

/**
 * Lightweight structured logging for AI calls.
 * Set LANGCHAIN_TRACING_V2=true + LANGCHAIN_API_KEY for LangSmith traces.
 */
export function logAiEvent(event: AiLogEvent): void {
  const payload = {
    type: "ai_call",
    ...event,
    at: new Date().toISOString(),
  };

  if (event.ok) {
    console.log(JSON.stringify(payload));
  } else {
    console.error(JSON.stringify(payload));
  }
}

export async function timedAiCall<T>(
  event: Omit<AiLogEvent, "latencyMs" | "ok" | "errorName">,
  fn: () => Promise<T>
): Promise<T> {
  const started = Date.now();
  try {
    const result = await fn();
    logAiEvent({
      ...event,
      latencyMs: Date.now() - started,
      ok: true,
    });
    return result;
  } catch (error) {
    logAiEvent({
      ...event,
      latencyMs: Date.now() - started,
      ok: false,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    throw error;
  }
}
