---
status: accepted
---

# ADR 0003 - Use private MCP OAuth for connector auth

## Context

Claude web custom connectors need to reach this server over public HTTPS. The server uses a server-side YNAB credential, so an unauthenticated public MCP endpoint would expose personal financial data if the URL leaked. Claude web does not support pasted static bearer tokens for custom connectors, and tokens in connector URLs are not supported.

This server is personal-only, so full multi-user YNAB OAuth is unnecessary for v1. Connector auth only needs to prove that the Claude connector is authorized to use the owner's personal MCP server; it does not grant or replace the YNAB credential.

## Decision

Implement private MCP-compatible OAuth for connector auth:

- Public Claude web access uses an OAuth authorization-code flow with PKCE.
- The authorization screen is protected by an owner-controlled passphrase.
- The server issues Claude MCP bearer tokens after successful authorization.
- The server uses Client ID Metadata Document (CIMD) support for v1, not Dynamic Client Registration (DCR).
- OAuth access and refresh tokens are stored in memory for v1. Server restarts require reconnecting Claude.
- A dev-only auth bypass may exist for localhost/test runs, but must not be used for public Claude web testing or deployment.

## Consequences

- The first Claude web smoke test exercises real connector auth behavior.
- The YNAB credential remains server-side and separate from connector auth.
- v1 avoids a client-registration database, persistent token store, and DCR lifecycle.
- If Claude web smoke tests reveal CIMD incompatibility, DCR can be added as a follow-up compatibility feature.
- Local tool development can stay fast through a constrained dev bypass.

## Alternatives Considered

- **No connector auth**: simplest, but unsafe for a public HTTPS endpoint backed by a YNAB credential.
- **Static bearer token pasted into Claude**: not supported by Claude web custom connectors.
- **Token in connector URL**: explicitly unsupported and unsafe.
- **YNAB OAuth directly as connector auth**: more complex than needed for personal-only use and mixes upstream YNAB authorization with MCP server access control.
- **DCR from day one**: broader compatibility, but unnecessary complexity for a personal Claude-web-first server.
