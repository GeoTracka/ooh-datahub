export type ProviderUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type ProviderEvent =
  | { type: "text_delta"; delta: string }
  | { type: "function_call"; callId: string; name: string; arguments: string }
  | { type: "completed"; responseId: string; usage: ProviderUsage }
  | { type: "failed"; code: string };

export type ProviderRequest = {
  input: unknown[];
  tools: readonly unknown[];
  safetyIdentifier: string;
  maxToolCalls: number;
  signal?: AbortSignal;
};

export type PlannerProvider = {
  stream(request: ProviderRequest): AsyncIterable<ProviderEvent>;
};
