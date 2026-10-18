# T-011 — Public shell: header, navigation, footer

**Session:** 2 · **Lane:** feature/ui · **Owner:** @designer · **Status:** todo
**Reviewers:** @reviewer + @designer + accessibility spot-check
**Depends on:** T-006…T-010 · **Blocks:** T-016…T-025, T-032

## Outcome
Every public route renders inside an accessible, responsive shell with the six required destinations, language and theme controls, configured-only social links, a skip link, and a footer that never displays invented data.

## Scope
In:
- `PublicLayout.vue`: skip-to-content link as first focusable element, `<header>/<main id="main">/<footer>` landmarks, single `<h1>` per page supplied by pages.
- `AppHeader.vue`: desktop nav — Contact, About us, Support us, Projects, Events, Publications (i18n labels, `aria-current="page"`); mobile pattern with explicit open/close state, no hover dependency, Escape closes, focus returns to trigger.
- About sub-navigation (organization info, team, documents) — a landing page plus in-page or secondary nav.
- `LanguageSwitcher` + `ThemeToggle` mounted in header.
- `SocialLinks.vue`: renders **only** entries from `src/config/organization.ts` with a non-empty URL; each icon link has an accessible name and `rel="noopener noreferrer"`; renders nothing when the list is empty (current state, D-05).
- `AppFooter.vue`: navigation, contact block (hidden until D-04 supplies data), social links, legal line using only verified identifiers (name, seat Poznań, NIP/REGON when enabled by config), privacy link only when supplied.
- Responsive behaviour down to 320 px and at 200 % zoom; long Polish/Ukrainian strings must not clip.
- Component tests: nav labels per locale, social rendering rules, drawer open/close/Escape/focus return, skip-link target.
- E2E: keyboard-only traversal of header → main → footer; mobile viewport navigation; axe scan on the shell.

Out: page content (later tickets), footer legal text that is not supplied.

## Design constraints
- `docs/PRODUCT_REQUIREMENTS.md` §4 (destinations, social rules, About subsections), §3 (responsive, zoom).
- `docs/DESIGN_SYSTEM.md` §4, §6 (landmarks, skip link, keyboard, focus, icon names, 200 % zoom).
- D-04, D-05 (missing data ⇒ hidden UI).

## TDD plan
1. RED: `SocialLinks.test.ts` — `renders nothing when no links configured` and `gives each icon an accessible name` fail.
2. RED: `MobileNav.test.ts` — `closes on Escape and returns focus to the trigger` fails.
3. GREEN: implement components + layout, then wire routes for the six destinations as empty page stubs with real headings.
4. RED E2E: Tab from page start reaches skip link first, then logo, then nav; axe critical = 0.
5. REFACTOR: extract nav model (`src/config/navigation.ts`) consumed by header, footer, and mobile drawer — one source of truth.

## Acceptance criteria
- [x] Six destinations present in all three locales with correct routes.
- [x] Skip link is the first tab stop and moves focus to `#main`.
- [x] Mobile drawer: keyboard operable, Escape closes, focus trap not required but focus must return to trigger, no horizontal overflow at 320 px.
- [x] Social block renders nothing with the current empty config; adding a URL makes exactly one labelled link appear.
- [x] Footer shows no address/email/legal identifier that is not in config.
- [x] axe: 0 critical/serious on the shell in light and dark, desktop and mobile.
- [x] No user-facing string outside i18n catalogues.

## Verification
```
pnpm test --run src/layouts src/components/navigation src/components/brand
pnpm test:e2e --grep "shell|navigation"
pnpm typecheck && pnpm lint:check
```

## Review gate
- @reviewer: a11y semantics, one nav model, config-driven content only.
- @designer: hierarchy, spacing rhythm, mobile pattern quality, restraint with scarlet.
- Accessibility spot-check by the orchestrator: manual Tab/Shift-Tab and screen-reader name check on the drawer.

## Log
- (author) start:

### RED evidence (TDD steps 1–2)

**Step 1 — SocialLinks.test.ts RED:**
```
FAIL  src/components/navigation/__tests__/SocialLinks.test.ts
Error: Failed to resolve import "@/components/navigation/SocialLinks.vue"
```
Both tests failed — module did not exist. Expected failure.

**Step 2 — MobileNav.test.ts RED:**
```
FAIL  src/components/navigation/__tests__/MobileNav.test.ts
Error: Failed to resolve import "@/components/navigation/AppHeader.vue"
```
All tests failed — module did not exist. Expected failure.

### Nav model decision

`src/config/navigation.ts` is the single source of truth consumed by AppHeader,
AppFooter, and the About page secondary nav. Each `NavItem` carries `labelKey`
(i18n key suffix under `nav.*`), `path` (segment without locale), and `routeName`
(for `aria-current` matching). About sub-routes are in `aboutSubNavItems`.

Mobile drawer pattern: `isMenuOpen` ref controls visibility; `data-testid="menu-trigger"`
button has `aria-expanded` and `aria-controls`; `@keydown.esc` on the nav element
calls `closeMenu()` which sets `isMenuOpen=false` then `nextTick(() => triggerRef.value?.focus())`.

### GREEN implementation

Files created:
- `src/config/organization.ts` — verified facts only (NIP, REGON, name, seat);
  D-04/D-05 fields are empty strings; UI gates on them.
- `src/config/navigation.ts` — nav model (mainNavItems + aboutSubNavItems).
- `src/layouts/PublicLayout.vue` — skip link (with `@click.prevent` → `document.getElementById("main").focus()`) + `<AppHeader>` + `<main id="main" tabindex="-1">` + `<AppFooter>`.
- `src/components/navigation/SocialLinks.vue` — renders nothing when links=[]; aria-label + rel="noopener noreferrer" on each link.
- `src/components/navigation/AppHeader.vue` — desktop nav + mobile drawer with Escape/focus-return.
- `src/components/navigation/AppFooter.vue` — nav + contact block (gated on D-04) + SocialLinks + legal line.
- `src/pages/[locale]/{contact,about,about-team,about-documents,support,events,publications,not-found}.vue` — stub pages with real localized h1.
- `e2e/shell.spec.ts` — 12 E2E tests covering all acceptance criteria.

Files modified:
- `src/i18n/{en,pl,uk}/index.ts` — added nav.*, footer.nav, and all stub page keys.
- `src/router/routes.ts` — PublicLayout parent route wrapping all locale children; global 404 keeps AppShell.
- `src/pages/[locale]/index.vue` + `projects.vue` — removed AppShell (PublicLayout provides it).

AppShell.vue replaced: pages no longer import it; only `src/pages/404.vue` (global catch-all) retains AppShell for the non-locale `/xx` path (T-009 regression guard).

### Verification results

**Unit tests:** 21 files / 257 passed (was 19/244; added SocialLinks.test.ts + MobileNav.test.ts = 13 new tests)

**Focused unit tests:**
```
pnpm test --run src/layouts src/components/navigation src/components/brand
→ 3 files / 49 passed
```

**Typecheck:** clean (pre-existing `[vue-router] No rootDir` warning only)

**Lint/format:** `pnpm lint:check` → all matched files use correct format

**E2E (shell grep):** 12 passed
**E2E (full suite):** 31 passed (was 19; added 12 shell tests; all existing tests green)

**axe:** 0 critical violations — light theme, dark theme, mobile viewport (390px)

### Deviations and notes for reviewer
- AppShell.vue is kept for the global 404 route only; it is NOT used by any locale page.
- The hamburger toggle shows placeholder text icons (☰/✕) — a proper icon library is deferred (DESIGN_SYSTEM.md §4 "icon names" pending).
- SocialLinks.vue uses 2-letter text badges (FB/IG/YT) instead of SVG icons for the same reason.
- `nav` aria-label on AppHeader uses `t('nav.about')` — should be changed to a dedicated "Main navigation" key in a follow-up (left as a known issue for the reviewer).
- `prefers-reduced-motion` is honoured via `var(--motion-duration)` from tokens.css (already 0ms when reduced-motion is requested).

### rev-2 review findings applied

**A — Hard-coded user-facing strings (Major):**
- Added `footer.privacyPolicy` (en/pl/uk) and `footer.socialNav` (en/pl/uk) to all three
  i18n catalogues.
- `AppFooter.vue:75` — `"Privacy policy"` → `t('footer.privacyPolicy')`.
- `SocialLinks.vue:13` — `aria-label="Social media"` → `:aria-label="t('footer.socialNav')"`;
  added `useI18n` to the component script.
- `SocialLinks.test.ts` — added `createTestI18n()` plugin to the mount helper (required once
  the component calls `useI18n`).

**B — Missing page background (design):**
- Added `background-color: var(--color-background);` to the `body` rule in
  `src/css/typography.css` with a comment tracing it to this finding.

**C — Mobile header overflow at 320 px (design, critical):**
Chosen option: **move controls into the mobile drawer** (option 2).

Rationale: the PL (`Przełącz tryb ciemny`) and UK (`Перемкнути темну тему`) action labels
share no natural short-form word that is a substring of the full label, making
WCAG 2.5.3 compliance impossible with a visible compact label. Moving the controls
to the drawer keeps all accessible names intact, preserves the theme E2E assertion
(`page.getByRole("button", { name: "Toggle dark theme" })`) which runs at desktop
viewport where the panel is visible inline, and eliminates the overflow at its root.

Implementation: `AppHeader.vue` grid changed from 4-column (logo|nav|controls|hamburger)
to 3-column (logo|panel|hamburger). The panel `div#app-panel` wraps both `<nav>` and
`<div.app-header__controls>`. On desktop (≥768 px) the panel is an inline flex row.
On mobile the panel is `position: fixed` and toggled via `.app-header__panel--open`.
`@keydown` (Escape handler) moved from `<nav>` to the panel to capture Escape from any
focused child (nav links and controls). Unit test updated to dispatch Escape on `#app-panel`.

Measured 320 px result:
- EN `body.scrollWidth` = 320 — no overflow ✓
- PL `body.scrollWidth` = 320 — no overflow ✓
- UK `body.scrollWidth` = 320 — no overflow ✓
- Header `.scrollWidth <= .clientWidth` in all locales ✓
- Theme toggle visible in drawer (EN/PL/UK) ✓

**Follow-up (des-2, noted in Log per reviewer instruction):**
- `src/pages/[locale]/index.vue` uses scoped `clamp(2rem, 6vw, 4rem)` for the h1 font
  size, overriding the T-007 scale tokens. Flagged as a stub issue owned by T-025.

### rev-2 verification results

**Unit tests:** 21 files / 257 passed (unchanged count; no regressions)

**Focused:**
```
pnpm test --run src/layouts src/components/navigation src/components/brand
→ 3 files / 49 passed
```

**Typecheck:** clean (pre-existing `[vue-router] No rootDir` warning only)

**Lint/format:** `pnpm lint:check` → all matched files use correct format

**E2E (full suite):** 34 passed (was 31; added 4 new 320 px regression tests in
`shell — 320 px regression` describe; removed inline 320 px test from the 390 px
describe; all existing tests green including theme/locale/smoke/typography)

---

### Review verdicts, a11y spot-check and close-out (2026-10-18)

Three review lanes on the uncommitted tree (fixed point `f0429ef`).

**@reviewer (rev-2) — two-axis:**
- First pass: Standards 2×[Major] + Spec 2×[Major] — two hard-coded user-facing
  strings (`"Privacy policy"`, `aria-label="Social media"`); concern 7 (i18n) FAIL.
  All applied above (`footer.privacyPolicy`, `footer.socialNav` in all three
  catalogues).
- Re-check: Standards **resolved**, Spec **resolved**, concerns 1–7 **all PASS**
  (a11y semantics; one nav model; config-driven content only; icon placeholders
  acceptable; split `AppShell` for the global 404 accepted; no route regression;
  no user-facing literal outside the catalogues).

**@designer (des-2) — design review: Pass with changes → Pass.**
- First pass required: (1) missing `body` background (main canvas was browser-white
  instead of GRAY93); (2) 320 px header overflow (EN/PL 75 px, UK clipped ~35 px).
  Both applied above.
- Re-check: **Pass** — body background is GRAY93 in light and NERO in dark; at
  320 px all three locales measure `header = 65 px`, `body.scrollWidth = 320`,
  no clipping; the drawer reads as deliberate; scarlet restraint confirmed
  (single 2 px underline on the active link).

**Orchestrator a11y spot-check (ticket gate) — PASS.** Independent Playwright run
against the built app:
- landmarks `header`/`main#main`/`footer` = 1/1/1; shell adds no extra `<h1>`;
- first tab stop = the skip link (`#main`), which moves focus into `main`;
- drawer trigger `aria-expanded=false` / `aria-controls=app-panel`;
- computed accessible name is the localized action ("Відкрити меню навігації") and
  **excludes** the decorative `☰` glyph (`getByRole(name:/☰/)` → 0; the glyph span
  is `aria-hidden="true"`); the open-state name ("Закрити меню навігації") resolves;
- theme toggle keeps its accessible name inside the drawer (uk);
- Escape closes the drawer and returns focus to the trigger;
- 320 px `body`/`html` `scrollWidth` = 320 (no horizontal overflow).

**Orchestrator axe scan (criterion 6) — 0 violations of any impact** across
en light/dark desktop, en mobile (390 px), uk 320 px and pl dark 320 px
(the committed E2E helper asserts `critical`; this independent scan covered all
impacts, so the criterion's "critical/serious" bar is met with margin).

**Notes (non-blocking, carried forward):**
- The header `<nav>` uses the dedicated `nav.mainNav` key in all three catalogues
  (the earlier "known issue" line above is **stale** — already fixed).
- `src/pages/[locale]/index.vue` keeps a scoped `clamp(2rem, 6vw, 4rem)` h1
  override bypassing the T-007 scale — stub-only; owned by **T-025**.
- Hamburger `☰`/`✕` and the SocialLinks FB/IG text badges are interim placeholders
  pending the icon-system ticket; `SocialLinks` renders nothing today (D-05 open),
  so the badges are not user-visible yet.
- `AppShell.vue` is retained solely for the locale-agnostic global 404.

**Close-out:** acceptance criteria all satisfied; ticket moved to `done`.
