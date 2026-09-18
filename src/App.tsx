/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AssistantState, CalendarEvent, Task, ActionHistoryItem, Reminder } from './types';
import { StorageService } from './services/storageService';
import { notificationService, WebPushStatus } from './services/notificationService';
import { getDeviceLocalDate, getDeviceFullContext } from './utils/deviceDateTime';
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
  Bell,
  BellOff,
  ExternalLink,
  X,
  Play,
  CheckCircle2,
  AlertCircle,
  Volume2,
  Info,
  Smartphone,
  Radio,
  Send,
  Loader2,
  ShieldCheck,
} from 'lucide-react';

export default function App() {
  const [state, setState] = useState<AssistantState>(() => StorageService.getState());
  const [activeTab, setActiveTab] = useState<'chat' | 'calendar' | 'tasks' | 'activity'>('chat');
  const [currentDate, setCurrentDate] = useState<string>(() => getDeviceLocalDate());
  const [isManualDateOverride, setIsManualDateOverride] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [activeReminderNotification, setActiveReminderNotification] = useState<Reminder | null>(null);
  const [pushStatus, setPushStatus] = useState<WebPushStatus>(() => notificationService.getStatus());
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [testPushMsg, setTestPushMsg] = useState<string | null>(null);
  const [testPushCountdown, setTestPushCountdown] = useState<number | null>(null);

  // Keep date synced to device midnight rollover if not manually overridden
  useEffect(() => {
    if (isManualDateOverride) return;

    const checkDeviceDate = () => {
      const liveDate = getDeviceLocalDate();
      setCurrentDate((prev) => (prev !== liveDate ? liveDate : prev));
    };

    const interval = setInterval(checkDeviceDate, 30000); // check every 30s
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkDeviceDate();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isManualDateOverride]);

  // Sync state with storage on update and reschedule active timers in backend
  const handleUpdateState = (newState: AssistantState) => {
    setState(newState);
    StorageService.saveState(newState);
    notificationService.syncReminders(newState.reminders || []);
  };

  useEffect(() => {
    // Initial sync of active reminders with backend push scheduler
    notificationService.syncReminders(state.reminders || []);

    // Subscribe to push status changes
    const unsubStatus = notificationService.onStatusChange((status) => {
      setPushStatus(status);
    });

    // Subscribe to fired reminders / clicked push notifications
    const unsubFired = notificationService.onNotificationFired((reminderId, remObj) => {
      setState((prev) => {
        const found = remObj || (prev.reminders || []).find((r) => r.id === reminderId);
        if (found) {
          setActiveReminderNotification(found);
        }
        const updated = (prev.reminders || []).map((r) =>
          r.id === reminderId
            ? { ...r, status: 'delivered' as const, deliveredAt: new Date().toISOString() }
            : r
        );
        const nextState = { ...prev, reminders: updated };
        StorageService.saveState(nextState);
        return nextState;
      });
    });

    return () => {
      unsubStatus();
      unsubFired();
    };
  }, []);

  const handleRequestNotificationPermission = async () => {
    setIsSubscribing(true);
    setTestPushMsg(null);
    try {
      const res = await notificationService.requestPermissionAndSubscribe();
      if (!res.success && res.error) {
        setTestPushMsg(`Error: ${res.error}`);
      } else {
        setTestPushMsg('¡Suscripción Web Push completada con éxito en este dispositivo!');
      }
    } catch (err: any) {
      setTestPushMsg(`Error: ${err.message || err}`);
    } finally {
      setIsSubscribing(false);
      setShowNotifModal(true);
    }
  };

  const handleSendInstantPush = async () => {
    setTestPushMsg('Enviando notificación Push real desde el backend...');
    try {
      const res = await notificationService.sendBackendTestPush(
        0,
        '🔔 Notificación Web Push Real',
        '¡Funciona! Esta notificación fue despachada desde el backend y mostrada por el Service Worker.'
      );
      if (res.success) {
        setTestPushMsg('✅ Notificación Push despachada por el backend hacia tus dispositivos suscritos.');
      } else {
        setTestPushMsg(`❌ ${res.error || 'No se pudo enviar la notificación.'}`);
      }
    } catch (err: any) {
      setTestPushMsg(`❌ Error de conexión: ${err.message}`);
    }
  };

  const handleSchedule1MinPush = async () => {
    setTestPushMsg('Programando notificación para dentro de 60 segundos en el backend...');
    try {
      const res = await notificationService.sendBackendTestPush(
        60,
        '⏱️ Recordatorio Programado (1m)',
        '¡Tu recordatorio ha llegado a tiempo! Despachado por el backend tras 1 minuto.'
      );
      if (res.success) {
        setTestPushCountdown(60);
        setTestPushMsg('⏳ Programado en el servidor para T+60s. Puedes minimizar la app o apagar la pantalla para probar.');
        const interval = window.setInterval(() => {
          setTestPushCountdown((prev) => {
            if (prev === null || prev <= 1) {
              clearInterval(interval);
              return null;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        setTestPushMsg(`❌ ${res.error || 'Error al programar en el backend'}`);
      }
    } catch (err: any) {
      setTestPushMsg(`❌ Error: ${err.message}`);
    }
  };

  const handleSnoozeReminder = (reminder: Reminder) => {
    const snoozeTime = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const updatedRem: Reminder = {
      ...reminder,
      scheduledTime: snoozeTime,
      displayTime: `${new Date(snoozeTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (Pospuesto)`,
      status: 'scheduled',
      updatedAt: new Date().toISOString(),
    };

    const nextReminders = (state.reminders || []).map((r) => (r.id === reminder.id ? updatedRem : r));
    const nextState = { ...state, reminders: nextReminders };
    handleUpdateState(nextState);
    setActiveReminderNotification(null);
  };

  const handleDismissReminder = (reminder: Reminder) => {
    setActiveReminderNotification(null);
  };

  const handleResetData = () => {
    if (window.confirm('¿Deseas restaurar los datos de demostración iniciales con los ejemplos del asistente?')) {
      const resetState = StorageService.resetToSeed();
      setState(resetState);
    }
  };

  // Badges count
  const pendingTasksCount = state.tasks.filter((t) => t.status === 'pendiente').length;
  const upcomingEventsCount = state.events.filter(
    (e) => e.date >= currentDate && e.status !== 'cancelado' && e.status !== 'completado'
  ).length;

  return (
    <div className="flex flex-col h-screen w-full bg-slate-950 text-slate-100 font-sans overflow-hidden select-none">
      {/* Offline Status Toast */}
      <OfflineIndicator />

      {/* Floating Active Reminder Notification Banner */}
      {activeReminderNotification && (
        <div
          id="active-reminder-toast"
          className="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-md bg-slate-900/95 border-2 border-indigo-500/80 rounded-2xl shadow-2xl p-4 backdrop-blur-md animate-bounce-short text-slate-100"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center shrink-0 text-indigo-400 animate-pulse">
              <Bell className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-400 flex items-center gap-1">
                  <Volume2 className="w-3 h-3" /> ¡Aviso de Recordatorio!
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <h4 className="text-sm font-bold text-white tracking-tight mt-0.5 break-words">
                {activeReminderNotification.title}
              </h4>
              {activeReminderNotification.notes && (
                <p className="text-xs text-slate-300 mt-1 line-clamp-2">
                  {activeReminderNotification.notes}
                </p>
              )}
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => handleDismissReminder(activeReminderNotification)}
                  id="btn-dismiss-reminder"
                  className="flex-1 py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs transition"
                >
                  Entendido
                </button>
                <button
                  onClick={() => handleSnoozeReminder(activeReminderNotification)}
                  id="btn-snooze-reminder"
                  className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
                >
                  Posponer 5m
                </button>
              </div>
            </div>
            <button
              onClick={() => handleDismissReminder(activeReminderNotification)}
              className="text-slate-400 hover:text-white p-1"
              title="Cerrar aviso"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Top App Bar */}
      <header className="h-14 border-b border-slate-800/90 bg-slate-900/90 backdrop-blur-md px-3 sm:px-4 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-2.5">
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
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* External standalone tab button (especially valuable when inside AI Studio iframe preview) */}
          <a
            href={typeof window !== 'undefined' ? window.location.href : '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-slate-800/80 border border-slate-700/70 text-slate-300 hover:text-white hover:bg-slate-700/80 transition"
            title="Abrir en pestaña independiente para habilitar notificaciones nativas de escritorio del SO"
            id="btn-open-new-tab"
          >
            <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden lg:inline text-[11px] font-medium">Pestaña completa</span>
          </a>

          {/* Web Push Notification Status & Configuration Chip */}
          {pushStatus.isSubscribed && pushStatus.permission === 'granted' ? (
            <button
              onClick={() => setShowNotifModal(true)}
              className="flex items-center gap-1.5 px-2 py-1 text-xs rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 hover:bg-emerald-900/60 transition"
              title="Notificaciones Web Push activas en el dispositivo. Clic para probar o gestionar."
              id="indicator-notif-granted"
            >
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span className="hidden sm:inline text-[11px] font-medium">Web Push Activo</span>
            </button>
          ) : pushStatus.isIframe ? (
            <button
              onClick={() => setShowNotifModal(true)}
              className="flex items-center gap-1.5 px-2 py-1 text-xs rounded-lg bg-indigo-950/70 border border-indigo-700/60 text-indigo-300 hover:bg-indigo-900/80 transition"
              title="Avisos en app activos (Iframe). Clic para ver detalles."
              id="indicator-notif-iframe"
            >
              <Bell className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline text-[11px] font-medium">Preview (Iframe)</span>
            </button>
          ) : pushStatus.permission === 'denied' ? (
            <button
              onClick={() => setShowNotifModal(true)}
              className="flex items-center gap-1.5 px-2 py-1 text-xs rounded-lg bg-rose-950/60 border border-rose-800/60 text-rose-300 hover:bg-rose-900/60 transition"
              title="Notificaciones del SO denegadas en el navegador. Clic para ver solución."
              id="btn-notif-denied"
            >
              <BellOff className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline text-[11px]">Push Bloqueado</span>
            </button>
          ) : (
            <button
              onClick={handleRequestNotificationPermission}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg bg-indigo-950/80 border border-indigo-700/60 text-indigo-200 hover:bg-indigo-900/80 hover:text-white transition"
              title="Activar notificaciones reales Web Push"
              id="btn-request-notif"
            >
              <Bell className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-[11px] font-medium">Activar Push</span>
            </button>
          )}

          {/* Device Reference Date Chip */}
          <button
            onClick={() => setShowDateModal(true)}
            id="btn-date-chip"
            className="flex items-center gap-1.5 px-2 py-1 text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition font-mono"
            title="Fecha activa del asistente. Clic para ver o cambiar."
          >
            {isManualDateOverride ? (
              <Clock className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span>{currentDate}</span>
            {!isManualDateOverride && (
              <span className="hidden xl:inline text-[9px] uppercase px-1 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/40">
                Celular
              </span>
            )}
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
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                Fecha y Hora del Dispositivo
              </h3>
              <button
                onClick={() => setShowDateModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-1">
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>Fecha del celular (Hoy):</span>
                <span className="font-semibold text-emerald-300">{getDeviceLocalDate()}</span>
              </div>
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>Hora actual del dispositivo:</span>
                <span className="font-mono text-slate-200">{getDeviceFullContext().currentTime}</span>
              </div>
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>Zona horaria:</span>
                <span className="text-slate-300">{getDeviceFullContext().timezone}</span>
              </div>
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>Estado sincronización:</span>
                <span className={isManualDateOverride ? "text-amber-400 font-medium" : "text-emerald-400 font-medium"}>
                  {isManualDateOverride ? 'Modo manual fijo' : 'Sincronizado con celular'}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              El asistente interpreta términos ("hoy", "mañana", "ayer") con base en esta fecha activa:
            </p>

            <input
              type="date"
              value={currentDate}
              onChange={(e) => {
                setCurrentDate(e.target.value);
                setIsManualDateOverride(true);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
            />

            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={() => {
                  setCurrentDate(getDeviceLocalDate());
                  setIsManualDateOverride(false);
                  setShowDateModal(false);
                }}
                className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition"
              >
                <Smartphone className="w-3.5 h-3.5" />
                Sincronizar con la fecha de mi celular (Hoy)
              </button>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setCurrentDate('2026-09-15');
                    setIsManualDateOverride(true);
                    setShowDateModal(false);
                  }}
                  className="flex-1 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-slate-300"
                >
                  15 Sep 2026 (Demo)
                </button>
                <button
                  onClick={() => setShowDateModal(false)}
                  className="flex-1 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-white"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Web Push & System Notification Diagnostic & Control Modal */}
      {showNotifModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-2xl text-slate-100 space-y-4 my-auto">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Notificaciones Reales del Sistema (Web Push)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Arquitectura desacoplada: Backend Push Scheduler → Service Worker → SO
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowNotifModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Platform & Service Worker Status Matrix */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                  Entorno Actual
                </span>
                <span className="font-medium text-slate-200 flex items-center gap-1.5 mt-0.5">
                  <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
                  {pushStatus.isIframe
                    ? 'AI Studio Preview (Iframe)'
                    : (typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches)
                    ? 'PWA Instalada (Android/Desktop)'
                    : 'Pestaña HTTPS Independiente'}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                  Permiso Notificaciones
                </span>
                <span className="font-medium flex items-center gap-1.5 mt-0.5">
                  {pushStatus.permission === 'granted' ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Concedido (SO)
                    </span>
                  ) : pushStatus.permission === 'denied' ? (
                    <span className="text-rose-400 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> Denegado
                    </span>
                  ) : (
                    <span className="text-amber-400 flex items-center gap-1">
                      <Info className="w-3.5 h-3.5" /> Pendiente
                    </span>
                  )}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                  Service Worker (sw-push.js)
                </span>
                <span className="font-medium flex items-center gap-1.5 mt-0.5">
                  {pushStatus.serviceWorkerActive ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Activo en segundo plano
                    </span>
                  ) : (
                    <span className="text-slate-400 flex items-center gap-1">
                      <Info className="w-3.5 h-3.5" /> Registrado / En espera
                    </span>
                  )}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                  Suscripción VAPID
                </span>
                <span className="font-medium flex items-center gap-1.5 mt-0.5">
                  {pushStatus.isSubscribed ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <Radio className="w-3.5 h-3.5 animate-pulse" /> Dispositivo suscrito
                    </span>
                  ) : (
                    <span className="text-amber-400 flex items-center gap-1">
                      <Info className="w-3.5 h-3.5" /> No suscrito
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Diagnostic Alert Box */}
            {pushStatus.isIframe ? (
              <div className="p-3 rounded-xl bg-indigo-950/50 border border-indigo-700/60 text-xs text-indigo-200 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-indigo-100">
                  <Info className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Diferencia técnica: Entorno Preview (Iframe)</span>
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  Los navegadores modernos (Chrome, Edge) prohíben por política de seguridad estricta solicitar o mostrar permisos de notificaciones del sistema dentro de submarcos embebidos (<code className="bg-slate-900 px-1 py-0.5 rounded text-indigo-300">iframe</code>).
                </p>
                <p className="text-emerald-300 text-[11px] font-medium">
                  Para probar Web Push y suscripción VAPID nativa en tu navegador o en tu teléfono Android, abre la aplicación en una pestaña independiente.
                </p>
              </div>
            ) : pushStatus.permission === 'granted' && pushStatus.isSubscribed ? (
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-300 space-y-1">
                <div className="flex items-center gap-2 font-bold text-emerald-200">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Dispositivo completamente preparado para Web Push</span>
                </div>
                <p className="text-slate-300 text-[11px]">
                  El backend enviará alertas directamente a los servidores push (FCM) y tu teléfono o sistema operativo despertará al Service Worker cuando se cumpla la hora programada.
                </p>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-2">
                <p className="text-[11px]">
                  Haz clic a continuación para solicitar el permiso del sistema operativo y registrar la clave VAPID pública en este dispositivo:
                </p>
                <button
                  onClick={handleRequestNotificationPermission}
                  disabled={isSubscribing}
                  className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900/50 text-white font-semibold text-xs flex items-center justify-center gap-2 transition"
                >
                  {isSubscribing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Conectando con PushManager y Backend...</span>
                    </>
                  ) : (
                    <>
                      <Bell className="w-4 h-4" />
                      <span>Conceder Permiso y Suscribir a Web Push</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Test Actions Section */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <span>Pruebas de Notificación Real del Sistema</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={handleSendInstantPush}
                  className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-medium flex items-center justify-center gap-2 border border-slate-700 transition"
                  id="btn-test-instant-push"
                >
                  <Send className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Enviar Push Inmediato</span>
                </button>

                <button
                  onClick={handleSchedule1MinPush}
                  disabled={testPushCountdown !== null}
                  className="py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900/50 text-white text-xs font-semibold flex items-center justify-center gap-2 transition"
                  id="btn-test-delayed-push"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    {testPushCountdown !== null
                      ? `Llegará en ${testPushCountdown}s...`
                      : 'Push en 1 minuto (Segundo plano)'}
                  </span>
                </button>
              </div>

              {testPushMsg && (
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200">
                  {testPushMsg}
                </div>
              )}

              {pushStatus.isIframe && (
                <a
                  href={typeof window !== 'undefined' ? window.location.href : '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-3 rounded-xl bg-indigo-950/70 hover:bg-indigo-900/80 text-indigo-200 text-xs font-medium flex items-center justify-center gap-2 border border-indigo-700/60 transition mt-2"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Abrir en Pestaña Independiente (Obligatorio para permitir Push)</span>
                </a>
              )}
            </div>

            {/* Verification Guide Note */}
            <div className="text-[11px] text-slate-400 border-t border-slate-800/80 pt-2.5 space-y-1">
              <strong className="text-slate-300 block">Flujo de verificación en Android:</strong>
              <ol className="list-decimal list-inside space-y-0.5 text-slate-400">
                <li>Abre el enlace en Chrome en tu Android o instala la PWA.</li>
                <li>Toca "Activar Push" y concede el permiso en el diálogo nativo de Android.</li>
                <li>Toca "Push en 1 minuto" y apaga la pantalla o cambia de app.</li>
                <li>El backend despacha el Web Push y Android muestra la notificación del sistema.</li>
              </ol>
            </div>

            <div className="pt-1 text-center">
              <button
                onClick={() => setShowNotifModal(false)}
                className="text-xs text-slate-400 hover:text-slate-200 py-1 px-4"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
