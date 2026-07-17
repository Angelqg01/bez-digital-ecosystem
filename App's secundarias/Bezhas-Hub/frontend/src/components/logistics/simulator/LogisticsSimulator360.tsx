import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { Play, RotateCcw, Maximize, Minimize, Scan, Info, Flame } from 'lucide-react';
import './simulator.css';

import { SimulationStep, TransitMode, B_UID } from './engine/types';
import { buildFlow360, BREACH_FROM_INDEX } from './engine/flows';
import { getDynamicStep } from './engine/getDynamicStep';
import { CARGOS, CargoConfig } from './engine/cargos';
import { VALIDATOR_LIST } from './engine/validators';
import { SimBlock, createBlock, GENESIS_HASH, nftsForStep, escrowEventsForStep } from './engine/chain';

import { BlockchainNodes } from './BlockchainNodes';
import { TimelineProgressBar } from './TimelineProgressBar';
import { ExplorerPanel, ExplorerLogEntry } from './explorer/ExplorerPanel';
import { ValidatorNodesBar } from './explorer/ValidatorNodesBar';
import { IoTTelemetryChart } from './panels/IoTTelemetryChart';
import { AssetDigitalTwinPanel } from './panels/AssetDigitalTwinPanel';
import { FoodOracleScanner } from './panels/FoodOracleScanner';
import { CertificateModal } from './panels/CertificateModal';
import { ManualVsAutonomous } from './intro/ManualVsAutonomous';

// La escena 3D (three/R3F) se carga en diferido para no engordar el bundle inicial del Hub
const LogisticsScene3D = React.lazy(() =>
  import('./scene/LogisticsScene3D').then((m) => ({ default: m.LogisticsScene3D }))
);

const initialStatus = { rwa: 'Standby', contract: 'Standby', mcp: 'Standby', oraculo: 'Standby' };

export default function LogisticsSimulator360() {
  const containerRef = useRef<HTMLDivElement>(null);

  const [showIntro, setShowIntro] = useState(false);
  const [mode, setMode] = useState<TransitMode>('sea');
  const [selectedCargo, setSelectedCargo] = useState<CargoConfig>(CARGOS[0]);
  const [simulationSpeed, setSimulationSpeed] = useState(1);
  const [isRunning, setIsRunning] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [isBreached, setIsBreached] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [blocks, setBlocks] = useState<SimBlock[]>([]);
  const [completedStepIds, setCompletedStepIds] = useState<number[]>([]);
  const [logs, setLogs] = useState<ExplorerLogEntry[]>([
    { id: 'init', time: new Date().toLocaleTimeString(), text: 'Red L2 BeZhas inicializada. Esperando inyección de datos del mundo físico...', type: 'info' },
  ]);

  const [showDigitalTwin, setShowDigitalTwin] = useState(false);
  const [showFoodOracle, setShowFoodOracle] = useState(false);
  const [showCertificate, setShowCertificate] = useState(false);

  const flow = useMemo(() => buildFlow360(mode), [mode]);

  // Refs para leer estado actualizado dentro del bucle asíncrono
  const isBreachedRef = useRef(isBreached);
  useEffect(() => { isBreachedRef.current = isBreached; }, [isBreached]);
  const speedRef = useRef(simulationSpeed);
  useEffect(() => { speedRef.current = simulationSpeed; }, [simulationSpeed]);
  const runIdRef = useRef(0);

  const isIdle = !isRunning && !isFinished;
  const currentStep: SimulationStep = isIdle
    ? getDynamicStep(
        {
          ...flow[0],
          activeNodes: [],
          status: initialStatus,
          bUidStage: 'IDLE',
          actor: 'WAITING',
          escrow: 'NONE',
          telemetry: { temp: '22.4°C', humidity: '45%', shock: '0.0g', status: 'Integrity OK' },
          validations: [],
        },
        selectedCargo, 0, false
      )
    : getDynamicStep(flow[stepIndex] || flow[0], selectedCargo, stepIndex, isBreached);

  const addLog = (text: string, type: ExplorerLogEntry['type']) => {
    setLogs((prev) => {
      const sliceLimit = prev.length > 220 ? prev.length - 120 : 0;
      return [...prev.slice(sliceLimit), { id: `${Date.now()}-${Math.random()}`, time: new Date().toLocaleTimeString(), text, type }];
    });
  };

  const handleStart = async () => {
    if (isRunning) return;
    const runId = ++runIdRef.current;
    setIsRunning(true);
    setIsFinished(false);
    setIsBreached(false);
    setStepIndex(0);
    setBlocks([]);
    setCompletedStepIds([]);
    setShowCertificate(false);
    setLogs([{
      id: 'init',
      time: new Date().toLocaleTimeString(),
      text: `Red L2 BeZhas inicializada. Simulación 360°: Fábrica de Origen → Zona Franca → ${mode === 'sea' ? 'ruta marítima' : 'ruta aérea'} → Distribuidor Final, para el activo ${selectedCargo.name} con tokenización RWA en tiempo real.`,
      type: 'info',
    }]);

    for (let i = 0; i < flow.length; i++) {
      if (runIdRef.current !== runId) return; // reset durante la ejecución
      setStepIndex(i);
      const baseStep = flow[i];
      const step = getDynamicStep(baseStep, selectedCargo, i, isBreachedRef.current);

      addLog(`== [ETAPA ${step.id}/16 · ${step.phase === 'origin' ? 'ORIGEN' : step.phase === 'transit' ? 'TRÁNSITO' : 'DESTINO'}] ${step.bUidStage} — Validador: ${step.validator.name} ==`, 'info');
      addLog(step.msg, 'info');

      await new Promise((res) => setTimeout(res, Math.floor(500 / speedRef.current)));
      if (runIdRef.current !== runId) return;

      const logType = step.activeNodes.includes('mcp') && step.activeNodes.length === 1 ? 'agent' : 'bc';
      addLog(step.bc, logType);

      // Sellar bloque de la etapa en la cadena del explorer
      setBlocks((prev) => [
        ...prev,
        createBlock(prev.length + 1, prev.length ? prev[prev.length - 1].hash : GENESIS_HASH, `${step.bUidStage} · ${step.validator.name}`, step.id, step.phase),
      ]);

      const adjustedTimeMs = Math.floor(step.timeMs / speedRef.current);
      if (step.validations.length > 0) {
        const delayPerValidation = Math.floor(adjustedTimeMs / step.validations.length);
        for (let v = 0; v < step.validations.length; v++) {
          await new Promise((res) => setTimeout(res, delayPerValidation));
          if (runIdRef.current !== runId) return;
          const updatedStep = getDynamicStep(baseStep, selectedCargo, i, isBreachedRef.current);
          addLog(updatedStep.validations[v] || step.validations[v], 'bc');
        }
      } else {
        await new Promise((res) => setTimeout(res, adjustedTimeMs));
      }

      setCompletedStepIds((prev) => [...prev, step.id]);
    }

    if (runIdRef.current !== runId) return;
    setIsFinished(true);
    setIsRunning(false);

    if (isBreachedRef.current) {
      addLog('⚠️ Simulación 360° completada con CONFLICTOS. Trazabilidad inmutable de la anomalía térmica registrada desde la Zona Franca de Origen. Los fondos de garantía ($BEZ) quedan CONGELADOS bajo protocolo de arbitraje multifirma.', 'info');
    } else {
      addLog('✅ Simulación 360° completada. Ciclo Fábrica de Origen → Distribuidor Final tokenizado íntegramente y sellado en la blockchain.', 'info');
    }
  };

  const handleReset = () => {
    runIdRef.current++;
    setIsRunning(false);
    setIsFinished(false);
    setIsBreached(false);
    setStepIndex(0);
    setBlocks([]);
    setCompletedStepIds([]);
    setShowCertificate(false);
    setLogs([{ id: 'init', time: new Date().toLocaleTimeString(), text: 'Nodos de simulación BeZhas reseteados. Listo para nuevo ciclo 360°.', type: 'info' }]);
  };

  // Ticks de red en segundo plano mientras corre la simulación
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      const randomHex = () => Math.random().toString(16).substring(2, 10).toUpperCase();
      const nodes = ['ORIGIN_VAL_01', 'MADRID_VAL_02', 'ROTTERDAM_VAL_03', 'ZURICH_VAL_04'];
      const pool = [
        () => `[L2 BLOCK] Bloque propuesto por nodo_${nodes[Math.floor(Math.random() * nodes.length)]} | Txs: ${Math.floor(Math.random() * 8) + 1} | Hash: 0x${randomHex()}`,
        () => `[ORACLE INGEST] Telemetría IoT (B-UID: ${B_UID}) | Estado: ${isBreachedRef.current ? '⚠️ BREACH_ALERT' : '✅ COMPLIANT'}`,
        () => `[CONSENSUS] Consenso validado | Firmas: 4/4 validadores | Hash de Estado: 0x${randomHex()}`,
        () => `[NETWORK] Gas Base: ${15 + Math.floor(Math.random() * 5)} Gwei | TPS L2: ${(2.5 + Math.random() * 5).toFixed(1)} | Red: OPERATIVA`,
      ];
      addLog(pool[Math.floor(Math.random() * pool.length)](), 'bc');
    }, 3500);
    return () => clearInterval(interval);
  }, [isRunning]);

  // Fullscreen sobre el contenedor del simulador
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => undefined);
    } else {
      document.exitFullscreen();
    }
  };

  const nfts = useMemo(() => nftsForStep(completedStepIds), [completedStepIds]);
  const escrowEvents = useMemo(() => escrowEventsForStep(completedStepIds, isBreached), [completedStepIds, isBreached]);
  const confirmedDids = useMemo(
    () => flow.filter((s) => completedStepIds.includes(s.id)).map((s) => s.validator.did),
    [flow, completedStepIds]
  );
  const activeValidatorDid = isRunning ? currentStep.validator?.did : undefined;

  if (showIntro) {
    return <ManualVsAutonomous onClose={() => setShowIntro(false)} />;
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[82vh] min-h-[620px] rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950 text-zinc-100 font-sans"
    >
      {/* Capa 3D de fondo */}
      <div className="absolute inset-0 z-0">
        <Suspense
          fallback={
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-teal-400">
              <div className="w-8 h-8 border-2 border-teal-500/30 border-t-teal-400 rounded-full animate-spin" />
              <span className="text-[10px] font-mono uppercase tracking-[0.3em]">Cargando gemelo digital 3D...</span>
            </div>
          }
        >
          <LogisticsScene3D
            currentLocationIndex={currentStep.locationIndex}
            vehicleType={isIdle ? 'camion' : currentStep.vehicle}
            telemetry={isRunning ? currentStep.telemetry : undefined}
            mode={mode}
            stepIndex={stepIndex}
            isRunning={isRunning}
          />
        </Suspense>
      </div>

      {/* Overlays */}
      <div className="absolute inset-0 z-10 flex flex-col pointer-events-none">
        {/* HEADER */}
        <header className="pointer-events-auto flex flex-wrap gap-2 justify-between items-center bg-zinc-950/85 backdrop-blur-md border-b border-zinc-800/50 px-4 py-2.5">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-[9px] tracking-[0.3em] uppercase opacity-50">Ecosistema Logístico BeZhas L2 · Simulación 360°</h1>
              <span className="text-base font-light tracking-tight flex items-center gap-2">
                FÁBRICA DE ORIGEN <span className="text-teal-400 font-bold">→</span> DISTRIBUIDOR FINAL
                <span className="px-2 py-0.5 rounded bg-teal-500/10 text-teal-400 text-[9px] border border-teal-500/20 uppercase tracking-widest">L2 Live</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowIntro(true)}
              className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white px-2.5 py-1.5 rounded text-[9px] tracking-widest uppercase transition-colors"
              title="Comparativa: gestión manual vs SDK autónomo"
            >
              <Info size={12} /> ¿Por qué BeZhas?
            </button>

            {/* Selector ruta */}
            <div className="flex bg-zinc-900 border border-zinc-800 p-0.5 rounded gap-1">
              <button
                onClick={() => !isRunning && setMode('sea')}
                disabled={isRunning}
                className={`px-2.5 py-1.5 rounded text-[9px] uppercase tracking-widest font-mono transition-all ${mode === 'sea' ? 'bg-sky-600 text-white font-bold shadow-[0_0_10px_rgba(2,132,199,0.4)]' : 'text-zinc-400 hover:text-zinc-200 disabled:opacity-50'}`}
              >
                🚢 Marítimo
              </button>
              <button
                onClick={() => !isRunning && setMode('air')}
                disabled={isRunning}
                className={`px-2.5 py-1.5 rounded text-[9px] uppercase tracking-widest font-mono transition-all ${mode === 'air' ? 'bg-fuchsia-600 text-white font-bold shadow-[0_0_10px_rgba(219,39,119,0.4)]' : 'text-zinc-400 hover:text-zinc-200 disabled:opacity-50'}`}
              >
                ✈️ Aéreo
              </button>
            </div>

            {isFinished && (
              <button
                onClick={() => setShowCertificate(true)}
                className="flex items-center gap-1.5 bg-amber-600/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-500 px-2.5 py-1.5 rounded text-[9px] tracking-widest uppercase transition-all"
              >
                🏅 Certificado + QR
              </button>
            )}
            {!showFoodOracle && (
              <button
                onClick={() => setShowFoodOracle(true)}
                className="flex items-center gap-1.5 bg-cyan-600/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-400 px-2.5 py-1.5 rounded text-[9px] tracking-widest uppercase transition-all"
              >
                <Scan size={12} /> Food Oracle
              </button>
            )}
            {!showDigitalTwin && (
              <button
                onClick={() => setShowDigitalTwin(true)}
                className="flex items-center gap-1.5 bg-emerald-600/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-500 px-2.5 py-1.5 rounded text-[9px] tracking-widest uppercase transition-all"
              >
                ◆ Digital Twin
              </button>
            )}

            <button
              onClick={handleStart}
              disabled={isRunning}
              className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 disabled:bg-zinc-800 disabled:text-zinc-600 border border-teal-500/20 text-white px-3 py-1.5 rounded text-[9px] tracking-widest uppercase transition-colors shadow-lg"
            >
              <Play size={12} /> Ejecutar 360°
            </button>
            <button
              onClick={handleReset}
              disabled={!isRunning && !isFinished && logs.length <= 1}
              className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 disabled:text-zinc-700 border border-zinc-800 text-zinc-300 px-2.5 py-1.5 rounded text-[9px] tracking-widest uppercase transition-colors"
            >
              <RotateCcw size={12} /> Reset
            </button>
            <button
              onClick={toggleFullscreen}
              className="flex items-center justify-center p-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 rounded transition-colors"
              title="Pantalla completa"
            >
              {isFullscreen ? <Minimize size={13} /> : <Maximize size={13} />}
            </button>
          </div>
        </header>

        {/* Barra secundaria: carga, velocidad, breach */}
        <div className="pointer-events-auto bg-zinc-950/75 backdrop-blur border-b border-zinc-800/40 px-4 py-1.5 flex flex-wrap justify-between items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider">Producto RWA:</span>
            <div className="flex gap-1 bg-black/40 border border-zinc-800 p-0.5 rounded">
              {CARGOS.map((c) => (
                <button
                  key={c.id}
                  disabled={isRunning}
                  onClick={() => setSelectedCargo(c)}
                  className={`px-2 py-1 rounded text-[9px] font-mono transition-all flex items-center gap-1 border
                    ${selectedCargo.id === c.id ? 'bg-zinc-800 border-zinc-700 font-bold ' + c.color : 'text-zinc-500 hover:text-zinc-300 border-transparent disabled:opacity-50'}`}
                >
                  <span>{c.icon}</span>
                  <span className="hidden sm:inline">{c.name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider">Velocidad:</span>
              <div className="flex gap-1 bg-black/40 border border-zinc-800 p-0.5 rounded">
                {[1, 2, 5].map((speed) => (
                  <button
                    key={speed}
                    onClick={() => setSimulationSpeed(speed)}
                    className={`px-2 py-0.5 rounded text-[9px] font-mono transition-all ${simulationSpeed === speed ? 'bg-teal-600 text-white font-bold' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>

            {isRunning && (
              <button
                onClick={() => {
                  setIsBreached(true);
                  addLog('⚠️ ALERTA EXTRACONTRACTUAL: Se inyecta una rotura activa de la cadena de frío. Los sensores reportan anomalía térmica en tránsito.', 'agent');
                }}
                disabled={isBreached || stepIndex < BREACH_FROM_INDEX}
                className={`px-2.5 py-1 rounded text-[9px] font-mono font-bold tracking-widest uppercase transition-all flex items-center gap-1 border
                  ${isBreached
                    ? 'bg-red-950/20 text-red-500 border-red-500/20 opacity-60 cursor-not-allowed'
                    : stepIndex < BREACH_FROM_INDEX
                      ? 'bg-zinc-900 text-zinc-600 border-zinc-800 cursor-not-allowed'
                      : 'bg-red-600/10 hover:bg-red-600/20 border-red-500/40 text-red-400 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.2)]'}`}
                title={stepIndex < BREACH_FROM_INDEX ? 'Disponible cuando el activo salga de la Zona Franca (tránsito internacional)' : 'Inyectar fallo de temperatura'}
              >
                <Flame size={11} /> Rotura de Frío
              </button>
            )}
            {isFinished && isBreached && (
              <span className="bg-red-950/40 text-red-400 border border-red-500/20 px-2.5 py-1 rounded text-[9px] font-mono tracking-widest uppercase animate-pulse">
                🛑 DISPUTA L2 (ESCROW CONGELADO)
              </span>
            )}
          </div>
        </div>

        {/* Zona central */}
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 relative flex flex-col pointer-events-none min-w-0">
            <div className="w-full px-4 mt-3 max-w-4xl mx-auto flex justify-center pointer-events-auto">
              <BlockchainNodes activeNodes={currentStep.activeNodes} status={currentStep.status} />
            </div>

            {/* HUD izquierdo */}
            <div className="absolute top-[90px] left-4 flex flex-col gap-1.5 z-10 pointer-events-auto w-[230px]">
              <span className="bg-black/60 backdrop-blur px-2.5 py-1 rounded text-[9px] border border-white/10 text-white uppercase tracking-widest flex justify-between items-center">
                <span>B-UID</span> <span className="font-mono text-teal-400">{B_UID}</span>
              </span>
              <span className="bg-black/60 backdrop-blur px-2.5 py-1 rounded text-[9px] border border-white/10 text-white uppercase tracking-widest flex justify-between items-center">
                <span>Lifecycle</span> <span className="font-mono text-emerald-400">{currentStep.bUidStage || 'IDLE'}</span>
              </span>
              <span className="bg-black/60 backdrop-blur px-2.5 py-1 rounded text-[9px] border border-blue-500/20 text-blue-400 uppercase tracking-widest flex justify-between items-center">
                <span>Validador</span> <span className="font-mono text-blue-300">{isRunning ? currentStep.validator?.name : 'NONE'}</span>
              </span>
              <span className={`bg-black/60 backdrop-blur px-2.5 py-1 rounded text-[9px] border uppercase tracking-widest flex justify-between items-center
                ${currentStep.escrow.includes('RELEASED') ? 'border-emerald-500/20 text-emerald-400' :
                  currentStep.escrow.includes('LOCKED') ? 'border-amber-500/20 text-amber-400' :
                  currentStep.escrow.includes('HALTED') ? 'border-red-500/30 text-red-400 bg-red-950/20 animate-pulse' : 'border-white/10 text-zinc-500'}`}>
                <span>Escrow</span> <span className="font-mono">{currentStep.escrow || 'NONE'}</span>
              </span>

              {currentStep.telemetry && (
                <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                  <span className="bg-black/60 backdrop-blur px-2 py-1 rounded text-[9px] border border-zinc-800 font-mono flex flex-col">
                    <span className="text-[7px] text-zinc-500">TEMP</span>
                    <span className={isBreached && stepIndex >= BREACH_FROM_INDEX ? 'text-red-400 font-bold' : 'text-blue-400'}>{currentStep.telemetry.temp}</span>
                  </span>
                  <span className="bg-black/60 backdrop-blur px-2 py-1 rounded text-[9px] border border-zinc-800 font-mono flex flex-col">
                    <span className="text-[7px] text-zinc-500">HUMEDAD</span>
                    <span className="text-cyan-400">{currentStep.telemetry.humidity}</span>
                  </span>
                  <span className={`bg-black/60 backdrop-blur px-2 py-1 rounded text-[9px] border font-mono flex flex-col ${currentStep.telemetry.shock !== '0.0g' ? 'border-amber-500/50 text-amber-400' : 'border-zinc-800 text-emerald-400'}`}>
                    <span className="text-[7px] text-zinc-500">SHOCK</span>
                    <span>{currentStep.telemetry.shock}</span>
                  </span>
                  <span className={`bg-black/60 backdrop-blur px-2 py-1 rounded text-[9px] border font-mono flex flex-col ${isBreached && stepIndex >= BREACH_FROM_INDEX ? 'border-red-500/20 text-red-400 bg-red-950/10' : 'border-emerald-500/20 text-emerald-400'}`}>
                    <span className="text-[7px] text-zinc-500">ESTADO</span>
                    <span className="truncate" title={currentStep.telemetry.status}>{currentStep.telemetry.status}</span>
                  </span>
                </div>
              )}
            </div>

            {/* Validadores DID */}
            <div className="absolute bottom-[110px] left-4 right-4 z-10 pointer-events-auto">
              <ValidatorNodesBar validators={VALIDATOR_LIST} activeValidatorDid={activeValidatorDid} confirmedDids={confirmedDids} />
            </div>

            {/* Timeline */}
            <div className="absolute bottom-0 left-0 w-full z-10 pointer-events-auto">
              <TimelineProgressBar
                currentStepIndex={stepIndex}
                isRunning={isRunning}
                isFinished={isFinished}
                onStepClick={(i) => { if (isFinished || !isRunning) setStepIndex(i); }}
                flowSteps={flow}
              />
            </div>
          </div>

          {/* Sidebar derecho: Explorer + IoT */}
          <div className="pointer-events-auto w-[340px] h-full bg-black/95 backdrop-blur-md border-l border-teal-900/40 relative shadow-[-10px_0_25px_rgba(0,0,0,0.8)] flex-col z-20 hidden lg:flex">
            <div className="flex-1 min-h-0 p-2">
              <ExplorerPanel
                blocks={blocks}
                nfts={nfts}
                escrowEvents={escrowEvents}
                validators={VALIDATOR_LIST}
                activeValidatorDid={activeValidatorDid}
                confirmedDids={confirmedDids}
                metrics={currentStep.metrics}
                logs={logs}
                isBreached={isBreached}
                isFinished={isFinished}
              />
            </div>
            <IoTTelemetryChart isRunning={isRunning} telemetry={currentStep.telemetry} />
          </div>
        </div>
      </div>

      {/* Ventanas flotantes */}
      {showCertificate && (
        <CertificateModal onClose={() => setShowCertificate(false)} bUid={B_UID} isBreached={isBreached} containerRef={containerRef} />
      )}
      <AssetDigitalTwinPanel
        bUid={B_UID}
        isOpen={showDigitalTwin}
        onClose={() => setShowDigitalTwin(false)}
        isRunning={isRunning}
        isFinished={isFinished}
        telemetry={currentStep.telemetry}
        selectedCargo={selectedCargo}
        isBreached={isBreached}
        containerRef={containerRef}
      />
      <FoodOracleScanner
        isOpen={showFoodOracle}
        onClose={() => setShowFoodOracle(false)}
        selectedCargo={selectedCargo}
        isBreached={isBreached}
        containerRef={containerRef}
      />
    </div>
  );
}
