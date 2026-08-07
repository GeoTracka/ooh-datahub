import ExcelJS from "exceljs";

async function main() {
  const workbook = new ExcelJS.Workbook();
  const inventory = workbook.addWorksheet("Inventory");
  inventory.addRows([
    ["Asset ID", "Location Address", "Coordinate Source"],
    ["OS-001", "Oshodi Transport Interchange", "customer_captured"],
  ]);
  const notes = workbook.addWorksheet("Notes");
  notes.addRows([
    ["Key", "Value"],
    ["Revision", "fixture-v1"],
  ]);
  await workbook.xlsx.writeFile("tests/fixtures/multi-sheet-inventory.xlsx");
}

main();
