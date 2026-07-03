# Roadmap

This file captures medium-term direction and sequencing. Temporary checklists live in `docs/plans/`.

## Current direction

- Build a personal YNAB MCP server optimized for Claude web custom connectors.
- Keep named read-only tools over YNAB plans/accounts/categories/months/transactions.
- Add explicit write tools without exposing generic mutation; current write slices cover category/category-group create/update, payee create/update, month/category budgeted amount update, and single transaction create/update.

## Active phases

### Phase 1 — Documentation and design contract

- Goal: Establish language, boundaries, decisions, and an implementation plan before coding.
- Why now: The server touches personal finance data and will be reachable by Claude web over HTTPS.
- Depends on: Current MCP/Claude connector auth constraints and YNAB API docs.
- Links to plans: `docs/plans/2026-07-03-claude-web-ynab-mcp.md`

### Phase 2 — Local Streamable HTTP prototype

- Goal: Implement and test a TypeScript Streamable HTTP MCP server with read tools plus category/category-group, payee, month/category budgeting, and transaction write slices.
- Why now: Local MCP use is working and is the current focus before public Claude web deployment.
- Depends on: Phase 1 auth and hosting decisions.

### Phase 3 — Ubuntu mini PC deployment hardening

- Goal: Deploy on the owner's Ubuntu mini PC with HTTPS, secret management, process supervision, logging, and backups/config recovery.
- Why later: Deployment shape should follow the validated prototype rather than lead it.
- Depends on: Phase 2 working in Claude web.

### Phase 4 — Additional write tools and optional escape hatch

- Goal: Add more explicit write tools beyond category/category-group and transaction create/update, and optionally a constrained read-only endpoint escape hatch.
- Why later: Additional write operations affect financial records and need separate confirmation, annotations, and tests.
- Depends on: Stable read tools and a clear write-safety policy.

#### Tool milestones

1. **Month/category budgeting tools** — implemented
   - Add `ynab_list_months`, `ynab_get_month_category`, and `ynab_update_month_category`.
   - Endpoints: `GET /plans/{plan_id}/months`, `GET /plans/{plan_id}/months/{month}/categories/{category_id}`, `PATCH /plans/{plan_id}/months/{month}/categories/{category_id}`.
   - Why first: unlocks direct inspection and adjustment of budgeted category amounts.
2. **Payee tools** — implemented
   - Add `ynab_list_payees`, `ynab_create_payee`, `ynab_get_payee`, and `ynab_update_payee`.
   - Endpoints: `GET/POST /plans/{plan_id}/payees`, `GET/PATCH /plans/{plan_id}/payees/{payee_id}`.
   - Why second: improves transaction write workflows by letting tools use stable `payee_id` values.
3. **Scoped transaction reads and transaction delete**
   - Add account/category/payee/month transaction list tools plus `ynab_delete_transaction`.
   - Endpoints: `GET /plans/{plan_id}/accounts/{account_id}/transactions`, `GET /plans/{plan_id}/categories/{category_id}/transactions`, `GET /plans/{plan_id}/payees/{payee_id}/transactions`, `GET /plans/{plan_id}/months/{month}/transactions`, and `DELETE /plans/{plan_id}/transactions/{transaction_id}`.
   - Safety note: transaction delete must be explicitly destructive in annotations and descriptions.
4. **Scheduled transaction tools**
   - Add list/create/get/update/delete tools for scheduled transactions.
   - Endpoints: `GET/POST /plans/{plan_id}/scheduled_transactions`, `GET/PUT/DELETE /plans/{plan_id}/scheduled_transactions/{scheduled_transaction_id}`.
   - Safety note: scheduled transaction payloads are transaction-like but should get separate schemas and tests.
5. **Money movement group reads**
   - Add `ynab_list_money_movement_groups` and `ynab_list_month_money_movement_groups`.
   - Endpoints: `GET /plans/{plan_id}/money_movement_groups`, `GET /plans/{plan_id}/months/{month}/money_movement_groups`.
   - Why later: useful for budget-movement history, but less central than budgeting, payee, transaction, and scheduled-transaction workflows.

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
