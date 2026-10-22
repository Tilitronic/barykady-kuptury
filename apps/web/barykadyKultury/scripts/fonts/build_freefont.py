#!/usr/bin/env python3
"""D-40 — Build the self-hosted FreeSerif subset set (hard gate + woff2 convert).

WHAT THIS SCRIPT IS
-------------------
GNU FreeSerif (decision D-40) replaces Inter as the brand typeface. Upstream
ships TTF/OTF/WOFF1 only, so the redistribution artifacts must be produced
locally: subset per unicode-range, convert to woff2 (brotli). This script also
owns the HARD GATE that must pass before any substitution is allowed: the
brand-critical codepoints (Ukrainian Ґґ Єє Іі Її and the full Polish Latin
Ext-A set) must exist natively in every source face AND in every generated
subset that claims their range. A miss is a STOP (exit 2) — no silent
substitution to a fallback font is permitted.

PROVENANCE / LICENSE
--------------------
Source: GNU FreeFont 20120503, freefont-ttf-20120503.zip from
https://ftp.gnu.org/gnu/freefont/ (sha256 pinned below; download is verified
by hash, not by GPG — the accompanying .sig files are not checked here, see
PROVENANCE.md). License: GPL-3.0-or-later WITH the GNU font-embedding
exception (NOT OFL). The verbatim license texts and the upstream AUTHORS file
are redistributed into public/fonts/ by this script, together with a
PROVENANCE.md carrying hashes, tool pins and rebuild instructions.

USAGE
-----
  build_freefont.py             # gate sources, build 9 woff2s, ship license
  build_freefont.py --gate-only # measure only; write nothing (step-1 hard gate)

DETERMINISM
-----------
Given the same verified zip and the same fonttools/brotli pins, output bytes
are reproducible; PROVENANCE.md records both file hashes so a rebuild can be
audited against what is checked in.
"""
# The fontTools/brotli imports resolve at runtime inside the ephemeral env
# created by scripts/build-fonts.sh (`uv run --with fonttools --with brotli`),
# never against the project interpreter — the unresolved-import diagnostics in
# editors are expected and are NOT defects.
# pyright: reportMissingImports=false

import argparse
import hashlib
import re
import sys
import urllib.request
import zipfile
from datetime import date
from pathlib import Path

APP_ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = APP_ROOT / "public" / "fonts"
CACHE_DIR = Path(__file__).resolve().parent / ".cache"

# ─── Upstream pin (D-40 provenance) ───────────────────────────────────────────
VERSION = "20120503"
ARCHIVE = "freefont-ttf-20120503.zip"
URL = f"https://ftp.gnu.org/gnu/freefont/{ARCHIVE}"
SHA256 = "7c85baf1bf82a1a1845d1322112bc6ca982221b484e3b3925022e25b5cae89af"
TOOLS = "fonttools==4.67.0 brotli==1.2.0 (uv ephemeral env)"

FACES = {
    # output-face-name -> upstream TTF; weights/styles are the REAL faces only.
    # italic ships because <em> (reader + richText) and five card fallback
    # styles use font-style: italic — synthesis is never acceptable.
    "normal": ("FreeSerif.ttf", "400"),
    "bold": ("FreeSerifBold.ttf", "700"),
    "italic": ("FreeSerifItalic.ttf", "400"),
}

# ─── Subset ranges ────────────────────────────────────────────────────────────
# Verbatim from the former Inter unicode-ranges (latin / latin-ext / cyrillic);
# cyrillic-ext is dropped — D-40 ships exactly three subsets and the brand
# languages (pl/uk/en) never used the extended block. typography.css mirrors
# these strings; scale.test.ts gates the brand-critical tokens of each.
RANGES = {
    "latin": "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,"
    "U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,"
    "U+2215,U+FEFF,U+FFFD",
    "latin-ext": "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,"
    "U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,"
    "U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF",
    "cyrillic": "U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116",
}

LAYOUT_FEATURES = ["kern", "liga", "ccmp", "locl", "mark", "mkmk", "calt"]

# ─── The hard gate list ───────────────────────────────────────────────────────
# Brand-critical codepoints (D-40 text: ҐґЄєІіЇї + ąćęłńóśźż, both cases) plus
# the core coverage the UI cannot render without (ASCII, basic Cyrillic, the
# punctuation and currency actually used). Missing ANY of these in ANY shipped
# face/subset pair is a STOP — the design would silently fall back per-glyph.
HARD = {
    0x0490: "Ґ capital GHE with upstroke",
    0x0491: "ґ small ghe with upstroke",
    0x0404: "Є capital Ukrainian YE",
    0x0454: "є small",
    0x0406: "І capital BYELORUSSIAN-UKRAINIAN I",
    0x0456: "і small",
    0x0407: "Ї capital YI",
    0x0457: "ї small",
    0x0410: "А basic Cyrillic",
    0x044F: "я basic Cyrillic",
    0x0401: "Ё",
    0x0451: "ё",
    0x0104: "Ą", 0x0105: "ą", 0x0106: "Ć", 0x0107: "ć",
    0x0118: "Ę", 0x0119: "ę", 0x0141: "Ł", 0x0142: "ł",
    0x0143: "Ń", 0x0144: "ń", 0x015A: "Ś", 0x015B: "ś",
    0x0179: "Ź", 0x017A: "ź", 0x017B: "Ż", 0x017C: "ż",
    0x00D3: "Ó", 0x00F3: "ó",
    0x0020: "space", 0x0041: "A", 0x0061: "a", 0x0030: "0", 0x002E: ".",
    0x002C: ",", 0x003A: ":", 0x003F: "?", 0x0021: "!", 0x002D: "-",
    0x00A0: "nbsp", 0x2013: "en dash", 0x2014: "em dash",
    0x2018: "left quote", 0x2019: "right quote",
    0x201C: "ldq", 0x201D: "rdq",
    0x20AC: "€", 0x2116: "numero sign",
}


def parse_ranges(spec: str) -> set[int]:
    """'U+0400-045F, U+2116' -> set of ints. Supports single cps and ranges."""
    cps: set[int] = set()
    for token in spec.split(","):
        token = token.strip()
        if not token:
            continue
        # Accept both CSS spellings: "U+0400-045F" (shorthand) and
        # "U+0400-U+045F" (explicit), plus single "U+2116".
        m = re.fullmatch(
            r"U\+([0-9A-Fa-f]{4,6})(?:-U?\+?([0-9A-Fa-f]{4,6}))?", token
        )
        if not m:
            raise ValueError(f"Bad unicode token: {token!r}")
        start = int(m.group(1), 16)
        end = int(m.group(2), 16) if m.group(2) else start
        cps.update(range(start, end + 1))
    return cps


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def ensure_source_zip() -> Path:
    """Download the pinned archive if absent; verify sha256 on every run."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    target = CACHE_DIR / ARCHIVE
    if not target.exists():
        print(f"downloading {URL} ...")
        urllib.request.urlretrieve(URL, target)  # noqa: S310 (pinned HTTPS URL)
    digest = sha256(target)
    if digest != SHA256:
        print(
            f"PROVENANCE FAILURE: {target.name} sha256 {digest}\n"
            f"expected          {SHA256}\n"
            "Refusing to build — the pinned upstream artifact changed.",
            file=sys.stderr,
        )
        sys.exit(3)
    print(f"upstream zip verified: sha256={digest}")
    return target


def extract_zip(zpath: Path) -> Path:
    """Extract only the files the build needs (fonts + license inputs)."""
    keep = {
        "FreeSerif.ttf",
        "FreeSerifBold.ttf",
        "FreeSerifItalic.ttf",
        "COPYING",
        "README",
        "AUTHORS",
    }
    dest = CACHE_DIR / "extracted"
    font_dir = dest / f"freefont-{VERSION}"
    if not (font_dir / "FreeSerif.ttf").exists():
        font_dir.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(zpath) as zf:
            for member in zf.namelist():
                name = Path(member).name
                if name in keep and member != name:  # skip stray root entries
                    (font_dir / name).write_bytes(zf.read(member))
    return font_dir


def load_cmap(path: Path) -> dict:
    from fontTools.ttLib import TTFont

    return TTFont(path, lazy=True).getBestCmap()


def gate_sources(font_dir: Path) -> None:
    """Hard gate #1: every required codepoint exists natively in every face."""
    failed = False
    for face, (fname, _w) in FACES.items():
        cmap = load_cmap(font_dir / fname)
        missing = [f"U+{cp:04X} {lbl}" for cp, lbl in sorted(HARD.items()) if cp not in cmap]
        if missing:
            failed = True
            print(f"GATE FAIL [{face}]: missing {missing}", file=sys.stderr)
        else:
            print(f"GATE PASS [{face}]: {len(HARD)} brand codepoints native")
    if failed:
        print(
            "\nSTOP (D-40): FreeSerif lacks brand glyphs. Do not substitute "
            "silently — report and pick a different source face.",
            file=sys.stderr,
        )
        sys.exit(2)


def build_subsets(font_dir: Path) -> list[Path]:
    """Subset + convert: 3 faces × 3 ranges -> 9 woff2 files."""
    from fontTools import subset
    from fontTools.ttLib import TTFont

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    outputs: list[Path] = []
    for face, (fname, _w) in FACES.items():
        for subset_name, ranges in RANGES.items():
            out = OUT_DIR / f"freeserif-{subset_name}-{face}.woff2"
            opts = subset.Options()
            opts.flavor = "woff2"
            opts.layout_features = LAYOUT_FEATURES
            opts.name_IDs = ["*"]
            subsetter = subset.Subsetter(opts)
            subsetter.populate(unicodes=sorted(parse_ranges(ranges)))
            tt = TTFont(font_dir / fname)
            subsetter.subset(tt)
            tt.save(out)
            outputs.append(out)
    return outputs


def gate_outputs(outputs: list[Path]) -> None:
    """Hard gate #2: each generated subset keeps the brand codepoints routed
    to its range. The CSS unicode-range claims exactly RANGES[subset]; the
    browser will therefore never consult any other face for them, so a glyph
    lost to subsetting becomes a silent per-glyph fallback."""
    failed = False
    for out in outputs:
        m = re.fullmatch(r"freeserif-(latin|latin-ext|cyrillic)-(normal|bold|italic)\.woff2", out.name)
        assert m
        subset_name, face = m.groups()
        routed = parse_ranges(RANGES[subset_name]) & set(HARD)
        cmap = load_cmap(out)
        missing = [f"U+{cp:04X}" for cp in sorted(routed) if cp not in cmap]
        if missing:
            failed = True
            print(f"GATE FAIL [{out.name}]: {missing}", file=sys.stderr)
    if failed:
        print("\nSTOP (D-40): subsetting dropped brand glyphs.", file=sys.stderr)
        sys.exit(2)
    print(f"GATE PASS [outputs]: {len(outputs)} woff2 subsets route all brand codepoints")


def ship_license(font_dir: Path, outputs: list[Path]) -> None:
    """Replace the Inter artifacts: license texts, provenance, remove woff2s/OFL."""
    for old in OUT_DIR.glob("inter-*.woff2"):
        old.unlink()
        print(f"removed {old.name}")
    ofl = OUT_DIR / "OFL.txt"
    if ofl.exists():
        ofl.unlink()
        print("removed OFL.txt (Inter is gone)")

    copying = (font_dir / "COPYING").read_text(encoding="utf-8", errors="replace")
    (OUT_DIR / "GPL-3.0.txt").write_text(copying, encoding="utf-8")

    readme = (font_dir / "README").read_text(encoding="utf-8", errors="replace")
    m = re.search(
        r"Free UCS scalable fonts is free software.*?delete this exception statement from your version\.",
        readme,
        re.S,
    )
    if not m:
        print("STOP: could not locate the font-embedding exception in upstream README", file=sys.stderr)
        sys.exit(2)
    (OUT_DIR / "GNU-FONT-EMBEDDING-EXCEPTION.txt").write_text(
        "GNU FreeFont license notice (verbatim excerpt from upstream README,"
        f" {ARCHIVE}):\n\n{m.group(0)}\n",
        encoding="utf-8",
    )
    (OUT_DIR / "AUTHORS.txt").write_text(
        (font_dir / "AUTHORS").read_text(encoding="utf-8", errors="replace"),
        encoding="utf-8",
    )

    sizes = "\n".join(
        f"| `{p.name}` | {p.stat().st_size:,} B | {sha256(p)} |" for p in sorted(outputs)
    )
    (OUT_DIR / "PROVENANCE.md").write_text(
        f"""# FreeSerif provenance & license (D-40)

Acquired {date.today().isoformat()} by `scripts/build-fonts.sh`
(`scripts/fonts/build_freefont.py`). Rebuild: `pnpm fonts:build`.

## Upstream

- Project: GNU FreeFont (FreeSerif family), https://www.gnu.org/software/freefont/
- Artifact: `{ARCHIVE}`
- URL: {URL}
- SHA-256: `{SHA256}`
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

Toolchain: {TOOLS}; `pyftsubset`-equivalent API with `--flavor=woff2`
(brotli), layout features `{', '.join(LAYOUT_FEATURES)}`.

## Distributed artifacts

| file | size | sha256 |
| ---- | ---- | ------ |
{sizes}

Unicode ranges (mirrored by `src/css/typography.css`, gated by
`src/shared/typography/__tests__/scale.test.ts`):

- latin: `{RANGES['latin']}`
- latin-ext: `{RANGES['latin-ext']}`
- cyrillic: `{RANGES['cyrillic']}`

Hard gate: Ukrainian Ґґ Єє Іі Її and the full Polish set ąćęłńóśźż (+caps) are
asserted native in every source face AND present in every generated subset
that claims their range (see script header — a miss exits non-zero; no silent
substitution is allowed).
""",
        encoding="utf-8",
    )
    print("shipped GPL-3.0.txt, GNU-FONT-EMBEDDING-EXCEPTION.txt, AUTHORS.txt, PROVENANCE.md")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--gate-only",
        action="store_true",
        help="measure only: verify sha256 + source codepoint gate, write nothing",
    )
    args = ap.parse_args()

    try:
        import fontTools  # noqa: F401
        import brotli  # noqa: F401  (needed for woff2 flavor)
    except ImportError:
        print("STOP: this script needs fontTools + brotli. Run it via scripts/build-fonts.sh", file=sys.stderr)
        sys.exit(4)

    zpath = ensure_source_zip()
    font_dir = extract_zip(zpath)
    gate_sources(font_dir)
    if args.gate_only:
        print("gate-only: PASS — sources are usable; nothing written")
        return

    outputs = build_subsets(font_dir)
    gate_outputs(outputs)
    ship_license(font_dir, outputs)
    for p in sorted(outputs):
        print(f"  {p.name:38s} {p.stat().st_size:>9,} B")
    print(f"DONE: {len(outputs)} woff2 subsets in {OUT_DIR}")


if __name__ == "__main__":
    main()
