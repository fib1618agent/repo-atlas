import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { CATEGORY_ORDER, CATEGORY_TOKEN, type Repository } from "@/lib/repositories";
import { useAtlasStore } from "@/lib/atlas-store";

interface AtlasSceneProps {
  repositories: Repository[];
  onPointerPosition: (x: number, y: number) => void;
}

// ── Deterministic hash ──────────────────────────────────────────────────────
function hashNumber(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

// ── Category hex → THREE.Color ─────────────────────────────────────────────
const COLOR_MAP: Record<string, string> = {
  "--atlas-ai":       "#a78bfa",
  "--atlas-java":     "#fb923c",
  "--atlas-cloud":    "#60a5fa",
  "--atlas-web":      "#4ade80",
  "--atlas-data":     "#facc15",
  "--atlas-security": "#f87171",
  "--atlas-devtools": "#22d3ee",
  "--atlas-mobile":   "#f472b6",
  "--atlas-other":    "#94a3b8",
};

function getCategoryColor(token: string): THREE.Color {
  const hex = COLOR_MAP[token] ?? "#94a3b8";
  return new THREE.Color(hex);
}

function getRepositoryColor(repo: Repository): THREE.Color {
  return getCategoryColor(CATEGORY_TOKEN[repo.category]);
}

/** Same family as the dummy dust dots, with a small per-repo hue shift. */
function getMarbleColor(repo: Repository): THREE.Color {
  const color = getRepositoryColor(repo);
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);
  const hueShift = (hashNumber(`${repo.id}:hue`) - 0.5) * 0.06;
  color.setHSL((hsl.h + hueShift + 1) % 1, hsl.s, Math.max(0.28, hsl.l * 0.72));
  return color;
}

/** Unlit colored spheres — same look as dummy dots, no PBR blow-out. */
const marbleMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  fog: false,
  toneMapped: false,
});
const haloMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.22,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  fog: false,
  toneMapped: false,
});
/** Invisible hit target — larger than the visible marble for easier hover/click. */
const PICK_HIT_MULTIPLIER = 4.2;
const pickMaterial = new THREE.MeshBasicMaterial({
  transparent: true,
  opacity: 0,
  depthWrite: false,
});
pickMaterial.colorWrite = false;
pickMaterial.depthWrite = false;

// ── Funnel position ─────────────────────────────────────────────────────────
function repositoryPosition(repo: Repository, index: number, total: number): THREE.Vector3 {
  const seedA = hashNumber(`${repo.id}:a`);
  const seedB = hashNumber(`${repo.id}:b`);
  const seedC = hashNumber(`${repo.id}:c`);

  // Normalised position in funnel: 0 = top, 1 = bottom
  const t = index / Math.max(1, total - 1);

  // Funnel height range
  const y = 6.2 - t * 12.4 + (seedA - 0.5) * 1.4;

  // Wide crown → pinched waist → slightly wider base (hurricane profile)
  const crown    = 0.5 + Math.pow(1 - t, 1.4) * 5.2;
  const waist    = -0.55 * Math.sin(t * Math.PI * 1.8) * (0.7 + seedC * 0.3);
  const baseFlare = 0.4 * Math.pow(t, 3.5);
  const radius = Math.max(0.3, (crown + waist + baseFlare) * (0.72 + seedB * 0.38));

  // Category stream angle offset
  const catIndex = CATEGORY_ORDER.indexOf(repo.category as typeof CATEGORY_ORDER[number]);
  const streamOffset = catIndex * (Math.PI * 2 / CATEGORY_ORDER.length);
  const angle = t * 12 + streamOffset + seedA * 1.6;

  return new THREE.Vector3(
    Math.cos(angle) * radius,
    y,
    Math.sin(angle) * radius * 0.7,
  );
}

type MarbleSeed = {
  driftFreq: number;
  driftAmp: number;
  driftPhase: number;
  turbFreq: number;
  turbAmp: number;
};

function repositoryLivePosition(
  base: THREE.Vector3,
  seed: MarbleSeed,
  time: number,
  target = new THREE.Vector3(),
): THREE.Vector3 {
  const drift = Math.sin(time * seed.driftFreq + seed.driftPhase) * seed.driftAmp;
  const turbX = Math.sin(time * seed.turbFreq + seed.driftPhase * 1.3) * seed.turbAmp;
  const turbZ = Math.cos(time * seed.turbFreq + seed.driftPhase * 0.7) * seed.turbAmp;
  return target.set(base.x + turbX, base.y + drift, base.z + turbZ);
}

const HIGHLIGHT_PEER_LIMIT = 12;

// ── Marble system ───────────────────────────────────────────────────────────
function RepositoryMarbles({ repositories }: { repositories: Repository[] }) {
  const meshRef    = useRef<THREE.InstancedMesh>(null);
  const haloRef    = useRef<THREE.InstancedMesh>(null);
  const pickRef    = useRef<THREE.InstancedMesh>(null);
  const groupRef   = useRef<THREE.Group>(null);
  const timeRef    = useRef(0);
  const hoveredId   = useAtlasStore((s) => s.hoveredId);
  const selectedId  = useAtlasStore((s) => s.selectedId);
  const activeCategory = useAtlasStore((s) => s.category);
  const activeLanguage = useAtlasStore((s) => s.language);
  const activeTopic    = useAtlasStore((s) => s.topic);
  const autoRotate = useAtlasStore((s) => s.autoRotate);
  const setHovered = useAtlasStore((s) => s.setHovered);
  const setSelected = useAtlasStore((s) => s.setSelected);

  const total = repositories.length;
  const basePositions = useMemo(
    () => repositories.map((r, i) => repositoryPosition(r, i, total)),
    [repositories, total],
  );

  // Pre-compute per-particle turbulence seeds
  const seeds = useMemo(
    () => repositories.map((r) => ({
      driftFreq: 0.18 + hashNumber(`${r.id}:df`) * 0.22,
      driftAmp:  0.04 + hashNumber(`${r.id}:da`) * 0.10,
      driftPhase: hashNumber(`${r.id}:dp`) * Math.PI * 2,
      turbFreq:  0.55 + hashNumber(`${r.id}:tf`) * 0.45,
      turbAmp:   0.02 + hashNumber(`${r.id}:ta`) * 0.06,
    })),
    [repositories],
  );

  useFrame((_, rawDelta) => {
    const mesh = meshRef.current;
    const halo = haloRef.current;
    const pick = pickRef.current;
    const group = groupRef.current;
    if (!mesh || !halo || !pick || !group) return;

    const delta = Math.min(rawDelta, 0.05);
    timeRef.current += delta;
    const t = timeRef.current;

    if (autoRotate) group.rotation.y += delta * 0.10;

    const dummy = new THREE.Object3D();

    repositories.forEach((repo, index) => {
      const base = basePositions[index];
      const seed = seeds[index];
      if (!base || !seed) return;

      // Vertical drift + turbulence
      const drift = Math.sin(t * seed.driftFreq + seed.driftPhase) * seed.driftAmp;
      const turbX = Math.sin(t * seed.turbFreq + seed.driftPhase * 1.3) * seed.turbAmp;
      const turbZ = Math.cos(t * seed.turbFreq + seed.driftPhase * 0.7) * seed.turbAmp;

      dummy.position.set(base.x + turbX, base.y + drift, base.z + turbZ);

      // Dummy dust is ~0.022; marbles sit just above that as small colored beads
      const baseSize  = 0.055 + hashNumber(`${repo.id}:sz`) * 0.028;
      const impBonus  = repo.importance * 0.04;
      const isHovered   = repo.id === hoveredId;
      const isSelected  = repo.id === selectedId;

      const categoryMatch  = !activeCategory  || repo.category === activeCategory;
      const languageMatch  = !activeLanguage  || repo.language === activeLanguage;
      const topicMatch     = !activeTopic     || repo.topics.includes(activeTopic);
      const filterMatch    = categoryMatch && languageMatch && topicMatch;

      const selectedCategoryMatch = !selectedId ||
        repositories.find((r) => r.id === selectedId)?.category === repo.category;

      const dimmed = !filterMatch || (selectedId && !selectedCategoryMatch && !isSelected);
      const marbleSize = baseSize + impBonus;
      const scale  = isHovered || isSelected
        ? marbleSize * 1.85
        : dimmed
        ? marbleSize * 0.72
        : marbleSize;

      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);

      dummy.scale.setScalar(scale * 1.7);
      dummy.updateMatrix();
      halo.setMatrixAt(index, dummy.matrix);

      dummy.scale.setScalar(scale * PICK_HIT_MULTIPLIER);
      dummy.updateMatrix();
      pick.setMatrixAt(index, dummy.matrix);

      const marbleColor = getMarbleColor(repo);
      const haloColor = marbleColor.clone();
      if (dimmed && !isHovered && !isSelected) {
        marbleColor.multiplyScalar(0.45);
        haloColor.multiplyScalar(0.18);
      } else if (isHovered || isSelected) {
        marbleColor.offsetHSL(0, 0.04, 0.12);
        haloColor.multiplyScalar(1.1);
      }
      mesh.setColorAt(index, marbleColor);
      halo.setColorAt(index, haloColor);
    });

    mesh.instanceMatrix.needsUpdate = true;
    halo.instanceMatrix.needsUpdate = true;
    pick.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    if (halo.instanceColor) halo.instanceColor.needsUpdate = true;
  });

  useEffect(() => {
    if (meshRef.current) meshRef.current.raycast = () => undefined;
    if (haloRef.current) haloRef.current.raycast = () => undefined;
  }, []);

  const identify = (instanceId: number | undefined): Repository | undefined => {
    if (instanceId === undefined) return undefined;
    return repositories[instanceId];
  };

  return (
    <group ref={groupRef} rotation={[0.05, -0.25, -0.04]}>
      <CategoryEdges
        repositories={repositories}
        basePositions={basePositions}
        seeds={seeds}
        timeRef={timeRef}
      />
      <instancedMesh
        ref={haloRef}
        args={[undefined, undefined, repositories.length]}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 10, 8]} />
        <primitive object={haloMaterial} attach="material" />
      </instancedMesh>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, repositories.length]}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 12, 10]} />
        <primitive object={marbleMaterial} attach="material" />
      </instancedMesh>
      <instancedMesh
        ref={pickRef}
        args={[undefined, undefined, repositories.length]}
        frustumCulled={false}
        onPointerMove={(e) => {
          e.stopPropagation();
          setHovered(identify(e.instanceId)?.id ?? null);
        }}
        onPointerOut={() => setHovered(null)}
        onClick={(e) => {
          e.stopPropagation();
          const repo = identify(e.instanceId);
          if (repo) setSelected(repo.id);
        }}
      >
        <sphereGeometry args={[1, 8, 6]} />
        <primitive object={pickMaterial} attach="material" />
      </instancedMesh>
    </group>
  );
}

// ── Atmospheric dust / fine particles ──────────────────────────────────────
function AtmosphericFunnel() {
  const groupRef  = useRef<THREE.Group>(null);
  const autoRotate = useAtlasStore((s) => s.autoRotate);

  const geometry = useMemo(() => {
    const count = 4200;
    const positions = new Float32Array(count * 3);
    const colors    = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const t      = hashNumber(`dust:${i}:t`);
      const yRaw   = hashNumber(`dust:${i}:y`);
      const rSeed  = hashNumber(`dust:${i}:r`);
      const aSeed  = hashNumber(`dust:${i}:a`);

      const y      = 7.0 - t * 14.0;
      const crown  = 0.3 + Math.pow(1 - t, 1.3) * 5.8;
      const waist  = -0.45 * Math.sin(t * Math.PI * 1.8);
      const radius = Math.max(0.15, (crown + waist) * (0.55 + rSeed * 0.55));
      const angle  = t * 14 + aSeed * Math.PI * 2;

      positions[i * 3]     = Math.cos(angle) * radius;
      positions[i * 3 + 1] = y + (yRaw - 0.5) * 0.8;
      positions[i * 3 + 2] = Math.sin(angle) * radius * 0.70;

      const catIndex = i % CATEGORY_ORDER.length;
      const cat = CATEGORY_ORDER[catIndex] ?? "Other";
      const token = CATEGORY_TOKEN[cat];
      const color = getCategoryColor(token);
      colors[i * 3]     = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color",    new THREE.BufferAttribute(colors, 3));
    return geo;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((_, rawDelta) => {
    if (!groupRef.current || !autoRotate) return;
    groupRef.current.rotation.y -= Math.min(rawDelta, 0.05) * 0.048;
  });

  return (
    <group ref={groupRef} rotation={[0.05, -0.25, -0.04]}>
      <points geometry={geometry}>
        <pointsMaterial
          size={0.048}
          vertexColors
          transparent
          opacity={0.55}
          sizeAttenuation
          depthWrite={false}
        />
      </points>
    </group>
  );
}

// ── Orbital ring traces ─────────────────────────────────────────────────────
function OrbitalTraces() {
  const geometry = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let ring = 0; ring < 28; ring++) {
      const t = ring / 27;
      const y = 6.2 - t * 11.5;
      const crown = 0.4 + Math.pow(1 - t, 1.4) * 5.0;
      const waist = -0.5 * Math.sin(t * Math.PI * 1.8);
      const r = Math.max(0.2, crown + waist);
      for (let s = 0; s < 64; s++) {
        const angle = (s / 63) * Math.PI * 2 + ring * 0.28;
        pts.push(new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r * 0.70));
      }
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <lineSegments geometry={geometry} rotation={[0.05, -0.25, -0.04]}>
      <lineBasicMaterial color="white" transparent opacity={0.032} depthWrite={false} />
    </lineSegments>
  );
}

// ── Category edges (same rotating group as marbles, live positions) ─────────
function CategoryEdges({
  repositories,
  basePositions,
  seeds,
  timeRef,
}: {
  repositories: Repository[];
  basePositions: THREE.Vector3[];
  seeds: MarbleSeed[];
  timeRef: MutableRefObject<number>;
}) {
  const selectedId = useAtlasStore((s) => s.selectedId);
  const hoveredId = useAtlasStore((s) => s.hoveredId);
  const showRelationships = useAtlasStore((s) => s.showRelationships);
  // Hover previews connections; falls back to selection when pointer is idle
  const focusId = hoveredId ?? selectedId;
  const isHoverOnly = hoveredId !== null && hoveredId !== selectedId;
  const highlightRef = useRef<THREE.LineSegments>(null);
  const idleRef = useRef<THREE.LineSegments>(null);

  const idleCapacity = useMemo(() => Math.min(120, repositories.length * 2), [repositories.length]);
  const highlightCapacity = HIGHLIGHT_PEER_LIMIT;

  const { idlePositions, idleColors } = useMemo(() => {
    const positions = new Float32Array(idleCapacity * 6);
    const colors = new Float32Array(idleCapacity * 6);
    return { idlePositions: positions, idleColors: colors };
  }, [idleCapacity]);

  const { highlightPositions, highlightColors } = useMemo(() => {
    const positions = new Float32Array(highlightCapacity * 6);
    const colors = new Float32Array(highlightCapacity * 6);
    return { highlightPositions: positions, highlightColors: colors };
  }, [highlightCapacity]);

  const idleGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(idlePositions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(idleColors, 3));
    geo.setDrawRange(0, 0);
    return geo;
  }, [idlePositions, idleColors]);

  const highlightGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(highlightPositions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(highlightColors, 3));
    geo.setDrawRange(0, 0);
    return geo;
  }, [highlightPositions, highlightColors]);

  useEffect(() => () => {
    idleGeo.dispose();
    highlightGeo.dispose();
  }, [idleGeo, highlightGeo]);

  // Static idle edges: nearest same-category neighbor per repo (layout positions)
  useEffect(() => {
    if (!showRelationships) {
      idleGeo.setDrawRange(0, 0);
      return;
    }

    let edgeCount = 0;
    repositories.forEach((repo, i) => {
      if (edgeCount >= idleCapacity) return;
      const pos = basePositions[i];
      if (!pos) return;

      let bestDist = Infinity;
      let bestIndex = -1;
      repositories.forEach((other, j) => {
        if (i === j || other.category !== repo.category) return;
        const otherPos = basePositions[j];
        if (!otherPos) return;
        const dist = pos.distanceToSquared(otherPos);
        if (dist < bestDist) {
          bestDist = dist;
          bestIndex = j;
        }
      });

      if (bestIndex < 0) return;
      const peerPos = basePositions[bestIndex];
      if (!peerPos) return;

      const color = getRepositoryColor(repo);
      const base = edgeCount * 6;
      idlePositions[base]     = pos.x;
      idlePositions[base + 1] = pos.y;
      idlePositions[base + 2] = pos.z;
      idlePositions[base + 3] = peerPos.x;
      idlePositions[base + 4] = peerPos.y;
      idlePositions[base + 5] = peerPos.z;
      idleColors[base]     = color.r;
      idleColors[base + 1] = color.g;
      idleColors[base + 2] = color.b;
      idleColors[base + 3] = color.r;
      idleColors[base + 4] = color.g;
      idleColors[base + 5] = color.b;
      edgeCount++;
    });

    idleGeo.setDrawRange(0, edgeCount * 2);
    idleGeo.attributes["position"]!.needsUpdate = true;
    idleGeo.attributes["color"]!.needsUpdate = true;
  }, [repositories, basePositions, showRelationships, idleCapacity, idleGeo, idlePositions, idleColors]);

  useFrame(() => {
    if (!showRelationships || focusId === null) {
      highlightGeo.setDrawRange(0, 0);
      return;
    }

    const focusIndex = repositories.findIndex((r) => r.id === focusId);
    if (focusIndex < 0) {
      highlightGeo.setDrawRange(0, 0);
      return;
    }

    const focus = repositories[focusIndex];
    const focusBase = basePositions[focusIndex];
    const focusSeed = seeds[focusIndex];
    if (!focus || !focusBase || !focusSeed) return;

    const time = timeRef.current;
    const origin = repositoryLivePosition(focusBase, focusSeed, time);
    const peer = new THREE.Vector3();
    const candidates: { index: number; dist: number }[] = [];

    repositories.forEach((repo, index) => {
      if (index === focusIndex || repo.category !== focus.category) return;
      const base = basePositions[index];
      const seed = seeds[index];
      if (!base || !seed) return;
      repositoryLivePosition(base, seed, time, peer);
      candidates.push({ index, dist: origin.distanceToSquared(peer) });
    });

    candidates.sort((a, b) => a.dist - b.dist);
    const color = getRepositoryColor(focus);
    let edgeCount = 0;

    for (const { index } of candidates.slice(0, HIGHLIGHT_PEER_LIMIT)) {
      const base = basePositions[index];
      const seed = seeds[index];
      if (!base || !seed) continue;

      repositoryLivePosition(base, seed, time, peer);
      const offset = edgeCount * 6;
      highlightPositions[offset]     = origin.x;
      highlightPositions[offset + 1] = origin.y;
      highlightPositions[offset + 2] = origin.z;
      highlightPositions[offset + 3] = peer.x;
      highlightPositions[offset + 4] = peer.y;
      highlightPositions[offset + 5] = peer.z;
      highlightColors[offset]     = color.r;
      highlightColors[offset + 1] = color.g;
      highlightColors[offset + 2] = color.b;
      highlightColors[offset + 3] = color.r;
      highlightColors[offset + 4] = color.g;
      highlightColors[offset + 5] = color.b;
      edgeCount++;
    }

    highlightGeo.setDrawRange(0, edgeCount * 2);
    highlightGeo.attributes["position"]!.needsUpdate = true;
    highlightGeo.attributes["color"]!.needsUpdate = true;
  });

  if (!showRelationships) return null;

  return (
    <>
      <lineSegments ref={idleRef} geometry={idleGeo} visible={focusId === null}>
        <lineBasicMaterial vertexColors transparent opacity={0.12} depthWrite={false} />
      </lineSegments>
      <lineSegments ref={highlightRef} geometry={highlightGeo}>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={isHoverOnly ? 0.42 : 0.65}
          depthWrite={false}
          linewidth={2}
        />
      </lineSegments>
    </>
  );
}

// ── Scene root ──────────────────────────────────────────────────────────────
function Scene({ repositories }: { repositories: Repository[] }) {
  const setHovered = useAtlasStore((s) => s.setHovered);
  return (
    <>
      <color attach="background" args={["#05070b"]} />
      <fogExp2 attach="fog" args={["#05070b", 0.028]} />
      <ambientLight intensity={0.70} />
      <directionalLight position={[6, 9, 7]} intensity={1.4} />
      <pointLight position={[-6, 5, 4]} intensity={18} color="#7c3aed" />
      <pointLight position={[6,  2, 3]} intensity={14} color="#06b6d4" />
      <pointLight position={[0, -5, 2]} intensity={10} color="#fb923c" />
      <AtmosphericFunnel />
      <OrbitalTraces />
      <RepositoryMarbles repositories={repositories} />
      <OrbitControls
        enableDamping
        dampingFactor={0.06}
        enablePan={false}
        minDistance={9}
        maxDistance={26}
        minPolarAngle={Math.PI * 0.34}
        maxPolarAngle={Math.PI * 0.66}
        target={[0, 0.2, 0]}
      />
      {/* Invisible shell catches pointer-out to clear hover */}
      <mesh visible={false} onPointerMove={() => setHovered(null)}>
        <sphereGeometry args={[32]} />
        <meshBasicMaterial side={THREE.BackSide} />
      </mesh>
    </>
  );
}

// ── Public export ───────────────────────────────────────────────────────────
export function AtlasScene({ repositories, onPointerPosition }: AtlasSceneProps) {
  return (
    <div
      className="absolute inset-0 touch-none"
      onPointerMove={(e) => onPointerPosition(e.clientX, e.clientY)}
      aria-label="Interactive 3D repository atlas"
      role="img"
    >
      <Canvas
        dpr={[1, 1.8]}
        camera={{ position: [0, 0.5, 17], fov: 46 }}
        gl={{ antialias: true, alpha: false }}
      >
        <Scene repositories={repositories} />
      </Canvas>
    </div>
  );
}
