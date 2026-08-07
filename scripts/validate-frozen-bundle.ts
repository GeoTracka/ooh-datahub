import bundleJson from "../src/demo/lagos-v1/bundle.json";
import { validateFrozenBundle } from "../src/bundle/validateFrozenBundle";
import { canonicalJson } from "../src/shared/canonicalJson";

const bundle = validateFrozenBundle(bundleJson);
const roundTrip = canonicalJson(bundle) + "\n";
const checkedIn = canonicalJson(bundleJson) + "\n";
if (roundTrip !== checkedIn) throw new Error("BUNDLE_NOT_CANONICAL");
console.log("Validated " + bundle.manifest.id + " with " + bundle.sites.length + " sites");
