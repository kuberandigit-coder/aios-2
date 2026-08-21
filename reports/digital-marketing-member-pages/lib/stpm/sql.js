'use strict';

// lib/stpm/sql.js
//
// REQ-DM-2026-08-MAHI01 — READ-ONLY Ledsone access.
//
// Ledsone is the ONLY source of current Google Ads and Shopify truth for this
// feature. Nothing in this file writes. Every statement is parameterised.
//
// ── THE CANONICAL SEARCH-TERM SOURCE RULE ────────────────────────────────────
// campaign_search_term_data holds TWO different kinds of row:
//   * insight_id IS NULL  -> real Search/Shopping metric rows (have ad_group_id)
//   * insight_id NOT NULL -> PMax search-term INSIGHT rows: category groupings
//                            with NO ad_group_id and cost NULL by design
// The full-LEDSONE audit proved the insight rows share ~90% of their
// (date, search_term) keys with real PMax metric rows while disagreeing on every
// metric. Unioning them inflated the dataset ~14.9x and was the entire source of
// the apparent "44.6% NULL cost".
//
// So the canonical rule is:
//   campaign_search_term_data WHERE insight_id IS NULL   (Search/Shopping metrics)
//   UNION ALL
//   pmax_campaign_search_term_data                        (PMax metrics)
// campaign_search_term_insights is a DIMENSION, never part of the metric union.
//
// ── SHOPIFY JOIN KEYS (two different key spaces — a real trap) ───────────────
//   shopify_listing_meta.product_id -> shopify_listings.item_id::bigint  (Shopify product id)
//   shopify_listing_tag.product_id  -> shopify_listings.id               (internal integer PK)
// Joining tags on item_id returns ZERO rows. Tags are aggregated in a subquery
// so the ~8.3 tags/product never fan the product row out.
//
// Grain: matching runs against ACTIVE PARENT products only. Child/variant rows
// carry no description and no handle, and would multiply one product into many.

const { Pool } = require('pg');
const { MAHIMA, ledsoneUrl } = require('./config');

let pool = null;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: ledsoneUrl(),
      ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false },
      max: 3,
      // Short, for the same reason as the Neon pool: a run leaves this pool
      // idle while product matching runs, and a long-idle socket can be closed
      // server-side without the client noticing.
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 15000,
      keepAlive: true,
    });
    pool.on('error', () => { /* pool self-heals; never crash the function */ });
  }
  return pool;
}

/**
 * Check out a client with an error listener attached.
 * `pool.on('error')` only covers idle clients; a checked-out client that loses
 * its connection between statements would otherwise emit an unhandled 'error'
 * and take the process down instead of rejecting the caller.
 */
async function connect() {
  const client = await getPool().connect();
  const onError = () => { /* surfaced to the caller via the rejected query */ };
  client.on('error', onError);
  const release = client.release.bind(client);
  client.release = (err) => {
    client.removeListener('error', onError);
    return release(err);
  };
  return client;
}

/**
 * Connection-level failures, as opposed to SQL errors.
 * These mean "the socket is gone", and the same statement is safe to retry.
 */
function isConnectionError(err) {
  const m = String((err && err.message) || '');
  return /Connection terminated|Client has encountered a connection error|socket hang up|ECONNRESET|EPIPE|ETIMEDOUT|server closed the connection/i.test(m);
}

/**
 * Run a read query, retrying ONCE if the pooled connection turned out to be dead.
 *
 * Why this is needed: a run spends a long time matching products in memory
 * between Ledsone reads — measured at ~86 s for a one-month window. Postgres
 * (and any proxy in front of it) will close a connection that has been idle
 * that long, and `pg` has no validation step, so the pool can hand back a
 * socket that is already gone. Without a retry the whole run fails at the last
 * read, after all the expensive work has been done.
 *
 * Only reads go through here, so a retry cannot duplicate a write.
 */
async function query(text, params) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const client = await connect();
    try {
      return await client.query(text, params);
    } catch (err) {
      // Discard the bad client rather than returning it to the pool.
      client.release(err);
      if (attempt === 0 && isConnectionError(err)) continue;
      throw err;
    } finally {
      // release() is idempotent in pg; the catch above may already have run.
      try { client.release(); } catch { /* already released */ }
    }
  }
  throw new Error('Query failed after retry.');
}

// ─────────────────────────────────────────────────────────────────────────────
// Campaigns
// ─────────────────────────────────────────────────────────────────────────────
const SQL_CAMPAIGNS = `
  SELECT campaign_id::text AS campaign_id,
         campaign_name,
         campaign_type,
         campaign_status,
         campaign_primary_status,
         start_date
  FROM google_ads.campaigns
  WHERE group_name = $1
  ORDER BY campaign_type, campaign_name
`;

/** All campaigns in the Mahima group. Names are never hardcoded. */
async function fetchMahimaCampaigns() {
  const r = await query(SQL_CAMPAIGNS, [MAHIMA.GROUP_NAME]);
  return r.rows;
}

/** Guard: the caller may only ever analyse campaigns that belong to Mahima. */
async function assertCampaignsBelongToMahima(campaignIds) {
  if (!campaignIds || campaignIds.length === 0) return [];
  const r = await query(
    `SELECT campaign_id::text AS campaign_id
       FROM google_ads.campaigns
      WHERE group_name = $1 AND campaign_id = ANY($2::bigint[])`,
    [MAHIMA.GROUP_NAME, campaignIds]
  );
  return r.rows.map((x) => x.campaign_id);
}

// ─────────────────────────────────────────────────────────────────────────────
// Source freshness
// ─────────────────────────────────────────────────────────────────────────────
// campaign_performance is included deliberately: it is what makes the
// "campaigns are live but search-term ingestion is stale" condition provable
// rather than a guess.
const SQL_FRESHNESS = `
  WITH m AS (
    SELECT campaign_id FROM google_ads.campaigns WHERE group_name = $1
  )
  SELECT 'search_term'::text AS src, max(date)::text AS max_date
    FROM google_ads.campaign_search_term_data
   WHERE insight_id IS NULL AND campaign_id IN (SELECT campaign_id FROM m)
  UNION ALL
  SELECT 'pmax_term', max(date)::text
    FROM google_ads.pmax_campaign_search_term_data
   WHERE campaign_id IN (SELECT campaign_id FROM m)
  UNION ALL
  SELECT 'campaign_perf', max(date)::text
    FROM google_ads.campaign_performance
   WHERE campaign_id IN (SELECT campaign_id FROM m)
`;

async function fetchSourceFreshness() {
  const r = await query(SQL_FRESHNESS, [MAHIMA.GROUP_NAME]);
  const out = { search_term: null, pmax_term: null, campaign_perf: null };
  for (const row of r.rows) out[row.src] = row.max_date || null;
  out.latest_search_term = maxDate(out.search_term, out.pmax_term);
  return out;
}

function maxDate(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  return a > b ? a : b;
}

/** Per-campaign coverage inside a window — powers the "which campaigns" detail. */
const SQL_CAMPAIGN_COVERAGE = `
  WITH m AS (
    SELECT campaign_id, campaign_name, campaign_type
      FROM google_ads.campaigns
     WHERE group_name = $1
       AND ($4::bigint[] IS NULL OR campaign_id = ANY($4::bigint[]))
  ),
  u AS (
    SELECT campaign_id, date FROM google_ads.campaign_search_term_data
     WHERE insight_id IS NULL AND campaign_id IN (SELECT campaign_id FROM m)
    UNION ALL
    SELECT campaign_id, date FROM google_ads.pmax_campaign_search_term_data
     WHERE campaign_id IN (SELECT campaign_id FROM m)
  )
  SELECT m.campaign_id::text AS campaign_id,
         m.campaign_name,
         m.campaign_type,
         max(u.date)::text AS max_date,
         count(u.*) FILTER (WHERE u.date BETWEEN $2::date AND $3::date) AS rows_in_window,
         count(u.*) AS rows_total
    FROM m LEFT JOIN u ON u.campaign_id = m.campaign_id
   GROUP BY 1,2,3
   ORDER BY 4 DESC NULLS LAST
`;

async function fetchCampaignCoverage(start, end, campaignIds) {
  const r = await query(SQL_CAMPAIGN_COVERAGE, [
    MAHIMA.GROUP_NAME, start, end,
    campaignIds && campaignIds.length ? campaignIds : null,
  ]);
  return r.rows.map((x) => ({
    campaign_id: x.campaign_id,
    campaign_name: x.campaign_name,
    campaign_type: x.campaign_type,
    max_date: x.max_date,
    rows_in_window: Number(x.rows_in_window) || 0,
    rows_total: Number(x.rows_total) || 0,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Search terms — THE canonical union
// ─────────────────────────────────────────────────────────────────────────────
// Pre-aggregated in SQL to one row per (date, term, campaign) so the function
// never pulls raw daily rows it would only fold in memory.
const SQL_SEARCH_TERMS = `
  WITH m AS (
    SELECT campaign_id, campaign_name, campaign_type
      FROM google_ads.campaigns
     WHERE group_name = $1
       AND ($4::bigint[] IS NULL OR campaign_id = ANY($4::bigint[]))
  ),
  u AS (
    -- Search / Shopping metric rows. insight_id IS NULL excludes the PMax
    -- insight/category rows that would otherwise double-count.
    SELECT s.date, s.campaign_id, s.search_term,
           s.clicks, s.impressions, s.cost, s.conversions, s.conversions_value,
           'campaign_search_term_data'::text AS source_table
      FROM google_ads.campaign_search_term_data s
      JOIN m ON m.campaign_id = s.campaign_id
     WHERE s.insight_id IS NULL
       AND s.date BETWEEN $2::date AND $3::date
       AND s.search_term IS NOT NULL

    UNION ALL

    -- PMax metric rows (this table has no ad_group_id and no insight rows).
    SELECT p.date, p.campaign_id, p.search_term,
           p.clicks, p.impressions, p.cost, p.conversions, p.conversions_value,
           'pmax_campaign_search_term_data'::text
      FROM google_ads.pmax_campaign_search_term_data p
      JOIN m ON m.campaign_id = p.campaign_id
     WHERE p.date BETWEEN $2::date AND $3::date
       AND p.search_term IS NOT NULL
  )
  SELECT u.date::text AS date,
         u.campaign_id::text AS campaign_id,
         m.campaign_name,
         m.campaign_type,
         u.search_term,
         min(u.source_table) AS source_table,
         sum(u.clicks)::int              AS clicks,
         sum(u.impressions)::int         AS impressions,
         CASE WHEN count(u.cost) = 0 THEN NULL ELSE sum(u.cost) END               AS cost,
         sum(u.conversions)::numeric     AS conversions,
         CASE WHEN count(u.conversions_value) = 0 THEN NULL
              ELSE sum(u.conversions_value) END                                   AS conversion_value
    FROM u JOIN m ON m.campaign_id = u.campaign_id
   GROUP BY 1,2,3,4,5
`;

async function fetchSearchTerms(start, end, campaignIds) {
  const r = await query(SQL_SEARCH_TERMS, [
    MAHIMA.GROUP_NAME, start, end,
    campaignIds && campaignIds.length ? campaignIds : null,
  ]);
  return r.rows;
}

/**
 * Historical conversions, keyed by (normalized term, campaign).
 *
 * Grain note: campaign is included deliberately. Matching on term text alone
 * would let the same query in an unrelated campaign contaminate this campaign's
 * history and produce a false `Dropped`/`Working`. Ad-group grain is impossible
 * because pmax_campaign_search_term_data has no ad_group_id column at all.
 * Recorded as an implementation assumption pending Business Review.
 */
const SQL_HISTORICAL = `
  WITH m AS (
    SELECT campaign_id FROM google_ads.campaigns
     WHERE group_name = $1
       AND ($4::bigint[] IS NULL OR campaign_id = ANY($4::bigint[]))
  ),
  u AS (
    SELECT s.campaign_id, s.search_term, s.clicks, s.cost, s.conversions, s.conversions_value
      FROM google_ads.campaign_search_term_data s
      JOIN m ON m.campaign_id = s.campaign_id
     WHERE s.insight_id IS NULL
       AND s.date BETWEEN $2::date AND $3::date
       AND s.search_term IS NOT NULL
    UNION ALL
    SELECT p.campaign_id, p.search_term, p.clicks, p.cost, p.conversions, p.conversions_value
      FROM google_ads.pmax_campaign_search_term_data p
      JOIN m ON m.campaign_id = p.campaign_id
     WHERE p.date BETWEEN $2::date AND $3::date
       AND p.search_term IS NOT NULL
  )
  SELECT campaign_id::text AS campaign_id,
         search_term,
         sum(clicks)::int AS clicks,
         sum(conversions)::numeric AS conversions,
         CASE WHEN count(cost) = 0 THEN NULL ELSE sum(cost) END AS cost,
         CASE WHEN count(conversions_value) = 0 THEN NULL
              ELSE sum(conversions_value) END AS conversion_value
    FROM u
   GROUP BY 1,2
`;

async function fetchHistoricalTerms(start, end, campaignIds) {
  const r = await query(SQL_HISTORICAL, [
    MAHIMA.GROUP_NAME, start, end,
    campaignIds && campaignIds.length ? campaignIds : null,
  ]);
  return r.rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shopify catalogue — active PARENT products for the German store
// ─────────────────────────────────────────────────────────────────────────────
const SQL_CATALOGUE = `
  SELECT l.item_id::text        AS item_id,
         l.id::text             AS listing_id,
         l.title,
         l.product_description,
         l.shopify_handle,
         l.listing_url,
         m.title_tag            AS meta_title,
         m.description_tag      AS meta_description,
         COALESCE(t.tags, ARRAY[]::text[]) AS tags
    FROM listings.shopify_listings l
    -- meta joins on the SHOPIFY product id
    LEFT JOIN listings.shopify_listing_meta m
           ON m.product_id = l.item_id::bigint
    -- tags join on the INTERNAL pk, and are aggregated so they cannot fan out
    LEFT JOIN LATERAL (
      SELECT array_agg(DISTINCT btrim(tg.tag)) AS tags
        FROM listings.shopify_listing_tag tg
       WHERE tg.product_id = l.id
         AND tg.sub_source = l.sub_source
         AND tg.is_deleted = 0
         AND tg.tag IS NOT NULL AND btrim(tg.tag) <> ''
    ) t ON TRUE
   WHERE l.sub_source = $1
     AND l.status = 'active'
     AND l.is_parent = 1
`;

async function fetchShopifyCatalogue() {
  const r = await query(SQL_CATALOGUE, [MAHIMA.SHOPIFY_SUB_SOURCE]);
  return r.rows;
}

async function fetchCatalogueCutoff() {
  const r = await query(
    `SELECT max(updated_at) AS cutoff, count(*)::int AS products
       FROM listings.shopify_listings
      WHERE sub_source = $1 AND status = 'active' AND is_parent = 1`,
    [MAHIMA.SHOPIFY_SUB_SOURCE]
  );
  return { cutoff: r.rows[0] ? r.rows[0].cutoff : null, products: r.rows[0] ? r.rows[0].products : 0 };
}

// ─────────────────────────────────────────────────────────────────────────────
// Targeting evidence (Keyword Opportunity)
// ─────────────────────────────────────────────────────────────────────────────
// Mahima runs PMax + Shopping only, so google_ads.keywords is empty BY DESIGN —
// neither campaign type uses keyword targeting. Targeting is a PRODUCT-level
// concept here, provable from three independent tables.
const SQL_TARGETING = `
  WITH m AS (
    SELECT campaign_id FROM google_ads.campaigns
     WHERE group_name = $1
       AND ($2::bigint[] IS NULL OR campaign_id = ANY($2::bigint[]))
  )
  SELECT 'search_theme'::text AS kind, lower(btrim(s.search_theme_text)) AS value
    FROM google_ads.asset_group_signals s
    JOIN m ON m.campaign_id = s.campaign_id
   WHERE s.signal_type = 'SEARCH_THEME'
     AND s.search_theme_text IS NOT NULL AND btrim(s.search_theme_text) <> ''
  UNION
  SELECT 'listing_group_type', lower(btrim(f.product_type_value))
    FROM google_ads.asset_group_listing_group_filters f
    JOIN m ON m.campaign_id = f.campaign_id
   WHERE f.product_type_value IS NOT NULL AND btrim(f.product_type_value) <> ''
`;

async function fetchTargetingEvidence(campaignIds) {
  const r = await query(SQL_TARGETING, [
    MAHIMA.GROUP_NAME,
    campaignIds && campaignIds.length ? campaignIds : null,
  ]);
  return r.rows;
}

/** Products that actually served for these campaigns in the window. */
const SQL_SERVED_PRODUCTS = `
  WITH m AS (
    SELECT campaign_id FROM google_ads.campaigns
     WHERE group_name = $1
       AND ($4::bigint[] IS NULL OR campaign_id = ANY($4::bigint[]))
  )
  SELECT DISTINCT COALESCE(NULLIF(pp.parent_id,''), pp.product_item_id) AS product_key
    FROM google_ads.product_performance pp
    JOIN m ON m.campaign_id = pp.campaign_id
   WHERE pp.date BETWEEN $2::date AND $3::date
     AND COALESCE(NULLIF(pp.parent_id,''), pp.product_item_id) IS NOT NULL
`;

async function fetchServedProducts(start, end, campaignIds) {
  const r = await query(SQL_SERVED_PRODUCTS, [
    MAHIMA.GROUP_NAME, start, end,
    campaignIds && campaignIds.length ? campaignIds : null,
  ]);
  return r.rows.map((x) => String(x.product_key));
}

module.exports = {
  getPool,
  query,
  fetchMahimaCampaigns,
  assertCampaignsBelongToMahima,
  fetchSourceFreshness,
  fetchCampaignCoverage,
  fetchSearchTerms,
  fetchHistoricalTerms,
  fetchShopifyCatalogue,
  fetchCatalogueCutoff,
  fetchTargetingEvidence,
  fetchServedProducts,
  SQL_SEARCH_TERMS,
  SQL_HISTORICAL,
  SQL_CATALOGUE,
};
