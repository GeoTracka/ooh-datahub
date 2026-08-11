import type { PlanningResult } from "@/contracts/domain";

export type PlannerState = {
  originalPlan: PlanningResult | null;
  appliedPlan: PlanningResult | null;
  draftPlan: PlanningResult | null;
  packagePreviewBasePlan: PlanningResult | null;
  packagePreviewActive: boolean;
  draftHistory: PlanningResult[];
  lastAction: string | null;
  status: "brief" | "loaded" | "dirty" | "rfq";
};

export const initialPlannerState: PlannerState = {
  originalPlan: null,
  appliedPlan: null,
  draftPlan: null,
  packagePreviewBasePlan: null,
  packagePreviewActive: false,
  draftHistory: [],
  lastAction: null,
  status: "brief",
};

export type PlannerAction =
  | { type: "loaded"; plan: PlanningResult }
  | { type: "package-previewed"; plan: PlanningResult | null }
  | { type: "drafted"; plan: PlanningResult; reason?: string }
  | { type: "undo" }
  | { type: "reset" }
  | { type: "applied" }
  | { type: "review-rfq" }
  | { type: "apply-and-review-rfq" }
  | { type: "close-rfq" }
  | { type: "close-rfq-with-draft"; plan: PlanningResult };

export function plannerReducer(
  state: PlannerState,
  action: PlannerAction,
): PlannerState {
  switch (action.type) {
    case "loaded":
      return {
        originalPlan: action.plan,
        appliedPlan: action.plan,
        draftPlan: null,
        packagePreviewBasePlan: null,
        packagePreviewActive: false,
        draftHistory: [],
        lastAction: null,
        status: "loaded",
      };
    case "package-previewed":
      if (!action.plan) {
        const restored = state.packagePreviewBasePlan;
        return {
          ...state,
          draftPlan: restored,
          packagePreviewBasePlan: null,
          packagePreviewActive: false,
          lastAction: restored ? "Plan adjustment" : null,
          status: restored ? "dirty" : "loaded",
        };
      }
      return {
        ...state,
        draftPlan: action.plan,
        packagePreviewBasePlan: state.packagePreviewActive
          ? state.packagePreviewBasePlan
          : state.draftPlan,
        packagePreviewActive: true,
        draftHistory: state.draftHistory,
        lastAction: "Package option selected",
        status: "dirty",
      };
    case "drafted":
      return {
        ...state,
        draftHistory: state.draftPlan
          ? [...state.draftHistory, state.draftPlan]
          : state.draftHistory,
        draftPlan: action.plan,
        packagePreviewBasePlan: null,
        packagePreviewActive: false,
        lastAction: action.reason ?? "Plan adjustment",
        status: "dirty",
      };
    case "undo": {
      const previous = state.draftHistory.at(-1) ?? null;
      return {
        ...state,
        draftPlan: previous,
        packagePreviewBasePlan: null,
        packagePreviewActive: false,
        draftHistory: previous ? state.draftHistory.slice(0, -1) : [],
        lastAction: previous ? "Undo adjustment" : null,
        status: previous ? "dirty" : "loaded",
      };
    }
    case "reset": {
      if (!state.originalPlan || !state.appliedPlan) return state;
      const appliedIsOriginal = state.appliedPlan === state.originalPlan;
      return {
        ...state,
        draftPlan: appliedIsOriginal ? null : state.originalPlan,
        packagePreviewBasePlan: null,
        packagePreviewActive: false,
        draftHistory: [],
        lastAction: appliedIsOriginal ? null : "Reset to original recommendation",
        status: appliedIsOriginal ? "loaded" : "dirty",
      };
    }
    case "applied":
      if (!state.draftPlan) return state;
      if (!state.draftPlan.recommended.valid) throw new Error("PACKAGE_INVALID");
      return {
        ...state,
        appliedPlan: state.draftPlan,
        draftPlan: null,
        packagePreviewBasePlan: null,
        packagePreviewActive: false,
        draftHistory: [],
        lastAction: null,
        status: "loaded",
      };
    case "review-rfq":
      if (!state.appliedPlan) throw new Error("NO_APPLIED_PLAN");
      if (state.draftPlan) throw new Error("APPLY_DRAFT_BEFORE_RFQ");
      if (!state.appliedPlan.recommended.valid) throw new Error("PACKAGE_INVALID");
      return { ...state, status: "rfq" };
    case "apply-and-review-rfq":
      if (!state.draftPlan) throw new Error("NO_DRAFT_PLAN");
      if (!state.draftPlan.recommended.valid) throw new Error("PACKAGE_INVALID");
      return {
        ...state,
        appliedPlan: state.draftPlan,
        draftPlan: null,
        packagePreviewBasePlan: null,
        packagePreviewActive: false,
        draftHistory: [],
        lastAction: null,
        status: "rfq",
      };
    case "close-rfq":
      return { ...state, status: "loaded" };
    case "close-rfq-with-draft":
      return {
        ...state,
        draftPlan: action.plan,
        packagePreviewBasePlan: null,
        packagePreviewActive: false,
        draftHistory: [],
        lastAction: "RFQ schedule changed",
        status: "dirty",
      };
  }
}
