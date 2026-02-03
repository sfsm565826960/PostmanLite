import React from 'react';
import { History, Trash2, ChevronRight, Search } from 'lucide-react';
import { HistoryItem } from '../types';

interface SidebarProps {
  history: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onClear: () => void;
  isOpen: boolean;
}

const methodColors: Record<string, string> = {
  GET: 'text-green-400',
  POST: 'text-yellow-400',
  PUT: 'text-blue-400',
  DELETE: 'text-red-400',
  PATCH: 'text-purple-400',
};

export const Sidebar: React.FC<SidebarProps> = ({ history, onSelect, onClear, isOpen }) => {
  if (!isOpen) return null;

  return (
    <div className="w-72 bg-zinc-900 border-r border-zinc-800 flex flex-col h-full shrink-0 transition-all duration-300">
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2 text-zinc-100 font-semibold">
          <History size={18} />
          <span>History</span>
        </div>
        <button 
          onClick={onClear}
          className="text-zinc-500 hover:text-red-400 transition-colors p-1 rounded hover:bg-zinc-800"
          title="Clear History"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="p-2">
         <div className="relative">
            <Search className="absolute left-2 top-2.5 text-zinc-500" size={14} />
            <input 
              type="text" 
              placeholder="Filter history..." 
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-8 py-2 text-sm text-zinc-300 focus:outline-none focus:border-indigo-500/50"
            />
         </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {history.length === 0 ? (
          <div className="p-8 text-center text-zinc-600 text-sm">
            No history yet. Make a request!
          </div>
        ) : (
          <div className="flex flex-col">
            {history.map((item) => (
              <button
                key={item.id}
                onClick={() => onSelect(item)}
                className="flex flex-col gap-1 p-3 hover:bg-zinc-800 border-l-2 border-transparent hover:border-indigo-500 text-left transition-all group"
              >
                <div className="flex items-center gap-2 w-full">
                  <span className={`text-xs font-bold w-12 ${methodColors[item.method] || 'text-zinc-400'}`}>
                    {item.method}
                  </span>
                  <span className="text-zinc-300 text-sm truncate flex-1 font-mono" title={item.url}>
                    {item.url.replace(/^https?:\/\//, '')}
                  </span>
                </div>
                <span className="text-zinc-500 text-[10px] pl-14">
                  {new Date(item.timestamp).toLocaleTimeString()}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
