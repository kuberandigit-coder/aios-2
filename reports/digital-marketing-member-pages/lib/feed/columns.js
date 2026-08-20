// lib/feed/columns.js
//
// Server-approved CSV column whitelist + CSV builder.
//
// SECURITY POSTURE
//   The browser sends column KEYS, never column expressions and never SQL.
//   Anything not in this whitelist is rejected server-side, so a tampered
//   request cannot widen the export or reach a field the operator was never
//   offered.
//
//   Values are also defended against CSV FORMULA INJECTION: a cell beginning
//   =, +, -, @, TAB or CR is prefixed with a single quote, because Excel and
//   Sheets execute such cells on open. Product titles and search terms are
//   operator/customer-supplied text, so this is a real path.

'use strict';

/**
 * Every exportable column. `get(row)` receives the assembled export row:
 *   { product, generation, variant, baseline, selection, monitoring }
 */
const COLUMNS = [
  // ── Identity ──────────────────────────────────────────────────────────
  { key: 'item_id',            group: 'Identity', label: 'Item ID',                    def: true,  get: (r) => r.product?.item_id },
  { key: 'shopify_product_id', group: 'Identity', label: 'Shopify Product ID',         def: false, get: (r) => r.product?.shopify_product_id },
  { key: 'shopify_variant_id', group: 'Identity', label: 'Variant ID',                 def: false, get: (r) => r.product?.shopify_variant_id },
  { key: 'sku',                group: 'Identity', label: 'SKU',                        def: true,  get: (r) => r.product?.sku },
  { key: 'product_type',       group: 'Identity', label: 'Product Type',               def: false, get: (r) => r.product?.product_type },

  // ── Generated feed content ────────────────────────────────────────────
  { key: 'variant_label',      group: 'Generated', label: 'Selected Variant',          def: true,  get: (r) => r.variant?.variant_label },
  { key: 'new_title',          group: 'Generated', label: 'New Title',                 def: true,  get: (r) => r.variant?.title_fr },
  { key: 'title_char_count',   group: 'Generated', label: 'Title Character Count',     def: true,  get: (r) => r.variant?.title_char_count },
  { key: 'new_description',    group: 'Generated', label: 'New Description',           def: true,  get: (r) => r.variant?.description_fr },
  { key: 'suggested_gpc',      group: 'Generated', label: 'Suggested Google Product Category', def: true, get: (r) => r.variant?.suggested_gpc },

  // ── Evidence ──────────────────────────────────────────────────────────
  { key: 'converting_terms_used', group: 'Evidence', label: 'Converting Terms Used',   def: true,  get: (r) => asList(r.variant?.converting_terms_used) },
  { key: 'search_term_data_date', group: 'Evidence', label: 'Search Term Data Date',   def: true,  get: (r) => r.generation?.input_snapshot?.terms_freshness_latest || r.searchTermLatest },
  { key: 'evidence_confidence',   group: 'Evidence', label: 'Evidence Confidence',     def: false, get: (r) => r.generation?.evidence_confidence },
  { key: 'prompt_version',        group: 'Evidence', label: 'Prompt Version',          def: false, get: (r) => r.generation?.prompt_version },
  { key: 'prompt_hash',           group: 'Evidence', label: 'Prompt Hash',             def: false, get: (r) => r.generation?.prompt_hash },

  // ── Current / reference content ───────────────────────────────────────
  { key: 'current_title',       group: 'Current', label: 'Current Title',              def: false, get: (r) => r.product?.current_title },
  { key: 'current_description', group: 'Current', label: 'Current Description',        def: false, get: (r) => r.product?.current_description },
  { key: 'current_gpc',         group: 'Current', label: 'Current GPC',                def: false, get: (r) => r.product?.google_product_category },
  { key: 'image_link',          group: 'Current', label: 'Image Link',                 def: false, get: (r) => r.product?.image_link },
  { key: 'price_eur',           group: 'Current', label: 'Price (EUR)',                def: false, get: (r) => r.product?.price_eur },

  // ── Performance ───────────────────────────────────────────────────────
  { key: 'baseline_impressions',      group: 'Performance', label: 'Baseline Impressions',      def: false, get: (r) => r.baseline?.impressions },
  { key: 'baseline_clicks',           group: 'Performance', label: 'Baseline Clicks',           def: false, get: (r) => r.baseline?.clicks },
  { key: 'baseline_ctr',              group: 'Performance', label: 'Baseline CTR',              def: false, get: (r) => r.baseline?.ctr },
  { key: 'baseline_gads_conversions', group: 'Performance', label: 'Baseline GAds Conversions', def: false, get: (r) => r.baseline?.gads_conversions ?? r.baseline?.conversions },
  { key: 'baseline_conversion_rate',  group: 'Performance', label: 'Baseline Conversion Rate',  def: false, get: (r) => r.baseline?.conversion_rate },
  { key: 'shopify_actual_conv',       group: 'Performance', label: 'Shopify Actual Conversions (orders/lines/units)', def: false,
    get: (r) => {
      const s = r.product?.shopify_conversions;
      return s ? `${s.orders}/${s.lines}/${s.units}` : '';
    } },

  // ── Audit ─────────────────────────────────────────────────────────────
  { key: 'generation_id',       group: 'Audit', label: 'Generation ID',        def: false, get: (r) => r.generation?.generation_id },
  { key: 'batch_id',            group: 'Audit', label: 'Batch ID',             def: false, get: (r) => r.generation?.batch_id },
  { key: 'generated_date',      group: 'Audit', label: 'Generated Date',       def: true,  get: (r) => isoDay(r.generation?.created_at) },
  { key: 'selected_by',         group: 'Audit', label: 'Selected By',          def: false, get: (r) => r.selection?.selected_by },
  { key: 'selected_date',       group: 'Audit', label: 'Selected Date',        def: false, get: (r) => isoDay(r.selection?.selected_at) },
  { key: 'provider',            group: 'Audit', label: 'Provider',             def: false, get: (r) => r.attempt?.provider_alias },
  { key: 'model',               group: 'Audit', label: 'Model',                def: false, get: (r) => r.attempt?.model },
  { key: 'eligibility_status',  group: 'Audit', label: 'Feed Eligible Status', def: true,  get: (r) => r.generation?.feed_eligible_status || 'UNKNOWN' },
  { key: 'draft_status',        group: 'Audit', label: 'Draft Status',         def: true,  get: (r) => (r.generation?.is_draft_only ? 'DRAFT ONLY' : 'APPROVED') },
  { key: 'monitoring_start_date', group: 'Audit', label: 'Monitoring Start Date', def: true, get: (r) => r.monitoring?.monitoring_start_date || r.monitoringStartDate },
];

const BY_KEY = new Map(COLUMNS.map((c) => [c.key, c]));
const DEFAULT_KEYS = COLUMNS.filter((c) => c.def).map((c) => c.key);

function asList(v) {
  if (!v) return '';
  let arr = v;
  if (typeof v === 'string') { try { arr = JSON.parse(v); } catch { return v; } }
  return Array.isArray(arr) ? arr.join(' | ') : String(arr);
}

function isoDay(v) {
  if (!v) return '';
  try { return new Date(v).toISOString().slice(0, 10); } catch { return String(v).slice(0, 10); }
}

/** Grouped catalogue for the UI. Never exposes the getter functions. */
function catalogue() {
  const groups = {};
  COLUMNS.forEach((c) => {
    (groups[c.group] = groups[c.group] || []).push({
      key: c.key, label: c.label, default: c.def,
    });
  });
  return { groups, default_keys: DEFAULT_KEYS, all_keys: COLUMNS.map((c) => c.key) };
}

/**
 * Validate an operator-supplied column list.
 * Returns { ok, columns, rejected, error }.
 */
function resolveColumns(requested) {
  if (requested === undefined || requested === null) {
    return { ok: true, columns: DEFAULT_KEYS.slice(), rejected: [] };
  }
  if (!Array.isArray(requested)) {
    return { ok: false, error: 'columns must be an array of column keys' };
  }
  const rejected = requested.filter((k) => !BY_KEY.has(k));
  const accepted = requested.filter((k) => BY_KEY.has(k));
  // de-duplicate, preserve operator order
  const seen = new Set();
  const columns = accepted.filter((k) => (seen.has(k) ? false : seen.add(k)));
  if (!columns.length) {
    return { ok: false, error: 'At least one valid data column must be selected', rejected };
  }
  return { ok: true, columns, rejected };
}

// ─── CSV rendering ──────────────────────────────────────────────────────────

const FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t', '\r'];

/**
 * Neutralise spreadsheet formula injection. Excel/Sheets execute a cell that
 * starts with = + - @ (or TAB/CR). Product titles and search terms are
 * externally-influenced text, so this is a genuine vector, not theatre.
 */
function neutraliseFormula(s) {
  if (s === null || s === undefined) return '';
  const str = String(s);
  if (!str.length) return str;
  return FORMULA_TRIGGERS.includes(str[0]) ? `'${str}` : str;
}

function csvCell(v) {
  const s = neutraliseFormula(v);
  return `"${s.replace(/"/g, '""')}"`;
}

/**
 * Build the CSV text for the chosen columns and rows.
 * Emits a UTF-8 BOM so Excel renders French accents correctly.
 */
function buildCsv(columnKeys, rows) {
  const cols = columnKeys.map((k) => BY_KEY.get(k)).filter(Boolean);
  const header = cols.map((c) => csvCell(c.label)).join(',');
  const body = rows.map((r) => cols.map((c) => {
    let v;
    try { v = c.get(r); } catch { v = ''; }
    return csvCell(v === null || v === undefined ? '' : v);
  }).join(',')).join('\r\n');
  return '﻿' + header + (body ? '\r\n' + body : '') + '\r\n';
}

module.exports = {
  COLUMNS, BY_KEY, DEFAULT_KEYS,
  catalogue, resolveColumns,
  neutraliseFormula, csvCell, buildCsv,
  asList, isoDay,
};
