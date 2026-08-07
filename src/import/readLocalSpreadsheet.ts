import Papa from "papaparse";

export type LocalSheet = {
  name: string;
  rows: unknown[][];
};

export type LocalWorkbook = {
  fileName: string;
  sheets: LocalSheet[];
};

function delimiterFor(fileName: string): "," | "\t" {
  return fileName.toLowerCase().endsWith(".tsv") ? "\t" : ",";
}

async function readXlsx(file: File): Promise<LocalSheet[]> {
  // Use the Node build in test/server environments and the browser build on the client.
  // Both builds share the same default-export API that returns all sheets at once.
  const mod =
    typeof window === "undefined"
      ? await import("read-excel-file/node")
      : await import("read-excel-file/browser");
  // `read-excel-file` accepts `Blob | Buffer | ArrayBuffer | string | Stream`.
  // Passing the raw `ArrayBuffer` in Node avoids DOM/Node `Blob` type intersections;
  // in the browser the `File` (a `Blob`) is accepted directly.
  const input: unknown = typeof window === "undefined"
    ? await file.arrayBuffer()
    : file;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sheets = await (mod.default as any)(input);
  return sheets.map((sheet: { sheet: string; data: unknown[][] }) => ({
    name: sheet.sheet,
    rows: sheet.data,
  }));
}

export async function readLocalSpreadsheet(file: File): Promise<LocalWorkbook> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".xls")) throw new Error("UNSUPPORTED_XLS");
  if (lower.endsWith(".csv") || lower.endsWith(".tsv")) {
    const parsed = Papa.parse<string[]>(await file.text(), {
      delimiter: delimiterFor(lower),
      skipEmptyLines: "greedy",
    });
    if (parsed.errors.length > 0) throw new Error("INVALID_DELIMITED_FILE");
    return {
      fileName: file.name,
      sheets: [{ name: "Sheet1", rows: parsed.data }],
    };
  }
  if (lower.endsWith(".xlsx")) {
    const sheets = await readXlsx(file);
    return { fileName: file.name, sheets };
  }
  throw new Error("UNSUPPORTED_SPREADSHEET");
}
