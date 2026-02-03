import React, { useState, useEffect } from 'react';
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
    globalHeaders: [{ id: '1', key: '', value: '', enabled: true }]
};

const App: React.FC = () => {
  const [request, setRequest] = useState<RequestState>(INITIAL_REQUEST);
  const [response, setResponse] = useState<ResponseState | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

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
        timestamp: Date.now() 
    };
    const newHistory = [newItem, ...history].slice(0, 50); // Keep last 50
    setHistory(newHistory);
    localStorage.setItem('postman_lite_history', JSON.stringify(newHistory));
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('postman_lite_history');
  };

  const handleSelectHistory = (item: HistoryItem) => {
    // Restore the request state
    const { timestamp, ...reqState } = item;
    // Ensure arrays exist (migration safety)
    setRequest({ 
        ...reqState, 
        file: null,
        bodyFormData: reqState.bodyFormData || INITIAL_REQUEST.bodyFormData,
        bodyFormUrlEncoded: reqState.bodyFormUrlEncoded || INITIAL_REQUEST.bodyFormUrlEncoded
    }); 
  };

  const handleSend = async () => {
    setLoading(true);
    setResponse(null);
    const startTime = Date.now();

    // Prepare headers (Request Headers + Global Headers)
    const headers: Record<string, string> = {};
    
    // Add Global Headers first 
    settings.globalHeaders.forEach(h => {
        if (h.enabled && h.key) headers[h.key] = h.value;
    });

    // Add Request Headers
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
            // Binary File
            const formData = new FormData();
            // Typically binary upload is just the body, not wrapped in FormData, 
            // but previous implementation wrapped it. Standard raw binary is just `body = request.file`.
            // User requirement "File upload" usually means raw binary body or form-data.
            // Existing implementation was wrapping in FormData with key 'file'.
            // To be more precise "Binary File" mode usually sends raw bytes.
            // But let's stick to the previous behavior if it was "File upload" form style, 
            // OR change to raw binary. Given we now have explicit "Form Data", 
            // 'file' type usually implies Raw Binary. 
            // However, to avoid breaking existing users who expect "file" key, let's keep it wrapper 
            // OR assume the user wants form-data.
            // Let's treat 'file' as Raw Binary Stream for this update to differentiate from Form Data.
            body = request.file; 
            // Note: If you want to force a Content-Type for the file, user should set it or browser guesses.
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
            // Remove Content-Type so browser sets boundary
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
            // Browser sets content-type usually, but explicit header in UI is also fine.
        }
        else {
            // JSON or Text
            body = request.bodyContent;
        }
    }

    try {
        const res = await fetch(finalUrl, {
            method: request.method,
            headers,
            body,
            mode: settings.fetchMode,
            credentials: settings.fetchCredentials
        });

        const endTime = Date.now();
        const time = endTime - startTime;
        
        let data: any = null;
        let size = '0 KB';
        let contentType = res.headers.get('content-type') || '';

        if (res.type === 'opaque') {
             data = "Opaque response received (no-cors mode). No data available.";
             contentType = "opaque/unknown";
        } else {
            const text = await res.text();
            size = (new TextEncoder().encode(text).length / 1024).toFixed(2) + ' KB';
            data = text;
            
            if (contentType.includes('application/json')) {
                try {
                    data = JSON.parse(text);
                } catch (e) {
                    // Keep as text
                }
            }
        }

        const resHeaders: Record<string, string> = {};
        res.headers.forEach((val, key) => resHeaders[key] = val);

        setResponse({
            status: res.status,
            statusText: res.statusText || (res.ok ? 'OK' : 'Error'),
            headers: resHeaders,
            data,
            size,
            time,
            contentType,
            isError: !res.ok
        });

        addToHistory(request);

    } catch (error: any) {
        setResponse({
            status: 0,
            statusText: 'Error',
            headers: {},
            data: error.message + '\n\nRequest Failed. Possible reasons:\n1. CORS policy.\n2. Network unreachable.\n3. Invalid URL.',
            size: '0 KB',
            time: Date.now() - startTime,
            contentType: 'text/plain',
            isError: true
        });
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-200 font-sans overflow-hidden">
      <Sidebar 
        history={history} 
        onSelect={handleSelectHistory} 
        onClear={clearHistory}
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
                    loading={loading}
                    globalHeaders={settings.globalHeaders}
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
