# Evidence — API Health Monitor caught a real issue on first run

**Date:** 2026-09-07
**Project:** dm-dashboard

## Proof the monitor works against real data, not just synthetic checks

First live run of the 11 configured API checks:

| API | Status | Latency | Note |
|---|---|---|---|
| local_llm | 🔴 danger | 629ms | `SSLCertVerificationError` — real cert problem on `qwen3_next.severdigitweb.uk` |
| shopify_de | 🟢 no_issue | 1126ms | |
| shopify_uk | 🟢 no_issue | 964ms | |
| shopify_fr | 🟢 no_issue | 1066ms | |
| gemini | 🟢 no_issue | 770ms | |
| github_dashboard | 🟢 no_issue | 1088ms | |
| github_eod | 🟢 no_issue | 961ms | |
| app_db | 🟢 no_issue | 1ms | |
| business_db | 🟢 no_issue | 1816ms | |
| groq | ⚪ not_configured | — | key not set |
| nvidia_deepseek | ⚪ not_configured | — | key not set |

This confirms the danger/warning/no-issue/not-configured classification
works correctly and surfaces genuine, previously-invisible problems (the
Local LLM SSL cert issue was not known before this check existed).
