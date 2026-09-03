import { notFound, redirect } from "next/navigation";

import { getCurrentArtifact } from "@/server/artifacts/service";
import { requireUser } from "@/server/auth/currentUser";
import { CampaignPlanView } from "@/features/chat/artifacts/CampaignPlanView";

export const dynamic = "force-dynamic";

export default async function PlanPage({ params }: { params: Promise<{ artifactId: string }> }) {
  const user = await requireUser().catch(() => null);
  if (!user) redirect("/login");
  const { artifactId } = await params;
  const artifact = await getCurrentArtifact(artifactId, user.id).catch(() => null);
  if (!artifact || artifact.payload.type !== "plan") notFound();
  const planArtifact = { ...artifact, payload: artifact.payload } as const;
  return (
    <main className="ai-workspace ai-plan-page">
      <CampaignPlanView artifact={planArtifact} />
    </main>
  );
}
