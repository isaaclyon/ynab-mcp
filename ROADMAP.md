# Roadmap

This file captures medium-term direction and sequencing. Temporary checklists live in `docs/plans/`.

## Current direction

- Build a personal YNAB MCP server optimized for Claude web custom connectors.
- Keep named read-only tools over YNAB plans/accounts/categories/months/transactions.
- Add explicit write tools without exposing generic mutation; the first write slice covers category/category-group create and update.

## Active phases

### Phase 1 — Documentation and design contract

- Goal: Establish language, boundaries, decisions, and an implementation plan before coding.
- Why now: The server touches personal finance data and will be reachable by Claude web over HTTPS.
- Depends on: Current MCP/Claude connector auth constraints and YNAB API docs.
- Links to plans: `docs/plans/2026-07-03-claude-web-ynab-mcp.md`

### Phase 2 — Local Streamable HTTP prototype

- Goal: Implement and test a TypeScript Streamable HTTP MCP server with read tools plus the initial category/category-group write slice.
- Why now: Local MCP use is working and is the current focus before public Claude web deployment.
- Depends on: Phase 1 auth and hosting decisions.

### Phase 3 — Ubuntu mini PC deployment hardening

- Goal: Deploy on the owner's Ubuntu mini PC with HTTPS, secret management, process supervision, logging, and backups/config recovery.
- Why later: Deployment shape should follow the validated prototype rather than lead it.
- Depends on: Phase 2 working in Claude web.

### Phase 4 — Additional write tools and optional escape hatch

- Goal: Add more explicit write tools beyond category/category-group create/update, and optionally a constrained read-only endpoint escape hatch.
- Why later: Additional write operations affect financial records and need separate confirmation, annotations, and tests.
- Depends on: Stable read tools and a clear write-safety policy.

## Deferred or explicitly out of scope

- Public Anthropic connector directory submission.
  - Reason: This is personal infrastructure for one owner.
  - Revisit trigger: Other users need to connect with their own YNAB accounts.
- Multi-tenant OAuth application support for arbitrary YNAB users.
  - Reason: Personal server stores one owner's YNAB credential.
  - Revisit trigger: The project stops being personal-only.
- Rich MCP app widgets.
  - Reason: Initial tools can return compact JSON/text.
  - Revisit trigger: We need charts, searchable pickers, or visual confirmation flows.
