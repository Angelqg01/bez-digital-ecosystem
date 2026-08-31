import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, Box, Cylinder, Line, Text } from '@react-three/drei';
import * as THREE from 'three';
import { LOCATIONS, TransitMode, VehicleType, Telemetry } from '../engine/types';

interface SceneProps {
  currentLocationIndex: number;
  vehicleType: VehicleType;
  telemetry?: Telemetry;
  mode: TransitMode;
  stepIndex?: number;
  isRunning?: boolean;
}

function NodeLabel({ name, offset = [0, 2.5, 0] }: { name: string; offset?: [number, number, number] }) {
  return (
    <Html position={offset} center sprite zIndexRange={[40, 0]}>
      <div className="bg-zinc-900/90 px-3 py-1 rounded shadow-md border border-zinc-700 text-zinc-300 text-[9px] uppercase font-bold tracking-widest whitespace-nowrap pointer-events-none">
        {name}
      </div>
    </Html>
  );
}

function Plinth({ color = '#3f3f46' }: { color?: string }) {
  return (
    <>
      <Cylinder args={[2, 2.2, 0.4, 32]} position={[0, -0.2, 0]}>
        <meshStandardMaterial color="#18181b" roughness={0.8} />
      </Cylinder>
      <Cylinder args={[1.8, 1.8, 0.1, 32]} position={[0, 0.05, 0]}>
        <meshStandardMaterial color={color} roughness={0.6} />
      </Cylinder>
    </>
  );
}

function FactoryNode({ position, name }: { position: [number, number, number]; name: string }) {
  return (
    <group position={position}>
      <Plinth />
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
          <Cylinder args={[0.2, 0.25, 2.5, 16]} position={[0, 1.25, 0]} castShadow>
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
      <Plinth color="#27272a" />
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
      <Box args={[0.4, 0.4, 0.4]} position={[1.0, 1.3, -0.5]} castShadow>
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
      <Plinth color="#27272a" />
      {/* Postes */}
      {[-1.4, 1.4].map((x, i) => (
        <Box key={i} args={[0.3, 1.6, 0.3]} position={[x, 0.85, 0]} castShadow>
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
      <Html position={[-1.4, 2.5, 0.3]} center sprite zIndexRange={[40, 0]}>
        <div className="bg-teal-900/80 text-teal-300 px-1 py-0.5 rounded border border-teal-500/50 text-[6px] font-mono whitespace-nowrap pointer-events-none">
          DID + RFID CHECK
        </div>
      </Html>
      <NodeLabel name={name} offset={[0, 3.2, 0]} />
    </group>
  );
}

function CustomsNode({ position, name }: { position: [number, number, number]; name: string }) {
  return (
    <group position={position}>
      <Plinth />
      <Box args={[2.8, 0.2, 1.8]} position={[0, 1.8, 0]} castShadow>
        <meshStandardMaterial color="#1f2937" metalness={0.5} roughness={0.5} />
      </Box>
      <Box args={[2.6, 0.1, 1.6]} position={[0, 1.75, 0]}>
        <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={0.4} />
      </Box>
      {[[-1.2, -0.7], [1.2, -0.7], [-1.2, 0.7], [1.2, 0.7]].map(([x, z], i) => (
        <Box key={i} args={[0.2, 1.7, 0.2]} position={[x, 0.95, z]} castShadow>
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

function PortNode({ position, name }: { position: [number, number, number]; name: string }) {
  const time = useRef(0);
  const arRef = useRef<THREE.Group>(null);
  const craneRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    time.current += delta;
    if (arRef.current) {
      arRef.current.rotation.y = time.current * 0.5;
      arRef.current.position.y = 3.2 + Math.sin(time.current * 2) * 0.1;
    }
    if (craneRef.current) {
      craneRef.current.position.z = Math.sin(time.current * 0.5) * 0.5;
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
          <Box key={i} args={[0.2, 2.5, 0.2]} position={[x, 1.25, z]} castShadow>
            <meshStandardMaterial color="#f59e0b" />
          </Box>
        ))}
        <Box args={[2.0, 0.2, 0.2]} position={[0, 2.6, -0.8]} castShadow><meshStandardMaterial color="#f59e0b" /></Box>
        <Box args={[2.0, 0.2, 0.2]} position={[0, 2.6, 0.8]} castShadow><meshStandardMaterial color="#f59e0b" /></Box>
        <Box args={[0.2, 0.2, 2.0]} position={[-0.8, 2.6, 0]} castShadow><meshStandardMaterial color="#f59e0b" /></Box>
        <Box args={[0.2, 0.2, 2.0]} position={[0.8, 2.6, 0]} castShadow><meshStandardMaterial color="#f59e0b" /></Box>
        <Box args={[3.0, 0.3, 0.5]} position={[0.5, 2.8, 0]} castShadow><meshStandardMaterial color="#f59e0b" /></Box>
        <group ref={craneRef} position={[1.2, 2.6, 0]}>
          <Box args={[0.1, 1.5, 0.1]} position={[0, -0.75, 0]}><meshStandardMaterial color="#18181b" /></Box>
          <Box args={[0.8, 0.1, 0.4]} position={[0, -1.5, 0]}><meshStandardMaterial color="#f59e0b" /></Box>
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
        <Html position={[0, 0.8, 0]} center sprite zIndexRange={[40, 0]}>
          <div className="bg-[#0c4a6e]/80 text-[#38bdf8] px-1.5 py-0.5 rounded border border-[#38bdf8]/50 text-[6px] font-mono tracking-widest whitespace-nowrap shadow-[0_0_8px_#38bdf8] pointer-events-none">
            AR COG CALC
          </div>
        </Html>
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
      <Plinth color="#27272a" />
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
      <Cylinder args={[0.2, 0.3, 1.5]} position={[-1.0, 0.8, -0.8]} castShadow>
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
      <Plinth color="#27272a" />
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
      <Box args={[0.2, 0.5, 0.2]} position={[1.2, 0.35, 1.2]} rotation={[0, -Math.PI / 4, 0]} castShadow>
        <meshStandardMaterial color="#18181b" />
      </Box>
      <Box args={[0.25, 0.3, 0.05]} position={[1.2, 0.65, 1.2]} rotation={[0, -Math.PI / 4, 0]}>
        <meshStandardMaterial color="#34d399" emissive="#34d399" emissiveIntensity={0.5} />
      </Box>
      <Html position={[1.2, 1.0, 1.2]} center sprite zIndexRange={[40, 0]}>
        <div className="bg-emerald-900/80 text-emerald-400 px-1 py-0.5 rounded border border-emerald-500/50 text-[5px] font-mono whitespace-nowrap shadow-[0_0_8px_#10b981] pointer-events-none">
          VALIDATOR TERMINAL
        </div>
      </Html>
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

function Vehicle({ targetPosition, type, telemetry }: { targetPosition: [number, number, number]; type: VehicleType; telemetry?: Telemetry }) {
  const ref = useRef<THREE.Group>(null);
  const iotRef = useRef<THREE.Mesh>(null);
  const targetVec = useMemo(() => new THREE.Vector3(), []);
  const basePos = useRef<THREE.Vector3 | null>(null);
  const time = useRef(0);

  useFrame((_, delta) => {
    time.current += delta;
    if (iotRef.current && iotRef.current.material) {
      (iotRef.current.material as THREE.MeshBasicMaterial).opacity = 0.4 + Math.sin(time.current * 8) * 0.6;
    }

    if (ref.current) {
      if (!basePos.current) {
        basePos.current = new THREE.Vector3(...targetPosition);
        ref.current.position.copy(basePos.current);
      }
      targetVec.set(...targetPosition);

      const speed = 3.0;
      const currentDist = basePos.current.distanceTo(targetVec);

      if (currentDist > 0.05) {
        const step = speed * delta;
        const dir = targetVec.clone().sub(basePos.current).normalize();
        if (currentDist <= step) {
          basePos.current.copy(targetVec);
        } else {
          basePos.current.add(dir.multiplyScalar(step));
        }

        const lookAtTarget = targetVec.clone();
        lookAtTarget.y = basePos.current.y;
        const dummy = new THREE.Object3D();
        dummy.position.copy(basePos.current);
        dummy.lookAt(lookAtTarget);
        ref.current.quaternion.slerp(dummy.quaternion, 8 * delta);
        ref.current.position.copy(basePos.current);

        if (type === 'buque') {
          ref.current.position.y += Math.sin(time.current * 2) * 0.05;
          ref.current.rotation.z = Math.sin(time.current * 1.5) * 0.05;
          ref.current.rotation.x = Math.sin(time.current * 1) * 0.02;
        } else if (type === 'avion') {
          const totalDist = 15.0;
          const progress = Math.max(0, Math.min(1, 1 - currentDist / totalDist));
          const arcHeight = Math.sin(progress * Math.PI) * 3.5;
          ref.current.position.y += arcHeight + Math.sin(time.current * 3) * 0.08;
          ref.current.rotation.z = Math.sin(time.current * 1.5) * 0.04;
          ref.current.rotation.x = -Math.cos(progress * Math.PI) * 0.15;
        } else {
          ref.current.position.y += Math.abs(Math.sin(time.current * 10)) * 0.02;
        }
      } else {
        ref.current.position.copy(basePos.current);
        if (type === 'buque') {
          ref.current.position.y += Math.sin(time.current * 1.5) * 0.03;
          ref.current.rotation.z = Math.sin(time.current * 1.0) * 0.02;
          ref.current.rotation.x = 0;
        } else if (type === 'avion') {
          ref.current.rotation.x = 0;
          ref.current.rotation.z = 0;
        }
      }
    }
  });

  if (type === 'none') return null;

  return (
    <group ref={ref} position={targetPosition}>
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
            <Cylinder key={i} args={[0.2, 0.2, 0.9, 16]} position={[x, 0.2, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <meshStandardMaterial color="#09090b" roughness={0.9} />
            </Cylinder>
          ))}
          <Box ref={iotRef as any} args={[0.15, 0.15, 0.15]} position={[-1.2, 1.5, 0]}>
            <meshBasicMaterial color="#10b981" transparent />
          </Box>
          <Box args={[0.85, 0.85, 0.85]} position={[-0.4, 0.8, 0]}>
            <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={0.6} />
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
            <meshBasicMaterial color="#38bdf8" transparent />
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
            <Cylinder args={[0.15, 0.2, 0.8, 16]} position={[-0.6, 0.4, 0]} castShadow>
              <meshStandardMaterial color="#3f3f46" />
            </Cylinder>
            <Cylinder args={[0.1, 0.1, 0.2, 16]} position={[-0.6, 0.9, 0]}>
              <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.4} />
            </Cylinder>
          </group>
          <group position={[0.2, 1.2, 0]}>
            {[-0.6, 0, 0.6].map((x, xi) =>
              [-0.4, 0, 0.4].map((z, zi) => (
                <Box key={`${xi}-${zi}`} args={[0.55, 0.6, 0.35]} position={[x, 0, z]} castShadow>
                  <meshStandardMaterial color={['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'][((xi + 1) * (zi + 2)) % 5]} />
                </Box>
              ))
            )}
            {[-0.6, 0, 0.6].map((x, xi) =>
              [-0.4, 0, 0.4].map((z, zi) => (
                <Box key={`l2-${xi}-${zi}`} args={[0.55, 0.6, 0.35]} position={[x, 0.6, z]} castShadow>
                  <meshStandardMaterial color={['#10b981', '#f59e0b', '#8b5cf6', '#3b82f6', '#ef4444'][((xi + 3) * (zi + 1)) % 5]} />
                </Box>
              ))
            )}
          </group>
          <Box ref={iotRef as any} args={[0.2, 0.2, 0.2]} position={[-1.4, 2.3, 0]}>
            <meshBasicMaterial color="#10b981" transparent />
          </Box>
        </group>
      )}

      {telemetry && (
        <Html position={[0, type === 'buque' ? 3.0 : 2.0, 0]} center zIndexRange={[40, 0]}>
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

function RoutesNetwork({ mode }: { mode: TransitMode }) {
  const landIdx = mode === 'sea' ? [0, 1, 2, 3, 4, 5, 6] : [0, 1, 2, 3, 4, 5, 11];
  const transitIdx = mode === 'sea' ? [6, 7] : [11, 12];
  const destIdx = mode === 'sea' ? [7, 8, 9, 10] : [12, 8, 9, 10];

  const mkPoints = (idxs: number[]) => idxs.map((i) => new THREE.Vector3(...LOCATIONS[i].position));

  const landCurve = useMemo(() => new THREE.CatmullRomCurve3(mkPoints(landIdx), false, 'catmullrom', 0.2).getPoints(200), [mode]);
  const transitCurve = useMemo(() => new THREE.CatmullRomCurve3(mkPoints(transitIdx), false, 'catmullrom', 0.2).getPoints(80), [mode]);
  const destCurve = useMemo(() => new THREE.CatmullRomCurve3(mkPoints(destIdx), false, 'catmullrom', 0.2).getPoints(120), [mode]);

  const l1 = useRef<any>(null);
  const l2 = useRef<any>(null);
  const l3 = useRef<any>(null);
  useFrame((_, delta) => {
    [l1, l2, l3].forEach((r) => {
      if (r.current && r.current.material) r.current.material.dashOffset -= delta * 1.5;
    });
  });

  return (
    <group>
      <Line ref={l1} points={landCurve} color="#00d4aa" lineWidth={2.5} dashed dashSize={1} gapSize={1} transparent opacity={0.6} />
      <Line ref={l2} points={transitCurve} color={mode === 'sea' ? '#38bdf8' : '#f472b6'} lineWidth={2.5} dashed dashSize={1} gapSize={1} transparent opacity={0.6} />
      <Line ref={l3} points={destCurve} color="#f59e0b" lineWidth={2.5} dashed dashSize={1} gapSize={1} transparent opacity={0.6} />
    </group>
  );
}

function Sea() {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (meshRef.current && meshRef.current.geometry) {
      const positions = meshRef.current.geometry.attributes.position;
      const time = state.clock.elapsedTime * 2;
      for (let i = 0; i < positions.count; i++) {
        const ix = i % 65;
        const iy = Math.floor(i / 65);
        const u = ix / 64;
        const v = iy / 32;
        const wave1 = Math.sin(u * 40 + time) * 0.15;
        const wave2 = Math.cos(v * 30 + time * 0.8) * 0.1;
        const wave3 = Math.sin(u * 20 + v * 20 - time * 1.2) * 0.08;
        positions.setZ(i, wave1 + wave2 + wave3);
      }
      positions.needsUpdate = true;
    }
  });
  return (
    <mesh ref={meshRef} position={[3.5, -0.4, 4]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[13, 7, 64, 32]} />
      <meshStandardMaterial color="#0369a1" transparent opacity={0.7} roughness={0.1} metalness={0.8} />
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

// Cámara directora: el target del orbit sigue suavemente a la localización activa
function CameraDirector({ locationIndex, controlsRef }: { locationIndex: number; controlsRef: React.MutableRefObject<any> }) {
  const target = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, delta) => {
    if (!controlsRef.current) return;
    const loc = LOCATIONS[locationIndex];
    target.set(loc.position[0], 0.5, loc.position[2]);
    controlsRef.current.target.lerp(target, Math.min(1, delta * 1.2));
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
}) => {
  const currentLoc = LOCATIONS[currentLocationIndex];
  const vehicleTargetPosition: [number, number, number] = [
    currentLoc.position[0],
    currentLoc.type === 'port' ? 0.0 : currentLoc.type === 'airport' ? 0.65 : 0.2,
    currentLoc.position[2],
  ];

  const controlsRef = useRef<any>(null);

  return (
    <Canvas shadows camera={{ position: [-14, 18, 24], fov: 45 }}>
      <color attach="background" args={['#05050a']} />
      <fog attach="fog" args={['#05050a', 25, 90]} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[10, 25, 10]} intensity={1.6} color="#e2e8f0" castShadow />
      <pointLight position={[-15, 10, -10]} intensity={2.0} color="#00d4aa" />
      <pointLight position={[15, 8, 5]} intensity={1.2} color="#38bdf8" />
      <pointLight position={[3, 6, 4]} intensity={0.8} color="#f59e0b" />

      <gridHelper args={[120, 120, '#3f3f46', '#18181b']} position={[0, -0.15, 0]} />

      <ZfPerimeter />
      <RoutesNetwork mode={mode} />
      <Sea />

      {LOCATIONS.map((loc, idx) => {
        const props = { position: loc.position as [number, number, number], name: loc.name };
        switch (loc.type) {
          case 'factory': return <FactoryNode key={idx} {...props} />;
          case 'warehouse': return <WarehouseNode key={idx} {...props} />;
          case 'gate': return <GateNode key={idx} {...props} />;
          case 'customs': return <CustomsNode key={idx} {...props} />;
          case 'port': return <PortNode key={idx} {...props} />;
          case 'airport': return <AirportNode key={idx} {...props} />;
          case 'customer': return <CustomerNode key={idx} {...props} />;
          default: return null;
        }
      })}

      <SincronizedAirplane mode={mode} stepIndex={stepIndex} vehicleType={vehicleType} />
      <Vehicle targetPosition={vehicleTargetPosition} type={vehicleType} telemetry={telemetry} />

      <CameraDirector locationIndex={currentLocationIndex} controlsRef={controlsRef} />

      <OrbitControls
        ref={controlsRef}
        makeDefault
        minPolarAngle={0}
        maxPolarAngle={Math.PI / 2.2}
        enableZoom={true}
        enablePan={true}
        minDistance={8}
        maxDistance={65}
      />
    </Canvas>
  );
};
