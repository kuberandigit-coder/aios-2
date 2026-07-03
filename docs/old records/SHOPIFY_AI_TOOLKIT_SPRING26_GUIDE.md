# Shopify AI Toolkit / Spring '26 — Claude Code Connection Guide

| | |
|---|---|
| **Project** | Kuberan Workstream — DevOps / Tooling |
| **Category** | Research + implementation guide |
| **Date** | 18/06/2026 |
| **Status** | Delivered (validated against live docs) |

## Objective
Determine whether and how Claude Code can connect directly to Shopify (theme + admin), based on Shopify Editions Spring '26 and the AI Toolkit docs.

## Method
Fetched the live pages (training cutoff is Jan 2026, so Spring '26 was verified, not recalled):
- shopify.dev/docs/apps/build/ai-toolkit
- shopify.com/editions/spring2026

## Key verified findings
- **AI Toolkit exists**, supports Claude Code, Codex, Cursor, Gemini CLI, VS Code. Three install methods: plugin (auto-update), agent skills, MCP server (`@shopify/dev-mcp`). Node 18+.
- Install commands: `claude plugin install shopify-ai-toolkit@claude-plugins-official`; `claude mcp add --transport stdio shopify-dev-mcp -- npx -y @shopify/dev-mcp@latest`; `npx skills add Shopify/shopify-ai-toolkit --skill shopify-admin`.
- Spring '26: Universal Commerce Protocol + Catalog API, Commerce MCP (catalog/cart/checkout), **GraphQL + bulk ops from CLI**, expiring OAuth tokens, simplified metafields API, Hydrogen rebuild, Dev Dashboard.

## Compatibility verdict — YES
- **Storefront/theme code** → via **Shopify CLI** (`theme pull/dev/push`), not MCP.
- **Store data** (products/orders/customers/metafields/GraphQL) → via **Admin MCP / `shopify store execute`**.
- Two separate "pipes": theme = CLI; data = Admin GraphQL.

## Honesty notes
- Did not fabricate Lighthouse-style specifics; grounded in fetched docs + this environment.
- "No-auth" in docs applies to the local Dev MCP (docs/schema/validation); writing to a store still needs auth.

Full deliverable (10 sections) provided in chat: exec summary, Spring '26 analysis, AI Toolkit analysis, compatibility, setup, config, security, multi-store, troubleshooting, checklist.
