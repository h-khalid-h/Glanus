import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Settings as SettingsIcon, Save, RotateCcw } from 'lucide-react';

interface AgentConfig {
  agent: {
    version: string;
    workspace_id: string | null;
    pre_auth_token: string | null;
    registered: boolean;
  };
  server: {
    api_url: string;
    heartbeat_interval: number;
  };
  monitoring: {
    enabled: boolean;
    interval: number;
    include_processes: boolean;
    max_processes: number;
  };
  inventory: {
    enabled: boolean;
    sync_interval: number;
  };
  discovery: {
    enabled: boolean;
    subnet: string | null;
    scan_interval: number;
  };
  remote: {
    enabled: boolean;
  };
  updates: {
    enabled: boolean;
    check_interval: number;
    auto_install: boolean;
  };
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm text-slate-300">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-nerve' : 'bg-slate-600'}`}
      >
        <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </label>
  );
}

function NumberInput({ value, onChange, label, suffix }: { value: number; onChange: (v: number) => void; label: string; suffix?: string }) {
  return (
    <label className="flex items-center justify-between gap-4">
      <span className="text-sm text-slate-300">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-24 bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm text-right focus:outline-none focus:border-nerve focus:ring-1 focus:ring-nerve"
        />
        {suffix && <span className="text-xs text-slate-500 w-8">{suffix}</span>}
      </div>
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{title}</h3>
      <div className="card !p-4 space-y-3">
        {children}
      </div>
    </div>
  );
}

export default function Settings() {
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const conf = await invoke<AgentConfig>('get_config');
      setConfig(conf);
    } catch (err) {
      console.error('Failed to load config:', err);
    }
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await invoke('update_config', { newConfig: config });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save config:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    loadConfig();
  };

  const update = <K extends keyof AgentConfig>(section: K, field: string, value: unknown) => {
    if (!config) return;
    setConfig({
      ...config,
      [section]: { ...config[section], [field]: value },
    });
    setSaved(false);
  };

  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-slate-400 text-sm">Loading configuration...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-nerve/20 rounded-lg">
              <SettingsIcon className="text-nerve" size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Agent Settings</h1>
              <p className="text-xs text-slate-400">v{config.agent.version}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleReset} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/50 transition-colors" title="Reset">
              <RotateCcw size={16} />
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary flex items-center gap-2 px-4 py-2 text-sm"
            >
              <Save size={14} />
              {saving ? 'Saving...' : saved ? 'Saved!' : 'Save'}
            </button>
          </div>
        </div>

        <Section title="Server">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-300">API URL</span>
            <input
              type="text"
              value={config.server.api_url}
              onChange={(e) => update('server', 'api_url', e.target.value)}
              className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-nerve focus:ring-1 focus:ring-nerve"
            />
          </label>
          <NumberInput label="Heartbeat interval" value={config.server.heartbeat_interval} onChange={(v) => update('server', 'heartbeat_interval', v)} suffix="sec" />
        </Section>

        <Section title="Monitoring">
          <Toggle label="Enable monitoring" checked={config.monitoring.enabled} onChange={(v) => update('monitoring', 'enabled', v)} />
          <NumberInput label="Collection interval" value={config.monitoring.interval} onChange={(v) => update('monitoring', 'interval', v)} suffix="sec" />
          <Toggle label="Include processes" checked={config.monitoring.include_processes} onChange={(v) => update('monitoring', 'include_processes', v)} />
          <NumberInput label="Max processes" value={config.monitoring.max_processes} onChange={(v) => update('monitoring', 'max_processes', v)} />
        </Section>

        <Section title="Software Inventory">
          <Toggle label="Enable inventory sync" checked={config.inventory.enabled} onChange={(v) => update('inventory', 'enabled', v)} />
          <NumberInput label="Sync interval" value={config.inventory.sync_interval} onChange={(v) => update('inventory', 'sync_interval', v)} suffix="sec" />
        </Section>

        <Section title="Network Discovery">
          <Toggle label="Enable discovery" checked={config.discovery.enabled} onChange={(v) => update('discovery', 'enabled', v)} />
          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-300">Subnet</span>
            <input
              type="text"
              value={config.discovery.subnet || ''}
              onChange={(e) => update('discovery', 'subnet', e.target.value || null)}
              placeholder="e.g. 192.168.1.0/24"
              className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-nerve focus:ring-1 focus:ring-nerve placeholder:text-slate-600"
            />
          </label>
          <NumberInput label="Scan interval" value={config.discovery.scan_interval} onChange={(v) => update('discovery', 'scan_interval', v)} suffix="sec" />
        </Section>

        <Section title="Remote Access">
          <Toggle label="Enable remote desktop" checked={config.remote.enabled} onChange={(v) => update('remote', 'enabled', v)} />
        </Section>

        <Section title="Updates">
          <Toggle label="Enable auto-update checks" checked={config.updates.enabled} onChange={(v) => update('updates', 'enabled', v)} />
          <NumberInput label="Check interval" value={config.updates.check_interval} onChange={(v) => update('updates', 'check_interval', v)} suffix="sec" />
          <Toggle label="Auto-install updates" checked={config.updates.auto_install} onChange={(v) => update('updates', 'auto_install', v)} />
        </Section>
      </div>
    </div>
  );
}
