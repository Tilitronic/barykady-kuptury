/**
 * Minimal deterministic text PDF builder.
 *
 * Demo publications and documents only need a small, obviously fictional file
 * that a browser/PDF reader can open. A generated one-page PDF keeps the demo
 * assets free of borrowed documents and avoids a PDF dependency. Content is
 * Latin-1/ASCII (the standard Helvetica font without embedding); non-Latin
 * characters are replaced with `?` rather than producing an invalid file.
 *
 * PDF structure: catalog → pages → one page → content stream + font, with a
 * correct xref table so readers do not have to reconstruct broken files.
 */

export interface DemoPdfOptions {
  readonly title: string;
  readonly subtitle?: string;
  readonly lines?: readonly string[];
}

/** Escapes a PDF literal string and removes characters Helvetica cannot draw. */
function toPdfString(value: string): string {
  return value
    .replace(/[^\x20-\x7e]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function contentStream(options: DemoPdfOptions): string {
  const title = toPdfString(options.title);
  const subtitle = options.subtitle ? toPdfString(options.subtitle) : null;
  const lines = (options.lines ?? []).map(toPdfString);

  const parts = ["BT", "/F1 24 Tf", "72 730 Td", `(${title}) Tj`];

  if (subtitle) {
    parts.push("/F1 12 Tf", "0 -28 Td", `(${subtitle}) Tj`);
  }

  if (lines.length > 0) {
    parts.push("/F1 12 Tf");
    for (const line of lines) {
      parts.push("0 -22 Td", `(${line}) Tj`);
    }
  }

  parts.push("ET");
  return `${parts.join("\n")}\n`;
}

export function buildDemoPdf(options: DemoPdfOptions): Buffer {
  const stream = contentStream(options);
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] " +
      "/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}endstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];

  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "latin1");
}
