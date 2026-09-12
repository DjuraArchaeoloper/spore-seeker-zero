# SPORE — Genome → Phenotype Contract v1

This is the visual source of truth for the 16-byte SPORE genome.

**Genome remains canonical. Phenotype is always derived and must never be persisted.**
The same 16 bytes must always render the same organism.

## Byte mixing

For visual parameters, use:

```ts
mix8(x) = ((x * 73) + 41) & 255
unit(x) = mix8(x) / 255
signed(x) = unit(x) * 2 - 1
```

The mixing step is deterministic and makes nearby byte values less likely to look nearly identical.

## Body-family mapping

`familyBucket = mix8(genome[0]) >> 6`

| Bucket | Family |
|---|---|
| 0 | Void Drifter |
| 1 | Crystal Bloom |
| 2 | Nebula Spine |
| 3 | Silk Ray |

This order is intentional: the canonical Seeker Zero BODY FORM byte is `0x53`; it resolves to bucket 3 and therefore **Silk Ray**.

## 16 locked genes

| Byte | Gene | v1 rendering responsibility |
|---:|---|---|
| 0 | BODY FORM | Select family bundle + subtle within-family form warp |
| 1 | BODY PROPORTION | Global biological X/Y proportion |
| 2 | MEMBRANE SHAPE | Fin/membrane scale and opposing left/right rotation |
| 3 | MEMBRANE DENSITY | Body + fin opacity/translucency |
| 4 | PIGMENT | Restrained hue shift and saturation |
| 5 | BIOLUMINESCENCE | Glow opacity/scale and core brightness |
| 6 | NUCLEUS | Core mode, scale, rotation and opacity |
| 7 | SENSORY NODES | Count, radius, opacity and deterministic fixed-anchor selection |
| 8 | APPENDAGE FAMILY | Wing / veil / filament / spine expression preset |
| 9 | APPENDAGE EXPRESSION | Appendage scale, tendril visibility and motion amount |
| 10 | SURFACE PATTERN | Native / mirror / ghost-double / radial-echo surface treatment |
| 11 | SURFACE DENSITY | Surface detail opacity and contrast |
| 12 | INTERNAL FILAMENTS | Internal detail pass opacity, scale and slight hue offset |
| 13 | EXTERNAL HALO | Halo opacity, scale and blur |
| 14 | MOTION / PULSE | Pulse period/amplitude, fin wave and tendril drift |
| 15 | ASYMMETRY | Opposed left/right scale/rotation + tiny core offset |

The exact formulas are implemented in `phenotype-reference.ts` beside this file.

## Parent/child rule

A normal child copies all 16 bytes from its parent and exactly one byte changes.

Therefore the renderer must **not** let one gene secretly control unrelated visual traits. A mutation should visibly alter the trait owned by that byte while leaving the rest of the organism recognizably inherited.

BODY FORM is intentionally the largest possible mutation because it selects the anatomical foundation family. Other genes are materially smaller changes.

## Art rules

Runtime mobile assets live under:

`apps/mobile/assets/organisms/`

They are **1024×1024 transparent PNGs**.

High-resolution 2048×2048 art source is under:

`docs/spore-creature-art-kit/source-2048/`

Do **not** bundle source masters, contact sheets or reference previews into the mobile app.

Layer order:

1. glow
2. fins
3. body
4. tendrils
5. core
6. surface
7. sensory-node Skia accents
8. shared moustache

The moustache is cosmetic only and must remain controlled by one global constant:

```ts
SHOW_MOUSTACHE = true
```

It is not a genome trait and must never appear in NFT trait metadata.
