import { describe, expect, it } from "vitest";

import {
  activeSocialLinks,
  hasActiveSocialLinks,
  organization,
  type SocialLink
} from "@/config/organization";

/**
 * T-043 / D-05 — the no-invent guard for social URLs.
 *
 * The only approved source of a social URL is the project owner. This test
 * pins the three verified channels (page titles fetched 2026-10-21) and
 * enforces the contract rules: absolute https URLs only, non-empty labels,
 * unique platforms. Adding a channel here without owner verification is the
 * violation this tripwire is meant to catch.
 */

const VERIFIED: Record<SocialLink["platform"], string> = {
  facebook: "https://www.facebook.com/BARYKADYKULTURY/",
  instagram: "https://www.instagram.com/barykadykultury/",
  telegram: "https://t.me/barykadykultury",
  // Supported but not configured — an empty url renders nothing (D-05).
  youtube: "",
  twitter: "",
  linkedin: ""
};

describe("organization.socialLinks (D-05)", () => {
  it("carries exactly the verified Facebook, Instagram and Telegram URLs", () => {
    const configured = organization.socialLinks
      .filter(link => link.url.trim().length > 0)
      .map(link => [link.platform, link.url] as const);

    expect(configured).toEqual([
      ["facebook", VERIFIED.facebook],
      ["instagram", VERIFIED.instagram],
      ["telegram", VERIFIED.telegram]
    ]);
  });

  it("uses absolute https URLs only", () => {
    for (const link of organization.socialLinks) {
      if (link.url.trim().length === 0) continue;
      expect(link.url.startsWith("https://"), link.url).toBe(true);
      expect(new URL(link.url).protocol).toBe("https:");
    }
  });

  it("gives every platform a non-empty label and no duplicates", () => {
    const seen = new Set<string>();
    for (const link of organization.socialLinks) {
      expect(link.label.trim().length).toBeGreaterThan(0);
      expect(seen.has(link.platform), `duplicate ${link.platform}`).toBe(false);
      seen.add(link.platform);
    }
  });
});

/**
 * T-044 readability: the "non-empty URL = configured" rule (D-05) lived as
 * duplicated inline filters in SocialLinks.vue and contact.vue. The shared
 * helpers below are now the single definition of that predicate — components
 * must call them instead of re-deriving the rule.
 */
const fb: SocialLink = {
  platform: "facebook",
  label: "Facebook",
  url: "https://www.facebook.com/BARYKADYKULTURY/"
};
const blank: SocialLink = {
  platform: "instagram",
  label: "Instagram",
  url: ""
};
const whitespace: SocialLink = {
  platform: "telegram",
  label: "Telegram",
  url: "   "
};

describe("activeSocialLinks / hasActiveSocialLinks (D-05 predicate)", () => {
  it("keeps only links whose URL is non-empty after trimming", () => {
    expect(activeSocialLinks([fb, blank, whitespace])).toEqual([fb]);
  });

  it("preserves the configured order of the surviving links", () => {
    const tg: SocialLink = { ...whitespace, url: "https://t.me/x" };
    expect(activeSocialLinks([tg, blank, fb])).toEqual([tg, fb]);
  });

  it("returns an empty array for an empty input without mutating it", () => {
    const input: SocialLink[] = [];
    expect(activeSocialLinks(input)).toEqual([]);
    expect(input).toHaveLength(0);
  });

  it("treats whitespace-only URLs as unconfigured (hasActiveSocialLinks)", () => {
    expect(hasActiveSocialLinks([blank, whitespace])).toBe(false);
    expect(hasActiveSocialLinks([])).toBe(false);
    expect(hasActiveSocialLinks([blank, fb])).toBe(true);
  });

  it("reports the shipped config as configured (live guard)", () => {
    expect(hasActiveSocialLinks(organization.socialLinks)).toBe(true);
    expect(activeSocialLinks(organization.socialLinks)).toHaveLength(3);
  });
});
