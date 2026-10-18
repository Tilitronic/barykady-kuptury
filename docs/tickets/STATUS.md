# Ticket Status Ledger

Updated by the orchestrator at every state change. `done` requires an independent reviewer and a commit.

| Ticket | Title | Session | Status | Reviewer | Commit | Date |
|---|---|---|---|---|---|---|
| T-001 | Repository & toolchain baseline | 1 | done | @reviewer (rev-1) | 0f34816 | 2026-10-17 |
| T-002 | Unit/component test harness | 1 | done | @reviewer (rev-1) | 3c3fb98 | 2026-10-17 |
| T-003 | E2E + accessibility harness | 1 | done | @reviewer (rev-1, rev-2) | 4159506 | 2026-10-17 |
| T-004 | Documentation alignment & verified brand values | 1 | done | @reviewer (rev-1, architecture checkpoints) | 670dfc8 | 2026-10-17 |
| T-005 | CI quality gates | 1 | done | @reviewer (rev-1) | c3d751e | 2026-10-17 |
| T-006 | Brand tokens & Quasar mapping | 2 | done | @reviewer (rev-1) + @architector (arc-1) | a7a8c5c | 2026-10-18 |
| T-007 | Typography: self-hosted Inter + scale | 2 | done | @reviewer (rev-2) + @designer (des-2) | 622d7a7 | 2026-10-18 |
| T-008 | BrandLogo component | 2 | done | @reviewer (rev-2) + @designer (des-2) | 08e5b45 | 2026-10-18 |
| T-009 | Locale routing, detection, persistence | 2 | done | @reviewer (rev-2) | fd5cb85 | 2026-10-18 |
| T-010 | Theme preference system | 2 | done | @reviewer (rev-1) | 9c36396 | 2026-10-18 |
| T-011 | Public shell: header, nav, footer, a11y | 2 | done | @reviewer (rev-2) + @designer (des-2) + orchestrator a11y spot-check | f4edb78 | 2026-10-18 |
| T-012 | Content schema migrations | 3 | done | @reviewer (rev-1) + @architector (arc-1) | 5116568 | 2026-10-18 |
| T-013 | RLS policies & admin claim | 3 | done | @reviewer (rev-1) + @architector (arc-1) | 85c4d8e | 2026-10-18 |
| T-014 | Storage buckets & upload policy | 3 | done | @reviewer (rev-1) + @architector (arc-1) | 0208ee3 | 2026-10-18 |
| T-015 | Generated types & feature data access | 3 | done | @reviewer (rev-1) + @architector (arc-1) | e819aa2 | 2026-10-18 |
| T-016 | About: organization content | 4 | done | @reviewer (rev-1) + @designer (des-2) | 3f455c1 | 2026-10-18 |
| T-017 | About: documents (in-app regulation reader) | 4 | done | @reviewer (rev-1) + @designer (des-1) | 17a1063 | 2026-10-18 |
| T-018 | About: team | 4 | done | @reviewer (rev-1, rev-2) + @designer (des-1) | 166a104 | 2026-10-18 |
| T-019 | Projects: listing, detail, draft protection | 4 | done | @reviewer (rev-1, rev-2) + @designer (des-1) | 882bfad | 2026-10-18 |
| T-020 | Publications: listing, detail, files | 4 | todo | — | — | — |
| T-021 | Contact page | 4 | done | @reviewer (rev-1, rev-2) | 5def43d | 2026-10-18 |
| T-022 | Support page | 4 | todo | — | — | — |
| T-023 | Calendar adapter function | 5 | todo | — | — | — |
| T-024 | Events page | 5 | todo | — | — | — |
| T-025 | Homepage composition | 5 | todo | — | — | — |
| T-026 | Admin auth & layout | 6 | todo | — | — | — |
| T-027 | Admin projects CRUD | 6 | todo | — | — | — |
| T-028 | Admin site pages & team CRUD | 6 | todo | — | — | — |
| T-029 | Admin publications, documents, uploads | 6 | todo | — | — | — |
| T-030 | Admin featured ordering | 6 | todo | — | — | — |
| T-031 | Admin event mapping & translation coverage | 6 | todo | — | — | — |
| T-032 | Full E2E journey matrix | 7 | todo | — | — | — |
| T-033 | Accessibility audit & fixes | 7 | todo | — | — | — |
| T-034 | SEO, metadata, deploy configuration (favicon delivered early; manifest/OG remain) | 7 | todo | — | — | — |
| T-035 | Release readiness & handoff | 7 | todo | — | — | — |

## Session log

| Session | Started | Closed | Handoff file | User verified |
|---|---|---|---|---|
| 1 | 2026-10-17 | 2026-10-17 (T-001…T-005 all done; restart + lane probe verified) | `HANDOFF-S1-2026-10-17.md` | push pending (main ahead 4) |
| 2 | 2026-10-17 | 2026-10-18 (T-006 + T-009 done & reviewed; T-007/T-008/T-010/T-011 parked) | `HANDOFF-S2-2026-10-18.md` | push pending (main ahead 3) |
| 3 | 2026-10-18 | 2026-10-18 (T-007 + T-008 + T-010 + T-011 done & reviewed; Session 2 parked range cleared; + favicon, route-title fix, §10 designer-model change) | `HANDOFF-S3-2026-10-18.md` | push pending (main ahead 18) |
| 4 | 2026-10-18 | 2026-10-18 (data-layer block T-012 + T-013 + T-014 + T-015 done & reviewed against a local Supabase stack; + §10 qwen3.7-plus → qwen3.8-flash retarget) | `HANDOFF-S4-2026-10-18.md` | pending (restart OpenCode for the model change; push pending — main ahead 31) |
| 5 | 2026-10-18 | 2026-10-18 (T-016 done & reviewed; T-017 implemented + spec-reviewed, design gate blocked on designer-model funding; D-12 resolved; + §10 designer model fix) | `HANDOFF-S5-2026-10-18.md` | pending (restart OpenCode for the designer model; push pending) |
