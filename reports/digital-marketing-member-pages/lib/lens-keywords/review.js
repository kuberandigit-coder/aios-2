'use strict';

// lib/lens-keywords/review.js
//
// Competitor review — a Lens visual match is a CANDIDATE, never an
// auto-validated competitor (governing prompt §18). Every result defaults to
// NEEDS_REVIEW; staff explicitly Include or Exclude, with an optional reason.
// Append-only in repo.js (google_lens_keyword_competitor_review) so an
// automated decision can never overwrite a human one.

const { REVIEW_VALUES } = require('./config');
const repo = require('./repo');

async function setReview({ competitor_result_id, review_status, review_reason, reviewed_by }) {
  if (!Number.isInteger(competitor_result_id) || competitor_result_id <= 0) {
    const e = new Error('A valid competitor result id is required.');
    e.status = 400; e.code = 'LENS_INVALID_RESULT_ID'; throw e;
  }
  if (!REVIEW_VALUES.includes(review_status)) {
    const e = new Error(`Review status must be one of: ${REVIEW_VALUES.join(', ')}.`);
    e.status = 400; e.code = 'LENS_INVALID_REVIEW_STATUS'; throw e;
  }
  return repo.setReviewStatus({ competitor_result_id, review_status, review_reason, reviewed_by });
}

module.exports = { setReview };
