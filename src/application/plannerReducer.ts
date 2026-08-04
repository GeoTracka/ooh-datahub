import type { PlanningResult } from "@/contracts/domain";

export type PlannerState = {
  originalPlan: PlanningResult | null;
  appliedPlan: PlanningResult | null;
  draftPlan: PlanningResult | null;
  draftHistory: PlanningResult[];
  lastAction: string | null;
  status: "brief" | "loaded" | "dirty" | "rfq";
};

export const initialPlannerState: PlannerState = {
  originalPlan: null,
  appliedPlan: null,
  draftPlan: null,
  draftHistory: [],
  lastAction: null,
  status: "brief",
};

export type PlannerAction =
  | { type: "loaded"; plan: PlanningResult }
  | { type: "drafted"; plan: PlanningResult; reason?: string }
  | { type: "undo" }
  | { type: "reset" }
  | { type: "applied" }
  | { type: "review-rfq" };

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
        draftHistory: [],
        lastAction: null,
        status: "loaded",
      };
    case "drafted":
      return {
        ...state,
        draftHistory: state.draftPlan
          ? [...state.draftHistory, state.draftPlan]
          : state.draftHistory,
        draftPlan: action.plan,
        lastAction: action.reason ?? "Plan adjustment",
        status: "dirty",
      };
    case "undo": {
      const previous = state.draftHistory.at(-1) ?? null;
      return {
        ...state,
        draftPlan: previous,
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
        draftHistory: [],
        lastAction: null,
        status: "loaded",
      };
    case "review-rfq":
      if (!state.appliedPlan) throw new Error("NO_APPLIED_PLAN");
      return { ...state, status: "rfq" };
  }
}
