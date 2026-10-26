/**
 * T-034 gate fix — minimal ESM loader for the local Netlify function runtime.
 *
 * WHY: `netlify/functions/*.ts` are bindings that import app TypeScript with
 * extensionless specifiers (e.g. `.../events/calendarHandler`). Node's ESM
 * resolver requires explicit extensions, so running the *real* function entry
 * outside Vite/Netlify fails with ERR_MODULE_NOT_FOUND. This hook makes the
 * local runtime resolve the same graph the bundler does, using the project's
 * `typescript` devDependency for transpilation.
 *
 * Loaded via `node:module` `register()` from `local-function-runtime.mjs`.
 * Type-stripping is done explicitly (not left to the Node version) so the
 * documented engine range (^22.12 / Node 24+) behaves identically.
 */

import { readFile } from "node:fs/promises";
import ts from "typescript";

const TS_EXTENSION = ".ts";
const HAS_EXTENSION = /\.[A-Za-z0-9]+$/;

export async function resolve(specifier, context, nextResolve) {
  // Current functions import app sources relatively (the calendar graph is
  // `calendarHandler` → `normalize`). If a binding starts using the `@/` alias,
  // extend this hook then — do not guess an alias that no caller exercises.
  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    !HAS_EXTENSION.test(specifier)
  ) {
    try {
      return await nextResolve(`${specifier}${TS_EXTENSION}`, context);
    } catch {
      // Not a TypeScript file — fall through to the default resolver.
    }
  }

  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (!url.endsWith(TS_EXTENSION)) {
    return nextLoad(url, context);
  }

  const fileUrl = new URL(url);
  const source = await readFile(fileUrl, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      isolatedModules: true
    },
    fileName: fileUrl.pathname
  });

  return { format: "module", source: outputText, shortCircuit: true };
}
