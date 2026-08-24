'use strict';

// lib/lens-keywords/export.js
//
// REQ-DM-2026-08-SAJE01 — Competitor Results CSV export (governing prompt §29).
// Exports STORED evidence only — no additional SerpAPI call is ever made here.
// CSV escaping copied verbatim from lib/stpm/export.js (the proven precedent):
// a leading =, +, -, @ is guarded against formula injection when the file is
// opened in Excel/Sheets.

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
  return '﻿' + out.join('\r\n') + '\r\n'; // BOM + CRLF for Excel
}

const HEADERS = [
  'Run ID', 'SKU', 'Our Product Title', 'Our Product Image',
  'Rank', 'Review Status', 'Image Src', 'Image Alt', 'URL', 'H3 Heading',
  'Cite', 'Emphasized Text', 'Aria Label', 'Provider', 'Observed At',
];

function build(runId, rows) {
  const csvRows = rows.map((r) => [
    runId,
    r.sku,
    r.product_title_snapshot,
    r.image_url_snapshot,
    r.rank,
    r.review_status,
    r.image_src,
    r.image_alt,
    r.url,
    r.h3_heading,
    r.cite,
    r.emphasized_text,
    r.aria_label,
    r.provider,
    r.observed_at ? new Date(r.observed_at).toISOString() : '',
  ]);
  return {
    body: toCsv(HEADERS, csvRows),
    contentType: 'text/csv; charset=utf-8',
    filename: `lens-keyword-competitors_${runId}.csv`,
  };
}

module.exports = { build, toCsv, csvCell, HEADERS };
