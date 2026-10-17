# Ticket Board

Vertical slices. One feature per ticket, test-first, independent review before close.
Ticket files live in this folder; the ledger is [STATUS.md](./STATUS.md); open inputs are tracked in [DECISIONS.md](./DECISIONS.md).

## Protocol

1. Take the lowest-numbered ticket whose dependencies are `done`.
2. Move it to `in-progress` in `STATUS.md`. Read the ticket's **Design constraints** and the referenced docs before writing code.
3. **TDD**: write the RED test first, run it, record the expected failure under `## Log` in the ticket, then implement the minimum, then refactor.
4. Run the ticket's full verification block; append the actual command output summary to `## Log`.
5. **Independent review is mandatory.** Dispatch `@reviewer` (two-axis: Standards + Spec) plus the lane reviewer named in the ticket. Reviewer is read-only — you apply findings, re-run verification, and ask for a re-check. A ticket cannot be closed by its author alone.
6. Close only when every acceptance checkbox is true: set `STATUS.md` to `done` with reviewer, commit sha, and date.
7. Never start the next session's tickets before the previous session's last ticket is `done`.

## Hard rules

- **No invented content.** Contact details, social URLs, team bios, donation data and legal identifiers must come from `NGOinfoSources/` (NIP/REGON are the only confirmed identifiers). Missing data ⇒ invisible UI or explicit "not configured" state.
- Every UI ticket: no hard-coded user-facing strings (en/pl/uk required), keyboard-operable, visible focus, semantic landmarks.
- Every data ticket: state the RLS consequence explicitly, even when it is "no new table".
- Every ticket that adds a dependency must justify it in one line in `## Log`.
- Test-first evidence is required for feature tickets. Infra tickets use a deliberately failing verification check as their RED step.
- Architecture-level tickets (T-001, T-004, T-012, T-013, T-034) also require `@architector` review against `docs/architecture.md`.
- UI tickets also require `@designer` review against `docs/DESIGN_SYSTEM.md` and the brandbook rules.

## Session map & context budget

| Session | Tickets | Focus | Expected context |
|---|---|---|---|
| 1 | T-001…T-005 | Repo baseline, test/CI harness, doc alignment | ~45% |
| 2 | T-006…T-011 | Brand tokens, typography, logo, locale, theme, public shell | ~55% |
| 3 | T-012…T-015 | Schema, RLS, storage policies, typed data access | ~50% |
| 4 | T-016…T-022 | About/Documents/Team, Projects, Publications, Contact, Support | ~60% |
| 5 | T-023…T-025 | Calendar adapter, Events page, Homepage composition | ~45% |
| 6 | T-026…T-031 | Admin auth, CRUD, uploads, featured order, event mapping | ~60% |
| 7 | T-032…T-035 | E2E matrix, a11y audit, SEO/deploy, release handoff | ~50% |

**Session stop rule:** stop opening new tickets at ~55% context usage, even mid-session.
Finish or park the current ticket, run its review gate, then:

1. Write `docs/tickets/HANDOFF-S<session>-<date>.md` from [HANDOFF_TEMPLATE.md](./HANDOFF_TEMPLATE.md).
2. Ask the user to verify the session outcome (commands + pages to check).
3. Propose starting a fresh session seeded with the handoff file, listing the next ticket range.
4. Do not start the next range in the same context.

**Resume rule:** a new session begins by reading `docs/tickets/README.md`, `STATUS.md`, `DECISIONS.md`, the latest handoff, and only the tickets in its own range.

## Ticket format

Every ticket uses: Session / Lane / Owner / Reviewers / Depends / Blocks, then Outcome, Scope, Design constraints, TDD plan, Acceptance criteria, Verification, Review gate, Log.
