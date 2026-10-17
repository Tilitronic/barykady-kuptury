# T-025 — Homepage composition

**Session:** 5 · **Lane:** feature/homepage · **Owner:** @designer · **Status:** todo
**Reviewers:** @reviewer + @designer
**Depends on:** T-016, T-019, T-022, T-024 · **Blocks:** T-032, T-034

## Outcome
The homepage explains the organization, offers one primary next step, shows the nearest upcoming events, and shows featured projects with a recent-projects fallback — with intentional empty states and calendar failure isolation.

## Scope
In:
- Sections: intro/mission (from `site_pages`, no literal copy), primary CTA from config, upcoming events (nearest N, ordered), featured projects (configured order; fallback = most recently updated published), routes to Projects/Events/Publications/Contact/Support.
- CTA selection is config-driven (`src/config/cta.ts`); with no configured destination the CTA is omitted rather than invented.
- Per-section states: loading, empty, error — independent so one failure cannot blank the page.
- Performance: above-the-fold content not blocked by calendar/fetch failures; no layout shift from images (dimensions set).
- Component tests: featured ordering, fallback ordering, empty events + empty projects, CTA omitted when unconfigured.
- E2E: featured projects in configured order; fallback when none featured; calendar 502 still renders mission + projects; axe 0 critical/serious.

Out: hero animation/parallax, marketing gradients (explicitly discouraged), CMS-driven section ordering.

## Design constraints
- `docs/PRODUCT_REQUIREMENTS.md` §5 (homepage contents, no fabricated content, empty states, calendar fallback), §8.
- `docs/DESIGN_SYSTEM.md` §3 (hierarchy, restraint), §4, §6.
- `docs/architecture.md` §8.

## TDD plan
1. RED: `HomePage.test.ts` — `renders featured projects in configured order`, `falls back to recent published when none featured`, `omits the CTA when unconfigured`.
2. GREEN: implement sections consuming T-015 helpers.
3. RED E2E: calendar 502 fixture — mission and projects still visible, events show error state.
4. RED E2E: no featured projects fixture — recent published shown, drafts absent.
5. REFACTOR: extract `SectionShell` for consistent heading/spacing across homepage sections.

## Acceptance criteria
- [ ] Mission text comes from data; no hard-coded organizational copy.
- [ ] Events on the homepage are the nearest upcoming, ordered, from the adapter.
- [ ] Featured order honoured; fallback to recent published proven; drafts never appear.
- [ ] CTA omitted when no destination configured.
- [ ] Calendar failure leaves the rest of the page intact.
- [ ] Empty states translated and never fabricate content.
- [ ] axe 0 critical/serious; LCP element is not blocked by remote data.

## Verification
```
pnpm test --run src/pages/home src/features/home
pnpm test:e2e --grep "home"
pnpm typecheck && pnpm lint:check
```

## Review gate
- @reviewer: spec axis §5 checklist, fallback correctness, no fabricated content, failure isolation.
- @designer: hierarchy and first-impression quality, mobile composition, scarlet restraint.

## Log
- (author) start:
