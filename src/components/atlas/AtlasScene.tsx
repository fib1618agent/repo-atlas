import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
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

// ── Marble system ───────────────────────────────────────────────────────────
function RepositoryMarbles({ repositories }: { repositories: Repository[] }) {
  const meshRef    = useRef<THREE.InstancedMesh>(null);
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
    const group = groupRef.current;
    if (!mesh || !group) return;

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

      // Sizing: base + importance bonus
      const baseSize  = 0.09 + hashNumber(`${repo.id}:sz`) * 0.08;
      const impBonus  = repo.importance * 0.12;
      const isHovered   = repo.id === hoveredId;
      const isSelected  = repo.id === selectedId;

      const categoryMatch  = !activeCategory  || repo.category === activeCategory;
      const languageMatch  = !activeLanguage  || repo.language === activeLanguage;
      const topicMatch     = !activeTopic     || repo.topics.includes(activeTopic);
      const filterMatch    = categoryMatch && languageMatch && topicMatch;

      const selectedCategoryMatch = !selectedId ||
        repositories.find((r) => r.id === selectedId)?.category === repo.category;

      const dimmed = !filterMatch || (selectedId && !selectedCategoryMatch && !isSelected);
      const scale  = isHovered || isSelected
        ? (baseSize + impBonus) * 2.4
        : dimmed
        ? (baseSize + impBonus) * 0.28
        : baseSize + impBonus;

      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);

      // Color
      const token = CATEGORY_TOKEN[repo.category];
      const color = getCategoryColor(token);
      if (dimmed && !isHovered && !isSelected) {
        color.multiplyScalar(0.18);
      } else if (isHovered || isSelected) {
        color.multiplyScalar(1.5);
      }
      mesh.setColorAt(index, color);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  const identify = (instanceId: number | undefined): Repository | undefined => {
    if (instanceId === undefined) return undefined;
    return repositories[instanceId];
  };

  return (
    <group ref={groupRef} rotation={[0.05, -0.25, -0.04]}>
      <instancedMesh
        ref={meshRef}
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
          if (repo) setSelected(repo.id === selectedId ? null : repo.id);
        }}
      >
        <sphereGeometry args={[1, 12, 10]} />
        <meshStandardMaterial
          roughness={0.15}
          metalness={0.25}
          emissiveIntensity={0.85}
          vertexColors
        />
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
          size={0.038}
          vertexColors
          transparent
          opacity={0.62}
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

// ── Category relationship edges ─────────────────────────────────────────────
function RelationshipEdges({ repositories }: { repositories: Repository[] }) {
  const selectedId = useAtlasStore((s) => s.selectedId);
  const showRelationships = useAtlasStore((s) => s.showRelationships);
  const total = repositories.length;

  const { idleGeo, highlightGeo } = useMemo(() => {
    if (!showRelationships) return { idleGeo: null, highlightGeo: null };

    const positions = repositories.map((r, i) => repositoryPosition(r, i, total));
    const idlePts: number[] = [];
    const hlPts: number[]   = [];
    const IDLE_BUDGET = 180;
    let idleCount = 0;

    const selected = selectedId !== null
      ? repositories.find((r) => r.id === selectedId)
      : null;
    const selectedPos = selected
      ? positions[repositories.indexOf(selected)]
      : null;

    repositories.forEach((repo, i) => {
      const pos = positions[i];
      if (!pos) return;

      // Highlight edges: connect selected to same-category peers (nearest 8)
      if (selected && selectedPos && repo.category === selected.category && repo.id !== selected.id) {
        hlPts.push(selectedPos.x, selectedPos.y, selectedPos.z, pos.x, pos.y, pos.z);
      }

      // Idle edges: random same-category pairs
      if (idleCount < IDLE_BUDGET) {
        for (let j = i + 1; j < repositories.length && idleCount < IDLE_BUDGET; j++) {
          const other = repositories[j];
          const otherPos = positions[j];
          if (!other || !otherPos) continue;
          if (other.category === repo.category && hashNumber(`edge:${i}:${j}`) < 0.08) {
            idlePts.push(pos.x, pos.y, pos.z, otherPos.x, otherPos.y, otherPos.z);
            idleCount++;
          }
        }
      }
    });

    const makeGeo = (pts: number[]) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pts), 3));
      return geo;
    };
    return { idleGeo: makeGeo(idlePts), highlightGeo: makeGeo(hlPts) };
  }, [repositories, selectedId, showRelationships, total]);

  useEffect(() => () => { idleGeo?.dispose(); highlightGeo?.dispose(); }, [idleGeo, highlightGeo]);

  if (!showRelationships) return null;

  return (
    <group rotation={[0.05, -0.25, -0.04]}>
      {idleGeo && (
        <lineSegments geometry={idleGeo}>
          <lineBasicMaterial color="white" transparent opacity={0.045} depthWrite={false} />
        </lineSegments>
      )}
      {highlightGeo && (
        <lineSegments geometry={highlightGeo}>
          <lineBasicMaterial color="#a78bfa" transparent opacity={0.30} depthWrite={false} />
        </lineSegments>
      )}
    </group>
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
      <directionalLight position={[6, 9, 7]} intensity={1.8} />
      <pointLight position={[-6, 5, 4]} intensity={55} color="#7c3aed" />
      <pointLight position={[6,  2, 3]} intensity={45} color="#06b6d4" />
      <pointLight position={[0, -5, 2]} intensity={30} color="#fb923c" />
      <AtmosphericFunnel />
      <OrbitalTraces />
      <RelationshipEdges repositories={repositories} />
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
