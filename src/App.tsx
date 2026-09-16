/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AssistantState, CalendarEvent, Task, ActionHistoryItem } from './types';
import { StorageService } from './services/storageService';
import { ChatView } from './components/ChatView';
import { CalendarView } from './components/CalendarView';
import { TasksView } from './components/TasksView';
import { ActivityView } from './components/ActivityView';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import {
  MessageSquare,
  Calendar,
  CheckSquare,
  Activity,
  Sparkles,
  RotateCcw,
  Clock,
} from 'lucide-react';

export default function App() {
  const [state, setState] = useState<AssistantState>(() => StorageService.getState());
  const [activeTab, setActiveTab] = useState<'chat' | 'calendar' | 'tasks' | 'activity'>('chat');
  const [currentDate, setCurrentDate] = useState('2026-09-15'); // Current reference date matching user scenarios
  const [showDateModal, setShowDateModal] = useState(false);

  // Sync state with storage on update
  const handleUpdateState = (newState: AssistantState) => {
    setState(newState);
    StorageService.saveState(newState);
  };

  const handleResetData = () => {
    if (window.confirm('¿Deseas restaurar los datos de demostración iniciales con los ejemplos del asistente?')) {
      const resetState = StorageService.resetToSeed();
      setState(resetState);
    }
  };

  // Badges count
  const pendingTasksCount = state.tasks.filter((t) => t.status === 'pendiente').length;
  // Upcoming and pending events from current date onwards
  const upcomingEventsCount = state.events.filter(
    (e) => e.date >= currentDate && e.status !== 'cancelado' && e.status !== 'completado'
  ).length;

  return (
    <div className="flex flex-col h-screen w-full bg-slate-950 text-slate-100 font-sans overflow-hidden select-none">
      {/* Offline Status Toast */}
      <OfflineIndicator />

      {/* Main Top App Bar */}
      <header className="h-14 border-b border-slate-800/90 bg-slate-900/90 backdrop-blur-md px-4 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3">
          {/* Logo / App Avatar */}
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm">
            <Sparkles className="w-4 h-4 text-white" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-white tracking-tight">
                Asistente Personal
              </h1>
              <span className="hidden xs:inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/50">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                En línea
              </span>
            </div>
          </div>
        </div>

        {/* Center/Right Controls */}
        <div className="flex items-center gap-2">
          {/* Simulated Reference Date Chip */}
          <button
            onClick={() => setShowDateModal(true)}
            id="btn-date-chip"
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition font-mono"
            title="Cambiar fecha de referencia del asistente"
          >
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span>{currentDate}</span>
          </button>

          {/* Reset seed button */}
          <button
            onClick={handleResetData}
            id="btn-reset-data"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            title="Restablecer datos de prueba iniciales"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* PWA Install Button */}
          <PWAInstallButton />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative">
        {activeTab === 'chat' && (
          <ChatView
            state={state}
            onUpdateState={handleUpdateState}
            onNavigateTab={(tab) => {
              if (tab === 'calendar' || tab === 'tasks' || tab === 'activity' || tab === 'chat') {
                setActiveTab(tab);
              } else if (tab === 'memory' || tab === 'history') {
                setActiveTab('activity');
              }
            }}
            currentDate={currentDate}
          />
        )}

        {activeTab === 'calendar' && (
          <CalendarView
            events={state.events}
            onUpdateEvents={(updatedEvents: CalendarEvent[]) =>
              handleUpdateState({ ...state, events: updatedEvents })
            }
            currentDate={currentDate}
          />
        )}

        {activeTab === 'tasks' && (
          <TasksView
            tasks={state.tasks}
            actionHistory={state.actionHistory}
            onUpdateTasks={(updatedTasks: Task[]) =>
              handleUpdateState({ ...state, tasks: updatedTasks })
            }
            onArchiveCompletedTasks={(updatedTasks: Task[], updatedHistory: ActionHistoryItem[]) =>
              handleUpdateState({ ...state, tasks: updatedTasks, actionHistory: updatedHistory })
            }
            currentDate={currentDate}
          />
        )}

        {activeTab === 'activity' && (
          <ActivityView
            state={state}
            onUpdateState={handleUpdateState}
            currentDate={currentDate}
          />
        )}
      </main>

      {/* Bottom Navigation Bar (Mobile-first, 4 clear core sections) */}
      <nav className="h-16 border-t border-slate-800/90 bg-slate-900/95 backdrop-blur-md px-1 sm:px-2 flex items-center justify-around shrink-0 z-30">
        <button
          onClick={() => setActiveTab('chat')}
          id="nav-chat"
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition ${
            activeTab === 'chat'
              ? 'text-indigo-400 font-bold'
              : 'text-slate-400 hover:text-slate-200 font-medium'
          }`}
        >
          <div className="relative">
            <MessageSquare className="w-5 h-5" />
          </div>
          <span className="text-[11px]">Chat</span>
        </button>

        <button
          onClick={() => setActiveTab('calendar')}
          id="nav-calendar"
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition ${
            activeTab === 'calendar'
              ? 'text-indigo-400 font-bold'
              : 'text-slate-400 hover:text-slate-200 font-medium'
          }`}
        >
          <div className="relative">
            <Calendar className="w-5 h-5" />
            {upcomingEventsCount > 0 && (
              <span className="absolute -top-1 -right-2.5 min-w-[16px] h-4 px-1 bg-emerald-500 text-[10px] text-white font-bold rounded-full flex items-center justify-center">
                {upcomingEventsCount}
              </span>
            )}
          </div>
          <span className="text-[11px]">Calendario</span>
        </button>

        <button
          onClick={() => setActiveTab('tasks')}
          id="nav-tasks"
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition ${
            activeTab === 'tasks'
              ? 'text-indigo-400 font-bold'
              : 'text-slate-400 hover:text-slate-200 font-medium'
          }`}
        >
          <div className="relative">
            <CheckSquare className="w-5 h-5" />
            {pendingTasksCount > 0 && (
              <span className="absolute -top-1 -right-2.5 min-w-[16px] h-4 px-1 bg-amber-500 text-[10px] text-slate-950 font-bold rounded-full flex items-center justify-center">
                {pendingTasksCount}
              </span>
            )}
          </div>
          <span className="text-[11px]">Tareas</span>
        </button>

        <button
          onClick={() => setActiveTab('activity')}
          id="nav-activity"
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition ${
            activeTab === 'activity'
              ? 'text-indigo-400 font-bold'
              : 'text-slate-400 hover:text-slate-200 font-medium'
          }`}
        >
          <div className="relative">
            <Activity className="w-5 h-5" />
          </div>
          <span className="text-[11px]">Actividad</span>
        </button>
      </nav>

      {/* Date Switcher Modal */}
      {showDateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-2xl text-slate-100 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400" />
              Fecha de Referencia del Asistente
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              El asistente interpreta términos temporales ("hoy", "mañana", "esta semana") con base en esta fecha:
            </p>
            <input
              type="date"
              value={currentDate}
              onChange={(e) => setCurrentDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100"
            />
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  setCurrentDate('2026-09-15');
                  setShowDateModal(false);
                }}
                className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium"
              >
                15 Sep 2026 (Demo)
              </button>
              <button
                onClick={() => setShowDateModal(false)}
                className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
