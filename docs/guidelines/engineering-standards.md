# Engineering Standards

## Testing

- Required command surface once code exists: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, and a scripted MCP smoke check for `initialize`, `tools/list`, and at least one tool call.
- New YNAB client behavior should have unit tests around request construction, error handling, and result shaping.
- New MCP tools should have schema/handler tests or smoke coverage with mocked YNAB responses.
- Bug fixes should start with a failing test or reproducible scripted check when practical.

## Typing

- Primary language: TypeScript.
- TypeScript should use `strict` mode.
- Avoid `any`; prefer `unknown` at API boundaries and parse/narrow before use.
- YNAB API responses may be partially typed at first, but tool outputs should be intentionally shaped rather than raw dumps.
- Formatting is owned by Prettier; linting is owned by type-aware ESLint rules from `typescript-eslint`.

## Boundary design

- Secrets and deployment-specific URLs come from environment/config, never hardcoded.
- Do not log YNAB tokens, owner passphrases, OAuth authorization codes, access tokens, or refresh tokens.
- The YNAB credential is only used by the server-side YNAB client boundary.
- Tool schemas should be tight: bounded limits, explicit enums, and clear descriptions.
- Read and write operations must be separate tools and separate code paths.
- Public HTTP exposure requires private MCP OAuth before YNAB data is reachable.
- Dev auth bypasses must be limited to localhost/test configuration and must not be valid deployment defaults.

## Simplicity

- Do not build multi-tenant infrastructure for the personal-only version.
- Do not add MCP app widgets until plain tool results are insufficient.
- Do not generate a huge one-tool-per-endpoint wrapper for the full YNAB API.
- Add abstractions only after at least two concrete uses need the same boundary.

## Change workflow

- Keep commits/changes focused around one decision or feature area.
- Update docs when terminology, boundaries, decisions, roadmap, or workflow expectations change.
- For material implementation work, run a review pass before claiming completion.
