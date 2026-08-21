// Shared AI caller — used by all staff AI assistants.
// Try order: Gemini 2.0 Flash → Gemini 1.5 Flash → Groq fallback
// Returns { ok: true, text } or { ok: false, error, detail }

const MODELS = [
  {
    url:    'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    apiKey: () => process.env.GEMINI_API_KEY,
    id:     'gemini-2.0-flash',
    extra:  {},
  },
  {
    url:    'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    apiKey: () => process.env.GEMINI_API_KEY,
    id:     'gemini-1.5-flash',
    extra:  {},
  },
  {
    url:    'https://api.groq.com/openai/v1/chat/completions',
    apiKey: () => process.env.GROQ_API_KEY,
    id:     'qwen/qwen3.6-27b',
    extra:  { reasoning_effort: 'none' },
  },
  {
    url:    'https://api.groq.com/openai/v1/chat/completions',
    apiKey: () => process.env.GROQ_API_KEY,
    id:     'groq/compound',
    extra:  {},
  },
];

async function callGroqAI(messages, maxTokens = 400) {
  let lastErr = null;

  for (const { url, apiKey, id, extra } of MODELS) {
    const key = apiKey();
    if (!key) { lastErr = `${id} → API key not configured`; continue; }

    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 25000);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({ model: id, messages, temperature: 0.3, max_tokens: maxTokens, ...extra }),
        signal: abort.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        const candidate = await res.json();
        if (candidate?.choices?.[0]?.message?.content) {
          const rawText = candidate.choices[0].message.content;
          const text    = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
          return { ok: true, text };
        }
        lastErr = `${id} → empty content`;
        continue;
      }
      const errText = await res.text();
      lastErr = `${id} → ${res.status}: ${errText.slice(0, 200)}`;
    } catch (fetchErr) {
      clearTimeout(timer);
      lastErr = `${id} → ${fetchErr.name === 'AbortError' ? 'timeout 25s' : fetchErr.message}`;
    }
  }

  return { ok: false, error: 'All AI models failed', detail: lastErr };
}

module.exports = { callGroqAI };
