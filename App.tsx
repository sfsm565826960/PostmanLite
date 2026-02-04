import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { RequestPanel } from './components/RequestPanel';
import { ResponsePanel } from './components/ResponsePanel';
import { SettingsModal } from './components/SettingsModal';
import { RequestState, ResponseState, HistoryItem, AppSettings } from './types';
import { INITIAL_REQUEST } from './constants';
import { Menu, Zap, Settings } from 'lucide-react';

const DEFAULT_SETTINGS: AppSettings = {
    fetchMode: 'cors',
    fetchCredentials: 'omit',
    globalHeaders: [{ id: '1', key: '', value: '', enabled: true }],
    cloudDocsMode: false,
    cloudDocsAppId: '',
    cloudDocsSecureKey: ''
};

// --- Helpers ---

function getCookie(name: string): string {
  try {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift() || '';
  } catch (e) {
      console.warn('Cannot read cookies', e);
  }
  return '';
}

async function hmacSha256(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const keyData = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    keyData,
    enc.encode(message)
  );
  // Convert buffer to hex string
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const App: React.FC = () => {
  const [request, setRequest] = useState<RequestState>(INITIAL_REQUEST);
  const [response, setResponse] = useState<ResponseState | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [injectedHeaders, setInjectedHeaders] = useState<Record<string, string> | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Load history
    const savedHistory = localStorage.getItem('postman_lite_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }

    // Load settings
    const savedSettings = localStorage.getItem('postman_lite_settings');
    if (savedSettings) {
        try {
            // Merge with default to handle schema migrations
            const parsed = JSON.parse(savedSettings);
            setSettings({ 
                ...DEFAULT_SETTINGS, 
                ...parsed,
                // Ensure globalHeaders exists if it wasn't in previous version
                globalHeaders: parsed.globalHeaders || DEFAULT_SETTINGS.globalHeaders 
            });
        } catch(e) {
            console.error("Failed to parse settings", e);
        }
    }
  }, []);

  const handleSaveSettings = (newSettings: AppSettings) => {
      setSettings(newSettings);
      localStorage.setItem('postman_lite_settings', JSON.stringify(newSettings));
  };

  const addToHistory = (req: RequestState) => {
    // For history, we don't store the File objects (Binary or inside FormData) as they are not serializable
    const newItem: HistoryItem = { 
        ...req, 
        file: null, // Clear binary file
        // Deep clone form data but remove file objects
        bodyFormData: req.bodyFormData.map(item => ({...item, file: undefined})),
        id: Date.now().toString(), 
        timestamp: Date.now(),
        pinned: false
    };
    const newHistory = [newItem, ...history].slice(0, 50); // Keep last 50
    setHistory(newHistory);
    localStorage.setItem('postman_lite_history', JSON.stringify(newHistory));
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('postman_lite_history');
  };

  const handleTogglePinHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newHistory = history.map(item => item.id === id ? { ...item, pinned: !item.pinned } : item);
    setHistory(newHistory);
    localStorage.setItem('postman_lite_history', JSON.stringify(newHistory));
  };

  const handleDeleteHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newHistory = history.filter(item => item.id !== id);
    setHistory(newHistory);
    localStorage.setItem('postman_lite_history', JSON.stringify(newHistory));
  };

  const handleSelectHistory = (item: HistoryItem) => {
    // Restore the request state
    const { timestamp, pinned, ...reqState } = item;
    // Ensure arrays exist (migration safety)
    setRequest({ 
        ...reqState, 
        file: null,
        bodyFormData: reqState.bodyFormData || INITIAL_REQUEST.bodyFormData,
        bodyFormUrlEncoded: reqState.bodyFormUrlEncoded || INITIAL_REQUEST.bodyFormUrlEncoded
    }); 
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        setLoading(false);
    }
  };

  const handleSend = async () => {
    // Stop any previous request
    if (loading && abortControllerRef.current) {
        abortControllerRef.current.abort();
    }

    setLoading(true);
    setResponse(null);
    
    // Create new controller
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const startTime = Date.now();

    // Prepare headers (Request Headers + Global Headers)
    const headers: Record<string, string> = {};
    
    // Add Global Headers first 
    settings.globalHeaders.forEach(h => {
        if (h.enabled && h.key) headers[h.key] = h.value;
    });

    // --- Cloud Docs Mode Logic ---
    if (settings.cloudDocsMode && settings.cloudDocsAppId && settings.cloudDocsSecureKey) {
        try {
            const timestamp = Date.now().toString();
            const nonce = timestamp.slice(-6); // Last 6 digits
            const appId = settings.cloudDocsAppId;
            const authType = '1';
            const authValue = getCookie('CAS_SSO_COOKIE');
            
            // Plain text for signing: x-appid + x-nonce + x-request-ts + x-auth-value
            const signStr = appId + nonce + timestamp + authValue;
            const sign = await hmacSha256(settings.cloudDocsSecureKey, signStr);

            const authHeaders = {
                'x-appid': appId,
                'x-request-ts': timestamp,
                'x-nonce': nonce,
                'x-auth-type': authType,
                'x-auth-value': authValue,
                'x-sign': sign
            };

            setInjectedHeaders(authHeaders);
            Object.assign(headers, authHeaders);

            console.log('[Cloud Docs Mode] Injected Headers:', authHeaders);
        } catch (e) {
            console.error('[Cloud Docs Mode] Failed to generate signature', e);
        }
    }

    // Add Request Headers (Request headers override global/cloud headers if specific conflicts exist, 
    // though usually these x- headers are unique)
    request.headers.forEach(h => {
        if (h.enabled && h.key) headers[h.key] = h.value;
    });

    // Prepare URL with Params
    const queryString = request.params
        .filter(p => p.enabled && p.key)
        .map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
        .join('&');
    const finalUrl = queryString ? `${request.url.split('?')[0]}?${queryString}` : request.url;

    // Prepare Body
    let body: any = undefined;
    const hasBody = request.method !== 'GET' && request.method !== 'HEAD' && request.bodyType !== 'none';

    if (hasBody) {
        if (request.bodyType === 'file' && request.file) {
            body = request.file; 
        } 
        else if (request.bodyType === 'form-data') {
            const formData = new FormData();
            request.bodyFormData.forEach(item => {
                if (item.enabled && item.key) {
                    if (item.type === 'file' && item.file) {
                        formData.append(item.key, item.file);
                    } else {
                        formData.append(item.key, item.value);
                    }
                }
            });
            body = formData;
            delete headers['Content-Type'];
            delete headers['content-type'];
        }
        else if (request.bodyType === 'x-www-form-urlencoded') {
            const params = new URLSearchParams();
            request.bodyFormUrlEncoded.forEach(item => {
                if (item.enabled && item.key) {
                    params.append(item.key, item.value);
                }
            });
            body = params;
        }
        else {
            body = request.bodyContent;
        }
    }

    try {
        const fetchOptions: RequestInit = {
            method: request.method,
            headers,
            body,
            mode: settings.fetchMode,
            credentials: settings.fetchCredentials,
            signal: controller.signal,
        };

        // Enable full-duplex streaming if body is present and it's a streamable type
        if (hasBody && (request.stream || request.bodyType === 'file')) {
             // @ts-ignore - TS might not know about duplex yet
             fetchOptions.duplex = 'half'; 
        }

        const res = await fetch(finalUrl, fetchOptions);

        // Initial headers parse
        const resHeaders: Record<string, string> = {};
        res.headers.forEach((val, key) => resHeaders[key] = val);
        const contentType = res.headers.get('content-type') || '';

        // Handle Opaque Response
        if (res.type === 'opaque') {
             setResponse({
                status: 0,
                statusText: 'Opaque',
                headers: {},
                data: "Opaque response received (no-cors mode). No data available.",
                size: '0 KB',
                time: Date.now() - startTime,
                contentType: 'opaque/unknown',
                isError: false
             });
             setLoading(false);
             addToHistory(request);
             return;
        }

        if (request.stream && res.body) {
            // --- STREAMING MODE ---
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let receivedText = '';
            
            // Set initial state without data
            setResponse({
                status: res.status,
                statusText: res.statusText || (res.ok ? 'OK' : 'Error'),
                headers: resHeaders,
                data: '',
                size: '0 KB',
                time: Date.now() - startTime,
                contentType,
                isError: !res.ok
            });

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value, { stream: true });
                receivedText += chunk;
                
                // Update state with new chunk
                setResponse(prev => {
                    if (!prev) return null;
                    return {
                        ...prev,
                        data: receivedText,
                        size: (new TextEncoder().encode(receivedText).length / 1024).toFixed(2) + ' KB',
                        time: Date.now() - startTime
                    };
                });
            }
        } else {
            // --- BUFFERED MODE (Default) ---
            const text = await res.text();
            const size = (new TextEncoder().encode(text).length / 1024).toFixed(2) + ' KB';
            let data = text;
            
            if (contentType.includes('application/json')) {
                try {
                    data = JSON.parse(text);
                } catch (e) {
                    // Keep as text
                }
            }

            setResponse({
                status: res.status,
                statusText: res.statusText || (res.ok ? 'OK' : 'Error'),
                headers: resHeaders,
                data,
                size,
                time: Date.now() - startTime,
                contentType,
                isError: !res.ok
            });
        }

        addToHistory(request);

    } catch (error: any) {
        if (error.name === 'AbortError') {
             // User aborted, do nothing or show aborted state
        } else {
            setResponse({
                status: 0,
                statusText: 'Error',
                headers: {},
                data: error.message + '\n\nRequest Failed or Aborted.',
                size: '0 KB',
                time: Date.now() - startTime,
                contentType: 'text/plain',
                isError: true
            });
        }
    } finally {
        setLoading(false);
        abortControllerRef.current = null;
    }
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-200 font-sans overflow-hidden">
      <Sidebar 
        history={history} 
        onSelect={handleSelectHistory} 
        onClear={clearHistory}
        onTogglePin={handleTogglePinHistory}
        onDelete={handleDeleteHistory}
        isOpen={sidebarOpen}
      />
      
      <SettingsModal 
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <header className="h-12 bg-zinc-900 border-b border-zinc-800 flex items-center px-4 justify-between shrink-0 z-10">
            <div className="flex items-center gap-3">
                <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1 hover:bg-zinc-800 rounded text-zinc-400">
                    <Menu size={20} />
                </button>
                <div className="flex items-center gap-2 font-bold text-lg tracking-tight">
                    <div className="bg-indigo-600 p-1 rounded-md">
                        <Zap size={16} className="text-white" fill="currentColor" />
                    </div>
                    <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">PostmanLite</span>
                </div>
            </div>
            <div className="flex items-center gap-4">
                 <button 
                    onClick={() => setSettingsOpen(true)}
                    className="flex items-center gap-2 text-xs text-zinc-400 hover:text-zinc-200 transition-colors bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded"
                 >
                    <Settings size={14} />
                    <span>Settings</span>
                 </button>
            </div>
        </header>

        {/* Workspace */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
             {/* Left/Top: Request Panel */}
             <div className="flex-1 md:w-1/2 flex flex-col min-h-[300px] border-b md:border-b-0 md:border-r border-zinc-800">
                <RequestPanel 
                    request={request} 
                    onChange={setRequest} 
                    onSend={handleSend}
                    onStop={handleStop}
                    loading={loading}
                    settings={settings}
                    injectedHeaders={injectedHeaders}
                />
             </div>

             {/* Right/Bottom: Response Panel */}
             <div className="flex-1 md:w-1/2 flex flex-col bg-zinc-900 h-full">
                <ResponsePanel response={response} loading={loading} />
             </div>
        </div>
      </div>
    </div>
  );
};

export default App;
