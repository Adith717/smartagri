"use client";

import { useMemo } from 'react';
import {
  ArrowRight,
  CloudCog,
  Droplets,
  Fan,
  MapPin,
  ShieldAlert,
  Sparkles,
  ToggleRight,
  Wind,
  Zap,
} from 'lucide-react';
import { useThingsBoard } from './lib/useThingsBoard';
import { TelemetryChart } from './components/TelemetryChart';

const formatTime = (value: number) =>
  new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const statusTone = (online: boolean) =>
  online ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25' : 'bg-rose-500/10 text-rose-300 border-rose-500/25';

export default function Page() {
  const {
    config,
    setConfig,
    connected,
    statusMessage,
    telemetry,
    isMock,
    connect,
    disconnect,
    runControlAction,
    resetToMock,
  } = useThingsBoard();

  const zone2Alerts = useMemo(() => {
    const alerts = [] as string[];
    if (telemetry.zone2.waterLevel < 18) alerts.push('Low water alarm');
    if (telemetry.zone2.feedWeight < 18) alerts.push('Low feed level');
    if (telemetry.zone2.temperature > 30) alerts.push('High animal stress temp');
    return alerts;
  }, [telemetry.zone2]);

  const zone3Status = useMemo(() => {
    if (!telemetry.zone3.flowOk) return 'Flow error';
    if (telemetry.zone3.tds > 140) return 'Contamination risk';
    return 'Nominal';
  }, [telemetry.zone3]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-8 grid gap-4 rounded-[32px] border border-white/10 bg-slate-900/80 p-6 shadow-[0_36px_80px_rgba(15,23,42,0.35)] backdrop-blur-xl md:grid-cols-[minmax(0,1.8fr)_auto] md:items-center">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-1 text-xs uppercase tracking-[0.22em] text-emerald-300">
              <Sparkles className="h-4 w-4" /> Smart Agriculture & Livestock Dashboard
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Advanced Smart Farm Operations Console
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                View telemetry live from ThingsBoard, control actuators manually, and keep your 3-zone ecosystem stable with a production-ready dashboard.
              </p>
            </div>
          </div>

          <div className="grid gap-3 rounded-[28px] border border-slate-800/80 bg-slate-950/90 p-4 shadow-inner">
            <div className="flex items-center justify-between gap-3 text-sm text-slate-300">
              <span className="font-semibold">Connection</span>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${connected ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-amber-400/20 bg-amber-400/10 text-amber-200'}`}>
                {connected ? 'Live' : 'Preview'}
              </span>
            </div>
            <p className="text-xs leading-5 text-slate-400">{statusMessage}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <button onClick={connect} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300">
                Connect live
                <ArrowRight className="h-4 w-4" />
              </button>
              <button onClick={resetToMock} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500">
                Reset preview
              </button>
            </div>
            <button onClick={disconnect} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500">
              Disconnect
            </button>
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[1.9fr_1fr]">
          <div className="grid gap-6">
            <div className="grid gap-4 rounded-[32px] border border-white/10 bg-slate-900/70 p-6 shadow-[0_32px_60px_rgba(15,23,42,0.32)]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.22em] text-slate-400">Global Overview</p>
                  <h2 className="mt-3 text-2xl font-semibold text-white">Network health, energy, and live alerts</h2>
                </div>
                <div className="inline-flex items-center gap-2 rounded-3xl border border-slate-800/80 bg-slate-950/50 px-4 py-3 text-sm text-slate-300">
                  <CloudCog className="h-5 w-5 text-slate-300" /> {connected ? 'ThingsBoard stream active' : 'Local mock data'}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-4">
                <article className="rounded-3xl border border-slate-800/80 bg-slate-950/80 p-5">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Gateway status</p>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-3xl font-semibold text-white">{telemetry.system.gatewayOnline ? 'Online' : 'Offline'}</p>
                      <p className="text-sm text-slate-400">Field gateway health</p>
                    </div>
                    <span className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${statusTone(telemetry.system.gatewayOnline)}`}>
                      <MapPin className="h-5 w-5" />
                    </span>
                  </div>
                </article>

                <article className="rounded-3xl border border-slate-800/80 bg-slate-950/80 p-5">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Telemetry latency</p>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-3xl font-semibold text-white">{telemetry.system.lagMs} ms</p>
                      <p className="text-sm text-slate-400">Realtime loop delay</p>
                    </div>
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
                      <Wind className="h-5 w-5" />
                    </span>
                  </div>
                </article>

                <article className="rounded-3xl border border-slate-800/80 bg-slate-950/80 p-5">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Active alerts</p>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-3xl font-semibold text-white">{telemetry.system.activeAlerts}</p>
                      <p className="text-sm text-slate-400">System alerts</p>
                    </div>
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-300">
                      <Zap className="h-5 w-5" />
                    </span>
                  </div>
                </article>

                <article className="rounded-3xl border border-slate-800/80 bg-slate-950/80 p-5">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Preview mode</p>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-3xl font-semibold text-white">{isMock ? 'Mock' : 'Live'}</p>
                      <p className="text-sm text-slate-400">Data source</p>
                    </div>
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-300">
                      <ToggleRight className="h-5 w-5" />
                    </span>
                  </div>
                </article>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-[32px] border border-slate-800/80 bg-slate-900/75 p-6">
                <div className="flex items-start gap-3 text-slate-300">
                  <div className="rounded-3xl bg-emerald-400/10 p-3 text-emerald-300">
                    <Droplets className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Zone layout</p>
                    <h3 className="mt-2 text-xl font-semibold text-white">Farm zones schematic</h3>
                  </div>
                </div>
                <div className="mt-6 grid gap-4">
                  {['ZONE 1', 'ZONE 2', 'ZONE 3'].map((zone, index) => (
                    <div key={zone} className="rounded-3xl border border-slate-800/90 bg-slate-950/80 p-4 shadow-inner">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold text-slate-200">{zone}</span>
                        <span className="rounded-full bg-slate-800/80 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-400">{index === 0 ? 'Crops' : index === 1 ? 'Livestock' : 'Energy'}</span>
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-slate-400">
                        <div className="rounded-2xl bg-slate-900/80 p-3 text-center">Connectivity<br />{connected ? 'OK' : 'Mock'}</div>
                        <div className="rounded-2xl bg-slate-900/80 p-3 text-center">Alert<br />{index === 0 ? (telemetry.zone1.soil < 30 ? 'Yes' : 'No') : index === 1 ? (zone2Alerts.length ? 'Yes' : 'No') : zone3Status !== 'Nominal' ? 'Yes' : 'No'}</div>
                        <div className="rounded-2xl bg-slate-900/80 p-3 text-center">Power<br />{index === 2 ? Math.round(telemetry.zone3.energyGenerated) + ' kWh' : '—'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[32px] border border-slate-800/80 bg-slate-900/75 p-6">
                <div className="flex items-start gap-3 text-slate-300">
                  <div className="rounded-3xl bg-cyan-400/10 p-3 text-cyan-300">
                    <CloudCog className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm uppercase tracking-[0.22em] text-slate-500">ThingsBoard settings</p>
                    <h3 className="mt-2 text-xl font-semibold text-white">Live data configuration</h3>
                  </div>
                </div>
                <form className="mt-6 grid gap-4">
                  <label className="block text-sm text-slate-300">
                    Host URL
                    <input
                      value={config.host}
                      onChange={(event) => setConfig((prev) => ({ ...prev, host: event.target.value }))}
                      placeholder="https://demo.thingsboard.io"
                      className="mt-2 w-full rounded-3xl border border-slate-800/80 bg-slate-950/90 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-emerald-400/70"
                    />
                  </label>
                  <label className="block text-sm text-slate-300">
                    Customer Email
                    <input
                      value={config.customerEmail}
                      onChange={(event) => setConfig((prev) => ({ ...prev, customerEmail: event.target.value }))}
                      placeholder="customer@thingsboard.io"
                      className="mt-2 w-full rounded-3xl border border-slate-800/80 bg-slate-950/90 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-emerald-400/70"
                    />
                  </label>
                  <label className="block text-sm text-slate-300">
                    Customer Password
                    <input
                      type="password"
                      value={config.customerPassword}
                      onChange={(event) => setConfig((prev) => ({ ...prev, customerPassword: event.target.value }))}
                      placeholder="••••••••"
                      className="mt-2 w-full rounded-3xl border border-slate-800/80 bg-slate-950/90 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-emerald-400/70"
                    />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm text-slate-300">
                      Zone 1 Device
                      <input
                        value={config.deviceMap.zone1a}
                        onChange={(event) => setConfig((prev) => ({
                          ...prev,
                          deviceMap: { ...prev.deviceMap, zone1a: event.target.value },
                        }))}
                        placeholder="Device ID"
                        className="mt-2 w-full rounded-3xl border border-slate-800/80 bg-slate-950/90 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-emerald-400/70"
                      />
                    </label>
                    <label className="block text-sm text-slate-300">
                      Zone 2 Device
                      <input
                        value={config.deviceMap.zone2a}
                        onChange={(event) => setConfig((prev) => ({
                          ...prev,
                          deviceMap: { ...prev.deviceMap, zone2a: event.target.value },
                        }))}
                        placeholder="Device ID"
                        className="mt-2 w-full rounded-3xl border border-slate-800/80 bg-slate-950/90 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-emerald-400/70"
                      />
                    </label>
                    <label className="block text-sm text-slate-300">
                      Zone 3 Device
                      <input
                        value={config.deviceMap.zone3a}
                        onChange={(event) => setConfig((prev) => ({
                          ...prev,
                          deviceMap: { ...prev.deviceMap, zone3a: event.target.value },
                        }))}
                        placeholder="Device ID"
                        className="mt-2 w-full rounded-3xl border border-slate-800/80 bg-slate-950/90 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-emerald-400/70"
                      />
                    </label>
                  </div>
                </form>
              </div>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-[32px] border border-slate-800/80 bg-slate-900/75 p-6">
              <div className="flex items-center gap-3 text-slate-300">
                <div className="rounded-3xl bg-slate-800/80 p-3 text-cyan-300">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Timeline</p>
                  <h3 className="mt-2 text-xl font-semibold text-white">Critical system feedback</h3>
                </div>
              </div>
              <div className="mt-6 space-y-4 text-slate-300">
                <div className="rounded-3xl border border-slate-800/90 bg-slate-950/80 p-4">
                  <p className="text-sm text-slate-500">Last update</p>
                  <p className="mt-2 text-base font-semibold text-white">{formatTime(telemetry.system.lastUpdated)}</p>
                </div>
                <div className="rounded-3xl border border-slate-800/90 bg-slate-950/80 p-4">
                  <p className="text-sm text-slate-500">Mode</p>
                  <p className="mt-2 text-base font-semibold text-white">{isMock ? 'Manual preview' : 'Live remote control'}</p>
                </div>
              </div>
            </div>
          </aside>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-3">
          <article className="rounded-[32px] border border-slate-800/80 bg-slate-900/85 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.25)]">
            <div className="flex items-center justify-between gap-3 text-slate-300">
              <div>
                <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Zone 1</p>
                <h3 className="mt-2 text-2xl font-semibold text-white">Crop Health & Protection</h3>
              </div>
              <span className="rounded-3xl bg-slate-800/80 px-3 py-2 text-xs uppercase tracking-[0.22em] text-emerald-300">
                Soil & canopy
              </span>
            </div>
            <div className="mt-6 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-3xl border border-slate-800/90 bg-slate-950/80 p-4">
                  <p className="text-sm text-slate-400">Soil moisture</p>
                  <p className="mt-3 text-3xl font-semibold text-cyan-300">{telemetry.zone1.soil}%</p>
                </div>
                <div className="rounded-3xl border border-slate-800/90 bg-slate-950/80 p-4">
                  <p className="text-sm text-slate-400">Canopy</p>
                  <p className="mt-3 text-3xl font-semibold text-emerald-300">{telemetry.zone1.canopyOpen ? 'Open' : 'Closed'}</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-3xl border border-slate-800/90 bg-slate-950/80 p-4">
                  <p className="text-sm text-slate-400">Ambient temperature</p>
                  <p className="mt-3 text-2xl font-semibold text-amber-300">{telemetry.zone1.temperature}°C</p>
                </div>
                <div className="rounded-3xl border border-slate-800/90 bg-slate-950/80 p-4">
                  <p className="text-sm text-slate-400">Humidity</p>
                  <p className="mt-3 text-2xl font-semibold text-sky-300">{telemetry.zone1.humidity}%</p>
                </div>
              </div>
              <div className="grid gap-4">
                <div className="rounded-3xl border border-slate-800/90 bg-slate-950/80 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-100">Manual irrigation</p>
                    <button
                      type="button"
                      onClick={async () => await runControlAction('zone1', 'setPump', !telemetry.zone1.pumpOn)}
                      className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${telemetry.zone1.pumpOn ? 'bg-emerald-400 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                    >
                      {telemetry.zone1.pumpOn ? 'Stop pump' : 'Start pump'}
                    </button>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">Manual override for the irrigation pump.</p>
                </div>
                <div className="rounded-3xl border border-slate-800/90 bg-slate-950/80 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-100">Protective canopy</p>
                    <button
                      type="button"
                      onClick={async () => await runControlAction('zone1', 'setCanopy', !telemetry.zone1.canopyOpen)}
                      className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${telemetry.zone1.canopyOpen ? 'bg-sky-400 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                    >
                      {telemetry.zone1.canopyOpen ? 'Close canopy' : 'Open canopy'}
                    </button>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">Manual override for shelter protection.</p>
                </div>
              </div>
              <div>
                <TelemetryChart label="Soil moisture" data={telemetry.zone1.history.map((item) => ({ time: item.time, value: item.soil }))} color="#22d3ee" />
              </div>
            </div>
          </article>

          <article className="rounded-[32px] border border-slate-800/80 bg-slate-900/85 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.25)]">
            <div className="flex items-center justify-between gap-3 text-slate-300">
              <div>
                <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Zone 2</p>
                <h3 className="mt-2 text-2xl font-semibold text-white">Cattle Resources Hub</h3>
              </div>
              <span className="rounded-3xl bg-slate-800/80 px-3 py-2 text-xs uppercase tracking-[0.22em] text-slate-300">
                Livestock control
              </span>
            </div>
            <div className="mt-6 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-3xl border border-slate-800/90 bg-slate-950/80 p-4">
                  <p className="text-sm text-slate-400">Water level</p>
                  <p className="mt-3 text-3xl font-semibold text-cyan-300">{telemetry.zone2.waterLevel} cm</p>
                </div>
                <div className="rounded-3xl border border-slate-800/90 bg-slate-950/80 p-4">
                  <p className="text-sm text-slate-400">Feed weight</p>
                  <p className="mt-3 text-3xl font-semibold text-amber-300">{telemetry.zone2.feedWeight} kg</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-3xl border border-slate-800/90 bg-slate-950/80 p-4">
                  <p className="text-sm text-slate-400">Temperature</p>
                  <p className="mt-3 text-2xl font-semibold text-rose-300">{telemetry.zone2.temperature}°C</p>
                </div>
                <div className="rounded-3xl border border-slate-800/90 bg-slate-950/80 p-4">
                  <p className="text-sm text-slate-400">Humidity</p>
                  <p className="mt-3 text-2xl font-semibold text-sky-300">{telemetry.zone2.humidity}%</p>
                </div>
              </div>
              <div className="rounded-3xl border border-slate-800/90 bg-slate-950/80 p-5">
                <p className="text-sm font-semibold text-slate-100">Feed servo angle</p>
                <div className="mt-4 flex items-center gap-4">
                  <input
                    type="range"
                    min={0}
                    max={180}
                    value={telemetry.zone2.servoAngle}
                    onChange={async (event) => await runControlAction('zone2', 'setServo', Number(event.target.value))}
                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-700 accent-emerald-400"
                  />
                  <span className="text-sm text-slate-300">{telemetry.zone2.servoAngle}°</span>
                </div>
              </div>
              <div className="rounded-3xl border border-slate-800/90 bg-slate-950/80 p-5">
                <p className="text-sm font-semibold text-slate-100">Ventilation fan speed</p>
                <div className="mt-4 flex items-center gap-4">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={telemetry.zone2.fanSpeed}
                    onChange={async (event) => await runControlAction('zone2', 'setFanSpeed', Number(event.target.value))}
                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-700 accent-cyan-400"
                  />
                  <span className="text-sm text-slate-300">{telemetry.zone2.fanSpeed}%</span>
                </div>
              </div>
              <div className="rounded-3xl border border-slate-800/90 bg-slate-950/80 p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-100">Perimeter lights</p>
                  <button
                    type="button"
                    onClick={async () => await runControlAction('zone2', 'setLights', !telemetry.zone2.lightsOn)}
                    className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${telemetry.zone2.lightsOn ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                  >
                    {telemetry.zone2.lightsOn ? 'Lights on' : 'Lights off'}
                  </button>
                </div>
              </div>
              <div className="rounded-3xl border border-slate-800/90 bg-slate-950/80 p-4">
                <p className="text-sm font-semibold text-slate-100">Attendance</p>
                <div className="mt-3 space-y-2 text-sm text-slate-300">
                  {telemetry.zone2.attendance.slice(-4).reverse().map((entry) => (
                    <div key={entry.ts} className="flex items-center justify-between rounded-2xl bg-slate-900/80 px-3 py-2">
                      <span>{entry.uid}</span>
                      <span className="text-xs text-slate-500">{formatTime(entry.ts)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-4">
                <div className="mb-3 flex items-center justify-between text-sm text-slate-500">
                  <span>Alert indicators</span>
                  <span className="text-amber-300">{zone2Alerts.length ? `${zone2Alerts.length} issues` : 'No issues'}</span>
                </div>
                <div className="space-y-3">
                  {zone2Alerts.length > 0 ? (
                    zone2Alerts.map((alert) => {
                      return (
                        <div key={alert} className="rounded-3xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                          {alert}
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">Stable livestock conditions.</div>
                  )}
                </div>
              </div>
            </div>
          </article>

          <article className="rounded-[32px] border border-slate-800/80 bg-slate-900/85 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.25)]">
            <div className="flex items-center justify-between gap-3 text-slate-300">
              <div>
                <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Zone 3</p>
                <h3 className="mt-2 text-2xl font-semibold text-white">Energy & Safety System</h3>
              </div>
              <span className="rounded-3xl bg-slate-800/80 px-3 py-2 text-xs uppercase tracking-[0.22em] text-slate-300">
                Solar & safety
              </span>
            </div>
            <div className="mt-6 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-3xl border border-slate-800/90 bg-slate-950/80 p-4">
                  <p className="text-sm text-slate-400">Solar voltage</p>
                  <p className="mt-3 text-3xl font-semibold text-cyan-300">{telemetry.zone3.solarVoltage} V</p>
                </div>
                <div className="rounded-3xl border border-slate-800/90 bg-slate-950/80 p-4">
                  <p className="text-sm text-slate-400">Solar current</p>
                  <p className="mt-3 text-3xl font-semibold text-amber-300">{telemetry.zone3.solarCurrent} A</p>
                </div>
              </div>
              <div className="rounded-3xl border border-slate-800/90 bg-slate-950/80 p-4">
                <p className="text-sm text-slate-400">Total energy</p>
                <p className="mt-3 text-3xl font-semibold text-emerald-300">{telemetry.zone3.energyGenerated} kWh</p>
              </div>
              <div className="rounded-3xl border border-slate-800/90 bg-slate-950/80 p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-100">Auto-tracking</p>
                  <button
                    type="button"
                    onClick={async () => await runControlAction('zone3', 'setTracker', !telemetry.zone3.autoTracking)}
                    className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${telemetry.zone3.autoTracking ? 'bg-emerald-400 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                  >
                    {telemetry.zone3.autoTracking ? 'Manual mode' : 'Auto mode'}
                  </button>
                </div>
              </div>
              <div className="rounded-3xl border border-slate-800/90 bg-slate-950/80 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-100">Safety interlock</p>
                    <p className="text-sm text-slate-500">{zone3Status}</p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => await runControlAction('zone3', 'resetPumpCutoff', true)}
                    className="rounded-2xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-400"
                  >
                    Reset cutoff
                  </button>
                </div>
              </div>
              <div>
                <TelemetryChart label="Solar energy" data={telemetry.zone3.history.map((item) => ({ time: item.time, value: item.energyGenerated }))} color="#fbbf24" />
              </div>
            </div>
          </article>
        </section>
      </div>
    </div>
  );
}
