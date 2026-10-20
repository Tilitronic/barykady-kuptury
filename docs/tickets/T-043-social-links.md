# T-043 — Social media links in header, footer and contact

**Session:** 11 · **Lane:** public UI/config · **Owner:** @designer + @coder (config/tests)
**Reviewers:** @reviewer + @designer (a11y/visual sign-off)
**Depends on:** T-011 (AppHeader/Footer), T-021 (contact), D-05 (social URLs)
**Decision:** D-05 — URLs are supplied by the owner; never invented.

## Outcome

Facebook, Instagram and Telegram links are visible in:
- the **header** (compact icon-only group, desktop and mobile drawer),
- the **footer** (existing `SocialLinks` area),
- the **contact** page (labeled block with icon + platform name).

They render only when the corresponding URL is configured. With no URLs, the
areas render nothing (no placeholders), as today.

## Current state

- `src/components/navigation/SocialLinks.vue` already renders configured links
  from `organization.socialLinks`, icon-only with `aria-label`, `target=_blank`,
  `rel="noopener noreferrer"`; it renders nothing when the list/URLs are empty.
- `SocialLink.platform` currently supports `facebook | instagram | youtube |
  twitter | linkedin`; no `telegram`.
- Icons are temporary text abbreviations (`FB`, `IG`, …), pending a real icon
  set.
- Footer already renders `<SocialLinks :links="organization.socialLinks" />`.
- Header and Contact do not render social links.

## Scope

### Config
- Add `telegram` to `SocialLink.platform` and the platform→icon map.
- Add Facebook, Instagram and Telegram entries to `organization.socialLinks`
  with **empty URLs** until D-05 supplies them. Keep other platforms supported
  but empty; do not invent handles/URLs.
- Start with `https://` only in config; validate in tests that configured URLs
  are absolute `https://` URLs (allow `http://` only for local test fixtures).

### Component
- Replace the temporary text icons with **inline SVG** icons for Facebook,
  Instagram, Telegram (and keep the existing platforms supported). Icons are
  decorative (`aria-hidden`); the link’s `aria-label`/visible label is the
  accessible name. No icon-library dependency.
- Add a `variant` or `showLabels` prop:
  - `icon` (default): used in header/footer; 2.25 rem square target,
    `aria-label` = platform name; focus ring; hover/focus states.
  - `labeled`: used on Contact; icon + visible platform name; still a link.
- Keep the list landmark label localized (`footer.socialNav` or a new
  `social.label`), and ensure the same component can be labelled per context.

### Placement
- **Header:** add the social group to the controls cluster after the search
  trigger and before theme/language; it must fit at 1280–1439 px and in the
  mobile drawer at 320 px. If space is tight, show icons only and keep all
  three; do not hide a configured channel silently.
- **Footer:** keep the existing placement; ensure Telegram and labels render.
- **Contact:** add a “Follow us”/localized social block near the contact
  channels; use the labeled variant; render only configured links.

### Accessibility
- 24×24 CSS px minimum target (2.25 rem = 36 px); visible focus; contrast
  ≥ 3:1 for UI, ≥ 4.5:1 for text labels.
- External links: `target="_blank"` + `rel="noopener noreferrer"`; indicate
  “opens in a new tab” via the existing sr-only pattern or `aria-label`.
- List semantics (`ul`/`li`), localized landmark label, no color-only state.
- 320 px reflow; keyboard order follows visual order.
- No autoplay/embeds/tracking pixels.

### SEO
- Add the configured URLs to the Organization `sameAs` structured data when
  T-034 lands. No social widgets.

## Out of scope

- OAuth/social login, feeds, share buttons, embeds, analytics pixels.
- Inventing URLs/handles; D-05 remains the source of truth.
- Changing the D-05 data ownership process.

## TDD plan

1. RED: component tests for `telegram`, icon/labeled variants, empty URLs,
   external-link hardening, localized labels; header/footer/contact rendering.
2. GREEN: config + component + header/contact integration, i18n.
3. RED/GREEN E2E: configured fixture shows FB/IG/TG in header/footer/contact;
   empty config hides all; 320 px; keyboard/a11y.
4. REFACTOR: icon map, copy.

## Acceptance criteria

- [ ] Facebook, Instagram and Telegram appear in header, footer and contact
      when URLs are configured; each has an accessible name and opens safely.
- [ ] With empty URLs, no social placeholder/space renders anywhere.
- [ ] Telegram is a supported platform; text abbreviations replaced by inline
      SVG icons.
- [ ] Header fits at 1280–1439 px and in the 320 px drawer; footer/contact
      reflow without overflow.
- [ ] Keyboard focus, target size, contrast and localized labels pass axe +
      manual checks.
- [ ] No URL is invented; D-05 values remain the only source.
- [ ] Unit/typecheck/lint/build/E2E and demo:check pass.

## Verification

```
pnpm test && pnpm typecheck && pnpm lint:check && pnpm build
pnpm test:e2e --workers=1
pnpm demo:reset && pnpm demo:check
```

## Log

- (author) start:
