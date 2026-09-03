import { requireUser, UnauthenticatedError } from "@/server/auth/currentUser";
import { listThreads } from "@/server/chat/service";
import { ChatWorkspaceShell } from "@/features/chat/ChatWorkspaceShell";

export const dynamic = "force-dynamic";

export default async function ChatHomePage() {
  const user = await requireUser().catch((error: unknown) => {
    if (error instanceof UnauthenticatedError) return null;
    throw error;
  });
  const threads = user ? await listThreads(user.id) : [];
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
