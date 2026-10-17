# Decision Register

Statuses: `decided` (recorded, no action), `open` (blocks listed tickets), `deferred` (explicitly out of V1).
Owners: `user` (project owner must supply), `boss` (orchestrator decides within docs), `architector`.

| ID | Decision | Status | Owner | Blocks | Value / notes |
|---|---|---|---|---|---|
| D-01 | Repository layout: single Quasar app repo at project root vs full pnpm+Turborepo monorepo | decided | user | T-001, T-005 | Single app, git repository at the project root, app stays at `apps/web/barykadyKultury`. Turborepo deferred until a second consumer exists. Rationale: vote by owner; `AGENTS.md` rule 7; no file moves needed to adopt a monorepo later. |
| D-02 | Lint/format baseline: keep `oxlint`+`oxfmt` (scaffold default) or install ESLint+Prettier | decided | user | T-001, T-004 | Keep `oxlint`+`oxfmt`. Docs (`AGENTS.md` rule 10, `docs/architecture.md` §1) must be updated to record the divergence and the reason: already wired, green, single toolchain, faster. |
| D-03 | Router mode | decided | boss | — | `history` mode + Netlify SPA redirect (docs/architecture.md §9). Current scaffold uses `hash`. |
| D-04 | Public contact data: email, phone, address | open | user | T-011, T-021 | `NGOinfoSources/kontactData.txt` is empty. No contact block is rendered until supplied. |
| D-05 | Social-media URLs | open | user | T-011 | Only configured channels render. No placeholders. |
| D-06 | Support/donation destinations (link, bank transfer, volunteering contact) | open | user | T-022 | Support page renders "no support options configured" until supplied. No payment collection ever. |
| D-07 | Dedicated public Google Calendar ID + read-only credentials | open | user | T-023, T-024, T-025 | Server-side env only. Never a private calendar. |
| D-08 | Supabase project URL/publishable key + admin provisioning method | open | user | T-012, T-026 | Admin via trusted `app_metadata` claim. No public registration. |
| D-09 | Contact form provider | open | user | T-021 | Default V1: `mailto:` only, no form. Never ship a form that silently drops messages. |
| D-10 | Rendering mode for launch: SPA vs SSG/prerender | open | user | T-034 | Docs §8 defer; affects SEO/link previews. Recommendation: SPA for V1, keep routes/data rendering-mode agnostic. |
| D-11 | Organization timezone | decided (provisional) | boss | — | `Europe/Warsaw`, reconfirm with NGO before launch. |
| D-12 | Regulation document file format | open | user | T-017 | Sources are `.docx` (PL/EN/UKR V4). Serve `.docx` as-is, or convert to PDF? Recommendation: publish both PDF and original DOCX. |
| D-13 | Brand color values | decided | — | — | From brandbook: SCARLET `#C60001`, NERO `#262424`, GRAY93 `#EDEDED`. Font Inter. Verified also in logo SVG fills. |
| D-14 | Event description language | open | user | T-024 | Calendar descriptions are single-language. Show the calendar language as-is with a locale note? Or require separate calendars per locale? Recommendation: display as-is + "content in <lang>" note. |
| D-15 | Turborepo / shared packages | deferred | architector | — | Only when a second consumer exists (docs/architecture.md §2). |
| D-16 | Admin locale content workflow (translate in admin vs seed-only) | open | user | T-028 | MVP recommendation: admin edits one locale at a time and sees missing-translation flags. |

## Resolved inputs

- Brandbook: `NGOinfoSources/brand_book_barykady_kultury_red_scarlet copy.pdf` → colors, Inter, logo/typography rules extracted (D-13).
- Regulations: `NGOinfoSources/regulamen/*.docx` (PL/EN/UKR V4) → publishable documents + mission/goals source.
- Legal identifiers: NIP `7831961912`, REGON `545503070` (`NGOinfoSources/govIds.txt`). Seat: Poznań. No KRS (ordinary association).
