# Accessibility audit — T-033 evidence sheet

**Ticket:** `docs/tickets/T-033-accessibility-audit.md` · **Owner lane:** verification/a11y
**Target level:** WCAG 2.2 AA (`docs/DESIGN_SYSTEM.md` §6, §5-dark) · **Policy:** `docs/TESTING.md` §4
**Audit date:** 2026-10-26 · **Build audited:** production SPA (`quasar build`, `Pkg quasar v2.35.1`), Chromium (Playwright 1.63), axe-core via `@axe-core/playwright`.

> **Honesty statement.** Automated scans (axe) and the DOM-structure assertions in
> `e2e/support/a11y.ts` are machine checks. They are **not** conformance. Per
> `docs/TESTING.md` §4 the manual keyboard pass below was performed by driving a
> real browser with the keyboard only (Playwright, no mouse events) and reading
> computed styles / the accessibility tree. **No screen reader (NVDA / JAWS /
> VoiceOver / TalkBack) was available in this environment.** Therefore nothing in
> this sheet claims that a screen reader announced anything correctly; every
> "announced" item is evidenced only as *correct programmatic markup*
> (`role`, `aria-live`, `aria-describedby`, `aria-expanded`, document `lang`)
> that AT is expected to consume. Screen-reader output is an **unverified**
> limitation (§ Limitations), not a pass.

## 1. How to reproduce

```
pnpm test:e2e --grep "a11y"        # 58 checks: axe matrix + motion + reflow + keyboard
pnpm test --run src/shared/color   # 187 checks: contrast pairs + token completeness + parser regression
```

Both owned by the Playwright `webServer`, which builds the SPA with the
`VITE_*` env and intercepts Supabase/Calendar through deterministic fixtures
(`e2e/support/mocks.ts`, `e2e/support/project-store.ts`). No production service,
calendar, or account is contacted. A failing run leaves a screenshot + trace
under `test-results/`.

## 2. Automated axe matrix — critical + serious = 0

Gate: `expectNoBlockingViolations` (fails on any **critical OR serious** WCAG
2.0/2.1/2.2 A+AA violation). Every surface is scanned in **both** themes
(`e2e/axe-surfaces.spec.ts`).

| # | Surface (route) | Light | Dark | Structural landmarks/headings (public only) |
|---|---|---|---|---|
| 1 | Home `/en` | 0 | 0 | 1×main, 1×h1, no heading skips ✓ |
| 2 | About `/en/about` | 0 | 0 | ✓ |
| 3 | Project detail `/en/projects/<slug>` | 0 | 0 | ✓ |
| 4 | Publication detail `/en/publications/<slug>` | 0 | 0 | ✓ |
| 5 | Events `/en/events` | 0 | 0 | ✓ |
| 6 | Support `/en/support` | 0 | 0 | ✓ |
| 7 | Contact `/en/contact` | 0 | 0 | ✓ |
| 8 | Sign-in `/en/admin/sign-in` | 0 | 0 | (admin, structural not asserted) |
| 9 | Project form `/en/admin/projects/new` | 0 | 0 | (admin) |
| 10 | Mobile nav (drawer open, 360×640) | 0 | 0 | (nav pattern) |

**Result: 20 scans (10 surfaces × 2 themes), 0 critical and 0 serious.** This
closes T-032's five-surface gate to the full ten-surface matrix the ticket names.

*Baseline (RED).* T-032 recorded serious findings on the five original surfaces;
each was fixed under T-033. The new surfaces (project detail, publication
detail, sign-in, project form, mobile drawer) were added first as RED scans and
then fixed. The per-fix regression assertion is the scan itself: a future
critical/serious violation on any surface fails CI.

## 3. Contrast re-verification — all rendered text pairs, both themes

Machine-checked in `src/shared/color/__tests__/contrast.test.ts`, hex values
**parsed from `src/css/tokens.css`** (never hard-coded), using the WCAG relative-
luminance formula. **187 assertions pass.** Rows added/re-verified by T-033:

| Pair (role) | Min | Light | Dark |
|---|---|---|---|
| body text on background | 4.5 | ✓ | ✓ |
| muted text on background | 4.5 | ✓ | ✓ |
| **link text** (incl. active nav) on surface | 4.5 | 5.27 | 5.23 |
| accent-surface `--color-accent` + `--color-accent-text` (nero on `#FA4C3C`) | 4.5 | ✓ | 4.53 |
| white-on-scarlet (brand surface) | 4.5 | 6.17 | (nero pair used in dark) |
| success / warning / danger text on surface and surface-raised | 4.5 | ✓ | ✓ |
| `--color-danger` (`#FC8181`) on all dark surfaces | 4.5 | n/a | 5.14–6.32 |
| form-border vs form-bg (SC 1.4.11) | 3.0 | 3.56 | 3.03 |
| **form-border vs page background** (SC 1.4.11) | 3.0 | 3.04 | 3.23 |
| form-border vs surface (SC 1.4.11) | 3.0 | 3.24 | ✓ |
| focus ring on form-bg / in dialog | 3.0 | ✓ | ✓ |
| body / muted / link text in dialog (`--color-dialog-bg`) | 4.5 | ✓ | ✓ |

**Dark-theme accent variant (named by the ticket).** `--color-accent` (surface)
and `--color-link` (inline text) are deliberately divergent in dark
(`DESIGN_SYSTEM.md` §5); the re-verification confirms links/active-nav read as
`--color-link` (5.23:1) not the 4.25:1 accent surface value, and `--color-accent`
stays a surface carrying `nero` at 4.53:1. Pure SCARLET on NERO (2.50:1) remains
**forbidden** for text (guarded by the forbidden-pair test).

*Fix loop (text that was reading as an accent surface).* `DocumentsSection`,
`AppFooter`, `AppHeader`, `PublicationCard`, `AdminFeaturedPage`,
`AdminProjectsPage` had emphasis text using `--color-accent`; each moved to
`--color-link` (identical SCARLET in light, ≥4.5:1 on every dark surface),
while decorative strokes/borders stayed on the accent value (non-text, ≥3:1).
Regression assertion: the link-on-surface and danger-on-surface pairs above.

*Dark-mode Quasar internals (fix loop, finding `A-2`).* Quasar freezes `--q-*`
at compile time and `Dark.set()` only toggles `body--dark`, so in dark the button
labels / floating field labels / error icons kept the **light** values — axe
caught SCARLET outline-button text (2.50:1) and the danger floating label
(1.85:1) on NERO. `tokens.css` dark blocks now republish the certified dark
values under the Quasar names; the mapping is pinned by the **`--q-*` dark parity
gate** (§5 of `contrast.test.ts`) and the two dark blocks are kept identical by
`parseTokensCss.test.ts`.

*False-POSITIVE found (finding `H-1`, critical for the audit itself).* For an
unknown period every `[dark]` contrast row had **silently measured light values
against light backgrounds** and still passed: the token extractor walked
`indexOf('[data-theme="dark"]')`, which matched that literal text inside
`tokens.css` documentation comments and then collected the *next* block
(`:root`). Fix: `stripCssComments()` before selector matching
(`parseTokensCss.ts`), plus `parseTokensCss.test.ts` pinning the mechanism on a
synthetic CSS sample. **This is why the dark contrast numbers above are new
trustworthy measurements, not inherited passes.**

## 4. Rendered (computed-style) boundary proofs

`e2e/a11y-reflow.spec.ts` measures **painted** values, not the token table:

| Check | Theme | Result |
|---|---|---|
| sign-in `.admin-field__input` border vs its own fill | light / dark | ≥3:1 ✓ |
| sign-in field border vs **effective painted page** (walks to non-transparent `body`) | light / dark | ≥3:1 ✓ |
| Quasar outlined field `::before` border vs effective page (after the `app.scss` form-border override) | light + dark | ≥3:1 ✓ |

*Baseline.* These three first **failed as harness races** — they queried the DOM
before the Vue form mounted, and one resolved the field against the transparent
`main` (parsed as black, a false pass). Both corrected: each now awaits the
mounted control and measures the surface the boundary actually sits on. The
outlined test also no longer re-signs-in inside the theme loop (an already
authenticated admin is redirected off `/sign-in`), which had timed out.

## 5. Zoom / reflow / text-spacing

`e2e/a11y-reflow.spec.ts` — gate: no horizontal scroll of primary content
(`expectNoHorizontalOverflow`), no clipped container.

| Condition | Surfaces checked | Result |
|---|---|---|
| **320 px** width | support, contact, publications, projects, new-project form | ✓ |
| 320 px, **long PL/UK strings** | PL/UK support, UK about (EN-fallback note), PL/UK sign-in, UK drawer open | ✓ |
| **200 % zoom** (640×360 CSS px) | home, about, events, support, sign-in, project form | ✓ (h1 in scrollport) |
| **400 % text spacing** (WCAG 1.4.12 battery) | home, support, sign-in | ✓ no clipping |

*Baseline (RED).* The 400 %-spacing scan first **flagged the event card's
`event-card__sr` spans**. Those are canonical visually-hidden (sr-only) nodes —
`position:absolute; 1×1px; overflow:hidden` — so "clipping" them is correct, not
a violation. The offender detector was corrected to skip the sr-only *technique*
(not one class name), keeping the real check: a `overflow:hidden` container that
genuinely cuts off visible text.

## 6. Reduced motion & flashing

`e2e/a11y-motion.spec.ts`, emulating `prefers-reduced-motion: reduce`.

| Check | Light | Dark | Result |
|---|---|---|---|
| `--motion-duration` collapses to zero | ✓ | ✓ | 0 |
| site transitions (`theme-toggle__switch`, `app-header__nav-link`) = 0 | ✓ | — | all list entries zero |
| QSkeleton shimmer `animation-name: none` | ✓ | — | frozen |
| no `CSSAnimation` running under reduce (home) | ✓ | — | [] |
| flash ceiling: skeleton wave period ≥ 333 ms (motion allowed) | — | — | < 3 Hz ✓ |

*Baseline (RED, real app defect `M-1`).* Dark + reduced motion measured
`--motion-duration: 200ms` — **not** collapsed. Cause: the reduced block listed
`:root` and `[data-theme="dark"]` (0,1,0), but the system-dark block sets the
value through `:root:not([data-theme="light"])` (0,2,0), whose higher specificity
left OS-dark users at 200 ms. Fix in `tokens.css`: the reduced block now also
targets `:root:not([data-theme="light"])`; it is later in the file, so equal
specificity wins on source order. Regression assertion: the dark "collapses to
zero" check above. (Also corrected two harness bugs: `emulateMedia({colorScheme})`
resets `reducedMotion`, so the dark check re-asserts both; and the minifier
serialises `0ms`→`0s`, so the assertion accepts any zero unit.)

## 7. Manual keyboard / pattern pass (keyboard-only, real browser)

`e2e/keyboard-journeys.spec.ts`. No `.click()` in any journey path.

| Pattern (DESIGN_SYSTEM §6) | Evidence | Result |
|---|---|---|
| Skip link is first stop, moves focus to `main` | Tab → `expectVisibleFocus` text /skip/i → Enter → `main` focused | ✓ (events) |
| Focus order + no traps (dialogs) | search dialog: focus starts inside, Escape → trigger focused; confirm dialog: Cancel focused on open, Tab wraps Cancel→Accept, Escape → trigger focused | ✓ |
| Drawer behaviour (phone band) | burger by Tab + visible focus, `aria-expanded` true/false, drawer link tabbable, Escape → focus back to burger, link hidden | ✓ |
| Focus always visible (full sweep) | every tab stop on support (≥15) and admin sign-in (≥6) paints `:focus-visible` indicator | ✓ |
| Visible focus on Quasar admin buttons | **finding `A-1`** — see §8 | fixed, see below |
| Form errors associated + announced | sign-in: `aria-describedby`→`#admin-email-error`, `aria-invalid=true`, `role=status` failure text; project form: slug `aria-invalid`, message via `aria-describedby` ("Enter a URL slug."), focus moves to first error, `project-status-message` live region | ✓ (programmatic) |
| Language switch metadata | Enter opens, Tab selects Polski, URL `/pl`, `<html lang="pl">`, picker collapses | ✓ |
| TOC-driven traversal (events) | skip → TOC "Upcoming" → section h2 focus → project link → detail, all visible focus | ✓ |

## 8. Critical/serious findings — fix loop (every fix = a named test)

| ID | Finding | Severity | Fix | Regression assertion |
|---|---|---|---|---|
| **A-1** | Quasar `QBtn` painted **no visible keyboard focus**: it stamps `no-outline`, whose `.no-outline{outline:0!important}` outranks the site `.focus-ring` utility and the global `:focus-visible` rule (no `!important`). Confirmed on the Delete button: `outline:0 none`, `box-shadow:none`, `q-focus-helper` opacity 0. WCAG 2.4.7. | **Serious** (real defect; axe cannot detect focus visibility) | `app.scss`: `.q-btn:focus-visible{outline:3px solid var(--color-focus)!important;outline-offset:2px}` — class+pseudo (0,2,0) + `!important` beats `.no-outline` (0,1,0) only while `:focus-visible`, so pointer users see no change (visual quality preserved). | `keyboard-journeys` confirm-dialog: `expectVisibleFocus` on the focused Delete button (RED `outline=0 none` → GREEN). |
| **A-2** | Dark-theme Quasar internals (button labels, floating labels, error icons) kept light values → SCARLET outline text 2.50:1, danger label 1.85:1 on NERO. | Serious | `tokens.css` dark blocks republish certified dark values under `--q-*`; components use `--color-link` for text. | `contrast.test.ts` §5 `--q-*` dark parity + link-on-surface; `parseTokensCss.test.ts` dark-block parity; axe matrix (dark). |
| **M-1** | `prefers-reduced-motion` not honoured in OS-dark (200 ms persisted). | Serious | `tokens.css` reduced block also targets `:root:not([data-theme="light"])`. | `a11y-motion` "collapses to zero" (dark) — RED `.2s` → GREEN. |
| **H-1** | Dark contrast rows silently measuring light (parser matched `[data-theme="dark"]` text inside comments). | Audit-integrity | `stripCssComments()` before selector match. | `parseTokensCss.test.ts` (synthetic + real dark/`prefers-color-scheme` parity). |
| **F-1** | Light `--color-form-border` `#949292` cleared fill (3.10:1) but only 2.64:1 vs the page beside the field. | Moderate (SC 1.4.11) | one documented −0.035 border step → `#8A8787` (3.04:1 page / 3.56:1 fill). | `contrast.test.ts` "form-border on background" (light+dark). |
| — | 5 test-harness bugs (pre-hydration DOM races, minifier `0s`, sr-only false flag, phone-band/`/Language/` stale locators, wrong `<h1>`/re-signin). | not app defects | corrected **without weakening** the intent (waits added, region scoping, zero-any-unit duration). | Each assertion still proves the same property. |

## 9. Known limitations (unverified — NOT passes)

1. **No screen reader.** No NVDA/JAWS/VoiceOver/TalkBack in this environment.
   "Announced" claims in §7 are *correct programmatic markup* only; actual AT
   speech output (announcement order/timing, live-region behaviour) is **not
   verified** (`TESTING.md` §4).
2. **axe scope = critical/serious only.** Moderate and minor axe violations
   (some `landmark-*` best-practice and `region` advisories exist in the
   report) are not release-blocking under this gate and were not individually
   adjudicated; full severity tallies were not recorded.
3. **Single browser.** Chromium only (`playwright.config.ts` — firefox/webkit
   are commented out for the CI image). VoiceOver (Safari) and NVDA (Chrome)
   pairings are therefore untested.
4. **Zoom is a CSS-px simulation** (640×360 = half of 1280×720, the WCAG 1.4.4
   zoom geometry), not a browser-chrome reflow test; horizontal-scroll and
   reachability are the measured proxies.
5. **Contrast is token/computed-style math**, not pixel sampling of the rendered
   screenshot; gradients/shadows behind text (banner surfaces) are excluded from
   the numeric method.
6. **No VPAT / external agency / screen-reader certification** — out of scope
   per the ticket.

## 10. Review gate notes

- **@reviewer:** every claim above is page + check + result with a named test
  file; §9 names the limitations rather than asserting blanket compliance.
- **@designer (visual quality preserved):** A-1 changes rendering **only** under
  `:focus-visible` (keyboard), leaving pointer/hover states identical; A-2/M-1/F-1
  are token-value changes that keep light-mode pixels unchanged (documented
  `--color-link` == `--color-accent` == SCARLET in light) and preserve the brand
  scarlet surface identity rather than replacing it.
- **A-1 pointer-path regression pin (§10 visual claim is now machine-checked).**
  `e2e/keyboard-journeys.spec.ts` → *"pointer path keeps the QBtn ring-free —
  hover and a real mouse click paint no focus ring"* hovers the representative
  `project-save` QBtn and then drives a real mouse click on it, asserting the
  element does **not** match `:focus-visible` and shows no outline in either
  case (the click is proven to *operate* the control — it fires the slug
  validation — yet leaves no ring). This pins that the A-1 `!important` ring
  fires for keyboard focus only, so pointer/hover rendering is provably
  unchanged; the *keyboard* ring on the same control is asserted by the
  confirm-dialog journey directly above it.
