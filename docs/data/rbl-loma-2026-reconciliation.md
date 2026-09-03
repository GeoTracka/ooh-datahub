# RBL/LOMA 2026 source reconciliation

## Reviewed sources

| Source | SHA-256 | Role |
| --- | --- | --- |
| `RBL-LOMA Nigeria OOH Consumer Penetration Cleaned Databook.2026.xlsx` | `780a9fbaa2b4e736c4a4236fae751cb8c314aabaf6cad8206e553870bc5032e2` | Restricted respondent workbook |
| `RBL-LOMA OOH AUDIENCE PENETRATION Study 2026.pdf` | `a93b78fae81abee0f02a9248e7f69eaa065d94d3ebef81fea6105bccab44c0ff` | Reviewed narrative/report evidence |

The workbook contains one `Nigeria OOH 3` sheet with 1,844 data rows and 302 columns. The release describes the evidence as a 12-city urban resident and regular-commuter study, not a nationally representative population survey.

## Reconciled observations

| Finding | Observed evidence | Disposition |
| --- | --- | --- |
| Variable count | Workbook has 302 columns; report describes 337 variables | Blocked as a discrepancy; no undocumented columns or transformation are inferred |
| Lagos four-week recall | Workbook-derived 72.1%; report states 54.9% | `four_week_recall` blocked for every city until denominator/transformation is documented |
| Abuja/Kano recall bases | Smaller denominator/transformation differences were observed during review | Blocked with the same recall family; do not selectively choose the more favourable value |
| Weighting | No reproducible weighting formula was supplied | Every workbook fact is labelled unweighted |
| City quotas | City sample sizes range from 130 to 204 and are not population-proportional | No national roll-up or population extrapolation |
| Screening gate | Six rows explicitly answer “No” to resident/regular-commuter eligibility | Quarantined. This corrects the earlier four-row working assumption using the pinned workbook itself |
| Missing city | One otherwise screened row has no city | Quarantined |
| Age 56+ | Nine records use the `56+` band; 23 age values are blank | Retained in restricted normalization; published only where the segment base reaches 30 (it does not in the first release) |
| Route/area text | Case variants, spelling variants, numeric codes, and blanks are present | Restricted staging only; requires a reviewed place resolver before any derived geography can publish |

## Eligibility result

The deterministic audit accepts 1,837 rows and quarantines 7. Accepted city bases are:

| City | Eligible base |
| --- | ---: |
| Lagos | 204 |
| Kano | 165 |
| Port Harcourt | 165 |
| Kaduna | 161 |
| Onitsha | 155 |
| Abuja | 150 |
| Benin City | 150 |
| Aba | 148 |
| Sokoto | 140 |
| Enugu | 139 |
| Ibadan | 130 |
| Asaba | 130 |

## What the evidence can support

The first governed release may support descriptive planning questions about travel patterns, self-reported attention, formats seen or considered hard to ignore, commute context, format ratings, creative triggers, and reported post-ad actions. It may compare supported city/age/gender segments when the valid base is at least 30.

It cannot independently support population reach, site-level delivery/frequency, price, availability, ROI, radio behaviour, outdoor-activation potential, or causal claims. Those require separate governed sources and should be labelled unavailable—not estimated from this study.
