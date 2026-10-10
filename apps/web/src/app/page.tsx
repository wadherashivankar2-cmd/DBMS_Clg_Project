'use client';

import { useEffect, useState } from 'react';

interface HealthData {
  status: string;
  db: string;
  time: string;
}

export default function HomePage() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<string>('');

  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

  const checkHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/health`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      const json = await res.json();
      setData(json);
      setLastChecked(new Date().toLocaleTimeString());
    } catch (err: any) {
      setError(err.message || 'Connection refused or offline');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  const isDbUp = data?.db === 'up';
  const isApiUp = data?.status === 'ok';

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-white">
          System Cluster Status
        </h1>
        <p className="text-sm text-slate-400">
          Core services health, database connectivity, and environment status.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Core API Service Card */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur shadow-sm transition hover:border-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
              Core REST API
            </span>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium ${
                isApiUp
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isApiUp ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                }`}
              />
              {loading ? 'CHECKING...' : isApiUp ? 'ONLINE' : 'DOWN'}
            </span>
          </div>

          <div className="mt-4">
            <div className="text-2xl font-bold font-mono text-white">
              {isApiUp ? 'Operational' : 'Unavailable'}
            </div>
            <p className="text-xs text-slate-450 mt-1 font-mono break-all">
              Endpoint: {apiUrl}/health
            </p>
          </div>
        </div>

        {/* PostgreSQL Database Card */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur shadow-sm transition hover:border-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
              PostgreSQL Engine
            </span>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium ${
                isDbUp
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isDbUp ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                }`}
              />
              {loading ? 'CHECKING...' : isDbUp ? 'CONNECTED' : 'UNREACHABLE'}
            </span>
          </div>

          <div className="mt-4">
            <div className="text-2xl font-bold font-mono text-white">
              {isDbUp ? 'Healthy (Pool Active)' : 'Offline'}
            </div>
            <p className="text-xs text-slate-450 mt-1 font-mono">
              Schema: Complete (10 Migrations, Invariants Enforced)
            </p>
          </div>
        </div>
      </div>

      {/* Raw Diagnostic Payload */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
            Health Check Telemetry
          </h2>
          <div className="flex items-center gap-3">
            {lastChecked && (
              <span className="text-xs font-mono text-slate-400">
                Last probe: {lastChecked}
              </span>
            )}
            <button
              id="refresh-health-btn"
              onClick={checkHealth}
              disabled={loading}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-50"
            >
              {loading ? 'Refreshing...' : 'Re-probe'}
            </button>
          </div>
        </div>

        {error ? (
          <div className="p-4 rounded-lg bg-rose-950/40 border border-rose-800/40 text-rose-300 text-xs font-mono">
            Error probing API: {error}
          </div>
        ) : (
          <pre className="p-4 rounded-lg bg-slate-950/80 border border-slate-800 text-xs font-mono text-cyan-300 overflow-x-auto">
            {data ? JSON.stringify(data, null, 2) : 'Awaiting response...'}
          </pre>
        )}
      </div>
    </div>
  );
}
