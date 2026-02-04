import React from 'react';
import { History, Trash2, Search, Pin, PinOff, X } from 'lucide-react';
import { HistoryItem } from '../types';

interface SidebarProps {
  history: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onClear: () => void;
  onTogglePin: (id: string, e: React.MouseEvent) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  isOpen: boolean;
}

const methodColors: Record<string, string> = {
  GET: 'text-green-400',
  POST: 'text-yellow-400',
  PUT: 'text-blue-400',
  DELETE: 'text-red-400',
  PATCH: 'text-purple-400',
};

export const Sidebar: React.FC<SidebarProps> = ({ history, onSelect, onClear, onTogglePin, onDelete, isOpen }) => {
  if (!isOpen) return null;

  // Sort: Pinned first, then by timestamp desc
  const sortedHistory = [...history].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return b.timestamp - a.timestamp;
  });

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
          title="Clear All History"
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
        {sortedHistory.length === 0 ? (
          <div className="p-8 text-center text-zinc-600 text-sm">
            No history yet. Make a request!
          </div>
        ) : (
          <div className="flex flex-col">
            {sortedHistory.map((item) => (
              <button
                key={item.id}
                onClick={() => onSelect(item)}
                className="flex flex-col gap-1 p-3 hover:bg-zinc-800 border-l-2 border-transparent hover:border-indigo-500 text-left transition-all group relative"
              >
                <div className="flex items-center gap-2 w-full pr-8">
                  <span className={`text-xs font-bold w-12 ${methodColors[item.method] || 'text-zinc-400'}`}>
                    {item.method}
                  </span>
                  <span className="text-zinc-300 text-sm truncate flex-1 font-mono" title={item.url}>
                    {item.url.replace(/^https?:\/\//, '')}
                  </span>
                </div>
                <div className="flex items-center gap-2 pl-14">
                  <span className="text-zinc-500 text-[10px]">
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </span>
                  {item.pinned && <Pin size={10} className="text-amber-500" fill="currentColor" />}
                </div>

                {/* Actions (Visible on Hover) */}
                <div className="absolute right-2 top-2 bottom-2 flex flex-col justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-800/80 backdrop-blur-sm rounded pl-1">
                     <div
                         onClick={(e) => onTogglePin(item.id, e)}
                         className={`p-1 rounded hover:bg-zinc-700 transition-colors ${item.pinned ? 'text-amber-500' : 'text-zinc-400 hover:text-zinc-200'}`}
                         title={item.pinned ? "Unpin" : "Pin"}
                     >
                        {item.pinned ? <PinOff size={14} /> : <Pin size={14} />}
                     </div>
                     <div 
                         onClick={(e) => onDelete(item.id, e)}
                         className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-red-400 transition-colors"
                         title="Delete"
                     >
                        <X size={14} />
                     </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
