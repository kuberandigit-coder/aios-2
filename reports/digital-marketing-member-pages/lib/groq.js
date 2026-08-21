// Shared Groq API caller — used by all staff AI assistants.
// Returns { ok: true, text } or { ok: false, error, detail }

const GROQ_MODELS = [
  { id: 'qwen/qwen3.6-27b',       extra: { reasoning_effort: 'none' } },
  { id: 'llama3-70b-8192',         extra: {} },
  { id: 'llama-3.1-8b-instant',    extra: {} },
  { id: 'gemma2-9b-it',            extra: {} },
];

async function callGroqAI(messages, maxTokens = 400) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return { ok: false, error: 'GROQ_API_KEY not configured', detail: null };

  let groqData = null;
  let lastErr   = null;

  for (const { id, extra } of GROQ_MODELS) {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 20000);
    try {
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: id, messages, temperature: 0.3, max_tokens: maxTokens, ...extra }),
        signal: abort.signal,
      });
      clearTimeout(timer);
      if (groqRes.ok) {
        const candidate = await groqRes.json();
        if (candidate?.choices?.[0]?.message?.content) { groqData = candidate; break; }
        lastErr = `${id} → empty content`;
        continue;
      }
      const errText = await groqRes.text();
      lastErr = `${id} → ${groqRes.status}: ${errText.slice(0, 200)}`;
    } catch (fetchErr) {
      clearTimeout(timer);
      lastErr = `${id} → ${fetchErr.name === 'AbortError' ? 'timeout 20s' : fetchErr.message}`;
    }
  }

  const isRateLimit = lastErr && /429|rate.?limit/i.test(lastErr);
  if (!groqData) return {
    ok: false,
    error: isRateLimit
      ? 'AI rate limit reached. Please wait a moment and try again.'
      : 'All AI models failed',
    detail: lastErr,
  };

  const rawText = groqData.choices[0].message.content;
  const text    = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  return { ok: true, text };
}

module.exports = { callGroqAI };
