"use client";

import { useThingsBoard } from './lib/useThingsBoard';

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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-8 rounded-3xl border border-white/10 bg-slate-900/80 p-6 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold text-white">Smart Agriculture Dashboard</h1>
              <p className="mt-2 text-slate-400">6-Node Distributed Control System with Auto-Actuation</p>
            </div>
            <div className={`px-4 py-2 rounded-full font-semibold ${connected ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50' : 'bg-amber-500/20 text-amber-300 border border-amber-500/50'}`}>
              {connected ? '🟢 Live' : '🟡 Preview'}
            </div>
          </div>
          <p className="text-sm text-slate-400">{statusMessage}</p>
        </header>

        {/* ThingsBoard Configuration */}
        <section className="mb-8 rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-xl font-semibold mb-4 text-white">ThingsBoard Connection</h2>
          <div className="grid gap-4 mb-6 lg:grid-cols-2">
            <input
              value={config.host}
              onChange={(e) => setConfig({ ...config, host: e.target.value })}
              placeholder="ThingsBoard Host URL"
              className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:border-emerald-500 outline-none"
            />
            <input
              value={config.customerEmail}
              onChange={(e) => setConfig({ ...config, customerEmail: e.target.value })}
              placeholder="Customer Email"
              className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:border-emerald-500 outline-none"
            />
            <input
              type="password"
              value={config.customerPassword}
              onChange={(e) => setConfig({ ...config, customerPassword: e.target.value })}
              placeholder="Customer Password"
              className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:border-emerald-500 outline-none"
            />
            <div className="flex gap-2">
              <button onClick={connect} className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg font-semibold text-white transition">Connect Live</button>
              <button onClick={resetToMock} className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold text-white transition">Reset Preview</button>
              <button onClick={disconnect} className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 rounded-lg font-semibold text-white transition">Disconnect</button>
            </div>
          </div>
          <input
            value={config.deviceMap.zone1}
            onChange={(e) => setConfig({ ...config, deviceMap: { ...config.deviceMap, zone1: e.target.value } })}
            placeholder="Zone Device IDs (enter config)"
            className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:border-emerald-500 outline-none"
          />
        </section>

        {/* System Health Overview */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-white">System Health</h2>
          <div className="grid gap-4 lg:grid-cols-4">
            <div className="rounded-lg bg-slate-900/60 border border-slate-800 p-4">
              <p className="text-sm text-slate-400 mb-2">Gateway</p>
              <div className="flex items-center justify-between">
                <span className={`text-lg font-semibold ${telemetry.system.gatewayOnline ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {telemetry.system.gatewayOnline ? 'Online' : 'Offline'}
                </span>
                <span className="text-2xl">{telemetry.system.gatewayOnline ? '🟢' : '🔴'}</span>
              </div>
            </div>
            <div className="rounded-lg bg-slate-900/60 border border-slate-800 p-4">
              <p className="text-sm text-slate-400 mb-2">Latency</p>
              <p className="text-lg font-semibold text-cyan-400">{telemetry.system.lagMs} ms</p>
            </div>
            <div className="rounded-lg bg-slate-900/60 border border-slate-800 p-4">
              <p className="text-sm text-slate-400 mb-2">Alerts</p>
              <p className="text-lg font-semibold text-amber-400">{telemetry.system.activeAlerts}</p>
            </div>
            <div className="rounded-lg bg-slate-900/60 border border-slate-800 p-4">
              <p className="text-sm text-slate-400 mb-2">Mode</p>
              <p className="text-lg font-semibold text-blue-400">{isMock ? 'Preview' : 'Live'}</p>
            </div>
          </div>
        </section>

        {/* Node Status Overview */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-white">Node Status</h2>
          <div className="grid gap-3 lg:grid-cols-6">
            {[
              { name: 'Zone 1A', online: telemetry.zone1a.online },
              { name: 'Zone 1B', online: telemetry.zone1b.online },
              { name: 'Zone 2A', online: telemetry.zone2a.online },
              { name: 'Zone 2B', online: telemetry.zone2b.online },
              { name: 'Zone 3A', online: telemetry.zone3a.online },
              { name: 'Zone 3B', online: telemetry.zone3b.online },
            ].map((node) => (
              <div key={node.name} className={`rounded-lg border p-4 text-center ${node.online ? 'bg-slate-900/60 border-emerald-500/30' : 'bg-slate-900/40 border-slate-700/50'}`}>
                <span className="text-2xl block mb-2">{node.online ? '🟢' : '🔴'}</span>
                <p className="font-semibold text-white">{node.name}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 6-Node Dashboard Grid */}
        <section className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3 mb-8">
          {/* Zone 1A - Crop Health */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-6">
            <h3 className="text-xl font-bold text-white mb-4">Zone 1A - Crop Health {telemetry.zone1a.online ? '🟢' : '🔴'}</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-slate-400">Temperature</p>
                <p className="text-2xl font-semibold text-cyan-400">{telemetry.zone1a.temperature.toFixed(1)}°C</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Humidity</p>
                <p className="text-2xl font-semibold text-blue-400">{telemetry.zone1a.humidity}%</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Soil Moisture {telemetry.zone1a.soilMoisture < 30 ? '⚠️' : '✓'}</p>
                <p className={`text-2xl font-semibold ${telemetry.zone1a.soilMoisture < 30 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {telemetry.zone1a.soilMoisture}%
                </p>
              </div>
              <div className="border-t border-slate-700 pt-3 mt-3">
                <p className="text-sm text-slate-400 mb-2">Pump {telemetry.zone1a.pumpActive ? '💧 Active' : 'Off'}</p>
                <div className="flex gap-2 flex-wrap text-xs">
                  <span className={`px-2 py-1 rounded ${telemetry.zone1a.redAlert ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-slate-400'}`}>Red Alert: {telemetry.zone1a.redAlert ? 'On' : 'Off'}</span>
                  <span className={`px-2 py-1 rounded ${telemetry.zone1a.greenIdleActive ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>Green Idle: {telemetry.zone1a.greenIdleActive ? 'On' : 'Off'}</span>
                  <span className={`px-2 py-1 rounded ${telemetry.zone1a.blueIrrigationActive ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-700 text-slate-400'}`}>Blue Irrig: {telemetry.zone1a.blueIrrigationActive ? 'On' : 'Off'}</span>
                </div>
              </div>
              {telemetry.zone1a.soilMoisture < 30 && (
                <div className="p-3 bg-rose-500/20 border border-rose-500/50 rounded text-rose-300 text-sm mt-3">
                  ⚠️ Auto-pump activated: Soil {telemetry.zone1a.soilMoisture}%
                </div>
              )}
            </div>
          </div>

          {/* Zone 1B - Protection */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-6">
            <h3 className="text-xl font-bold text-white mb-4">Zone 1B - Protection {telemetry.zone1b.online ? '🟢' : '🔴'}</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-slate-400">Motion Sensors</p>
                <div className="text-sm mt-1 space-y-1">
                  <p className={telemetry.zone1b.touchDetected ? 'text-amber-300' : 'text-slate-400'}>Touch: {telemetry.zone1b.touchDetected ? '✓ Detected' : '✗ Clear'}</p>
                  <p className={telemetry.zone1b.pirMotionDetected ? 'text-amber-300' : 'text-slate-400'}>PIR: {telemetry.zone1b.pirMotionDetected ? '✓ Motion' : '✗ Clear'}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-slate-400">Rain Level {telemetry.zone1b.rainLevel > 70 ? '🌧️' : '☀️'}</p>
                <p className={`text-2xl font-semibold ${telemetry.zone1b.rainLevel > 70 ? 'text-blue-400' : 'text-slate-400'}`}>
                  {telemetry.zone1b.rainLevel}%
                </p>
              </div>
              <div className="border-t border-slate-700 pt-3 mt-3">
                <p className="text-sm text-slate-400 mb-2">Roof Servo</p>
                <p className="text-lg font-semibold text-cyan-400">{telemetry.zone1b.roofServoAngle}°</p>
                <p className="text-xs text-slate-400 mt-1">Status: {telemetry.zone1b.roofOpen ? '🔓 Open' : '🔒 Closed'}</p>
              </div>
              {telemetry.zone1b.rainLevel > 70 && (
                <div className="p-3 bg-blue-500/20 border border-blue-500/50 rounded text-blue-300 text-sm mt-3">
                  💧 Auto-roof opened: Rain {telemetry.zone1b.rainLevel}%
                </div>
              )}
            </div>
          </div>

          {/* Zone 2A - Cattle Monitor */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-6">
            <h3 className="text-xl font-bold text-white mb-4">Zone 2A - Cattle Monitor {telemetry.zone2a.online ? '🟢' : '🔴'}</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-slate-400">Temperature</p>
                <p className="text-2xl font-semibold text-cyan-400">{telemetry.zone2a.temperature.toFixed(1)}°C</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Humidity</p>
                <p className="text-2xl font-semibold text-blue-400">{telemetry.zone2a.humidity}%</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Time</p>
                <p className="text-lg font-semibold text-slate-300">{telemetry.zone2a.rtcTime}</p>
              </div>
              <div className="border-t border-slate-700 pt-3 mt-3">
                <p className="text-sm text-slate-400 mb-2">Alerts</p>
                <div className="flex gap-2 text-xs">
                  <span className={`px-2 py-1 rounded ${telemetry.zone2a.buzzerActive ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-400'}`}>Buzzer: {telemetry.zone2a.buzzerActive ? 'On' : 'Off'}</span>
                  <span className={`px-2 py-1 rounded ${telemetry.zone2a.led1Alert ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-slate-400'}`}>LED1: {telemetry.zone2a.led1Alert ? 'On' : 'Off'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Zone 2B - Resources */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-6">
            <h3 className="text-xl font-bold text-white mb-4">Zone 2B - Resources {telemetry.zone2b.online ? '🟢' : '🔴'}</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-slate-400">Water Trough</p>
                <p className="text-2xl font-semibold text-blue-400">{telemetry.zone2b.waterTroughLevel}%</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Feed Weight</p>
                <p className="text-2xl font-semibold text-emerald-400">{telemetry.zone2b.feedWeight.toFixed(1)} kg</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Light Level {telemetry.zone2b.lux < 300 ? '💡' : '☀️'}</p>
                <p className="text-lg font-semibold text-yellow-400">{telemetry.zone2b.lux} lux</p>
              </div>
              <div className="border-t border-slate-700 pt-3 mt-3">
                <p className="text-sm text-slate-400 mb-2">Climate Control</p>
                <p className="text-sm">Fan Speed: <span className="font-semibold text-cyan-400">{telemetry.zone2b.fanSpeed}%</span></p>
                <p className="text-sm">Auto Light: {telemetry.zone2b.autoLightingActive ? '✓ On' : '✗ Off'}</p>
              </div>
            </div>
          </div>

          {/* Zone 3A - Water Management */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-6">
            <h3 className="text-xl font-bold text-white mb-4">Zone 3A - Water Mgmt {telemetry.zone3a.online ? '🟢' : '🔴'}</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-slate-400">Water Level {telemetry.zone3a.waterLevel < 40 ? '⚠️' : '✓'}</p>
                <p className={`text-2xl font-semibold ${telemetry.zone3a.waterLevel < 40 ? 'text-rose-400' : 'text-blue-400'}`}>
                  {telemetry.zone3a.waterLevel}%
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-400">TDS {telemetry.zone3a.tds > 130 ? '⚠️' : '✓'}</p>
                <p className={`text-2xl font-semibold ${telemetry.zone3a.tds > 130 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {telemetry.zone3a.tds} ppm
                </p>
              </div>
              <div className="border-t border-slate-700 pt-3 mt-3">
                <p className="text-sm text-slate-400 mb-2">Pump & Valve</p>
                <p className="text-sm">Pump: {telemetry.zone3a.pumpActive ? '💧 Active' : 'Off'} ({telemetry.zone3a.pumpSpeed}%)</p>
                <p className="text-sm">Valve: {telemetry.zone3a.valveOpen ? '🔓 Open' : '🔒 Closed'}</p>
              </div>
              {telemetry.zone3a.waterLevel < 40 && (
                <div className="p-3 bg-rose-500/20 border border-rose-500/50 rounded text-rose-300 text-sm mt-3">
                  ⚠️ Auto-pump: Water {telemetry.zone3a.waterLevel}%
                </div>
              )}
            </div>
          </div>

          {/* Zone 3B - Water Safety */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-6">
            <h3 className="text-xl font-bold text-white mb-4">Zone 3B - Safety {telemetry.zone3b.online ? '🟢' : '🔴'}</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-slate-400">Water Temperature</p>
                <p className="text-2xl font-semibold text-cyan-400">{telemetry.zone3b.waterTemperature.toFixed(1)}°C</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Water Present</p>
                <p className={`text-lg font-semibold ${telemetry.zone3b.waterPresent ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {telemetry.zone3b.waterPresent ? '✓ Yes' : '✗ No'}
                </p>
              </div>
              <div className="border-t border-slate-700 pt-3 mt-3">
                <p className="text-sm text-slate-400 mb-2">Alerts</p>
                <div className="flex gap-2 text-xs">
                  <span className={`px-2 py-1 rounded ${telemetry.zone3b.alertLed ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-slate-400'}`}>LED: {telemetry.zone3b.alertLed ? 'On' : 'Off'}</span>
                  <span className={`px-2 py-1 rounded ${telemetry.zone3b.buzzerActive ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-400'}`}>Buzzer: {telemetry.zone3b.buzzerActive ? 'On' : 'Off'}</span>
                </div>
              </div>
              {(telemetry.zone3b.alertLed || !telemetry.zone3b.waterPresent) && (
                <div className="p-3 bg-rose-500/20 border border-rose-500/50 rounded text-rose-300 text-sm mt-3">
                  🚨 Safety Alert Active
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center text-sm text-slate-500 py-8 border-t border-slate-800">
          <p>SmartAgri 6-Node Dashboard • Last updated: {new Date(telemetry.system.lastUpdated).toLocaleTimeString()}</p>
        </footer>
      </div>
    </div>
  );
}
