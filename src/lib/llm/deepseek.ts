/**
 * Minimal DeepSeek chat client (OpenAI-compatible API, https://api-docs.deepseek.com/).
 * Uses JSON output mode with thinking disabled: summaries are short and need no reasoning.
 */
const ENDPOINT = 'https://api.deepseek.com/chat/completions';
const TIMEOUT_MS = 180_000;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface JsonChatResult {
  json: unknown;
  model: string;
  usage: { promptTokens: number; completionTokens: number; cacheHitTokens: number };
}

export class DeepSeekError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
  }
}

export async function chatJson(opts: {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
}): Promise<JsonChatResult> {
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${opts.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: opts.model,
        messages: opts.messages,
        response_format: { type: 'json_object' },
        thinking: { type: 'disabled' },
        temperature: opts.temperature ?? 0.3,
        max_tokens: opts.maxTokens ?? 8000,
        stream: false,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new DeepSeekError(`Request failed: ${(err as Error).message}`, true);
  }

  // Non-streaming responses may be padded with blank keep-alive lines; JSON.parse ignores them.
  const raw = await res.text();
  if (!res.ok) {
    const retryable = res.status === 429 || res.status >= 500;
    throw new DeepSeekError(`HTTP ${res.status}: ${raw.trim().slice(0, 300)}`, retryable);
  }

  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new DeepSeekError('Response was not JSON.', true);
  }
  const choice = body.choices?.[0];
  const content: string = choice?.message?.content ?? '';
  if (choice?.finish_reason === 'length') throw new DeepSeekError('Output hit max_tokens and was cut off.', false);
  if (choice?.finish_reason === 'content_filter') throw new DeepSeekError('Output blocked by content filter.', false);
  // JSON mode returns spaces when it can't produce valid JSON.
  if (!content.trim()) throw new DeepSeekError('Empty content (JSON mode could not produce JSON).', true);

  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch {
    throw new DeepSeekError('Content was not valid JSON.', true);
  }

  return {
    json,
    model: body.model ?? opts.model,
    usage: {
      promptTokens: body.usage?.prompt_tokens ?? 0,
      completionTokens: body.usage?.completion_tokens ?? 0,
      cacheHitTokens: body.usage?.prompt_cache_hit_tokens ?? 0,
    },
  };
}

/** One retry after a pause for retryable failures. */
export async function chatJsonWithRetry(opts: Parameters<typeof chatJson>[0]): Promise<JsonChatResult> {
  try {
    return await chatJson(opts);
  } catch (err) {
    if (!(err instanceof DeepSeekError) || !err.retryable) throw err;
    await new Promise((r) => setTimeout(r, 5_000));
    return chatJson(opts);
  }
}
