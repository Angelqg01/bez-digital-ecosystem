import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  OrbitControls, Html, Box, Cylinder, Line, Text, Billboard, Grid,
  Environment, Lightformer, PerformanceMonitor, Instances, Instance,
} from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, SMAA } from '@react-three/postprocessing';
import * as THREE from 'three';
import { LOCATIONS, TransitMode, VehicleType, Telemetry, Phase } from '../engine/types';
import { buildRoute } from './routePath';

interface SceneProps {
  currentLocationIndex: number;
  vehicleType: VehicleType;
  telemetry?: Telemetry;
  mode: TransitMode;
  stepIndex?: number;
  isRunning?: boolean;
  isFinished?: boolean;
  phase?: Phase;
  /** Rotura de frío activa en el tramo actual (tránsito/destino en rojo). */
  breachActive?: boolean;
  /** El navegador ha perdido el contexto WebGL: el contenedor cae al mapa 2D. */
  onContextLost?: () => void;
  /** Llamada SDK de la etapa en curso, mostrada como baliza sobre la parada. */
  sdkBeacon?: SdkBeaconData;
  selectedLocation?: number | null;
  onSelectLocation?: (idx: number) => void;
  /** director: encuadra cada parada; free: la cámara es sólo del usuario. */
  cameraMode?: 'director' | 'free';
  onSelectVehicle?: () => void;
  /** Velocidad de la simulación (1x/2x/5x): el vehículo avanza a ese ritmo. */
  simSpeed?: number;
  /** Etapa B-UID en curso (STOWED/LOADED → la grúa del puerto carga el contenedor). */
  stage?: string;
}

// Etiquetas en WebGL (troika) en vez de <Html>: no se montan sobre el HUD, no
// hacen layout del DOM en cada frame y respetan la profundidad de la escena.
function NodeLabel({ name, offset = [0, 2.5, 0] }: { name: string; offset?: [number, number, number] }) {
  return (
    <Billboard position={offset}>
      <Text fontSize={0.3} color="#e4e4e7" letterSpacing={0.1} anchorX="center" anchorY="middle"
        outlineWidth={0.045} outlineColor="#09090b" outlineOpacity={0.9}>
        {name.toUpperCase()}
      </Text>
    </Billboard>
  );
}

function Chip({ text, color, position, size = 0.16 }: { text: string; color: string; position: [number, number, number]; size?: number }) {
  return (
    <Billboard position={position}>
      <Text fontSize={size} color={color} letterSpacing={0.1} anchorX="center" anchorY="middle">
        {text}
      </Text>
    </Billboard>
  );
}

// Pedestales de todas las paradas en 2 draw calls (antes 2 por parada).
const PLINTH_TOP: Partial<Record<string, string>> = { factory: '#3f3f46', customs: '#3f3f46' };
function PlinthsInstanced() {
  const nodes = LOCATIONS.filter((l) => l.type !== 'port');
  return (
    <group>
      <Instances limit={nodes.length} receiveShadow>
        <cylinderGeometry args={[2, 2.2, 0.4, 32]} />
        <meshStandardMaterial color="#18181b" roughness={0.8} metalness={0.2} />
        {nodes.map((l) => <Instance key={l.name} position={[l.position[0], -0.2, l.position[2]]} />)}
      </Instances>
      <Instances limit={nodes.length} receiveShadow>
        <cylinderGeometry args={[1.8, 1.8, 0.1, 32]} />
        <meshStandardMaterial roughness={0.6} metalness={0.25} />
        {nodes.map((l) => (
          <Instance key={l.name} position={[l.position[0], 0.05, l.position[2]]} color={PLINTH_TOP[l.type] ?? '#27272a'} />
        ))}
      </Instances>
    </group>
  );
}

function FactoryNode({ position, name }: { position: [number, number, number]; name: string }) {
  return (
    <group position={position}>
      <gridHelper args={[3, 10, '#52525b', '#27272a']} position={[0, 0.11, 0]} />
      <Box args={[1.8, 1.2, 1.4]} position={[0, 0.7, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#27272a" metalness={0.2} roughness={0.8} />
      </Box>
      <Cylinder args={[1.1, 1.1, 1.8, 3]} position={[0, 1.55, 0]} rotation={[Math.PI / 2, 0, Math.PI / 2]} castShadow>
        <meshStandardMaterial color="#3f3f46" metalness={0.4} />
      </Cylinder>
      <Box args={[1.85, 0.3, 0.8]} position={[0, 0.8, 0]} receiveShadow>
        <meshStandardMaterial color="#0ea5e9" emissive="#0ea5e9" emissiveIntensity={0.2} transparent opacity={0.6} />
      </Box>
      {[-0.5, 0.5].map((z, i) => (
        <group key={i} position={[-1.2, 0, z]}>
          <Cylinder args={[0.2, 0.25, 2.5, 16]} position={[0, 1.25, 0]}>
            <meshStandardMaterial color="#52525b" />
          </Cylinder>
          <Cylinder args={[0.15, 0.15, 0.2, 16]} position={[0, 2.6, 0]}>
            <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.5} />
          </Cylinder>
        </group>
      ))}
      <NodeLabel name={name} offset={[0, 3.5, 0]} />
    </group>
  );
}

function WarehouseNode({ position, name }: { position: [number, number, number]; name: string }) {
  return (
    <group position={position}>
      {/* Nave con techo curvo */}
      <Box args={[2.2, 1.0, 1.8]} position={[0, 0.6, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#334155" roughness={0.7} />
      </Box>
      <Cylinder args={[0.9, 0.9, 2.2, 16, 1, false, 0, Math.PI]} position={[0, 1.1, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <meshStandardMaterial color="#475569" metalness={0.4} roughness={0.5} />
      </Cylinder>
      {/* Puerta de muelle */}
      <Box args={[0.7, 0.6, 0.05]} position={[0, 0.4, 0.92]}>
        <meshStandardMaterial color="#0d9488" emissive="#0d9488" emissiveIntensity={0.4} />
      </Box>
      {/* Unidad frigorífica */}
      <Box args={[0.4, 0.4, 0.4]} position={[1.0, 1.3, -0.5]}>
        <meshStandardMaterial color="#e2e8f0" metalness={0.3} />
      </Box>
      <NodeLabel name={name} offset={[0, 2.8, 0]} />
    </group>
  );
}

function GateNode({ position, name }: { position: [number, number, number]; name: string }) {
  const barrierRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (barrierRef.current) {
      // La barrera se abre y cierra suavemente
      barrierRef.current.rotation.z = (Math.sin(state.clock.elapsedTime * 0.5) * 0.5 + 0.5) * (Math.PI / 2.4);
    }
  });
  return (
    <group position={position}>
      {/* Postes */}
      {[-1.4, 1.4].map((x, i) => (
        <Box key={i} args={[0.3, 1.6, 0.3]} position={[x, 0.85, 0]}>
          <meshStandardMaterial color="#f59e0b" metalness={0.4} />
        </Box>
      ))}
      {/* Barrera animada */}
      <mesh ref={barrierRef} position={[-1.3, 1.5, 0]}>
        <boxGeometry args={[2.7, 0.12, 0.12]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.6} />
      </mesh>
      {/* Lector RFID */}
      <Box args={[0.5, 0.7, 0.2]} position={[-1.4, 1.9, 0.3]}>
        <meshStandardMaterial color="#00d4aa" emissive="#00d4aa" emissiveIntensity={0.5} />
      </Box>
      <Chip text="DID + RFID CHECK" color="#5eead4" position={[-1.4, 2.5, 0.3]} />
      <NodeLabel name={name} offset={[0, 3.2, 0]} />
    </group>
  );
}

function CustomsNode({ position, name }: { position: [number, number, number]; name: string }) {
  return (
    <group position={position}>
      <Box args={[2.8, 0.2, 1.8]} position={[0, 1.8, 0]} castShadow>
        <meshStandardMaterial color="#1f2937" metalness={0.5} roughness={0.5} />
      </Box>
      <Box args={[2.6, 0.1, 1.6]} position={[0, 1.75, 0]}>
        <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={0.4} />
      </Box>
      {[[-1.2, -0.7], [1.2, -0.7], [-1.2, 0.7], [1.2, 0.7]].map(([x, z], i) => (
        <Box key={i} args={[0.2, 1.7, 0.2]} position={[x, 0.95, z]}>
          <meshStandardMaterial color="#4b5563" />
        </Box>
      ))}
      <Box args={[0.8, 1.2, 1.2]} position={[-1.6, 0.7, 0]} castShadow>
        <meshStandardMaterial color="#374151" />
      </Box>
      <Box args={[0.1, 0.6, 0.8]} position={[-1.15, 0.9, 0]}>
        <meshStandardMaterial color="#bae6fd" transparent opacity={0.5} />
      </Box>
      <Cylinder args={[0.05, 0.05, 1.5]} position={[0, 0.5, 1.2]} rotation={[Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color="#ef4444" />
      </Cylinder>
      <NodeLabel name={name} offset={[0, 2.5, 0]} />
    </group>
  );
}

function PortNode({ position, name, loading = false }: { position: [number, number, number]; name: string; loading?: boolean }) {
  const time = useRef(0);
  const arRef = useRef<THREE.Group>(null);
  const craneRef = useRef<THREE.Group>(null);
  const hookRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    time.current += delta;
    if (arRef.current) {
      arRef.current.rotation.y = time.current * 0.5;
      arRef.current.position.y = 3.2 + Math.sin(time.current * 2) * 0.1;
    }
    if (craneRef.current) {
      // En reposo oscila despacio; al cargar un contenedor se mueve con ciclos de izado y vuelve.
      craneRef.current.position.z = loading ? Math.sin(time.current * 1.4) * 0.7 : Math.sin(time.current * 0.5) * 0.5;
    }
    if (hookRef.current) {
      const lift = loading ? (0.5 + 0.5 * Math.sin(time.current * 1.4 + Math.PI / 2)) : 1;
      hookRef.current.position.y = -0.4 - lift * 1.1;
      hookRef.current.visible = loading;
    }
  });

  return (
    <group position={position}>
      <Cylinder args={[2.5, 2.7, 0.4, 32]} position={[0, -0.2, 0]}>
        <meshStandardMaterial color="#0f172a" roughness={0.1} metalness={0.8} />
      </Cylinder>
      <Box args={[3.2, 0.2, 2.5]} position={[-0.5, 0.1, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#27272a" roughness={0.8} />
      </Box>

      {/* Grúa pórtico */}
      <group position={[0, 0.2, 0]}>
        {[[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]].map(([x, z], i) => (
          <Box key={i} args={[0.2, 2.5, 0.2]} position={[x, 1.25, z]}>
            <meshStandardMaterial color="#f59e0b" />
          </Box>
        ))}
        <Box args={[2.0, 0.2, 0.2]} position={[0, 2.6, -0.8]} castShadow><meshStandardMaterial color="#f59e0b" /></Box>
        <Box args={[2.0, 0.2, 0.2]} position={[0, 2.6, 0.8]} castShadow><meshStandardMaterial color="#f59e0b" /></Box>
        <Box args={[0.2, 0.2, 2.0]} position={[-0.8, 2.6, 0]}><meshStandardMaterial color="#f59e0b" /></Box>
        <Box args={[0.2, 0.2, 2.0]} position={[0.8, 2.6, 0]}><meshStandardMaterial color="#f59e0b" /></Box>
        <Box args={[3.0, 0.3, 0.5]} position={[0.5, 2.8, 0]} castShadow><meshStandardMaterial color="#f59e0b" /></Box>
        <group ref={craneRef} position={[1.2, 2.6, 0]}>
          <Box args={[0.1, 1.5, 0.1]} position={[0, -0.75, 0]}><meshStandardMaterial color="#18181b" /></Box>
          <Box args={[0.8, 0.1, 0.4]} position={[0, -1.5, 0]}><meshStandardMaterial color="#f59e0b" /></Box>
          {/* Contenedor izado: sólo mientras se carga */}
          <group ref={hookRef} visible={false}>
            <Box args={[0.7, 0.42, 0.34]} position={[0, -0.25, 0]} castShadow>
              <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={0.35} roughness={0.5} />
            </Box>
          </group>
        </group>
      </group>

      {/* Pilas de contenedores */}
      <group position={[-1.2, 0.45, -0.5]}>
        <Box args={[0.8, 0.5, 0.4]} castShadow><meshStandardMaterial color="#3b82f6" /></Box>
        <Box args={[0.8, 0.5, 0.4]} position={[0, 0.5, 0]} castShadow><meshStandardMaterial color="#10b981" /></Box>
      </group>
      <group position={[-1.2, 0.45, 0.5]}>
        <Box args={[0.8, 0.5, 0.4]} castShadow><meshStandardMaterial color="#ef4444" /></Box>
      </group>

      {/* Holograma Smart Stowage AR */}
      <group ref={arRef} position={[0, 3.5, 0]}>
        <Box args={[1.2, 1.2, 1.2]}>
          <meshBasicMaterial color="#38bdf8" wireframe transparent opacity={0.6} />
        </Box>
        <Chip text="AR COG CALC" color="#7dd3fc" position={[0, 0.85, 0]} />
      </group>

      <NodeLabel name={name} offset={[0, 4.5, 0]} />
    </group>
  );
}

function AirportNode({ position, name }: { position: [number, number, number]; name: string }) {
  const radarRef = useRef<THREE.Group>(null);
  const loaderRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (radarRef.current) radarRef.current.rotation.y += delta * 2.5;
    if (loaderRef.current) loaderRef.current.position.y = 0.11 + Math.abs(Math.sin(state.clock.elapsedTime * 0.8)) * 0.35;
  });

  return (
    <group position={position}>
      <Box args={[3.2, 0.12, 1.2]} position={[0, 0.11, 0]}>
        <meshStandardMaterial color="#1f2937" roughness={0.9} />
      </Box>
      <Box args={[3.0, 0.13, 0.05]} position={[0, 0.12, 0]}>
        <meshStandardMaterial color="#fbbf24" />
      </Box>
      <group position={[0, 0.18, 0]}>
        {[-1.4, 0, 1.4].map((x, i) => (
          <mesh key={`g${i}`} position={[x, 0, 0.55]}>
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.8} />
          </mesh>
        ))}
        {[-1.4, 0, 1.4].map((x, i) => (
          <mesh key={`r${i}`} position={[x, 0, -0.55]}>
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.8} />
          </mesh>
        ))}
      </group>
      <Cylinder args={[0.2, 0.3, 1.5]} position={[-1.0, 0.8, -0.8]}>
        <meshStandardMaterial color="#d4d4d8" />
      </Cylinder>
      <Cylinder args={[0.3, 0.2, 0.4]} position={[-1.0, 1.7, -0.8]}>
        <meshStandardMaterial color="#bae6fd" transparent opacity={0.6} />
      </Cylinder>
      <group ref={radarRef} position={[-1.0, 1.95, -0.8]}>
        <Cylinder args={[0.03, 0.03, 0.15]} position={[0, 0.075, 0]}>
          <meshStandardMaterial color="#52525b" />
        </Cylinder>
        <Box args={[0.5, 0.08, 0.12]} position={[0, 0.15, 0]}>
          <meshStandardMaterial color="#ef4444" />
        </Box>
      </group>
      <Box args={[1.5, 0.8, 1.0]} position={[0.5, 0.5, -0.6]} castShadow>
        <meshStandardMaterial color="#e4e4e7" roughness={0.5} />
      </Box>
      <Cylinder args={[0.5, 0.5, 1.5]} position={[0.5, 0.9, -0.6]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <meshStandardMaterial color="#a1a1aa" />
      </Cylinder>
      <group position={[0.8, 0, 0.3]}>
        <Box args={[0.6, 0.12, 0.6]} position={[0, 0.06, 0]}>
          <meshStandardMaterial color="#374151" roughness={0.8} />
        </Box>
        <group ref={loaderRef}>
          <Box args={[0.55, 0.04, 0.55]} position={[0, 0.02, 0]}>
            <meshStandardMaterial color="#eab308" roughness={0.5} />
          </Box>
          <Box args={[0.35, 0.25, 0.35]} position={[0, 0.14, 0]}>
            <meshStandardMaterial color="#cbd5e1" metalness={0.7} roughness={0.3} />
          </Box>
        </group>
      </group>
      <NodeLabel name={name} offset={[0, 2.5, 0]} />
    </group>
  );
}

function CustomerNode({ position, name }: { position: [number, number, number]; name: string }) {
  return (
    <group position={position}>
      <Box args={[2.2, 1.5, 2.2]} position={[0, 0.85, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#e4e4e7" roughness={0.9} />
      </Box>
      <Box args={[2.4, 0.2, 2.4]} position={[0, 1.7, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#a1a1aa" roughness={0.7} />
      </Box>
      <Box args={[1.0, 0.2, 1.0]} position={[0.4, 1.9, 0.4]} castShadow>
        <meshStandardMaterial color="#71717a" roughness={0.5} />
      </Box>
      <Box args={[0.6, 0.6, 0.1]} position={[-0.5, 0.4, 1.1]}><meshStandardMaterial color="#18181b" /></Box>
      <Box args={[0.6, 0.6, 0.1]} position={[0.5, 0.4, 1.1]}><meshStandardMaterial color="#18181b" /></Box>
      <Box args={[0.2, 0.5, 0.2]} position={[1.2, 0.35, 1.2]} rotation={[0, -Math.PI / 4, 0]}>
        <meshStandardMaterial color="#18181b" />
      </Box>
      <Box args={[0.25, 0.3, 0.05]} position={[1.2, 0.65, 1.2]} rotation={[0, -Math.PI / 4, 0]}>
        <meshStandardMaterial color="#34d399" emissive="#34d399" emissiveIntensity={0.5} />
      </Box>
      <Chip text="VALIDATOR TERMINAL" color="#6ee7b7" position={[1.2, 1.05, 1.2]} size={0.18} />
      <NodeLabel name={name} offset={[0, 2.5, 0]} />
    </group>
  );
}

// Perímetro luminoso de la Zona Franca de Origen
function ZfPerimeter() {
  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const [x0, x1, z0, z1] = [-25.5, -0.8, -9, 5.5];
    pts.push(new THREE.Vector3(x0, 0.05, z0));
    pts.push(new THREE.Vector3(x1, 0.05, z0));
    pts.push(new THREE.Vector3(x1, 0.05, z1));
    pts.push(new THREE.Vector3(x0, 0.05, z1));
    pts.push(new THREE.Vector3(x0, 0.05, z0));
    return pts;
  }, []);
  return (
    <group>
      <Line points={points} color="#00d4aa" lineWidth={1.5} dashed dashSize={0.6} gapSize={0.4} transparent opacity={0.5} />
      <Text
        position={[-13, 0.06, -8.2]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={1.1}
        color="#00d4aa"
        fillOpacity={0.35}
        letterSpacing={0.3}
        anchorX="center"
      >
        ZONA FRANCA DE ORIGEN
      </Text>
      <Text
        position={[15.5, 0.06, -8.2]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={1.1}
        color="#38bdf8"
        fillOpacity={0.3}
        letterSpacing={0.3}
        anchorX="center"
      >
        DESTINO INTERNACIONAL
      </Text>
    </group>
  );
}

// 18 contenedores del buque en 1 draw call (antes 18, más otras 18 de sombra).
const SHIP_CONTAINERS: { pos: [number, number, number]; color: string }[] = [-0.6, 0, 0.6].flatMap((x, xi) =>
  [-0.4, 0, 0.4].flatMap((z, zi) => [
    { pos: [x, 0, z] as [number, number, number], color: ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'][((xi + 1) * (zi + 2)) % 5] },
    { pos: [x, 0.6, z] as [number, number, number], color: ['#10b981', '#f59e0b', '#8b5cf6', '#3b82f6', '#ef4444'][((xi + 3) * (zi + 1)) % 5] },
  ])
);

// ── Efectos de estado ───────────────────────────────────────────────────────
// Escarcha: partículas que se desprenden del contenedor cuando la cadena de frío
// se rompe, suben y se disipan. Una sola malla instanciada.
function FrostParticles({ count = 28 }: { count?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const seeds = useMemo(() => Array.from({ length: count }, (_, i) => ({
    a: (i * 2.399963) % (Math.PI * 2),      // ángulo áureo: reparto uniforme
    r: 0.25 + ((i * 37) % 100) / 100 * 0.55,
    ph: ((i * 53) % 100) / 100,
    sp: 0.35 + ((i * 29) % 100) / 100 * 0.4,
  })), [count]);
  useFrame((state) => {
    const m = ref.current;
    if (!m) return;
    const t = state.clock.elapsedTime;
    seeds.forEach((p, i) => {
      const life = (t * p.sp + p.ph) % 1;
      dummy.position.set(Math.cos(p.a + t * 0.5) * p.r, 0.35 + life * 1.7, Math.sin(p.a + t * 0.5) * p.r);
      dummy.scale.setScalar(Math.max(0.001, (1 - life) * (0.7 + 0.5 * Math.sin(life * Math.PI))));
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <icosahedronGeometry args={[0.07, 0]} />
      <meshBasicMaterial color={new THREE.Color('#bae6fd').multiplyScalar(2.4)} toneMapped={false} />
    </instancedMesh>
  );
}

// Onda expansiva verde al liberarse el escrow en destino (sin rotura de frío).
function ReleaseBurst({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);
  const t0 = useRef<number | null>(null);
  const color = useMemo(() => new THREE.Color('#34d399').multiplyScalar(2.4), []);
  useFrame((state) => {
    const m = ref.current;
    if (!m) return;
    if (t0.current === null) t0.current = state.clock.elapsedTime;
    const k = ((state.clock.elapsedTime - t0.current) % 2.4) / 2.4;
    m.scale.setScalar(1 + k * 3.2);
    (m.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.85;
  });
  return (
    <mesh ref={ref} position={[position[0], 0.18, position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[1.5, 1.62, 64]} />
      <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.85} side={THREE.DoubleSide} />
    </mesh>
  );
}

// Desplazamiento vertical del modelo respecto a la ruta (la ruta va a y=0.06):
// camión sobre el asfalto, barco al nivel del agua, avión sobre la pista.
const BASE_Y: Record<VehicleType, number> = { camion: 0.14, buque: -0.06, avion: 0.59, none: 0 };
const VEHICLE_SPEED = 3.0; // unidades de escena por segundo a velocidad 1x

function Vehicle({ targetLocation, mode, type, telemetry, onSelect, simSpeed = 1, alert = false }: {
  targetLocation: number;
  mode: TransitMode;
  type: VehicleType;
  telemetry?: Telemetry;
  onSelect?: () => void;
  simSpeed?: number;
  alert?: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  const iotRef = useRef<THREE.Mesh>(null);
  const time = useRef(0);
  const route = useMemo(() => buildRoute(mode), [mode]);
  // Distancia recorrida sobre la ruta. Empieza en la parada actual (sin «volar» desde el origen).
  const dist = useRef<number | null>(null);
  const prevYaw = useRef(0);
  // Reutilizados en cada frame: cero asignaciones.
  const tmp = useMemo(() => ({
    pos: new THREE.Vector3(), ahead: new THREE.Vector3(), dummy: new THREE.Object3D(),
  }), []);
  const alertColor = alert ? '#ef4444' : undefined;

  useFrame((state, delta) => {
    time.current += delta;
    if (iotRef.current && iotRef.current.material) {
      (iotRef.current.material as THREE.MeshBasicMaterial).opacity = 0.4 + Math.sin(time.current * (alert ? 16 : 8)) * 0.6;
    }
    const g = ref.current;
    if (!g) return;

    const goal = route.distanceOf(targetLocation) ?? 0;
    if (dist.current === null) dist.current = goal;
    const remaining = goal - dist.current;
    const moving = Math.abs(remaining) > 0.02;

    if (moving) {
      // Sombras bajo demanda: sólo se recalculan mientras algo se mueve.
      state.gl.shadowMap.needsUpdate = true;
      // Frena al llegar (ease-out) para no clavarse en la parada.
      const speed = VEHICLE_SPEED * simSpeed * Math.min(1, 0.35 + Math.abs(remaining) * 0.5);
      const step = Math.min(Math.abs(remaining), speed * delta);
      dist.current += Math.sign(remaining) * step;
    } else {
      dist.current = goal;
    }

    const d = dist.current;
    route.pointAt(d, tmp.pos);
    // Rumbo: hacia un punto algo más adelante en la ruta (o atrás si el vehículo retrocede).
    const dir = moving && remaining < 0 ? -1 : 1;
    route.pointAt(d + dir * 0.35, tmp.ahead);
    if (type !== 'avion') tmp.ahead.y = tmp.pos.y; // camión y barco no cabecean

    if (tmp.ahead.distanceToSquared(tmp.pos) > 1e-8) {
      tmp.dummy.position.copy(tmp.pos);
      tmp.dummy.lookAt(tmp.ahead);
      // Alabeo del avión proporcional al giro (derivada del rumbo).
      const yaw = Math.atan2(tmp.ahead.x - tmp.pos.x, tmp.ahead.z - tmp.pos.z);
      const dYaw = ((yaw - prevYaw.current + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      prevYaw.current = yaw;
      if (moving) g.quaternion.slerp(tmp.dummy.quaternion, Math.min(1, 7 * delta));
      else g.quaternion.slerp(tmp.dummy.quaternion, Math.min(1, 2 * delta));
      if (type === 'avion' && moving) g.rotateZ(-Math.max(-0.5, Math.min(0.5, dYaw * 8)) * 0.3);
    }

    g.position.copy(tmp.pos);
    g.position.y += BASE_Y[type];
    if (type === 'buque') {
      // Cabeceo y vaivén del oleaje; más suave en puerto.
      const k = moving ? 1 : 0.55;
      g.position.y += Math.sin(time.current * 2) * 0.05 * k;
      g.rotateZ(Math.sin(time.current * 1.5) * 0.05 * k);
      g.rotateX(Math.sin(time.current) * 0.02 * k);
    } else if (type === 'avion') {
      g.position.y += Math.sin(time.current * 3) * 0.06 * (tmp.pos.y > 0.5 ? 1 : 0);
    } else if (moving) {
      g.position.y += Math.abs(Math.sin(time.current * 10)) * 0.02;
    }
  });

  if (type === 'none') return null;

  return (
    <group ref={ref}
      onClick={onSelect ? (e) => { e.stopPropagation(); onSelect(); } : undefined}
      onPointerOver={onSelect ? (e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; } : undefined}
      onPointerOut={onSelect ? () => { document.body.style.cursor = ''; } : undefined}>
      {alert && <FrostParticles />}
      {/* Volumen de clic más grande que el modelo (que es pequeño a escala 0.4) */}
      {onSelect && (
        <mesh position={[0, 0.6, 0]} visible={false} userData={{ vehicle: true }}>
          <sphereGeometry args={[1.3, 10, 10]} />
        </mesh>
      )}
      {type === 'camion' ? (
        <group scale={0.4} rotation={[0, -Math.PI / 2, 0]}>
          <group position={[1.2, 0.5, 0]}>
            <Box args={[0.8, 0.8, 0.8]} position={[0, 0.2, 0]} castShadow>
              <meshStandardMaterial color="#f8fafc" roughness={0.3} metalness={0.1} />
            </Box>
            <Box args={[0.4, 0.4, 0.82]} position={[0.2, 0.3, 0]}>
              <meshStandardMaterial color="#1e293b" />
            </Box>
          </group>
          <Box args={[2.2, 1.2, 0.9]} position={[-0.4, 0.8, 0]} castShadow>
            <meshStandardMaterial color="#1e3a8a" roughness={0.6} metalness={0.2} />
          </Box>
          <Box args={[3.2, 0.15, 0.8]} position={[0.2, 0.2, 0]} castShadow>
            <meshStandardMaterial color="#18181b" />
          </Box>
          {[1.2, -0.4, -1.0].map((x, i) => (
            <Cylinder key={i} args={[0.2, 0.2, 0.9, 16]} position={[x, 0.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <meshStandardMaterial color="#09090b" roughness={0.9} />
            </Cylinder>
          ))}
          <Box ref={iotRef as any} args={[0.15, 0.15, 0.15]} position={[-1.2, 1.5, 0]}>
            <meshBasicMaterial color={alertColor ?? '#10b981'} transparent toneMapped={false} />
          </Box>
          <Box args={[0.85, 0.85, 0.85]} position={[-0.4, 0.8, 0]}>
            <meshStandardMaterial color={alertColor ?? '#10b981'} emissive={alertColor ?? '#10b981'} emissiveIntensity={alert ? 1.4 : 0.6} />
          </Box>
        </group>
      ) : type === 'avion' ? (
        <group scale={0.4}>
          <mesh position={[0, 0.4, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.3, 0.3, 2.5, 16]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.3} metalness={0.2} />
          </mesh>
          <mesh position={[0, 0.4, 1.25]} castShadow>
            <sphereGeometry args={[0.3, 16, 16]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.4, -1.25]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.3, 0.05, 0.8, 16]} />
            <meshStandardMaterial color="#38bdf8" roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.4, 0.1]} castShadow>
            <boxGeometry args={[3.8, 0.08, 0.6]} />
            <meshStandardMaterial color="#e0f2fe" roughness={0.3} />
          </mesh>
          {[-0.9, 0.9].map((x, i) => (
            <mesh key={i} position={[x, 0.25, 0.2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.15, 0.15, 0.5, 16]} />
              <meshStandardMaterial color="#0f172a" />
            </mesh>
          ))}
          <mesh position={[0, 1.0, -1.4]} rotation={[-Math.PI / 6, 0, 0]} castShadow>
            <boxGeometry args={[0.08, 0.9, 0.6]} />
            <meshStandardMaterial color="#f43f5e" />
          </mesh>
          <mesh position={[0, 0.5, -1.4]} castShadow>
            <boxGeometry args={[1.2, 0.08, 0.4]} />
            <meshStandardMaterial color="#38bdf8" />
          </mesh>
          <Box args={[0.5, 0.5, 0.5]} position={[0, 0.4, -0.2]}>
            <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={0.6} />
          </Box>
          <Box ref={iotRef as any} args={[0.15, 0.15, 0.15]} position={[0, 1.1, 0.2]}>
            <meshBasicMaterial color={alertColor ?? '#38bdf8'} transparent toneMapped={false} />
          </Box>
        </group>
      ) : (
        <group scale={0.4} rotation={[0, -Math.PI / 2, 0]}>
          <mesh position={[-0.5, 0.4, 0]} castShadow>
            <boxGeometry args={[3.5, 0.8, 1.4]} />
            <meshStandardMaterial color="#1e3a8a" roughness={0.6} metalness={0.3} />
          </mesh>
          <mesh position={[-0.5, 0.85, 0]} castShadow>
            <boxGeometry args={[3.5, 0.1, 1.4]} />
            <meshStandardMaterial color="#3f3f46" />
          </mesh>
          <group position={[1.655, 0.4, 0]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.81, 0.81, 0.8, 3]} />
              <meshStandardMaterial color="#1e3a8a" roughness={0.6} metalness={0.3} />
            </mesh>
          </group>
          <group position={[-1.4, 1.2, 0]}>
            <Box args={[1.0, 0.6, 1.2]} castShadow>
              <meshStandardMaterial color="#f1f5f9" />
            </Box>
            <Box args={[0.8, 0.6, 1.0]} position={[0, 0.6, 0]} castShadow>
              <meshStandardMaterial color="#e2e8f0" />
            </Box>
            <Box args={[0.82, 0.2, 1.02]} position={[0, 0.6, 0]}>
              <meshStandardMaterial color="#0f172a" roughness={0.1} />
            </Box>
            <Cylinder args={[0.02, 0.05, 1.2, 8]} position={[0, 1.5, 0]}>
              <meshStandardMaterial color="#94a3b8" />
            </Cylinder>
            <Cylinder args={[0.15, 0.2, 0.8, 16]} position={[-0.6, 0.4, 0]}>
              <meshStandardMaterial color="#3f3f46" />
            </Cylinder>
            <Cylinder args={[0.1, 0.1, 0.2, 16]} position={[-0.6, 0.9, 0]}>
              <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.4} />
            </Cylinder>
          </group>
          <group position={[0.2, 1.2, 0]}>
            <Instances limit={SHIP_CONTAINERS.length} castShadow>
              <boxGeometry args={[0.55, 0.6, 0.35]} />
              <meshStandardMaterial roughness={0.55} metalness={0.35} />
              {SHIP_CONTAINERS.map((c, i) => <Instance key={i} position={c.pos} color={c.color} />)}
            </Instances>
          </group>
          <Box ref={iotRef as any} args={[0.2, 0.2, 0.2]} position={[-1.4, 2.3, 0]}>
            <meshBasicMaterial color={alertColor ?? '#10b981'} transparent toneMapped={false} />
          </Box>
        </group>
      )}

      {telemetry && (
        <Html position={[0, type === 'buque' ? 3.0 : 2.0, 0]} center zIndexRange={[5, 0]}>
          <div className="bg-black/80 backdrop-blur border border-emerald-500/30 p-1.5 rounded shadow-lg flex flex-col gap-0.5 text-center pointer-events-none w-[100px]">
            <span className="text-[7px] text-zinc-400 font-bold tracking-[0.2em] uppercase">{type} TELEMETRY</span>
            <div className="flex justify-between items-center text-[8px] font-mono mt-0.5">
              <span className="text-zinc-500">TMP</span>
              <span className="text-blue-400">{telemetry.temp}</span>
            </div>
            <div className="flex justify-between items-center text-[8px] font-mono">
              <span className="text-zinc-500">SHK</span>
              <span className={telemetry.shock !== '0.0g' ? 'text-amber-400 font-bold' : 'text-emerald-400'}>{telemetry.shock}</span>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

// ── Rutas ───────────────────────────────────────────────────────────────────
// Cada tramo (origen, tránsito, destino) tiene un estado: pendiente (gris,
// quieto), activo (fluye), completado (teal) o roto por rotura de frío (rojo).
// El flujo son partículas instanciadas que recorren la curva: 1 draw call por
// tramo, y brillan con el bloom porque su color supera 1.0 (toneMapped off).
type SegState = 'pending' | 'active' | 'done' | 'broken';

const SEG_COLOR: Record<SegState, string> = {
  pending: '#3f3f46', active: '#5eead4', done: '#14b8a6', broken: '#f87171',
};

function segmentStates(phase: Phase | undefined, started: boolean, finished: boolean, broken: boolean): SegState[] {
  const order: Phase[] = ['origin', 'transit', 'destination'];
  const cur = phase ? order.indexOf(phase) : -1;
  return order.map((_, i) => {
    if (!started) return 'pending';
    const done = finished || i < cur;
    const active = !finished && i === cur;
    if (broken && i >= 1 && (done || active)) return 'broken';
    return done ? 'done' : active ? 'active' : 'pending';
  });
}

function FlowParticles({ curve, state, count = 26 }: { curve: THREE.CatmullRomCurve3; state: SegState; count?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const point = useMemo(() => new THREE.Vector3(), []);
  const color = useMemo(() => new THREE.Color(SEG_COLOR[state]).multiplyScalar(state === 'pending' ? 0.6 : 2.4), [state]);
  const t = useRef(0);

  useFrame((_, delta) => {
    const mesh = ref.current;
    if (!mesh) return;
    const speed = state === 'active' ? 0.09 : state === 'pending' ? 0 : 0.035;
    t.current = (t.current + delta * speed) % 1;
    for (let i = 0; i < count; i++) {
      const u = (i / count + t.current) % 1;
      curve.getPointAt(u, point);
      dummy.position.set(point.x, point.y + 0.08, point.z);
      const s = state === 'active' ? 0.9 + 0.5 * Math.sin((u + t.current) * Math.PI * 8) : 0.75;
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <sphereGeometry args={[0.09, 10, 10]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </instancedMesh>
  );
}

function RoutesNetwork({ mode, states }: { mode: TransitMode; states: SegState[] }) {
  // Las mismas curvas por las que avanza el vehículo (scene/routePath.ts).
  const curves = useMemo(() => buildRoute(mode).curves, [mode]);
  const lines = useMemo(() => curves.map((c, i) => c.getPoints(i === 1 ? 80 : 160)), [curves]);
  const lineRefs = [useRef<any>(null), useRef<any>(null), useRef<any>(null)];
  useFrame((_, delta) => {
    lineRefs.forEach((r, i) => {
      if (r.current?.material && states[i] !== 'pending') r.current.material.dashOffset -= delta * (states[i] === 'active' ? 1.6 : 0.5);
    });
  });

  return (
    <group>
      {lines.map((pts, i) => (
        <Line key={`${mode}-${i}`} ref={lineRefs[i]} points={pts} color={SEG_COLOR[states[i]]}
          lineWidth={states[i] === 'pending' ? 1.5 : 2.5} dashed dashSize={0.8} gapSize={0.6}
          transparent opacity={states[i] === 'pending' ? 0.35 : 0.85} />
      ))}
      {curves.map((c, i) => <FlowParticles key={`${mode}-p${i}`} curve={c} state={states[i]} count={i === 1 ? 18 : 26} />)}
    </group>
  );
}

// ── Mar ─────────────────────────────────────────────────────────────────────
// El oleaje se calcula en el vertex shader (antes: 2.145 vértices en CPU cada
// frame) y con normales analíticas, así la luz y el entorno reaccionan a las olas.
const WAVE_GLSL = /* glsl */ `
  float bzWaveH(vec2 p, float t) {
    return 0.15 * sin(p.x * 3.08 + t) + 0.10 * cos(p.y * 4.29 + 0.8 * t) + 0.08 * sin(p.x * 1.54 + p.y * 2.86 - 1.2 * t);
  }
  vec2 bzWaveD(vec2 p, float t) {
    float c3 = 0.08 * cos(p.x * 1.54 + p.y * 2.86 - 1.2 * t);
    return vec2(0.15 * 3.08 * cos(p.x * 3.08 + t) + 1.54 * c3,
               -0.10 * 4.29 * sin(p.y * 4.29 + 0.8 * t) + 2.86 * c3);
  }
`;

function Sea() {
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: '#0c4a6e', transparent: true, opacity: 0.82, roughness: 0.18, metalness: 0.55 });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uniforms.uTime;
      shader.vertexShader = `uniform float uTime;\n${WAVE_GLSL}\n${shader.vertexShader}`
        .replace('#include <beginnormal_vertex>', `
          vec2 bzP = position.xy;
          vec2 bzD = bzWaveD(bzP, uTime);
          vec3 objectNormal = normalize(vec3(-bzD.x, -bzD.y, 1.0));
          #ifdef USE_TANGENT
            vec3 objectTangent = vec3(tangent.xyz);
          #endif
        `)
        .replace('#include <begin_vertex>', `
          vec3 transformed = vec3(position);
          transformed.z += bzWaveH(bzP, uTime);
        `);
    };
    return m;
  }, [uniforms]);
  useEffect(() => () => material.dispose(), [material]);
  useFrame((state) => { uniforms.uTime.value = state.clock.elapsedTime * 2; });

  return (
    <mesh position={[3.5, -0.4, 4]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={material}>
      <planeGeometry args={[13, 7, 96, 48]} />
    </mesh>
  );
}

// Aeronave aparcada en el modo aéreo (cuando el vehículo activo no es el avión)
function SincronizedAirplane({ mode, stepIndex, vehicleType }: { mode: TransitMode; stepIndex?: number; vehicleType?: VehicleType }) {
  if (mode !== 'air') return null;
  if (vehicleType === 'avion') return null;

  const isParkedAtOrigin = stepIndex === undefined || stepIndex < 8;
  const parkLocation = LOCATIONS[isParkedAtOrigin ? 11 : 12];
  const position: [number, number, number] = [parkLocation.position[0], parkLocation.position[1] + 0.65, parkLocation.position[2]];

  return (
    <group position={position} scale={0.7} rotation={[0, Math.PI / 2, 0]}>
      <mesh position={[0, 0.4, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.3, 2.5, 16]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.3} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0.4, 1.25]} castShadow>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.4, -1.25]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.05, 0.8, 16]} />
        <meshStandardMaterial color="#38bdf8" roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.4, 0.1]} castShadow>
        <boxGeometry args={[3.8, 0.08, 0.6]} />
        <meshStandardMaterial color="#e0f2fe" roughness={0.3} />
      </mesh>
      <mesh position={[0, 1.0, -1.4]} rotation={[-Math.PI / 6, 0, 0]} castShadow>
        <boxGeometry args={[0.08, 0.9, 0.6]} />
        <meshStandardMaterial color="#f43f5e" />
      </mesh>
      <mesh position={[0, 0.5, -1.4]} castShadow>
        <boxGeometry args={[1.2, 0.08, 0.4]} />
        <meshStandardMaterial color="#38bdf8" />
      </mesh>
    </group>
  );
}

// Sombras bajo demanda: el mapa de sombras (≈40 mallas) ya no se redibuja en
// cada frame, sólo al cambiar de etapa/modo o mientras se mueve el vehículo.
function ShadowInvalidator({ deps }: { deps: unknown[] }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
  }, [gl, ...deps]);
  return null;
}

// ── Parada actual y selección ───────────────────────────────────────────────
// Anillo que late en la parada en curso (rojo con rotura de frío) y anillo
// violeta en la parada que el usuario ha seleccionado con un clic.
function StopRing({ position, color, pulse = true, radius = 2.35 }: { position: [number, number, number]; color: string; pulse?: boolean; radius?: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const c = useMemo(() => new THREE.Color(color).multiplyScalar(2.2), [color]);
  useFrame((state) => {
    if (!ref.current) return;
    const k = pulse ? 1 + 0.06 * Math.sin(state.clock.elapsedTime * 3.2) : 1;
    ref.current.scale.set(k, k, k);
    (ref.current.material as THREE.MeshBasicMaterial).opacity = pulse ? 0.65 + 0.3 * Math.sin(state.clock.elapsedTime * 3.2) : 0.8;
  });
  return (
    <mesh ref={ref} position={[position[0], 0.14, position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius - 0.12, radius, 64]} />
      <meshBasicMaterial color={c} toneMapped={false} transparent opacity={0.8} side={THREE.DoubleSide} />
    </mesh>
  );
}

export interface SdkBeaconData {
  method: 'GET' | 'POST';
  path: string;
  contract?: string;
}

// Baliza sobre la parada en curso con la llamada real de la API de BeZhas
// que corresponde a la etapa (engine/sdkMap.ts) y el contrato que la ancla.
function SdkBeacon({ position, data, broken }: { position: [number, number, number]; data: SdkBeaconData; broken: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (groupRef.current) groupRef.current.position.y = 5.4 + Math.sin(state.clock.elapsedTime * 1.6) * 0.12;
  });
  const accent = broken ? '#fca5a5' : data.method === 'GET' ? '#7dd3fc' : '#6ee7b7';
  const stem = useMemo(() => [new THREE.Vector3(0, 0.2, 0), new THREE.Vector3(0, 4.9, 0)], []);
  return (
    <group position={[position[0], 0, position[2]]}>
      <Line points={stem} color={broken ? '#f87171' : '#2dd4bf'} lineWidth={1} transparent opacity={0.45} dashed dashSize={0.25} gapSize={0.2} />
      <group ref={groupRef} position={[0, 5.4, 0]}>
        <Billboard>
          <Text fontSize={0.34} color={accent} anchorX="center" anchorY="bottom" outlineWidth={0.05} outlineColor="#020617"
            maxWidth={14} textAlign="center">
            {`${data.method} ${data.path}`}
          </Text>
          {data.contract && (
            <Text position={[0, -0.12, 0]} fontSize={0.24} color="#c4b5fd" anchorX="center" anchorY="top" outlineWidth={0.04} outlineColor="#020617">
              {`→ ${data.contract}`}
            </Text>
          )}
        </Billboard>
      </group>
    </group>
  );
}

// Envuelve una parada para hacerla clicable (cursor de mano y selección).
// Incluye un volumen invisible que cubre edificio y pedestal: los pedestales
// están instanciados fuera del grupo y, sin él, clicar la base no hacía nada.
function Selectable({ idx, onSelect, onHover, children }: {
  idx: number;
  onSelect?: (idx: number) => void;
  onHover?: (idx: number | null) => void;
  children: React.ReactNode;
}) {
  if (!onSelect) return <>{children}</>;
  const p = LOCATIONS[idx].position;
  return (
    <group
      onClick={(e) => {
        // El vehículo está dentro del volumen del edificio: si está en la línea de tiro, él manda.
        if (e.intersections.some((i) => i.object.userData?.vehicle)) return;
        e.stopPropagation(); onSelect(idx);
      }}
      onPointerOver={(e) => {
        if (e.intersections.some((i) => i.object.userData?.vehicle)) return;
        e.stopPropagation(); document.body.style.cursor = 'pointer'; onHover?.(idx);
      }}
      onPointerOut={() => { document.body.style.cursor = ''; onHover?.(null); }}
    >
      <mesh position={[p[0], 1.4, p[2]]} visible={false}>
        <cylinderGeometry args={[1.9, 1.9, 3.6, 12]} />
      </mesh>
      {children}
    </group>
  );
}

// Cámara directora: tras cada cambio de parada encuadra durante unos segundos
// y luego suelta el control. Si el usuario arrastra o hace zoom, deja de
// dirigir hasta la siguiente parada (antes peleaba con el ratón en cada frame).
function CameraDirector({ locationIndex, controlsRef, userControl, enabled }: {
  locationIndex: number;
  controlsRef: React.MutableRefObject<any>;
  userControl: React.MutableRefObject<boolean>;
  enabled: boolean;
}) {
  const target = useMemo(() => new THREE.Vector3(), []);
  const remaining = useRef(3);
  // Al volver a «director» (o cambiar de parada) vuelve a encuadrar.
  useEffect(() => { remaining.current = 3; userControl.current = false; }, [locationIndex, userControl, enabled]);
  useFrame((_, delta) => {
    if (!enabled || !controlsRef.current || userControl.current || remaining.current <= 0) return;
    remaining.current -= delta;
    const loc = LOCATIONS[locationIndex];
    target.set(loc.position[0], 0.5, loc.position[2]);
    controlsRef.current.target.lerp(target, Math.min(1, delta * 1.6));
    controlsRef.current.update();
  });
  return null;
}

export const LogisticsScene3D: React.FC<SceneProps> = ({
  currentLocationIndex,
  vehicleType,
  telemetry,
  mode,
  stepIndex,
  isRunning = false,
  isFinished = false,
  phase,
  breachActive = false,
  onContextLost,
  sdkBeacon,
  selectedLocation = null,
  onSelectLocation,
  cameraMode = 'director',
  onSelectVehicle,
  simSpeed = 1,
  stage,
}) => {
  const currentLoc = LOCATIONS[currentLocationIndex];

  const controlsRef = useRef<any>(null);
  const userControl = useRef(false);
  const [hovered, setHovered] = useState<number | null>(null);
  useEffect(() => () => { document.body.style.cursor = ''; }, []);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Calidad adaptativa: el PerformanceMonitor baja la resolución (y apaga el
  // postproceso) si el equipo no sostiene los fps, y la sube si sobra margen.
  const maxDpr = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 1.75);
  const minDpr = Math.min(1, maxDpr);
  const [dpr, setDpr] = useState(maxDpr);
  const [effects, setEffects] = useState(true);
  const [monitorReady, setMonitorReady] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMonitorReady(true), 4000); return () => clearTimeout(t); }, []);

  // Sin pantalla, sin render: si la escena sale del viewport se para el bucle.
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // La grúa del puerto actual carga mientras se estiba o embarca.
  const loadingAt = (isRunning && (stage === 'STOWED' || stage === 'LOADED')) ? currentLocationIndex : -1;
  const finalBreach = isFinished && breachActive;
  const finalRelease = isFinished && !breachActive;

  const states = segmentStates(phase, isRunning || isFinished, isFinished, breachActive);

  return (
    <div ref={wrapperRef} className="w-full h-full">
      <Canvas
        shadows
        dpr={dpr}
        frameloop={inView ? 'always' : 'never'}
        camera={{ position: [-14, 18, 24], fov: 45 }}
        gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
        onCreated={({ gl, scene, camera }) => {
          gl.toneMappingExposure = 1.1;
          // El navegador puede quitarnos el contexto (GPU reiniciada, demasiados contextos):
          // en vez de un lienzo negro, el simulador cae al mapa 2D.
          gl.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); onContextLost?.(); }, { once: true });
          if (import.meta.env.DEV) Object.assign(window as any, { __bzSimGl: gl, __bzSimScene: scene, __bzSimCamera: camera });
        }}
      >
        {monitorReady && <PerformanceMonitor
          factor={1}
          flipflops={6}
          // Sólo reacciona a caídas reales (< 50 % del refresco), no a un tirón al cambiar de etapa.
          bounds={(refresh) => [refresh * 0.5, refresh * 0.85]}
          onChange={({ factor }) => setDpr(Math.round((minDpr + (maxDpr - minDpr) * factor) * 100) / 100)}
          onFallback={() => setEffects(false)}
        />}

        <color attach="background" args={['#05060b']} />
        <fog attach="fog" args={['#05060b', 30, 95]} />

        {/* Luz: entorno procedural (sin descargar HDRI) con focos de la marca + sol con sombras */}
        <Environment resolution={256} frames={1} environmentIntensity={1.35}>
          <Lightformer form="rect" intensity={2.2} color="#99f6e4" position={[-12, 10, -8]} scale={[18, 6, 1]} />
          <Lightformer form="rect" intensity={1.6} color="#f9a8d4" position={[14, 8, 10]} scale={[14, 5, 1]} />
          <Lightformer form="ring" intensity={2.5} color="#ffffff" position={[0, 18, 0]} scale={8} />
          <Lightformer form="rect" intensity={0.6} color="#38bdf8" position={[0, 2, 20]} scale={[30, 3, 1]} />
        </Environment>
        <ambientLight intensity={0.35} />
        <hemisphereLight args={['#bae6fd', '#0b1020', 0.9]} />
        <directionalLight
          position={[12, 26, 12]}
          intensity={2.6}
          color="#f1f5f9"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0004}
          shadow-normalBias={0.02}
          shadow-camera-left={-30}
          shadow-camera-right={30}
          shadow-camera-top={18}
          shadow-camera-bottom={-18}
          shadow-camera-near={1}
          shadow-camera-far={70}
        />
        <pointLight position={[-15, 8, -6]} intensity={40} distance={34} color="#00d4aa" />
        <pointLight position={[15, 7, 4]} intensity={30} distance={32} color="#38bdf8" />

        {/* Suelo: recibe sombras y lleva una rejilla que se desvanece con la distancia */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.8, 0]} receiveShadow>
          <planeGeometry args={[160, 160]} />
          <meshStandardMaterial color="#0a0c13" roughness={0.92} metalness={0.05} />
        </mesh>
        <Grid
          position={[0, -0.78, 0]}
          args={[160, 160]}
          cellSize={1}
          cellThickness={0.5}
          cellColor="#263241"
          sectionSize={5}
          sectionThickness={1}
          sectionColor="#0f766e"
          fadeDistance={70}
          fadeStrength={1.2}
          infiniteGrid
        />

        <ZfPerimeter />
        <RoutesNetwork mode={mode} states={states} />
        <Sea />
        <PlinthsInstanced />

        {LOCATIONS.map((loc, idx) => {
          const props = { position: loc.position as [number, number, number], name: loc.name };
          const node = (() => {
            switch (loc.type) {
              case 'factory': return <FactoryNode {...props} />;
              case 'warehouse': return <WarehouseNode {...props} />;
              case 'gate': return <GateNode {...props} />;
              case 'customs': return <CustomsNode {...props} />;
              case 'port': return <PortNode {...props} loading={loadingAt === idx} />;
              case 'airport': return <AirportNode {...props} />;
              case 'customer': return <CustomerNode {...props} />;
              default: return null;
            }
          })();
          return <Selectable key={idx} idx={idx} onSelect={onSelectLocation} onHover={setHovered}>{node}</Selectable>;
        })}

        {(isRunning || isFinished) && (
          <StopRing position={currentLoc.position} color={breachActive ? '#f87171' : '#2dd4bf'} />
        )}
        {selectedLocation !== null && selectedLocation !== undefined && LOCATIONS[selectedLocation] && (
          <StopRing position={LOCATIONS[selectedLocation].position} color="#a78bfa" pulse={false} radius={2.7} />
        )}
        {hovered !== null && hovered !== selectedLocation && LOCATIONS[hovered] && (
          <StopRing position={LOCATIONS[hovered].position} color="#e4e4e7" pulse={false} radius={2.55} />
        )}
        {(isRunning || isFinished) && sdkBeacon && (
          <SdkBeacon position={currentLoc.position} data={sdkBeacon} broken={breachActive} />
        )}

        <SincronizedAirplane mode={mode} stepIndex={stepIndex} vehicleType={vehicleType} />
        <Vehicle targetLocation={currentLocationIndex} mode={mode} type={vehicleType} telemetry={telemetry}
          simSpeed={simSpeed} alert={breachActive}
          onSelect={isRunning || isFinished ? onSelectVehicle : undefined} />

        {/* Estado final del escrow, sobre el destino */}
        {finalRelease && <ReleaseBurst position={currentLoc.position} />}
        {isFinished && (
          <Chip
            text={finalBreach ? 'ESCROW CONGELADO · DISPUTA' : 'ESCROW LIBERADO'}
            color={finalBreach ? '#fca5a5' : '#6ee7b7'}
            position={[currentLoc.position[0], 3.6, currentLoc.position[2]]}
            size={0.26}
          />
        )}

        <ShadowInvalidator deps={[mode, stepIndex, vehicleType, currentLocationIndex]} />
        <CameraDirector locationIndex={currentLocationIndex} controlsRef={controlsRef} userControl={userControl} enabled={cameraMode === 'director'} />

        <OrbitControls
          ref={controlsRef}
          makeDefault
          minPolarAngle={0}
          maxPolarAngle={Math.PI / 2.2}
          enableZoom={true}
          enablePan={true}
          minDistance={8}
          maxDistance={65}
          onStart={() => { userControl.current = true; }}
        />

        {/* Postproceso: bloom sólo en lo que supera 1.0 (rutas, luces de estado), viñeta y SMAA.
            Se apaga solo si el PerformanceMonitor detecta que el equipo no llega. */}
        {effects && (
          <EffectComposer multisampling={0}>
            <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.2} intensity={0.85} radius={0.7} />
            <Vignette offset={0.32} darkness={0.55} />
            <SMAA />
          </EffectComposer>
        )}
      </Canvas>
    </div>
  );
};
