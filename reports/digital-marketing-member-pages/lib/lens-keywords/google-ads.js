'use strict';

// lib/lens-keywords/google-ads.js
//
// READ-ONLY existing Google Ads evidence (Stage 23/24/28) — Ledsone DB only.
//
// CRITICAL DISTINCTION (governing prompt §24): this module reads EXISTING
// CAMPAIGN keyword/performance data. It is NOT Keyword Planner and must never
// be labelled as such — see keyword-planner.js for the actual Planner
// integration (blocked pending a Google Ads API credential, per the
// 2026-08-24 discovery). Every value returned here carries an explicit
// provenance label so the UI can never conflate the two.

const { SAJEEPAN } = require('./config');

const PROVENANCE = Object.freeze({
  EXISTING_CAMPAIGN_KEYWORD: 'Existing Campaign Keyword',
  EXISTING_KEYWORD_PERFORMANCE: 'Existing Keyword Performance',
});

/**
 * Look up existing Sajeepan campaign keywords whose text matches (or
 * contains) the given normalized term, with aggregate performance where it
 * exists. Read-only, scoped to Sajeepan's campaigns only.
 */
async function findExistingEvidence(client, terms) {
  const list = (terms || []).map((t) => String(t).trim().toLowerCase()).filter(Boolean);
  if (!list.length) return {};

  const { rows } = await client.query(
    `WITH scope AS (
       SELECT campaign_id FROM google_ads.campaigns WHERE group_name = $1
     )
     SELECT k.criterion_id, k.keyword_text, k.match_type, k.status,
            COALESCE(SUM(p.impressions), 0) AS impressions,
            COALESCE(SUM(p.clicks), 0) AS clicks,
            COALESCE(SUM(p.cost), 0) AS cost,
            COALESCE(SUM(p.conversions), 0) AS conversions
       FROM google_ads.keywords k
       JOIN scope s ON s.campaign_id = k.campaign_id
       LEFT JOIN google_ads.keyword_performance p
              ON p.criterion_id = k.criterion_id AND p.campaign_id = k.campaign_id
      WHERE lower(k.keyword_text) = ANY($2::text[])
      GROUP BY k.criterion_id, k.keyword_text, k.match_type, k.status`,
    [SAJEEPAN.GROUP_NAME, list]
  );

  const out = {};
  for (const r of rows) {
    const key = String(r.keyword_text).toLowerCase();
    out[key] = {
      provenance: PROVENANCE.EXISTING_CAMPAIGN_KEYWORD,
      keyword_text: r.keyword_text,
      match_type: r.match_type,
      status: r.status,
      performance: {
        provenance: PROVENANCE.EXISTING_KEYWORD_PERFORMANCE,
        impressions: Number(r.impressions) || 0,
        clicks: Number(r.clicks) || 0,
        cost: Number(r.cost) || 0,
        conversions: Number(r.conversions) || 0,
      },
    };
  }
  return out;
}

module.exports = { PROVENANCE, findExistingEvidence };
