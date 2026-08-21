'use strict';

// lib/stpm/normalize.js
//
// REQ-DM-2026-08-MAHI01 — deterministic text normalization (requirement Module 21).
//
// Used on BOTH sides of the match so a search term and a product field are
// compared on equal terms. Everything here is pure and side-effect free.
//
// WHAT MUST SURVIVE NORMALIZATION
//   Mahima sells lighting components in Germany. Product identity lives in the
//   units and model codes: `5m`, `24v`, `300ma`, `e27`, `gu10`, `3w`. Stripping
//   or splitting those would destroy the only discriminating token in a term
//   like "led strip 5m warm white". So digits and digit+unit clusters are
//   preserved intact.
//
// GERMAN FOLDING
//   Titles and search terms are German. `ä ö ü ß` are folded to `ae oe ue ss`
//   because shoppers type both forms interchangeably ("weiss" / "weiß",
//   "hängelampe" / "haengelampe"). This is a matching-behaviour decision, not a
//   typo fix — it is recorded as an implementation assumption in the validation
//   report (N-24) and is confined to this module so it can be reversed in one
//   place.
//
// TITLE SUFFIX
//   Live Ledsone DE titles carry an internal code suffix, e.g.
//   "Netzteil 3W LED Treiber Konstantstrom 12V 300mA~2430". The `~NNNN` part is
//   an internal identifier, never something a customer types, so it is stripped
//   from product titles before comparison. Verified present across the live
//   catalogue during discovery.

// Folded first so later character-class filtering cannot eat the umlaut.
const GERMAN_FOLD = [
  [/ä/g, 'ae'], [/ö/g, 'oe'], [/ü/g, 'ue'], [/ß/g, 'ss'],
  [/Ä/g, 'ae'], [/Ö/g, 'oe'], [/Ü/g, 'ue'],
];

/**
 * Normalize any text for comparison.
 * Returns '' for null/undefined/non-string input — never throws.
 */
function normalizeText(input) {
  if (input === null || input === undefined) return '';
  let s = String(input);

  // Unicode canonical composition first, so a decomposed "a + combining
  // diaeresis" folds the same way a precomposed "ä" does.
  try { s = s.normalize('NFC'); } catch { /* older runtimes: proceed unfolded */ }

  s = s.toLowerCase();
  for (const [re, to] of GERMAN_FOLD) s = s.replace(re, to);

  // Strip combining marks left over from any other accented input.
  try { s = s.normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC'); } catch { /* noop */ }

  // Punctuation and separators become spaces. Letters, digits and whitespace
  // survive — so "5m", "24v" and "e27" stay whole, while "5 m" stays two tokens
  // (they are genuinely different strings and we do not guess).
  s = s.replace(/[^\p{L}\p{N}\s]+/gu, ' ');

  return s.replace(/\s+/g, ' ').trim();
}

/** Strip the internal `~NNNN` suffix, then normalize. For product titles. */
function normalizeProductTitle(title) {
  if (title === null || title === undefined) return '';
  return normalizeText(String(title).replace(/~\s*\d+\s*$/, ''));
}

/**
 * Normalize a Google Ads search term.
 * The ORIGINAL is always kept alongside by callers — the requirement's output
 * table shows the customer's real query, not our normalized form.
 */
function normalizeSearchTerm(term) {
  return normalizeText(term);
}

/** Tokens of a normalized string. Empty array for empty input. */
function tokenize(normalized) {
  if (!normalized) return [];
  return normalized.split(' ').filter(Boolean);
}

/**
 * Whole-phrase containment on token boundaries.
 *
 * Plain substring matching would report "led" inside "unleaded" and
 * "5m" inside "15mm" — both false positives that would put a wrong product in
 * front of a staff member. Padding both sides with spaces makes the test
 * boundary-aware without needing a regex per candidate.
 */
function containsPhrase(haystackNormalized, needleNormalized) {
  if (!haystackNormalized || !needleNormalized) return false;
  return (' ' + haystackNormalized + ' ').includes(' ' + needleNormalized + ' ');
}

/** Fraction of needle tokens present in haystack, 0..1. */
function tokenCoverage(haystackTokens, needleTokens) {
  if (!needleTokens || needleTokens.length === 0) return 0;
  const have = new Set(haystackTokens);
  let hit = 0;
  for (const t of needleTokens) if (have.has(t)) hit++;
  return hit / needleTokens.length;
}

module.exports = {
  normalizeText,
  normalizeProductTitle,
  normalizeSearchTerm,
  tokenize,
  containsPhrase,
  tokenCoverage,
};
