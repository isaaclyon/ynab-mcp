# YNAB MCP — Shared Context

This file owns durable project language. It should not become a task list or implementation diary.

## Language

**YNAB**: You Need A Budget, the upstream personal finance system exposed through `https://api.ynab.com/v1`.
_Avoid_: treating YNAB as a local database; it is an external SaaS API with rate limits and its own permission model.

**Plan**: YNAB's current API term for what older docs and integrations often called a budget. API paths now use `/plans/{plan_id}`; legacy `/budgets/{budget_id}` paths are not the primary project language.
_Avoid_: introducing `budget_id` in new tool schemas unless directly documenting legacy API compatibility.

**Month**: User-facing month inputs use `YYYY-MM`, but YNAB's month API paths identify months as the first day of the month (`YYYY-MM-01`). Tool schemas should stay user-friendly and the YNAB client boundary should convert month inputs before upstream requests.
_Avoid_: exposing `YYYY-MM-01` as the normal tool input shape unless directly matching a raw YNAB API response.

**Personal server**: This MCP server is for one owner, backed by that owner's YNAB account and hosted on that owner's infrastructure.
_Avoid_: assuming multi-tenant storage, public directory submission, or other-user onboarding unless the roadmap changes.

**Ubuntu mini PC**: The settled production host for the personal server. It is an Ubuntu server box controlled by the owner.
_Avoid_: treating host selection as an open cloud-vs-local decision. Tunnel/reverse-proxy details remain implementation choices.

**Claude web custom connector**: A remote MCP server added through Claude web's Settings → Connectors flow. Claude web must reach the server over public HTTPS; it cannot call `localhost` on the developer's machine.

**Remote Streamable HTTP**: The primary MCP transport target for Claude web. Local stdio may be useful for development, but it is not the intended production shape.

**YNAB credential**: The credential used by this server to call YNAB. For the personal version this is expected to be a Personal Access Token stored on the server, not sent to Claude or included in connector URLs.

**Connector auth**: Authentication between Claude and this MCP server. It is separate from the YNAB credential. It exists to prevent arbitrary internet clients from using the owner's server-side YNAB credential.

**Private MCP OAuth**: The personal connector-auth mechanism for this server: an MCP-compatible OAuth authorization-code flow with PKCE, gated by an owner-controlled passphrase, issuing bearer tokens for Claude to call this MCP server.

**Owner passphrase**: A long, high-entropy secret stored in server configuration and entered only on this server's authorization page. It gates connector authorization; it is not the YNAB credential.
_Avoid_: calling this a short PIN or using a low-entropy numeric code.

**CIMD**: Client ID Metadata Document OAuth registration mode. For v1, this server supports CIMD for Claude clients and does not implement Dynamic Client Registration unless smoke tests prove it necessary.

**Dev auth bypass**: A local/test-only configuration that skips connector auth for fast tool development. It must not be used for public Claude web testing or deployment.

**Read-only tool**: A tool that only performs YNAB `GET` requests or local filtering of fetched data. It must be annotated as read-only in MCP tool metadata.

**Write tool**: A tool that creates, updates, imports, deletes, or otherwise mutates YNAB state. Write tools are separate from read tools and must not be hidden behind a generic executor. Current write slices cover category/category-group create/update, payee create/update, month/category budgeted amount update, and single transaction create/update/delete; YNAB does not expose delete endpoints for categories or category groups.

**Named YNAB concept tool**: A tool named after user-facing YNAB concepts and tasks, such as listing plans, accounts, categories, months, or transactions.
_Avoid_: exposing the whole REST API as the primary model-facing interface.

**Money movement**: A YNAB API record representing assigned money moving through the plan, such as category-to-category moves or Ready to Assign activity. It is about budget allocation movement, not bank-account transaction movement.

**Money movement group**: A YNAB API grouping of related money movement records into a higher-level budgeting action. Treat it as read-only history/metadata until response examples are validated against the live API.

**Escape-hatch endpoint tool**: A constrained tool, if added later, for discovering or executing less-common YNAB API calls. For this project, any escape hatch starts read-only and should reference YNAB API docs explicitly.

## Relationships

- A **Claude web custom connector** calls the **personal server** over **remote Streamable HTTP**.
- The **personal server** calls **YNAB** using the server-side **YNAB credential**.
- **Connector auth** protects the MCP endpoint; it does not replace the **YNAB credential**.
- **Read-only tools** are complemented by explicit **write tools** with separate schemas and annotations.
- **Named YNAB concept tools** are the default interface; an **escape-hatch endpoint tool** is optional and secondary.

## Flagged ambiguities

- The exact connector-auth mechanism for a personal Claude-web-optimized deployment still needs validation against Claude's current custom connector behavior. See `docs/plans/2026-07-03-claude-web-ynab-mcp.md`.
