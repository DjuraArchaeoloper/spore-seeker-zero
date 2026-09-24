import assert from "node:assert/strict";
import test from "node:test";

import {
  BODY_FAMILY_SLOTS,
  MORPHOLOGY_PROFILE_BY_FAMILY,
  SEEKER_ZERO_GENOME,
  genomeToHex,
  mix8,
  morphologyDistanceSquared,
  morphologyFromGenome,
  phenotypeFromGenome,
  resolveCreatureFamily,
  resolveCreatureFamilyFromMorphology
} from "../src/genome.ts";

const STRUCTURAL_GENE_BY_PROFILE_KEY = {
  bodyForm: 0,
  proportion: 1,
  membrane: 2,
  appendageFamily: 8,
  appendageExpression: 9,
  asymmetry: 15
};

const MORPHOLOGY_KEYS = Object.keys(STRUCTURAL_GENE_BY_PROFILE_KEY);

function byteClosestToUnit(target) {
  let bestByte = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let byte = 0; byte <= 255; byte += 1) {
    const distance = Math.abs(mix8(byte) / 255 - target);

    if (distance < bestDistance) {
      bestByte = byte;
      bestDistance = distance;
    }
  }

  return bestByte;
}

function genomeNearProfile(profile) {
  const genome = Array.from(SEEKER_ZERO_GENOME);

  for (const [key, index] of Object.entries(STRUCTURAL_GENE_BY_PROFILE_KEY)) {
    genome[index] = byteClosestToUnit(profile[key]);
  }

  return genome;
}

function withGene(genome, index, value) {
  const nextGenome = Array.from(genome);
  nextGenome[index] = value;

  return nextGenome;
}

function independentFamilyResolution(morphology) {
  return Object.keys(MORPHOLOGY_PROFILE_BY_FAMILY)
    .reverse()
    .reduce(
      (best, family) => {
        const distance = morphologyDistanceSquared(morphology, MORPHOLOGY_PROFILE_BY_FAMILY[family]);
        const isBetter =
          distance < best.distance ||
          (distance === best.distance && (best.family === null || family < best.family));

        return isBetter ? { family, distance } : best;
      },
      { family: null, distance: Number.POSITIVE_INFINITY }
    ).family;
}

function collectFiniteNumberPaths(value, path = []) {
  if (typeof value === "number") {
    assert.ok(Number.isFinite(value), `${path.join(".")} must be finite`);
    assert.ok(Math.abs(value) < 100_000, `${path.join(".")} must stay in a reasonable range`);

    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    collectFiniteNumberPaths(child, [...path, key]);
  }
}

test("same genome always returns the same phenotype", () => {
  const fromBytes = phenotypeFromGenome(SEEKER_ZERO_GENOME);
  const fromHex = phenotypeFromGenome(genomeToHex(SEEKER_ZERO_GENOME));

  assert.deepEqual(fromBytes, phenotypeFromGenome(SEEKER_ZERO_GENOME));
  assert.deepEqual(fromBytes, fromHex);
});

test("Seeker Zero resolves to silk-ray through morphology", () => {
  const phenotype = phenotypeFromGenome(SEEKER_ZERO_GENOME);

  assert.equal(phenotype.family, "silk-ray");
  assert.equal(resolveCreatureFamily(SEEKER_ZERO_GENOME), "silk-ray");
  assert.equal(resolveCreatureFamilyFromMorphology(phenotype.morphology), "silk-ray");
});

test("all ten morphology archetypes are reachable from byte genomes", () => {
  const reached = new Set();

  for (const [family, profile] of Object.entries(MORPHOLOGY_PROFILE_BY_FAMILY)) {
    const genome = genomeNearProfile(profile);
    const resolvedFamily = resolveCreatureFamily(genome);

    assert.equal(resolvedFamily, family);
    reached.add(resolvedFamily);
  }

  assert.equal(reached.size, BODY_FAMILY_SLOTS.length);
});

test("family selection depends on multiple structural genes, not gene 0 alone", () => {
  const baselineFamily = resolveCreatureFamily(SEEKER_ZERO_GENOME);
  const ribbonProfile = MORPHOLOGY_PROFILE_BY_FAMILY["ribbon-leviathan"];
  const genome = Array.from(SEEKER_ZERO_GENOME);

  for (const key of MORPHOLOGY_KEYS.filter((key) => key !== "bodyForm")) {
    genome[STRUCTURAL_GENE_BY_PROFILE_KEY[key]] = byteClosestToUnit(ribbonProfile[key]);
  }

  assert.equal(genome[0], SEEKER_ZERO_GENOME[0]);
  assert.equal(baselineFamily, "silk-ray");
  assert.equal(resolveCreatureFamily(genome), "ribbon-leviathan");
});

test("cosmetic genes do not change family", () => {
  const baselineFamily = resolveCreatureFamily(SEEKER_ZERO_GENOME);

  for (const geneIndex of [3, 4, 5, 6, 7, 10, 11, 12, 13, 14]) {
    for (const value of [0, 17, 64, 129, 255]) {
      const genome = withGene(SEEKER_ZERO_GENOME, geneIndex, value);

      assert.equal(resolveCreatureFamily(genome), baselineFamily, `gene ${geneIndex} changed family`);
    }
  }
});

test("every gene-8 byte changes appendage-family phenotype data", () => {
  const serializedAppendages = new Set();

  for (let byte = 0; byte <= 255; byte += 1) {
    serializedAppendages.add(JSON.stringify(phenotypeFromGenome(withGene(SEEKER_ZERO_GENOME, 8, byte)).appendages));
  }

  assert.equal(serializedAppendages.size, 256);
});

test("every gene-10 byte changes surface-pattern phenotype data", () => {
  const serializedSurfaces = new Set();

  for (let byte = 0; byte <= 255; byte += 1) {
    serializedSurfaces.add(JSON.stringify(phenotypeFromGenome(withGene(SEEKER_ZERO_GENOME, 10, byte)).surface));
  }

  assert.equal(serializedSurfaces.size, 256);
});

test("gene 14 produces both live motion and static resting-pose data", () => {
  const calmMotion = phenotypeFromGenome(withGene(SEEKER_ZERO_GENOME, 14, 0)).motion;
  const activeMotion = phenotypeFromGenome(withGene(SEEKER_ZERO_GENOME, 14, 255)).motion;

  assert.notEqual(calmMotion.periodMs, activeMotion.periodMs);
  assert.notEqual(calmMotion.pulseScaleAmplitude, activeMotion.pulseScaleAmplitude);
  assert.notEqual(calmMotion.restPoseRotationDeg, activeMotion.restPoseRotationDeg);
  assert.notEqual(calmMotion.restPoseOffsetPxAt1024, activeMotion.restPoseOffsetPxAt1024);
});

test("gene 15 produces real asymmetry data", () => {
  const leftHeavy = phenotypeFromGenome(withGene(SEEKER_ZERO_GENOME, 15, 0)).asymmetry;
  const rightHeavy = phenotypeFromGenome(withGene(SEEKER_ZERO_GENOME, 15, 255)).asymmetry;

  assert.notEqual(leftHeavy.leftScale, leftHeavy.rightScale);
  assert.notEqual(rightHeavy.leftScale, rightHeavy.rightScale);
  assert.notEqual(leftHeavy.leftScale, rightHeavy.leftScale);
  assert.notEqual(leftHeavy.appendageOffsetPxAt1024, rightHeavy.appendageOffsetPxAt1024);
});

test("every byte value in every gene is deterministic and finite", () => {
  for (let geneIndex = 0; geneIndex < SEEKER_ZERO_GENOME.length; geneIndex += 1) {
    for (let byte = 0; byte <= 255; byte += 1) {
      const genome = withGene(SEEKER_ZERO_GENOME, geneIndex, byte);
      const phenotype = phenotypeFromGenome(genome);

      assert.deepEqual(phenotype, phenotypeFromGenome(genome));
      collectFiniteNumberPaths(phenotype);
    }
  }
});

test("family selection does not depend on runtime registry ordering", () => {
  const genomes = [
    Array.from(SEEKER_ZERO_GENOME),
    genomeNearProfile(MORPHOLOGY_PROFILE_BY_FAMILY["void-drifter"]),
    genomeNearProfile(MORPHOLOGY_PROFILE_BY_FAMILY["pearl-medusa"]),
    genomeNearProfile(MORPHOLOGY_PROFILE_BY_FAMILY["ribbon-leviathan"])
  ];

  for (const genome of genomes) {
    const morphology = morphologyFromGenome(genome);

    assert.equal(resolveCreatureFamilyFromMorphology(morphology), independentFamilyResolution(morphology));
  }
});

test("representative lineage preserves continuity before accumulated archetype transition", () => {
  const targetProfile = MORPHOLOGY_PROFILE_BY_FAMILY["ribbon-leviathan"];
  const lineage = [Array.from(SEEKER_ZERO_GENOME)];
  const mutationOrder = [
    "appendageExpression",
    "appendageFamily",
    "bodyForm",
    "membrane",
    "proportion",
    "asymmetry"
  ];

  for (const key of mutationOrder) {
    lineage.push(withGene(lineage.at(-1), STRUCTURAL_GENE_BY_PROFILE_KEY[key], byteClosestToUnit(targetProfile[key])));
  }

  const families = lineage.map((genome) => resolveCreatureFamily(genome));

  assert.deepEqual(families.slice(0, 5), ["silk-ray", "silk-ray", "silk-ray", "silk-ray", "silk-ray"]);
  assert.equal(families.at(-1), "ribbon-leviathan");
});
