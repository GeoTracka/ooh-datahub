import type {
  ArtifactPayload,
  PlanArtifactPayload,
} from "@/server/artifacts/contracts";
import type { EvidenceAnswer } from "@/server/evidence/repository";
import type {
  CampaignReportData,
  EvidenceReportData,
} from "@/server/exports/contracts";

type ArtifactSnapshot<TPayload extends ArtifactPayload> = {
  id: string;
  revision: number;
  saveState: "draft" | "saved";
  payload: TPayload;
};

export function campaignReportData(
  artifact: ArtifactSnapshot<PlanArtifactPayload>,
): CampaignReportData {
  return {
    kind: "campaign_plan",
    title: `${artifact.payload.brief.productName} campaign plan`,
    artifactId: artifact.id,
    revision: artifact.revision,
    saveState: artifact.saveState,
    brief: artifact.payload.brief,
    selectedOptionId: artifact.payload.selectedOptionId,
    options: artifact.payload.options,
    assumptions: artifact.payload.assumptions,
    limitations: artifact.payload.limitations,
  };
}

export function evidenceReportData(
  artifact: ArtifactSnapshot<
    Extract<ArtifactPayload, { type: "evidence" }>
  >,
  answers: readonly EvidenceAnswer[],
): EvidenceReportData {
  const requested = new Set(artifact.payload.factIds);
  const byId = new Map(
    answers
      .filter((answer) => requested.has(answer.factId))
      .map((answer) => [answer.factId, answer]),
  );
  const facts = artifact.payload.factIds.map((factId) => {
    const answer = byId.get(factId);
    if (!answer) throw new Error(`EVIDENCE_EXPORT_INCOMPLETE:${factId}`);
    return answer;
  });
  return {
    kind: "evidence_report",
    title: "Outdoor audience evidence report",
    artifactId: artifact.id,
    revision: artifact.revision,
    facts,
    limitations: [
      "These are unweighted findings from the study sample, not population reach or media delivery.",
      "No respondent-level records are included in this report.",
    ],
  };
}
