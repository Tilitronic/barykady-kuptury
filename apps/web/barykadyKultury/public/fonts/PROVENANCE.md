# FreeSerif provenance & license (D-40)

Acquired 2026-10-22 by `scripts/build-fonts.sh`
(`scripts/fonts/build_freefont.py`). Rebuild: `pnpm fonts:build`.

## Upstream

- Project: GNU FreeFont (FreeSerif family), https://www.gnu.org/software/freefont/
- Artifact: `freefont-ttf-20120503.zip`
- URL: https://ftp.gnu.org/gnu/freefont/freefont-ttf-20120503.zip
- SHA-256: `7c85baf1bf82a1a1845d1322112bc6ca982221b484e3b3925022e25b5cae89af`
  (pinned in the build script and re-verified on every build. The upstream
  directory also carries `.sig` detached signatures; GPG verification was not
  performed in this lane — recorded as a gap, hash + TLS fetch are the
  integrity control here.)
- Faces used: FreeSerif.ttf (weight 400), FreeSerifBold.ttf (700),
  FreeSerifItalic.ttf (400 italic). FreeSerif ships no intermediate weights —
  type tokens are therefore restricted to 400/700 (no faux-bold, D-40).

## License

GPL-3.0-or-later **with the GNU font-embedding exception** (not OFL):

- `GPL-3.0.txt` — full license text, verbatim from the upstream archive
- `GNU-FONT-EMBEDDING-EXCEPTION.txt` — the exception notice, verbatim excerpt
- `AUTHORS.txt` — upstream author list, verbatim

The distributed binaries are **subsets** (unaltered glyph outlines restricted
to the unicode ranges below) produced for web use — covered by the exception
for embedding; the subsetted sources remain under GPL.

## Build

Toolchain: fonttools==4.67.0 brotli==1.2.0 (uv ephemeral env); `pyftsubset`-equivalent API with `--flavor=woff2`
(brotli), layout features `kern, liga, ccmp, locl, mark, mkmk, calt`.

## Distributed artifacts

| file                               | size      | sha256                                                           |
| ---------------------------------- | --------- | ---------------------------------------------------------------- |
| `freeserif-cyrillic-bold.woff2`    | 33,124 B  | 6bfa96b01bd81ce0ad1e9ef359ff93f3a63688dbdd246f3aac7de58aceb47e1f |
| `freeserif-cyrillic-italic.woff2`  | 40,092 B  | c3bec3a205bfa9bd4eaa5e1880282f2b58c5bff3ea28bc61a55e7b5d655a087c |
| `freeserif-cyrillic-normal.woff2`  | 32,976 B  | 98215742e4464956e71d322e4ef06dc0404d3860793c900f4e6dc88b8ce40bbb |
| `freeserif-latin-bold.woff2`       | 51,996 B  | 7b5077f0a5d051d03d58ec1ea22edbade7c8821ee9ccdb40a86a96b3a119033b |
| `freeserif-latin-ext-bold.woff2`   | 143,424 B | 88a5e42ee98514df004476a6675a5cccbfb83308efd5c17e01e5aec11725be4a |
| `freeserif-latin-ext-italic.woff2` | 156,424 B | b8ae8698423ec9128237166b284f53cd896581061f5f7ef8985000ea5a0f6777 |
| `freeserif-latin-ext-normal.woff2` | 185,112 B | b2e518c553e581999b02a1f899121c833776950308e863e7b1b95bd04f61da3d |
| `freeserif-latin-italic.woff2`     | 58,844 B  | 3f99c7aa1c593d80de3c95811fe59d2bc192808133ac339d89818698f26e4843 |
| `freeserif-latin-normal.woff2`     | 49,900 B  | 4c4b01907a3201536acfb48c778779b5fdbb869f11e53a33cb0ff5a1ec9a07e4 |

Unicode ranges (mirrored by `src/css/typography.css`, gated by
`src/shared/typography/__tests__/scale.test.ts`):

- latin: `U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD`
- latin-ext: `U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF`
- cyrillic: `U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116`

Hard gate: Ukrainian Ґґ Єє Іі Її and the full Polish set ąćęłńóśźż (+caps) are
asserted native in every source face AND present in every generated subset
that claims their range (see script header — a miss exits non-zero; no silent
substitution is allowed).
