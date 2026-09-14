# CODEX TASK — SPORE CREATURE ART KIT V1 INTEGRATION

Read the repository and `SPORE_DOCTRINE.md` if it exists. Treat the doctrine as product law.

## Goal

Replace the rejected procedural creature visual path with the approved hybrid system:

**premium art assets + deterministic genome logic + React Native Skia**

Do not add product features. Do not redesign the app. Do not invent new creature artwork.

Build the smallest production-quality implementation required to render the organism from its canonical 16-byte genome.

## New assets already in the repo

Runtime assets are under:

`apps/mobile/assets/organisms/`

There are four approved anatomy families:

- `silk-ray`
- `void-drifter`
- `crystal-bloom`
- `nebula-spine`

Each family contains:

- `body.png`
- `fins.png`
- `core.png`
- `tendrils.png`
- `surface.png`
- `glow.png`

Shared cosmetic:

`apps/mobile/assets/organisms/shared/moustache_01.png`

Metadata:

- `apps/mobile/assets/organisms/registry.ts`
- `apps/mobile/assets/organisms/registry.ts.example`

`registry.ts` is the mobile runtime source of truth. Each family has one `CreatureFamilyDefinition` containing its id, six biological assets, sensory anchors, and moustache placement. Do not build runtime logic from `registry.json`.

The mobile runtime files are 1024×1024 transparent PNGs with a shared registration canvas.

High-resolution files under `docs/spore-creature-art-kit/` are references/source material only.
DO NOT import those into the mobile runtime.

## Exact genome contract

Read and implement exactly:

- `docs/spore-creature-art-kit/GENOME_PHENOTYPE_CONTRACT.md`
- `docs/spore-creature-art-kit/phenotype-reference.ts`

Do not invent a second mapping.

Genome is exactly 16 bytes:

0 BODY FORM
1 BODY PROPORTION
2 MEMBRANE SHAPE
3 MEMBRANE DENSITY
4 PIGMENT
5 BIOLUMINESCENCE
6 NUCLEUS / INTERNAL CORE
7 SENSORY NODES
8 APPENDAGE / WING FAMILY
9 APPENDAGE EXPRESSION
10 SURFACE PATTERN
11 SURFACE DENSITY
12 INTERNAL FILAMENTS
13 EXTERNAL HALO
14 MOTION / PULSE
15 ASYMMETRY

Canonical Seeker Zero genome MUST remain:

`53 50 4F 52 45 00 00 00 53 45 45 4B 45 52 00 00`

Do not change it.

## Rendering requirements

Use the existing React Native Skia stack.

Create/adapt one clear renderer that accepts a 16-byte genome and produces the creature.

Use static asset requires/imports compatible with Metro. Do not use dynamic `require()` paths.

Load only the selected anatomy family's images.

Render in this conceptual order:

1. glow
2. fins
3. body
4. tendrils
5. core
6. surface
7. sensory-node accents
8. moustache

Use the selected family's shared registration rectangle. Do not independently crop/recenter layers.

Apply the phenotype contract with Skia transforms, opacity, color filters and image effects.

### Important implementation behavior

- BODY FORM selects the family using the exact bucket mapping in the contract.
- BODY PROPORTION scales the biological stack coherently.
- MEMBRANE SHAPE may render the fin layer as left/right clipped halves so opposing rotation is possible.
- MEMBRANE DENSITY changes transparency, not anatomy.
- PIGMENT should use restrained hue/saturation filtering. Do not create crypto-neon rainbow creatures.
- BIOLUMINESCENCE controls the glow layer and luminous core intensity.
- NUCLEUS transforms the core layer only.
- SENSORY NODES should be tiny restrained Skia circles using the fixed family anchors in `registry.json`. Render the first `count` anchors. No per-frame randomness.
- APPENDAGE FAMILY and APPENDAGE EXPRESSION transform/mix the existing fins and tendrils. Do not generate replacement procedural anatomy.
- SURFACE PATTERN may redraw the surface layer according to the four exact modes in the contract.
- INTERNAL FILAMENTS should reuse a restrained internal detail pass; do not generate a giant procedural web.
- EXTERNAL HALO uses the glow asset/effect.
- MOTION is slow, organic and subtle.
- ASYMMETRY should be small. Do not make the creature look broken.

All animation must be deterministic for a given genome except for time progression.
Do not call `Math.random()` in the render path.

## Moustache — locked

Every organism has the shared black moustache by default.

Implement:

`SHOW_MOUSTACHE = true`

The moustache:

- is cosmetic only
- is not derived from genome
- is not an NFT trait
- has no settings screen
- must be globally removable by changing the one constant

Use each family's moustache placement data from `registry.ts`.
Keep it tiny and immaculate.

## Parent/child resemblance

This is a critical acceptance condition.

A child changes exactly one genome byte.

If only gene N changes, all unrelated visual properties must remain identical.

Do not seed the entire renderer from a whole-genome random number in a way that causes every visual property to change after one mutation.

BODY FORM may be a large mutation; the other 15 genes should remain localized to their owned trait.

## Existing product behavior

Preserve:

- existing auth
- Seeker/SGT identity logic
- Solana logic
- API behavior
- navigation
- Specimen / Bloodline / Species surfaces
- visual preview mode
- current production behavior outside creature rendering

`EXPO_PUBLIC_SPORE_VISUAL_PREVIEW=true` must continue to work for visual QA without creating fake wallet/session/SGT identity.

In preview mode, render canonical Seeker Zero using the locked genome above.

## Visual quality

The organism is the hero.

Target:

- translucent deep-sea biology
- premium macro specimen
- elegant
- eerie
- alive
- restrained bioluminescence

Avoid:

- procedural blobs
- eggs/cysts/sacks
- Pokémon/Tamagotchi styling
- cartoon faces
- generic Web3 neon
- random particle clutter
- giant glows that wash out the art
- unnecessary UI cards

Do not cover the creature with debug labels.

## Performance

The runtime images are intentionally 1024px, not the 2048px art-source files.

Avoid loading all four families' decoded images simultaneously if the existing architecture allows loading only the selected family.

Do not add a caching framework or new dependency unless the existing renderer genuinely requires it.

## Source organization

Prefer reusing the existing genome/phenotype/renderer structure rather than creating parallel architecture.

If there is already a phenotype helper in `packages/shared`, adapt it to the locked contract rather than duplicating it.

If there is already a creature renderer component, replace its rejected procedural art implementation while preserving its public interface where practical.

Do not add speculative future architecture.

## Verification fixtures

`docs/spore-creature-art-kit/preview-genomes.json` contains canonical Seeker Zero plus one single-gene mutation fixture for each of the 16 genes.

Use those as visual-development fixtures if useful, but do not build a new user-facing gallery or screen for them.

## Command doctrine

Make source changes only.

Unless explicitly requested, DO NOT run:

- builds
- tests
- lint
- typecheck
- dev servers
- deployments
- expensive verification commands

When finished, report:

1. files changed
2. how the renderer now maps genome → phenotype
3. where `SHOW_MOUSTACHE` lives
4. any art-layer limitation you found that genuinely blocks visual quality

Do not claim visual success without noting any real limitation you can see from the asset structure.
