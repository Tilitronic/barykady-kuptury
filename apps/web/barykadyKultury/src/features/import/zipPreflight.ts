import { ImportConversionError } from "./errors";
import type { ImportLimits } from "./limits";

/**
 * T-041 DOCX zip preflight.
 *
 * Mammoth/JSZip inflate the archive in the worker. Before handing it over, we
 * inspect the zip central directory and reject:
 * - a compressed file above the import ceiling,
 * - too many entries,
 * - an inflated-size sum above the ceiling,
 * - encrypted entries and macro parts,
 * - entry names that try to escape the archive root.
 *
 * This is deliberately a pure central-directory reader (no inflate). A hostile
 * DOCX cannot make us allocate its declared uncompressed size merely to check
 * it. Zip64 is rejected rather than partially parsed: a DOCX never needs it for
 * this project's content sizes, and an unsupported layout is safer than a
 * guessed one.
 */

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const EOCD_MIN_BYTES = 22;
const MAX_COMMENT_BYTES = 0xffff;

export interface ZipEntryInfo {
  readonly name: string;
  readonly compressedSize: number;
  readonly uncompressedSize: number;
}

function unsafe(detail: string): ImportConversionError {
  return new ImportConversionError("docxUnsafeZip", detail);
}

function findEndOfCentralDirectory(view: DataView): number {
  const minimum = Math.max(
    0,
    view.byteLength - EOCD_MIN_BYTES - MAX_COMMENT_BYTES
  );

  for (
    let offset = view.byteLength - EOCD_MIN_BYTES;
    offset >= minimum;
    offset -= 1
  ) {
    if (view.getUint32(offset, true) === EOCD_SIGNATURE) {
      return offset;
    }
  }

  throw unsafe("missing zip central directory");
}

export function inspectDocxZip(
  bytes: ArrayBuffer,
  limits: ImportLimits
): ZipEntryInfo[] {
  if (bytes.byteLength === 0) throw unsafe("empty archive");
  if (bytes.byteLength > limits.maxDocxCompressedBytes) {
    throw unsafe("compressed size exceeds limit");
  }
  if (bytes.byteLength < EOCD_MIN_BYTES) {
    throw unsafe("archive is too small to be a DOCX");
  }

  const view = new DataView(bytes);
  const eocdOffset = findEndOfCentralDirectory(view);

  const entryCount = view.getUint16(eocdOffset + 10, true);
  const directorySize = view.getUint32(eocdOffset + 12, true);
  const directoryOffset = view.getUint32(eocdOffset + 16, true);

  if (
    entryCount === 0xffff ||
    directorySize === 0xffffffff ||
    directoryOffset === 0xffffffff
  ) {
    throw unsafe("zip64 archives are not supported");
  }
  if (entryCount === 0) throw unsafe("archive has no entries");
  if (entryCount > limits.maxDocxEntries) {
    throw unsafe(`archive has too many entries (${entryCount})`);
  }
  if (directoryOffset + directorySize > bytes.byteLength) {
    throw unsafe("central directory is outside the archive");
  }

  const decoder = new TextDecoder("utf-8");
  const entries: ZipEntryInfo[] = [];
  let offset = directoryOffset;
  let totalUncompressed = 0;

  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > bytes.byteLength) {
      throw unsafe("truncated central directory");
    }
    if (view.getUint32(offset, true) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw unsafe("invalid central directory entry");
    }

    const flags = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const nameStart = offset + 46;

    if (nameStart + nameLength > bytes.byteLength) {
      throw unsafe("truncated entry name");
    }
    if ((flags & 0x0001) !== 0) {
      throw unsafe("encrypted entries are not allowed");
    }
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) {
      throw unsafe("zip64 entries are not supported");
    }

    const name = decoder.decode(new Uint8Array(bytes, nameStart, nameLength));
    const normalizedName = name.replaceAll("\\", "/").toLowerCase();

    if (
      normalizedName.startsWith("/") ||
      normalizedName.split("/").includes("..")
    ) {
      throw unsafe("entry path escapes the archive root");
    }
    if (normalizedName.endsWith("vbaproject.bin")) {
      throw new ImportConversionError("docxMacros", name);
    }

    totalUncompressed += uncompressedSize;
    if (totalUncompressed > limits.maxDocxUncompressedBytes) {
      throw unsafe("uncompressed size exceeds limit");
    }

    entries.push({ name, compressedSize, uncompressedSize });
    offset = nameStart + nameLength + extraLength + commentLength;
  }

  return entries;
}
