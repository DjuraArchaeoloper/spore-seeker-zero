import assert from "node:assert/strict";
import test from "node:test";

import { SEEKER_ZERO_GENOME, phenotypeFromGenome } from "../src/genome.ts";
import { ORGANISM_RUNTIME_CANVAS } from "../src/organismArt.ts";
import { createOrganismRenderModel } from "../src/organismRenderPlan.ts";

const BASE_GENOME = Array.from(SEEKER_ZERO_GENOME);
const ORGANISM_ONE_GENOME = Array.from(Buffer.from("53504f52459a00005345454b45520000", "hex"));

const GENE_VISUAL_SELECTORS = [
  {
    gene: 0,
    name: "body form",
    select: (model) => ({
      biologicalTransform: model.plan.biologicalTransform,
      bodyTransform: model.plan.bodyTransform,
      family: model.family.id
    })
  },
  {
    gene: 1,
    name: "body proportion",
    select: (model) => ({
      biologicalTransform: model.plan.biologicalTransform,
      family: model.family.id
    })
  },
  {
    gene: 2,
    name: "membrane shape",
    select: (model) => ({
      finAccentRotation: model.plan.finAccentRotation,
      finAccentScaleX: model.plan.finAccentScaleX,
      finAccentScaleY: model.plan.finAccentScaleY,
      finTransform: model.plan.finTransform,
      family: model.family.id
    })
  },
  {
    gene: 3,
    name: "membrane density",
    select: (model) => ({
      baseAnatomyOpacity: model.plan.baseAnatomyOpacity,
      finAccentOpacity: model.plan.finAccentOpacity
    })
  },
  {
    gene: 4,
    name: "pigment",
    select: (model) => model.colorPlan
  },
  {
    gene: 5,
    name: "bioluminescence",
    select: (model) => ({
      colorPlan: model.colorPlan,
      coreOpacity: model.plan.coreOpacity,
      finAccentOpacity: model.plan.finAccentOpacity,
      glowOpacity: model.plan.glowOpacity,
      glowTransform: model.plan.glowTransform,
      internalFilamentOpacity: model.plan.internalFilamentOpacity
    })
  },
  {
    gene: 6,
    name: "nucleus",
    select: (model) => ({
      coreOpacity: model.plan.coreOpacity,
      coreTransform: model.plan.coreTransform
    })
  },
  {
    gene: 7,
    name: "sensory nodes",
    select: (model) => model.plan.sensoryNodes
  },
  {
    gene: 8,
    name: "appendage family",
    select: (model) => ({
      family: model.family.id,
      finTransform: model.plan.finTransform,
      tendrilOpacity: model.plan.tendrilOpacity,
      tendrilTransform: model.plan.tendrilTransform
    })
  },
  {
    gene: 9,
    name: "appendage expression",
    select: (model) => ({
      finTransform: model.plan.finTransform,
      rootFloatPx: model.plan.rootFloatPx,
      rootSwayRad: model.plan.rootSwayRad,
      tendrilTransform: model.plan.tendrilTransform
    })
  },
  {
    gene: 10,
    name: "surface pattern",
    select: (model) => model.plan.surfaceLayers
  },
  {
    gene: 11,
    name: "surface density",
    select: (model) => ({
      surfaceLayers: model.plan.surfaceLayers,
      surfaceOpacity: model.plan.surfaceOpacity
    })
  },
  {
    gene: 12,
    name: "internal filaments",
    select: (model) => ({
      colorPlan: model.colorPlan.filamentMatrix,
      internalFilamentOpacity: model.plan.internalFilamentOpacity,
      internalFilamentTransform: model.plan.internalFilamentTransform
    })
  },
  {
    gene: 13,
    name: "external halo",
    select: (model) => ({
      haloBlur: model.plan.haloBlur,
      haloOpacity: model.plan.haloOpacity,
      haloTransform: model.plan.haloTransform
    })
  },
  {
    gene: 14,
    name: "motion and static pose",
    select: (model) => ({
      biologicalTransform: model.plan.biologicalTransform,
      glowTransform: model.plan.glowTransform,
      rootFloatPx: model.plan.rootFloatPx,
      rootSwayRad: model.plan.rootSwayRad
    })
  },
  {
    gene: 15,
    name: "asymmetry",
    select: (model) => ({
      bodyTransform: model.plan.bodyTransform,
      coreTransform: model.plan.coreTransform,
      finTransform: model.plan.finTransform,
      tendrilTransform: model.plan.tendrilTransform
    })
  }
];

function withGene(genome, index, value) {
  const nextGenome = Array.from(genome);
  nextGenome[index] = value;

  return nextGenome;
}

function representativeMutationValue(index) {
  const value = (BASE_GENOME[index] + 137) & 0xff;

  return value === BASE_GENOME[index] ? (value + 1) & 0xff : value;
}

function renderModel(genome) {
  return createOrganismRenderModel(genome, ORGANISM_RUNTIME_CANVAS.width);
}

function staticSignature(model) {
  return JSON.stringify({
    colorPlan: model.colorPlan,
    family: model.family.id,
    plan: model.plan,
    rendererRevision: model.rendererRevision
  });
}

function assertFiniteAndBounded(value, path = []) {
  if (typeof value === "number") {
    assert.ok(Number.isFinite(value), `${path.join(".")} must be finite`);
    assert.ok(Math.abs(value) < 100_000, `${path.join(".")} must be bounded`);

    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    assertFiniteAndBounded(child, [...path, key]);
  }
}

test("same genome produces identical render model data", () => {
  assert.deepEqual(renderModel(BASE_GENOME), renderModel(BASE_GENOME));
});

test("each gene changes its relevant visual render data", () => {
  const parent = renderModel(BASE_GENOME);

  for (const { gene, name, select } of GENE_VISUAL_SELECTORS) {
    const child = renderModel(withGene(BASE_GENOME, gene, representativeMutationValue(gene)));

    assert.notDeepEqual(select(child), select(parent), `gene ${gene} (${name}) did not change selected visual data`);
  }
});

test("every Seeker Zero one-gene byte mutation changes static render-derived data", () => {
  const parentSignature = staticSignature(renderModel(BASE_GENOME));

  for (let gene = 0; gene < BASE_GENOME.length; gene += 1) {
    for (let value = 0; value <= 255; value += 1) {
      if (value === BASE_GENOME[gene]) {
        continue;
      }

      const childSignature = staticSignature(renderModel(withGene(BASE_GENOME, gene, value)));

      assert.notEqual(childSignature, parentSignature, `gene ${gene} value ${value} produced identical static render data`);
    }
  }
});

test("gene 14 changes both animated behavior and static pose", () => {
  const parent = renderModel(BASE_GENOME);
  const child = renderModel(withGene(BASE_GENOME, 14, representativeMutationValue(14)));

  assert.notDeepEqual(child.phenotype.motion.periodMs, parent.phenotype.motion.periodMs);
  assert.notDeepEqual(child.phenotype.motion.pulseScaleAmplitude, parent.phenotype.motion.pulseScaleAmplitude);
  assert.notDeepEqual(child.plan.rootFloatPx, parent.plan.rootFloatPx);
  assert.notDeepEqual(child.plan.rootSwayRad, parent.plan.rootSwayRad);
  assert.notDeepEqual(child.plan.biologicalTransform, parent.plan.biologicalTransform);
});

test("real organism 0 to 1 bioluminescence mutation changes perceptual luminous channels", () => {
  const parent = renderModel(BASE_GENOME);
  const child = renderModel(ORGANISM_ONE_GENOME);

  assert.equal(parent.family.id, "silk-ray");
  assert.equal(child.family.id, "silk-ray");
  assert.ok(child.plan.glowOpacity - parent.plan.glowOpacity > 0.18);
  assert.ok(child.plan.finAccentOpacity - parent.plan.finAccentOpacity > 0.06);
  assert.ok(child.plan.internalFilamentOpacity - parent.plan.internalFilamentOpacity > 0.03);
  assert.ok(child.plan.coreOpacity - parent.plan.coreOpacity > 0.08);
  assert.ok(child.phenotype.bioluminescence.coreBrightness - parent.phenotype.bioluminescence.coreBrightness > 0.24);
});

test("cosmetic pigment mutation does not reroll shape or family", () => {
  const parent = renderModel(BASE_GENOME);
  const child = renderModel(withGene(BASE_GENOME, 4, representativeMutationValue(4)));

  assert.equal(child.family.id, parent.family.id);
  assert.deepEqual(child.plan, parent.plan);
  assert.notDeepEqual(child.colorPlan, parent.colorPlan);
});

test("family transition preserves unrelated genetic traits", () => {
  const parentGenome = BASE_GENOME;
  const childGenome = withGene(parentGenome, 1, 0xdd);
  const parentModel = renderModel(parentGenome);
  const childModel = renderModel(childGenome);
  const parentPhenotype = phenotypeFromGenome(parentGenome);
  const childPhenotype = phenotypeFromGenome(childGenome);

  assert.notEqual(childModel.family.id, parentModel.family.id);
  assert.deepEqual(childModel.colorPlan, parentModel.colorPlan);
  assert.deepEqual(childPhenotype.pigment, parentPhenotype.pigment);
  assert.deepEqual(childPhenotype.bioluminescence, parentPhenotype.bioluminescence);
  assert.deepEqual(childPhenotype.core, parentPhenotype.core);
  assert.deepEqual(childPhenotype.sensoryNodes, parentPhenotype.sensoryNodes);
  assert.deepEqual(childPhenotype.appendages, parentPhenotype.appendages);
  assert.deepEqual(childPhenotype.surface, parentPhenotype.surface);
  assert.deepEqual(childPhenotype.internalFilaments, parentPhenotype.internalFilaments);
  assert.deepEqual(childPhenotype.halo, parentPhenotype.halo);
  assert.deepEqual(childPhenotype.motion, parentPhenotype.motion);
  assert.deepEqual(childPhenotype.asymmetry, parentPhenotype.asymmetry);
});

test("render model values remain finite and bounded across all byte values", () => {
  for (let gene = 0; gene < BASE_GENOME.length; gene += 1) {
    for (let value = 0; value <= 255; value += 1) {
      assertFiniteAndBounded(renderModel(withGene(BASE_GENOME, gene, value)));
    }
  }
});
