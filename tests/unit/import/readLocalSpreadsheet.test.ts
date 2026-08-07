import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { readLocalSpreadsheet } from "@/import/readLocalSpreadsheet";

describe("readLocalSpreadsheet", () => {
  it("parses CSV and TSV locally", async () => {
    const csv = new File(
      [await readFile("tests/fixtures/messy-inventory.csv")],
      "inventory.csv",
    );
    const tsv = new File(
      [await readFile("tests/fixtures/inventory.tsv")],
      "inventory.tsv",
    );
    expect((await readLocalSpreadsheet(csv)).sheets[0].rows).toHaveLength(4);
    expect((await readLocalSpreadsheet(tsv)).sheets[0].rows).toHaveLength(2);
  });

  it("rejects legacy XLS explicitly", async () => {
    const file = new File(["binary"], "legacy.xls");
    await expect(readLocalSpreadsheet(file)).rejects.toThrow("UNSUPPORTED_XLS");
  });

  it("never calls the network while selecting or parsing a file", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const csv = new File(
      [await readFile("tests/fixtures/messy-inventory.csv")],
      "inventory.csv",
    );
    await readLocalSpreadsheet(csv);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("lists and reads every XLSX worksheet", async () => {
    const bytes = await readFile("tests/fixtures/multi-sheet-inventory.xlsx");
    const workbook = await readLocalSpreadsheet(
      new File([bytes], "multi-sheet-inventory.xlsx"),
    );
    expect(workbook.sheets.map((sheet) => sheet.name)).toEqual(["Inventory", "Notes"]);
    expect(workbook.sheets.map((sheet) => sheet.rows.length)).toEqual([2, 2]);
  });
});
