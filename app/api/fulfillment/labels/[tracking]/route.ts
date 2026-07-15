function pdfEscape(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

export async function GET(request: Request, context: { params: Promise<{ tracking: string }> }) {
  const { tracking } = await context.params;
  const format = new URL(request.url).searchParams.get("format") === "letter" ? "letter" : "4x6";
  const width = format === "letter" ? 612 : 288;
  const height = format === "letter" ? 792 : 432;
  const title = `FAUST OS DEMO LABEL`;
  const body = `Tracking: ${tracking}`;
  const stream = `BT /F1 22 Tf 28 ${height - 54} Td (${pdfEscape(title)}) Tj /F1 14 Tf 0 -38 Td (${pdfEscape(body)}) Tj 0 -28 Td (Carrier: USPS Mock) Tj 0 -28 Td (Service: Ground Advantage) Tj 0 -56 Td (|||| |||| ||| |||| |||| |||) Tj ET`;
  const objects = [
    `1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj`,
    `2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj`,
    `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj`,
    `4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj`,
    `5 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) { offsets.push(pdf.length); pdf += `${object}\n`; }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Response(pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${tracking}-${format}.pdf"` } });
}
