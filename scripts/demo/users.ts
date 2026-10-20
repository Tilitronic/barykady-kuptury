/**
 * Demo auth users through the local Auth admin API.
 *
 * Design authority: docs/tickets/DECISIONS.md D-17 — the admin claim is
 * `app_metadata.role = "admin"`, which is server-controlled and never derived
 * from user-editable metadata. The viewer account deliberately has no role
 * claim, so the T-026 guard and RLS denial paths can be exercised.
 *
 * These accounts are LOCAL ONLY. The password is deterministic so the demo
 * docs and the Lane C workflow can print it; it must never be used in a hosted
 * project (docs/architecture.md §6, docs/TESTING.md §6).
 */
import type { LocalSupabaseStatus } from "./supabaseStatus";

export const DEMO_PASSWORD = "demo-local-2026";

export interface DemoUserSpec {
  readonly email: string;
  readonly label: string;
  readonly appMetadata: Readonly<Record<string, string>>;
}

export const DEMO_USERS: readonly DemoUserSpec[] = [
  {
    email: "admin@demo.local",
    label: "admin",
    appMetadata: { role: "admin" }
  },
  {
    email: "viewer@demo.local",
    label: "viewer",
    appMetadata: {}
  }
];

export interface AuthUserSummary {
  readonly id: string;
  readonly email?: string;
}

export function findUserByEmail(
  users: readonly AuthUserSummary[],
  email: string
): AuthUserSummary | undefined {
  const wanted = email.toLowerCase();
  return users.find(user => (user.email ?? "").toLowerCase() === wanted);
}

function authHeaders(status: LocalSupabaseStatus): Record<string, string> {
  return {
    apikey: status.serviceRoleKey,
    Authorization: `Bearer ${status.serviceRoleKey}`,
    "Content-Type": "application/json"
  };
}

async function authFailure(response: Response, label: string): Promise<never> {
  const body = await response.text().catch(() => "");
  throw new Error(
    `${label} failed (${response.status}): ${body.slice(0, 300)}`
  );
}

async function listUsers(
  status: LocalSupabaseStatus
): Promise<AuthUserSummary[]> {
  const response = await fetch(
    `${status.apiUrl.replace(/\/+$/, "")}/auth/v1/admin/users?page=1&per_page=1000`,
    { headers: authHeaders(status) }
  );
  if (!response.ok) await authFailure(response, "list demo users");

  const authUsersResponse = (await response.json()) as {
    users?: AuthUserSummary[]
  };
  return authUsersResponse.users ?? [];
}

export interface EnsuredUser {
  readonly label: string;
  readonly email: string;
  readonly id: string;
  readonly action: "created" | "updated";
  readonly role: string | null;
}

/**
 * Creates or updates both demo accounts. `app_metadata` is always written
 * explicitly so a failed/manual earlier run cannot leave the viewer with an
 * admin claim (or the admin without one).
 */
export async function ensureDemoUsers(
  status: LocalSupabaseStatus
): Promise<EnsuredUser[]> {
  const existingUsers = await listUsers(status);
  const ensuredUsers: EnsuredUser[] = [];

  for (const spec of DEMO_USERS) {
    const found = findUserByEmail(existingUsers, spec.email);
    const body = JSON.stringify({
      email: spec.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      app_metadata: spec.appMetadata
    });

    if (found) {
      const response = await fetch(
        `${status.apiUrl.replace(/\/+$/, "")}/auth/v1/admin/users/${found.id}`,
        {
          method: "PUT",
          headers: authHeaders(status),
          body
        }
      );
      if (!response.ok)
        await authFailure(response, `update ${spec.label} user`);

      ensuredUsers.push({
        label: spec.label,
        email: spec.email,
        id: found.id,
        action: "updated",
        role: spec.appMetadata.role ?? null
      });
    } else {
      const response = await fetch(
        `${status.apiUrl.replace(/\/+$/, "")}/auth/v1/admin/users`,
        {
          method: "POST",
          headers: authHeaders(status),
          body
        }
      );
      if (!response.ok)
        await authFailure(response, `create ${spec.label} user`);

      const created = (await response.json()) as AuthUserSummary;
      ensuredUsers.push({
        label: spec.label,
        email: spec.email,
        id: created.id,
        action: "created",
        role: spec.appMetadata.role ?? null
      });
    }
  }

  return ensuredUsers;
}
