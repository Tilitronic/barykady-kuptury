/**
 * D-41 — per-admin Google OAuth binding.
 *
 * Routes (same-origin, admin JWT required except the callback):
 *   POST ?action=picker     → short-lived access token + shared folder for the
 *                             browser Picker (refresh token stays in the vault)
 *   POST ?action=start      → { authUrl } for the consent redirect
 *   GET  ?code&state        → consumes the one-time state, stores the encrypted
 *                             refresh token and redirects back to the import UI
 *   POST ?action=disconnect → revokes the token at Google, deletes the vault row
 *   GET  ?action=status     → safe connection metadata (never a token)
 *
 * The acting admin is resolved from the verified JWT email (T-046's roster is
 * consumed by email; this function never creates memberships). Tokens are
 * AES-GCM encrypted before they reach `google_connections`, and the raw column
 * is service-role-only.
 */

import {
  buildGoogleAuthUrl,
  createOAuthState,
  exchangeAuthorizationCode,
  revokeToken,
} from "../../apps/web/barykadyKultury/src/features/import/googleOAuth";
import {
  consumeOAuthState,
  deleteGoogleConnection,
  getGoogleConnectionSummary,
  readGoogleConnection,
  resolveActingAdmin,
  saveGoogleConnection,
  saveOAuthState,
} from "../../apps/web/barykadyKultury/src/features/import/googleConnections";
import type { GoogleCredentialEnv } from "../../apps/web/barykadyKultury/src/features/import/googleCredentials";
import { readServerSupabaseConfig } from "../../apps/web/barykadyKultury/src/features/import/serverEnv";
import { resolveServerGooglePicker } from "../../apps/web/barykadyKultury/src/features/import/serverGoogleAuth";
import {
  verifyAdminToken,
  type ServerSupabaseConfig,
} from "../../apps/web/barykadyKultury/src/features/import/serverSupabase";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function bearer(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
}

function oauthConfig(): {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
} | null {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() ?? "";
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim() ?? "";
  if (clientId === "" || clientSecret === "" || redirectUri === "") return null;
  return { clientId, clientSecret, redirectUri };
}

async function authenticatedAdmin(request: Request, supabase: ServerSupabaseConfig) {
  const identity = await verifyAdminToken(supabase, bearer(request));
  if (identity === null) return null;
  return resolveActingAdmin(identity);
}

export default async function googleOAuth(request: Request): Promise<Response> {
  const supabase = readServerSupabaseConfig(process.env);
  if (supabase === null) return json({ error: "server_unavailable" }, 500);

  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  if (request.method === "GET" && action === null) {
    return completeCallback(url, supabase);
  }

  if (action === "status") {
    if (request.method !== "GET" && request.method !== "POST") {
      return json({ error: "method_not_allowed" }, 405);
    }
    const admin = await authenticatedAdmin(request, supabase);
    if (admin === null) return json({ error: "unauthorized" }, 401);
    const summary = await getGoogleConnectionSummary(supabase, admin.id);
    return json(
      summary ?? {
        connected: false,
        googleEmail: null,
        consentStatus: "connected",
        connectedAt: null,
      },
    );
  }

  if (action === "picker") {
    if (request.method !== "POST") {
      return json({ error: "method_not_allowed" }, 405);
    }
    const admin = await authenticatedAdmin(request, supabase);
    if (admin === null) return json({ error: "unauthorized" }, 401);

    const picker = await resolveServerGooglePicker(
      { supabase, googleEnv: process.env },
      { requestedBy: admin.id },
    );
    if (!picker.ok) {
      return json(
        { error: picker.error },
        picker.error === "picker-unavailable" ||
          picker.error === "folder-not-configured" ||
          picker.error === "reconnect-required"
          ? 409
          : 401,
      );
    }
    return json(picker.session);
  }

  if (action === "start") {
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
    const admin = await authenticatedAdmin(request, supabase);
    if (admin === null) return json({ error: "unauthorized" }, 401);

    const config = oauthConfig();
    if (config === null) return json({ error: "oauth_unavailable" }, 500);

    const state = createOAuthState();
    if (!(await saveOAuthState(supabase, state, admin.id))) {
      return json({ error: "state_unavailable" }, 500);
    }
    return json({
      authUrl: buildGoogleAuthUrl(config, {
        state,
        loginHint: admin.email,
      }),
    });
  }

  if (action === "disconnect") {
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
    const admin = await authenticatedAdmin(request, supabase);
    if (admin === null) return json({ error: "unauthorized" }, 401);

    const connection = await readGoogleConnection(
      supabase,
      admin.id,
      process.env.GOOGLE_TOKEN_ENCRYPTION_KEY,
    );
    if (connection !== null) {
      // Best effort: a revoked/already-expired token still gets deleted.
      await revokeToken(connection.refreshToken, fetch).catch(() => false);
    }
    await deleteGoogleConnection(supabase, admin.id);
    return json({ ok: true });
  }

  return json({ error: "invalid_request" }, 400);
}

async function completeCallback(url: URL, supabase: ServerSupabaseConfig): Promise<Response> {
  const error = url.searchParams.get("error");
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  const userId = await consumeOAuthState(supabase, state);
  if (userId === null) {
    return redirect("/en/admin/import?google=invalid-state");
  }
  if (error !== null || code.trim() === "") {
    return redirect("/en/admin/import?google=denied");
  }

  const config = oauthConfig();
  const encryptionKey = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (config === null || encryptionKey === undefined) {
    return redirect("/en/admin/import?google=unavailable");
  }

  const token = await exchangeAuthorizationCode(config, code, fetch).catch(() => null);
  if (token === null) {
    return redirect("/en/admin/import?google=exchange-failed");
  }

  const saved = await saveGoogleConnection(supabase, {
    userId,
    refreshToken: token.refreshToken,
    scope: token.scope ?? "https://www.googleapis.com/auth/drive.file",
    encryptionKey,
  });
  return redirect(
    saved ? "/en/admin/import?google=connected" : "/en/admin/import?google=unavailable",
  );
}

function redirect(location: string): Response {
  return new Response(null, {
    status: 302,
    headers: { location, "cache-control": "no-store" },
  });
}

/** Re-exported for the binding tests; no secret is included. */
export type { GoogleCredentialEnv };
