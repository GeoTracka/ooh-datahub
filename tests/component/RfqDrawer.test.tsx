import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RfqDrawer } from "@/features/RfqDrawer";
import { generateRfq } from "@/planning/rfq";
import { seededFmcgPlan as plan } from "../fixtures/seededPlans";

async function completeReview() {
  await userEvent.type(screen.getByLabelText("Buyer name"), "Demo Buyer");
  await userEvent.type(screen.getByLabelText("Buyer email"), "buyer@example.test");
  await userEvent.type(screen.getByLabelText("Response deadline"), "2026-08-20");
  await userEvent.click(screen.getByLabelText("Dates confirmed"));
}

afterEach(() => vi.restoreAllMocks());

describe("RfqDrawer", () => {
  it("explains what blocks generation, then exposes isolated readable requests", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const storageSpy = vi.spyOn(Storage.prototype, "setItem");
    render(<RfqDrawer
      plan={plan}
      onClose={() => undefined}
      onScheduleRevision={() => undefined}
    />);
    expect(screen.getByRole("button", { name: "Generate RFQ" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Add the buyer name");
    expect(screen.getByRole("region", { name: "RFQ package summary" }))
      .toHaveTextContent(`${plan.recommended.siteIds.length} sites`);

    await completeReview();
    expect(screen.queryByText(/Before generating:/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Generate RFQ" }));
    expect(await screen.findByText("Generated", { exact: true })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Generated supplier requests" }))
      .toHaveTextContent("Nothing is sent or booked by this demo");
    expect(screen.getAllByRole("button", { name: /^Copy .* request$/ }).length)
      .toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /^Download .* request$/ }).length)
      .toBeGreaterThan(0);
    expect(screen.getByRole("button", {
      name: "Download consolidated internal request",
    })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /send|book|reserve/i }))
      .not.toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(storageSpy).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText("Buyer name"), " Updated");
    expect(screen.getByText("Review required", { exact: true })).toBeInTheDocument();
  });

  it("shows observable generation failure without clearing reviewed fields", async () => {
    const failing: typeof generateRfq = () => {
      throw new Error("FIXTURE_GENERATION_FAILURE");
    };
    render(<RfqDrawer
      plan={plan}
      generator={failing}
      onClose={() => undefined}
      onScheduleRevision={() => undefined}
    />);
    await completeReview();
    await userEvent.click(screen.getByRole("button", { name: "Generate RFQ" }));
    expect(await screen.findByText("Generation failed", { exact: true }))
      .toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("FIXTURE_GENERATION_FAILURE");
    expect(screen.getByLabelText("Buyer name")).toHaveValue("Demo Buyer");
    expect(screen.getByLabelText("Buyer email")).toHaveValue("buyer@example.test");
    expect(screen.getByLabelText("Response deadline")).toHaveValue("2026-08-20");
    expect(screen.getByLabelText("Dates confirmed")).toBeChecked();
  });

  it("routes changed dates into a recomputed plan revision and supports Escape", async () => {
    const onScheduleRevision = vi.fn();
    const onClose = vi.fn();
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    const rendered = render(<RfqDrawer
      plan={plan}
      onClose={onClose}
      onScheduleRevision={onScheduleRevision}
    />);
    await userEvent.clear(screen.getByLabelText("Flight start"));
    await userEvent.type(screen.getByLabelText("Flight start"), "2026-09-08");
    expect(screen.getByRole("button", { name: "Generate RFQ" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Recompute the plan");
    await userEvent.click(screen.getByRole("button", {
      name: "Recompute plan with these dates",
    }));
    expect(onScheduleRevision).toHaveBeenCalledWith("2026-09-08", "2026-09-28");
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
    rendered.unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });
});
