# T-004 — Documentation alignment & verified brand values

**Session:** 1 · **Lane:** foundation/architecture · **Owner:** @architector (content) + @coder (transcription) · **Status:** todo
**Reviewers:** @reviewer + @architector
**Depends on:** T-001 · **Blocks:** T-006, T-007, T-008

## Outcome
The design and architecture docs describe the project as it actually is, and the brandbook gap in `docs/DESIGN_SYSTEM.md` is closed with verified values.

## Scope
In:
- Fix filename/casing references (`docs/ARCHITECTURE.md` → `docs/architecture.md`) in `AGENTS.md`, `docs/README.md`, and any instruction lists.
- `docs/DESIGN_SYSTEM.md` §1: replace the "brandbook not included / do not guess hex values" caveat with the verified table: SCARLET `#C60001`, NERO `#262424`, GRAY93 `#EDEDED`; note GRAY93 = 93% white, not `#939393`.
- Add a verified contrast matrix: nero on GRAY93 (13.1:1), white on scarlet (6.17:1), scarlet on GRAY93 (5.27:1), and an explicit **forbidden** pair: scarlet text on nero (2.48:1) — dark theme needs a lightened accent variant.
- Typography: Inter confirmed; printed hierarchy 64/34/16 px; weights Black/Bold/Medium/Regular/Light.
- Logo rules section: logo (mark) for short formats, logotype for long formats, equal clear space, solid backgrounds, two colors must contrast, three-color order rule; asset locations under `NGOinfoSources/logo/`.
- Record D-01/D-02 outcomes in `docs/architecture.md` §1/§2 (or a "Divergences" note).
- Update `docs/README.md` "Decisions to confirm" — mark brandbook as supplied; keep unconfirmed items.
- Add `docs/tickets/` to the docs index.

Out: changing product requirements, inventing brand values not printed in the book, duplicating brand assets into `src/` (done in T-006/T-008).

## Design constraints
- Brandbook pages 11–14 (color, logotype+color, typeface, typo hierarchy).
- `docs/DESIGN_SYSTEM.md` §1–§3, §6.

## TDD plan
Docs ticket — verification-first.
1. RED: `rg "docs/ARCHITECTURE.md"` and the "not been included" caveat still return hits.
2. GREEN: edit until both commands return no stale hits and the values match the PDF extraction.
3. Spot-check every hex against `NGOinfoSources/logo/SVG-*/logo_red.svg` / `logo_black.svg` fills.

## Acceptance criteria
- [ ] `rg "docs/ARCHITECTURE\\.md|has not been included|Do not guess hex"` returns nothing.
- [ ] Contrast matrix present, with the forbidden pair documented and the dark-theme accent requirement stated.
- [ ] Logo/typography rules match the brandbook, with page references.
- [ ] Architecture doc reflects the actual repository layout without contradicting `AGENTS.md`.
- [ ] No new organizational facts introduced (contact/social/team remain "not supplied").

## Verification
```
rg -n "ARCHITECTURE\.md|has not been included" docs AGENTS.md || true
rg -n "#C60001|#262424|#EDEDED" docs/DESIGN_SYSTEM.md
```

## Review gate
- @architector: every claim traceable to the brandbook or the regulations; no invented facts.
- @reviewer: doc/code truthfulness — claims must match the repo after T-001.

## Log
- (author) start:
