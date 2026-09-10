import { useEffect, useMemo, useState } from "react";
import {
  AccessibilityInfo,
  StyleSheet,
  type StyleProp,
  type ViewStyle
} from "react-native";
import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  Path,
  RadialGradient,
  Skia,
  vec
} from "@shopify/react-native-skia";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming
} from "react-native-reanimated";
import {
  genomeToHex,
  phenotypeFromGenome,
  validateGenomeBytes,
  visualUnit,
  type GenomeInput,
  type OrganismPhenotype
} from "@spore/shared";

import { SHOW_MOUSTACHE } from "../../config/organism";

type OrganismRendererProps = {
  genome: GenomeInput;
  size?: number;
  animated?: boolean;
  showMoustache?: boolean;
  style?: StyleProp<ViewStyle>;
};

type Point = {
  x: number;
  y: number;
};

type DetailCircle = Point & {
  radius: number;
  opacity: number;
};

type AnatomyPath = {
  path: SkPath;
  opacity: number;
  width: number;
};

type MoustacheGeometry = {
  left: SkPath;
  right: SkPath;
  leftCurl: SkPath;
  rightCurl: SkPath;
};

type SkPath = ReturnType<typeof Skia.Path.Make>;

type Geometry = {
  center: Point;
  bodyHeight: number;
  bodyWidth: number;
  outerBody: SkPath;
  innerBody: SkPath;
  deepBody: SkPath;
  dorsalFold: AnatomyPath;
  wingMembranes: SkPath[];
  wingVeins: AnatomyPath[];
  trailingAppendages: AnatomyPath[];
  internalFilaments: AnatomyPath[];
  combRibs: AnatomyPath[];
  surfaceMarks: DetailCircle[];
  surfaceLines: AnatomyPath[];
  sensoryNodes: DetailCircle[];
  haloParticles: DetailCircle[];
  organelleShells: SkPath[];
  organelleCores: DetailCircle[];
  moustache: MoustacheGeometry;
};

export function OrganismRenderer({
  animated = true,
  genome,
  showMoustache = SHOW_MOUSTACHE,
  size = 440,
  style
}: OrganismRendererProps) {
  const rendererSize = sanitizeSize(size);
  const genomeKey = useMemo(() => normalizeGenomeKey(genome), [genome]);
  const phenotype = useMemo(() => phenotypeFromGenome(genomeKey), [genomeKey]);
  const geometry = useMemo(() => buildGeometry(phenotype, rendererSize), [phenotype, rendererSize]);
  const reduceMotion = useReduceMotion();
  const breath = useSharedValue(0);
  const pulse = useSharedValue(0);
  const breatheAmplitude = Math.min(phenotype.motion.breatheAmplitude, 0.016);
  const driftAmplitude = Math.min(phenotype.motion.driftAmplitude, 1.2);
  const pulseStrength = Math.min(phenotype.motion.pulseStrength, 0.024);

  useEffect(() => {
    cancelAnimation(breath);
    cancelAnimation(pulse);

    if (!animated || reduceMotion) {
      breath.value = 0;
      pulse.value = 0;
      return;
    }

    breath.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: phenotype.motion.breatheDurationMs + 1400,
          easing: Easing.inOut(Easing.sin)
        }),
        withTiming(0, {
          duration: phenotype.motion.breatheDurationMs + 1400,
          easing: Easing.inOut(Easing.sin)
        })
      ),
      -1
    );
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: phenotype.motion.pulseDurationMs + 1100,
          easing: Easing.inOut(Easing.quad)
        }),
        withTiming(0, {
          duration: phenotype.motion.pulseDurationMs + 1100,
          easing: Easing.inOut(Easing.quad)
        })
      ),
      -1
    );
  }, [
    animated,
    breath,
    phenotype.motion.breatheDurationMs,
    phenotype.motion.pulseDurationMs,
    pulse,
    reduceMotion
  ]);

  const organismMotion = useAnimatedStyle(() => ({
    opacity: 0.982 + pulse.value * pulseStrength,
    transform: [
      { translateX: Math.sin(breath.value * Math.PI * 2) * driftAmplitude },
      { translateY: Math.cos(breath.value * Math.PI * 2) * driftAmplitude * 0.42 },
      { scaleX: 1 + breath.value * breatheAmplitude * 0.72 },
      { scaleY: 1 + breath.value * breatheAmplitude }
    ]
  }));

  return (
    <Animated.View
      style={[
        {
          height: rendererSize,
          width: rendererSize
        },
        organismMotion,
        style
      ]}
    >
      <Canvas
        style={[
          styles.canvas,
          {
            height: rendererSize,
            width: rendererSize
          }
        ]}
      >
        <Atmosphere geometry={geometry} phenotype={phenotype} size={rendererSize} />
        <Locomotion geometry={geometry} phenotype={phenotype} size={rendererSize} />
        <Body geometry={geometry} phenotype={phenotype} size={rendererSize} />
        <InternalAnatomy geometry={geometry} phenotype={phenotype} />
        <Organelle geometry={geometry} phenotype={phenotype} />
        {showMoustache ? <Moustache geometry={geometry.moustache} size={rendererSize} /> : null}
      </Canvas>
    </Animated.View>
  );
}

function Atmosphere({
  geometry,
  phenotype,
  size
}: {
  geometry: Geometry;
  phenotype: OrganismPhenotype;
  size: number;
}) {
  return (
    <>
      <Circle cx={size * 0.5} cy={size * 0.5} r={size * 0.5}>
        <RadialGradient
          c={vec(size * 0.5, size * 0.48)}
          colors={[
            rgba(phenotype.pigment.deep, 0.4),
            rgba(phenotype.pigment.base, 0.1),
            "rgba(4, 6, 5, 0)"
          ]}
          r={size * 0.5}
        />
      </Circle>
      {geometry.haloParticles.map((particle, index) => (
        <Circle
          key={`halo-${index}`}
          cx={particle.x}
          cy={particle.y}
          r={particle.radius}
          color={rgba(phenotype.luminescence.secondary, particle.opacity)}
        >
          <BlurMask blur={4} style="normal" />
        </Circle>
      ))}
    </>
  );
}

function Locomotion({
  geometry,
  phenotype,
  size
}: {
  geometry: Geometry;
  phenotype: OrganismPhenotype;
  size: number;
}) {
  return (
    <Group opacity={0.9}>
      {geometry.wingMembranes.map((path, index) => (
        <Path key={`wing-${index}`} path={path}>
          <RadialGradient
            c={vec(geometry.center.x, geometry.center.y - geometry.bodyHeight * 0.08)}
            colors={[
              rgba(phenotype.pigment.light, 0.22),
              rgba(phenotype.pigment.base, 0.12),
              rgba(phenotype.pigment.deep, 0.03)
            ]}
            r={Math.max(1, geometry.bodyWidth * 1.55)}
          />
        </Path>
      ))}
      {geometry.wingVeins.map((line, index) => (
        <Path
          key={`wing-vein-${index}`}
          color={rgba(phenotype.pigment.light, line.opacity)}
          path={line.path}
          strokeCap="round"
          strokeJoin="round"
          strokeWidth={line.width}
          style="stroke"
        />
      ))}
      {geometry.trailingAppendages.map((line, index) => (
        <Path
          key={`trail-${index}`}
          color={rgba(phenotype.pigment.light, line.opacity)}
          path={line.path}
          strokeCap="round"
          strokeJoin="round"
          strokeWidth={line.width}
          style="stroke"
        />
      ))}
      <Circle
        cx={geometry.center.x}
        cy={geometry.center.y + geometry.bodyHeight * 0.18}
        r={size * 0.18}
        color={rgba(phenotype.pigment.deep, 0.07)}
      >
        <BlurMask blur={18} style="normal" />
      </Circle>
    </Group>
  );
}

function Body({
  geometry,
  phenotype,
  size
}: {
  geometry: Geometry;
  phenotype: OrganismPhenotype;
  size: number;
}) {
  return (
    <>
      <Path color={rgba(phenotype.pigment.base, 0.18)} path={geometry.outerBody} />
      <Path path={geometry.outerBody}>
        <RadialGradient
          c={vec(geometry.center.x - geometry.bodyWidth * 0.18, geometry.center.y - geometry.bodyHeight * 0.22)}
          colors={[
            rgba(phenotype.pigment.light, 0.36),
            rgba(phenotype.pigment.base, 0.22),
            rgba(phenotype.pigment.deep, 0.08),
            rgba(phenotype.pigment.deep, 0.025)
          ]}
          r={Math.max(1, geometry.bodyHeight * 0.58)}
        />
      </Path>
      <Path
        color={rgba(phenotype.pigment.light, 0.22 + phenotype.membrane.edgeOpacity * 0.2)}
        path={geometry.outerBody}
        strokeJoin="round"
        strokeWidth={Math.max(1.8, phenotype.membrane.thickness * 1.08)}
        style="stroke"
      />
      <Path path={geometry.deepBody}>
        <RadialGradient
          c={vec(geometry.center.x + geometry.bodyWidth * 0.16, geometry.center.y + geometry.bodyHeight * 0.08)}
          colors={[
            rgba(phenotype.pigment.deep, 0.045),
            rgba(phenotype.pigment.base, 0.19),
            rgba(phenotype.pigment.light, 0.075)
          ]}
          r={Math.max(1, geometry.bodyWidth * 0.95)}
        />
      </Path>
      <Path path={geometry.innerBody}>
        <RadialGradient
          c={vec(geometry.center.x - geometry.bodyWidth * 0.1, geometry.center.y - geometry.bodyHeight * 0.05)}
          colors={[
            rgba(phenotype.pigment.light, 0.16),
            rgba(phenotype.pigment.base, 0.1),
            rgba(phenotype.pigment.deep, 0.035)
          ]}
          r={Math.max(1, geometry.bodyWidth * 0.78)}
        />
      </Path>
      <Circle
        cx={geometry.center.x}
        cy={geometry.center.y - geometry.bodyHeight * 0.05}
        r={Math.max(1, geometry.bodyWidth * phenotype.luminescence.spread * 1.08)}
        color={rgba(phenotype.luminescence.secondary, 0.1 + phenotype.luminescence.strength * 0.16)}
      >
        <BlurMask blur={20} style="normal" />
      </Circle>
      <Path
        color={rgba(phenotype.pigment.light, geometry.dorsalFold.opacity)}
        path={geometry.dorsalFold.path}
        strokeCap="round"
        strokeJoin="round"
        strokeWidth={geometry.dorsalFold.width}
        style="stroke"
      />
      <Path color={rgba(phenotype.pigment.light, 0.12)} path={geometry.outerBody}>
        <BlurMask blur={3} style="normal" />
      </Path>
    </>
  );
}

function InternalAnatomy({
  geometry,
  phenotype
}: {
  geometry: Geometry;
  phenotype: OrganismPhenotype;
}) {
  return (
    <>
      {geometry.combRibs.map((line, index) => (
        <Path
          key={`rib-${index}`}
          color={rgba(phenotype.luminescence.secondary, line.opacity)}
          path={line.path}
          strokeCap="round"
          strokeJoin="round"
          strokeWidth={line.width}
          style="stroke"
        />
      ))}
      {geometry.internalFilaments.map((line, index) => (
        <Path
          key={`filament-${index}`}
          color={rgba(phenotype.pigment.light, line.opacity)}
          path={line.path}
          strokeCap="round"
          strokeJoin="round"
          strokeWidth={line.width}
          style="stroke"
        />
      ))}
      {geometry.surfaceLines.map((line, index) => (
        <Path
          key={`surface-line-${index}`}
          color={rgba(phenotype.pigment.light, line.opacity)}
          path={line.path}
          strokeCap="round"
          strokeJoin="round"
          strokeWidth={line.width}
          style="stroke"
        />
      ))}
      {geometry.surfaceMarks.map((mark, index) => (
        <Circle
          key={`surface-mark-${index}`}
          cx={mark.x}
          cy={mark.y}
          r={mark.radius}
          color={rgba(phenotype.pigment.light, mark.opacity)}
        />
      ))}
    </>
  );
}

function Organelle({
  geometry,
  phenotype
}: {
  geometry: Geometry;
  phenotype: OrganismPhenotype;
}) {
  return (
    <>
      {geometry.organelleShells.map((path, index) => (
        <Path key={`organelle-shell-${index}`} path={path}>
          <RadialGradient
            c={vec(
              geometry.center.x + (index - 1) * geometry.bodyWidth * 0.06,
              geometry.center.y - geometry.bodyHeight * 0.08
            )}
            colors={[
              rgba(phenotype.luminescence.secondary, 0.42),
              rgba(phenotype.pigment.light, 0.18),
              rgba(phenotype.pigment.deep, 0.055)
            ]}
            r={Math.max(1, geometry.bodyWidth * 0.36)}
          />
        </Path>
      ))}
      {geometry.organelleCores.map((core, index) => (
        <Circle
          key={`organelle-core-${index}`}
          cx={core.x}
          cy={core.y}
          r={core.radius}
          color={rgba(phenotype.luminescence.secondary, core.opacity)}
        >
          <BlurMask blur={3} style="normal" />
        </Circle>
      ))}
      {geometry.sensoryNodes.map((node, index) => (
        <Circle
          key={`node-${index}`}
          cx={node.x}
          cy={node.y}
          r={node.radius}
          color={rgba(phenotype.luminescence.secondary, node.opacity)}
        >
          <BlurMask blur={2.4 + phenotype.sensoryNodes.glow * 2.8} style="normal" />
        </Circle>
      ))}
    </>
  );
}

function Moustache({ geometry, size }: { geometry: MoustacheGeometry; size: number }) {
  return (
    <Group opacity={0.88}>
      <Path color="rgba(11, 10, 8, 0.74)" path={geometry.left} />
      <Path color="rgba(11, 10, 8, 0.74)" path={geometry.right} />
      <Path
        color="rgba(242, 231, 211, 0.2)"
        path={geometry.leftCurl}
        strokeCap="round"
        strokeJoin="round"
        strokeWidth={Math.max(0.65, size * 0.0022)}
        style="stroke"
      />
      <Path
        color="rgba(242, 231, 211, 0.2)"
        path={geometry.rightCurl}
        strokeCap="round"
        strokeJoin="round"
        strokeWidth={Math.max(0.65, size * 0.0022)}
        style="stroke"
      />
    </Group>
  );
}

function useReduceMotion() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) {
        setReduceMotion(enabled);
      }
    });

    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}

function normalizeGenomeKey(genome: GenomeInput) {
  return typeof genome === "string" ? genome.toLowerCase() : genomeToHex(validateGenomeBytes(genome));
}

function buildGeometry(phenotype: OrganismPhenotype, rawSize: number): Geometry {
  const size = sanitizeSize(rawSize);
  const center = finitePoint({
    x: size * (0.5 + phenotype.asymmetry.centerOffsetX * 0.48),
    y: size * (0.45 + phenotype.asymmetry.centerOffsetY * 0.36)
  });
  const bodyHeight = finiteNumber(size * (0.54 + (phenotype.body.heightScale - 1) * 0.11), size * 0.54);
  const bodyWidth = finiteNumber(size * (0.22 + (phenotype.body.widthScale - 1) * 0.08), size * 0.22);
  const outerBody = createBodyPath(phenotype, center, bodyWidth, bodyHeight, 1, 0);

  return {
    center,
    bodyHeight,
    bodyWidth,
    outerBody,
    innerBody: createBodyPath(phenotype, center, bodyWidth, bodyHeight, 0.62, 17),
    deepBody: createBodyPath(
      phenotype,
      { x: center.x + bodyWidth * 0.07, y: center.y + bodyHeight * 0.07 },
      bodyWidth,
      bodyHeight,
      0.78,
      31
    ),
    dorsalFold: createDorsalFold(phenotype, center, bodyWidth, bodyHeight),
    wingMembranes: createWingMembranes(phenotype, center, bodyWidth, bodyHeight),
    wingVeins: createWingVeins(phenotype, center, bodyWidth, bodyHeight),
    trailingAppendages: createTrailingAppendages(phenotype, center, bodyWidth, bodyHeight),
    internalFilaments: createInternalFilaments(phenotype, center, bodyWidth, bodyHeight),
    combRibs: createCombRibs(phenotype, center, bodyWidth, bodyHeight),
    surfaceMarks: createSurfaceMarks(phenotype, center, bodyWidth, bodyHeight),
    surfaceLines: createSurfaceLines(phenotype, center, bodyWidth, bodyHeight),
    sensoryNodes: createSensoryNodes(phenotype, center, bodyWidth, bodyHeight),
    haloParticles: createHaloParticles(phenotype, size, center),
    organelleShells: createOrganelleShells(phenotype, center, bodyWidth, bodyHeight),
    organelleCores: createOrganelleCores(phenotype, center, bodyWidth, bodyHeight),
    moustache: createMoustache(center, bodyWidth, bodyHeight)
  };
}

function createBodyPath(
  phenotype: OrganismPhenotype,
  center: Point,
  bodyWidth: number,
  bodyHeight: number,
  scale: number,
  salt: number
) {
  const samples = 21;
  const left = Array.from({ length: samples }, (_, index) => {
    const y = -1 + (index / (samples - 1)) * 2;
    return bodyEdgePoint(phenotype, center, bodyWidth, bodyHeight, y, -1, scale, salt);
  });
  const right = Array.from({ length: samples }, (_, index) => {
    const y = 1 - (index / (samples - 1)) * 2;
    return bodyEdgePoint(phenotype, center, bodyWidth, bodyHeight, y, 1, scale, salt);
  });

  return smoothClosedPath([...left, ...right]);
}

function bodyEdgePoint(
  phenotype: OrganismPhenotype,
  center: Point,
  bodyWidth: number,
  bodyHeight: number,
  y: number,
  side: -1 | 1,
  scale: number,
  salt = 0
): Point {
  const profile = bodyProfile(phenotype, y);
  const lobe =
    1 +
    Math.sin((y + 1.1) * Math.PI * (2.2 + (phenotype.genome[2] % 3)) + salt) *
      phenotype.membrane.lobing *
      0.72 +
    (visualUnit(phenotype.seed, salt + Math.round((y + 1) * 100) + (side > 0 ? 11 : 23)) - 0.5) *
      phenotype.membrane.irregularity *
      1.8;
  const sweep = Math.sin((y + 0.2) * Math.PI) * bodySweep(phenotype);
  const sideBias = side * phenotype.asymmetry.lobeBias * bodyWidth * 0.18 * (1 - Math.abs(y) * 0.5);
  const x = center.x + (side * bodyWidth * profile * lobe + sweep + sideBias) * scale;
  const verticalPull = phenotype.body.massBias * bodyHeight * 0.06 * Math.max(0, y) * scale;
  const point = {
    x,
    y: center.y + y * bodyHeight * 0.5 * scale + verticalPull
  };

  return finitePoint(rotatePoint(point, center, (phenotype.asymmetry.rotationDeg * Math.PI) / 180));
}

function bodyInteriorPoint(
  phenotype: OrganismPhenotype,
  center: Point,
  bodyWidth: number,
  bodyHeight: number,
  y: number,
  sideAmount: number,
  salt = 0
) {
  const side = sideAmount < 0 ? -1 : 1;
  const edge = bodyEdgePoint(phenotype, center, bodyWidth, bodyHeight, y, side, 1, salt);

  return finitePoint({
    x: center.x + (edge.x - center.x) * Math.abs(sideAmount),
    y: edge.y
  });
}

function bodyProfile(phenotype: OrganismPhenotype, y: number) {
  const t = (y + 1) * 0.5;
  const base = Math.sin(Math.PI * t);

  switch (phenotype.body.family) {
    case "bell":
      return clamp(0.18 + Math.pow(base, 0.42) * (0.5 + t * 0.54), 0.06, 1.1);
    case "spindle":
      return clamp(0.1 + Math.pow(base, 1.45) * 0.9, 0.04, 0.98);
    case "manta":
      return clamp(0.22 + Math.pow(base, 0.34) * (0.72 + Math.sin(t * Math.PI * 2) * 0.08), 0.08, 1.18);
    case "medusa":
      return clamp(0.16 + Math.pow(base, 0.55) * (0.86 - t * 0.28), 0.08, 1.05);
    case "amoeboid":
      return clamp(
        0.12 + Math.pow(base, 0.72) * (0.76 + Math.sin(t * Math.PI * 1.6 + 0.7) * 0.16),
        0.07,
        1.06
      );
    case "ovoid":
    default:
      return clamp(0.16 + Math.pow(base, 0.64) * (0.8 + t * 0.08), 0.08, 1.02);
  }
}

function bodySweep(phenotype: OrganismPhenotype) {
  switch (phenotype.body.family) {
    case "manta":
      return 0.035;
    case "spindle":
      return -0.018;
    case "amoeboid":
      return 0.052;
    default:
      return 0.018;
  }
}

function createWingMembranes(
  phenotype: OrganismPhenotype,
  center: Point,
  bodyWidth: number,
  bodyHeight: number
) {
  return [-1, 1].map((side) => {
    const rootTop = bodyEdgePoint(phenotype, center, bodyWidth, bodyHeight, -0.45, side as -1 | 1, 0.98);
    const rootBottom = bodyEdgePoint(phenotype, center, bodyWidth, bodyHeight, 0.28, side as -1 | 1, 0.98);
    const rootMid = bodyEdgePoint(phenotype, center, bodyWidth, bodyHeight, -0.05, side as -1 | 1, 1.02);
    const span = wingSpan(phenotype) * bodyWidth;
    const lift = wingLift(phenotype) * bodyHeight;
    const tip = finitePoint({
      x: rootMid.x + side * span,
      y: rootMid.y - lift + side * phenotype.asymmetry.lobeBias * bodyHeight * 0.1
    });
    const lowerTip = finitePoint({
      x: rootMid.x + side * span * 0.72,
      y: rootMid.y + bodyHeight * 0.2
    });
    const path = Skia.Path.Make();

    path.moveTo(rootTop.x, rootTop.y);
    path.cubicTo(
      rootTop.x + side * span * 0.28,
      rootTop.y - bodyHeight * 0.14,
      tip.x - side * span * 0.18,
      tip.y - bodyHeight * 0.06,
      tip.x,
      tip.y
    );
    path.cubicTo(
      lowerTip.x,
      lowerTip.y,
      rootBottom.x + side * span * 0.2,
      rootBottom.y + bodyHeight * 0.08,
      rootBottom.x,
      rootBottom.y
    );
    path.cubicTo(
      rootMid.x + side * span * 0.14,
      rootMid.y + bodyHeight * 0.02,
      rootTop.x + side * span * 0.12,
      rootTop.y + bodyHeight * 0.08,
      rootTop.x,
      rootTop.y
    );
    path.close();

    return path;
  });
}

function createWingVeins(
  phenotype: OrganismPhenotype,
  center: Point,
  bodyWidth: number,
  bodyHeight: number
) {
  const veinCount = 3 + (phenotype.genome[9] % 3);
  const lines: AnatomyPath[] = [];

  for (const side of [-1, 1] as const) {
    for (let index = 0; index < veinCount; index += 1) {
      const y = -0.34 + index * (0.56 / Math.max(1, veinCount - 1));
      const root = bodyEdgePoint(phenotype, center, bodyWidth, bodyHeight, y, side, 0.92, 80 + index);
      const tip = finitePoint({
        x: root.x + side * wingSpan(phenotype) * bodyWidth * (0.46 + index * 0.1),
        y: root.y - wingLift(phenotype) * bodyHeight * (0.42 - index * 0.13)
      });
      const path = Skia.Path.Make();

      path.moveTo(root.x, root.y);
      path.cubicTo(
        root.x + side * bodyWidth * 0.22,
        root.y - bodyHeight * 0.05,
        tip.x - side * bodyWidth * 0.16,
        tip.y + bodyHeight * 0.03,
        tip.x,
        tip.y
      );
      lines.push({
        path,
        opacity: clampOpacity(0.1 + phenotype.membrane.edgeOpacity * 0.18),
        width: 0.55
      });
    }
  }

  return lines;
}

function wingSpan(phenotype: OrganismPhenotype) {
  const familyBoost = phenotype.body.family === "manta" ? 1.44 : phenotype.body.family === "spindle" ? 0.9 : 1.12;

  return familyBoost * (0.82 + phenotype.appendages.length * 1.2);
}

function wingLift(phenotype: OrganismPhenotype) {
  return phenotype.body.family === "manta" ? 0.18 : 0.11 + phenotype.appendages.curvature * 0.04;
}

function createTrailingAppendages(
  phenotype: OrganismPhenotype,
  center: Point,
  bodyWidth: number,
  bodyHeight: number
) {
  const count = Math.min(12, 5 + (phenotype.genome[9] % 9));

  return Array.from({ length: count }, (_, index) => {
    const unit = count === 1 ? 0.5 : index / (count - 1);
    const sideAmount = -0.52 + unit * 1.04;
    const root = bodyInteriorPoint(phenotype, center, bodyWidth, bodyHeight, 0.76, sideAmount, 120 + index);
    const fall = bodyHeight * (0.22 + phenotype.appendages.length * 0.45);
    const sway = (visualUnit(phenotype.seed, 150 + index) - 0.5) * bodyWidth * 0.52;
    const tip = finitePoint({
      x: root.x + sway,
      y: root.y + fall * (0.7 + visualUnit(phenotype.seed, 180 + index) * 0.45)
    });
    const path = Skia.Path.Make();

    path.moveTo(root.x, root.y);
    path.cubicTo(
      root.x + sideAmount * bodyWidth * 0.18,
      root.y + fall * 0.25,
      tip.x - sideAmount * bodyWidth * 0.18,
      tip.y - fall * 0.35,
      tip.x,
      tip.y
    );

    return {
      path,
      opacity: clampOpacity(0.15 + phenotype.filaments.opacity * 0.45),
      width: 0.45 + phenotype.appendages.thickness * 0.5
    };
  });
}

function createInternalFilaments(
  phenotype: OrganismPhenotype,
  center: Point,
  bodyWidth: number,
  bodyHeight: number
) {
  const count = phenotype.filaments.count + 3;

  return Array.from({ length: count }, (_, index) => {
    const startY = -0.56 + visualUnit(phenotype.seed, 220 + index) * 0.42;
    const endY = 0.34 + visualUnit(phenotype.seed, 250 + index) * 0.5;
    const side = -0.42 + visualUnit(phenotype.seed, 280 + index) * 0.84;
    const start = bodyInteriorPoint(phenotype, center, bodyWidth, bodyHeight, startY, side * 0.3, 300 + index);
    const end = bodyInteriorPoint(phenotype, center, bodyWidth, bodyHeight, endY, side, 330 + index);
    const bend = (visualUnit(phenotype.seed, 360 + index) - 0.5) * bodyWidth * 0.5;
    const path = Skia.Path.Make();

    path.moveTo(start.x, start.y);
    path.cubicTo(
      center.x + bend,
      center.y + bodyHeight * (startY * 0.24),
      center.x - bend * 0.6,
      center.y + bodyHeight * (endY * 0.28),
      end.x,
      end.y
    );

    return {
      path,
      opacity: clampOpacity(0.12 + phenotype.filaments.opacity * 0.58),
      width: 0.45 + phenotype.filaments.complexity * 1.2
    };
  });
}

function createCombRibs(
  phenotype: OrganismPhenotype,
  center: Point,
  bodyWidth: number,
  bodyHeight: number
) {
  const ribs = 4 + (phenotype.genome[10] % 4);

  return Array.from({ length: ribs }, (_, index) => {
    const side = ribs === 1 ? 0 : -0.58 + (index / (ribs - 1)) * 1.16;
    const top = bodyInteriorPoint(phenotype, center, bodyWidth, bodyHeight, -0.72, side * 0.42, 390 + index);
    const bottom = bodyInteriorPoint(phenotype, center, bodyWidth, bodyHeight, 0.58, side * 0.64, 420 + index);
    const curve = side * bodyWidth * 0.22;
    const path = Skia.Path.Make();

    path.moveTo(top.x, top.y);
    path.cubicTo(
      top.x + curve,
      center.y - bodyHeight * 0.2,
      bottom.x - curve * 0.7,
      center.y + bodyHeight * 0.24,
      bottom.x,
      bottom.y
    );

    return {
      path,
      opacity: clampOpacity(0.07 + phenotype.luminescence.strength * 0.22),
      width: 0.45
    };
  });
}

function createDorsalFold(
  phenotype: OrganismPhenotype,
  center: Point,
  bodyWidth: number,
  bodyHeight: number
): AnatomyPath {
  const path = Skia.Path.Make();
  const top = bodyInteriorPoint(phenotype, center, bodyWidth, bodyHeight, -0.76, -0.08);
  const bottom = bodyInteriorPoint(phenotype, center, bodyWidth, bodyHeight, 0.64, 0.18);

  path.moveTo(top.x, top.y);
  path.cubicTo(
    center.x - bodyWidth * 0.34,
    center.y - bodyHeight * 0.22,
    center.x + bodyWidth * 0.28,
    center.y + bodyHeight * 0.16,
    bottom.x,
    bottom.y
  );

  return {
    path,
    opacity: 0.17,
    width: 1.35
  };
}

function createSurfaceMarks(
  phenotype: OrganismPhenotype,
  center: Point,
  bodyWidth: number,
  bodyHeight: number
) {
  if (phenotype.surface.pattern === "striations" || phenotype.surface.pattern === "fineVeins") {
    return [];
  }

  const count = Math.round(7 + phenotype.surface.density * 18);

  return Array.from({ length: count }, (_, index) => {
    const y = -0.66 + visualUnit(phenotype.seed, 450 + index) * 1.24;
    const side = -0.52 + visualUnit(phenotype.seed, 480 + index) * 1.04;
    const point = bodyInteriorPoint(phenotype, center, bodyWidth, bodyHeight, y, side, 510 + index);

    return {
      x: point.x,
      y: point.y,
      radius: 0.9 + visualUnit(phenotype.seed, 540 + index) * 1.65,
      opacity: clampOpacity(0.08 + phenotype.surface.opacity * 0.52)
    };
  });
}

function createSurfaceLines(
  phenotype: OrganismPhenotype,
  center: Point,
  bodyWidth: number,
  bodyHeight: number
) {
  const count =
    phenotype.surface.pattern === "striations" || phenotype.surface.pattern === "fineVeins"
      ? Math.round(6 + phenotype.surface.density * 11)
      : 3;

  return Array.from({ length: count }, (_, index) => {
    const y = -0.54 + visualUnit(phenotype.seed, 570 + index) * 0.98;
    const side = -0.44 + visualUnit(phenotype.seed, 600 + index) * 0.88;
    const start = bodyInteriorPoint(phenotype, center, bodyWidth, bodyHeight, y, side * 0.48, 630 + index);
    const end = bodyInteriorPoint(
      phenotype,
      center,
      bodyWidth,
      bodyHeight,
      y + 0.15 + visualUnit(phenotype.seed, 660 + index) * 0.18,
      side,
      690 + index
    );
    const path = Skia.Path.Make();

    path.moveTo(start.x, start.y);
    path.cubicTo(
      (start.x + center.x) * 0.5,
      start.y + bodyHeight * 0.035,
      (end.x + center.x) * 0.5,
      end.y - bodyHeight * 0.035,
      end.x,
      end.y
    );

    return {
      path,
      opacity: clampOpacity(0.08 + phenotype.surface.opacity * 0.6),
      width: 0.45
    };
  });
}

function createSensoryNodes(
  phenotype: OrganismPhenotype,
  center: Point,
  bodyWidth: number,
  bodyHeight: number
) {
  return Array.from({ length: Math.min(7, phenotype.sensoryNodes.count) }, (_, index) => {
    const unit = phenotype.sensoryNodes.count === 1 ? 0.5 : index / Math.max(1, phenotype.sensoryNodes.count - 1);
    const side = -0.66 + unit * 1.32;
    const y = -0.48 + phenotype.sensoryNodes.placement * 0.28;
    const point = bodyInteriorPoint(phenotype, center, bodyWidth, bodyHeight, y, side, 720 + index);

    return {
      x: point.x,
      y: point.y,
      radius: phenotype.sensoryNodes.radius * 0.62,
      opacity: clampOpacity(0.26 + phenotype.sensoryNodes.glow * 0.24)
    };
  });
}

function createHaloParticles(phenotype: OrganismPhenotype, size: number, center: Point) {
  const count = Math.min(12, phenotype.halo.particles);

  return Array.from({ length: count }, (_, index) => {
    const angle = Math.PI * 2 * visualUnit(phenotype.seed, 760 + index);
    const distance = size * (0.24 + phenotype.halo.spread * 0.28 * visualUnit(phenotype.seed, 790 + index));

    return {
      x: center.x + Math.cos(angle) * distance,
      y: center.y + Math.sin(angle) * distance,
      radius: 0.7 + visualUnit(phenotype.seed, 820 + index) * 1.75,
      opacity: clampOpacity(phenotype.halo.opacity * (0.28 + visualUnit(phenotype.seed, 850 + index) * 0.42))
    };
  });
}

function createOrganelleShells(
  phenotype: OrganismPhenotype,
  center: Point,
  bodyWidth: number,
  bodyHeight: number
) {
  const base = {
    x: center.x + bodyWidth * 0.03,
    y: center.y - bodyHeight * 0.1
  };
  const count = phenotype.nucleus.form === "cluster" ? 3 : phenotype.nucleus.form === "split" ? 2 : 2;

  return Array.from({ length: count }, (_, index) => {
    const angle = Math.PI * 2 * (index / count + phenotype.nucleus.arrangement * 0.28);
    const shellCenter = finitePoint({
      x: base.x + Math.cos(angle) * bodyWidth * (count === 2 ? 0.12 : 0.17),
      y: base.y + Math.sin(angle) * bodyHeight * (count === 2 ? 0.045 : 0.07)
    });

    return createOrganicOvalPath(
      shellCenter,
      bodyWidth * (0.15 + phenotype.nucleus.scale * 0.08),
      bodyHeight * (0.065 + phenotype.nucleus.scale * 0.035),
      phenotype.seed,
      880 + index,
      0.12,
      phenotype.asymmetry.rotationDeg + index * 21
    );
  });
}

function createOrganelleCores(
  phenotype: OrganismPhenotype,
  center: Point,
  bodyWidth: number,
  bodyHeight: number
) {
  const count = phenotype.nucleus.count + 1;
  const base = {
    x: center.x + bodyWidth * 0.03,
    y: center.y - bodyHeight * 0.1
  };

  return Array.from({ length: count }, (_, index) => {
    const angle = Math.PI * 2 * (index / count + phenotype.nucleus.arrangement * 0.17);

    return {
      x: base.x + Math.cos(angle) * bodyWidth * 0.13,
      y: base.y + Math.sin(angle) * bodyHeight * 0.045,
      radius: bodyWidth * (0.026 + visualUnit(phenotype.seed, 930 + index) * 0.018) * phenotype.nucleus.scale,
      opacity: clampOpacity(0.42 + phenotype.luminescence.strength * 0.28)
    };
  });
}

function createMoustache(center: Point, bodyWidth: number, bodyHeight: number): MoustacheGeometry {
  const anchor = finitePoint({
    x: center.x + bodyWidth * 0.02,
    y: center.y + bodyHeight * 0.28
  });
  const half = bodyWidth * 0.22;
  const height = bodyHeight * 0.018;
  const gap = bodyWidth * 0.018;
  const lift = bodyHeight * 0.014;
  const left = Skia.Path.Make();
  const right = Skia.Path.Make();
  const leftCurl = Skia.Path.Make();
  const rightCurl = Skia.Path.Make();

  left.moveTo(anchor.x - gap, anchor.y);
  left.cubicTo(anchor.x - half * 0.28, anchor.y - height, anchor.x - half * 0.8, anchor.y - height * 0.78, anchor.x - half, anchor.y - lift);
  left.cubicTo(anchor.x - half * 0.82, anchor.y + height * 0.82, anchor.x - half * 0.24, anchor.y + height * 0.92, anchor.x - gap, anchor.y);
  left.close();

  right.moveTo(anchor.x + gap, anchor.y);
  right.cubicTo(anchor.x + half * 0.28, anchor.y - height, anchor.x + half * 0.8, anchor.y - height * 0.78, anchor.x + half, anchor.y - lift);
  right.cubicTo(anchor.x + half * 0.82, anchor.y + height * 0.82, anchor.x + half * 0.24, anchor.y + height * 0.92, anchor.x + gap, anchor.y);
  right.close();

  leftCurl.moveTo(anchor.x - half * 0.76, anchor.y - lift * 0.58);
  leftCurl.cubicTo(anchor.x - half * 0.94, anchor.y - lift * 1.25, anchor.x - half * 1.06, anchor.y - lift, anchor.x - half * 1.08, anchor.y - lift * 0.32);
  rightCurl.moveTo(anchor.x + half * 0.76, anchor.y - lift * 0.58);
  rightCurl.cubicTo(anchor.x + half * 0.94, anchor.y - lift * 1.25, anchor.x + half * 1.06, anchor.y - lift, anchor.x + half * 1.08, anchor.y - lift * 0.32);

  return {
    left,
    right,
    leftCurl,
    rightCurl
  };
}

function createOrganicOvalPath(
  center: Point,
  rx: number,
  ry: number,
  seed: number,
  salt: number,
  irregularity: number,
  rotationDeg: number
) {
  const count = 24;
  const points = Array.from({ length: count }, (_, index) => {
    const angle = (Math.PI * 2 * index) / count;
    const wobble =
      1 +
      (visualUnit(seed, salt + index) - 0.5) * irregularity +
      Math.sin(angle * 3 + salt) * irregularity * 0.36;
    const point = {
      x: center.x + Math.cos(angle) * rx * wobble,
      y: center.y + Math.sin(angle) * ry * wobble
    };

    return finitePoint(rotatePoint(point, center, (rotationDeg * Math.PI) / 180));
  });

  return smoothClosedPath(points);
}

function smoothClosedPath(points: Point[]) {
  const path = Skia.Path.Make();
  const safePoints = points.map(finitePoint);
  const last = safePoints.length - 1;

  path.moveTo(safePoints[0].x, safePoints[0].y);

  for (let index = 0; index < safePoints.length; index += 1) {
    const p0 = safePoints[(index + last) % safePoints.length];
    const p1 = safePoints[index];
    const p2 = safePoints[(index + 1) % safePoints.length];
    const p3 = safePoints[(index + 2) % safePoints.length];

    path.cubicTo(
      p1.x + (p2.x - p0.x) / 6,
      p1.y + (p2.y - p0.y) / 6,
      p2.x - (p3.x - p1.x) / 6,
      p2.y - (p3.y - p1.y) / 6,
      p2.x,
      p2.y
    );
  }

  path.close();

  return path;
}

function rotatePoint(point: Point, center: Point, radians: number): Point {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const x = point.x - center.x;
  const y = point.y - center.y;

  return {
    x: center.x + x * cos - y * sin,
    y: center.y + x * sin + y * cos
  };
}

function sanitizeSize(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return 320;
  }

  return clamp(value, 160, 640);
}

function finitePoint(point: Point): Point {
  return {
    x: finiteNumber(point.x, 0),
    y: finiteNumber(point.y, 0)
  };
}

function finiteNumber(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}

function clampOpacity(value: number) {
  return clamp(finiteNumber(value, 1), 0, 1);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function rgba(hex: string, alpha: number) {
  const clean = hex.replace("#", "");
  const red = Number.parseInt(clean.slice(0, 2), 16);
  const green = Number.parseInt(clean.slice(2, 4), 16);
  const blue = Number.parseInt(clean.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${clampOpacity(alpha).toFixed(3)})`;
}

const styles = StyleSheet.create({
  canvas: {
    backgroundColor: "transparent"
  }
});
