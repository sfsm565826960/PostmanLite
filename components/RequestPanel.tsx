import React, { useState, useEffect } from 'react';
import { Play, Trash2, Lock, FileText, Upload, AlertCircle } from 'lucide-react';
import { RequestState, HttpMethod, KeyValue, FormDataItem } from '../types';
import { HTTP_METHODS } from '../constants';

interface RequestPanelProps {
  request: RequestState;
  onChange: (req: RequestState) => void;
  onSend: () => void;
  loading: boolean;
  globalHeaders: KeyValue[];
}

export const RequestPanel: React.FC<RequestPanelProps> = ({ request, onChange, onSend, loading, globalHeaders }) => {
  const [activeTab, setActiveTab] = useState<'params' | 'headers' | 'body' | 'raw'>('params');

  // Helper to check if method allows body
  const methodHasBody = !['GET', 'HEAD'].includes(request.method);

  const updateField = (field: keyof RequestState, value: any) => {
    onChange({ ...request, [field]: value });
  };

  const handleMethodChange = (method: HttpMethod) => {
      // If switching to GET/HEAD, logically the body is ignored, but we keep the state.
      // We just ensure the UI reflects that body is not sent.
      updateField('method', method);
  };

  const handleBodyTypeChange = (type: RequestState['bodyType']) => {
    let newHeaders = [...request.headers];
    
    // Remove existing Content-Type header to avoid conflicts
    newHeaders = newHeaders.filter(h => h.key.toLowerCase() !== 'content-type');

    if (type === 'json') {
        newHeaders.unshift({ id: Date.now().toString(), key: 'Content-Type', value: 'application/json', enabled: true });
    } else if (type === 'text') {
        newHeaders.unshift({ id: Date.now().toString(), key: 'Content-Type', value: 'text/plain', enabled: true });
    } else if (type === 'x-www-form-urlencoded') {
        newHeaders.unshift({ id: Date.now().toString(), key: 'Content-Type', value: 'application/x-www-form-urlencoded', enabled: true });
    }
    // For 'file' (binary) or 'form-data' (multipart) or 'none', we do NOT set Content-Type manually.
    // Browser handles boundary for multipart.

    onChange({ ...request, bodyType: type, headers: newHeaders });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        updateField('file', e.target.files[0]);
    } else {
        updateField('file', null);
    }
  };

  // --- Key-Value Editors ---

  const updateKeyValue = (
      listName: 'params' | 'headers' | 'bodyFormUrlEncoded', 
      id: string, 
      field: 'key' | 'value' | 'enabled', 
      value: any
  ) => {
    const list = request[listName].map(item => item.id === id ? { ...item, [field]: value } : item);
    const lastItem = list[list.length - 1];
    if (lastItem.key !== '' || lastItem.value !== '') {
        list.push({ id: Date.now().toString(), key: '', value: '', enabled: true });
    }
    updateField(listName, list);
  };

  const removeKeyValue = (listName: 'params' | 'headers' | 'bodyFormUrlEncoded', id: string) => {
    const list = request[listName].filter(item => item.id !== id);
    if (list.length === 0) list.push({ id: Date.now().toString(), key: '', value: '', enabled: true });
    updateField(listName, list);
  };

  // --- Form Data (Multipart) Editor ---

  const updateFormData = (id: string, field: keyof FormDataItem, value: any) => {
      const list = request.bodyFormData.map(item => item.id === id ? { ...item, [field]: value } : item);
      const lastItem = list[list.length - 1];
      if (lastItem.key !== '' || (lastItem.type === 'text' && lastItem.value !== '') || (lastItem.type === 'file' && lastItem.file)) {
          list.push({ id: Date.now().toString(), key: '', value: '', type: 'text', enabled: true });
      }
      updateField('bodyFormData', list);
  };

  const removeFormData = (id: string) => {
      const list = request.bodyFormData.filter(item => item.id !== id);
      if (list.length === 0) list.push({ id: Date.now().toString(), key: '', value: '', type: 'text', enabled: true });
      updateField('bodyFormData', list);
  };

  // --- Render Helpers ---

  const renderRaw = () => {
    const allHeaders = [...request.headers, ...globalHeaders]
        .filter(h => h.enabled && h.key)
        .map(h => `${h.key}: ${h.value}`)
        .join('\n');
    
    let body = '';
    if (!methodHasBody) {
        body = '[No Body for GET/HEAD]';
    } else if (request.bodyType === 'json' || request.bodyType === 'text') {
        body = request.bodyContent;
    } else if (request.bodyType === 'file') {
        body = `[Binary File: ${request.file?.name || 'No file selected'}]`;
    } else if (request.bodyType === 'form-data') {
        body = request.bodyFormData.filter(i => i.enabled && i.key).map(i => 
            `${i.key}: ${i.type === 'file' ? (i.file?.name || '(Empty File)') : i.value}`
        ).join('\n');
    } else if (request.bodyType === 'x-www-form-urlencoded') {
        body = request.bodyFormUrlEncoded.filter(i => i.enabled && i.key)
            .map(i => `${i.key}=${i.value}`).join('&');
    }

    const rawString = `${request.method} ${request.url.replace(/^https?:\/\/[^\/]+/, '') || '/'} HTTP/1.1\nHost: ${request.url.split('/')[2] || '...'}\n${allHeaders}\n\n${body}`;

    return (
        <pre className="text-xs font-mono text-zinc-400 whitespace-pre-wrap break-all leading-relaxed p-2">
            {rawString}
        </pre>
    );
  };

  const renderKeyValueEditor = (
      data: KeyValue[], 
      listName: 'params' | 'headers' | 'bodyFormUrlEncoded',
      placeholderKey = "Key",
      placeholderValue = "Value"
  ) => (
    <div className="flex flex-col gap-2">
        <div className="flex text-xs font-semibold text-zinc-500 px-2 mb-1">
            <div className="w-8 text-center">On</div>
            <div className="flex-1">{placeholderKey}</div>
            <div className="flex-1">{placeholderValue}</div>
            <div className="w-8"></div>
        </div>
        {data.map((item) => (
            <div key={item.id} className="flex gap-2 group">
            <div className="w-8 flex items-center justify-center">
                <input 
                    type="checkbox" 
                    checked={item.enabled} 
                    onChange={(e) => updateKeyValue(listName, item.id, 'enabled', e.target.checked)}
                    className="rounded bg-zinc-800 border-zinc-600 text-indigo-500 focus:ring-0 cursor-pointer"
                />
            </div>
            <input
                type="text"
                placeholder={placeholderKey}
                value={item.key}
                onChange={(e) => updateKeyValue(listName, item.id, 'key', e.target.value)}
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-sm text-zinc-300 focus:border-indigo-500/50 outline-none"
            />
            <input
                type="text"
                placeholder={placeholderValue}
                value={item.value}
                onChange={(e) => updateKeyValue(listName, item.id, 'value', e.target.value)}
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-sm text-zinc-300 focus:border-indigo-500/50 outline-none"
            />
            <button
                onClick={() => removeKeyValue(listName, item.id)}
                className="w-8 flex items-center justify-center text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
            >
                <Trash2 size={14} />
            </button>
            </div>
        ))}
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-zinc-900">
      {/* Top Bar: URL & Method */}
      <div className="p-4 border-b border-zinc-800 flex gap-2 items-center">
        <select 
          value={request.method}
          onChange={(e) => handleMethodChange(e.target.value as HttpMethod)}
          className="bg-zinc-800 text-zinc-100 font-bold text-sm rounded px-3 py-2.5 border border-zinc-700 outline-none focus:border-indigo-500 cursor-pointer"
        >
          {HTTP_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        
        <div className="flex-1 relative">
            <input
            type="text"
            value={request.url}
            onChange={(e) => updateField('url', e.target.value)}
            placeholder="https://api.example.com/v1/resource"
            className="w-full bg-zinc-950 text-zinc-100 rounded px-4 py-2.5 border border-zinc-700 outline-none focus:border-indigo-500 font-mono text-sm"
            onKeyDown={(e) => e.key === 'Enter' && onSend()}
            />
        </div>

        <button
          onClick={onSend}
          disabled={loading || !request.url}
          className={`flex items-center gap-2 px-6 py-2.5 rounded font-bold text-sm transition-all shadow-lg shadow-indigo-500/10 ${loading || !request.url ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}
        >
          {loading ? (
             <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
          ) : (
             <Play size={16} fill="currentColor" />
          )}
          Send
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 px-2 bg-zinc-900">
        {(['params', 'headers', 'body', 'raw'] as const).map(tab => (
            <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm border-b-2 transition-colors capitalize ${activeTab === tab ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-zinc-400 hover:text-zinc-200'}`}
            >
                {tab} 
                {tab === 'params' && request.params.filter(p => p.enabled && p.key).length > 0 && <span className="ml-1 text-[10px] bg-zinc-800 px-1.5 rounded-full text-zinc-300">{request.params.filter(p => p.enabled && p.key).length}</span>}
                {tab === 'headers' && (request.headers.filter(p => p.enabled && p.key).length + globalHeaders.filter(h => h.enabled && h.key).length) > 0 && <span className="ml-1 text-[10px] bg-zinc-800 px-1.5 rounded-full text-zinc-300">{request.headers.filter(p => p.enabled && p.key).length + globalHeaders.filter(h => h.enabled && h.key).length}</span>}
                {tab === 'body' && !methodHasBody && <span className="ml-1 text-[10px] bg-zinc-800 text-zinc-500 px-1.5 rounded-full">Off</span>}
            </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-4 bg-zinc-900 relative">
        {activeTab === 'raw' && renderRaw()}

        {activeTab === 'params' && renderKeyValueEditor(request.params, 'params')}
        
        {activeTab === 'headers' && (
          <div className="flex flex-col gap-2">
            {renderKeyValueEditor(request.headers, 'headers')}
            {/* Global Headers Display */}
            {globalHeaders.length > 0 && (
                <>
                    <div className="mt-4 mb-1 text-xs font-bold text-zinc-500 flex items-center gap-2 px-2">
                        <Lock size={10} />
                        Global Headers (Read-only)
                    </div>
                    {globalHeaders.filter(h => h.key || h.value).map(item => (
                        <div key={item.id} className="flex gap-2 opacity-60 pointer-events-none">
                            <div className="w-8 flex items-center justify-center">
                                <input type="checkbox" checked={item.enabled} readOnly className="rounded bg-zinc-800 border-zinc-700 text-zinc-500" />
                            </div>
                            <input type="text" value={item.key} readOnly className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-3 py-1.5 text-sm text-zinc-400 italic" />
                            <input type="text" value={item.value} readOnly className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-3 py-1.5 text-sm text-zinc-400 italic" />
                            <div className="w-8 flex items-center justify-center text-zinc-700"><Lock size={12} /></div>
                        </div>
                    ))}
                </>
            )}
          </div>
        )}

        {activeTab === 'body' && (
          <div className="h-full flex flex-col">
            
            {!methodHasBody && (
                <div className="bg-zinc-800/50 border border-zinc-700 rounded p-4 mb-4 flex items-center gap-3 text-amber-500">
                    <AlertCircle size={20} />
                    <span className="text-sm">
                        "{request.method}" requests usually do not have a body. Options are disabled.
                    </span>
                </div>
            )}

            <div className={`flex flex-col h-full ${!methodHasBody ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                <div className="flex flex-wrap items-center gap-4 mb-4 border-b border-zinc-800 pb-2">
                    {[
                        { id: 'none', label: 'None' },
                        { id: 'form-data', label: 'Form Data' },
                        { id: 'x-www-form-urlencoded', label: 'x-www-form-urlencoded' },
                        { id: 'json', label: 'JSON' },
                        { id: 'text', label: 'Raw Text' },
                        { id: 'file', label: 'Binary File' },
                    ].map((type) => (
                        <label key={type.id} className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer hover:text-zinc-200">
                            <input 
                                type="radio" 
                                name="bodyType" 
                                checked={request.bodyType === type.id} 
                                onChange={() => handleBodyTypeChange(type.id as RequestState['bodyType'])}
                                className="text-indigo-500 focus:ring-0 bg-zinc-800 border-zinc-600"
                            />
                            {type.label}
                        </label>
                    ))}
                </div>

                {/* JSON / Text Editor */}
                {(request.bodyType === 'json' || request.bodyType === 'text') && (
                    <div className="flex-1 relative flex flex-col gap-2">
                        <textarea
                            value={request.bodyContent}
                            onChange={(e) => updateField('bodyContent', e.target.value)}
                            className="flex-1 w-full bg-zinc-950 border border-zinc-800 rounded p-4 font-mono text-sm text-zinc-300 focus:border-indigo-500/50 outline-none resize-none leading-relaxed"
                            placeholder={request.bodyType === 'json' ? '{\n  "key": "value"\n}' : 'Enter text body...'}
                        />
                    </div>
                )}

                {/* Form Data Editor */}
                {request.bodyType === 'form-data' && (
                    <div className="flex flex-col gap-2">
                        <div className="flex text-xs font-semibold text-zinc-500 px-2 mb-1">
                            <div className="w-8 text-center">On</div>
                            <div className="flex-1">Key</div>
                            <div className="w-24">Type</div>
                            <div className="flex-1">Value</div>
                            <div className="w-8"></div>
                        </div>
                        {request.bodyFormData.map((item) => (
                            <div key={item.id} className="flex gap-2 group">
                                <div className="w-8 flex items-center justify-center">
                                    <input 
                                        type="checkbox" 
                                        checked={item.enabled} 
                                        onChange={(e) => updateFormData(item.id, 'enabled', e.target.checked)}
                                        className="rounded bg-zinc-800 border-zinc-600 text-indigo-500 focus:ring-0 cursor-pointer"
                                    />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Key"
                                    value={item.key}
                                    onChange={(e) => updateFormData(item.id, 'key', e.target.value)}
                                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-sm text-zinc-300 focus:border-indigo-500/50 outline-none"
                                />
                                <select
                                    value={item.type}
                                    onChange={(e) => updateFormData(item.id, 'type', e.target.value)}
                                    className="w-24 bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-300 focus:border-indigo-500/50 outline-none"
                                >
                                    <option value="text">Text</option>
                                    <option value="file">File</option>
                                </select>

                                {item.type === 'file' ? (
                                    <div className="flex-1 flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded px-2 overflow-hidden">
                                        <input 
                                            type="file" 
                                            onChange={(e) => updateFormData(item.id, 'file', e.target.files?.[0])}
                                            className="text-xs text-zinc-400 py-1 file:mr-2 file:py-0.5 file:px-2 file:rounded file:border-0 file:text-xs file:bg-zinc-800 file:text-zinc-300 hover:file:bg-zinc-700"
                                        />
                                    </div>
                                ) : (
                                    <input
                                        type="text"
                                        placeholder="Value"
                                        value={item.value}
                                        onChange={(e) => updateFormData(item.id, 'value', e.target.value)}
                                        className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-sm text-zinc-300 focus:border-indigo-500/50 outline-none"
                                    />
                                )}
                                <button
                                    onClick={() => removeFormData(item.id)}
                                    className="w-8 flex items-center justify-center text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* x-www-form-urlencoded Editor */}
                {request.bodyType === 'x-www-form-urlencoded' && renderKeyValueEditor(request.bodyFormUrlEncoded, 'bodyFormUrlEncoded')}

                {/* Binary File Upload UI */}
                {request.bodyType === 'file' && (
                    <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-lg p-8 bg-zinc-950/50">
                        <div className="flex flex-col items-center gap-4">
                            <div className="p-4 bg-zinc-900 rounded-full">
                                <Upload size={24} className="text-zinc-400" />
                            </div>
                            <div className="text-center">
                                <label className="cursor-pointer">
                                    <span className="text-indigo-400 hover:text-indigo-300 font-medium">Click to upload</span>
                                    <input type="file" className="hidden" onChange={handleFileChange} />
                                </label>
                                <span className="text-zinc-500 ml-1">or drag and drop</span>
                            </div>
                            {request.file ? (
                                <div className="flex items-center gap-2 bg-zinc-800 px-4 py-2 rounded text-sm text-zinc-200">
                                    <FileText size={14} />
                                    {request.file.name}
                                    <span className="text-zinc-500 text-xs">({(request.file.size / 1024).toFixed(1)} KB)</span>
                                </div>
                            ) : (
                                <p className="text-xs text-zinc-500">No file selected</p>
                            )}
                        </div>
                    </div>
                )}

                {request.bodyType === 'none' && (
                    <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm italic">
                        This request has no body
                    </div>
                )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
