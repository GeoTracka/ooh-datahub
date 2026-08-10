export const OPEN_ENRICHMENT_REGISTRY_VERSION = "open-enrichment-registry-v1";

export type AcquisitionMode = "snapshot" | "daily" | "monthly" | "api";
export type CommercialUseStatus = "permitted" | "restricted" | "unknown";
export type ReleaseDiscovery =
  | "content_pinned"
  | "latest_snapshot_then_pin"
  | "calendar_release_then_pin"
  | "api_revision_then_pin";

export type EnrichmentFeatureFamily =
  | "airport_reference"
  | "inventory_candidate"
  | "road_network_context"
  | "destination_context"
  | "resident_population_context"
  | "demographic_context"
  | "accessibility_context"
  | "settlement_morphology"
  | "built_form_context"
  | "night_activity_context"
  | "administrative_context"
  | "toponym_context"
  | "terrain_context"
  | "land_cover_context";

export type OpenEnrichmentSource = {
  id: string;
  title: string;
  acquisitionMode: AcquisitionMode;
  releaseDiscovery: ReleaseDiscovery;
  canonicalAccessUri: string;
  documentationUri: string;
  licenseId: string;
  attributionText: string;
  shareAlike: boolean;
  commercialUseStatus: CommercialUseStatus;
  requiresCredential: boolean;
  productionEnabled: boolean;
  featureLevelLicense: boolean;
  allowedFeatureFamilies: readonly EnrichmentFeatureFamily[];
  notes: string;
};

const registry = {
  "ourairports-airports": {
    id: "ourairports-airports",
    title: "OurAirports airports.csv",
    acquisitionMode: "daily",
    releaseDiscovery: "latest_snapshot_then_pin",
    canonicalAccessUri: "https://davidmegginson.github.io/ourairports-data/airports.csv",
    documentationUri: "https://ourairports.com/data/",
    licenseId: "Public-Domain",
    attributionText: "OurAirports (public-domain airport data)",
    shareAlike: false,
    commercialUseStatus: "permitted",
    requiresCredential: false,
    productionEnabled: true,
    featureLevelLicense: false,
    allowedFeatureFamilies: ["airport_reference"],
    notes: "Nightly public-domain CSV. Pin exact bytes by SHA-256 before normalization.",
  },
  "osm-geofabrik-nigeria": {
    id: "osm-geofabrik-nigeria",
    title: "OpenStreetMap Nigeria via Geofabrik",
    acquisitionMode: "daily",
    releaseDiscovery: "latest_snapshot_then_pin",
    canonicalAccessUri: "https://download.geofabrik.de/africa/nigeria-latest.osm.pbf",
    documentationUri: "https://download.geofabrik.de/africa/nigeria.html",
    licenseId: "ODbL-1.0",
    attributionText: "© OpenStreetMap contributors",
    shareAlike: true,
    commercialUseStatus: "permitted",
    requiresCredential: false,
    productionEnabled: true,
    featureLevelLicense: false,
    allowedFeatureFamilies: ["inventory_candidate", "road_network_context", "destination_context", "toponym_context"],
    notes: "Land the PBF once, then reduce locally with osmium. Do not use public Overpass as a bulk ingestion dependency.",
  },
  "overture-places": {
    id: "overture-places",
    title: "Overture Maps Places",
    acquisitionMode: "snapshot",
    releaseDiscovery: "calendar_release_then_pin",
    canonicalAccessUri: "s3://overturemaps-us-west-2/release/",
    documentationUri: "https://docs.overturemaps.org/guides/places/",
    licenseId: "MULTI-SOURCE-FEATURE-LEVEL",
    attributionText: "Overture Maps Foundation and feature-level upstream sources",
    shareAlike: true,
    commercialUseStatus: "permitted",
    requiresCredential: false,
    productionEnabled: true,
    featureLevelLicense: true,
    allowedFeatureFamilies: ["destination_context", "toponym_context"],
    notes: "Preserve every feature's sources/license array. Artifact-level metadata must not erase upstream license obligations.",
  },
  "overture-transportation": {
    id: "overture-transportation",
    title: "Overture Maps Transportation",
    acquisitionMode: "snapshot",
    releaseDiscovery: "calendar_release_then_pin",
    canonicalAccessUri: "s3://overturemaps-us-west-2/release/",
    documentationUri: "https://docs.overturemaps.org/guides/transportation/",
    licenseId: "ODbL-1.0",
    attributionText: "Overture Maps Foundation and OpenStreetMap contributors where applicable",
    shareAlike: true,
    commercialUseStatus: "permitted",
    requiresCredential: false,
    productionEnabled: true,
    featureLevelLicense: true,
    allowedFeatureFamilies: ["road_network_context", "accessibility_context"],
    notes: "Use network attributes as prominence/accessibility proxies, never as observed traffic volume.",
  },
  "overture-buildings": {
    id: "overture-buildings",
    title: "Overture Maps Buildings",
    acquisitionMode: "snapshot",
    releaseDiscovery: "calendar_release_then_pin",
    canonicalAccessUri: "s3://overturemaps-us-west-2/release/",
    documentationUri: "https://docs.overturemaps.org/guides/buildings/",
    licenseId: "ODbL-1.0",
    attributionText: "Overture Maps Foundation and upstream building sources",
    shareAlike: true,
    commercialUseStatus: "permitted",
    requiresCredential: false,
    productionEnabled: true,
    featureLevelLicense: true,
    allowedFeatureFamilies: ["built_form_context"],
    notes: "Retain source-level provenance; do not anonymously merge raw building databases across licenses.",
  },
  "grid3-nigeria-population": {
    id: "grid3-nigeria-population",
    title: "GRID3 Nigeria gridded population",
    acquisitionMode: "snapshot",
    releaseDiscovery: "latest_snapshot_then_pin",
    canonicalAccessUri: "https://data.grid3.org/",
    documentationUri: "https://grid3.org/",
    licenseId: "PRODUCT-SPECIFIC-REVIEW-REQUIRED",
    attributionText: "GRID3 / source partners; use exact product attribution from landed release metadata",
    shareAlike: true,
    commercialUseStatus: "permitted",
    requiresCredential: false,
    productionEnabled: true,
    featureLevelLicense: false,
    allowedFeatureFamilies: ["resident_population_context"],
    notes: "Pin the exact Nigeria product/release and its license at landing time; never inherit a license from another GRID3 layer.",
  },
  "grid3-nigeria-friction": {
    id: "grid3-nigeria-friction",
    title: "GRID3 Nigeria travel-time friction",
    acquisitionMode: "snapshot",
    releaseDiscovery: "latest_snapshot_then_pin",
    canonicalAccessUri: "https://data.grid3.org/",
    documentationUri: "https://grid3.org/",
    licenseId: "CC-BY-SA-4.0",
    attributionText: "GRID3 Nigeria travel-time friction surface",
    shareAlike: true,
    commercialUseStatus: "permitted",
    requiresCredential: false,
    productionEnabled: true,
    featureLevelLicense: false,
    allowedFeatureFamilies: ["accessibility_context"],
    notes: "Use modelled walking/mixed travel-time as accessibility context, not observed journeys or footfall.",
  },
  "grid3-nigeria-settlements": {
    id: "grid3-nigeria-settlements",
    title: "GRID3 Nigeria settlement extents and morphology",
    acquisitionMode: "snapshot",
    releaseDiscovery: "latest_snapshot_then_pin",
    canonicalAccessUri: "https://data.grid3.org/",
    documentationUri: "https://grid3.org/",
    licenseId: "CC-BY-SA-4.0",
    attributionText: "GRID3 Nigeria settlement extents",
    shareAlike: true,
    commercialUseStatus: "permitted",
    requiresCredential: false,
    productionEnabled: true,
    featureLevelLicense: false,
    allowedFeatureFamilies: ["settlement_morphology", "administrative_context"],
    notes: "Operational morphology context; retain release limitations and validation status in artifact metadata.",
  },
  "grid3-nigeria-roads": {
    id: "grid3-nigeria-roads",
    title: "GRID3 Nigeria roads",
    acquisitionMode: "snapshot",
    releaseDiscovery: "latest_snapshot_then_pin",
    canonicalAccessUri: "https://data.grid3.org/",
    documentationUri: "https://grid3.org/",
    licenseId: "CC-BY-SA-4.0",
    attributionText: "GRID3 Nigeria roads",
    shareAlike: true,
    commercialUseStatus: "permitted",
    requiresCredential: false,
    productionEnabled: true,
    featureLevelLicense: false,
    allowedFeatureFamilies: ["road_network_context", "accessibility_context"],
    notes: "Independent Nigeria-focused road context/fallback; avoid duplicating Overture raw storage where one source suffices.",
  },
  "worldpop-nigeria-age-sex": {
    id: "worldpop-nigeria-age-sex",
    title: "WorldPop Nigeria age/sex population grids",
    acquisitionMode: "snapshot",
    releaseDiscovery: "latest_snapshot_then_pin",
    canonicalAccessUri: "https://hub.worldpop.org/",
    documentationUri: "https://www.worldpop.org/datacatalog/",
    licenseId: "PRODUCT-SPECIFIC-CC-BY-OR-ODbL",
    attributionText: "WorldPop, University of Southampton; retain exact product citation/license",
    shareAlike: true,
    commercialUseStatus: "permitted",
    requiresCredential: false,
    productionEnabled: true,
    featureLevelLicense: false,
    allowedFeatureFamilies: ["resident_population_context", "demographic_context"],
    notes: "Use as demographic composition context; inspect the exact product's license because OSM-derived products may be ODbL.",
  },
  "viirs-nightlights-monthly": {
    id: "viirs-nightlights-monthly",
    title: "VIIRS monthly nighttime lights",
    acquisitionMode: "monthly",
    releaseDiscovery: "latest_snapshot_then_pin",
    canonicalAccessUri: "https://eogdata.mines.edu/products/vnl/",
    documentationUri: "https://developers.google.com/earth-engine/datasets/catalog/NOAA_VIIRS_DNB_MONTHLY_V1_VCMSLCFG",
    licenseId: "US-GOVERNMENT-DATA",
    attributionText: "Earth Observation Group / NOAA VIIRS nighttime lights",
    shareAlike: false,
    commercialUseStatus: "permitted",
    requiresCredential: false,
    productionEnabled: true,
    featureLevelLicense: false,
    allowedFeatureFamilies: ["night_activity_context"],
    notes: "Always retain cloud-free observation coverage; zero radiance without coverage is not evidence of darkness.",
  },
  "google-open-buildings-temporal": {
    id: "google-open-buildings-temporal",
    title: "Google Open Buildings Temporal",
    acquisitionMode: "snapshot",
    releaseDiscovery: "content_pinned",
    canonicalAccessUri: "https://sites.research.google/gr/open-buildings/temporal/",
    documentationUri: "https://developers.google.com/earth-engine/datasets/catalog/GOOGLE_Research_open-buildings-temporal_v1",
    licenseId: "CC-BY-4.0-SELECTED",
    attributionText: "Google Research Open Buildings Temporal",
    shareAlike: false,
    commercialUseStatus: "permitted",
    requiresCredential: false,
    productionEnabled: true,
    featureLevelLicense: false,
    allowedFeatureFamilies: ["built_form_context", "settlement_morphology"],
    notes: "Use building presence/count/height and temporal growth as morphology context, not occupancy or audience truth.",
  },
  "nigeria-hfr-api": {
    id: "nigeria-hfr-api",
    title: "Nigeria Federal Health Facility Registry API",
    acquisitionMode: "api",
    releaseDiscovery: "api_revision_then_pin",
    canonicalAccessUri: "https://hfr.health.gov.ng/",
    documentationUri: "https://hfr.health.gov.ng/",
    licenseId: "TERMS-REVIEW-REQUIRED",
    attributionText: "Federal Ministry of Health and Social Welfare, Nigeria",
    shareAlike: false,
    commercialUseStatus: "unknown",
    requiresCredential: true,
    productionEnabled: false,
    featureLevelLicense: false,
    allowedFeatureFamilies: ["destination_context"],
    notes: "Authoritative health anchor once API access and commercial reuse terms are explicitly approved.",
  },
  "ookla-speedtest-research-only": {
    id: "ookla-speedtest-research-only",
    title: "Ookla Speedtest open performance tiles",
    acquisitionMode: "snapshot",
    releaseDiscovery: "latest_snapshot_then_pin",
    canonicalAccessUri: "s3://ookla-open-data/",
    documentationUri: "https://github.com/teamookla/ookla-open-data",
    licenseId: "CC-BY-NC-SA-4.0",
    attributionText: "Ookla for Good open data",
    shareAlike: true,
    commercialUseStatus: "restricted",
    requiresCredential: false,
    productionEnabled: false,
    featureLevelLicense: false,
    allowedFeatureFamilies: [],
    notes: "Research/validation only. Do not make a commercial production planner dependent on this dataset.",
  },
} as const satisfies Record<string, OpenEnrichmentSource>;

export type OpenEnrichmentSourceId = keyof typeof registry;

export function enrichmentSource(sourceId: string): OpenEnrichmentSource {
  const source = (registry as Record<string, OpenEnrichmentSource>)[sourceId];
  if (!source) throw new Error(`UNKNOWN_ENRICHMENT_SOURCE:${sourceId}`);
  return source;
}

export function productionEnrichmentSource(sourceId: string): OpenEnrichmentSource {
  const source = enrichmentSource(sourceId);
  if (!source.productionEnabled) throw new Error(`ENRICHMENT_SOURCE_NOT_PRODUCTION_ENABLED:${sourceId}`);
  if (source.commercialUseStatus !== "permitted") {
    throw new Error(`ENRICHMENT_COMMERCIAL_USE_NOT_APPROVED:${sourceId}`);
  }
  return source;
}

export function allEnrichmentSources(): readonly OpenEnrichmentSource[] {
  return Object.values(registry);
}
