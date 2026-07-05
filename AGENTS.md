# Agent Guide

## Source-of-truth order

When documents disagree, resolve them in this order:

1. `CONTEXT.md` for canonical project language
2. current ADRs in `docs/adr/` for durable decisions
3. `ARCHITECTURE.md` for synthesized current system shape
4. `ROADMAP.md` for medium-term sequencing
5. `docs/plans/` for temporary implementation state
6. `docs/guidelines/engineering-standards.md` for quality standards
7. this file for agent/dev workflow rules

Do not let agent instructions invent domain concepts, architecture, or decisions that are missing from the owning docs.

## Repo-specific workflow

- Load `CONTEXT.md`, `ARCHITECTURE.md`, relevant ADRs, and active plans before material implementation.
- Treat Claude web custom connector compatibility as the primary runtime constraint.
- Keep YNAB credentials server-side. Never put tokens in examples beyond placeholder names.
- Prefer named YNAB concept tools over generic endpoint wrappers.
- Keep read and write tools separate in code, docs, tests, and annotations.
- For bug fixes, reproduce with a failing test or scripted MCP/API check before fixing when practical.
- After material code changes, run typecheck/tests and perform a review pass before reporting completion.

## What goes where

| Fact type                                 | Owner                                      |
| ----------------------------------------- | ------------------------------------------ |
| durable shared language                   | `CONTEXT.md`                               |
| durable hard-to-reverse decisions         | `docs/adr/`                                |
| current architecture synthesis            | `ARCHITECTURE.md`                          |
| medium-term sequencing                    | `ROADMAP.md`                               |
| temporary implementation plans/checklists | `docs/plans/`                              |
| engineering standards                     | `docs/guidelines/engineering-standards.md` |
| agent/dev workflow rules                  | `AGENTS.md`                                |
| local enforcement-seam rationale          | short code comment with ADR reference      |

## Before finishing material work

Check whether the change created a documentation delta:

- new or changed terminology?
- new or changed boundary/invariant?
- new durable decision?
- roadmap or implementation-plan status change?
- new engineering or agent workflow rule?
- new enforcement seam that deserves an ADR reference?

Update the owning file before claiming the work is complete.
