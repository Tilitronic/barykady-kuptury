# Testing and TDD Policy

## 1. Mandatory TDD loop

All implementation work follows test-driven development:

1. **Red:** write or update the smallest test that describes the intended behavior; run it and confirm it fails for the expected reason.
2. **Green:** implement the smallest change that makes that test pass.
3. **Refactor:** improve structure while keeping the test green.
4. Run relevant surrounding tests, type checks, lint, and build. Add regression coverage for discovered bugs.

Do not write a large feature first and add tests at the end. Tests may be updated alongside a behavior change, but the agent must be able to show that the new test failed before the implementation made it pass. If a test cannot run before implementation because its infrastructure is missing, first add the smallest test harness needed.

## 2. Test layers

### Unit tests

Use unit tests for deterministic business logic such as:

- Locale selection and fallback decisions.
- Theme preference precedence.
- Project sorting/featured-project fallback.
- Calendar event normalization, all-day event handling, timezone handling, cancelled/missing event fields, and project-link joins.
- Publication metadata validation and permitted file rules.
- Safe content rendering/validation logic.

### Component tests

Use component tests for behavior that benefits from isolated Vue component testing:

- Navigation menus and language/theme controls.
- Accessible loading, empty, error, success and validation states.
- Project/publication cards and event rows, including optional/missing fields.
- Admin forms and their validation/disabled states.

Use the component-testing setup generated/approved for the chosen Quasar/Vite test stack. Do not introduce multiple overlapping test frameworks without a reason.

### Playwright E2E tests

Playwright is mandatory for end-to-end tests. At minimum, cover these critical flows:

1. Anonymous visitor can navigate public pages and open a project/publication detail route directly.
2. Locale detection at `/`, explicit locale URLs, language switching, and persisted user choice work consistently.
3. Theme follows system preference on first visit and a saved user override persists.
4. Public homepage shows the expected upcoming calendar events in chronological order.
5. An event with a project links to that project's published detail page; an event without a project still renders correctly.
6. Featured projects display in configured order; when no projects are featured, recent published projects are shown.
7. Contact details and any enabled contact form work, including validation, success, and error feedback.
8. Admin routes require authentication; anonymous attempts to perform admin operations are rejected.
9. An administrator can create/edit/publish a project and publication; published content becomes public and drafts remain invisible to anonymous visitors.
10. An administrator can associate and unassociate a Google Calendar event with a project.
11. Upload/download behavior obeys the intended access policy.
12. Main navigation and admin workflows are operable on a mobile viewport and with keyboard-only interaction.

E2E tests must be stable in CI. Mock/intercept Calendar API/function responses with fixtures; do not depend on a real Google Calendar, production Supabase project, personal account, network timing, or live NGO content.

## 3. Database and security tests

Use local/isolated Supabase test infrastructure and SQL/RLS tests to verify actual authorization behavior. A hidden button or route guard is not proof of security.

For each protected table and Storage bucket, test at least:

- Anonymous read of published public records is allowed where intended.
- Anonymous access to drafts is denied.
- Anonymous inserts/updates/deletes are denied.
- An ordinary authenticated identity without admin claims cannot mutate content.
- An administrator can perform permitted CRUD actions.
- Public users cannot list or retrieve protected files.
- Event-project mappings cannot reveal an unpublished project through the public UI/API.

Never run destructive policy tests against production data or use the service-role key to simulate an ordinary user.

## 4. Accessibility tests

- Integrate automated accessibility assertions (for example, axe) into key Playwright journeys.
- Test at least the home page, representative content detail page, mobile navigation, contact form, and admin content form.
- Automated results are not sufficient by themselves. Manually verify keyboard focus/order, keyboard operability, visible focus, language/theme controls, and error announcements.
- Fix serious/critical accessibility regressions before merging; document any known limitation rather than claiming full compliance without evidence.

## 5. CI quality gates

The CI pipeline should run these as appropriate to the repository:

1. Install dependencies from the committed lockfile using frozen-lockfile mode.
2. Formatting check.
3. ESLint.
4. TypeScript/Vue type check.
5. Unit/component tests.
6. Local database migration/RLS tests, where configured.
7. Playwright E2E tests using deterministic fixtures and test services.
8. Production build.

The project is not done if a required gate fails or has been silently skipped. For checks not available in a developer environment, state the blocker and ensure CI is configured to run them.

## 6. Useful test fixtures

Maintain deterministic non-production fixtures for:

- At least one published and one draft project.
- A project with a complete translation and one with an incomplete translation.
- A publication with a public PDF/URL and a missing optional field.
- A timed event, an all-day event, an event with no project, an event linked to a published project, a cancelled event, and an event containing optional fields that are absent.
- Anonymous, non-admin authenticated, and administrator identities in the isolated test environment.

Fixtures must contain clearly fictional/sample content and no personal data or production credentials.
