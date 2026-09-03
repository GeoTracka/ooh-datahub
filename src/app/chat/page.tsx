import { redirect } from "next/navigation";

import { requireUser } from "@/server/auth/currentUser";
import { listThreads } from "@/server/chat/service";
import { ChatWorkspaceShell } from "@/features/chat/ChatWorkspaceShell";

export const dynamic = "force-dynamic";

export default async function ChatHomePage() {
  const user = await requireUser().catch(() => null);
  if (!user) redirect("/login?next=/chat");
  const threads = await listThreads(user.id);
  return (
    <ChatWorkspaceShell
      currentUser={user}
      initialThreads={threads}
      initialThread={null}
      initialMessages={[]}
      initialArtifacts={[]}
    />
  );
}
