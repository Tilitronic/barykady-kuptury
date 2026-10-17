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
- [ ] Six destinations present in all three locales with correct routes.
- [ ] Skip link is the first tab stop and moves focus to `#main`.
- [ ] Mobile drawer: keyboard operable, Escape closes, focus trap not required but focus must return to trigger, no horizontal overflow at 320 px.
- [ ] Social block renders nothing with the current empty config; adding a URL makes exactly one labelled link appear.
- [ ] Footer shows no address/email/legal identifier that is not in config.
- [ ] axe: 0 critical/serious on the shell in light and dark, desktop and mobile.
- [ ] No user-facing string outside i18n catalogues.

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
