#!/usr/bin/env node
/**
 * ui-inventory.mjs — exhaustive, repeatable inventory of every Vue component.
 *
 * WHY this exists: a hand-written audit missed native <button> elements twice
 * (the first grep required a character after the tag name, so multi-line tag
 * openings were invisible). This script parses every SFC mechanically and
 * emits both a human-readable table and a JSON companion, so coverage is a
 * property of the tool rather than of the auditor's attention.
 *
 * Usage:
 *   node scripts/ui-inventory.mjs            # writes .md + .json
 *   node scripts/ui-inventory.mjs --stdout   # prints the markdown only
 *
 * Output (committed, regenerated on demand):
 *   docs/tickets/T-049-component-inventory.md
 *   docs/tickets/T-049-component-inventory.json
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const APP_ROOT = new URL("../apps/web/barykadyKultury/", import.meta.url).pathname;
const SRC_ROOT = join(APP_ROOT, "src");
const OUT_MD = new URL("../docs/tickets/T-049-component-inventory.md", import.meta.url)
  .pathname;
const OUT_JSON = new URL(
  "../docs/tickets/T-049-component-inventory.json",
  import.meta.url
).pathname;

/**
 * Elements that are hand-written interactive controls. Quasar components are
 * catalogued separately; these are the native ones a migration must dispose of.
 */
const NATIVE_CONTROLS = /<(button|input|select|textarea|dialog|details|option|summary)\b/g;

/** Hand-rolled accessibility/interaction patterns worth a migration verdict. */
const PATTERN_MARKERS = [
  /\brole="(tab|tablist|switch|dialog|menu|menuitem|combobox|listbox|option|radiogroup|group)"/g,
  /\baria-expanded=/g,
  /\baria-current=/g,
  /\baria-pressed=/g,
  /\baria-checked=/g,
  /\baria-modal=/g,
  /\btabindex=/g,
  /@keydown/g,
  /\bfocus\(\)/g,
  /\bpreventScroll\b/g
];

/**
 * Quasar "class-to-style" utility classes. Banned in authored markup by
 * T-049 §2; counted here so the cleanup scope is measured, not estimated.
 */
const UTILITY_CLASS =
  /\b(?:q-(?:p|m)[trblaxy]?-(?:none|auto|xs|sm|md|lg|xl)|q-gutter(?:-[xy])?-(?:xs|sm|md|lg|xl)|q-col-gutter(?:-[xy])?-(?:xs|sm|md|lg|xl)|text-(?:h[1-6]|subtitle[12]|body[12]|caption|overline|weight-(?:thin|light|regular|medium|bold|bolder)|center|left|right|justify|uppercase|lowercase|capitalize|no-wrap|strike|italic|bold|white|dark|grey(?:-\d+)?)|bg-(?:primary|secondary|accent|positive|negative|warning|info|dark|white|black|transparent|grey(?:-\d+)?)|col(?:-(?:\d+|sm|md|lg|xl|auto|grow|shrink))?|offset-\d+|items-(?:start|end|center|baseline|stretch)|justify-(?:start|end|center|between|around|evenly)|self-(?:start|end|center|baseline|stretch)|order-(?:first|last)|no-wrap|flex-center|shadow-\d+|rounded-borders|ellipsis|full-width|absolute(?:-(?:top|bottom|left|right))?|non-selectable|cursor-pointer)\b/g;

/** Recursively collect every .vue file under src/. */
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry.endsWith(".vue")) out.push(full);
  }
  return out.sort();
}

/**
 * Blank a slice while preserving its newlines.
 *
 * WHY: stripping `<script>`, `<style>` and HTML comments with `""` shifts every
 * reported line number, so the audit would cite lines that do not exist. Blanking
 * non-newline characters keeps offsets identical, which makes `tag@line` point at
 * the real file line.
 */
function blankOut(text) {
  return text.replace(/[^\n]/g, " ");
}

/**
 * Strip <script>/<style> blocks and HTML comments so scanning sees the live
 * template only. WHY comments must go too: instructional comments legitimately
 * contain `<details>` and `position:absolute`, and counting them produced three
 * phantom "native controls" and one phantom utility token in the first run.
 */
function templateOf(source) {
  return source
    .replace(/<script[\s\S]*?<\/script>/g, blankOut)
    .replace(/<style[\s\S]*?<\/style>/g, blankOut)
    .replace(/<!--[\s\S]*?-->/g, blankOut);
}

/**
 * Class attribute values only — never the whole template.
 *
 * WHY: `scope="col"` on table headers and prose such as `position:absolute`
 * inside markup matched the utility pattern when the scan ran over the whole
 * template, inflating the debt by 23 tokens across 6 files. Utility syntax is
 * defined by being a class token, so only `class="…"` values are searched.
 */
function classAttributeValues(template) {
  return [...template.matchAll(/\bclass="([^"]*)"/g)].map(match => match[1]);
}

/** Count regex matches without leaking mutable lastIndex state. */
function countMatches(text, re) {
  const copy = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  return (text.match(copy) ?? []).length;
}

/** Line numbers of a pattern, so the audit can cite them. */
function lineNumbers(text, re) {
  const lines = text.split("\n");
  const hits = [];
  lines.forEach((line, index) => {
    const copy = new RegExp(re.source, re.flags.replace("g", ""));
    if (copy.test(line)) hits.push(index + 1);
  });
  return hits;
}

/** Quasar components referenced by tag (PascalCase or kebab) or by import. */
function quasarUsage(template, source) {
  const tags = new Set();
  for (const match of template.matchAll(/<(q-[a-z0-9-]+|[A-Z][A-Za-z0-9]*)/g)) {
    const name = match[1];
    if (name.startsWith("q-") || /^Q[A-Z]/.test(name)) tags.add(name);
  }
  for (const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*"quasar"/g)) {
    for (const part of match[1].split(",")) {
      const name = part.trim();
      if (name) tags.add(name);
    }
  }
  // Wrapper imports (ui/ today, bk/ after T-049 Phase 1) are Quasar usage too.
  for (const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*"@\/components\/(ui|bk)"/g)) {
    for (const part of match[1].split(",")) {
      const name = part.trim();
      if (name) tags.add(name);
    }
  }
  return [...tags].sort();
}

/** Seam dependencies: which wrapper module this file imports from. */
function seamImports(source) {
  const matches = [...source.matchAll(/from\s*"@\/components\/(ui|bk)"/g)];
  return [...new Set(matches.map(m => m[1]))];
}

/**
 * Per-file facts. `nativeControls` keeps line numbers because the reviewer
 * needs to find the exact element, not a count.
 */
function analyse(file) {
  const source = readFileSync(file, "utf8");
  const template = templateOf(source);
  const rel = relative(APP_ROOT, file).split(sep).join("/");
  const styleBlock = source.match(/<style([^>]*)>/);
  const nativeHits = [...template.matchAll(NATIVE_CONTROLS)].map(m => ({
    tag: m[1],
    line: template.slice(0, m.index).split("\n").length
  }));

  const patterns = {};
  for (const re of PATTERN_MARKERS) {
    const n = countMatches(template, re);
    if (n > 0) patterns[re.source] = n;
  }

  return {
    file: rel,
    lines: source.split("\n").length,
    quasar: quasarUsage(template, source),
    nativeControls: nativeHits,
    seam: seamImports(source),
    utilityClassCount: classAttributeValues(template).reduce(
      (total, value) => total + countMatches(value, UTILITY_CLASS),
      0
    ),
    style: styleBlock
      ? {
          lang: (styleBlock[1].match(/lang="([^"]+)"/) ?? [, "css"])[1],
          scoped: /scoped/.test(styleBlock[1])
        }
      : null,
    patterns,
    hasTest: exists(
      join(APP_ROOT, "src", rel.replace(/\.vue$/, ".test.ts").replace(/^\//, ""))
    )
  };
}

function exists(path) {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
}

function markdown(files, summary) {
  const rows = files
    .map(f => {
      const native = f.nativeControls.map(n => `${n.tag}@${n.line}`).join(", ") || "—";
      const quasar = f.quasar.length > 0 ? f.quasar.join(", ") : "—";
      return `| \`${f.file}\` | ${f.lines} | ${quasar} | ${native} | ${f.seam.join("/") || "—"} | ${f.utilityClassCount} | ${f.style ? `${f.style.lang}${f.style.scoped ? " scoped" : ""}` : "—"} |`;
    })
    .join("\n");

  return `# T-049 — Mechanical component inventory

Generated by \`scripts/ui-inventory.mjs\` — regenerate instead of editing by hand.
Scope: every \`.vue\` file under \`apps/web/barykadyKultury/src\`.
"Native" cites \`tag@line\` so each element can be found directly.
"Util" counts Quasar class-to-style tokens (banned by T-049 §2).

## Summary

| Fact | Count |
|---|---|
| Vue components | ${summary.files} |
| Components with native controls | ${summary.withNative} |
| Native control instances | ${summary.nativeTotal} |
| Components using the \`bk/\` seam | ${summary.withSeam} |
| Components with utility classes | ${summary.withUtil} |
| Utility-class tokens | ${summary.utilTotal} |
| Components using Quasar components | ${summary.withQuasar} |

## Inventory

| File | Lines | Quasar / seam components | Native controls | Seam | Util | Style |
|---|---|---|---|---|---|---|
${rows}
`;
}

const files = walk(SRC_ROOT).map(analyse);
const summary = {
  files: files.length,
  withNative: files.filter(f => f.nativeControls.length > 0).length,
  nativeTotal: files.reduce((n, f) => n + f.nativeControls.length, 0),
  withSeam: files.filter(f => f.seam.length > 0).length,
  withUtil: files.filter(f => f.utilityClassCount > 0).length,
  utilTotal: files.reduce((n, f) => n + f.utilityClassCount, 0),
  withQuasar: files.filter(f => f.quasar.length > 0).length
};

const md = markdown(files, summary);

if (process.argv.includes("--stdout")) {
  process.stdout.write(md);
} else {
  writeFileSync(OUT_MD, md);
  writeFileSync(OUT_JSON, JSON.stringify({ summary, files }, null, 2));
  process.stdout.write(
    `wrote ${relative(APP_ROOT, OUT_MD)} (${files.length} components, ${summary.nativeTotal} native controls, ${summary.utilTotal} utility tokens)\n`
  );
}
