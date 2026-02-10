import React, { useState } from 'react';
import { Play, Trash2, Lock, Upload, AlertCircle, Braces, Waves, Square, Key, FileText } from 'lucide-react';
import { RequestState, HttpMethod, KeyValue, FormDataItem, AppSettings } from '../types';
import { HTTP_METHODS } from '../constants';

interface RequestPanelProps {
  request: RequestState;
  onChange: (req: RequestState) => void;
  onSend: () => void;
  onStop: () => void;
  loading: boolean;
  settings: AppSettings;
  injectedHeaders: Record<string, string> | null;
}

export const RequestPanel: React.FC<RequestPanelProps> = ({ request, onChange, onSend, onStop, loading, settings, injectedHeaders }) => {
  const [activeTab, setActiveTab] = useState<'params' | 'headers' | 'body' | 'raw'>('params');
  const globalHeaders = settings.globalHeaders;

  // Cloud Docs Headers (Computed for display)
  const getCloudDocsHeaders = () => {
    if (!settings.cloudDocsMode || !settings.cloudDocsAppId) return [];
    
    // If we have actual values injected during a request, use them
    if (injectedHeaders) {
        return [
            { key: 'x-appid', value: injectedHeaders['x-appid'] },
            { key: 'x-request-ts', value: injectedHeaders['x-request-ts'] },
            { key: 'x-nonce', value: injectedHeaders['x-nonce'] },
            { key: 'x-auth-type', value: injectedHeaders['x-auth-type'] },
            { key: 'x-auth-value', value: injectedHeaders['x-auth-value'] },
            { key: 'x-sign', value: injectedHeaders['x-sign'] },
        ];
    }

    // Simple cookie getter for display placeholder
    const getCookieDisplay = (name: string) => {
        try {
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${name}=`);
            if (parts.length === 2) return parts.pop()?.split(';').shift() || '';
        } catch { return ''; }
        return '';
    };

    // Default placeholders if no request sent yet
    return [
        { key: 'x-appid', value: settings.cloudDocsAppId },
        { key: 'x-request-ts', value: '(Current Timestamp)' },
        { key: 'x-nonce', value: '(Auto-generated)' },
        { key: 'x-auth-type', value: '2' },
        { key: 'x-auth-value', value: getCookieDisplay('CAS_SSO_COOKIE') || '(Missing Cookie)' },
        { key: 'x-sign', value: '(HMAC-SHA256 Signature)' },
    ];
  };

  const cloudDocsHeaders = getCloudDocsHeaders();

  // Helper to check if method allows body
  const methodHasBody = !['GET', 'HEAD'].includes(request.method);

  const updateField = (field: keyof RequestState, value: any) => {
    onChange({ ...request, [field]: value });
  };

  const handleMethodChange = (method: HttpMethod) => {
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
    
    // Ensure there is still an empty row at the end if we manipulated the array
    const lastItem = newHeaders[newHeaders.length - 1];
    if (!lastItem || lastItem.key !== '' || lastItem.value !== '') {
        newHeaders.push({ id: Date.now().toString() + 'empty', key: '', value: '', enabled: true });
    }

    onChange({ ...request, bodyType: type, headers: newHeaders });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        updateField('file', e.target.files[0]);
    } else {
        updateField('file', null);
    }
  };

  const formatJSON = () => {
    if (!request.bodyContent) return;
    try {
        const parsed = JSON.parse(request.bodyContent);
        const formatted = JSON.stringify(parsed, null, 2);
        updateField('bodyContent', formatted);
    } catch (e) {
        console.error("Invalid JSON content");
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
    const manualHeaders = request.headers.filter(h => h.enabled && h.key);
    const globalHeaderList = globalHeaders.filter(h => h.enabled && h.key);
    
    // Combine for display
    let allHeadersDisplay = [
        ...manualHeaders.map(h => `${h.key}: ${h.value}`),
        ...globalHeaderList.map(h => `${h.key}: ${h.value}`)
    ];

    if (settings.cloudDocsMode) {
        allHeadersDisplay = [
            ...allHeadersDisplay,
            ...cloudDocsHeaders.map(h => `${h.key}: ${h.value}`)
        ];
    }

    const headersString = allHeadersDisplay.join('\n');
    
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

    const rawString = `${request.method} ${request.url.replace(/^https?:\/\/[^\/]+/, '') || '/'} HTTP/1.1\nHost: ${request.url.split('/')[2] || '...'}\n${headersString}\n\n${body}`;

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

        {/* Stream Toggle */}
        <button
            onClick={() => updateField('stream', !request.stream)}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded border text-xs font-medium transition-all ${request.stream 
                ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400' 
                : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:text-zinc-300'}`}
            title="Toggle Stream Mode (Server-Sent Events / Chunked Transfer)"
        >
            <Waves size={16} />
            <span className="hidden sm:inline">Stream</span>
        </button>

        {loading ? (
             <button
                onClick={onStop}
                className="flex items-center gap-2 px-6 py-2.5 rounded font-bold text-sm transition-all shadow-lg bg-red-600 hover:bg-red-500 text-white"
             >
                <Square size={16} fill="currentColor" />
                Stop
             </button>
        ) : (
            <button
                onClick={onSend}
                disabled={!request.url}
                className={`flex items-center gap-2 px-6 py-2.5 rounded font-bold text-sm transition-all shadow-lg shadow-indigo-500/10 ${!request.url ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}
            >
                <Play size={16} fill="currentColor" />
                Send
            </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 px-2 bg-zinc-900">
        {(['params', 'headers', 'body', 'raw'] as const).map(tab => {
            // Count headers
            let headerCount = request.headers.filter(p => p.enabled && p.key).length + globalHeaders.filter(h => h.enabled && h.key).length;
            if (settings.cloudDocsMode) {
                headerCount += 6; // Fixed number of cloud docs headers
            }

            return (
            <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm border-b-2 transition-colors capitalize ${activeTab === tab ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-zinc-400 hover:text-zinc-200'}`}
            >
                {tab} 
                {tab === 'params' && request.params.filter(p => p.enabled && p.key).length > 0 && <span className="ml-1 text-[10px] bg-zinc-800 px-1.5 rounded-full text-zinc-300">{request.params.filter(p => p.enabled && p.key).length}</span>}
                {tab === 'headers' && headerCount > 0 && <span className="ml-1 text-[10px] bg-zinc-800 px-1.5 rounded-full text-zinc-300">{headerCount}</span>}
                {tab === 'body' && !methodHasBody && <span className="ml-1 text-[10px] bg-zinc-800 text-zinc-500 px-1.5 rounded-full">Off</span>}
            </button>
        )})}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-4 bg-zinc-900 relative">
        {activeTab === 'raw' && renderRaw()}

        {activeTab === 'params' && renderKeyValueEditor(request.params, 'params')}
        
        {activeTab === 'headers' && (
          <div className="flex flex-col gap-2">
            {renderKeyValueEditor(request.headers, 'headers')}
            
            {/* Cloud Docs Headers Display */}
            {settings.cloudDocsMode && (
                <>
                    <div className="mt-4 mb-1 text-xs font-bold text-indigo-400 flex items-center gap-2 px-2">
                        <Key size={10} />
                        Cloud Docs Headers (Auto-Injected)
                    </div>
                    {cloudDocsHeaders.map((item, idx) => (
                        <div key={`cd-${idx}`} className="flex gap-2 opacity-80 pointer-events-none">
                            <div className="w-8 flex items-center justify-center">
                                <input type="checkbox" checked readOnly className="rounded bg-zinc-800 border-indigo-900/50 text-indigo-500" />
                            </div>
                            <input type="text" value={item.key} readOnly className="flex-1 bg-zinc-900/50 border border-indigo-900/30 rounded px-3 py-1.5 text-sm text-indigo-300 font-medium" />
                            <input type="text" value={item.value} readOnly className="flex-1 bg-zinc-900/50 border border-indigo-900/30 rounded px-3 py-1.5 text-sm text-indigo-300 font-mono" />
                            <div className="w-8 flex items-center justify-center text-indigo-500"><Lock size={12} /></div>
                        </div>
                    ))}
                </>
            )}

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
                         {request.bodyType === 'json' && (
                             <button
                                onClick={formatJSON}
                                className="absolute top-3 right-3 z-10 p-1.5 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-indigo-400 rounded backdrop-blur-sm border border-zinc-700 transition-all text-xs font-medium flex items-center gap-1.5"
                                title="Format JSON"
                             >
                                <Braces size={14} />
                                <span>Beautify</span>
                             </button>
                        )}
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
