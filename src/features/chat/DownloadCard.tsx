import { Download, FileSpreadsheet, Table2 } from "lucide-react";

import type { DownloadDescriptor } from "@/server/chat/contracts";

function exportUrl(
  download: DownloadDescriptor,
  format: "xlsx" | "csv",
) {
  const artifactId = encodeURIComponent(download.artifactId);
  return `/api/artifacts/${artifactId}/export?revision=${download.revision}&format=${format}`;
}

export function DownloadCard({
  download,
}: {
  download: DownloadDescriptor;
}) {
  const kind = download.reportKind === "campaign_plan"
    ? "Campaign plan"
    : "Evidence report";
  return (
    <section className="ai-download-card" aria-label={`${download.title} downloads`}>
      <div className="ai-download-icon" aria-hidden="true">
        <FileSpreadsheet size={20} />
      </div>
      <div className="ai-download-copy">
        <span>Report ready</span>
        <h3>{download.title}</h3>
        <p>{kind} · Revision {download.revision}</p>
        <small>Built from this report reference. Access is checked again when downloaded.</small>
      </div>
      <div className="ai-download-actions">
        <a href={exportUrl(download, "xlsx")}>
          <Download size={15} aria-hidden="true" />
          Download XLSX
        </a>
        <a href={exportUrl(download, "csv")}>
          <Table2 size={15} aria-hidden="true" />
          Download CSV
        </a>
      </div>
    </section>
  );
}
