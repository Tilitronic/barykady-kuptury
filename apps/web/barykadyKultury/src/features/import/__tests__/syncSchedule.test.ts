import { describe, expect, it } from "vitest";

import {
  checkIntervalMinutes,
  runScheduledSync,
  shouldCheck,
  type ScheduledSyncTarget
} from "../syncSchedule";

const NOW = new Date("2030-05-01T00:00:00.000Z");

function target(
  overrides: Partial<ScheduledSyncTarget> = {}
): ScheduledSyncTarget {
  return {
    kind: "document",
    entityId: "entity-1",
    fileId: "drive-1",
    locale: "en",
    lastCheckedAt: null,
    failures: 0,
    ...overrides
  };
}

describe("sync schedule", () => {
  it("backs off exponentially and caps at a day", () => {
    expect(checkIntervalMinutes(0)).toBe(15);
    expect(checkIntervalMinutes(1)).toBe(30);
    expect(checkIntervalMinutes(2)).toBe(60);
    expect(checkIntervalMinutes(6)).toBe(960);
    expect(checkIntervalMinutes(20)).toBe(960);
    expect(shouldCheck(null, 0, NOW)).toBe(true);
    expect(shouldCheck("2030-04-30T23:50:00.000Z", 0, NOW)).toBe(false);
    expect(shouldCheck("2030-04-30T23:20:00.000Z", 0, NOW)).toBe(true);
  });

  it("iterates sequentially with bounded parallelism, respecting throttle", async () => {
    const targets = [
      target({ entityId: "a" }),
      target({ entityId: "b", lastCheckedAt: "2030-04-30T23:59:00.000Z" }),
      target({ entityId: "c" }),
      target({ entityId: "d" }),
      target({ entityId: "e" })
    ];
    let active = 0;
    let maxActive = 0;

    const report = await runScheduledSync({
      listTargets: async () => targets,
      now: () => NOW,
      concurrency: 10,
      syncOne: async current => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise(resolve => setTimeout(resolve, 2));
        active -= 1;
        return current.entityId === "c" ? "failed" : "updated";
      }
    });

    expect(report).toMatchObject({
      checked: 4,
      updated: 3,
      failed: 1,
      skipped: 1
    });
    expect(maxActive).toBeLessThanOrEqual(3);
  });

  it("isolates a thrown failure and continues other documents", async () => {
    const report = await runScheduledSync({
      listTargets: async () => [
        target({ entityId: "a" }),
        target({ entityId: "b" }),
        target({ entityId: "c" })
      ],
      now: () => NOW,
      syncOne: async current => {
        if (current.entityId === "b") throw new Error("drive down");
        return "unchanged";
      }
    });

    expect(report).toMatchObject({
      checked: 3,
      updated: 0,
      failed: 1,
      skipped: 0
    });
  });
});
