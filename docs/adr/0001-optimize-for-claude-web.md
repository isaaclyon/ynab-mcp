---
status: accepted
---

# ADR 0001 - Optimize for Claude web with remote Streamable HTTP

## Context

The owner wants to use Claude web, not just Claude Code or Desktop. Claude web custom connectors must reach MCP servers over a public HTTPS URL; they cannot connect to a developer-machine `localhost` stdio server. The owner has a settled Ubuntu mini PC server for hosting. The exact tunnel/reverse-proxy shape can remain an implementation-plan choice.

## Decision

The primary production shape is a TypeScript MCP server exposed as a remote Streamable HTTP endpoint for Claude web. Local stdio may be used for development convenience, but it is not the architecture target.

## Consequences

- The implementation must validate behavior against Claude web custom connectors, not only MCP Inspector or Claude Code.
- Hosting, HTTPS, and connector auth are first-class design concerns.
- The Ubuntu mini PC deployment path should be planned early; this ADR fixes the production host class but not the tunnel/reverse-proxy details.
- Local-only shortcuts are acceptable only if they do not make the remote HTTP server harder to build.

## Alternatives Considered

- **Local stdio first and stay there**: fastest to prototype, but does not serve Claude web.
- **Claude Desktop local command**: useful for some local workflows, but not the requested optimization target.
- **Public directory connector**: unnecessary for a personal-only server and adds review/distribution requirements.
