import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(process.argv[2] ?? "artifacts/ui-ux-review");

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}

function relativeName(path) {
  return path.slice(root.length + 1).replaceAll("\\", "/").replace(/\.json$/, "");
}

const files = (await walk(root)).filter((path) => path.endsWith(".json"));
const rows = [];
for (const path of files) {
  const value = JSON.parse(await readFile(path, "utf8"));
  if (!value.viewport || !value.document) continue;
  rows.push({
    screen: relativeName(path),
    viewport: `${value.viewport.width}×${value.viewport.height}`,
    horizontalOverflowPx: value.document.horizontalOverflowPx ?? 0,
    interactive: value.visibleInteractiveCount ?? 0,
    undersized: value.undersizedInteractiveCandidates?.length ?? 0,
    clipped: value.clippedTextCandidates?.length ?? 0,
    nestedScroll: value.nestedScrollableContainers?.length ?? 0,
    documentHeight: value.document.scrollHeight ?? 0,
  });
}
rows.sort((a, b) => a.screen.localeCompare(b.screen));

const ranked = [...rows].sort((a, b) => {
  const riskA = a.horizontalOverflowPx * 1000 + a.clipped * 100 + a.undersized * 10 + a.nestedScroll;
  const riskB = b.horizontalOverflowPx * 1000 + b.clipped * 100 + b.undersized * 10 + b.nestedScroll;
  return riskB - riskA || a.screen.localeCompare(b.screen);
});

const totals = {
  screens: rows.length,
  horizontalOverflowScreens: rows.filter((row) => row.horizontalOverflowPx > 1).length,
  clippedTextScreens: rows.filter((row) => row.clipped > 0).length,
  undersizedCandidateScreens: rows.filter((row) => row.undersized > 0).length,
  nestedScrollScreens: rows.filter((row) => row.nestedScroll > 0).length,
};

const markdown = [
  "## UI / UX review evidence",
  "",
  `- Captured **${totals.screens} reviewed screen states** with screenshot + diagnostic sidecars.`,
  `- Horizontal overflow: **${totals.horizontalOverflowScreens}** screens; clipped text candidates: **${totals.clippedTextScreens}**; undersized-target candidate screens: **${totals.undersizedCandidateScreens}**; nested-scroll screens: **${totals.nestedScrollScreens}**.`,
  "- Machine diagnostics are triage signals; review the corresponding screenshots before treating a candidate as a defect.",
  "",
  "### Highest-signal screens",
  "",
  "| Screen | Viewport | H overflow | Small targets | Clipped text | Nested scroll |",
  "|---|---:|---:|---:|---:|---:|",
  ...ranked.slice(0, 8).map((row) =>
    `| ${row.screen} | ${row.viewport} | ${row.horizontalOverflowPx}px | ${row.undersized} | ${row.clipped} | ${row.nestedScroll} |`),
  "",
  "Download the `ui-ux-review-<run>-<attempt>` artifact for the screenshots and per-screen JSON diagnostics.",
  "",
].join("\n");

await writeFile(join(root, "summary.json"), `${JSON.stringify({ totals, screens: rows }, null, 2)}\n`, "utf8");
await writeFile(join(root, "summary.md"), markdown, "utf8");
process.stdout.write(markdown);
