# Architecture

## System goal

Expose a small, safe set of personal YNAB capabilities through an MCP server, currently used locally over Streamable HTTP, while preserving a clean path to future Claude web hosting over public HTTPS.

## Bird's-eye view

```text
Claude web custom connector
  ↓ remote Streamable HTTP over public HTTPS
YNAB MCP server on owner's Ubuntu mini PC
  ↓ HTTPS REST calls with server-side YNAB credential
YNAB API (`https://api.ynab.com/v1`)
```

## Major components

### Claude connector surface

- Responsibility: Let Claude discover and call MCP tools over Streamable HTTP.
- Important boundary: Claude authenticates to the MCP server through private MCP OAuth; it does not receive the YNAB credential.
- What it must not own: YNAB token storage, YNAB API response normalization, or write-safety policy.

### MCP server

- Responsibility: Register YNAB-focused MCP tools, enforce connector auth, call the YNAB client, and return compact structured JSON text results.
- Important boundary: Tool handlers call the internal YNAB client rather than constructing ad hoc upstream requests.
- What it must not own: user-facing financial advice, multi-tenant account management, or undocumented YNAB behavior.

### YNAB client boundary

- Responsibility: Centralize YNAB API base URL, bearer authentication, request building, error handling, and future write support.
- Important boundary: All upstream YNAB HTTP calls cross this boundary.
- What it must not own: MCP tool descriptions, Claude-specific prompt behavior, or presentation-heavy formatting.

### Tool modules

- Responsibility: Define named YNAB concept tools with tight schemas, annotations, and compact result shaping.
- Important boundary: Read tools and write tools live in separate modules.
- What they must not own: generic arbitrary endpoint execution as the primary API.

### Hosting boundary

- Responsibility: Make the Ubuntu mini PC-hosted service reachable to Claude web over HTTPS.
- Important boundary: Public exposure requires private MCP OAuth and origin/host hardening before YNAB data is reachable.
- What it must not own: YNAB application credentials beyond environment/config injection.

## Dependency or flow boundaries

- `Claude connector -> MCP server` means MCP JSON-RPC over Streamable HTTP.
- `MCP server -> YNAB client` means typed internal calls or a constrained request helper.
- `YNAB client -> YNAB API` means HTTPS requests with the server-side YNAB credential.
- Read tools must not call write endpoints.
- Write tools must not be exposed through a generic read/write executor.
- Cross-cutting concerns enter through configuration, auth middleware, and shared result/error helpers.

## Stable invariants

- The YNAB credential stays server-side.
- Public/Claude web access must use private MCP OAuth; any auth bypass is local/test-only.
- v1 connector auth supports CIMD only; DCR is a follow-up only if needed.
- MCP OAuth access and refresh tokens are stored in memory for v1; server restart requires reconnecting Claude.
- Claude web is the optimized runtime target, so public HTTPS and remote MCP behavior matter more than local stdio convenience.
- New public tools are named around YNAB concepts unless a deliberate escape hatch is added.
- Read and write operations are separate tools and separate modules.
- Category/category-group writes cover create and update only because YNAB does not expose delete endpoints for those resources; transaction writes cover single transaction create and update.
- Every tool has MCP annotations for at least title, read-only/destructive behavior, and external-world access.
- Tool results should be compact enough for Claude web limits and include IDs needed for follow-up calls.
- The project uses `plans`, not `budgets`, in new user-facing schemas and docs.

## Documentation architecture

The source-of-truth order and fact ownership table live in `AGENTS.md`. This file owns the current architecture synthesis only; it should point to, not duplicate, context, ADRs, roadmap, plans, or standards.

## Pointers

- Glossary: `CONTEXT.md`
- ADRs: `docs/adr/`
- Roadmap: `ROADMAP.md`
- Active plan: `docs/plans/2026-07-03-claude-web-ynab-mcp.md`
- Guidelines: `docs/guidelines/engineering-standards.md`
- Agent instructions: `AGENTS.md`
