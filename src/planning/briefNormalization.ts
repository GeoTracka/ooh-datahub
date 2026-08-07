import type { FrozenBundle } from "@/bundle/bundleSchema";
import type { Brief, Sector } from "@/contracts/domain";

export type ResolvedBriefAudience = {
  mode: "focused" | "sector_preset";
  cellIds: string[];
  label: string;
  matchedSignals: string[];
};

type Rule = {
  cellId: string;
  label: string;
  keywords: string[];
};

const rules: Record<Sector, Rule[]> = {
  fmcg: [
    {
      cellId: "student_buyers_18_24",
      label: "Students / young buyers",
      keywords: ["student", "students", "campus", "university", "youth", "young buyer", "young workers"],
    },
    {
      cellId: "household_nonstudent_buyers_25_44",
      label: "Household buyers 25–44",
      keywords: ["household", "family", "families", "parents", "parent", "home shoppers", "home buyers"],
    },
    {
      cellId: "residual_convenience_nonstudent_nonhousehold",
      label: "Convenience / general buyers",
      keywords: ["convenience", "on-the-go", "mass market", "general consumers", "shoppers"],
    },
  ],
  real_estate: [
    {
      cellId: "diaspora_intenders",
      label: "Diaspora property intenders",
      keywords: ["diaspora", "overseas", "abroad", "expatriate"],
    },
    {
      cellId: "resident_professional_intenders",
      label: "Resident professional intenders",
      keywords: ["professional", "professionals", "executive", "executives", "salaried", "corporate"],
    },
    {
      cellId: "resident_nonprofessional_investors",
      label: "Resident property investors",
      keywords: ["investor", "investors", "investment", "landlord", "landlords"],
    },
  ],
  bank_fintech: [
    {
      cellId: "merchant_owner_users",
      label: "Merchant / business users",
      keywords: ["merchant", "merchants", "business owner", "business owners", "sme", "retailer", "retailers"],
    },
    {
      cellId: "student_nonmerchant_users",
      label: "Student / young users",
      keywords: ["student", "students", "campus", "university", "youth", "young users"],
    },
    {
      cellId: "professional_nonmerchant_nonstudent_users",
      label: "Professional users",
      keywords: ["professional", "professionals", "salary", "salaried", "executive", "corporate", "urban professionals"],
    },
  ],
};

function normalize(value: string): string {
  return value.toLocaleLowerCase("en").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

export function resolveBriefAudience(
  bundle: FrozenBundle,
  brief: Pick<Brief, "sector" | "targetAudience" | "productDescription">,
): ResolvedBriefAudience {
  const sectorTargets = bundle.targets.filter((target) => target.sector === brief.sector);
  const allCellIds = sectorTargets.map((target) => target.cellId).sort();
  const text = normalize(brief.targetAudience + " " + brief.productDescription);
  const matched = rules[brief.sector].filter((rule) =>
    rule.keywords.some((keyword) => text.includes(normalize(keyword))),
  );

  // A single strong signal is intentionally actionable. Multiple signals retain
  // the broad sector preset so existing mixed-audience demo briefs stay stable.
  if (matched.length === 1 && allCellIds.includes(matched[0].cellId)) {
    return {
      mode: "focused",
      cellIds: [matched[0].cellId],
      label: matched[0].label,
      matchedSignals: matched[0].keywords.filter((keyword) => text.includes(normalize(keyword))),
    };
  }

  return {
    mode: "sector_preset",
    cellIds: allCellIds,
    label: brief.sector === "fmcg"
      ? "FMCG sector audience preset"
      : brief.sector === "real_estate"
        ? "Real Estate sector audience preset"
        : "Bank / Fintech sector audience preset",
    matchedSignals: matched.flatMap((rule) =>
      rule.keywords.filter((keyword) => text.includes(normalize(keyword))),
    ),
  };
}

export function applyResolvedAudience(
  bundle: FrozenBundle,
  sector: Sector,
  audience: ResolvedBriefAudience,
): FrozenBundle {
  const currentCellIds = bundle.targets
    .filter((target) => target.sector === sector)
    .map((target) => target.cellId)
    .sort();
  if (currentCellIds.join("|") === [...audience.cellIds].sort().join("|")) {
    return bundle;
  }

  const selected = new Set(audience.cellIds);
  return {
    ...bundle,
    targets: bundle.targets.filter(
      (target) => target.sector !== sector || selected.has(target.cellId),
    ),
    panel: bundle.panel.filter(
      (member) => member.sector !== sector || selected.has(member.cellId),
    ),
    sites: bundle.sites.map((site) => ({
      ...site,
      targetShareBySector: {
        ...site.targetShareBySector,
        [sector]: Object.fromEntries(
          Object.entries(site.targetShareBySector[sector]).filter(([cellId]) => selected.has(cellId)),
        ),
      },
    })),
  };
}
