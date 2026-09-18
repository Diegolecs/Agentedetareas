import React, { useState } from 'react';
import { ActionHistoryItem, AssistantState } from '../types';
import { HistoryService } from '../services/historyService';
import {
  History,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Calendar,
  CheckSquare,
  Sparkles,
  Trash2,
  Edit3,
  Layers,
  ArrowRight,
  Bell,
} from 'lucide-react';

interface HistoryViewProps {
  state: AssistantState;
  onUpdateState: (newState: AssistantState) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ state, onUpdateState }) => {
  const [filterType, setFilterType] = useState<'all' | 'tasks' | 'events' | 'combined'>('all');
  const [revertingId, setRevertingId] = useState<string | null>(null);
  const [confirmModalId, setConfirmModalId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const historyItems = state.actionHistory || [];
  const currentUserId = state.currentUser?.id || 'usr-diego-default';

  const filteredItems = historyItems.filter((item) => {
    if (filterType === 'all') return true;
    if (filterType === 'tasks') {
      return item.entity.includes('task');
    }
    if (filterType === 'events') {
      return item.entity.includes('event');
    }
    if (filterType === 'combined') {
      return item.entity === 'tasks_and_events_all' || item.actionType === 'delete_all_tasks_and_events';
    }
    return true;
  });

  const handleExecuteRevert = (actionId: string) => {
    setRevertingId(actionId);
    setConfirmModalId(null);

    try {
      const result = HistoryService.revertAction(state, actionId, currentUserId);
      if (result.success) {
        onUpdateState(result.updatedState);
        setNotification({
          type: 'success',
          message: result.message,
        });
      } else {
        setNotification({
          type: 'error',
          message: result.message,
        });
      }
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: `Error al revertir: ${err.message || 'Error desconocido'}`,
      });
    } finally {
      setRevertingId(null);
      setTimeout(() => {
        setNotification(null);
      }, 5000);
    }
  };

  const getActionIcon = (item: ActionHistoryItem) => {
    if (item.actionType === 'revert_action') {
      return <RotateCcw className="w-4 h-4 text-emerald-400" />;
    }
    if (item.actionType.startsWith('delete')) {
      return <Trash2 className="w-4 h-4 text-rose-400" />;
    }
    if (item.actionType.startsWith('update')) {
      return <Edit3 className="w-4 h-4 text-amber-400" />;
    }
    if (item.entity.includes('task')) {
      return <CheckSquare className="w-4 h-4 text-indigo-400" />;
    }
    if (item.entity.includes('event')) {
      return <Calendar className="w-4 h-4 text-purple-400" />;
    }
    if (item.entity.includes('reminder') || item.actionType.includes('reminder')) {
      return <Bell className="w-4 h-4 text-sky-400" />;
    }
    return <Sparkles className="w-4 h-4 text-cyan-400" />;
  };

  const getActionBadge = (item: ActionHistoryItem) => {
    if (item.actionType === 'revert_action') {
      return { text: 'Reversión', color: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60' };
    }
    if (item.actionType === 'delete_all_tasks_and_events') {
      return { text: 'Operación masiva combinada', color: 'bg-rose-950/80 text-rose-300 border-rose-800/60' };
    }
    if (item.actionType === 'delete_all_tasks' || item.actionType === 'delete_all_events') {
      return { text: 'Eliminación masiva', color: 'bg-rose-950/80 text-rose-300 border-rose-800/60' };
    }
    if (item.actionType.startsWith('delete') || item.actionType === 'cancel_reminder') {
      return { text: 'Eliminación / Cancelado', color: 'bg-rose-950/60 text-rose-300 border-rose-900/40' };
    }
    if (item.actionType.startsWith('update')) {
      return { text: 'Modificación', color: 'bg-amber-950/60 text-amber-300 border-amber-800/50' };
    }
    if (item.entity.includes('reminder') || item.actionType.includes('reminder')) {
      return { text: 'Recordatorio Real', color: 'bg-sky-950/80 text-sky-300 border-sky-800/60' };
    }
    return { text: 'Creación', color: 'bg-indigo-950/60 text-indigo-300 border-indigo-800/50' };
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden w-full max-w-full">
      {/* Top Header */}
      <div className="p-3.5 sm:p-4 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 shrink-0 w-full">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-950/80 text-indigo-400 border border-indigo-800/40 shrink-0">
              <History className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-white tracking-tight truncate">Historial de Acciones</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 line-clamp-2 sm:line-clamp-none">
            Registro auditable de modificaciones y eliminaciones ejecutadas por el asistente con capacidad de reversión segura.
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 max-w-full">
          <button
            onClick={() => setFilterType('all')}
            id="filter-hist-all"
            className={`px-3 py-1 text-xs rounded-lg font-medium transition shrink-0 whitespace-nowrap ${
              filterType === 'all'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            Todas ({historyItems.length})
          </button>
          <button
            onClick={() => setFilterType('tasks')}
            id="filter-hist-tasks"
            className={`px-3 py-1 text-xs rounded-lg font-medium transition shrink-0 whitespace-nowrap ${
              filterType === 'tasks'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            Tareas
          </button>
          <button
            onClick={() => setFilterType('events')}
            id="filter-hist-events"
            className={`px-3 py-1 text-xs rounded-lg font-medium transition shrink-0 whitespace-nowrap ${
              filterType === 'events'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            Calendario
          </button>
          <button
            onClick={() => setFilterType('combined')}
            id="filter-hist-combined"
            className={`px-3 py-1 text-xs rounded-lg font-medium transition shrink-0 whitespace-nowrap ${
              filterType === 'combined'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            Combinadas
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div
          className={`mx-4 mt-3 p-3 rounded-xl border flex items-center gap-2.5 text-xs font-medium animate-in fade-in duration-200 shrink-0 ${
            notification.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-800 text-emerald-200'
              : 'bg-rose-950/90 border-rose-800 text-rose-200'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Main List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredItems.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 rounded-2xl border border-dashed border-slate-800">
            <History className="w-10 h-10 text-slate-600 mb-2" />
            <p className="text-sm font-medium text-slate-300">No hay acciones registradas en esta vista</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              Cuando el asistente ejecute órdenes sobre tus tareas o calendario, aparecerán aquí con su estado y opción de reversión.
            </p>
          </div>
        ) : (
          filteredItems.map((item, idx) => {
            const badge = getActionBadge(item);
            const isReverted = item.status === 'reverted';
            const canRevert = item.isReversible && item.status === 'applied';
            const itemKey = item.actionId || item.id || `hist-${idx}-${item.timestamp}`;

            return (
              <div
                key={itemKey}
                id={`history-item-${itemKey}`}
                className={`rounded-xl border p-4 transition ${
                  isReverted
                    ? 'bg-slate-900/40 border-slate-800/60 opacity-80'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700/80 shadow-xs'
                }`}
              >
                {/* Header row: timestamp & badges */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="p-1 rounded-md bg-slate-800/80 border border-slate-700/50">
                      {getActionIcon(item)}
                    </span>
                    <span className="text-xs font-mono text-slate-400 font-medium">
                      {item.displayTimestamp || item.timestamp}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge.color}`}
                    >
                      {badge.text}
                    </span>
                  </div>

                  {/* Status Indicator */}
                  <div>
                    {isReverted ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-amber-950/70 text-amber-300 border border-amber-800/50">
                        <RotateCcw className="w-3 h-3" />
                        Revertida
                      </span>
                    ) : canRevert ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-emerald-950/70 text-emerald-300 border border-emerald-800/50">
                        <CheckCircle2 className="w-3 h-3" />
                        Reversible
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-500 font-medium px-2 py-0.5">
                        Completada
                      </span>
                    )}
                  </div>
                </div>

                {/* Description */}
                <div className="text-sm font-semibold text-white mb-1 break-words">
                  {item.readableDescription}
                </div>

                {/* Additional context for modifications / deletions */}
                {item.previousState && (item.previousState.tasks || item.previousState.events) && (
                  <div className="mt-2 text-xs rounded-lg bg-slate-950/60 border border-slate-800/60 p-2.5 space-y-1.5 overflow-hidden">
                    {/* If items were modified */}
                    {item.actionType === 'update_task' && item.previousState.tasks?.[0] && item.newState?.tasks?.[0] && (
                      <div className="space-y-1">
                        <div className="text-slate-400 flex items-center gap-1.5 flex-wrap">
                          <span className="text-rose-400 font-medium shrink-0">Antes:</span>
                          <span className="break-words">"{item.previousState.tasks[0].title}"</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 shrink-0">
                            {item.previousState.tasks[0].priority}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 shrink-0">
                            {item.previousState.tasks[0].status}
                          </span>
                        </div>
                        <div className="text-slate-300 flex items-center gap-1.5 flex-wrap">
                          <span className="text-emerald-400 font-medium shrink-0">Después:</span>
                          <span className="break-words">"{item.newState.tasks[0].title}"</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 shrink-0">
                            {item.newState.tasks[0].priority}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 shrink-0">
                            {item.newState.tasks[0].status}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* If multiple tasks deleted */}
                    {item.previousState.tasks && item.previousState.tasks.length > 0 && item.actionType.startsWith('delete') && (
                      <div>
                        <span className="text-slate-400 font-medium">
                          Tareas respaldadas ({item.previousState.tasks.length}):{' '}
                        </span>
                        <span className="text-slate-300">
                          {item.previousState.tasks.map((t) => t.title).slice(0, 4).join(', ')}
                          {item.previousState.tasks.length > 4 ? ` y ${item.previousState.tasks.length - 4} más...` : ''}
                        </span>
                      </div>
                    )}

                    {/* If multiple events deleted */}
                    {item.previousState.events && item.previousState.events.length > 0 && item.actionType.startsWith('delete') && (
                      <div>
                        <span className="text-slate-400 font-medium">
                          Eventos respaldados ({item.previousState.events.length}):{' '}
                        </span>
                        <span className="text-slate-300">
                          {item.previousState.events.map((e) => e.title).slice(0, 4).join(', ')}
                          {item.previousState.events.length > 4 ? ` y ${item.previousState.events.length - 4} más...` : ''}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* If already reverted: show reversion summary */}
                {isReverted && item.revertedSummary && (
                  <div className="mt-2 text-xs rounded-lg bg-amber-950/30 border border-amber-800/40 p-2 text-amber-200 flex items-center gap-1.5">
                    <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                    <span>{item.revertedSummary}</span>
                  </div>
                )}

                {/* Action Revert Button (EXCLUSIVE to History tab) */}
                {canRevert && (
                  <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                      ¿Necesitas deshacer esta modificación?
                    </span>
                    <button
                      onClick={() => setConfirmModalId(item.actionId)}
                      id={`btn-revert-${item.actionId}`}
                      disabled={revertingId === item.actionId}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-50 shadow-xs cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{revertingId === item.actionId ? 'Restaurando...' : 'Revertir'}</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Confirmation Modal for Revert */}
      {confirmModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-2xl text-slate-100 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-indigo-400" />
              <span>Confirmar reversión</span>
            </h3>
            <p className="text-xs text-slate-300">
              ¿Confirmas que deseas revertir esta acción? Los elementos eliminados o modificados volverán exactamente a su estado original conservando sus identificadores.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmModalId(null)}
                id="btn-cancel-revert"
                className="px-3 py-1.5 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleExecuteRevert(confirmModalId)}
                id="btn-confirm-revert"
                className="px-3.5 py-1.5 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
              >
                Revertir ahora
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
