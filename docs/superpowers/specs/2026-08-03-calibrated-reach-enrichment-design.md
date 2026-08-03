# Calibrated Reach and Live Enrichment Design

**Status:** Approved design; ready for implementation-plan revision
**Date:** 2026-08-03
**Parent design:** [Map-First Promotion Wizard MVP Design](2026-08-02-map-first-promotion-wizard-design.md)
**Superseded plan:** [Promotion Wizard Demo MVP Implementation Plan](../plans/2026-08-03-promotion-wizard-demo-mvp.md)
**Primary sectors:** FMCG, Real Estate, Bank/Fintech
**Primary promise:** Turn a short campaign brief or uploaded inventory sheet into a visually navigable, evidence-labelled OOH recommendation and a supplier-verification RFQ draft that is ready for review.

## 1. Normative relationship

This document is the normative addendum to the parent design. It preserves the map-first, three-recommendation, RFQ-ready experience and replaces any conflicting assumptions about reach modelling, geocoding, enrichment, runtime architecture, map providers, and evidence gates.

In product language, **booking-ready request** means an editable supplier-verification RFQ draft that is ready for user review. It never means inventory is reserved, confirmed, paid, or automatically sent.

The existing implementation plan was approved before this addendum. It must be revised before implementation begins. In particular, its browser-only, no-geocoding, MapLibre-only, and synthetic per-face reach assumptions are no longer valid.

## 2. Executive decision

Build a super-demo-friendly planning product around one instant transformation:

> Product brief or spreadsheet → three ranked zones and one campaign package → visible causal explanation → adjustable recommendation → supplier-verification RFQ draft.

The first result must be sparse and decisive. It shows:

1. three ranked selected zones on a map;
2. the recommended package and budget fit;
3. the highest eligible delivery range: Low–Base–High for a synthetic scenario or P10–P50–P90 for a calibrated estimate;
4. Influence Capture, when its required inputs exist;
5. a compact reason for each recommendation; and
6. one clear action to review the supplier-verification RFQ draft.

The user can then change the objective, time band, budget, zones, or sites. Every change recomputes a dirty planning draft through the same visible causal chain so the recommendation feels inspectable rather than magical. The RFQ basis changes only when the user applies a valid draft.

The MVP is a planning estimator, not an audience-measurement currency and not a market-share forecaster. Its absolute reach claims are permitted only inside a calibrated applicability envelope. Outside that envelope, the product automatically falls back to relative Activity Potential or a clearly labelled scenario.

## 3. The causal contract

Market share, sales lift, persuasion, and brand perception cannot be projected directly from location inventory. The product models only the intermediate quantities it can evidence:

~~~mermaid
flowchart LR
    A["Inventory and exposure geometry"] --> B["Place and route context"]
    B --> C["Time-banded movement"]
    C --> D["Opportunity to see"]
    D --> E["Target opportunity to see"]
    E --> F["Deduplicated unique reach"]
    F --> G["Influence-weighted reach"]
    G --> H["Planning recommendation"]
    I["Rates, availability, compliance"] --> H
    J["Evidence quality"] --> H
~~~

The displayed drill-down uses the shorter labels:

**Location → Places → Movement → OTS → Target → Unique**

Each number or categorical claim carries one state:

- **Observed:** directly supplied or measured, with a source and observation date.
- **Modelled:** calculated by a versioned model from named inputs.
- **Assumed:** a scenario input or synthetic-demo value that the user can inspect.
- **Unavailable:** omitted because a required input or evidence gate is missing.

The interface never silently upgrades an assumed or modelled value into an observed fact.

## 4. Goals and non-goals

### 4.1 MVP goals

- Produce a confident first result in under one minute from a short brief.
- Make the path from input to recommendation understandable in one click.
- Support seeded demo data and live spreadsheet upload in the same experience.
- Allow optional live geocoding and contextual enrichment without making the demo network-dependent.
- Quantify uncertainty and evidence strength alongside every reach claim.
- Support FMCG, Real Estate, and Bank/Fintech objective presets.
- Generate an editable, supplier-grouped RFQ draft with explicit verification fields.
- Establish a data envelope that can later accept supermarkets, micro-influencers, university or hostel posterboards, radio stations, and other media.

### 4.2 Non-goals

- Certified buying currency, audited audience measurement, or guaranteed delivery.
- Direct market-share, revenue, persuasion, or perception prediction.
- Automated media booking, payment, or supplier commitment.
- Treating map traffic colour, POI popularity, address precision, or population density as measured footfall.
- Claiming absolute reach where calibration, target-universe, visibility, or overlap inputs are missing.
- Training a large proprietary model in the MVP.

## 5. Chosen modelling approach

Three approaches were considered:

1. **Direct heuristic reach:** quickest, but it turns context proxies into false precision.
2. **Full mobility measurement platform:** strongest long-term measurement, but too slow and expensive for the demo.
3. **Calibrated planning estimator:** a transparent contextual movement model calibrated to a small local pilot, followed by a separate stable overlap model.

The MVP uses approach 3.

The estimator has two deliberately separate stages:

- **Stage A — movement and target OTS:** an interpretable time-banded model converts contextual features into pass-by movement, then applies exposure and target-affinity factors.
- **Stage B — unique reach:** a stable weighted synthetic panel converts target OTS into deduplicated people and frequency without pretending each site reaches a disjoint audience.

This separation makes calibration, failure handling, and explanation materially clearer than a single opaque score.

## 6. First-result experience

### 6.1 Loaded state

The initial screen contains:

- a short brief panel;
- a large map;
- three ranked selected-zone cards;
- a compact package strip;
- an objective selector;
- a time-band selector; and
- a primary RFQ action.

The package strip shows only:

- recommended package name;
- planned spend versus budget;
- one claim-aware delivery slot: Activity Potential, Scenario target reach Low–Base–High, or Calibrated target reach P10–P50–P90;
- compact Influence Capture, if eligible;
- Planning Fit and Evidence grade; and
- an explanation affordance.

Selected sites, formats, detailed intervals, and methodology appear after interaction. No dense table appears in the first result.

### 6.2 Four visual lenses

One map view model supports four user-selectable lenses:

- **Plan:** selected zones, candidate faces, package rank, cost, and RFQ status.
- **Activity:** time-banded Activity Potential or calibrated movement.
- **Reach:** target reach contribution, marginal reach, overlap, and uncertainty.
- **Influence:** influence-weighted reach and influential-core composition, only when eligible.

Plan is the default. Activity maps to the Location, Places, and Movement stages; Reach maps to OTS, Target, and Unique; Influence opens an influence subsection beneath Unique. Changing the lens does not change the selected package. It changes the explanatory layer. An ineligible lens remains visible but disabled with the missing requirement stated.

### 6.3 Recommendation card

The three recommendation cards are selected opportunity zones within the one recommended package. Each compact card includes:

- rank and concise place label;
- one-sentence strategic role;
- marginal value in the currently permitted delivery unit; and
- the strongest relevant audience, influence, or conversion signal.

Selecting a zone card zooms the map and reveals its selected sites, cost, practical status, and evidence. Selecting a site opens the face-level causal explanation. Package alternatives remain behind the package strip rather than competing with the three zone cards.

### 6.4 Causal waterfall

The drill-down presents six connected steps:

1. **Location:** coordinates, geocode precision, face orientation, format, and supplied inventory facts.
2. **Places:** category clusters, population context, route access, and destination mix.
3. **Movement:** Activity Potential or calibrated pass-by movement by time band.
4. **OTS:** movement adjusted for the available exposure geometry and view opportunity.
5. **Target:** OTS allocated to the selected audience with named affinity evidence.
6. **Unique:** stable-panel deduplication, overlap, frequency, and uncertainty.

When eligible, Influence appears as an optional subsection after Unique because it reweights reached people; it is not a substitute step in the physical exposure chain.

Each step exposes:

- current value and unit;
- Observed, Modelled, Assumed, or Unavailable state;
- source and freshness;
- transformation or model version;
- the next-step multiplier or mapping; and
- a plain-language caveat.

### 6.5 Adjustments

The smallest useful adjustment set is:

- objective: Broad reach, Influential core, or Near conversion;
- time: All day, AM, Midday, PM, or Evening;
- budget;
- include or exclude a zone;
- include, remove, or swap a site; and
- resolve a low-precision geocode by confirming record identity and, separately, supplying or correcting the coordinate.

Every adjustment creates a dirty draft from the applied plan. The map, cards, marginal delivery, package totals, and Planning Fit preview update together, while the RFQ remains tied to the applied plan. The user can undo, reset, or choose **Apply & review RFQ**. Package-invalid drafts cannot be applied. A claim-degraded but commercially valid draft can be applied with the lower permitted metric, evidence state, and caveat carried into the RFQ. A post-plan upload creates a new data revision and follows this same draft-and-apply rule.

All seeded adjustments are local and deterministic.

## 7. Measurement definitions

### 7.1 Typed metrics

Every model output must include:

- metric identifier;
- numeric value and unit;
- geography, campaign period, delivery schedule, and time band;
- audience definition;
- provenance state;
- evidence grade;
- source references and observation dates;
- model and calibration-bundle versions;
- P10, P50, and P90 when calibrated uncertainty is supported, or Low, Base, and High for a synthetic scenario;
- applicability status; and
- caveat code.

This prevents a relative index, movement count, impression estimate, percentage, and person count from being accidentally compared or summed.

### 7.2 Activity Potential

Activity Potential is the safe output when calibrated person movement is unavailable. It is a relative 0–100 index within a frozen comparison cohort, geography, and time band. The cohort and missing-value rules are versioned in the bundle and require at least 30 comparable locations; otherwise the interface shows the underlying context descriptors without an index.

For location s and time band t:

**AP(s,t) = 100 × percentile of F(x(s,t)) within the comparison set**

F is a versioned feature function using context such as:

- destination density and category diversity;
- population and land-use context;
- road hierarchy and route accessibility;
- transit or civic-destination proximity;
- temporal activity signals; and
- consistently available contextual features with declared missing-value behaviour.

Directional constraints are applied only where they have a causal justification. Potentially non-monotonic signals, such as congestion, require a pre-specified calibrated curve. Same-period local counts are reported as observed movement or used in the calibrated workflow; they are not optional bonuses in the relative index.

Activity Potential is never displayed with a people, impressions, or reach unit.

### 7.3 Calibrated movement

Where pilot observations exist, a transparent count model estimates person-passage events for each location, direction, campaign date, and time block. Passage events are not asserted to be unique people.

For observed count Y in block b on date d:

**log E[Y(s,d,b)] = log(observation duration) + β0 + βxX(s,d,b) + fspace(s) + ftime(d,b) + interactions**

The duration offset uses one declared unit. Predictions are normalized to the exact campaign date-blocks t that will later be summed; t is not merely a generic AM or PM label.

The implementation may use a negative-binomial generalized additive model or another interpretable count model selected during calibration. The model card must record the final form, features, constraints, diagnostics, and applicability envelope.

Candidate predictors can include:

- Activity Potential components;
- road class and intersection structure;
- open, customer-owned, or separately licensed route accessibility and congestion features;
- POI density, diversity, and category mix;
- population or daytime-population context;
- land-use class;
- time band and weekday or weekend;
- properly lagged historical counts with consistent coverage;
- licensed mobility aggregates; and
- weather or event flags when consistently available.

POIs, population, route access, and traffic context are predictors, not ground truth. Local counts, sensors, validated supplier observations, or appropriately licensed mobility data provide calibration truth.

Ordinary Google Routes or TrafficLayer content is not a training, calibration, or frozen-bundle feature under standard Core terms. It may appear only as eligible live display context unless a separate contract explicitly permits model use.

Vehicle and person models retain separate native units. Vehicle passages become person-passage events only through a separately sourced and validated occupancy conversion.

### 7.4 Opportunity to see

Movement becomes general OTS only when exposure geometry and campaign delivery are sufficient:

**OTS(s,t) = M(s,t) × V(s,t) × L(s,t)**

V is a dimensionless probability from 0 through 1 that an eligible passage produces a view opportunity. It can use face orientation, travel direction, setback, obstruction status, illumination, size, speed context, and a documented visibility assumption or measurement.

L is a dimensionless fraction from 0 through 1 of the same block for which the advertisement is eligible: installed share for static media, or the combined operating, uptime, and share-of-time fraction for digital media. Campaign duration is represented by summing compatible date-blocks, not by inserting hours into L.

If orientation, view-zone, or campaign-delivery inputs are missing, V or L is unavailable and the interface stops at movement. An explicitly assumed seeded schedule can support an Evidence-D scenario, but not a production claim.

### 7.5 Target OTS

For audience g:

**TargetOTS(s,t,g) = OTS(s,t) × A(s,t,g)**

A is a dimensionless target share from 0 through 1. It must come from a declared positive target universe, survey, licensed audience data, or an explicitly assumed scenario with a compatible geography and period. POI mix may inform A only through the calibrated model; it is not itself a measured demographic count.

Within a multi-cell target definition, cells are either mutually exclusive, in which case the allocated shares sum to at most 1 and the remainder is unclassified or non-target movement, or they use a documented membership-deduplication model. Overlapping demographic labels are never simply added.

If the target universe or target allocation is missing, the interface shows general OTS and does not relabel it as target reach.

### 7.6 Stable weighted overlap panel

Unique reach is calculated separately using a deterministic synthetic panel representing the declared target universe.

For each target audience g, the bundle contains a synthetic member set Ig. Each member i in Ig has:

- a stable identifier derived from the calibration bundle, not user personal data;
- a target weight wi;
- home, work, or activity-zone propensities at an aggregate level;
- time-band visitation propensities; and
- optional category influence propensity qi.

The target weights sum to the declared target universe:

**Σi∈Ig wi = Ng**

The bundle also freezes a non-negative base propensity b(g,i,s,t), its aggregate activity or route basis, regularization, and validation. For each site and campaign time block:

**λ(g,i,s,t) = c(s,t,g) × b(g,i,s,t)**

The non-negative scalar c has the unique value that satisfies:

**Σi∈Ig wi × λ(g,i,s,t) = TargetOTS(s,t,g)**

If the base-propensity denominator is zero, the unique-reach estimate is unavailable. Merely satisfying the total-OTS equation without a frozen propensity construction is insufficient because many incompatible overlap patterns could produce the same total.

The panel applicability envelope includes validated ranges for c, member exposure-rate and frequency quantiles, and relevant audience, activity, and geography strata. Scaling outside any range stops at Target OTS or produces an explicit Evidence-D sensitivity scenario; it never forces an absolute reach estimate.

Under the MVP's disclosed conditional-Poisson approximation, the package exposure probability is:

**P(g,i,package) = 1 − exp(−Σs∈package,t∈campaign λ(g,i,s,t))**

Unique target reach and average OTS frequency are:

**Reach1+(package,g) = Σi∈Ig wi × P(g,i,package)**

**AverageOTSFrequency = Σs∈package,t∈campaign TargetOTS(s,t,g) ÷ Reach1+(package,g)**

Average OTS frequency is unavailable when reach is zero.

Because the same stable panel, base propensities, and replicate set are used for every candidate and adjustment, shared visitation propensities create consistent overlap and marginal-reach behaviour. The conditional-Poisson form still assumes exposure-event independence after conditioning on those propensities. Evidence C unique reach therefore requires validation against repeated-path, repeated-person, or other qualified overlap and frequency evidence. Without that validation, the interface discloses the assumption, provides an overlap-sensitivity case, and caps unique reach at Evidence D. A later activity-chain model may calculate correlated path events directly.

Every reach run is keyed by an exposure-plan fingerprint containing sorted face IDs, flight dates, face-level date-blocks, static posting or digital play schedules, share of time, uptime and availability assumptions, target and universe version, exposure threshold, panel version, feature snapshot, and model revision. Reusing a result requires exact fingerprint equality.

A separate comparability key contains target and universe definition and version, geography, campaign period, exposure basis and threshold, panel and model version, uncertainty replicate set, and compatible feature schema. Two different fingerprints can be compared only after both plans are recomputed and their comparability keys match.

If no defensible overlap model exists, the product may show target OTS. It may show unique reach only as an explicit assumed scenario, never as calibrated reach.

### 7.7 Influence Capture

Influence Capture is the safe product name for target-audience dominance/perception share. It means the estimated share of a category-specific, influence-weighted target universe reached by the package:

**InfluenceCapturePct = 100 × Σi∈Ig wi × qi × PI(g,i,package) ÷ Σi∈Ig wi × qi**

qi is bounded from 0 through 1 and, for a real claim, must be a calibrated class-membership probability derived from a named category-specific survey, research panel, or approved and documented propensity model. The seeded demo may use an explicitly assumed category-specific qi scenario, which remains Assumed and Evidence D. The denominator must be positive. PI is an influence-specific exposure probability when joint evidence exists.

If the general target exposure probability P is substituted for PI, the method assumes conditional independence between influence status and exposure after the panel features. The interface discloses that assumption, runs a registered sensitivity case, and caps the influence claim below independently validated joint linkage.

The interface describes the influential core in plain language and shows the distribution of influence weight reached. It must also state that the metric does not measure persuasion, opinion change, word of mouth, brand perception, or actual market dominance.

If qi is a continuous weighting construct rather than a calibrated class probability, the output is named **Influence-weighted coverage**, not Influence Capture or share of leaders. If qi or a positive denominator is unavailable, both influence outputs are unavailable. The product does not substitute a generic affluence or density score.

### 7.8 Uncertainty

For a calibrated joint predictive distribution, P10, P50, and P90 are propagated through movement, view opportunity, delivery, target allocation, target-universe size, and overlap. Shared fixed replicate identifiers are used across sites and package comparisons so covariance is preserved.

- A calibrated bundle may label the values P10, P50, and P90 model uncertainty.
- A synthetic demo bundle uses **Low, Base, and High scenario**, never percentile notation.
- A single midpoint is never shown without its range and evidence grade.

## 8. Calibration workflow

### 8.1 Minimum directional pilot

The minimum pilot floor is:

- 12 sentinel locations;
- four dayparts;
- weekday and weekend observation; and
- one directional block for each combination.

This produces at least 96 directional blocks. Locations should span the road classes, land-use patterns, activity levels, and target sectors intended for the initial Lagos applicability envelope.

The 96-block floor supports model prototyping and a directional Evidence-D estimate. Evidence-C uncertainty requires an independent second weekday and second weekend for every included location and daypart, producing at least 192 blocks, or a stronger pre-registered repeated-date design. A stratum without independent-date replication remains Evidence D.

At least three whole locations, including all their dates and dayparts, are held out. Holding out locations, rather than random rows, tests whether the model transfers spatially. A recurring subset continues after launch to detect temporal and calibration drift.

### 8.2 Pilot observations

Each block records:

- location and face identifier;
- count direction;
- date, start, end, and duration;
- count method and quality notes;
- pass-by person or vehicle counts and the conversion method used;
- relevant weather, incident, or event flags;
- view-zone and obstruction state;
- observer or device quality status; and
- matching contextual-feature snapshot.

Vehicle-to-person conversion requires its own observed or licensed basis. Without one, the model reports vehicle movement in its native unit.

### 8.3 Fit and validation

Calibration follows a reproducible offline workflow:

1. freeze input snapshots;
2. validate observations and exclusions;
3. fit candidate interpretable models;
4. select using spatial holdout performance and simplicity;
5. estimate uncertainty and residual bias;
6. define the applicability envelope;
7. freeze the model, features, panel, and documentation as a signed bundle; and
8. rerun the product golden scenarios.

### 8.4 Evidence-C product gate

For observed y and prediction ŷ, the pilot reports:

- **MdAPE = median(|ŷ − y| ÷ y)** over blocks where y is positive;
- **WAPE = Σ|ŷ − y| ÷ Σy** over all held-out blocks; and
- **signed WAPE = Σ(ŷ − y) ÷ Σy** over the same blocks.

WAPE is the zero-safe primary percentage-error check. Poisson deviance and native-unit MAE are also reported. Exclusions, low-count handling, denominators, strata, and materiality rules are pre-registered; a zero-total stratum cannot pass on a percentage metric alone.

Movement can reach Evidence C only when all of the following pass:

- held-out MdAPE and WAPE are each at most 35%;
- at least 70% of held-out directional blocks fall inside P10–P90;
- absolute held-out signed WAPE is at most 15%;
- no pre-registered road-class or daypart stratum with at least eight blocks has absolute signed WAPE above 25%, unless that stratum is excluded from the applicability envelope;
- all claim-critical inputs and model-card fields are complete; and
- the requested prediction is inside the declared applicability envelope.

Later claims have additional gates:

- **OTS C:** Movement C plus validated V and L for the claimed formats, directions, schedules, and periods.
- **Target OTS C:** OTS C plus a validated target universe and allocation A.
- **Unique target reach C:** Target OTS C plus independent overlap or frequency validation for the exact panel method. An unvalidated conditional-Poisson approximation remains D.
- **Influence C or higher:** eligible unique reach plus validated qi and a documented, tested influence-to-exposure linkage. The claim grade inherits the weakest earlier component.

Before data collection, every downstream method version pre-registers its independent validation source, minimum raw and effective sample size, holdout unit, metrics, pass thresholds, subgroup checks, and failure behaviour. Unique-reach validation must test held-out 1+ reach, average frequency, and cross-site or cross-time overlap for package-like plans; reproducing site Target OTS is insufficient. Until a claim-specific pre-registered gate passes, that downstream claim remains Evidence D or unavailable.

These are product launch gates, not industry standards. They may become stricter with more data. A frozen synthetic demo bundle remains Evidence D even if it reproduces its seeded outputs perfectly.

### 8.5 Calibration bundle

The versioned bundle contains:

- feature schema and transformations;
- model coefficients or serialized interpretable model;
- target-universe tables;
- stable synthetic panel;
- uncertainty parameters;
- fixed uncertainty-replicate identifiers or seeds;
- exposure-plan fingerprint and comparability schema;
- applicability rules;
- validation report;
- source manifest and permitted-use metadata;
- golden scenarios; and
- bundle identifier and creation date.

The browser must be able to run the seeded demo entirely from this bundle.

## 9. Recommendation logic

### 9.1 Separate outputs

The interface must never collapse these into one number:

- target reach or Activity Potential;
- Influence Capture;
- Planning Fit;
- Evidence score and grade;
- cost; and
- supplier readiness.

### 9.2 Planning Fit pillars

Planning Fit is a 0–100 decision score with five named pillars:

- **A — Audience and strategic alignment**
- **D — Delivery**
- **C — Context, timing, and conversion proximity**
- **P — Portfolio and competition**
- **E — Economics**

The objective presets use these weights:

| Objective | A | D | C | P | E | Delivery definition |
|---|---:|---:|---:|---:|---:|---|
| Broad reach | 20 | 35 | 15 | 20 | 10 | Unique target reach 1+ |
| Influential core | 25 | 35 | 20 | 10 | 10 | Influence-weighted reach 1+ |
| Near conversion | 25 | 15 | 35 | 10 | 15 | Serviceable target reach 1+ |

The score is:

**PlanningFit = (wA × A + wD × D + wC × C + wP × P + wE × E) ÷ 100**

All pillars use the frozen normalization cohort and compatible definitions established in the parent design. Delivery is either a frozen-cohort percentile of the eligible objective metric or **100 × min(metric ÷ declared goal, 1)** when the user has supplied a compatible goal. Every candidate in one ranking run must have the same metric, target and universe, geography, campaign period, exposure basis, evidence eligibility, and normalization rule. Raw person counts never enter the weighted sum directly.

For Near conversion, serviceable target reach is:

**ServiceableReach1+ = Σi∈Ig wi × si × P(g,i,package)**

si is a sourced serviceability probability or eligibility from 0 through 1 for the offered product and period. Nearby service geometry alone is only proximity coverage and belongs in C; it does not prove that an exposed person is serviceable.

For Influential core, the raw Delivery metric is the influence-weighted reached mass **Σi∈Ig wi × qi × PI(g,i,package)** under one compatible influence universe. This is the numerator already disclosed by Influence Capture, not a second influence bonus.

The score is transparent after each pillar is normalized and gated. Ranking ties are resolved by higher separate Evidence score, then lower verified cost, then stable asset identifier.

Planning Fit is available only when the selected objective's Delivery metric is eligible. Influential core is unavailable without qi, Near conversion is unavailable without sourced serviceability si for the target universe, and Broad reach is unavailable without qualified unique target reach. The product may still produce a clearly named **Context shortlist** from Activity Potential, but it cannot relabel that shortlist as a Planning Fit recommendation.

Under Influential core, influence-weighted reach is the single Delivery input. Broad reach is not added beside it, and Influence Capture does not become a sixth pillar.

### 9.3 Feature-use registry

Every score input is registered with:

- feature identifier and version;
- raw source;
- transformation;
- causal role;
- permitted pillar;
- freshness;
- evidence grade; and
- missing-value behaviour.

A derived feature may contribute to only one Planning Fit pillar. Measurement outputs may enter Delivery once; their underlying predictors cannot then be added again as independent score bonuses. For example, if restaurant density contributes to target allocation and therefore reach, it cannot also inflate Audience fit.

A build-time registry check rejects duplicate pillar use. This prevents a visually impressive but statistically circular recommendation.

### 9.4 Package construction

The deterministic package optimiser:

1. filters assets by hard eligibility, budget, format, and evidence gates;
2. generates small feasible packages;
3. calculates incremental target reach or the eligible Delivery metric;
4. calculates the other Planning Fit pillars;
5. applies objective weights;
6. preserves zone or format diversity when it adds material marginal reach;
7. ranks packages; and
8. publishes one recommended package while retaining the next two candidates internally for explainable swaps.

The demo favours a bounded exhaustive or beam search over a black-box optimiser so every selection can be reproduced.

## 10. Evidence and claim gates

### 10.1 Evidence score

Evidence quality Q is calculated separately:

**Q = 0.25 Source + 0.25 Validation + 0.20 Temporal + 0.20 Granularity/Coverage + 0.10 Completeness**

Each component is 0–100 and uses the parent design's deterministic lookup and source manifest. For an evidence scope:

- **Qraw** is the applicable weighted component score;
- **Qmin** is the lowest essential directly contributing evidence score; and
- **Qfinal = min(Qraw, Qmin + 15, applicable provenance and method caps)**.

No independent validation caps Qfinal at 84. A locally calibrated directional pilot without independent external validation caps it at 69. Context-proxy delivery also caps it at 69. Any synthetic or demo input essential to the result caps it at 54. A missing source, period, method, or critical component makes the claim unavailable rather than neutral.

| Grade | Qfinal | Meaning |
|---|---:|---|
| A | 85–100 | Time-aligned, granular evidence with independent audit, validation, or independently observed ground truth |
| B | 70–84 | Time-aligned provider-confirmed evidence with a disclosed and validated method |
| C | 55–69 | Locally calibrated or area-level planning evidence with assumptions and uncertainty disclosed |
| D | 40–54 | Directional, inferred, synthetic, demo, or materially incomplete evidence |
| Unavailable | Below 40 or a zero critical component | Insufficient evidence for the claim |

The product calculates separate scopes:

- **Recommendation Evidence:** inputs used for eligibility, Planning Fit, cost, and package construction.
- **Reach Evidence:** the weakest claim-critical movement, V, L, A, universe, overlap, compatibility, and uncertainty component.
- **Influence Evidence:** the weakest Reach Evidence, qi construct, joint-linkage or conditional-independence, compatibility, and uncertainty component.

The compact badge beside multiple displayed numbers uses the weakest displayed claim grade. Drill-down retains every claim's own Qfinal and grade. Evidence is never multiplied into Planning Fit.

### 10.2 Claim ladder

The highest permissible output follows this ladder:

1. context features;
2. Activity Potential;
3. calibrated movement;
4. general OTS;
5. target OTS;
6. unique target reach;
7. Influence Capture.

Missing a required input moves the interface down the ladder. Copy, units, charts, and ranking logic change with it; only hiding a caveat is insufficient.

### 10.3 Hard degradation rules

- Low-precision geocode → context only. Confirmation verifies record identity but does not improve coordinate precision; calibrated use requires an independently supplied coordinate meeting the model threshold or a model that explicitly accepts and propagates the positional uncertainty.
- Missing orientation or view zone → movement only.
- Missing compatible campaign delivery or schedule → movement only; a seeded assumed schedule supports only an Evidence-D scenario.
- Vehicle flow without defensible occupancy conversion → vehicle movement only.
- Missing target universe or allocation → general OTS only.
- Missing overlap model → target OTS; optional unique reach only as an explicit assumed scenario.
- Missing influence propensity qi → no Influence Capture.
- Out of calibration domain or failed validation → Activity Potential only.
- Missing verified rate or availability → the RFQ draft asks the supplier; the product does not call it booked.

## 11. Runtime and data architecture

### 11.1 Components

The MVP uses:

- **React browser:** brief, upload, map, lenses, explanations, adjustments, and supplier-verification RFQ draft.
- **Pure planning engine:** typed deterministic transformations, scoring, package optimisation, uncertainty, and degraded-mode rules.
- **Provider-neutral enrichment gateway:** optional server-side geocoding and context calls, authentication, quotas, permitted caching, and normalized responses.
- **Frozen Lagos bundle:** eligible synthetic, customer-owned, open, separately licensed, or contract-approved retained feature snapshots; demo inventory; calibration model; stable overlap panel; source manifest; and golden outputs.
- **Offline calibration workflow:** imports observations, fits and validates models, and emits a signed frozen bundle.
- **Optional Lagos MVP adapters:** Google Geocoding, Places Aggregate where commercially and contractually eligible, and Routes display context.
- **Future Places Insights warehouse:** a separately gated BigQuery and Analytics Hub integration with country availability, IAM, export, ML-use, and Order Form controls; it is not a Lagos MVP dependency.

~~~mermaid
flowchart TB
    UI["React planning experience"] --> PE["Pure planning engine"]
    UI --> MR["Map renderer interface"]
    PE --> FB["Frozen Lagos bundle"]
    UI --> GW["Enrichment gateway"]
    GW --> GEO["Geocoding adapter"]
    GW --> PLC["Places Aggregate adapter"]
    GW --> RTE["Routes display-context adapter"]
    PIW["Future Places Insights warehouse"] --> PE
    CAL["Offline calibration workflow"] --> FB
    OBS["Counts, sensors, licensed mobility"] --> CAL
    MR --> GL["Google map renderer"]
    MR --> ML["MapLibre renderer"]
~~~

Seeded mode makes no external call. Live mode is an enhancement path, not a demo dependency.

The frozen bundle never contains cached Google geocodes, ordinary Routes content, raw Places responses, expired Places Aggregate counts, or any derived value whose permitted retention does not cover the bundle.

### 11.2 Enrichment tiers

Each location declares one tier:

- **Seeded:** frozen feature record and synthetic or pilot evidence.
- **Uploaded:** parsed user facts, no external enrichment yet.
- **Context enriched:** geocode and contextual predictors available.
- **Calibrated:** prediction is inside a passing bundle's applicability envelope and exactly matches its feature schema, taxonomy, provider transformation, collection protocol, completeness rules, query geometry, and missing-value behaviour.

The tier is visible and is not synonymous with Evidence grade.

### 11.3 Spatial objects

The engine distinguishes:

- point location;
- media face and orientation;
- view zone;
- walking or driving catchment;
- route segment or corridor;
- POI aggregation cell;
- calibration geography; and
- target-universe geography.

This avoids the common error of treating all nearby places as equally visible or causally relevant.

### 11.4 Core records

At minimum, the domain model requires:

- Brief
- AudienceDefinition
- ObjectivePreset
- Asset
- MediaFace
- ExposureGeometry
- ContextFeature
- MovementEstimate
- TargetOTSEstimate
- ReachEstimate
- InfluenceEstimate
- EvidenceRecord
- SourceManifest
- EnrichmentSnapshot
- EnrichedFieldPolicy
- CalibrationBundle
- Recommendation
- Package
- SupplierRequest

All recommendation and RFQ rows retain the asset identifiers and evidence references used to create them.

## 12. Provider and licensing boundary

### 12.1 Intended Google roles

Subject to current terms, commercial eligibility, and legal review:

- **Geocoding:** decode supplied addresses, retain its returned precision, and request identity review where ambiguous. Confirmation never promotes coordinate accuracy.
- **Places Aggregate:** the intended Lagos live adapter for eligible place counts and substantially transformed Customer Values; its published coverage includes Nigeria, subject to local data quality and commercial access.
- **Places Insights:** a distinct Analytics Hub and BigQuery warehouse product with separate IAM, export, and ML-use terms. As of this design date, published setup availability does not list Nigeria, so it is future-only and must never be silently substituted for Places Aggregate.
- **Nearby Search:** support bounded place discovery and visible exploration; it is not an exhaustive count or a numeric footfall feed.
- **Routes:** supply eligible live route duration, static duration, and traffic-aware display context. Ordinary Routes output is neither a traffic-count feed nor a calibration or frozen-bundle feature under standard terms.
- **Traffic layer:** visible Google-map context only; traffic colours are neither scraped nor converted into features, person counts, or vehicle counts.

Every enriched field records source product, content classification, derivation lineage, model-use permission, renderer eligibility, retention deadline, attribution identifier, legal-approval identifier, request purpose, and review date. Policy is field-specific rather than merely adapter-specific.

### 12.2 Legal and commercial gate

Before enabling a Google-backed production adapter, the team must confirm:

- the intended advertising-planning and ISV use is allowed;
- the exact product is commercially available in the target geography;
- Places Aggregate Customer Value treatment is allowed for the proposed advertising-planning workflow;
- any future Places Insights warehouse use is allowed by the Analytics terms and applicable Order Form;
- raw and transformed data retention is compliant;
- attribution and map-display requirements are implemented;
- user-uploaded addresses are handled under the applicable terms and privacy policy; and
- procurement accepts cost and quota limits.

No architectural wording in this design substitutes for that review.

### 12.3 Map separation

One provider-neutral planning state can create eligible projections for two mutually exclusive renderer implementations:

- **Google renderer:** used when raw Google content must be displayed on a Google map with required attribution.
- **MapLibre renderer:** used for synthetic, open, customer-owned, or separately licensed data. A Google-derived Customer Value may appear only when the applicable contract and documented legal review explicitly permit that association.

Non-reversibility alone does not make Google-derived content MapLibre-eligible. On a renderer switch, the scene is rebuilt from fields eligible for the destination renderer. Google markers, POI labels, routes, coordinates, linked selections, and derived map state are removed unless explicitly approved. Only customer-owned identifiers and independently sourced spatial state are preserved. Required attribution remains adjacent to Google content even when no map is shown.

### 12.4 Security and cost

- API keys remain server-side except any deliberately restricted browser map key.
- Keys use application, API, and environment restrictions.
- A future Places Insights integration uses BigQuery and Analytics Hub IAM with service-account or workload-identity controls, not a Core API key.
- The gateway batches, throttles, logs, and applies per-session budgets.
- Live enrichment is explicit and never triggered by merely selecting a file.
- Google geocoded coordinates are treated as expiring content, with a default maximum cache of 30 consecutive days under the applicable policy unless a documented exception applies; confirmation does not create a retention exception.
- Place IDs may be retained as permitted and refreshed on the provider's recommended cadence.
- Raw Places Aggregate counts are retained for at most 30 consecutive days and solely to calculate an eligible Customer Value, then deleted; retained provenance cannot reconstruct them.
- Raw provider payloads and derived fields are not persisted beyond their field-level permission and deadline.
- Seeded mode remains usable if quotas, credentials, or providers fail.

## 13. Spreadsheet upload and live enrichment

### 13.1 Upload flow

The user can upload CSV, TSV, or XLSX. Parsing and column mapping occur locally first. Legacy XLS can be added later if a safe parser and real demand justify it.

The flow is:

1. select file;
2. inspect sheets and map headers;
3. validate rows and show accepted, warning, and rejected counts;
4. preview locations on the map where coordinates exist;
5. choose up to 50 accepted rows for the MVP;
6. review an enrichment preflight showing provider and product, transmitted rows and fields, estimated calls and cost, expected retention, attribution, and whether each result is context-only or model-eligible;
7. click **Enrich locations** to authorize optional live calls;
8. review approximate matches and contextual features; and
9. run the planner.

The 50-row cap is a product limit, not a provider batch guarantee. The gateway still orchestrates and meters the provider's required request units. Before transmission, the importer quarantines or requires explicit removal of person names, private residential addresses unrelated to media inventory, sensitive attributes, and other apparent personal data.

### 13.2 Field contract

Each accepted row needs either:

- latitude and longitude; or
- a usable address.

Recommended fields are:

- asset ID;
- supplier;
- address and locality;
- latitude and longitude;
- face orientation or travel direction;
- format and dimensions;
- illumination;
- rate and rate period;
- availability window;
- restrictions or compliance status; and
- source and last-verified date.

Unknown columns are preserved as user facts and can be mapped later. They do not automatically enter the model.

Uploaded spatial fields are not presumed customer-owned merely because they arrived in a spreadsheet. Before calibration or renderer projection, the importer records their source and right-to-use classification: customer-captured, open or licensed with licence identifier, provider-derived, or unknown. Provider-derived fields inherit their provider restrictions. Unknown-provenance coordinates remain context-only and are excluded from calibration and MapLibre scenes until resolved.

### 13.3 Geocode review

Geocoding returns a normalized location, immutable precision class, and source reference. Quality evaluation includes location type, partial-match status, result type and count, expected country and locality, distance from the expected area, and viewport ambiguity. Approximate, interpolated, geometric-centre, or locality-level matches are visually distinct.

Confirmation verifies that the returned address is the intended record; it does not upgrade its spatial precision. A marker move or coordinate edit creates a separately provenanced user correction and never relabels the provider coordinate as customer-owned. Calibrated use requires an independently supplied coordinate meeting the model threshold or an applicability rule that explicitly propagates the positional uncertainty.

## 14. Failure and degraded-mode experience

The product should fail downward, not fail closed:

- enrichment unavailable → use uploaded or seeded facts;
- unknown address → keep row, request coordinate correction;
- incomplete face data → show location context and movement only;
- no calibrated bundle → show Activity Potential and Evidence D;
- unsupported geography → compare context within the upload, without absolute reach;
- rate unavailable → include a rate-verification field in the RFQ;
- availability unavailable → include an availability-verification field;
- provider quota exceeded → reuse only non-expired, contract-permitted features; otherwise fall back to seeded or customer facts and visibly reduce the evidence state;
- calibration-bundle mismatch → stop absolute claims and surface the version conflict.

Every degraded state includes one actionable recovery step.

## 15. Sector presets

### 15.1 FMCG

Default emphasis:

- broad reach or influential core;
- repeat exposure;
- retail and consumption occasion proximity;
- category-relevant destination mix; and
- format diversity where it adds marginal reach.

### 15.2 Real Estate

Default emphasis:

- qualified corridor and catchment reach;
- affluent or life-stage audience evidence when licensed or surveyed;
- route proximity to the development;
- commute and weekend differences; and
- enquiry or site-visit proximity.

### 15.3 Bank/Fintech

Default emphasis:

- serviceable target reach;
- branch, agent, merchant, campus, commuter, or business-cluster proximity;
- trust and evidence strength;
- digital or financial-access audience fit; and
- regulatory and brand-safety practicality.

Sector presets choose objective defaults and explanatory copy. They do not bypass evidence gates.

## 16. Future media envelope

Future media are standardized through a common evidence envelope rather than forced into billboard units.

Every opportunity records:

- medium and unit identifier;
- location or coverage geography;
- exposure event definition;
- native volume unit and period;
- audience composition and source;
- repetition or frequency basis;
- visibility, audibility, or delivery factor;
- capacity and availability;
- rate and rate unit;
- restrictions and verification state;
- evidence grade and freshness; and
- uncertainty or scenario status.

Examples:

- supermarket: verified visits or entries per day, not nearby population;
- university or hostel posterboard: enrolled or resident audience and observed circulation;
- micro-influencer: eligible delivered impressions and deduplicated audience under platform-approved evidence;
- radio: measured or modelled listeners by daypart and coverage area.

Cross-media deduplication is unavailable until a defensible shared identity or panel method exists. Until then, the product shows native delivery side by side and does not sum people across media.

## 17. Exact executable MVP

The first build includes:

- one seeded Lagos FMCG scenario as the primary demo;
- alternate Real Estate and Bank/Fintech brief presets;
- three ranked recommendation cards;
- one recommended package with two internal replacement candidates;
- Plan, Activity, Reach, and Influence lenses;
- six-step causal waterfall;
- objective, time-band, budget, include, remove, and swap controls;
- deterministic Low–Base–High scenario ranges in the Evidence-D seeded bundle;
- Planning Fit, Evidence grade, marginal eligible delivery, and eligible Influence Capture;
- CSV, TSV, and XLSX upload with mapping and a 50-row cap;
- explicit optional enrichment through the provider-neutral gateway;
- mutually exclusive Google and MapLibre eligible-scene projections behind one planning-state adapter;
- a supplier-verification RFQ draft grouped by supplier; and
- provenance, caveat, and source panels.

The seeded scenario uses no network call and no production audience claim.

## 18. Four-minute demo path

1. Open a prefilled FMCG brief and click **Build campaign**.
2. Reveal three selected zone cards, one package, Scenario target reach Low–Base–High, the influential-core description, Planning Fit, and Evidence D.
3. Click the top zone, then one site, and reveal the complete Location → Places → Movement → OTS → Target → Unique chain.
4. Make one strategic adjustment: switch the objective, change the time band, or swap one site. Show the causal delta, marginal delivery, overlap, and budget update.
5. Choose **Apply & review RFQ** and show supplier-grouped rate, availability, compliance, and evidence-verification questions.

The main demo ends at a usable supplier-verification draft, not at a dashboard. Live spreadsheet upload is a separate optional vignette: map a sample file, show local validation, then show that external enrichment requires an explicit click before it creates a new planning draft.

## 19. Acceptance criteria

### 19.1 Experience

- A first-time viewer can state the recommendation, the currently permitted delivery claim and evidence state, and the reason within 30 seconds.
- The initial result shows no more than three recommendation cards and one compact package strip.
- Every recommendation can be explained through the six causal steps.
- Objective, time, budget, include, remove, and swap actions update all dependent visuals consistently.
- Adjustments remain dirty until explicitly applied; package-invalid drafts cannot become the RFQ basis, while claim-degraded valid drafts carry their lower claim and caveat forward.
- The RFQ draft remains editable, watermarked where synthetic data is used, unsent, and clearly unbooked.

### 19.2 Measurement integrity

- No relative index is labelled as people, impressions, or reach.
- No unique-reach claim exists without a declared target universe and overlap method.
- No Influence Capture exists without qi provenance.
- Every midpoint is accompanied by a range and evidence state.
- Out-of-domain inputs degrade automatically.
- The feature-use registry has no duplicate pillar assignments.
- Seeded claims remain Evidence D.

### 19.3 Data and provider safety

- Spreadsheet parsing happens before any live enrichment.
- No more than 50 accepted rows are enriched in one MVP run.
- A low-precision geocode never becomes calibration-eligible through confirmation alone; any user correction retains separate provenance.
- Uploaded spatial fields with unknown provenance never enter calibration or a MapLibre scene.
- Provider-specific map content uses its eligible renderer and attribution.
- Credentials are absent from client bundles and repository history.
- Seeded mode passes with the network disabled.

### 19.4 Reproducibility

- Same brief, bundle, normalized enrichment-snapshot ID, data revision, exposure-plan fingerprint, fixed replicate set or seed, and controls produce byte-equivalent planning outputs. Live provider responses are not reproducible until normalized into a versioned eligible snapshot.
- Every output records bundle, model, feature, source, snapshot, fingerprint, and replicate versions.
- Golden scenarios cover each objective and each hard degradation rule.

## 20. Verification strategy

Implementation verification must include:

- unit tests for typed metrics, formulas, score weights, tie-breaking, and failure gates;
- property tests that the optimum objective score cannot decrease when a budget change creates a genuinely nested feasible set;
- fixed-delivery property tests that adding one face cannot reduce reach, removing one face cannot increase it, and leave-one-out marginal reach is non-negative;
- invariants that unique target reach does not exceed its compatible target universe or compatible package target OTS, and that average OTS frequency is at least 1 when reach is positive;
- snapshot or golden tests for the three seeded sector scenarios;
- contract tests for provider-normalized gateway responses;
- parser tests for messy CSV and workbook headers;
- visual tests for each lens, uncertainty state, approximate geocode, and unavailable claim;
- network-disabled end-to-end demo test;
- accessibility checks for colour-independent evidence and map explanations; and
- calibration-report tests that fail the bundle build when the Evidence-C gates do not pass.

## 21. Superseded implementation assumptions

The revised implementation plan must remove or replace these assumptions from the earlier plan:

- browser-only architecture;
- prohibition on geocoding or contextual enrichment;
- MapLibre as the only renderer;
- per-face synthetic reach summed without stable overlap;
- a single deterministic reach value without a calibrated uncertainty interval or disclosed scenario range;
- POI or traffic context treated as direct footfall;
- a context proxy producing a numeric Planning Fit under an objective whose Delivery definition requires qualified reach;
- Influence Capture inferred without a category-specific qi source;
- Influence Capture forced to remain display-only even when an eligible Influential core objective intentionally uses influence-weighted reach as its one Delivery input; and
- reach, Planning Fit, and Evidence blended into one confidence number.

## 22. External measurement and provider references

The design is informed by, but does not claim certification under:

- [MRC Out-of-Home Audience Measurement Standards, final 2025 edition](https://mediaratingcouncil.org/sites/default/files/Standards/MRC%20OOH%20Standards%20Combined_FINAL.pdf), including empirically supported modelled measurement, validation, presence, dwell time, viewability, and unit-level deduplication.
- [World Out of Home Organisation Audience Measurement Guidelines 2026](https://worldooh.org/audience-measurement-guidelines-2026).
- [Google Places Insights overview](https://developers.google.com/maps/documentation/placesinsights/overview), [setup and availability](https://developers.google.com/maps/documentation/placesinsights/cloud-setup), [policies](https://developers.google.com/maps/documentation/placesinsights/policies), and [Maps Analytics Service Terms](https://cloud.google.com/terms/maps-platform/maps-analytics-service-terms).
- [Google Places Aggregate overview](https://developers.google.com/maps/documentation/places-aggregate/overview), [coverage](https://developers.google.com/maps/documentation/places-aggregate/coverage), [policies](https://developers.google.com/maps/documentation/places-aggregate/policies), [location-score architecture](https://developers.google.com/maps/architecture/places-aggregate-location-score), and [Maps service-specific terms](https://cloud.google.com/maps-platform/terms/maps-service-terms).
- [Google Nearby Search documentation](https://developers.google.com/maps/documentation/places/web-service/nearby-search).
- [Google Routes traffic-aware polylines](https://developers.google.com/maps/documentation/routes/traffic_on_polylines) and [Maps JavaScript TrafficLayer reference](https://developers.google.com/maps/documentation/javascript/reference/map#TrafficLayer).
- [Google Geocoding response semantics](https://developers.google.com/maps/documentation/geocoding/guides-v3/requests-geocoding), [Geocoding versus Address Validation](https://developers.google.com/maps/architecture/geocoding-address-validation), and [Geocoding policies](https://developers.google.com/maps/documentation/geocoding/policies).
- [Google Maps Platform Terms](https://cloud.google.com/maps-platform/terms), [Routes policies](https://developers.google.com/maps/documentation/routes/policies), and [API security best practices](https://developers.google.com/maps/api-security-best-practices).

Provider capabilities, pricing, geography, and terms must be rechecked when adapters are implemented.
