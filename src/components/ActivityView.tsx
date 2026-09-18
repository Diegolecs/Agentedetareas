import React, { useState } from 'react';
import { AssistantState } from '../types';
import { MemoryView } from './MemoryView';
import { HistoryView } from './HistoryView';
import { FolderGit2, History, Activity } from 'lucide-react';

interface ActivityViewProps {
  state: AssistantState;
  onUpdateState: (newState: AssistantState) => void;
  currentDate: string;
}

export const ActivityView: React.FC<ActivityViewProps> = ({
  state,
  onUpdateState,
  currentDate,
}) => {
  const [subTab, setSubTab] = useState<'memoria' | 'historial'>('memoria');

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden w-full max-w-full">
      {/* Top Navigation Subbar */}
      <div className="bg-slate-900/80 backdrop-blur-xs border-b border-slate-800/90 px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 rounded-lg bg-indigo-950/80 text-indigo-400 border border-indigo-800/40 shrink-0">
            <Activity className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-bold text-white tracking-tight truncate">Actividad</h2>
        </div>

        {/* View Switcher: ONLY Memoria & Historial */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
          <button
            onClick={() => setSubTab('memoria')}
            id="subtab-memoria"
            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition whitespace-nowrap ${
              subTab === 'memoria'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FolderGit2 className="w-3.5 h-3.5" />
            <span>Memoria</span>
          </button>

          <button
            onClick={() => setSubTab('historial')}
            id="subtab-historial"
            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition whitespace-nowrap ${
              subTab === 'historial'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Historial</span>
            {(state.actionHistory?.length || 0) > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
                {state.actionHistory.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Content Container */}
      <div className="flex-1 overflow-hidden relative w-full">
        {subTab === 'memoria' && (
          <MemoryView
            state={state}
            onUpdateState={onUpdateState}
            currentDate={currentDate}
          />
        )}

        {subTab === 'historial' && (
          <HistoryView
            state={state}
            onUpdateState={onUpdateState}
          />
        )}
      </div>
    </div>
  );
};
