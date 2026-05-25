import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Line, Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import './ProteinViewer.css';

// ─── Colour helpers ──────────────────────────────────────────────────────────

function getAtomColor(coord, settings, predictionData, colorOverride, isPocketAtom) {
  if (isPocketAtom) return new THREE.Color('#ff3366');
  if (colorOverride) return new THREE.Color(colorOverride);
  if (settings.colorScheme === 'confidence') {
    return new THREE.Color().setHSL((coord.b_factor ?? 0.85) * 0.7, 1, 0.5);
  }
  if (settings.colorScheme === 'structure' && predictionData) {
    const ss = predictionData.structure?.secondary_structure?.[coord.residue_idx];
    if (ss === 'H') return new THREE.Color('#4a90e2');
    if (ss === 'E') return new THREE.Color('#50c878');
    return new THREE.Color('#ffc300');
  }
  if (settings.colorScheme === 'element') {
    if (coord.element === 'O') return new THREE.Color('#ffb703');
    if (coord.element === 'N') return new THREE.Color('#fb8500');
    return new THREE.Color('#90e0ef');
  }
  return new THREE.Color('#ffffff');
}

function ssColor(ss) {
  if (ss === 'H') return new THREE.Color('#4a90e2'); // helix — blue
  if (ss === 'E') return new THREE.Color('#50c878'); // sheet — green
  return new THREE.Color('#ffc300');                 // loop  — yellow
}

// ─── Atom sphere ─────────────────────────────────────────────────────────────

function Atom({ position, color, size }) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[size, 16, 16]} />
      <meshStandardMaterial color={color} roughness={0.4} metalness={0.1} />
    </mesh>
  );
}

// ─── Binding pocket ──────────────────────────────────────────────────────────

function BindingPocket({ center }) {
  const meshRef = useRef();
  useFrame(({ clock }) => {
    if (meshRef.current) {
      const s = 1.0 + Math.sin(clock.getElapsedTime() * 2.5) * 0.08;
      meshRef.current.scale.set(s, s, s);
    }
  });
  return (
    <mesh position={center} ref={meshRef}>
      <sphereGeometry args={[3.0, 32, 32]} />
      <meshStandardMaterial
        color="#ff3366"
        transparent opacity={0.2}
        roughness={0.2} metalness={0.1}
        emissive="#ff3366" emissiveIntensity={0.6}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// ─── Residue labels ──────────────────────────────────────────────────────────

function ResidueLabels({ caAtoms, settings, predictionData, colorOverride }) {
  // Only label every Nth residue to avoid clutter; scale with sequence length
  const step = caAtoms.length > 100 ? 10 : caAtoms.length > 40 ? 5 : 2;

  return caAtoms
    .filter((_, i) => i % step === 0)
    .map((ca) => {
      const ss = predictionData?.structure?.secondary_structure?.[ca.residue_idx] ?? 'L';
      const color = colorOverride
        ? colorOverride
        : settings.colorScheme === 'structure'
          ? '#' + ssColor(ss).getHexString()
          : '#ffffff';

      return (
        <Billboard key={`label-${ca.residue_idx}`} position={[ca.x, ca.y + 0.9, ca.z]}>
          <Text
            fontSize={0.55}
            color={color}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.06}
            outlineColor="#000000"
          >
            {ca.residue}{ca.residue_idx + 1}
          </Text>
        </Billboard>
      );
    });
}

// ─── Cartoon ribbon ──────────────────────────────────────────────────────────

/**
 * Builds a smooth tube along the Cα backbone, coloured per-segment by SS type.
 * We split the backbone into contiguous runs of the same SS type and render
 * each run as a separate TubeGeometry so colours are clean.
 */
function CartoonRibbon({ caAtoms, predictionData, colorOverride, settings }) {
  const segments = useMemo(() => {
    if (caAtoms.length < 2) return [];

    const ss = predictionData?.structure?.secondary_structure ?? '';

    // Split into runs of the same SS character
    const runs = [];
    let runStart = 0;

    for (let i = 1; i <= caAtoms.length; i++) {
      const prevSS = ss[caAtoms[i - 1]?.residue_idx] ?? 'L';
      const currSS = ss[caAtoms[i]?.residue_idx] ?? 'L';

      if (i === caAtoms.length || currSS !== prevSS) {
        // Include one overlap atom on each side for smooth joins
        const from = Math.max(0, runStart - 1);
        const to = Math.min(caAtoms.length - 1, i);
        runs.push({ atoms: caAtoms.slice(from, to + 1), ss: prevSS });
        runStart = i;
      }
    }

    return runs.map(({ atoms, ss: runSS }) => {
      if (atoms.length < 2) return null;

      const points = atoms.map(a => new THREE.Vector3(a.x, a.y, a.z));
      const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);

      // Tube radius and segments vary by SS type for a classic ribbon look
      const isHelix = runSS === 'H';
      const isSheet = runSS === 'E';
      const tubeRadius = isHelix ? 0.45 : isSheet ? 0.35 : 0.2;
      const tubularSegments = Math.max(atoms.length * 6, 20);
      const radialSegments = isHelix ? 10 : isSheet ? 6 : 6;

      const geometry = new THREE.TubeGeometry(curve, tubularSegments, tubeRadius, radialSegments, false);

      let color;
      if (colorOverride) {
        color = new THREE.Color(colorOverride);
      } else if (settings.colorScheme === 'structure') {
        color = ssColor(runSS);
      } else {
        // For confidence/element schemes, use the midpoint atom's colour
        const mid = atoms[Math.floor(atoms.length / 2)];
        color = getAtomColor(mid, settings, predictionData, null, false);
      }

      return { geometry, color: '#' + color.getHexString(), key: `${runSS}-${atoms[0].residue_idx}` };
    }).filter(Boolean);
  }, [caAtoms, predictionData, colorOverride, settings]);

  return (
    <group>
      {segments.map(({ geometry, color, key }) => (
        <mesh key={key} geometry={geometry}>
          <meshStandardMaterial color={color} roughness={0.35} metalness={0.05} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Main protein group ───────────────────────────────────────────────────────

function Protein({ coordinates, settings, predictionData, colorOverride, bondColor }) {
  const groupRef = useRef();

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.05;
  });

  const isCartoon = settings.renderMode === 'cartoon';

  const caAtoms = useMemo(
    () => coordinates.filter(c => c.atom_type === 'CA'),
    [coordinates],
  );

  const lines = useMemo(() => {
    if (isCartoon) return { backbone: [], sidechains: [] };

    const backbone = [];
    const sidechains = [];

    for (let i = 0; i < caAtoms.length - 1; i++) {
      backbone.push([
        [caAtoms[i].x, caAtoms[i].y, caAtoms[i].z],
        [caAtoms[i + 1].x, caAtoms[i + 1].y, caAtoms[i + 1].z],
      ]);
    }

    coordinates.forEach(coord => {
      if (coord.atom_type !== 'CA') {
        const ca = caAtoms.find(c => c.residue_idx === coord.residue_idx);
        if (ca) {
          sidechains.push([
            [coord.x, coord.y, coord.z],
            [ca.x, ca.y, ca.z],
          ]);
        }
      }
    });

    return { backbone, sidechains };
  }, [coordinates, caAtoms, isCartoon]);

  const pocketSurfaceAtoms = predictionData?.binding_pockets?.surface_atoms ?? [];

  const atomSize = (isPocketAtom) => {
    const base = settings.renderMode === 'sticks' ? 0.15 : 0.5;
    return isPocketAtom ? base * 1.8 : base;
  };

  return (
    <group ref={groupRef}>
      {/* ── Cartoon ribbon ── */}
      {isCartoon && (
        <CartoonRibbon
          caAtoms={caAtoms}
          predictionData={predictionData}
          colorOverride={colorOverride}
          settings={settings}
        />
      )}

      {/* ── Atom spheres (spheres / sticks modes) ── */}
      {!isCartoon && coordinates.map((coord, index) => {
        const isPocketAtom = settings.showPockets && pocketSurfaceAtoms.includes(index);
        return (
          <Atom
            key={index}
            position={[coord.x, coord.y, coord.z]}
            color={getAtomColor(coord, settings, predictionData, colorOverride, isPocketAtom)}
            size={atomSize(isPocketAtom)}
          />
        );
      })}

      {/* ── Backbone + sidechain bonds ── */}
      {!isCartoon && settings.showBonds && lines.backbone.map((points, i) => (
        <Line key={`bb-${i}`} points={points} color={bondColor ?? '#ffffff'} lineWidth={2} transparent opacity={0.8} />
      ))}
      {!isCartoon && settings.showBonds && lines.sidechains.map((points, i) => (
        <Line key={`sc-${i}`} points={points} color="#a0aec0" lineWidth={1} transparent opacity={0.4} />
      ))}

      {/* ── Binding pocket overlay ── */}
      {settings.showPockets && predictionData?.binding_pockets?.center && (
        <BindingPocket center={predictionData.binding_pockets.center} />
      )}

      {/* ── Residue labels ── */}
      {settings.showLabels && caAtoms.length > 0 && (
        <ResidueLabels
          caAtoms={caAtoms}
          settings={settings}
          predictionData={predictionData}
          colorOverride={colorOverride}
        />
      )}
    </group>
  );
}

// ─── Exported viewer ─────────────────────────────────────────────────────────

export default function ProteinViewer({ coordinates, settings, predictionData, coordinates2, predictionData2 }) {
  if (!coordinates || coordinates.length === 0) {
    return (
      <div className="protein-viewer-empty">
        <p>No protein structure loaded. Enter a sequence to predict.</p>
      </div>
    );
  }

  const allCoords = [...coordinates, ...(coordinates2 ?? [])];
  const sum = allCoords.reduce((acc, c) => ({ x: acc.x + c.x, y: acc.y + c.y, z: acc.z + c.z }), { x: 0, y: 0, z: 0 });
  const center = [sum.x / allCoords.length, sum.y / allCoords.length, sum.z / allCoords.length];

  const distances = allCoords.map(c =>
    Math.sqrt((c.x - center[0]) ** 2 + (c.y - center[1]) ** 2 + (c.z - center[2]) ** 2),
  );
  const cameraDistance = Math.max(Math.max(...distances) * 1.5, 10);

  return (
    <div className="protein-viewer-container">
      <Canvas camera={{ position: [center[0], center[1], center[2] + cameraDistance], fov: 45 }}>
        <ambientLight intensity={0.6} />
        <pointLight position={[100, 100, 100]} intensity={1.5} />
        <pointLight position={[-100, -100, -100]} intensity={0.5} />
        <directionalLight position={[0, 10, 0]} intensity={0.5} />

        <Protein
          coordinates={coordinates}
          settings={settings}
          predictionData={predictionData}
          colorOverride={coordinates2 ? '#00ffff' : null}
          bondColor={coordinates2 ? '#00ffff' : null}
        />

        {coordinates2 && (
          <Protein
            coordinates={coordinates2}
            settings={settings}
            predictionData={predictionData2}
            colorOverride="#ff00ff"
            bondColor="#ff00ff"
          />
        )}

        <OrbitControls target={center} />
      </Canvas>
    </div>
  );
}
