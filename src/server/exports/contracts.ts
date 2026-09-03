import type { Brief, PackageCandidate } from "@/contracts/domain";
import type { EvidenceAnswer } from "@/server/evidence/repository";

export type CampaignReportData = {
  kind: "campaign_plan";
  title: string;
  artifactId: string;
  revision: number;
  saveState: "draft" | "saved";
  brief: Brief;
  selectedOptionId: string | null;
  options: Array<{
    id: string;
    style: "best_overall" | "maximum_delivery" | "budget_smart";
    title: "Balanced plan" | "Highest delivery" | "Budget-smart plan";
    candidate: PackageCandidate;
    tradeoffs: string[];
  }>;
  assumptions: string[];
  limitations: string[];
};

export type EvidenceReportData = {
  kind: "evidence_report";
  title: string;
  artifactId: string;
  revision: number;
  facts: EvidenceAnswer[];
  limitations: string[];
};

export type ReportData = CampaignReportData | EvidenceReportData;
