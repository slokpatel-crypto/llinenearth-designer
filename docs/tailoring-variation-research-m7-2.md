# Linen Earth Tailoring Variation Research — M7.2

Research date: 2026-10-06

Purpose: normalize real shirt and trouser tailoring constructions into a generic Linen Earth vocabulary, then drive the exact same names through the 3D variation engine. Brand-specific marketing names are intentionally not used as customer options.

## Shirt matrix

### Shirt families
Dress shirt; business spread-collar shirt; Oxford button-down; casual shirt; camp/resort shirt; band-collar shirt; popover; overshirt/shirt-jacket; western shirt; safari/utility shirt; tuxedo/formal shirt; short-sleeve shirt.

### Fit / wear / sleeve
Slim; tailored; regular/classic; relaxed; boxy/oversized.
Tucked or untucked.
Full; three-quarter; short/half; rolled.

### Collar shape
Point; semi-spread; spread; cutaway; button-down; hidden button-down; club/rounded; tab; wingtip; mandarin/band; camp/Cuban; one-piece/California.
Collar construction is separate: stiff fused; soft fused; soft/unfused.

### Cuffs
One-button barrel; long one-button barrel; one-button mitered; two-button rounded; two-button mitered; square French/double; rounded French; convertible; soft one-button; cocktail/turnback.
Cuff construction is separate: fused/crisp or soft/unfused.

### Front / placket
Standard front; soft front; French/no-placket; covered/fly front; popover; western; tuxedo plain; tuxedo pleated bib.

### Shirt pockets
None; single rounded; single angled; button angled; single flap; double western flap; double rounded flap; dual utility; dual safari pleated; dual reverse-pleat.

### Yoke
One-piece; split; western; bias-cut western.

### Hem
Rounded/shirttail; straight; polo/drop-tail.

### Back construction
Plain back; rear side/knife pleats; center box pleat; locker-loop box pleat; back darts.

Reference dimensions used in the model:
- rear side pleats: 0.5 in each, adding 2 in total upper-back ease
- center box pleat: 0.75 in each side, adding 3 in total upper-back ease
- back darts: two darts removing 1.5 in total, 0.75 in at each dart's widest point

## Trouser matrix

### Trouser families
Formal flat-front; bespoke side-adjuster; high-rise double-pleat; Gurkha-style; cropped/ankle; wide-leg drape; relaxed linen drawstring; tailored chino; jean-cut suiting; cargo/utility; Korean high-rise tapered.

### Leg silhouette
Skinny/cigarette; slim tapered; regular tapered; straight classic; relaxed straight; wide-leg drape; baggy/extra-wide.

### Rise
Low; mid; high/natural-waist.

### Pleats
Flat front; single forward; single reverse; double forward; double reverse; kissing/box pleat.
Forward/reverse direction is stored explicitly because the visual fold direction differs.

### Waistband
Plain/clean; belt loops; side adjusters; extended/Gurkha tab; drawstring/elastic; brace/suspender buttons.

### Break
Negative/cropped; no break; quarter break; slight/half break; full break.

### Hem finish
Plain hem; 4 cm turn-up/cuff; 5 cm turn-up/cuff.

### Pocket construction
Slant side; on-seam; frogmouth/horizontal; jean/scoop; single welt back; double jetted back.

## Sources reviewed

Proper Cloth — collar styles:
https://propercloth.com/reference/dress-shirt-collar-styles/

Proper Cloth — shirt style/collar catalogue:
https://propercloth.com/shirt-styles

Proper Cloth — cuff styles:
https://propercloth.com/reference/dress-shirt-cuff-styles/

Proper Cloth — cuff selection/construction:
https://propercloth.com/reference/how-to-choose-dress-shirt-cuff-style/

Proper Cloth — placket/front types:
https://propercloth.com/reference/dress-shirt-front-placket-types/

Proper Cloth — pocket styles:
https://propercloth.com/reference/dress-shirt-pocket-styles/

Proper Cloth — split vs one-piece yokes:
https://propercloth.com/reference/dress-shirts-split-yoke-vs-one-piece-yoke/

Proper Cloth — shirt hem types:
https://propercloth.com/reference/dress-shirt-hem-types/

Proper Cloth — shirt rear pleats:
https://propercloth.com/reference/dress-shirt-back-pleat-options/

Proper Cloth — shirt back darts:
https://propercloth.com/reference/darts/

Permanent Style — trouser pleat number/direction:
https://www.permanentstyle.com/2019/11/suit-style-7-a-guide-to-pleats-on-trousers.html

Permanent Style — rise:
https://www.permanentstyle.com/2020/08/what-are-low-medium-and-high-rise-trousers.html

Permanent Style — trouser cut/proportion:
https://www.permanentstyle.com/2018/04/trouser-measurements-style-and-proportions.html

Permanent Style — cuffs/turn-ups and waistband details:
https://www.permanentstyle.com/2020/01/suit-style-9-trouser-cuffs-belts-and-tabs.html

Oliver Wicks — trouser break / fit:
https://www.oliverwicks.com/article/the-ideal-fit

Black Lapel — custom trouser construction:
https://blacklapel.com/pages/custom-dress-pants-trouser-quality-guide

## Implementation rule

Every option is a deterministic construction state on one locked Linen Earth mannequin. Fabric selection remains independent. No option may create a new person/model identity. Fabric pattern scale, texture phase, roughness and drape response continue through the same panel-material pipeline.
