'use strict';

// lib/stpm/export.js
//
// REQ-DM-2026-08-MAHI01 — CSV exports (requirement Modules 25, 27, 28).
//
// These are FILES FOR HUMAN REVIEW. Nothing here publishes to Google Ads,
// Shopify or any other system. A negative-keyword export is a recommendation
// list that a person still has to act on, and it carries the Review Status so
// the reader can see what has and has not been approved.

const { MAHIMA } = require('./config');

/**
 * RFC4180-style escaping.
 *
 * The leading-apostrophe guard matters: a search term legitimately starting
 * with =, +, - or @ would otherwise be interpreted as a formula when the file
 * is opened in Excel or Sheets. That is a real injection vector for a file
 * built from customer-supplied query text.
 */
function csvCell(v) {
  if (v === null || v === undefined) return '';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function toCsv(headers, rows) {
  const out = [headers.map(csvCell).join(',')];
  for (const r of rows) out.push(r.map(csvCell).join(','));
  // CRLF + BOM so Excel opens German umlauts correctly.
  return '﻿' + out.join('\r\n') + '\r\n';
}

function money(v) {
  if (v === null || v === undefined) return '';
  return Number(v).toFixed(2);
}
function ratio(v) {
  if (v === null || v === undefined) return '';
  return Number(v).toFixed(4);
}
function pct(v) {
  if (v === null || v === undefined) return '';
  return Number(v).toFixed(2) + '%';
}

/** Fired rule labels as a readable string. */
function reasonsOf(row) {
  const w = row.waste_reasons;
  if (!Array.isArray(w) || w.length === 0) return row.waste_reason_summary || '';
  return w.map((x) => x.label || x.rule).join('; ');
}

const FULL_HEADERS = [
  'Search Term', 'Campaign', 'Campaign Type', 'Data From', 'Data To',
  'Clicks', 'Impressions', 'CTR', `Cost (${MAHIMA.CURRENCY})`,
  'Conversions', `Conversion Value (${MAHIMA.CURRENCY})`, 'ROAS',
  'Historical Conversions', 'Performance Status',
  'Waste Reason', 'Decision', 'Negative Keyword Recommended',
  'Keyword Opportunity', 'Keyword Opportunity Reason',
  'Shopify Product ID', 'Shopify Product Title', 'Match Type', 'Match Score',
  'Match Source', 'Product URL', 'Mapping Status', 'Review Status',
];

function fullRow(r) {
  return [
    r.search_term, r.campaign_name, r.campaign_type, r.source_start, r.source_end,
    r.clicks, r.impressions, pct(r.ctr), money(r.cost),
    r.conversions, money(r.conversion_value), ratio(r.roas),
    r.historical_conversions, r.performance_status,
    reasonsOf(r), r.decision, r.negative_keyword_recommended ? 'Yes' : 'No',
    r.keyword_opportunity ? 'Yes' : (r.opportunity_candidate ? 'Candidate' : 'No'),
    r.opportunity_reason || '',
    r.product_id || '', r.product_title || '', r.match_type || '',
    r.match_score === null || r.match_score === undefined ? '' : ratio(r.match_score),
    r.match_source || '', r.product_url || '', r.mapping_status || '',
    r.review_status || 'Pending',
  ];
}

function buildFullExport(rows) {
  return toCsv(FULL_HEADERS, (rows || []).map(fullRow));
}

const NEGATIVE_HEADERS = [
  'Search Term', 'Campaign', 'Campaign Type',
  'Clicks', 'Impressions', `Cost (${MAHIMA.CURRENCY})`, 'Conversions', 'ROAS',
  'Historical Conversions', 'Performance Status',
  'Waste Reason', 'Recommendation Detail', 'Decision', 'Review Status',
  'Reviewed By', 'Reviewed At', 'Review Note',
];

/**
 * Negative-keyword RECOMMENDATIONS.
 * Deliberately includes Review Status so nobody mistakes the file for an
 * approved, ready-to-upload negative list.
 */
function buildNegativeExport(rows) {
  const filtered = (rows || []).filter((r) => r.negative_keyword_recommended === true);
  const body = filtered.map((r) => {
    const basis = r.decision_basis && typeof r.decision_basis === 'object' ? r.decision_basis : {};
    const detail = Array.isArray(r.waste_reasons)
      ? r.waste_reasons.map((x) => x.explain || x.outcome || x.rule).join(' | ')
      : (basis.reason || '');
    return [
      r.search_term, r.campaign_name, r.campaign_type,
      r.clicks, r.impressions, money(r.cost), r.conversions, ratio(r.roas),
      r.historical_conversions, r.performance_status,
      reasonsOf(r), detail, r.decision, r.review_status || 'Pending',
      r.reviewer || '', r.reviewed_at || '', r.review_note || '',
    ];
  });
  return toCsv(NEGATIVE_HEADERS, body);
}

const OPPORTUNITY_HEADERS = [
  'Search Term', 'Campaign', 'Campaign Type',
  'Clicks', 'Impressions', `Cost (${MAHIMA.CURRENCY})`,
  'Conversions', `Conversion Value (${MAHIMA.CURRENCY})`, 'ROAS',
  'Historical Conversions', 'Performance Status',
  'Opportunity', 'Opportunity Reason',
  'Shopify Product ID', 'Shopify Product Title', 'Product URL',
  'Match Type', 'Match Score', 'Match Source', 'Mapping Status', 'Review Status',
];

/** Confirmed opportunities AND candidates — the column says which. */
function buildOpportunityExport(rows) {
  const filtered = (rows || []).filter(
    (r) => r.keyword_opportunity === true || r.opportunity_candidate === true
  );
  const body = filtered.map((r) => [
    r.search_term, r.campaign_name, r.campaign_type,
    r.clicks, r.impressions, money(r.cost),
    r.conversions, money(r.conversion_value), ratio(r.roas),
    r.historical_conversions, r.performance_status,
    r.keyword_opportunity ? 'Confirmed' : 'Candidate — manual validation required',
    r.opportunity_reason || '',
    r.product_id || '', r.product_title || '', r.product_url || '',
    r.match_type || '',
    r.match_score === null || r.match_score === undefined ? '' : ratio(r.match_score),
    r.match_source || '', r.mapping_status || '', r.review_status || 'Pending',
  ]);
  return toCsv(OPPORTUNITY_HEADERS, body);
}

const TYPES = Object.freeze({
  full: { build: buildFullExport, name: 'search-term-mapping-full' },
  negative: { build: buildNegativeExport, name: 'negative-keyword-recommendations' },
  opportunity: { build: buildOpportunityExport, name: 'keyword-product-opportunities' },
});

/** Build one export by type. Throws 400 on an unknown type. */
function build(type, rows, runMeta) {
  const t = TYPES[type];
  if (!t) {
    const e = new Error('Unknown export type.');
    e.status = 400; e.code = 'STPM_INVALID_EXPORT_TYPE';
    throw e;
  }
  const stamp = (runMeta && runMeta.actual_start ? runMeta.actual_start : 'run') +
                '_' + (runMeta && runMeta.actual_end ? runMeta.actual_end : '');
  return {
    filename: `mahima-${t.name}_${stamp}.csv`.replace(/_+\.csv$/, '.csv'),
    contentType: 'text/csv; charset=utf-8',
    body: t.build(rows),
  };
}

module.exports = {
  csvCell, toCsv, build,
  buildFullExport, buildNegativeExport, buildOpportunityExport,
  FULL_HEADERS, NEGATIVE_HEADERS, OPPORTUNITY_HEADERS,
};
