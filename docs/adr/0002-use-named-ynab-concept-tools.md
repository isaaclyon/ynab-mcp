---
status: accepted
---

# ADR 0002 - Use named YNAB concept tools as the primary interface

## Context

The YNAB API has enough endpoints that a generic endpoint executor could expose broad coverage quickly, but generic API wrappers give Claude weaker semantics and make read/write safety harder to enforce. The owner prefers tools named around YNAB concepts, with a possible escape hatch later.

## Decision

The MCP server will expose named YNAB concept tools for the primary interface. The initial slice is read-only and covers plans, accounts, categories, months, and transactions. Any future generic or endpoint-oriented escape hatch must be constrained, documented, and secondary.

## Consequences

- Claude sees task-focused tool names and schemas instead of arbitrary paths/methods.
- Read and write capabilities can be separated cleanly.
- Adding write tools later remains straightforward because the YNAB client boundary can already support multiple HTTP methods.
- Full YNAB API coverage is slower than a generic wrapper, but safer and easier for Claude to use correctly.

## Alternatives Considered

- **Generic `execute_endpoint` tool**: maximizes coverage but weakens safety and tool-selection quality.
- **Search + execute action catalog**: useful if the project later wraps most of the YNAB API, but unnecessary for the initial small slice.
- **One tool per YNAB endpoint**: too much context surface for the personal initial version.
