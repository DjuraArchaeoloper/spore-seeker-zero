# SPORE — Genome → Phenotype Contract v1

This documents the visual contract for the 16-byte SPORE genome.

The live source of truth is `packages/shared/src/genome.ts`. Do not create or maintain
a second genome-to-phenotype implementation in docs or app code.

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

`familySlot = floor((mix8(genome[0]) * 10) / 256)`

| Slot | Family |
|---|---|
| 0 | Void Drifter |
| 1 | Crystal Bloom |
| 2 | Nebula Spine |
| 3 | Celestial Queen |
| 4 | Pearl Medusa |
| 5 | Prism Spine |
| 6 | Astral Chrysalis |
| 7 | Nova Urchin |
| 8 | Silk Ray |
| 9 | Ribbon Leviathan |

This order is intentional: the canonical Seeker Zero BODY FORM byte is `0x53`; it resolves to slot 8 and therefore **Silk Ray**.

This mapping must stay explicit. Do not derive it from the runtime art registry, an array length, or the number of available asset folders. Adding or replacing art is not itself a genome-mapping change.

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

The exact formulas are implemented only in `packages/shared/src/genome.ts`.

## Parent/child rule

A normal child copies all 16 bytes from its parent and exactly one byte changes.

Therefore the renderer must **not** let one gene secretly control unrelated visual traits. A mutation should visibly alter the trait owned by that byte while leaving the rest of the organism recognizably inherited.

BODY FORM is intentionally the largest possible mutation because it selects the anatomical foundation family. Other genes are materially smaller changes.

## Runtime family registry

Shared family data lives in `packages/shared/src/organismArt.ts`.
The mobile registry at `apps/mobile/assets/organisms/registry.ts` is only a Metro
adapter that maps shared family definitions to static `require()` asset IDs.

Each family uses one explicit definition:

```ts
type CreatureFamilyDefinition = {
  id: CreatureFamily;
  layers: Record<CreatureLayer, string>;
  moustache: {
    center: readonly [number, number];
    width: number;
    rotationDeg: number;
  };
  sensoryAnchors: readonly (readonly [number, number])[];
};
```

The renderer consumes this definition and should not contain ordinary per-family branches such as `if family === "silk-ray"`. Family-specific asset paths, moustache placement, and sensory anchors belong in shared art metadata.

Metro requires static image paths, so the mobile adapter must keep literal `require("../../../../packages/shared/assets/organisms/family/file.png")` calls. Do not replace those with dynamic `require()` paths.

The shared moustache lives at `packages/shared/assets/organisms/shared/moustache_01.png`. Families provide moustache anchor metadata only; they do not need their own moustache artwork.

## Family folder contract

Shared runtime assets live under:

`packages/shared/assets/organisms/`

Mobile bundles those shared files through static requires in:

`apps/mobile/assets/organisms/registry.ts`

Every runtime biological family folder must contain exactly these six required biological layers:

```text
packages/shared/assets/organisms/<family-id>/
  body.png
  fins.png
  core.png
  tendrils.png
  surface.png
  glow.png
```

Runtime biological assets are **1024×1024 transparent PNGs**.

High-resolution source masters live under:

`docs/spore-creature-art-kit/source-2048/`

Each source family folder should use the same six filenames at **2048×2048** unless the art lead explicitly approves a different source-master size:

```text
docs/spore-creature-art-kit/source-2048/<family-id>/
  body.png
  fins.png
  core.png
  tendrils.png
  surface.png
  glow.png
```

Do **not** bundle source masters, contact sheets, or reference previews into the mobile app.

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

## Canvas and coordinate contract

All biological layer files in one family must share the exact same canvas:

- runtime: 1024 x 1024 transparent PNG
- source master: 2048 x 2048 transparent PNG unless explicitly approved otherwise
- same origin
- same center
- same normalized coordinate system
- same transparent padding strategy

Layers are authored in position. The runtime should not guess where body parts attach, trim files, recenter individual layers, or apply family-specific registration corrections. If a layer needs to move to look correct, the PNG is wrong and should be repaired at the art-source level.

The renderer is allowed to apply the deterministic phenotype transforms defined above. Every approved family must still look coherent after those existing transforms. Do not approve artwork that only looks joined in one static preview but separates under the allowed body proportion, membrane, appendage, surface, core, halo, and asymmetry transforms.

## Join and layer ownership contract

Parts that join must overlap generously beneath neighboring anatomy. Never rely on two transparent cut edges meeting perfectly pixel to pixel.

Bad:

```text
body edge | fin edge
```

Good:

```text
fin extends underneath body; body hides the attachment
```

Body artwork should cover or hide major attachment joins where appropriate. Fins, membranes, appendages, and tendrils must extend far enough beneath the body that filtering, scaling, and subtle transforms do not reveal slivers.

Layer ownership rules:

- `body.png` contains the central body/membrane mass that should visually own major joins.
- `fins.png` contains fin, wing, veil, or membrane anatomy that attaches under the body.
- `core.png` contains core-specific internal material only.
- `tendrils.png` contains tendrils and appendage anatomy only.
- `surface.png` contains surface/detail information only.
- `glow.png` contains glow/halo energy only.

Do not use one layer to secretly patch another layer with duplicate anatomy. In particular:

- `tendrils.png` must not include duplicate fin or body structures just to hide weak joins.
- `core.png` must not bake broad body or surface structures that prevent the nucleus gene from feeling meaningful.
- `surface.png` must not contain accidental rectangular transparent holes, hard mask cutouts, or large unrelated anatomy.

Alpha edges must be clean and intentionally feathered. No visible background pixels are allowed. Transparent areas must be truly transparent.

Each family must be inspected as a full composite before approval. The final composite must look seamless before flattening. Flattening is a performance and stability step, not a seam repair technique.

## Adding or replacing families

To add a new family:

1. Add a standardized runtime folder under `packages/shared/assets/organisms/<family-id>/`.
2. Add the six required runtime PNGs.
3. Add matching source masters under `docs/spore-creature-art-kit/source-2048/<family-id>/`.
4. Add one `CreatureFamilyArtDefinition` entry in `packages/shared/src/organismArt.ts`.
5. Add static mobile `require()` asset IDs for the shared PNGs in `apps/mobile/assets/organisms/registry.ts`.
6. Update the explicit body-form mapping in `packages/shared/src/genome.ts` only when the new genome slot assignment is intentionally approved.

To replace an existing family, keep the same family id and filenames, replace the six runtime PNGs and source masters, and update only the shared metadata that the renderer actually uses, such as sensory anchors or moustache placement.

Adding or replacing art that follows this contract should not require renderer changes.
