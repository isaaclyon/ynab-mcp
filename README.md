# YNAB MCP

Personal TypeScript MCP server for using Claude with YNAB data.

The current implementation is used locally over Streamable HTTP, with a path to a **Claude web custom connector** over public HTTPS later. The server keeps the YNAB Personal Access Token server-side and protects public MCP access with private OAuth.

## Current implementation

- TypeScript / Node.js / Express.
- MCP Streamable HTTP endpoint at `POST /mcp`.
- Private OAuth scaffold:
  - owner-passphrase-gated `/authorize` page,
  - auth-code + PKCE `/token` exchange,
  - CIMD metadata support via `/.well-known/oauth-authorization-server`,
  - protected-resource metadata at `/.well-known/oauth-protected-resource/mcp`,
  - in-memory access/refresh tokens.
- Dev-only auth bypass for localhost/test runs via `DEV_AUTH_BYPASS=true`.
- Server-side YNAB client boundary using `YNAB_ACCESS_TOKEN`.
- Named read tools:
  - `ynab_list_plans`
  - `ynab_list_accounts`
  - `ynab_list_categories`
  - `ynab_get_category`
  - `ynab_list_payees`
  - `ynab_get_payee`
  - `ynab_list_months`
  - `ynab_get_month`
  - `ynab_get_month_category`
  - `ynab_get_transaction`
  - `ynab_search_transactions`
  - `ynab_list_account_transactions`
  - `ynab_list_category_transactions`
  - `ynab_list_payee_transactions`
  - `ynab_list_month_transactions`
  - `ynab_list_scheduled_transactions`
  - `ynab_get_scheduled_transaction`
- Write tools:
  - `ynab_create_category`
  - `ynab_update_category`
  - `ynab_create_category_group`
  - `ynab_update_category_group`
  - `ynab_create_payee`
  - `ynab_update_payee`
  - `ynab_update_month_category`
  - `ynab_create_transaction`
  - `ynab_update_transaction`
  - `ynab_delete_transaction`
  - `ynab_create_scheduled_transaction`
  - `ynab_update_scheduled_transaction`
  - `ynab_delete_scheduled_transaction`

YNAB does not expose delete endpoints for categories or category groups, so category/category-group delete tools are not implemented.

## Local setup

```bash
npm install
cp .env.example .env
# edit .env with YNAB_ACCESS_TOKEN, OWNER_PASSPHRASE, PUBLIC_BASE_URL
npm run dev
```

For local MCP development only, set `DEV_AUTH_BYPASS=true`. This is rejected in production config and only bypasses auth for local requests.

## Scripts

```bash
npm run typecheck
npm test
npm run smoke
npm run build
npm start
```

`npm run smoke` starts an in-process Streamable HTTP server with mocked YNAB responses and verifies initialize, `tools/list`, and one read-only tool call. The automated test suite also covers category, payee, month/category budgeting, scoped account/category/payee/month transaction reads, transaction write/delete, and scheduled transaction tool calls.

## Documentation map

- `CONTEXT.md` — shared project language and naming discipline.
- `ARCHITECTURE.md` — current system shape and boundaries.
- `docs/adr/` — durable decisions and their tradeoffs.
- `ROADMAP.md` — medium-term sequencing.
- `docs/plans/` — temporary implementation plans and open questions.
- `docs/guidelines/engineering-standards.md` — repo-wide quality expectations.
- `AGENTS.md` — coding-agent workflow rules.
