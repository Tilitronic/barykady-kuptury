# Design System and Accessibility Requirements

## 1. Brand alignment

Follow the NGO's official brandbook for logo use, clear space, visual tone, and other brand rules. The brandbook itself has not been included in this brief; exact color values and logo constraints are therefore still unverified. **Do not guess hex values from the token names.** Ask the project owner to add the brandbook file or confirm its relevant values before declaring the design system final.

Color roles supplied by the project owner:

- `GRAY93` — primary background color.
- `nero` — primary text color.
- `scarlet` — accent color and logo color.

Represent these with semantic design tokens rather than scattering raw values across components. Add separate tokens for borders, surfaces, muted text, links, focus rings, success/warning/error, and their dark-theme equivalents. Confirm the exact source values against the brandbook; ensure all combinations pass contrast requirements. If the brand values fail contrast in a particular use, preserve brand identity while adding accessible variants for text, borders, or surfaces instead of using low-contrast colors unchanged.

## 2. Typography

- The brandbook's named font may be replaced by a free/open-licensed sans-serif typeface.
- Provisional recommendation: **Inter**, self-hosted from a pinned package where practical, with appropriate Latin and Cyrillic subsets for Polish, Ukrainian, and English.
- Verify glyph coverage, font loading, fallback behavior, font license, and performance. Do not depend on a third-party font CDN if self-hosting is practical.
- Use a clear type scale, comfortable body line-height, readable line lengths, and visible heading hierarchy. Do not use font size, weight, or color as the only indicator of state.
- Treat Inter as provisional until checked against the brandbook and the selected visual direction.

## 3. Visual direction

The result should look deliberate, contemporary, credible, and welcoming—not like an unmodified admin template. Use the reference websites for content hierarchy ideas only. Do not copy their logos, text, photographs, or exact page composition.

Design priorities:

- Clear hierarchy between mission, primary actions, projects, events, and publications.
- Restrained use of scarlet as an accent rather than coloring every button or surface.
- Consistent spacing, border radii, container widths, iconography, and content card behavior.
- Strong and purposeful typography, legible line lengths, and sufficient whitespace.
- Real organizational imagery only when supplied and approved. Use tasteful neutral placeholders in development, never invented pictures presented as genuine staff/projects.
- Avoid gratuitous animation, parallax, decorative motion, giant marketing gradients, and visual effects that make the NGO content harder to scan.

## 4. Header and navigation

- Desktop: top navigation for Contact, About us, Support us, Projects, Events, Publications; language/theme controls and configured social links in a clear, consistent header area.
- Social controls display only configured destinations and have accessible names; icon-only links need an accessible label.
- About subsections (organization information, team, documents) must be discoverable with clear sub-navigation or a well-structured About landing page.
- Mobile: use a compact, keyboard- and screen-reader-operable navigation pattern with obvious open/close state. Avoid requiring hover. The navigation must not overflow or cover the page in an unusable way.
- Keep a visible route to Support us without making it visually dominate every other action.

## 5. Theme tokens and preference handling

Define semantic CSS variables (or an equivalent design-token mechanism), for example:

- `--color-background`
- `--color-surface`
- `--color-text`
- `--color-text-muted`
- `--color-accent`
- `--color-border`
- `--color-link`
- `--color-focus`
- `--color-success`, `--color-warning`, `--color-danger`

Provide light and dark values for all tokens, including form controls, dialogs, dropdowns, borders, charts if any, and disabled states. Avoid a partial dark mode in which only the page background changes.

Initial theme follows `prefers-color-scheme`. A user's explicit toggle overrides system preference and persists. If no override is saved, continue to respond to changes in the operating system preference. Use accessible visible labels or a clear pressed state for the theme control.

## 6. Accessibility target

Target **WCAG 2.2 Level AA** for public and administrative interfaces. Automated scans help but do not by themselves prove conformance.

Required patterns:

- Semantic landmarks and heading hierarchy; one clear main landmark and a skip-to-content link.
- Complete keyboard operation for navigation, dropdowns, forms, dialogs, tabs, tables, and admin actions.
- Visible, high-contrast keyboard focus; no keyboard traps.
- Correct accessible names, roles, states, and relationships. Icon-only buttons/links must have meaningful names.
- Form controls have persistent labels, instructions where needed, and errors associated programmatically with the relevant field. Announce submission status appropriately.
- Color contrast meets WCAG AA (generally 4.5:1 for normal text and 3:1 for large text and meaningful UI graphics/boundaries).
- Never use color alone to communicate status or errors.
- Images have meaningful alternative text when informative and empty alternative text when decorative.
- Tables and document links have understandable headings/labels and predictable reading order.
- Motion respects `prefers-reduced-motion`; avoid flashing and unnecessary animation.
- Layout works at narrow mobile widths, 200% browser zoom, text enlargement, and longer translated strings.
- Language changes update document language metadata. Content excerpts that fall back to a different language should be identified appropriately when practical.
- Embedded third-party content must have a title and usable fallback. The events list must remain usable without an iframe.

Add automated accessibility checks to component/E2E testing and perform keyboard/manual checks for the major journeys before release.
