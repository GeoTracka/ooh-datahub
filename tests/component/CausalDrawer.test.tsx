import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { buildPlan } from "@/application/plannerService";
import { selectCausalDrawerViewModel } from "@/application/plannerSelectors";
import { frozenLagosBundle as bundle } from "@/bundle/loadFrozenBundle";
import type { DrawerTarget } from "@/contracts/renderer";
import { CausalDrawer } from "@/features/CausalDrawer";

const plan = buildPlan(bundle, {
  productName: "Demo Spark",
  productDescription: "Affordable on-the-go refreshment launch",
  targetAudience: "Students, young workers, and convenience shoppers",
  sector: "fmcg",
  objective: "broad_reach",
  daypart: "pm",
  budgetNgn: 18_000_000,
  normalizationBudgetNgn: 30_000_000,
  flightStart: "2026-09-01",
  flightEnd: "2026-09-28",
});

describe("CausalDrawer", () => {
  it("exposes a complete package → D pillar → zone → site → evidence route", () => {
    const packageView = selectCausalDrawerViewModel(bundle, plan, {
      kind: "package", metric: "reach",
    });
    const pillar = packageView.nextTargets.find(
      (target) => target.kind === "pillar" && target.id === "D",
    )!;
    const pillarView = selectCausalDrawerViewModel(bundle, plan, pillar);
    const zone = pillarView.nextTargets.find((target) => target.kind === "zone")!;
    const zoneView = selectCausalDrawerViewModel(bundle, plan, zone);
    const site = zoneView.nextTargets.find((target) => target.kind === "site")!;
    const siteView = selectCausalDrawerViewModel(bundle, plan, site);
    const evidence = siteView.nextTargets.find(
      (target) => target.kind === "evidence",
    )!;
    expect([packageView.target.kind, pillar.kind, zone.kind, site.kind, evidence.kind])
      .toEqual(["package", "pillar", "zone", "site", "evidence"]);
  });

  it("does not misrepresent non-delivery Planning Fit pillars as causal reach stages", () => {
    const target: DrawerTarget = { kind: "pillar", id: "E", metric: "reach" };
    const view = selectCausalDrawerViewModel(bundle, plan, target);
    render(<CausalDrawer
      measurement={view.measurement}
      target={target}
      entityLabel={view.label}
      scopeNote={view.scopeNote}
      activeStage="unique"
      ancestors={[{ kind: "package", metric: "reach" }]}
      nextTargets={view.nextTargets}
      sourceRecord={view.sourceRecord}
      onStage={() => undefined}
      onNavigate={() => undefined}
      onAncestor={() => undefined}
      onBack={() => undefined}
      onClose={() => undefined}
    />);
    expect(screen.getByRole("heading", { name: "Planning Fit · E pillar" }))
      .toBeInTheDocument();
    expect(screen.getByText(/Only D · Delivery enters/)).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Causal stages" }))
      .not.toBeInTheDocument();
    expect(screen.getByText("Relative economics")).toBeInTheDocument();
  });

  it("keeps two site identities and causal reruns distinct", () => {
    const [firstId, secondId] = plan.recommended.siteIds.filter((siteId, index, ids) =>
      index === ids.findIndex((candidate) =>
        bundle.sites.find((site) => site.id === candidate)?.zoneId ===
        bundle.sites.find((site) => site.id === siteId)?.zoneId
      )
    ).slice(0, 2);
    const first = selectCausalDrawerViewModel(bundle, plan, {
      kind: "site", id: firstId, metric: "reach",
    });
    const second = selectCausalDrawerViewModel(bundle, plan, {
      kind: "site", id: secondId, metric: "reach",
    });
    expect(first.target).not.toEqual(second.target);
    expect(first.measurement.fingerprint).not.toBe(second.measurement.fingerprint);
  });

  it("renders human stage meaning first and keeps technical sources under audit detail", async () => {
    const siteId = plan.recommended.siteIds[0];
    const target: DrawerTarget = { kind: "site", id: siteId, metric: "reach" };
    const view = selectCausalDrawerViewModel(bundle, plan, target);
    const onBack = vi.fn();
    const onClose = vi.fn();
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    const rendered = render(<CausalDrawer
      measurement={view.measurement}
      target={target}
      entityLabel={view.label}
      scopeNote={view.scopeNote}
      activeStage="location"
      ancestors={[{
        kind: "zone",
        id: bundle.sites.find((site) => site.id === siteId)!.zoneId,
        metric: "reach",
      }]}
      nextTargets={view.nextTargets}
      sourceRecord={view.sourceRecord}
      onStage={() => undefined}
      onNavigate={() => undefined}
      onAncestor={() => undefined}
      onBack={onBack}
      onClose={onClose}
    />);
    expect(screen.getByRole("heading", { name: /Reach ·/ })).toBeInTheDocument();
    expect(screen.getByText(/Starts with the exact selected site/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(siteId))).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByText("Audit / calculation details"));
    await userEvent.click(screen.getByText("Source IDs"));
    expect(screen.getAllByText("lagos-demo-synthetic-v1").length).toBeGreaterThan(0);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
    rendered.unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });
});
