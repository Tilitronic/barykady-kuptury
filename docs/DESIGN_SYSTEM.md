# Design System and Accessibility Requirements

## 1. Brand alignment

The brandbook is supplied: `NGOinfoSources/brand_book_barykady_kultury_red_scarlet copy.pdf` (19 pages, 2026, Danylo Shulha). The values below are transcribed from it and cross-checked against the supplied logo SVGs; they are authoritative.

Verified palette:

| Token | Hex | RGB | Role |
|---|---|---|---|
| `scarlet` | `#C60001` | 198, 0, 1 | Accent, logo color, primary-action emphasis |
| `nero` | `#262424` | 38, 36, 36 | Primary text, dark surfaces |
| `GRAY93` | `#EDEDED` | 237, 237, 237 | Primary background |

`GRAY93` is 93 % white — **not** `#939393`. Never derive a value from the token name; quote the hex from this table or the brandbook.

### Contrast constraints (measured)

| Pair | Ratio | Verdict |
|---|---|---|
| nero on GRAY93 | 13.1:1 | AAA body text |
| white on scarlet | 6.17:1 | AA body text |
| scarlet on GRAY93 | 5.27:1 | AA body text; use sparingly |
| scarlet on nero | 2.48:1 | **Forbidden for text.** Dark theme needs a lightened accent variant for text/links that clears 4.5:1; pure brand scarlet stays for surfaces carrying white text. |

The brandbook supplies exactly three colors. Any additional token (borders, muted text, links, focus, success/warning/error) must be derived and documented with its own measured contrast — not guessed and not borrowed from an unrelated palette.

Represent colors with semantic design tokens rather than scattering raw values across components. Provide light and dark values for every token, including form controls, dialogs, dropdowns, borders and disabled states. Where a brand value fails contrast in a particular use, keep the brand identity and add an accessible variant for that role instead of using the low-contrast color unchanged.

### Logo and logotype rules (brandbook p. 8–9, 12)

- **Logo** (mark + type) for shorter, compact formats; **logotype** for longer formats. Leave equal space between the mark and the type and between lines of type.
- Use the red or black variant on a solid background; when two colors are used they must contrast; when all three brand colors appear, keep the brandbook order.
- Provide a light-surface and a dark-surface variant. Never place the black logo on nero, or the red logo on scarlet.
- Exact minimum sizes and numeric clear-space values are **not** specified in the brandbook. Derive one clear-space spacing token and record it here rather than inventing a measurement.

## 2. Typography

Inter is confirmed by the brandbook (p. 13–14) with Black, Bold, Medium, Regular and Light weights. Self-host it from a pinned package with Latin, Latin Extended and Cyrillic subsets for Polish, Ukrainian and English. Verify glyph coverage, loading, fallback and license; do not depend on a third-party font CDN.

Printed hierarchy anchors: **display 64 px** (Medium/Bold), **section heading 34 px** (Bold), **body 16 px** (Regular). Scale fluidly below the desktop anchor rather than shrinking the scale ad hoc.

- Use comfortable body line-height, readable line lengths and a visible heading hierarchy.
- Do not use font size, weight or color as the only indicator of state.
- Confirm real glyph coverage for Polish diacritics and Ukrainian Cyrillic before declaring the type system final.

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
