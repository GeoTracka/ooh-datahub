import { notFound, redirect } from "next/navigation";

import { getCurrentArtifact } from "@/server/artifacts/service";
import { requireUser } from "@/server/auth/currentUser";
import { getOwnedThread, listMessages, listThreads } from "@/server/chat/service";
import { ChatWorkspaceShell } from "@/features/chat/ChatWorkspaceShell";

export const dynamic = "force-dynamic";

export default async function ChatThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const user = await requireUser().catch(() => null);
  if (!user) redirect("/login?next=/chat");
  const { threadId } = await params;
  const thread = await getOwnedThread(threadId, user.id).catch(() => null);
  if (!thread) notFound();
  const [threads, messages] = await Promise.all([
    listThreads(user.id),
    listMessages(threadId, user.id),
  ]);
  const refs = [...new Set(messages.flatMap((message) =>
    message.content.flatMap((block) =>
      block.type === "artifact_ref" ? [block.artifactId] : [],
    ),
  ))];
  const artifacts = (await Promise.all(
    refs.map((id) => getCurrentArtifact(id, user.id).catch(() => null)),
  )).filter((artifact) => artifact !== null);
  return (
    <ChatWorkspaceShell
      currentUser={user}
      initialThreads={threads}
      initialThread={thread}
      initialMessages={messages}
      initialArtifacts={artifacts}
    />
  );
}
