import { describe, expect, it } from "vitest";

import { openGooglePicker, type GooglePickerApi } from "../googlePicker";

/**
 * T-042 lines 24-25 — the Google Picker is the primary selection gesture for
 * `drive.file`. The Picker must:
 * - receive the short-lived per-admin OAuth token,
 * - start in the shared NGO folder (never the admin's personal Drive root),
 * - return the selected Doc id to the admin page.
 */
function fakeApi(selection: { id: string; name: string } | null) {
  const state = {
    parent: null as string | null,
    oauthToken: null as string | null,
    mimeTypes: null as string | null
  };

  const docsView = {
    setParent(value: string) {
      state.parent = value;
      return this;
    },
    setIncludeFolders() {
      return this;
    },
    setSelectFolderEnabled() {
      return this;
    },
    setMimeTypes(value: string) {
      state.mimeTypes = value;
      return this;
    }
  };

  const api: GooglePickerApi = {
    ViewId: { DOCS: "docs" },
    Action: { PICKED: "picked", CANCEL: "cancel" },
    Feature: { NAV_HIDDEN: "nav-hidden" },
    DocsView: function DocsView() {
      return docsView;
    },
    PickerBuilder: function PickerBuilder() {
      let callback: (data: unknown) => void = () => undefined;
      const builder = {
        addView() {
          return builder;
        },
        setOAuthToken(value: string) {
          state.oauthToken = value;
          return builder;
        },
        setDeveloperKey() {
          return builder;
        },
        setAppId() {
          return builder;
        },
        setCallback(value: (data: unknown) => void) {
          callback = value;
          return builder;
        },
        build() {
          return {
            setVisible() {
              queueMicrotask(() =>
                callback(
                  selection === null
                    ? { action: "cancel" }
                    : { action: "picked", docs: [selection] }
                )
              );
            }
          };
        }
      };
      return builder;
    }
  } as unknown as GooglePickerApi;

  return { api, state };
}

describe("openGooglePicker", () => {
  it("opens in the shared folder with the admin token and returns the picked Doc", async () => {
    const { api, state } = fakeApi({ id: "picked-1", name: "Picked Doc" });

    await expect(
      openGooglePicker(
        {
          accessToken: "short-lived-token",
          folderId: "shared-folder-1"
        },
        { loadApi: async () => api }
      )
    ).resolves.toEqual({ id: "picked-1", name: "Picked Doc" });

    expect(state.parent).toBe("shared-folder-1");
    expect(state.oauthToken).toBe("short-lived-token");
    expect(state.mimeTypes).toBe("application/vnd.google-apps.document");
  });

  it("returns null when the admin cancels", async () => {
    const { api } = fakeApi(null);

    await expect(
      openGooglePicker(
        { accessToken: "token", folderId: "folder" },
        { loadApi: async () => api }
      )
    ).resolves.toBeNull();
  });

  it("rejects with a stable error when the Picker API cannot load", async () => {
    await expect(
      openGooglePicker(
        { accessToken: "token", folderId: "folder" },
        {
          loadApi: async () => {
            throw new Error("script blocked");
          }
        }
      )
    ).rejects.toMatchObject({ code: "picker-unavailable" });
  });
});
