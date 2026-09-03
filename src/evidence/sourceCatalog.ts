export type RblLomaSource = {
  id: string;
  kind: "survey_workbook" | "published_report";
  fileName: string;
  sha256: string;
  accessClass: "restricted_respondent_source" | "reviewed_narrative_source";
  period: string;
};

export const rblLoma2026Sources = [
  {
    id: "rbl-loma-ooh-penetration-databook-2026-r1",
    kind: "survey_workbook",
    fileName:
      "RBL-LOMA Nigeria OOH Consumer Penetration Cleaned Databook.2026.xlsx",
    sha256:
      "780a9fbaa2b4e736c4a4236fae751cb8c314aabaf6cad8206e553870bc5032e2",
    accessClass: "restricted_respondent_source",
    period: "2026-05",
  },
  {
    id: "rbl-loma-ooh-audience-penetration-study-2026-r1",
    kind: "published_report",
    fileName: "RBL-LOMA OOH AUDIENCE PENETRATION Study 2026.pdf",
    sha256:
      "a93b78fae81abee0f02a9248e7f69eaa065d94d3ebef81fea6105bccab44c0ff",
    accessClass: "reviewed_narrative_source",
    period: "2026",
  },
] as const satisfies readonly RblLomaSource[];

export function findRblLoma2026Source(id: string): RblLomaSource {
  const source = rblLoma2026Sources.find((candidate) => candidate.id === id);
  if (!source) throw new Error(`UNKNOWN_RBL_LOMA_SOURCE:${id}`);
  return source;
}
