# 2026-07-03 — Claude-web-optimized YNAB MCP scaffold

Status: active
Progress: Steps 1-4 scaffolded locally; local MCP use is working; category/category-group and transaction create/update tools added; Claude web public HTTPS validation and Ubuntu deployment docs remain deferred.
Owner: Isaac / coding agent

## Goal

Implement a personal TypeScript YNAB MCP server, currently focused on local Streamable HTTP use, with named read tools plus category/category-group and transaction create/update tools. Preserve the path for Claude web custom connector validation later.

## Non-goals

- Public connector directory submission.
- Multi-user OAuth onboarding for other YNAB users.
- Rich widgets or MCP app UI.

## Source-of-truth inputs

- Context: `CONTEXT.md`
- Architecture: `ARCHITECTURE.md`
- ADRs: `docs/adr/0001-optimize-for-claude-web.md`, `docs/adr/0002-use-named-ynab-concept-tools.md`
- Roadmap: `ROADMAP.md`
- Guidelines: `docs/guidelines/engineering-standards.md`

## Working assumptions

- The server is personal-only, runs on the owner's Ubuntu mini PC, and uses the owner's YNAB account.
- The initial YNAB credential can be a Personal Access Token stored as a server environment variable.
- Claude web custom connector compatibility requires public HTTPS and Streamable HTTP.
- Connector auth is private MCP OAuth with owner passphrase authorization, PKCE, CIMD-only client registration, and in-memory issued-token storage for v1.
- Authorize-page rate limiting is deferred for v1; use a long passphrase and avoid logging auth secrets.
- The initial YNAB API base URL is `https://api.ynab.com/v1`.

## Open questions

- Public HTTPS will use Cloudflare Tunnel for v1.
- Should local stdio be included as a dev-only entrypoint after the HTTP server works?
- Should DCR be added later if non-Claude MCP clients need it?
- Authorize-page brute-force/rate limiting.
- Reverse proxy or direct DNS deployment if Cloudflare Tunnel becomes limiting.
- What is the next future write tool worth designing after transaction create/update: import transactions or additional transaction shapes such as splits?

## Steps

1. Scaffold repository docs and decisions.
   - Verify: source-of-truth files exist and agree on terminology/boundaries.
2. Scaffold TypeScript project and remote Streamable HTTP MCP server with dev-only local auth bypass.
   - Status: complete locally.
   - Verify: scripted Streamable HTTP smoke covers initialize and `tools/list`; MCP Inspector remains useful for manual checks.
3. Implement private MCP OAuth with owner passphrase gate and CIMD metadata.
   - Status: scaffold complete locally.
   - Verify: tests cover OAuth metadata, unauthenticated MCP challenge, owner-passphrase authorization, PKCE token exchange, and no DCR registration endpoint.
4. Implement YNAB client boundary and read/write tool split.
   - Status: complete for initial read-only slice, category/category-group create/update tools, and single transaction create/update tools.
   - Verify: mocked tests cover YNAB request construction/error handling and smoke covers read, category-write, and transaction-write tool calls.
5. Validate connector auth and public HTTPS with Claude web.
   - Verify: Claude web can connect, list tools, authorize through the OAuth/passphrase flow, and call at least one read-only YNAB tool.
6. Document Ubuntu mini PC deployment.
   - Verify: deployment instructions include secrets, process supervision, HTTPS, and rollback/restart notes.

## Cut lines


If scope gets tight, preserve:

- Remote Streamable HTTP over Claude web compatibility.
- `ynab_list_plans`, `ynab_list_accounts`, and `ynab_search_transactions`.
- Server-side YNAB credential handling.

Can defer:

- `ynab_get_month`
- `ynab_get_transaction`
- Delta request support
- Local stdio entrypoint
- Escape-hatch endpoint tool

## Verification

- `npm run typecheck`
- `npm test`
- MCP Inspector `tools/list`
- Scripted MCP `tools/call` for one read-only tool
- Claude web custom connector smoke test over public HTTPS

## Completion / archival

When complete:

- Update `ARCHITECTURE.md` if the actual auth/hosting shape differs from this plan.
- Add or update an ADR if connector auth lands as a durable, surprising trade-off.
- Move remaining follow-up items into `ROADMAP.md` or a new implementation plan.
