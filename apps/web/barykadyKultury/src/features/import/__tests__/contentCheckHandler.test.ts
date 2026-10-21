import { describe, expect, it, vi } from "vitest";

import {
  createContentCheckHandler,
  isDriveNewer,
  type ContentCheckTarget,
  type ContentCheckDependencies
} from "../contentCheckHandler";

const TARGET: ContentCheckTarget = {
  entityId: "entity-1",
  kind: "document",
  fileId: "drive-1",
  locale: "en",
  sourceSyncedAt: "2030-05-01T00:00:00.000Z",
  sourceModifiedAt: "2030-05-01T00:00:00.000Z"
};

function request(path = "/api/content-check?kind=document&slug=statute") {
  return new Request(`https://example.test${path}`);
}

function handler(overrides: Partial<ContentCheckDependencies> = {}) {
  return createContentCheckHandler({
    claimCheck: async () => ({ outcome: "checked", target: TARGET }),
    getModifiedTime: async () => "2030-05-02T00:00:00.000Z",
    enqueueSync: async () => "job-1",
    recordSuccess: async () => undefined,
    recordFailure: async () => undefined,
    ...overrides
  });
}

describe("isDriveNewer", () => {
  it("compares modifiedTime with the latest stored marker", () => {
    expect(
      isDriveNewer("2030-05-02T00:00:00Z", "2030-05-01T00:00:00Z", null)
    ).toBe(true);
    expect(
      isDriveNewer("2030-05-01T00:00:00Z", "2030-05-02T00:00:00Z", null)
    ).toBe(false);
    expect(
      isDriveNewer("2030-05-02T00:00:00Z", null, "2030-05-03T00:00:00Z")
    ).toBe(false);
  });
});

describe("createContentCheckHandler", () => {
  it("reports an update and enqueues a single-flight job", async () => {
    const enqueueSync = vi.fn(async () => "job-1");
    const recordSuccess = vi.fn(async () => undefined);
    const response = await handler({ enqueueSync, recordSuccess })(request());

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      updateAvailable: true,
      jobId: "job-1"
    });
    expect(enqueueSync).toHaveBeenCalledWith(TARGET);
    expect(recordSuccess).toHaveBeenCalledWith(TARGET);
  });

  it("is a no-op when the stored copy is current", async () => {
    const enqueueSync = vi.fn(async () => "job-1");
    const response = await handler({
      getModifiedTime: async () => "2030-05-01T00:00:00.000Z",
      enqueueSync
    })(request());

    await expect(response.json()).resolves.toEqual({ updateAvailable: false });
    expect(enqueueSync).not.toHaveBeenCalled();
  });

  it("returns no update for a throttled check without calling Drive", async () => {
    const getModifiedTime = vi.fn(async () => "2030-05-02T00:00:00Z");
    const response = await handler({
      claimCheck: async () => ({ outcome: "throttled", target: TARGET }),
      getModifiedTime
    })(request());

    await expect(response.json()).resolves.toEqual({ updateAvailable: false });
    expect(getModifiedTime).not.toHaveBeenCalled();
  });

  it("fails soft and records a failure when Drive is unavailable", async () => {
    const recordFailure = vi.fn(async () => undefined);
    const response = await handler({
      getModifiedTime: async () => {
        throw new Error("drive down");
      },
      recordFailure
    })(request());

    await expect(response.json()).resolves.toEqual({ updateAvailable: false });
    expect(recordFailure).toHaveBeenCalledWith(TARGET);
  });

  it("rejects invalid/missing parameters without lookup", async () => {
    const claimCheck = vi.fn(async () => ({
      outcome: "checked" as const,
      target: TARGET
    }));

    expect(
      (
        await handler({ claimCheck })(
          request("/api/content-check?kind=team&slug=x")
        )
      ).status
    ).toBe(400);
    expect(
      (
        await handler({ claimCheck })(
          request("/api/content-check?kind=document&slug=../x")
        )
      ).status
    ).toBe(400);
    expect(claimCheck).not.toHaveBeenCalled();
  });

  it("rejects non-GET methods", async () => {
    const response = await handler()(
      new Request(
        "https://example.test/api/content-check?kind=document&slug=statute",
        {
          method: "POST"
        }
      )
    );
    expect(response.status).toBe(405);
  });
});
