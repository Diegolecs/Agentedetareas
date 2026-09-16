import React, { useState } from 'react';
import { AssistantState } from '../types';
import { MemoryView } from './MemoryView';
import { HistoryView } from './HistoryView';
import {
  FolderGit2,
  History,
  Activity,
  Layers,
  Sparkles,
  Calendar,
  CheckSquare,
  Clock,
  User,
  Tag,
} from 'lucide-react';

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
  const [subTab, setSubTab] = useState<'memoria' | 'historial' | 'todo'>('memoria');

  // Unified items for "Todo" view
  const actionItems = (state.actionHistory || []).map((item, idx) => {
    const itemId = item.actionId || item.id || `act-${idx}-${item.timestamp}`;
    return {
      id: itemId,
      type: 'action' as const,
      timestamp: item.timestamp,
      title: item.readableDescription || item.summary || 'Acción registrada',
      detail: item.details || `${item.actionType} en ${item.entity}`,
      badgeText: item.entity,
    };
  });

  const memoryItems = (state.memories || []).map((mem, idx) => {
    const memId = mem.id || `mem-${idx}-${mem.title}`;
    return {
      id: memId,
      type: 'memory' as const,
      timestamp: mem.updatedAt || mem.createdAt || '',
      title: mem.title,
      detail: mem.content,
      badgeText: mem.category,
    };
  });

  const allItems = [...actionItems, ...memoryItems].sort((a, b) =>
    (b.timestamp || '').localeCompare(a.timestamp || '')
  );

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Navigation Subbar */}
      <div className="bg-slate-900/80 backdrop-blur-xs border-b border-slate-800/90 px-4 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-lg bg-indigo-950/80 text-indigo-400 border border-indigo-800/40">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight">Actividad</h2>
          </div>
        </div>

        {/* View Switcher: Memoria | Historial | Todo */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setSubTab('memoria')}
            id="subtab-memoria"
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg transition ${
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
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg transition ${
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

          <button
            onClick={() => setSubTab('todo')}
            id="subtab-todo-actividad"
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg transition ${
              subTab === 'todo'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Todo</span>
          </button>
        </div>
      </div>

      {/* Content Container */}
      <div className="flex-1 overflow-hidden relative">
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

        {subTab === 'todo' && (
          <div className="flex flex-col h-full overflow-y-auto p-4 space-y-4">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3.5 text-xs text-slate-400">
              <span className="font-semibold text-white block mb-0.5">Línea de tiempo cronológica unificada</span>
              Visualiza de manera consolidada todas las modificaciones, registros de memoria y acciones ejecutadas.
            </div>

            {allItems.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-slate-800 rounded-2xl bg-slate-900/20 text-slate-500 text-xs">
                No hay actividad registrada aún.
              </div>
            ) : (
              <div className="space-y-2.5">
                {allItems.map((item, idx) => (
                  <div
                    key={`${item.type}-${item.id || idx}`}
                    className="bg-slate-900/75 border border-slate-800 hover:border-slate-700 rounded-2xl p-3.5 transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        <div
                          className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                            item.type === 'action'
                              ? 'bg-indigo-950/80 text-indigo-400 border border-indigo-800/40'
                              : 'bg-purple-950/80 text-purple-400 border border-purple-800/40'
                          }`}
                        >
                          {item.type === 'action' ? (
                            <History className="w-4 h-4" />
                          ) : (
                            <FolderGit2 className="w-4 h-4" />
                          )}
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-white">
                              {item.title}
                            </span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold border ${
                                item.type === 'action'
                                  ? 'bg-indigo-950 text-indigo-300 border-indigo-800/50'
                                  : 'bg-purple-950 text-purple-300 border-purple-800/50'
                              }`}
                            >
                              {item.type === 'action' ? 'Acción' : 'Memoria'} • {item.badgeText}
                            </span>
                          </div>

                          <p className="text-xs text-slate-400 line-clamp-2">
                            {item.detail}
                          </p>
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-500 font-mono shrink-0 whitespace-nowrap flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-600" />
                        {new Date(item.timestamp).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                        })}{' '}
                        {new Date(item.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
