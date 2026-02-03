import React from 'react';
import { X, Globe, Lock, ShieldCheck, Plus, Trash2, List } from 'lucide-react';
import { AppSettings, KeyValue } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSave }) => {
  if (!isOpen) return null;

  const handleChange = (field: keyof AppSettings, value: any) => {
    onSave({ ...settings, [field]: value });
  };

  const updateGlobalHeader = (id: string, field: 'key' | 'value' | 'enabled', value: any) => {
    const list = settings.globalHeaders.map(item => item.id === id ? { ...item, [field]: value } : item);
    // Add new empty row if last one is modified
    const lastItem = list[list.length - 1];
    if (lastItem && (lastItem.key !== '' || lastItem.value !== '')) {
        list.push({ id: Date.now().toString(), key: '', value: '', enabled: true });
    }
    // If list is empty (shouldn't happen with init logic but safety check)
    if (list.length === 0) {
        list.push({ id: Date.now().toString(), key: '', value: '', enabled: true });
    }
    handleChange('globalHeaders', list);
  };

  const removeGlobalHeader = (id: string) => {
    const list = settings.globalHeaders.filter(item => item.id !== id);
    if (list.length === 0) list.push({ id: Date.now().toString(), key: '', value: '', enabled: true });
    handleChange('globalHeaders', list);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl w-[600px] max-w-[90vw] flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-100">Settings</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-8 overflow-y-auto">
          
          {/* Fetch Options */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-indigo-400 font-medium border-b border-zinc-800 pb-2">
                <Globe size={18} />
                <span>Fetch Options</span>
            </div>
            
            <p className="text-xs text-zinc-500 leading-relaxed">
              Configure low-level options passed to the browser's <code>fetch</code> API.
            </p>

            <div className="grid grid-cols-2 gap-4">
                {/* Fetch Mode */}
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-zinc-300">Request Mode</label>
                    <div className="relative">
                        <select
                            value={settings.fetchMode}
                            onChange={(e) => handleChange('fetchMode', e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 focus:border-indigo-500 outline-none appearance-none"
                        >
                            <option value="cors">cors (Default)</option>
                            <option value="no-cors">no-cors</option>
                            <option value="same-origin">same-origin</option>
                        </select>
                    </div>
                </div>

                {/* Credentials */}
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                        Credentials
                        <Lock size={12} className="text-zinc-500" />
                    </label>
                    <div className="relative">
                        <select
                            value={settings.fetchCredentials}
                            onChange={(e) => handleChange('fetchCredentials', e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 focus:border-indigo-500 outline-none appearance-none"
                        >
                            <option value="omit">omit (Default)</option>
                            <option value="same-origin">same-origin</option>
                            <option value="include">include</option>
                        </select>
                    </div>
                </div>
            </div>
            {settings.fetchCredentials === 'include' && (
                <div className="flex items-start gap-2 text-[10px] text-amber-500/80 bg-amber-500/10 p-2 rounded">
                    <ShieldCheck size={12} className="mt-0.5 shrink-0" />
                    <span>
                        <b>include</b>: Sends cookies/Auth headers. Ensure the server returns <code>Access-Control-Allow-Credentials: true</code>.
                    </span>
                </div>
            )}
          </div>

          {/* Global Headers */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-indigo-400 font-medium border-b border-zinc-800 pb-2">
                <List size={18} />
                <span>Global Headers</span>
            </div>
            
            <p className="text-xs text-zinc-500 leading-relaxed">
              These headers will be automatically added to every request. They are visible in the request panel but cannot be edited there.
            </p>

            <div className="flex flex-col gap-2">
                <div className="flex text-xs font-semibold text-zinc-500 px-2 mb-1">
                    <div className="w-8 text-center">On</div>
                    <div className="flex-1">Key</div>
                    <div className="flex-1">Value</div>
                    <div className="w-8"></div>
                </div>
                {settings.globalHeaders.map((item) => (
                  <div key={item.id} className="flex gap-2 group">
                    <div className="w-8 flex items-center justify-center">
                        <input 
                            type="checkbox" 
                            checked={item.enabled} 
                            onChange={(e) => updateGlobalHeader(item.id, 'enabled', e.target.checked)}
                            className="rounded bg-zinc-800 border-zinc-600 text-indigo-500 focus:ring-0 cursor-pointer"
                        />
                    </div>
                    <input
                      type="text"
                      placeholder="Header Key"
                      value={item.key}
                      onChange={(e) => updateGlobalHeader(item.id, 'key', e.target.value)}
                      className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-300 focus:border-indigo-500/50 outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Value"
                      value={item.value}
                      onChange={(e) => updateGlobalHeader(item.id, 'value', e.target.value)}
                      className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-300 focus:border-indigo-500/50 outline-none"
                    />
                    <button
                      onClick={() => removeGlobalHeader(item.id)}
                      className="w-8 flex items-center justify-center text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 flex justify-end">
            <button 
                onClick={onClose}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded transition-colors"
            >
                Done
            </button>
        </div>
      </div>
    </div>
  );
};
