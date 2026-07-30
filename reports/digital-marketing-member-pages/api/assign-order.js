// assign-order.js — persists a manual "Not Assigned -> real group" order
// assignment made from the salesuk.html UI. Added 2026-07-29 per user
// request ("select and add need to select the belongsperson in a drop and
// assigned that order which tab (year)").
//
// There is no database in this stack -- salesuk.js/sales25.js read static
// JSON snapshot files bundled into the serverless deployment, and Vercel's
// filesystem is read-only/ephemeral at runtime. So persistence works by
// committing the change to a small overrides file (api/data/order-overrides.json)
// in the Staff-requirements GitHub repo via the Contents API -- the same repo
// Vercel's git integration already auto-deploys from. A push here triggers a
// normal redeploy (same lag as any other change this session, ~30-90s),
// after which both salesuk.js and sales25.js pick up the new override
// (they check it before running their own GROUPS rules).
//
// Requires a GITHUB_ASSIGN_TOKEN Vercel env var: a GitHub Personal Access
// Token with write (contents) access to digitalmarketing69140951-sys/Staff-requirements.
// Never exposed to the client -- read server-side only.

const GITHUB_REPO = process.env.GITHUB_ASSIGN_REPO || 'digitalmarketing69140951-sys/Staff-requirements';
const GITHUB_BRANCH = process.env.GITHUB_ASSIGN_BRANCH || 'main';
const FILE_PATH = 'api/data/order-overrides.json';

// Every valid destination group, across both years -- kept as an explicit
// allowlist so a malformed/malicious request body can never write an
// arbitrary groupKey into the overrides file.
const VALID_GROUP_KEYS = new Set(['dm-ad', 'meta', 'sonya', 'sajeepan', 'sukirtha', 'organic', 'cppc', 'thishoban', 'theekshy', 'thanishtika', 'jeffri', 'thasitha', 'mahima']);
const VALID_SOURCES = new Set(['salesuk', 'sales25', 'salesde']);

async function githubApi(path, options) {
  const token = process.env.GITHUB_ASSIGN_TOKEN;
  if (!token) throw new Error('Server not configured: GITHUB_ASSIGN_TOKEN missing');
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'aios-salesuk-assign-order',
      ...(options && options.headers),
    },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`GitHub API error ${res.status}: ${json && json.message}`);
  return json;
}

async function readOverrides() {
  try {
    const data = await githubApi(`/repos/${GITHUB_REPO}/contents/${FILE_PATH}?ref=${GITHUB_BRANCH}`, { method: 'GET' });
    const content = Buffer.from(data.content, 'base64').toString('utf8');
    return { overrides: JSON.parse(content || '{}'), sha: data.sha };
  } catch (e) {
    // File doesn't exist yet, or transient error reading it -- start fresh
    // rather than failing the whole assignment; the PUT below will create
    // it if `sha` is undefined.
    return { overrides: {}, sha: undefined };
  }
}

async function writeOverrides(overrides, sha, commitMessage) {
  const content = Buffer.from(JSON.stringify(overrides, null, 2) + '\n', 'utf8').toString('base64');
  const body = { message: commitMessage, content, branch: GITHUB_BRANCH };
  if (sha) body.sha = sha;
  return githubApi(`/repos/${GITHUB_REPO}/contents/${FILE_PATH}`, { method: 'PUT', body: JSON.stringify(body) });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  // GET = audit log ("how do I find out if it's been transferred?") --
  // returns every assignment made so far, straight from the GitHub-committed
  // overrides file, so you can always check what's assigned and to whom
  // without waiting for a redeploy or opening the target tab.
  if (req.method === 'GET') {
    try {
      const { overrides } = await readOverrides();
      const list = Object.entries(overrides).map(([orderId, o]) => ({ orderId, ...o }))
        .sort((a, b) => new Date(b.assignedAt) - new Date(a.assignedAt));
      res.status(200).json({ success: true, count: list.length, assignments: list });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message || 'Unknown error' });
    }
    return;
  }

  if (req.method !== 'POST') { res.status(405).json({ success: false, error: 'Method not allowed' }); return; }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { orderId, orderName, groupKey, source, month, orders } = body;

    // Bulk shape: { orders: [{orderId, orderName}, ...], groupKey, source, month }
    // -- one GitHub commit for the whole batch (added 2026-07-29 per user
    // request: "need to select here by bulk and transfer to person"),
    // rather than one commit per order (slow, and risks two concurrent
    // requests racing on the file's `sha` and clobbering each other).
    const isBulk = Array.isArray(orders);
    const items = isBulk ? orders : [{ orderId, orderName }];

    if (!items.length) return res.status(400).json({ success: false, error: 'orders (or orderId) is required' });
    for (const it of items) {
      if (!it || !it.orderId) return res.status(400).json({ success: false, error: 'Every order needs an orderId' });
    }
    if (!VALID_GROUP_KEYS.has(groupKey)) return res.status(400).json({ success: false, error: `Invalid groupKey "${groupKey}"` });
    if (!VALID_SOURCES.has(source)) return res.status(400).json({ success: false, error: `Invalid source "${source}" (must be salesuk, sales25, or salesde)` });
    if (!month) return res.status(400).json({ success: false, error: 'month is required' });

    const { overrides, sha } = await readOverrides();
    const assignedAt = new Date().toISOString();
    for (const it of items) {
      overrides[String(it.orderId)] = {
        groupKey, source, month,
        orderName: it.orderName || null,
        assignedAt,
      };
    }
    const commitMessage = items.length === 1
      ? `chore: assign order ${items[0].orderName || items[0].orderId} to ${groupKey} (${month}) via salesuk.html Not Assigned tab`
      : `chore: bulk-assign ${items.length} orders to ${groupKey} (${month}) via salesuk.html Not Assigned tab`;
    await writeOverrides(overrides, sha, commitMessage);

    res.status(200).json({
      success: true,
      assignedCount: items.length,
      message: `${items.length} order${items.length === 1 ? '' : 's'} saved. Will appear in the target tab after the site redeploys (usually under a minute).`,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Unknown error' });
  }
};
