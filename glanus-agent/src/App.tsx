import { useState, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Activity, ShieldCheck, Cpu, HardDrive, Network } from 'lucide-react';
import { WebRTCManager } from './WebRTCManager';
import Settings from './Settings';

interface SystemMetrics {
  cpu_usage: number;
  ram_usage: number;
  disk_usage: number;
  ram_used_gb: number;
  ram_total_gb: number;
  network_up_kbps: number;
  network_down_kbps: number;
}

interface AgentConfig {
  agent: {
    version: string;
    workspace_id: string;
    registered: boolean;
  };
  server: {
    api_url: string;
    heartbeat_interval: number;
  };
  remote?: {
    enabled: boolean;
  };
}

export default function App() {
  const view = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('view') || 'main';
  }, []);

  // Route to settings view if requested
  if (view === 'settings') {
    return <Settings />;
  }

  return <MainView />;
}

function MainView() {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [assetId, setAssetId] = useState('');
  const [error, setError] = useState('');
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  useEffect(() => {
    if (config?.agent.registered) {
      const interval = setInterval(fetchMetrics, 2000);
      fetchMetrics();
      return () => clearInterval(interval);
    }
  }, [config?.agent.registered]);

  const fetchConfig = async () => {
    try {
      const isReg = await invoke<boolean>('is_registered');
      const conf = await invoke<AgentConfig>('get_config');

      // Override the registered flag with the live check
      conf.agent.registered = isReg;
      setConfig(conf);
    } catch (err) {
      console.error('Failed to get config:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetrics = async () => {
    try {
      const data = await invoke<SystemMetrics>('get_metrics');
      setMetrics(data);
    } catch (err) {
      console.error('Failed to get metrics', err);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!assetId.trim()) {
      setError('Asset ID is required');
      return;
    }

    setLoading(true);
    try {
      await invoke('register_agent', { assetId: assetId.trim() });
      await fetchConfig(); // Refresh state post-registration
    } catch (err) {
      setError(String(err));
      setLoading(false);
    }
  };

  if (loading && !config?.agent.registered && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin text-nerve"><Activity size={32} /></div>
      </div>
    );
  }

  const isRegistered = config?.agent.registered;

  return (
    <div className="min-h-screen bg-background p-6">
      {!isRegistered ? (
        <div className="max-w-md mx-auto mt-12 card animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col items-center mb-6">
            <div className="p-3 bg-nerve/20 rounded-full mb-4 ring-8 ring-nerve/5">
              <ShieldCheck className="text-nerve" size={32} />
            </div>
            <h1 className="text-2xl font-bold text-center">Register Agent</h1>
            <p className="text-sm text-slate-400 mt-2 text-center leading-relaxed">
              Link this machine to your Glanus Workspace to enable unified monitoring and remote execution.
            </p>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Asset ID
              </label>
              <input
                type="text"
                value={assetId}
                onChange={(e) => setAssetId(e.target.value)}
                placeholder="ast_..."
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-nerve focus:ring-1 focus:ring-nerve"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400 flex items-start gap-2">
                <span className="font-bold shrink-0">!</span> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary flex justify-center py-2.5 mt-2"
            >
              {loading ? 'Registering...' : 'Securely Register Device'}
            </button>
          </form>
        </div>
      ) : (
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex justify-between items-center bg-slate-800/30 p-4 rounded-xl border border-slate-700/50 shadow-inner">
            <div className="flex items-center gap-4">
              <div className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </div>
              <div>
                <h2 className="font-semibold text-lg text-white">Agent Online</h2>
                <p className="text-xs text-slate-400">Node telemetry securely bound to Glanus RMM</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium text-slate-300">v{config?.agent.version || "0.1.0"}</div>
              <div className="text-xs text-nerve mt-0.5 tracking-wide">
                WS: {config?.agent.workspace_id || 'LOCAL_RUNTIME'}
              </div>
            </div>
          </div>

          {metrics ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-700">
              <div className="card !p-4 flex flex-col items-center justify-center text-center">
                <Cpu className="text-nerve mb-3" size={28} />
                <div className="text-2xl font-bold font-mono">{metrics.cpu_usage.toFixed(1)}%</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">Processor</div>
              </div>
              <div className="card !p-4 flex flex-col items-center justify-center text-center">
                <Activity className="text-emerald-500 mb-3" size={28} />
                <div className="text-2xl font-bold font-mono">{metrics.ram_usage.toFixed(1)}%</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">Memory</div>
              </div>
              <div className="card !p-4 flex flex-col items-center justify-center text-center">
                <HardDrive className="text-amber-500 mb-3" size={28} />
                <div className="text-2xl font-bold font-mono">{metrics.disk_usage.toFixed(1)}%</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">Storage</div>
              </div>
              <div className="card !p-4 flex flex-col items-center justify-center text-center">
                <Network className="text-indigo-500 mb-3" size={28} />
                <div className="text-2xl font-bold font-mono">{Math.round(metrics.network_up_kbps)}</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">Uplink (KB/s)</div>
              </div>
            </div>
          ) : (
            <div className="h-40 flex flex-col items-center justify-center gap-3 animate-pulse bg-slate-800/20 border border-slate-700/30 rounded-xl">
              <Activity className="text-slate-500" />
              <p className="text-sm text-slate-400">Sampling local hardware telemetry...</p>
            </div>
          )}

          {config.remote?.enabled !== false && (
            <WebRTCManager apiUrl={config.server.api_url} />
          )}
        </div>
      )}
    </div>
  );
}
