import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LoginForm } from "@/features/chat/LoginForm";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  replace.mockReset();
});

describe("LoginForm", () => {
  it("labels inputs and reports invalid credentials without exposing internals", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "INVALID_CREDENTIALS" }), {
          status: 401,
        }),
      ),
    );
    render(<LoginForm />);
    await userEvent.type(
      screen.getByLabelText("Email"),
      "planner@example.com",
    );
    await userEvent.type(screen.getByLabelText("Password"), "wrong password");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Email or password is incorrect",
    );
  });

  it("offers an accessible password visibility control", async () => {
    render(<LoginForm />);
    const password = screen.getByLabelText("Password");
    expect(password).toHaveAttribute("type", "password");
    await userEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
  });

  it("opens the chat workspace after a successful sign-in", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText("Email"), "planner@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "correct password");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(replace).toHaveBeenCalledWith("/chat");
  });
});
