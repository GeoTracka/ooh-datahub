import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ChatLoading from "@/app/chat/loading";

describe("chat route shell", () => {
  it("shows a meaningful loading state without fake progress", () => {
    render(<ChatLoading />);
    expect(screen.getByRole("status")).toHaveTextContent("Opening your planning workspace");
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });
});
