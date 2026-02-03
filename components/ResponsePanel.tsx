import React, { useState } from 'react';
import { ResponseState } from '../types';
import { Clock, Database, AlertCircle, CheckCircle, Copy, Check, FileText } from 'lucide-react';

interface ResponsePanelProps {
  response: ResponseState | null;
  loading: boolean;
}

export const ResponsePanel: React.FC<ResponsePanelProps> = ({ response, loading }) => {
  const [activeTab, setActiveTab] = useState<'body' | 'headers' | 'raw'>('body');
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (response?.data) {
      const text = typeof response.data === 'string' ? response.data : JSON.stringify(response.data, null, 2);
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-zinc-500 bg-zinc-950/50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mb-4"></div>
        <p>Sending Request...</p>
      </div>
    );
  }

  if (!response) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-zinc-600 bg-zinc-950/50">
        <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mb-4 border border-zinc-800">
           <span className="text-2xl">⚡</span>
        </div>
        <p>Enter a URL and send to view response</p>
      </div>
    );
  }

  const isSuccess = response.status >= 200 && response.status < 300;
  
  // Syntax Highlighting (Simple)
  const renderBody = () => {
    if (!response.data) return <span className="text-zinc-500 italic">No Content</span>;
    
    // Check content type to decide how to render
    const isImage = response.contentType?.startsWith('image/');
    if (isImage && typeof response.data === 'string') {
        return <img src={response.data} alt="Response" className="max-w-full h-auto rounded border border-zinc-700" />;
    }

    let content = response.data;
    if (typeof content === 'object') {
      try {
        content = JSON.stringify(content, null, 2);
      } catch (e) {
        content = String(content);
      }
    }

    return (
      <pre className="text-xs sm:text-sm font-mono text-zinc-300 whitespace-pre-wrap break-all leading-relaxed">
        {content}
      </pre>
    );
  };

  const renderRaw = () => {
    const headers = Object.entries(response.headers).map(([k, v]) => `${k}: ${v}`).join('\n');
    let body = response.data;
    if (typeof body === 'object') body = JSON.stringify(body, null, 2);
    
    const rawString = `HTTP/1.1 ${response.status} ${response.statusText}\n${headers}\n\n${body}`;
    return (
      <pre className="text-xs sm:text-sm font-mono text-zinc-400 whitespace-pre-wrap break-all leading-relaxed select-text">
        {rawString}
      </pre>
    );
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900 border-t border-zinc-800 shadow-xl">
      {/* Header Metrics */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900">
        <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
                {isSuccess ? <CheckCircle size={16} className="text-green-500" /> : <AlertCircle size={16} className="text-red-500" />}
                <span className={`font-mono font-bold ${isSuccess ? 'text-green-500' : 'text-red-500'}`}>
                    {response.status} {response.statusText}
                </span>
            </div>
            <div className="flex items-center gap-2 text-zinc-400 text-xs">
                <Clock size={14} />
                <span>{response.time} ms</span>
            </div>
            <div className="flex items-center gap-2 text-zinc-400 text-xs">
                <Database size={14} />
                <span>{response.size}</span>
            </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 px-2 bg-zinc-900/50">
        <button
            onClick={() => setActiveTab('body')}
            className={`px-4 py-2 text-sm border-b-2 transition-colors ${activeTab === 'body' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-zinc-400 hover:text-zinc-200'}`}
        >
            Body
        </button>
        <button
            onClick={() => setActiveTab('headers')}
            className={`px-4 py-2 text-sm border-b-2 transition-colors ${activeTab === 'headers' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-zinc-400 hover:text-zinc-200'}`}
        >
            Headers
        </button>
        <button
            onClick={() => setActiveTab('raw')}
            className={`px-4 py-2 text-sm border-b-2 transition-colors ${activeTab === 'raw' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-zinc-400 hover:text-zinc-200'}`}
        >
            Raw
        </button>
        <div className="ml-auto flex items-center pr-2">
            <button 
                onClick={handleCopy}
                className="text-zinc-500 hover:text-zinc-300 transition-colors"
                title="Copy Response"
            >
                {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
            </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 bg-zinc-950/30">
        {activeTab === 'body' && renderBody()}
        {activeTab === 'raw' && renderRaw()}
        {activeTab === 'headers' && (
            <div className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-2 text-sm font-mono">
                {Object.entries(response.headers).map(([key, value]) => (
                    <React.Fragment key={key}>
                        <div className="text-zinc-500 text-right select-none">{key}:</div>
                        <div className="text-zinc-300 break-all">{value}</div>
                    </React.Fragment>
                ))}
            </div>
        )}
      </div>
    </div>
  );
};
