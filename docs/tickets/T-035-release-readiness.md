# T-035 — Release readiness & handoff

**Session:** 7 · **Lane:** release · **Owner:** @boss · **Status:** todo
**Reviewers:** @reviewer + @architector (final architecture check)
**Depends on:** T-033, T-034 · **Blocks:** none (release gate)

## Outcome
The full quality gate passes from a clean checkout, open decisions are explicitly resolved or documented as launch blockers, and the project is handed over with a launch checklist.

## Scope
In:
- Run every gate from `docs/TESTING.md` §5 from a clean install (`pnpm install --frozen-lockfile`).
- Confirm acceptance criteria from `docs/PRODUCT_REQUIREMENTS.md` §8 item by item, with evidence links.
- Decision audit: `DECISIONS.md` has no `open` row that blocks a shipped feature; unresolved items become explicit launch blockers in the handoff, not silent gaps.
- Security pass: RLS test suite green, storage policies green, no secret in the client bundle (`rg` on `dist`), dependency audit reviewed.
- Content audit: no fabricated contact/social/team/donation data; all published PL/UK content either approved or marked `needsReview`.
- Backup/export note for Supabase (docs §9) and a rollback path for the Netlify deploy.
- `docs/RELEASE_HANDOFF.md`: what shipped, what is deliberately deferred, how to operate content, known limitations, next steps.

Out: marketing launch, DNS cutover execution, ongoing maintenance plan.

## Design constraints
- `docs/PRODUCT_REQUIREMENTS.md` §8.
- `docs/TESTING.md` §5.
- `docs/architecture.md` §9 (backup/export), §10 (deliberate deferrals).
- `AGENTS.md` definition of done.

## TDD plan
Release gate — evidence-first.
1. RED: build the acceptance matrix with every item marked "unproven" and run the gate; record failures.
2. GREEN: fix or explicitly defer each; re-run until the matrix has no unproven item.
3. Verify the clean-checkout run (no local cache, no stray env file).

## Acceptance criteria
- [ ] Clean-checkout gate: format, lint, typecheck, unit, DB/RLS, E2E, build all green.
- [ ] Acceptance matrix complete with evidence per item.
- [ ] No `open` decision silently blocking a shipped feature.
- [ ] No secret in `dist`; no service-role key anywhere in the client.
- [ ] Published content contains no invented organizational facts.
- [ ] Backup/export and rollback documented.
- [ ] `docs/RELEASE_HANDOFF.md` written and reviewed.

## Verification
```
rm -rf node_modules && pnpm install --frozen-lockfile
bash scripts/ci-local.sh
rg -i "service_role|SUPABASE_SERVICE" dist || true
```

## Review gate
- @reviewer: matrix evidence is real command output, not claims; no gate skipped silently.
- @architector: final check that shipped architecture matches documented architecture or that divergences are recorded.

## Log
- (author) start:
