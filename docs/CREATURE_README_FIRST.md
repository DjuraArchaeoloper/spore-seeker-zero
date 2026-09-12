# SPORE Creature Art Kit v1 — Repo Ready

## What this package is

This package is the consolidated v1 creature system for SPORE / Seeker Zero.

It contains the four approved anatomy foundations:

- 01 Silk Ray
- 03 Void Drifter
- 04 Crystal Bloom
- 06 Nebula Spine

The mobile runtime uses modular 1024×1024 transparent PNG layers.
The 2048×2048 source art stays under `docs/` so it is not accidentally bundled into the mobile app.

## What you do

1. Extract this ZIP at the root of the SPORE monorepo.
2. Confirm you now have `apps/mobile/assets/organisms/`.
3. Open Codex at the repository root.
4. Paste the contents of `PASTE_THIS_INTO_CODEX.md`.
5. Let Codex make source changes only; do not ask it to invent creature artwork.

## Runtime tree

```text
apps/mobile/assets/organisms/
├── registry.json
├── registry.ts.example
├── shared/
│   └── moustache_01.png
├── silk-ray/
│   ├── body.png
│   ├── fins.png
│   ├── core.png
│   ├── tendrils.png
│   ├── surface.png
│   └── glow.png
├── void-drifter/
├── crystal-bloom/
└── nebula-spine/
```

Each family folder has the same six layer names.

## Critical locks

- Genome = exactly 16 bytes.
- Canonical Seeker Zero genome is unchanged.
- Same genome always yields the same phenotype.
- Exactly one mutated byte must only alter that gene's owned visual trait.
- No rarity system.
- Moustache is shared, cosmetic only, not genomic, and controlled by `SHOW_MOUSTACHE = true`.
- Codex must not return to procedural creature invention.
