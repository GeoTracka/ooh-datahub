import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ChatHomePage from "@/app/chat/page";

const { requireUser, listThreads } = vi.hoisted(() => ({ requireUser: vi.fn(), listThreads: vi.fn() }));
vi.mock("@/server/auth/currentUser", () => ({ requireUser, UnauthenticatedError: class extends Error {} }));
vi.mock("@/server/chat/service", () => ({ listThreads }));
vi.mock("next/navigation", () => ({ redirect: () => { throw new Error("redirect"); } }));
vi.mock("@/features/chat/ChatWorkspaceShell", () => ({ ChatWorkspaceShell: ({ currentUser }: { currentUser: unknown }) => <div>{currentUser ? "Private chat" : "Guest chat"}</div> }));
import { UnauthenticatedError } from "@/server/auth/currentUser";

beforeEach(() => vi.clearAllMocks());
describe("chat homepage access", () => {
  it("renders guest chat without reading any private conversations", async () => {
    requireUser.mockRejectedValue(new UnauthenticatedError());
    render(await ChatHomePage());
    expect(screen.getByText("Guest chat")).toBeInTheDocument();
    expect(listThreads).not.toHaveBeenCalled();
  });
  it("loads only the signed-in user's threads", async () => {
    requireUser.mockResolvedValue({ id: "u1" }); listThreads.mockResolvedValue([]);
    render(await ChatHomePage());
    expect(listThreads).toHaveBeenCalledWith("u1");
  });
  it("does not silently turn database failures into a guest session", async () => {
    requireUser.mockRejectedValue(new Error("DB unavailable"));
    await expect(ChatHomePage()).rejects.toThrow("DB unavailable");
  });
});
