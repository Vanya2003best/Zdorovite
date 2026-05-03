/**
 * Qwen (DashScope) client — server-only.
 *
 * Used by /studio/design AI features (item-level variant generation).
 * Compatible-mode endpoint speaks the OpenAI chat-completions wire format,
 * so no Alibaba-specific SDK is needed — plain fetch + JSON.
 *
 * The caller is expected to pass a system prompt that instructs the model
 * to return JSON, and the response_format hint forces it. We then parse
 * the assistant content as JSON and hand back to the caller as a typed T.
 *
 * Errors are returned as `{ error }` (not thrown) so server actions can
 * surface them to the client without unwrapping try/catch.
 */

const QWEN_URL =
  "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions";

type CallOpts = {
  systemPrompt: string;
  userPrompt: string;
  /** 0..1 — higher = more variation between calls. Default 0.7. */
  temperature?: number;
  /** Override the default model. qwen-plus is good price/quality for Polish. */
  model?: string;
  /** AbortSignal for client-cancelled requests. */
  signal?: AbortSignal;
};

export async function callQwen<T>(
  opts: CallOpts,
): Promise<T | { error: string }> {
  const key = process.env.QWEN_API_KEY;
  if (!key) {
    return { error: "AI nie jest skonfigurowane (brak QWEN_API_KEY)" };
  }

  const body = {
    model: opts.model ?? "qwen-plus",
    messages: [
      { role: "system", content: opts.systemPrompt },
      { role: "user", content: opts.userPrompt },
    ],
    temperature: opts.temperature ?? 0.7,
    // Forces the model to emit valid JSON. The system prompt still has to
    // tell it which schema — response_format is just a syntactic guard.
    response_format: { type: "json_object" },
  };

  let res: Response;
  try {
    res = await fetch(QWEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: opts.signal,
      // No caching — every AI call should hit the model fresh.
      cache: "no-store",
    });
  } catch (e) {
    return { error: `AI: błąd sieci (${(e as Error).message})` };
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    // Trim because Qwen's HTML error pages are huge.
    return { error: `AI ${res.status}: ${txt.slice(0, 200)}` };
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return { error: "AI zwrócił niepoprawny JSON nadrzędny" };
  }

  // Type-safe-ish unwrap of the OpenAI-shaped response.
  const content = (
    data as {
      choices?: { message?: { content?: string } }[];
    }
  )?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.length === 0) {
    return { error: "AI zwrócił pustą odpowiedź" };
  }

  try {
    return JSON.parse(content) as T;
  } catch {
    return { error: "AI zwrócił niepoprawny JSON treści" };
  }
}
