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
- [ ] `rg "docs/ARCHITECTURE\\.md|has not been included|Do not guess hex"` returns no hits outside this ticket file and the other ticket files that quote it by design.
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
- (author) start: T-001/T-002 closed (`0f34816`, `3c3fb98`).
- RED: `grep` for `docs/ARCHITECTURE.md` hit `AGENTS.md:10`, `docs/README.md:9` and `docs/README.md:22`; `docs/DESIGN_SYSTEM.md` still carried the "brandbook has not been included" caveat and the ESLint reference remained in `AGENTS.md` rule 10 and `docs/TESTING.md` §5.
- GREEN (in this ticket): `docs/DESIGN_SYSTEM.md` §1 rewritten — verified palette table, measured contrast matrix (13.1:1 / 6.17:1 / 5.27:1 / forbidden 2.48:1), a derivation rule for the dark-theme accent, and logo/logotype rules including the explicit "brandbook gives no numeric clear space or minimum size" note. §2 rewritten — Inter confirmed with printed anchors 64/34/16 px and subset requirements. `docs/README.md` — casing fixed, tickets folder added, brandbook decision marked resolved with the verified values and a pointer to `DECISIONS.md`. `AGENTS.md` — casing fixed and rule 10 updated to oxlint + oxfmt (D-02, user-approved; this is an instruction-file correction, so it is also flagged for `@ai_specialist` awareness in the session handoff). `docs/TESTING.md` — gate 3 renamed to "Lint (oxlint + oxfmt)".
- Every value and rule in the edit traces to the brandbook (pages 4, 5, 8–14) or to the logo SVG fills; nothing was inferred. Contact, social, team and donation data remain explicitly unsupplied.
- Verification: stale-reference grep returns hits only inside ticket files that quote the strings by design; brand hexes and all four contrast ratios present in `docs/DESIGN_SYSTEM.md`; `pnpm lint:check` still clean (29 files).
- Independent review (rev-1, `14176e5...670dfc8`): first pass raised 1 Major (AGENTS repository wording vs D-01) and 1 Minor (contrast precision 2.48 vs 2.50), both resolved in `670dfc8`; verdict "close T-004". Ratios were recomputed with the WCAG formula and independently confirmed by the reviewer (13.19 / 6.17 / 5.27 / 2.50).
- Architecture checkpoints (done by the reviewer because the `@architector` lane failed on a model configuration error) produced three follow-ups, now recorded: D-17 canonical admin claim, D-18 token derivation policy, D-19 single-source-of-truth governance. T-006 and T-013 tickets were updated so the decisions cannot be guessed later. One Minor remaining: token contract derivation method (now D-18) and duplication debt (D-19, deliberately not bulk-rewritten).
