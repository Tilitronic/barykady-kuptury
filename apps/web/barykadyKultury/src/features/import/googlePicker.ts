/**
 * T-042 lines 24-25 — Google Picker (drive.file) integration.
 *
 * The Picker is the primary import gesture: the admin sees only documents in the
 * shared NGO folder, and the pick itself is the per-file `drive.file` grant.
 * Manual URL/ID entry remains the fallback when the Picker cannot load or the
 * deployment uses a server-owned credential mode.
 *
 * Only a short-lived OAuth access token is passed to the browser. The vault
 * refresh token, client secret and encryption key stay server-side.
 */

export const GOOGLE_PICKER_SCRIPT_URL = "https://apis.google.com/js/api.js";
export const GOOGLE_PICKER_ORIGIN = "https://docs.google.com";
export const GOOGLE_DOCS_MIME = "application/vnd.google-apps.document";

export interface GooglePickerDocument {
  readonly id: string;
  readonly name: string;
}

export interface GooglePickerDocsView {
  setParent(folderId: string): this;
  setIncludeFolders(value: boolean): this;
  setSelectFolderEnabled(value: boolean): this;
  setMimeTypes(value: string): this;
}

export interface GooglePickerCallbackData {
  readonly action?: string;
  readonly docs?: readonly { readonly id?: unknown; readonly name?: unknown }[];
}

export interface GooglePickerBuilder {
  addView(view: GooglePickerDocsView): this;
  setOAuthToken(token: string): this;
  setDeveloperKey(key: string): this;
  setAppId(appId: string): this;
  setCallback(callback: (data: GooglePickerCallbackData) => void): this;
  setOrigin?(origin: string): this;
  build(): { setVisible(visible: boolean): void };
}

export interface GooglePickerApi {
  readonly ViewId: { readonly DOCS: string };
  readonly Action: { readonly PICKED: string; readonly CANCEL: string };
  readonly Feature: { readonly NAV_HIDDEN: string };
  readonly DocsView: new (viewId: string) => GooglePickerDocsView;
  readonly PickerBuilder: new () => GooglePickerBuilder;
}

export class GooglePickerUnavailableError extends Error {
  readonly code = "picker-unavailable";

  constructor() {
    super("The Google Picker API could not be loaded");
    this.name = "GooglePickerUnavailableError";
  }
}

export interface GooglePickerConfig {
  readonly accessToken: string;
  readonly folderId: string;
  readonly appId?: string | null;
  readonly developerKey?: string | null;
}

export interface GooglePickerDependencies {
  readonly loadApi?: () => Promise<GooglePickerApi>;
}

interface GooglePickerGlobals {
  readonly gapi?: { load?: (name: string, callback: () => void) => void };
  readonly google?: { picker?: GooglePickerApi };
}

let cachedApi: Promise<GooglePickerApi> | null = null;

/** Loads Google's JS API once, then the `picker` module. */
export function loadGooglePickerApi(): Promise<GooglePickerApi> {
  if (cachedApi !== null) return cachedApi;

  cachedApi = new Promise<GooglePickerApi>((resolve, reject) => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      reject(new GooglePickerUnavailableError());
      return;
    }

    const globals = window as unknown as GooglePickerGlobals;
    if (globals.google?.picker) {
      resolve(globals.google.picker);
      return;
    }

    const loadModule = (): void => {
      const gapi = (window as unknown as GooglePickerGlobals).gapi;
      if (gapi?.load === undefined) {
        reject(new GooglePickerUnavailableError());
        return;
      }
      gapi.load("picker", () => {
        const picker = (window as unknown as GooglePickerGlobals).google
          ?.picker;
        if (picker === undefined) {
          reject(new GooglePickerUnavailableError());
          return;
        }
        resolve(picker);
      });
    };

    if ((window as unknown as GooglePickerGlobals).gapi?.load !== undefined) {
      loadModule();
      return;
    }

    const script = document.createElement("script");
    script.src = GOOGLE_PICKER_SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      try {
        loadModule();
      } catch {
        reject(new GooglePickerUnavailableError());
      }
    };
    script.onerror = () => reject(new GooglePickerUnavailableError());
    document.head.appendChild(script);
  }).catch(error => {
    cachedApi = null;
    throw error;
  });

  return cachedApi;
}

/**
 * Opens the Picker constrained to the shared folder and resolves the selected
 * Google Doc. A cancel resolves `null`; an API-load failure rejects with the
 * stable `picker-unavailable` code so the page can reveal the manual fallback.
 */
export async function openGooglePicker(
  config: GooglePickerConfig,
  dependencies: GooglePickerDependencies = {}
): Promise<GooglePickerDocument | null> {
  let api: GooglePickerApi;
  try {
    api = await (dependencies.loadApi ?? loadGooglePickerApi)();
  } catch {
    throw new GooglePickerUnavailableError();
  }

  const view = new api.DocsView(api.ViewId.DOCS);
  view
    .setParent(config.folderId)
    .setIncludeFolders(false)
    .setSelectFolderEnabled(false)
    .setMimeTypes(GOOGLE_DOCS_MIME);

  return new Promise<GooglePickerDocument | null>(resolve => {
    const builder = new api.PickerBuilder();
    builder.addView(view);
    builder.setOAuthToken(config.accessToken);
    if (config.developerKey !== undefined && config.developerKey !== null) {
      builder.setDeveloperKey(config.developerKey);
    }
    if (config.appId !== undefined && config.appId !== null) {
      builder.setAppId(config.appId);
    }
    if (typeof window !== "undefined") {
      builder.setOrigin?.(window.location.origin);
    }
    builder.setCallback(data => {
      if (data.action !== api.Action.PICKED) {
        resolve(null);
        return;
      }
      const selected = data.docs?.[0];
      if (
        selected === undefined ||
        typeof selected.id !== "string" ||
        selected.id === ""
      ) {
        resolve(null);
        return;
      }
      resolve({
        id: selected.id,
        name:
          typeof selected.name === "string" && selected.name !== ""
            ? selected.name
            : selected.id
      });
    });
    builder.build().setVisible(true);
  });
}
