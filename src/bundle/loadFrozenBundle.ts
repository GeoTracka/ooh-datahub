import bundleJson from "@/demo/lagos-v1/bundle.json";
import { validateFrozenBundle } from "@/bundle/validateFrozenBundle";

export const frozenLagosBundle = validateFrozenBundle(bundleJson);
