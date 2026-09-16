## Alt Text Optimization (continued) & Meta Title/Description Audit — Source Map

Only sources actually used today are documented here. Semrush's Standard
API, Google Keyword Planner, and Google Ads API are explicitly NOT used
by either feature's live backend.

| Concern | File / Endpoint | Notes |
|---|---|---|
| Alt Text backend + API | `backend/app/dev_tasks/alt_text_keywords/{router.py,ai_alt_text.py,schema.py}`, `/api/dev/alt-text-keywords/*` | Unchanged location; background-job pattern for generation |
| Alt Text frontend | `frontend/src/admin/pages/dev-tasks/AltTextKeywordFinder.jsx` | Development Tasks, UAM-gated |
| Meta Audit backend + API | `backend/app/dev_tasks/meta_audit/{router.py,schema.py,generate.py}`, `/api/dev/meta-audit/*` | Moved today from `backend/app/dilaksi_meta_audit.py` / `/api/dilaksi/meta-audit/*` |
| Meta Audit frontend | `frontend/src/admin/pages/dev-tasks/MetaTitleDescriptionAudit.jsx` | Moved today from `frontend/src/dilaksi/pages/`; Development Tasks, UAM-gated, `tools.DevMetaTitleDescriptionAudit` |
| Shopify integration | Shopify Admin GraphQL API, `ledsone_uk`, existing `backend/app/shopify_client.py` | Unchanged — SHOPIFY_API configured, token never exposed |
| GA4 integration | GA4 Data API, property `408110563`, existing `backend/app/google_client.py` | Unchanged — GA4 configured, service-account credential never exposed |
| Local LLM | Self-hosted Qwen3-Next, `LOCAL_LLM_BASE_URL=https://qwen3next.severdigitweb.uk` (corrected today — no underscore) | Used by both Alt Text and Meta Audit generation; tried first |
| AI fallback | Google Gemini, existing `backend/app/ai_shared.py`'s `call_gemini()` | Used by both features only when the local LLM is unreachable |
| Keyword research (Meta Audit only) | **Semrush MCP connector — interactive, chat-session-only** | NOT a live backend integration. Confirmed today: this account's Semrush Standard API (the kind a backend could call) returns `HTTP 403 Forbidden` even with a valid, correctly-formatted v4 key — "API Units purchase only available for Business users." The MCP connector itself authenticates through a separate path and works, but can only be invoked by an agent inside a live chat session, never by the deployed FastAPI backend. Real keyword shortlists gathered this way are saved to `meta_audit_keyword_candidates` by the agent directly (verified via production DB read/write), not fetched on-demand by any user click in the live app. |
| Persistence | This app's own Postgres, tables listed in the closure record, via existing `backend/app/db.py`'s `get_conn()` | DATABASE_URL configured (host corrected today, same credentials as production, was pointing at `localhost` in error) — verified working via direct read/write |

### Explicitly NOT used by either feature's live backend
- Semrush Standard/v4 API (Business-tier required on this account; not integrated into the backend even if upgraded — would be a separate future decision)
- Google Keyword Planner
- Google Ads API
- Website scraping
