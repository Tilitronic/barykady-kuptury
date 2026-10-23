# T-032 — Full E2E journey matrix

**Session:** 7 · **Lane:** verification · **Owner:** @coder · **Status:** done
**Reviewers:** @reviewer (rev-1 FIX + fixes verified)
**Depends on:** T-019…T-031 · **Blocks:** T-035

## Outcome
All twelve journeys from `docs/TESTING.md` §2 run deterministically in CI, including mobile viewport and keyboard-only variants.

## Scope
In — one spec per journey, all fixture-driven:
1. Anonymous navigation + direct deep link to project/publication detail.
2. Locale detection at `/`, explicit locale URLs, switching, persisted choice.
3. Theme: system first visit, override persists.
4. Homepage upcoming events in chronological order (mocked function).
5. Event with project links to the published detail; event without project renders.
6. Featured order + recent fallback.
7. Contact details/mailto and any enabled form (validation/success/error) — form path only if D-09 provides a provider; otherwise assert the no-form contract.
8. Admin routes require auth; anonymous admin mutations rejected.
9. Admin creates/edits/publishes project and publication; drafts invisible anonymously.
10. Admin associates/unassociates an event with a project.
11. Upload/download obeys the access policy.
12. Mobile viewport + keyboard-only navigation through main and admin workflows.

Out: cross-browser matrix beyond chromium (optional), visual regression snapshots, load testing.

## Design constraints
- `docs/TESTING.md` §2 (all twelve), §3, §4 (axe in key journeys).
- `docs/PRODUCT_REQUIREMENTS.md` §8 acceptance criteria.
- `docs/DESIGN_SYSTEM.md` §6.

## TDD plan
E2E tickets are themselves tests.
1. RED: write each spec first; run against the current build and record genuine failures where behaviour is incomplete.
2. GREEN: fix product code or fixture gaps until all pass — no test weakening to force green.
3. REFACTOR: extract page objects/fixtures; keep selectors role-based.

## Acceptance criteria
- [ ] 12/12 journeys present and passing headless in CI.
- [ ] No test depends on a real calendar, Supabase project, network timing, or live content.
- [ ] Keyboard-only variant proves focus visibility and no traps.
- [ ] Mobile variant at 360×640 completes each journey.
- [ ] axe assertions on home, a detail page, mobile nav, contact, and an admin form.
- [ ] Failure screenshots/traces captured as artifacts.
- [ ] Test run time documented; suite is not flaky across 3 consecutive runs.

## Verification
```
pnpm test:e2e
pnpm test:e2e --repeat-each=3 --grep "critical"
```

## Review gate
- @reviewer: every journey maps to a quoted acceptance criterion; no weakened assertions, no arbitrary waits, selectors stable.

## Log
- (author) start:

### 2026-10-23 — journey-to-spec matrix and gap closure (@code-executor)

**Journey → spec mapping.** Existing coverage is listed first; T-032 additions are
marked **(new)**. Every row is fixture-driven and runs in the built SPA through
the Playwright-managed server.

| # | `docs/TESTING.md` §2 journey | Covering spec(s) |
|---|---|---|
| 1 | Anonymous navigation + direct deep link to project/publication detail | `projects.spec.ts`, `publications.spec.ts`, `shell.spec.ts`, `documents.spec.ts` (reader deep links); **`mobile-journeys.spec.ts` J1 (new)** |
| 2 | Locale detection at `/`, explicit locale URLs, switching, persisted choice | `locale.spec.ts` (en/pl/uk + persisted root redirect); **`mobile-journeys.spec.ts` J2 (new)** |
| 3 | Theme follows system first visit, override persists | `theme.spec.ts` (pre-paint, live system change, persistence); **`mobile-journeys.spec.ts` J3 (new)** |
| 4 | Homepage upcoming events in chronological order | `home.spec.ts`; **`mobile-journeys.spec.ts` J4 (new)** |
| 5 | Event with project links to published detail; event without project renders | `events.spec.ts` (published-only join, draft/wrong-calendar dropped); **`mobile-journeys.spec.ts` J5 (new)** |
| 6 | Featured order + recent-published fallback | `home.spec.ts`, `admin-featured.spec.ts`; **`mobile-journeys.spec.ts` J6 (new)** |
| 7 | Contact details/mailto and D-09 form contract | `contact.spec.ts` (shipped empty state, no fabricated channels, axe); **`contact-contract.spec.ts` (new, all 3 locales + configured mailto fixture)**; **`mobile-journeys.spec.ts` J7 and J7b (new)** |
| 8 | Admin routes require auth; anonymous admin mutations rejected | `admin-auth.spec.ts` (guard, session restore, viewer denial, sign-out, anonymous `save_project_v1` 403/`42501` + admin 200); **`mobile-journeys.spec.ts` J8 (new)** |
| 9 | Admin creates/edits/publishes project + publication; drafts invisible anonymously | `admin-projects.spec.ts`, `admin-publications.spec.ts`, `admin-content.spec.ts`, `admin-documents.spec.ts`, `admin-scopes.spec.ts`; **`mobile-journeys.spec.ts` J9 (new, 360×640)** |
| 10 | Admin associates/unassociates a calendar event with a project | `admin-events.spec.ts` (published link, draft no-link, unassign, outage); **`mobile-journeys.spec.ts` J10 (new)** |
| 11 | Upload/download obeys the access policy | `admin-publications.spec.ts`, `admin-documents.spec.ts`, `publications.spec.ts`, `documents.spec.ts`; **`mobile-journeys.spec.ts` J11 (new, 360×640)** |
| 12 | Main + admin workflows on mobile and keyboard-only | `shell.spec.ts`, `mobile-bottom-nav.spec.ts`, `admin-auth.spec.ts` (320 px), `documents.spec.ts`, `publications.spec.ts`, `reader.spec.ts`, `search.spec.ts` (keyboard cases); **`mobile-journeys.spec.ts` J12 (new)**; **`keyboard-focus.spec.ts` (new — visible-focus + no-trap proof, public and admin at 360×640)** |

**Added / changed files**

| File | Change | Tests |
|---|---|---|
| `e2e/mobile-journeys.spec.ts` | New — all 12 journeys at exactly 360×640, plus J7b configured-contact mailto | 13 |
| `e2e/keyboard-focus.spec.ts` | New — keyboard-only public/admin, `:focus-visible` + outline/box-shadow assertions, role/name tab walks, no traps, drawer Escape/focus return | 3 |
| `e2e/axe-journeys.spec.ts` | New — axe (critical + serious) on home, project detail, publication detail, open mobile nav, contact, admin new-project form | 6 |
| `e2e/contact-contract.spec.ts` | New — D-09 guard in en/pl/uk (3) plus a configured-channel mailto/tel fixture branch (1) | 4 |
| `e2e/icon-map.spec.ts` | New — mounted regression: Quasar-internal icons render as SVG, no visible Material-Icons ligature text | 1 |
| `e2e/admin-auth.spec.ts` | Added anonymous project-mutation rejection: 403/42501, store unchanged, guard redirect; same write with the admin bearer token succeeds | +1 |
| `e2e/support/journey-fixtures.ts` | Shared deterministic fixtures + configured-contact fixture seed + overflow assertion with offending-element diagnostics | — |
| `e2e/support/journey-helpers.ts` | Keyboard helpers (`focusBody`, `focusedStyle`, `expectVisibleFocus`) and `tabUntilRole` — resolves the expected control by accessible role + name | — |
| `e2e/support/project-store.ts` | Optional `authorize` gate on mutating requests, mirroring the RLS/RPC contract (403 `42501`, no store write); default stays permissive for existing journeys | — |
| `e2e/support/a11y.ts` | Added `expectNoBlockingViolations` (critical + serious) | — |
| `src/features/contact/contactFixture.ts`, `src/pages/[locale]/contact.vue`, `env.d.ts`, `quasar.config.ts`, `playwright.config.ts` | Guarded E2E-only contact fixture seam: build flag `__BK_E2E_CONTACT_FIXTURE__` is false everywhere except the Playwright build; tests seed clearly fictional channels via localStorage | — |
| `src/config/quasarIconMap.ts`, `src/config/__tests__/quasarIconMap.test.ts`, `src/boot/icons.ts` | Inline-SVG icon map plus contract tests (13) for the names Quasar components request | 13 |
| `playwright.config.ts` | `screenshot: "only-on-failure"`, `trace: "retain-on-failure"` (artifacts proven on the RED runs) | — |
| `src/css/app.scss` | Quasar hint text uses `--color-text-muted` (#6c6a6a on #ededed = 4.59:1); error text keeps `--color-danger` | — |

**RED → GREEN evidence (initial batch).** The first new-spec run failed 7/24:
two keyboard focus checks raced hydration, J6 had the wrong fallback
`updated_at` order, J10 clicked a narrow QSelect through its dropdown
affordance, J11 exposed 408 px document width at 360 px, and the admin-form axe
scan found one serious `color-contrast` violation on Quasar hint text. Each
cause was fixed without weakening an assertion; the second run was 24/24.

**Gate-fix batch — reviewer verdict items 1–5 (2026-10-23).**

| # | Item | Before | RED evidence | After / GREEN |
|---|---|---|---|---|
| 1 | J7 configured mailto branch | **PARTIAL** — only the unconfigured empty state was covered | Configured-contact specs failed: `getByRole('link', { name: 'e2e-contact@example.org' })` not found | **MET** — `contact-contract.spec.ts` configured branch + `mobile-journeys.spec.ts` J7b assert `mailto:` subject encoding, `tel:`, address, and the continuing no-form guard |
| 2 | J8 anonymous mutation rejection | **PARTIAL** — UI redirect only, no data-boundary proof | Anonymous `save_project_v1` returned **200** and wrote a row | **MET** — `admin-auth.spec.ts` asserts 403/`42501`, store length 0, guard redirect; the same request with the mocked admin bearer token returns 200 and writes one row |
| 3 | Log honesty | **PARTIAL** — acceptance rows overstated J7/J8 | — | **MET** — this table records PARTIAL→MET per item and the new run counts |
| 4 | Role-based selectors | **PARTIAL** — primary mobile/keyboard assertions used CSS/test ids | — | **MET** — `mobile-journeys` + `keyboard-focus` now use `getByRole`/`getByLabel`; `tabUntilRole` resolves the target by role + name. Remaining element selectors are structurally unavoidable and commented: unnamed `<form>`, `<address>`, the `.material-icons` fallback probe, and the document `<html>` lang assertions |
| 5 | Icon-map safety net | **PARTIAL** — product fix landed without a guard | `icon-map.spec.ts` failed when the `icons` boot entry was temporarily removed (visible ligature text found) | **MET** — unit contract (13 tests) + mounted E2E assertion; boot entry restored |

**Runs (headless chromium, built SPA).**

| Run | Result | Test time | Wall-clock |
|---|---|---|---|
| New specs, initial batch | 24 passed | 55.5 s | 1 m 00 s |
| Full E2E, initial batch (36 files) | 221 passed | 2.5 m | 2 m 34 s |
| Critical, initial batch runs 1/2/3 | 25 passed each | 57.3 / 59.0 / 58.4 s | 62 / 64 / 64 s |
| Full E2E after gate fix (37 files) | **225 passed** | 2.6 m | **2 m 44 s** |
| Critical after gate fix, run 1 (`--grep "critical"`) | **27 passed** | 1.1 m | **68 s** |
| Critical after gate fix, run 2 | **27 passed** | 1.1 m | **69 s** |
| Critical after gate fix, run 3 | **27 passed** | 1.0 m | **66 s** |

No flakes across the three post-fix critical runs (identical pass set, no
retries). Supporting gates: `pnpm typecheck` clean; `pnpm format:check` and
`pnpm lint:check` clean (457 files); `pnpm test` **157 files / 1527 tests**
passed. Failure artifacts were verified during the RED runs
(`test-results/**/test-failed-1.png`, `trace.zip`).

**Acceptance status**

| Criterion | Status | Evidence |
|---|---|---|
| 12/12 journeys present and passing headless | **MET** (was PARTIAL before gate items 1–2) | mapping table + 225-test full suite |
| J7 configured contact details/mailto + D-09 no-form | **MET** (was PARTIAL) | `contact-contract.spec.ts` configured branch; `mobile-journeys.spec.ts` J7/J7b |
| J8 anonymous admin mutation rejected at the data boundary | **MET** (was PARTIAL) | `admin-auth.spec.ts` 403/42501 + admin 200 |
| No real calendar/Supabase/network/live content | **MET** | `support/network-guard.ts` + per-journey mocks in every new spec |
| Keyboard-only proves focus visibility and no traps | **MET** | `keyboard-focus.spec.ts` |
| Mobile variant at 360×640 completes each journey | **MET** | `mobile-journeys.spec.ts` J1–J12 + J7b |
| axe on home, detail, mobile nav, contact, admin form | **MET** | `axe-journeys.spec.ts` (critical + serious) |
| Failure screenshots/traces as artifacts | **MET** | `playwright.config.ts`; observed in `test-results/` |
| Run time documented; not flaky over 3 runs | **MET** | post-fix table (68/69/66 s, no flakes) |
| Icon-map regression guard | **MET** | `src/config/__tests__/quasarIconMap.test.ts` + `e2e/icon-map.spec.ts` |

**Gate-fix selector note (item 4).** Primary journey assertions use accessible
roles/names; where a role cannot exist the selector is kept and justified inline:
`main form` (an unnamed form has no ARIA role), `main address` (no role),
`.material-icons` (the exact fallback mechanism under test), and `html[lang]`
(document metadata). No class/test-id locator remains in the mobile/keyboard
primary journey paths.
