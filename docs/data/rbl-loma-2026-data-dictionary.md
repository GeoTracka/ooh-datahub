# RBL/LOMA 2026 evidence data dictionary

## Scope and release boundary

This evidence product describes 1,837 eligible respondents in a 12-city urban resident and regular-commuter study. It is not a population estimate and does not supply site reach, frequency, price, availability, ROI, radio-listening, or activation-potential evidence.

The source workbook is restricted. Only governed aggregates with a valid respondent base of at least 30 may cross the publication boundary. All published aggregates are labelled **unweighted** because no reproducible weighting formula accompanied the reviewed files.

## Normalized respondent fields

| Field | Workbook column(s) | Use | Publication rule |
| --- | ---: | --- | --- |
| `city` | 14 | Stable ID for the 12 study cities | Aggregate/filter only |
| `commuteEligibility` | 115 | Screening gate | Ineligible rows quarantined; never a public respondent record |
| `ageBand` | 118 | Optional segment | Publish only when segment base is at least 30 |
| `gender` | 120 | Optional segment | Publish only when segment base is at least 30 |
| `occupation` | 121 | Restricted normalization | No first-release segment because of sparse/high-cardinality groups |
| `incomeBand` | 125 | Restricted normalization | No first-release segment because of sparse groups and sensitivity |
| `travelFrequency` | 140 | Controlled mobility response | Governed aggregate |
| `weekdayTime` | 143–149 | Single/multiple weekday periods | Governed aggregate; multi-select counts retain the valid base |
| `primaryTransport` | 154 | Main transport mode | Governed aggregate |
| `journeyAttention` | 156 | Self-reported attention during journeys | Governed aggregate; never converted into site delivery |
| `weeklyEnvironments` | 158–164 | Environments visited weekly | Governed multi-select aggregate |
| `routeOpenText` | 165 | Free-text route | Restricted staging only; prohibited in publication |
| `areaOpenText` | 166 | Free-text area | Restricted staging only; prohibited in publication |
| `categoryRecall` | 167–189 | Recalled advertiser categories | Restricted in first release pending clearer category semantics |
| `noticedFrequency` | 190 | Self-reported noticing frequency | Governed aggregate |
| `topFormats` | 192–201 | Up to three formats seen | Governed multi-select aggregate |
| `exposureEnvironment` | 202 | Environment with most reported OOH | Restricted in first release pending answer reconciliation |
| `fourWeekRecall` | 205 | Four-week recall | Blocked: workbook/report mismatch |
| `hardestToIgnore` | 211 | Hardest-to-ignore format | Governed aggregate |
| `commuteMood` | 214 | Self-reported commute mood | Governed aggregate |
| `commuteAttention` | 215–222 | Attention targets while commuting | Governed multi-select aggregate |
| `formatRatings` | 226–258 | Attention, recall, trust, effect, and quality ratings | Mean, 1–5 scale, valid base, and respondent base |
| `creativeTriggers` | 262–268 | Creative features likely to attract attention | Governed multi-select aggregate |
| `reportedActions` | 270–276 | Self-reported actions after an OOH ad | Governed multi-select aggregate; not causal ROI |

## Privacy exclusions

Interviewer identity, respondent identity, GPS/location coordinates, altitude, accuracy, device data, submission metadata, and other collection metadata are never read into the normalized contract. Route and area free text are retained only in restricted local staging so a future reviewed place-resolution process can operate without exposing respondent-level movement.

The publication verifier recursively rejects keys that indicate identity, GPS, device/submission metadata, or restricted open text. The generated public payload contains aggregates, source IDs/hashes, bases, periods, units, and methodological caveats—never respondent rows.

## Published fact semantics

- Percent facts retain numerator, denominator, respondent base, period, and weighting status.
- Multi-select facts retain selection count and valid respondent base; they are not treated as mutually exclusive percentages.
- Rating facts retain mean, valid rating base, total respondent base, and the 1–5 scale.
- City, city-by-age, and city-by-gender facts require a base of at least 30.
- Category spelling and case variants are coalesced before stable fact IDs are generated.

