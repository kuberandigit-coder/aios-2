// Shared AI caller — used by all staff AI assistants.
// Returns { ok: true, text } or { ok: false, error, detail }

const MODELS = [
  {
    url:    'https://api.groq.com/openai/v1/chat/completions',
    apiKey: () => process.env.GROQ_API_KEY,
    id:     'qwen/qwen3.6-27b',
    extra:  { reasoning_effort: 'none' },
  },
  {
    url:    'https://api.groq.com/openai/v1/chat/completions',
    apiKey: () => process.env.GROQ_API_KEY,
    id:     'llama-3.1-70b-versatile',
    extra:  {},
  },
  {
    url:    'https://api.groq.com/openai/v1/chat/completions',
    apiKey: () => process.env.GROQ_API_KEY,
    id:     'llama-3.1-8b-instant',
    extra:  {},
  },
];

async function callGroqAI(messages, maxTokens = 400) {
  const allErrs = [];

  for (const { url, apiKey, id, extra } of MODELS) {
    const key = apiKey();
    if (!key) { allErrs.push(`${id}→no_key`); continue; }

    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 20000);
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
        allErrs.push(`${id}→empty`);
        continue;
      }
      const errText = await res.text();
      allErrs.push(`${id}→${res.status}:${errText.slice(0, 120)}`);
    } catch (fetchErr) {
      clearTimeout(timer);
      allErrs.push(`${id}→${fetchErr.name === 'AbortError' ? 'timeout' : fetchErr.message}`);
    }
  }

  return { ok: false, error: 'All AI models failed', detail: allErrs.join(' | ') };
}

module.exports = { callGroqAI };
