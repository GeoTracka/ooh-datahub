# Theme context

## Product mood

Warm editorial planning tool, not a generic analytics dashboard and not a futuristic/AI visual demo.

Desired emotional qualities:
- calm;
- credible;
- spatial;
- commercially useful;
- transparent about uncertainty/evidence;
- polished enough for a client presentation without feeling theatrical.

## Current palette

### Surfaces
- Shell ivory: `#faf8f5`
- Map warm grey: `#f2efe9`
- Primary card: `#ffffff`
- Soft secondary surface: `#fbfbfa`
- Technical neutral: `#f7f8f8`

### Text
- Heading / primary: `#1c2026`
- Body: `#5c6272`
- Strong caption: `#667085`
- Secondary neutral: around `#6a7180`

### Primary accent
- Deep teal: `#0f5b4e`
- Soft teal surface: `#e7f1ee` / `#edf5f2`
- Used for selected/approved/planning-action states and Evidence C styling.

### Secondary accent
- Warm gold: `#c7982c`
- Accessible dark gold text: around `#765314`
- Soft gold surface: `#fdf6e3`
- Used for recommendation emphasis and Evidence D, not as a second generic CTA color.

### Error/constraint
- Muted red/brown for invalid/overrun states; avoid alarm-red for normal evidence caveats.

## Evidence color semantics

Color never stands alone.
- Evidence C: teal + explicit `Evidence C` text.
- Evidence D: gold + explicit `Evidence D` text.
- Unavailable: neutral grey + explicit unavailable text/recovery.

Do not imply higher confidence through visual polish. Evidence semantics come from the engine.

## Typography

- Current intended family: Inter/system sans.
- Product hierarchy matters more than novelty of typeface.
- Step title: ~24px, heavy but not display-sized.
- Section title: ~15–18px.
- Card title: ~13–16px.
- Body: ~12–14px with 1.4–1.5 line height.
- Captions/eyebrows: 10–12px, semibold/bold, limited uppercase.
- Large commercial/delivery values: tabular numerals.

Avoid shrinking technical information below readable sizes merely to preserve layout.

## Shape and elevation

- Major decision card: ~18px radius.
- Subcards: ~9–14px radius.
- Pills only for compact state/evidence/status elements.
- Hairline neutral borders.
- Shadows are soft and shallow; elevation communicates foreground decision surface, not decoration.

## Motion

- Card entry: short editorial slide/fade.
- Map focus: ~400ms spatial transition.
- Choice-card hover: subtle lift.
- No parallax, glow, looping motion or decorative map animation.
- `prefers-reduced-motion` collapses movement to effectively instant.

## Product-specific visual signature

The signature should come from the planning domain:
1. numbered recommendation roles (`#1 Primary`, `#2 Booster`, `#3 Cover`);
2. cartographic marker + zone-label language;
3. explicit Evidence C/D/unavailable lozenges;
4. deep-teal planning state plus warm-gold recommendation/evidence emphasis;
5. map focus paired with human explanation.

Do not add gradients, neon, glassmorphism, abstract AI waves, excessive icons or dashboard charts merely to create brand character.
