# T-049 — Quasar-first UI consolidation (SCSS-only styling) — PLAN v4 (decided)

**Status:** EXECUTING. Phase 0 landed (`286cf0d`); decisions D-43…D-53 recorded
in `DECISIONS.md`. Phases 1–5 pending, shell last.
**Owner directive (2026-10-26):** use as many ready-to-use Quasar components as
possible; no Quasar class-to-style syntax (SCSS only); reused primitives become
full-word `Bk*` wrappers; the analyzer decides the open questions.
**Evidence base:** `knowledge/ana003-quasar-migration-audit/` (81/81 components,
D1–D11, corrections C1–C10) and `docs/tickets/T-049-component-inventory.md`
(regenerate with `node scripts/ui-inventory.mjs`; now 81 components, 36 native
controls, 0 utility tokens).
**Stack:** Quasar `^2.35.1` (a11y features from 2.25+ available), `cssAddon`
off, `material-icons`/`roboto-font` removed (T-044/F4b), local `iconMapFn` icon
set (T-032).

---

## 1. Corrections to earlier plan versions (kept visible)

| # | Earlier claim | Reality |
|---|---|---|
| 1 | v1: "zero naked controls" | False — the grep pattern missed multi-line `<button` openings. The inventory script now parses SFCs mechanically (comments blanked, class-attribute-only scanning, absolute line numbers). |
| 2 | v2: only the LongFormReader language chips are native | 36 native control instances in 20 files; every one has a verdict (§2). |
| 3 | v2/v3: utility-class debt is 61/89 tokens in 1/7 files | Both were measurement artefacts (`scope="col"`, `colspan`, comments). True count after the Phase 0 rewrite: **0**. |
| 4 | "`UiConfirmDialog` wraps QDialog" | It is 195 lines of bespoke modal. D-51 adopts QDialog with a portal-aware test rewrite. |
| 5 | "Icons must be decided before Phase 2" | Already shipped: `boot/icons.ts` + `config/quasarIconMap.ts` (31 names, unit + E2E guard). Only `menu` is missing (D-47). |
| 6 | "Eliminate the PageToc/ReaderToc split" | They are already one implementation + controlled wrapper (D-53). No-op retired. |
| 7 | `:breakpoint="1024"` for the drawer | The app's drawer band is 1280 px (`AppHeader.vue:458`); use 1279 (D-50). |

---

## 2. Native-control disposition — 36 instances, 20 files

Regenerate from the inventory before citing. Verdicts are grouped; each file's
line numbers live in `T-049-component-inventory.md`.

**Adopt Quasar (13 components):**

| Site(s) | Replacement | Decision / note |
|---|---|---|
| `AdminTabs.vue`, `AdminLocaleTabs.vue`, `AdminProjectEditPage.vue` tablists | `BkTabs`/`BkTab` (+ `BkTabPanels`) | Deletes 3 hand-rolled tablists and their roving-tabindex code; panel ids must be re-expressed |
| `ThemeToggle.vue` | `BkToggle` | `role="switch"` + `aria-checked` built in; label-in-name must survive |
| Reader language chips (`LongFormReader:55`) | `BkOptionGroup` radio | D-49/D-34; `#label` slot keeps per-option `lang` |
| 4 × file inputs | `BkFile` | Never QUploader (no server endpoint; uploads go through Supabase modules) |
| `BkConfirmDialog` internals | `BkDialog` (QDialog) | D-51 |
| `SiteSearch` modal shell | `BkDialog` | D-46; keep combobox/listbox internals |
| Reader steppers (`ReaderControls`) | `BkBtnGroup` + `BkButton` | QBtnGroup emits no group role — we supply `role="group"` + label |
| `AppHeader` hamburger, `MobileBottomNav` "More" | `BkButton` | Opens `BkDrawer` / panel |
| Sign-in form | `BkForm` + `BkInput` + `BkButton type="submit"` | Auth boundary: live-region + field-error tests must stay green |
| Plain action buttons: `ContentUpdateBanner`, `AdminLayout` sign-out, `AdminDeniedPage`, `events.vue` retry, `LongFormReader` retry | `BkButton` | Retry focus moves to the status region after activation |
| Shell (`PublicLayout`, `AdminLayout`, `AppShell`, `AppHeader` panel, `AppFooter`) | `BkLayout`/`BkHeader`/`BkPageContainer`/`BkPage`/`BkFooter`/`BkDrawer` | Phase 5, D-50 |

**Keep native (with reasons):** `LanguageSwitcher` (D-52 — encodes user-reported
hover/focus/pin fixes; QMenu cannot express them), `SiteSearch` internals (D-46),
`PageToc`/`ReaderToc` `<details>` (D-48) and their list tree, every admin
`<table>` and ordered list (D-45), `MobileBottomNav` icon shapes, `SocialLinks`,
`BrandLogo`, `EventCard`/`ProjectCard`/`PublicationCard`/`PersonCard`/cards and
detail bodies, `DocumentsSection`, `ActionLink`, `ContactChannels`,
`SectionShell`, `LocalizedRichText`/`SitePageBody`/`AstBody` (content rendering
stays semantic HTML), `TranslationStatus`, `AdminSubmitShell`, `AdminDashboard`,
`404`/`not-found`, and the public pages.

---

## 3. Wrapper catalogue — 36 when finished

**Existing 16 (renamed, Phase 0):** `BkBanner` `BkButton` `BkCard`
`BkCardSection` `BkCheckbox` `BkConfirmDialog` `BkExpansionItem` `BkForm`
`BkInput` `BkItem` `BkItemSection` `BkList` `BkSelect` `BkSkeleton` `BkSlider`
`BkTooltip`.

**New (18):** `BkToggle` `BkTabs` `BkTab` `BkTabPanels` `BkTabPanel`
`BkOptionGroup` `BkBtnGroup` `BkFile` `BkDialog` `BkLayout` `BkHeader`
`BkPageContainer` `BkPage` `BkFooter` `BkDrawer` `BkInnerLoading`
`BkLinearProgress` `BkSpinner`.

**Deferred (2):** `BkImg`, `BkScrollArea`.

Every new wrapper test asserts its DOM/a11y contract (see ana003 §3): switch
role and label-in-name, tablist/roving tabindex/panel ids, radiogroup + arrow
keys, file input association, dialog focus cycle, landmark elements, drawer
`<aside>` + explicit label, busy surfaces with a localized name.

---

## 4. Phases (decided order — shell last)

| Phase | Work | Gate |
|---|---|---|
| **0a — Gate repair** | ✅ `ALLOWED_DIRS` → `components/bk`; ✅ styling-policy test; ✅ utility-class cleanup; ✅ inventory script fixed (comments blanked, class-attribute-only scan, absolute lines) | unit |
| **1 — Icon map** | Add `menu` to `ICON_PATHS`; rule: every call-site `icon=` exists; visual check of internal glyphs | unit + `icon-map` E2E |
| **2 — Controls** | `BkTabs`×3, `BkToggle`, `BkOptionGroup` (reader chips), `BkBtnGroup` steppers, `BkButton` plain actions | unit + reader/theme/admin E2E + axe |
| **3 — Files & forms** | `BkFile`×4, `BkForm`+`BkInput` sign-in, `BkInnerLoading`/`BkLinearProgress` where a status region exists | unit + admin/auth E2E + `ci-local.sh` |
| **4 — Dialogs** | `BkDialog` inside `BkConfirmDialog`; SiteSearch shell → `BkDialog` (keep internals) | unit (portal-aware) + search E2E + `ci-local.sh` |
| **5 — Shell** | QLayout family for Public/Admin/AppShell; `BkDrawer` for `#app-panel`; keep `nav > ul`, keep focus trap, `:breakpoint="1279"`, `BkPage` dvh `styleFn`, skip link stays first | **full `scripts/ci-local.sh`** |
| **6 — Polish** | Owner-gated visual pass on demo `:9200` (Docker + demo + human eyes) | human sign-off |

**Per-phase rules:** focused test first (red for the right reason) →
implement → focused test → lint/typecheck → affected E2E → build. Never delete
or weaken an a11y assertion without an equivalent replacement. No utility
classes in authored markup (enforced). Full `ci-local.sh` only at Phases 3, 4, 5.

---

## 5. Risks (from ana003 §4)

1. Phase 5 can break landmark/skip-link/focus assertions in five E2E specs at
   once — hence last, with the full gate.
2. QDrawer does not trap focus (documented) — keep the tested composable and
   assert it; breakpoint 1279.
3. QTable would un-name five admin tables — refused (D-45). Overruling requires
   a recorded caption/`scope` substitution.
4. QBtnToggle contradicts D-34 — refused (D-49).
5. Measurement tooling was unreliable — the script is fixed and must be
   re-run before citing numbers; a rename and its guard must land in the same
   commit (the `ui/→bk/` transient proved the gate is non-vacuous).

---

## 6. Open owner actions (unchanged, independent of T-049)

Push the ~103-commit backlog, provision production (Supabase/Netlify/Google),
supply real content, and run the Phase 6 visual pass. These remain the critical
path to launch; none block Phases 1–5.
