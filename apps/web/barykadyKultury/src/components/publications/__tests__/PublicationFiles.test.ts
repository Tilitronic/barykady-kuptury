import { describe, expect, it } from "vitest";

import PublicationFiles from "@/components/publications/PublicationFiles.vue";
import type { PublicationFileView } from "@/features/publications/usePublications";
import { mountWithPlugins } from "@/test-utils/mount";

/**
 * Spec axis: docs/tickets/T-020-publications-public.md TDD plan step 1 —
 * one labelled download per language version with type and size; an external
 * link that opens safely; and NO action at all when there is nothing to
 * download or open.
 */

function fileView(
  overrides: Partial<PublicationFileView> = {}
): PublicationFileView {
  return {
    locale: "en",
    label: "Sample PDF (English, fictional)",
    storagePath: "fixtures/publications/a-en.pdf",
    mimeType: "application/pdf",
    sizeBytes: 12345,
    downloadUrl:
      "https://cdn.test/public-documents/fixtures/publications/a-en.pdf?download=a-en.pdf",
    ...overrides
  };
}

function mountFiles(
  props: {
    files?: PublicationFileView[];
    externalUrl?: string | null;
    locale?: "en" | "pl" | "uk";
  } = {}
) {
  return mountWithPlugins(PublicationFiles, {
    locale: props.locale ?? "en",
    props: {
      files: props.files ?? [],
      externalUrl: props.externalUrl ?? null
    },
    initialRoute: "/en/publications"
  });
}

describe("PublicationFiles", () => {
  it("renders one labelled download per language version", async () => {
    const wrapper = await mountFiles({
      files: [
        fileView(),
        fileView({
          locale: "pl",
          label: null,
          storagePath: "fixtures/publications/a-pl.pdf",
          sizeBytes: 23456,
          downloadUrl:
            "https://cdn.test/public-documents/fixtures/publications/a-pl.pdf?download=a-pl.pdf"
        })
      ]
    });

    const links = wrapper.findAll(".publication-files__link");
    expect(links).toHaveLength(2);

    expect(links[0]?.text()).toContain("English");
    expect(links[1]?.text()).toContain("Polski");
    expect(wrapper.text()).toContain("PDF");
    expect(wrapper.text()).toContain("12.1 KB");
    expect(wrapper.text()).toContain("22.9 KB");
    expect(links[0]?.attributes("href")).toContain("?download=a-en.pdf");
  });

  it("omits the size chip when the file size is unknown", async () => {
    const wrapper = await mountFiles({
      files: [fileView({ sizeBytes: null })]
    });

    expect(wrapper.find(".publication-files__size").exists()).toBe(false);
    // Still a working labelled download.
    expect(wrapper.get(".publication-files__link").text()).toContain("English");
  });

  it("shows the stored label as the descriptive line when present", async () => {
    const wrapper = await mountFiles({ files: [fileView()] });

    expect(wrapper.get(".publication-files__label").text()).toBe(
      "Sample PDF (English, fictional)"
    );
  });

  it("renders an external link with target=_blank and rel=noopener noreferrer", async () => {
    const wrapper = await mountFiles({
      externalUrl: "https://example.org/fictional-sample-publication"
    });

    const link = wrapper.get(".publication-files__external-link");
    expect(link.attributes("href")).toBe(
      "https://example.org/fictional-sample-publication"
    );
    expect(link.attributes("target")).toBe("_blank");
    expect(link.attributes("rel")).toBe("noopener noreferrer");
    // Accessible suffix naming the new-tab behaviour (DESIGN_SYSTEM.md §6).
    expect(link.text()).toContain("opens in a new tab");
  });

  it("renders no action when neither files nor an external URL exist", async () => {
    const wrapper = await mountFiles({ files: [], externalUrl: null });

    expect(wrapper.find("a").exists()).toBe(false);
    expect(wrapper.text()).toBe("");
  });

  it("renders files and the external link together when both exist", async () => {
    const wrapper = await mountFiles({
      files: [fileView()],
      externalUrl: "https://example.org/x"
    });

    expect(wrapper.findAll(".publication-files__link")).toHaveLength(1);
    expect(wrapper.find(".publication-files__external-link")).toBeTruthy();
  });
});
