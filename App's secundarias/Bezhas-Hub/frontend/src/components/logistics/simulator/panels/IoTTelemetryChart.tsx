import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Telemetry } from '../engine/types';

interface IoTTelemetryChartProps {
  isRunning: boolean;
  telemetry?: Telemetry;
}

interface DataPoint {
  time: string;
  temp: number;
  humidity: number;
}

export const IoTTelemetryChart: React.FC<IoTTelemetryChartProps> = ({ isRunning, telemetry }) => {
  const [data, setData] = useState<DataPoint[]>([]);
  const targetTemp = useRef(20);
  const targetHum = useRef(50);

  useEffect(() => {
    if (telemetry) {
      const t = parseFloat(telemetry.temp);
      const h = parseFloat(telemetry.humidity);
      if (!isNaN(t)) targetTemp.current = t;
      if (!isNaN(h)) targetHum.current = h;
    }
  }, [telemetry]);

  useEffect(() => {
    const initial = Array.from({ length: 15 }).map((_, i) => ({
      time: `T-${15 - i}`,
      temp: 22 + (Math.random() - 0.5) * 1.5,
      humidity: 45 + (Math.random() - 0.5) * 3,
    }));
    setData(initial);
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRunning) {
      interval = setInterval(() => {
        setData((prev) => {
          const newData = [...prev.slice(1)];
          const newTemp = targetTemp.current + (Math.random() - 0.5) * 1.2;
          const newHum = targetHum.current + (Math.random() - 0.5) * 2.5;
          newData.push({
            time: new Date().toLocaleTimeString([], { hour12: false, second: '2-digit', minute: '2-digit' }),
            temp: Number(newTemp.toFixed(1)),
            humidity: Number(newHum.toFixed(1)),
          });
          return newData;
        });
      }, 2000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning]);

  if (data.length === 0) return null;

  return (
    <div className="w-full h-36 border-t border-teal-900/40 pt-2 pb-2 px-3 flex flex-col shrink-0 bg-black/40">
      <div className="text-cyan-500/70 text-[9px] uppercase tracking-widest font-bold mb-1 flex justify-between px-1">
        <span>IoT Environmental Trend</span>
      </div>
      <div className="flex-1 w-full text-[9px] font-mono">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
            <XAxis dataKey="time" stroke="#064e3b" fontSize={8} tickLine={false} axisLine={false} />
            <YAxis yAxisId="left" stroke="#38bdf8" fontSize={8} tickLine={false} axisLine={false} domain={['dataMin - 5', 'dataMax + 5']} />
            <YAxis yAxisId="right" orientation="right" stroke="#22d3ee" fontSize={8} tickLine={false} axisLine={false} domain={['dataMin - 10', 'dataMax + 10']} />
            <Tooltip
              contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(6,182,212,0.3)', borderRadius: '4px', fontSize: '10px' }}
              itemStyle={{ color: '#22d3ee' }}
              labelStyle={{ color: '#a1a1aa', margin: 0, marginBottom: '4px' }}
            />
            <Line yAxisId="left" type="monotone" dataKey="temp" stroke="#38bdf8" strokeWidth={1.5} dot={false} name="Temp (°C)" isAnimationActive={false} />
            <Line yAxisId="right" type="monotone" dataKey="humidity" stroke="#22d3ee" strokeWidth={1.5} dot={false} name="Humedad (%)" isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
