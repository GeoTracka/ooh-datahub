import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { frozenLagosBundle } from "@/bundle/loadFrozenBundle";
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
  it("gates generation, exposes isolated downloads, and resets after an edit", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const storageSpy = vi.spyOn(Storage.prototype, "setItem");
    render(<RfqDrawer
      plan={plan}
      onClose={() => undefined}
      onScheduleRevision={() => undefined}
    />);
    expect(screen.getByRole("button", { name: "Generate RFQ" })).toBeDisabled();
    await completeReview();
    await userEvent.click(screen.getByRole("button", { name: "Generate RFQ" }));
    expect(await screen.findByText("Generated", { exact: true })).toBeInTheDocument();
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

  it("locks reviewed fields and rejects re-entry while generation is active", async () => {
    let release: (() => void) | null = null;
    const generator = vi.fn((...args: Parameters<typeof generateRfq>) =>
      new Promise<ReturnType<typeof generateRfq>>((resolve) => {
        release = () => resolve(generateRfq(...args));
      }));
    render(<RfqDrawer
      plan={plan}
      generator={generator}
      onClose={() => undefined}
      onScheduleRevision={() => undefined}
    />);
    await completeReview();

    const generateButton = screen.getByRole("button", { name: "Generate RFQ" });
    await userEvent.dblClick(generateButton);

    expect(await screen.findByRole("status", { name: "Generating supplier request…" }))
      .toBeInTheDocument();
    expect(generator).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Buyer name")).toBeDisabled();
    expect(screen.getByLabelText("Buyer email")).toBeDisabled();
    expect(screen.getByLabelText("Response deadline")).toBeDisabled();
    expect(screen.getByLabelText("Dates confirmed")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Generating RFQ…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Close" })).toBeEnabled();

    release?.();
    expect(await screen.findByText("Generated", { exact: true })).toBeInTheDocument();
    expect(screen.getByLabelText("Buyer name")).toBeEnabled();
  });

  it("shows human recovery guidance without clearing reviewed fields", async () => {
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
    const alert = screen.getByRole("alert", { name: "RFQ generation failure" });
    expect(alert).toHaveTextContent("We couldn't generate the supplier request");
    expect(alert).toHaveTextContent("Your reviewed fields are still here");
    expect(alert.querySelector(".recovery-notice-copy")).not.toHaveTextContent(
      "FIXTURE_GENERATION_FAILURE",
    );
    expect(alert.querySelector("details")).toHaveTextContent("FIXTURE_GENERATION_FAILURE");
    expect(screen.getByRole("button", { name: "Retry RFQ generation" })).toBeEnabled();
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
