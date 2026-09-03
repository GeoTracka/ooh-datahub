import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatWorkspaceShell } from "@/features/chat/ChatWorkspaceShell";
import type { WorkspaceArtifact } from "@/features/chat/contracts";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/features/chat/artifacts/CampaignPlanView", () => ({ CampaignPlanView: () => <div>Saved plan preview</div> }));

const props = {
  currentUser: { id: "user-1", email: "planner@example.com", displayName: "Planner" },
  initialThreads: [], initialThread: null, initialMessages: [], initialArtifacts: [],
};

beforeEach(() => { sessionStorage.clear(); vi.clearAllMocks(); });

describe("chat-first entry", () => {
  it("provides named manual navigation and a focused empty chat", () => {
    render(<ChatWorkspaceShell {...props} />);
    expect(within(screen.getByLabelText("Planning navigation")).getByRole("link", { name: "Plan manually" })).toHaveAttribute("href", "/planner");
    expect(screen.getByRole("main")).toHaveAttribute("data-has-results", "false");
    expect(screen.getByRole("textbox")).toBeEnabled();
  });

  it("starts with chat visible even when a saved plan exists", () => {
    const plan = { id: "plan-1", payload: { type: "plan", options: [] } } as unknown as WorkspaceArtifact;
    render(<ChatWorkspaceShell {...props} initialArtifacts={[plan]} />);
    expect(screen.getByRole("main")).toHaveAttribute("data-view", "chat");
    expect(screen.getByText("Saved plan preview")).toBeInTheDocument();
  });

  it("shows a guest composer and preserves the draft before sign-in without calling the API", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<ChatWorkspaceShell {...props} currentUser={null} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Plan a Lagos campaign" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("brainpad-chat-draft")).toBe("Plan a Lagos campaign");
    expect(push).toHaveBeenCalledWith("/login?next=/chat");
    fetchSpy.mockRestore();
  });

  it("restores the guest draft after sign-in without automatically sending it", async () => {
    sessionStorage.setItem("brainpad-chat-draft", "Plan a Lagos campaign");
    render(<ChatWorkspaceShell {...props} />);
    await waitFor(() => expect(screen.getByRole("textbox")).toHaveValue("Plan a Lagos campaign"));
    expect(sessionStorage.getItem("brainpad-chat-draft")).toBeNull();
  });

  it("offers manual planning in the small-screen menu", () => {
    render(<ChatWorkspaceShell {...props} />);
    const menu = screen.getByText("Menu").closest("details")!;
    fireEvent.click(screen.getByText("Menu"));
    expect(within(menu).getByRole("link", { name: "Plan manually" })).toHaveAttribute("href", "/planner");
  });

  it("clears the current conversation when starting a new chat", () => {
    render(<ChatWorkspaceShell {...props} initialMessages={[{ id: "m1", role: "user", content: [{ type: "text", text: "Old campaign" }] }]} />);
    fireEvent.click(screen.getAllByRole("button", { name: "New chat" })[0]);
    expect(screen.queryByText("Old campaign")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("does not hide chat when a referenced result has no available preview", () => {
    render(<ChatWorkspaceShell {...props} initialMessages={[{ id: "m1", role: "assistant", content: [{ type: "artifact_ref", artifactId: "audience-1", artifactType: "audience", revision: 1 }] }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Open audience revision 1" }));
    expect(screen.getByRole("main")).toHaveAttribute("data-view", "chat");
    expect(screen.getByRole("alert")).toHaveTextContent("preview");
  });

  it("preserves the current conversation when opening AI chat in another tab", () => {
    render(<ChatWorkspaceShell {...props} initialMessages={[{ id: "m1", role: "user", content: [{ type: "text", text: "Keep this campaign" }] }]} />);
    fireEvent.click(within(screen.getByLabelText("Planning navigation")).getByRole("link", { name: "AI chat" }), { ctrlKey: true });
    expect(screen.getByText("Keep this campaign")).toBeInTheDocument();
  });
});
