"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface TelemetryChartPoint {
  time: number;
  value: number;
}

interface TelemetryChartProps {
  label: string;
  data: TelemetryChartPoint[];
  color: string;
}

export function TelemetryChart({ label, data, color }: TelemetryChartProps) {
  return (
    <div className="h-52 rounded-3xl border border-slate-800 bg-slate-950/80 p-4">
      <div className="flex items-center justify-between mb-3 text-sm uppercase tracking-[0.24em] text-slate-400">
        <span>{label}</span>
        <span className="text-emerald-300">Live</span>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`telemetry-gradient-${label}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.45} />
              <stop offset="95%" stopColor={color} stopOpacity={0.08} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
          <XAxis dataKey="time" hide />
          <YAxis hide />
          <Tooltip labelFormatter={(value) => new Date(value).toLocaleTimeString()} formatter={(value: number) => [value, label]} />
          <Area type="monotone" dataKey="value" stroke={color} fill={`url(#telemetry-gradient-${label})`} strokeWidth={3} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
