import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChatWorkspaceShell } from "@/features/chat/ChatWorkspaceShell";
import { DownloadCard } from "@/features/chat/DownloadCard";
import type { DownloadDescriptor } from "@/server/chat/contracts";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const download: DownloadDescriptor = {
  artifactId: "11111111-1111-4111-8111-111111111111",
  revision: 2,
  reportKind: "campaign_plan",
  title: "Everyday essentials campaign plan",
  filename: "everyday-essentials-campaign-plan-r2",
  formats: ["xlsx", "csv"],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("inline report downloads", () => {
  it("offers descriptive XLSX and CSV links for the exact revision", () => {
    render(<DownloadCard download={download} />);

    expect(
      screen.getByRole("heading", { name: "Everyday essentials campaign plan" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Campaign plan · Revision 2")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Download XLSX" })).toHaveAttribute(
      "href",
      "/api/artifacts/11111111-1111-4111-8111-111111111111/export?revision=2&format=xlsx",
    );
    expect(screen.getByRole("link", { name: "Download CSV" })).toHaveAttribute(
      "href",
      "/api/artifacts/11111111-1111-4111-8111-111111111111/export?revision=2&format=csv",
    );
  });

  it("renders a persisted download reference after a thread is reopened", () => {
    render(
      <ChatWorkspaceShell
        currentUser={{
          id: "22222222-2222-4222-8222-222222222222",
          email: "planner@example.com",
          displayName: "Planner",
        }}
        initialThreads={[]}
        initialThread={null}
        initialMessages={[
          {
            id: "message-1",
            role: "assistant",
            content: [{ type: "download_ref", ...download }],
          },
        ]}
        initialArtifacts={[]}
      />,
    );

    expect(screen.getByRole("link", { name: "Download XLSX" })).toBeVisible();
  });

  it("turns a live download event into a durable message card", async () => {
    const encoder = new TextEncoder();
    const ndjson = [
      { type: "response.started", messageId: "assistant-1" },
      { type: "download.ready", download },
      { type: "text.delta", delta: "Your report is ready." },
      { type: "response.completed", messageId: "assistant-1", suggestedActions: [] },
    ]
      .map((event) => JSON.stringify(event))
      .join("\n") + "\n";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(encoder.encode(ndjson));
              controller.close();
            },
          }),
          { status: 200 },
        ),
      ),
    );

    render(
      <ChatWorkspaceShell
        currentUser={{
          id: "22222222-2222-4222-8222-222222222222",
          email: "planner@example.com",
          displayName: "Planner",
        }}
        initialThreads={[
          {
            id: "33333333-3333-4333-8333-333333333333",
            ownerId: "22222222-2222-4222-8222-222222222222",
            title: "Campaign plan",
            status: "active",
            createdAt: new Date("2026-09-03T12:00:00Z"),
            updatedAt: new Date("2026-09-03T12:00:00Z"),
          },
        ]}
        initialThread={{
          id: "33333333-3333-4333-8333-333333333333",
          ownerId: "22222222-2222-4222-8222-222222222222",
          title: "Campaign plan",
          status: "active",
          createdAt: new Date("2026-09-03T12:00:00Z"),
          updatedAt: new Date("2026-09-03T12:00:00Z"),
        }}
        initialMessages={[]}
        initialArtifacts={[]}
      />,
    );
    await userEvent.type(
      screen.getByLabelText("Describe your campaign"),
      "Export this plan as XLSX",
    );
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("Your report is ready.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Download XLSX" })).toBeVisible();
  });
});
