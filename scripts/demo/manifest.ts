/**
 * The single source of truth for generated demo assets.
 *
 * Every path here is duplicated in `supabase/seed.demo.sql` (a SQL file cannot
 * import TypeScript). Keep the two lists in lock-step: `setup-demo.ts` uploads
 * exactly this manifest, then queries the database for every referenced path
 * and verifies each public URL — so a drift is a hard failure, not a broken
 * image discovered in the browser.
 */

export type DemoLocale = "en" | "pl" | "uk";
export type DemoBucket = "public-media" | "public-documents";
export type DemoAssetKind = "cover" | "avatar" | "publication" | "document";

export interface DemoAsset {
  readonly bucket: DemoBucket;
  readonly path: string;
  readonly kind: DemoAssetKind;
  readonly slug: string;
  readonly locale?: DemoLocale;
  readonly mimeType: "image/png" | "application/pdf";
  readonly title: string;
  readonly subtitle?: string;
  readonly lines?: readonly string[];
}

export function projectCoverPath(slug: string): string {
  return `demo/projects/${slug}-cover.png`;
}

export function teamAvatarPath(slug: string): string {
  return `demo/team/${slug}.png`;
}

export function publicationFilePath(slug: string, locale: DemoLocale): string {
  return `demo/publications/${slug}-${locale}.pdf`;
}

export function documentFilePath(slug: string, locale: DemoLocale): string {
  return `demo/documents/${slug}-${locale}.pdf`;
}

const COVER_SLUGS = [
  "demo-cultural-bridge",
  "demo-language-lab",
  "demo-memory-archive",
  "demo-youth-media",
  "demo-eco-workshop",
  "demo-fallback-story"
] as const;

const AVATAR_SLUGS = [
  "demo-member-one",
  "demo-member-two",
  "demo-member-three",
  "demo-member-four",
  "demo-member-five"
] as const;

const PUBLICATION_FILES: readonly {
  slug: string;
  locale: DemoLocale;
  title: string;
}[] = [
  {
    slug: "demo-cultural-bridges-report",
    locale: "en",
    title: "Cultural Bridges Report - English (Fictional Demo)"
  },
  {
    slug: "demo-cultural-bridges-report",
    locale: "pl",
    title: "Raport o mostach kulturowych - Polish (Fictional Demo)"
  },
  {
    slug: "demo-community-zine",
    locale: "pl",
    title: "Zine spoleczny - Polish (Fictional Demo)"
  },
  {
    slug: "demo-poetry-anthology",
    locale: "uk",
    title: "Poetry Anthology - Ukrainian (Fictional Demo)"
  },
  {
    slug: "demo-disinformation-notes",
    locale: "en",
    title: "Disinformation Field Notes - English (Fictional Demo)"
  },
  {
    slug: "demo-volunteer-handbook",
    locale: "pl",
    title: "Poradnik wolontariusza - Polish (Fictional Demo)"
  },
  {
    slug: "demo-ecology-report",
    locale: "uk",
    title: "Ecology Listening Report - Ukrainian (Fictional Demo)"
  }
];

const DOCUMENT_FILES: readonly {
  slug: string;
  locale: DemoLocale;
  title: string;
}[] = [
  {
    slug: "demo-statute",
    locale: "en",
    title: "Demo Statute - English (Fictional)"
  },
  {
    slug: "demo-statute",
    locale: "pl",
    title: "Statut demonstracyjny - Polish (Fictional)"
  },
  {
    slug: "demo-statute",
    locale: "uk",
    title: "Demontratsiinyi statut - Ukrainian (Fictional)"
  }
];

const PDF_LINES = [
  "This file is generated for the local demo environment only.",
  "It is fictional and must never be published or migrated.",
  "Imagery and documents are geometric/neutral demo fixtures."
] as const;

/**
 * The complete upload set, in deterministic order: covers, avatars,
 * publication PDFs, document PDFs.
 */
export function buildAssetManifest(): readonly DemoAsset[] {
  const covers: DemoAsset[] = COVER_SLUGS.map(slug => ({
    bucket: "public-media",
    path: projectCoverPath(slug),
    kind: "cover",
    slug,
    mimeType: "image/png",
    title: `${slug} demo cover`
  }));

  const avatars: DemoAsset[] = AVATAR_SLUGS.map(slug => ({
    bucket: "public-media",
    path: teamAvatarPath(slug),
    kind: "avatar",
    slug,
    mimeType: "image/png",
    title: `${slug} demo avatar`
  }));

  const publications: DemoAsset[] = PUBLICATION_FILES.map(file => ({
    bucket: "public-documents",
    path: publicationFilePath(file.slug, file.locale),
    kind: "publication",
    slug: file.slug,
    locale: file.locale,
    mimeType: "application/pdf",
    title: file.title,
    subtitle: "Fictional local demo fixture",
    lines: PDF_LINES
  }));

  const documents: DemoAsset[] = DOCUMENT_FILES.map(file => ({
    bucket: "public-documents",
    path: documentFilePath(file.slug, file.locale),
    kind: "document",
    slug: file.slug,
    locale: file.locale,
    mimeType: "application/pdf",
    title: file.title,
    subtitle: "Fictional local demo fixture",
    lines: PDF_LINES
  }));

  return [...covers, ...avatars, ...publications, ...documents];
}
