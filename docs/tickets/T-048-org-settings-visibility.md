# T-048 — Organization settings, visibility flags & tabbed admin

**Session:** — · **Lane:** feature/admin · **Owner:** unassigned · **Status:** todo
**Reviewers:** @reviewer + @architector (settings boundary + scope vocabulary)
**Depends on:** T-046 · **Blocks:** T-035 (visibility affects release content)

## Origin

Owner direction (Session 16): the admin needs one tabbed surface — general,
contacts, team, documents, projects, events, publications — where org facts
(NIP, REGON, contact addresses, email, paper-mail address, social links) are
editable, every field carries a "visible" checkbox, and unchecking hides the
corresponding public UI block. Each tab has its own edit right. Events /
projects / publications submit through one shared component with
conditionally visible elements per mode.

## Outcome

A root admin edits all org facts in one tabbed form; scoped editors see only
their tabs; any field marked invisible disappears from the public site; the
three entity submits share one form shell.

## Scope

In:

- `organization_settings` store: one row per fact (key, per-locale value
  where textual, `visible` boolean, updated audit). Keys: NIP, REGON,
  seat/address, paper-mail address, contact emails/phones, social links
  (per-network URL + visible). Values validated by kind (email, URL, NIP
  checksum, plain text); secrets never (no credential keys in this store).
- Tabbed admin surface (`/admin/settings` + tab param): General, Contacts,
  Team, Documents, Projects, Events, Publications. Tabs render the existing
  entity editors (T-027…T-031) or the settings form as appropriate — no
  editor rewrites, only hosting + tab chrome.
- Per-tab rights: extend the §6.1 vocabulary (`settings:write` for General +
  Contacts; existing entity scopes for the rest); guard hides tabs; RLS on
  the settings table (`is_admin() OR has_capability('settings:write')`);
  grant runbook extended (T-046 appendix).
- Visibility plumbing: every public component rendering an org fact reads
  `visible` and renders nothing when false (contact blocks, footer NIP/REGON,
  social icons, address lines). E2E: uncheck → block gone publicly; recheck →
  returns. Hidden values must not leak via API payloads either (select only
  visible for anon).
- Shared submit shell for events/projects/publications: one component with
  per-mode conditional sections; migrate the three editors onto it without
  behavior change (their tests prove it). This is the first sanctioned
  cross-entity UI abstraction — keep it presentational; mutation paths stay
  per-entity (architector to confirm the boundary).
- i18n en/pl/uk for all new strings; keyboard-operable tabs (reuse
  AdminLocaleTabs pattern); audit log of who changed what (updated_by +
  timestamp on the settings row).

Out: new entity types, public settings API beyond visibility-filtered reads,
per-locale visibility (visible is global until proven needed), WYSIWYG.

## Design constraints

- `docs/architecture.md` §3/§4/§6/§6.1 (new §6.1 rows for `settings:write`;
  visibility rule recorded before code); AGENTS.md (RLS-first, TDD +
  Playwright + i18n, no invented org facts — seed with clearly fake local
  values only).
- Current hardcoded org facts (contact page, footer, about) become
  settings-driven; keep rendering identical when all flags are visible.

## Acceptance criteria

- [ ] Every listed fact editable + visible-toggle; toggle flips public
      rendering same-session (E2E).
- [ ] Hidden facts absent from public markup AND anon API payloads.
- [ ] Scoped editor sees only granted tabs; direct URL to denied tab denied
      (E2E); denied settings writes rejected at DB (pgTAP).
- [ ] Entity editors behave identically inside tabs (their suites green).
- [ ] Shared shell drives all three submits with mode-conditional sections;
      per-entity mutation paths untouched.
- [ ] Setting change records who/when.
- [ ] Validation rejects malformed email/URL/NIP with localized field errors.

## Log

- (author) start:
