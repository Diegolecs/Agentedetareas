import React, { useState } from 'react';
import { CalendarEvent, EventStatus } from '../types';
import { CalendarService, FutureGoogleCalendar } from '../services/calendarService';
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  User,
  Plus,
  Filter,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  X,
  ExternalLink,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ListFilter,
  CalendarDays,
} from 'lucide-react';

interface CalendarViewProps {
  events: CalendarEvent[];
  onUpdateEvents: (updated: CalendarEvent[]) => void;
  currentDate: string;
}

const MONTH_NAMES_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const WEEKDAY_NAMES_ES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export const CalendarView: React.FC<CalendarViewProps> = ({
  events,
  onUpdateEvents,
  currentDate,
}) => {
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month' | 'all'>('day');
  const [selectedDate, setSelectedDate] = useState(currentDate);
  const [filterStatus, setFilterStatus] = useState<EventStatus | 'todos'>('todos');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  // Month navigation cursor (defaults to current date's year and month)
  const [currentYear, setCurrentYear] = useState(() => {
    const parts = (currentDate || new Date().toISOString().split('T')[0]).split('-');
    return parseInt(parts[0], 10) || new Date().getFullYear();
  });
  const [currentMonth, setCurrentMonth] = useState(() => {
    const parts = (currentDate || new Date().toISOString().split('T')[0]).split('-');
    return parseInt(parts[1], 10) - 1 || new Date().getMonth();
  });

  // Sync when currentDate changes from device or switcher
  React.useEffect(() => {
    if (currentDate) {
      setSelectedDate(currentDate);
      const parts = currentDate.split('-');
      if (parts.length === 3) {
        setCurrentYear(parseInt(parts[0], 10));
        setCurrentMonth(parseInt(parts[1], 10) - 1);
      }
    }
  }, [currentDate]);

  // New event form state
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState(selectedDate);
  const [newStartTime, setNewStartTime] = useState('10:00');
  const [newEndTime, setNewEndTime] = useState('11:00');
  const [newLocation, setNewLocation] = useState('');
  const [newPerson, setNewPerson] = useState('');
  const [newProject, setNewProject] = useState('');
  const [newStatus, setNewStatus] = useState<EventStatus>('confirmado');
  const [newDesc, setNewDesc] = useState('');

  // Month grid calculations
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
  // getDay(): 0 is Sunday, 1 is Monday... In ES calendar, Monday is first day of week
  const firstDayIndex = (firstDayOfMonth.getDay() + 6) % 7; // Monday = 0, Sunday = 6
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleGoToTodayMonth = () => {
    const parts = currentDate.split('-');
    setCurrentYear(parseInt(parts[0], 10) || 2026);
    setCurrentMonth(parseInt(parts[1], 10) - 1 || 8);
    setSelectedDate(currentDate);
  };

  // Events filtered by viewMode
  const filteredEvents = events
    .filter((ev) => {
      if (filterStatus !== 'todos' && ev.status !== filterStatus) return false;

      if (viewMode === 'day') {
        return ev.date === selectedDate;
      } else if (viewMode === 'week') {
        // Show events within +/- 3 days of selectedDate
        const selTime = new Date(selectedDate).getTime();
        const evTime = new Date(ev.date).getTime();
        const diffDays = Math.abs((evTime - selTime) / (1000 * 3600 * 24));
        return diffDays <= 3;
      } else if (viewMode === 'month') {
        const monthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
        return ev.date.startsWith(monthStr);
      } else if (viewMode === 'all') {
        // All future events (from currentDate forward)
        return ev.date >= currentDate;
      }
      return true;
    })
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.startTime.localeCompare(b.startTime);
    });

  // Events on currently selected day in month view
  const eventsOnSelectedDay = events
    .filter((ev) => {
      if (filterStatus !== 'todos' && ev.status !== filterStatus) return false;
      return ev.date === selectedDate;
    })
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  // Future events grouped by month for the "Todo" view
  const futureEventsGroupedByMonth = React.useMemo(() => {
    const futureEvents = events
      .filter((ev) => {
        if (filterStatus !== 'todos' && ev.status !== filterStatus) return false;
        return ev.date >= currentDate;
      })
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.startTime.localeCompare(b.startTime);
      });

    const groups: { monthKey: string; monthLabel: string; events: CalendarEvent[] }[] = [];

    futureEvents.forEach((ev) => {
      const parts = ev.date.split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      const label = `${MONTH_NAMES_ES[m] || ''} ${y}`;

      let group = groups.find((g) => g.monthKey === key);
      if (!group) {
        group = { monthKey: key, monthLabel: label, events: [] };
        groups.push(group);
      }
      group.events.push(ev);
    });

    return groups;
  }, [events, filterStatus, currentDate]);

  const freeSlots = CalendarService.getFreeSlots(events, selectedDate);

  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const { updatedList } = CalendarService.createEvent(events, {
      title: newTitle.trim(),
      date: newDate,
      startTime: newStartTime,
      endTime: newEndTime,
      location: newLocation.trim() || undefined,
      relatedPerson: newPerson.trim() || undefined,
      relatedProject: newProject.trim() || undefined,
      status: newStatus,
      description: newDesc.trim() || undefined,
    });

    onUpdateEvents(updatedList);
    setIsNewModalOpen(false);
    setNewTitle('');
    setNewDesc('');
    setNewLocation('');
  };

  const handleUpdateStatus = (id: string, newStat: EventStatus) => {
    const { updatedList, updatedEvent } = CalendarService.updateEvent(events, id, {
      status: newStat,
    });
    onUpdateEvents(updatedList);
    if (selectedEvent && selectedEvent.id === id) {
      setSelectedEvent(updatedEvent || null);
    }
  };

  const handleDeleteEvent = (id: string) => {
    const { updatedList } = CalendarService.deleteEvent(events, id);
    onUpdateEvents(updatedList);
    setSelectedEvent(null);
  };

  const getStatusBadge = (status: EventStatus) => {
    switch (status) {
      case 'confirmado':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Confirmado
          </span>
        );
      case 'no_confirmado':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-950/80 text-amber-300 border border-amber-800/60">
            <AlertCircle className="w-3 h-3 text-amber-400" /> No confirmado
          </span>
        );
      case 'posible':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-950/80 text-purple-300 border border-purple-800/60">
            <HelpCircle className="w-3 h-3 text-purple-400" /> Posible actividad
          </span>
        );
      case 'completado':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
            Completado
          </span>
        );
      case 'cancelado':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-950/80 text-rose-300 border border-rose-800/60">
            Cancelado
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-y-auto">
      {/* Top Header Controls */}
      <div className="p-4 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-xs sticky top-0 z-10 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-indigo-400" />
              Calendario
            </h2>
            <p className="text-xs text-slate-400">
              Agenda visual con gestión de estados confirmados, pendientes y actividades
            </p>
          </div>
          <button
            onClick={() => {
              setNewDate(selectedDate);
              setIsNewModalOpen(true);
            }}
            id="btn-add-event"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition shadow-sm active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Evento</span>
          </button>
        </div>

        {/* View Mode Switcher: Día | Semana | Mes | Todo */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setViewMode('day')}
              id="view-mode-day"
              className={`px-3 py-1 text-xs font-medium rounded-lg transition ${
                viewMode === 'day' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Día
            </button>
            <button
              onClick={() => setViewMode('week')}
              id="view-mode-week"
              className={`px-3 py-1 text-xs font-medium rounded-lg transition ${
                viewMode === 'week' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Semana
            </button>
            <button
              onClick={() => setViewMode('month')}
              id="view-mode-month"
              className={`px-3 py-1 text-xs font-medium rounded-lg transition ${
                viewMode === 'month' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Mes
            </button>
            <button
              onClick={() => setViewMode('all')}
              id="view-mode-all"
              className={`px-3 py-1 text-xs font-medium rounded-lg transition ${
                viewMode === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Todo
            </button>
          </div>

          {/* Date controls for day / week views */}
          {viewMode !== 'month' && viewMode !== 'all' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:ring-1 focus:ring-indigo-500"
              />
              {selectedDate !== currentDate && (
                <button
                  onClick={() => setSelectedDate(currentDate)}
                  className="text-[11px] text-indigo-400 hover:underline px-1.5 py-1"
                >
                  Hoy
                </button>
              )}
            </div>
          )}

          {/* Controls for month view navigation */}
          {viewMode === 'month' && (
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevMonth}
                id="btn-prev-month"
                className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white transition"
                title="Mes anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-white font-mono px-2">
                {MONTH_NAMES_ES[currentMonth]} {currentYear}
              </span>
              <button
                onClick={handleNextMonth}
                id="btn-next-month"
                className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white transition"
                title="Mes siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={handleGoToTodayMonth}
                className="text-xs text-indigo-400 hover:underline px-2 py-1"
              >
                Mes Actual
              </button>
            </div>
          )}
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
          <span className="text-[11px] text-slate-500 font-medium shrink-0 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Estado:
          </span>
          {(['todos', 'confirmado', 'no_confirmado', 'posible'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium shrink-0 transition ${
                filterStatus === st
                  ? 'bg-slate-800 text-white border border-slate-700'
                  : 'bg-slate-950 text-slate-400 border border-slate-900 hover:border-slate-800'
              }`}
            >
              {st === 'todos'
                ? 'Todos'
                : st === 'confirmado'
                ? 'Confirmados'
                : st === 'no_confirmado'
                ? 'No confirmados'
                : 'Posibles'}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-4 space-y-6">
        {/* Availability / Free slots widget for selected date (Day view) */}
        {viewMode === 'day' && (
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-3.5 shadow-sm">
            <div className="text-xs font-semibold text-slate-300 flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                Disponibilidad para {selectedDate === currentDate ? 'Hoy' : selectedDate}:
              </span>
              <span className="text-[11px] text-slate-400 font-normal">Jornada 09:00 - 19:00</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {freeSlots.map((slot, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 text-xs font-mono"
                >
                  🟢 {slot}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* MONTH VIEW: VISUAL CALENDAR GRID                                  */}
        {/* ---------------------------------------------------------------- */}
        {viewMode === 'month' && (
          <div className="space-y-6">
            <div className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-4 shadow-md">
              {/* Month Header Banner */}
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-base font-bold text-white">
                    {MONTH_NAMES_ES[currentMonth]} {currentYear}
                  </h3>
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Confirmado
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span> Pendiente
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-purple-400"></span> Posible
                  </span>
                </div>
              </div>

              {/* Day of week headers */}
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-400 mb-2">
                {WEEKDAY_NAMES_ES.map((d, i) => (
                  <div key={i} className="py-1">
                    {d}
                  </div>
                ))}
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                {/* Empty cells for previous month days */}
                {Array.from({ length: firstDayIndex }).map((_, i) => {
                  const prevDayNum = daysInPrevMonth - firstDayIndex + i + 1;
                  return (
                    <div
                      key={`prev-${i}`}
                      className="min-h-[70px] sm:min-h-[84px] p-1.5 rounded-xl border border-slate-900/50 bg-slate-950/30 text-slate-600 text-xs opacity-40 select-none"
                    >
                      <span className="font-mono">{prevDayNum}</span>
                    </div>
                  );
                })}

                {/* Days of current month */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const dayNum = i + 1;
                  const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(
                    dayNum
                  ).padStart(2, '0')}`;
                  const isToday = dateStr === currentDate;
                  const isSelected = dateStr === selectedDate;

                  // Find events on this day
                  const dayEvents = events.filter((ev) => {
                    if (filterStatus !== 'todos' && ev.status !== filterStatus) return false;
                    return ev.date === dateStr;
                  });

                  return (
                    <div
                      key={dateStr}
                      onClick={() => setSelectedDate(dateStr)}
                      id={`day-cell-${dateStr}`}
                      className={`min-h-[70px] sm:min-h-[88px] p-1.5 sm:p-2 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-950/30 ring-1 ring-indigo-500/50'
                          : isToday
                          ? 'border-slate-700 bg-slate-950/80 hover:border-slate-600'
                          : dayEvents.length > 0
                          ? 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                          : 'border-slate-900/80 bg-slate-950/40 hover:border-slate-800'
                      }`}
                    >
                      {/* Day Number and Badges */}
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-mono font-semibold rounded-md px-1.5 py-0.5 ${
                            isSelected
                              ? 'bg-indigo-600 text-white'
                              : isToday
                              ? 'bg-indigo-950 text-indigo-300 border border-indigo-700'
                              : 'text-slate-300'
                          }`}
                        >
                          {dayNum}
                        </span>

                        {dayEvents.length > 0 && (
                          <span className="text-[10px] font-bold text-slate-400 font-mono">
                            {dayEvents.length}
                          </span>
                        )}
                      </div>

                      {/* Event items in cell */}
                      <div className="space-y-1 mt-1 overflow-hidden">
                        {dayEvents.slice(0, 2).map((ev) => (
                          <div
                            key={ev.id}
                            title={`${ev.startTime} ${ev.title}`}
                            className={`text-[10px] truncate px-1 py-0.5 rounded font-medium flex items-center gap-1 ${
                              ev.status === 'confirmado'
                                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/50'
                                : ev.status === 'no_confirmado'
                                ? 'bg-amber-950/80 text-amber-300 border border-amber-800/50'
                                : 'bg-purple-950/80 text-purple-300 border border-purple-800/50'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                ev.status === 'confirmado'
                                  ? 'bg-emerald-400'
                                  : ev.status === 'no_confirmado'
                                  ? 'bg-amber-400'
                                  : 'bg-purple-400'
                              }`}
                            />
                            <span className="truncate">{ev.title}</span>
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <div className="text-[9px] text-slate-400 font-semibold px-1">
                            +{dayEvents.length - 2} más
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Day Inspection Details below grid */}
            <div className="bg-slate-900/80 border border-slate-800/90 rounded-3xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-indigo-400" />
                    Eventos del {selectedDate} {selectedDate === currentDate ? '(Hoy)' : ''}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {eventsOnSelectedDay.length === 0
                      ? 'Sin eventos programados para esta fecha.'
                      : `${eventsOnSelectedDay.length} evento(s) en agenda.`}
                  </p>
                </div>

                <button
                  onClick={() => {
                    setNewDate(selectedDate);
                    setIsNewModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Agregar evento aquí</span>
                </button>
              </div>

              {eventsOnSelectedDay.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  No hay compromisos para este día. Haz clic en "Agregar evento aquí" para agendar.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {eventsOnSelectedDay.map((ev) => (
                    <div
                      key={ev.id}
                      onClick={() => setSelectedEvent(ev)}
                      className="group bg-slate-950 hover:bg-slate-900 border border-slate-800/90 hover:border-indigo-500/50 rounded-2xl p-4 transition shadow-sm cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-white text-sm group-hover:text-indigo-300 transition">
                              {ev.title}
                            </span>
                            {getStatusBadge(ev.status)}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 pt-1">
                            <span className="flex items-center gap-1 font-mono text-slate-300">
                              <Clock className="w-3.5 h-3.5 text-indigo-400" />
                              {ev.startTime} - {ev.endTime}
                            </span>
                            {ev.location && (
                              <span className="flex items-center gap-1 text-slate-300">
                                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                                {ev.location}
                              </span>
                            )}
                            {ev.relatedPerson && (
                              <span className="flex items-center gap-1 text-indigo-300">
                                <User className="w-3.5 h-3.5 text-indigo-400" />
                                {ev.relatedPerson}
                              </span>
                            )}
                          </div>

                          {ev.description && (
                            <p className="text-xs text-slate-400 line-clamp-2 pt-1">
                              {ev.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* "TODO" VIEW: ALL FUTURE SCHEDULED EVENTS GROUPED BY MONTH/YEAR   */}
        {/* ---------------------------------------------------------------- */}
        {viewMode === 'all' && (
          <div className="space-y-6">
            <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4 shadow-sm flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ListFilter className="w-4 h-4 text-indigo-400" />
                  Todos los Eventos Futuros Programados
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Visualización cronológica completa sin restricción de año, agrupada por meses.
                </p>
              </div>
              <div className="text-xs font-mono text-indigo-300 bg-indigo-950/80 border border-indigo-800/60 px-2.5 py-1 rounded-lg">
                {filteredEvents.length} eventos futuros
              </div>
            </div>

            {futureEventsGroupedByMonth.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-slate-800 rounded-3xl bg-slate-900/30">
                <CalendarIcon className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-300 font-semibold">No hay eventos futuros programados</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Crea eventos con el botón "Nuevo Evento" o pidiéndoselo directamente al asistente en el chat.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {futureEventsGroupedByMonth.map((group) => (
                  <div key={group.monthKey} className="space-y-3">
                    {/* Month Section Header */}
                    <div className="flex items-center gap-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 font-mono bg-indigo-950/80 border border-indigo-800/60 px-3 py-1 rounded-xl">
                        {group.monthLabel}
                      </h4>
                      <div className="flex-1 h-px bg-slate-800"></div>
                      <span className="text-xs text-slate-500 font-mono">
                        {group.events.length} evento(s)
                      </span>
                    </div>

                    {/* Events List */}
                    <div className="space-y-2.5">
                      {group.events.map((ev) => (
                        <div
                          key={ev.id}
                          onClick={() => setSelectedEvent(ev)}
                          className="group bg-slate-900/80 hover:bg-slate-900 border border-slate-800/90 hover:border-indigo-500/50 rounded-2xl p-4 transition shadow-sm cursor-pointer"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-white text-base group-hover:text-indigo-300 transition">
                                  {ev.title}
                                </span>
                                {getStatusBadge(ev.status)}
                              </div>

                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                                <span className="flex items-center gap-1 font-mono text-slate-200">
                                  <Clock className="w-3.5 h-3.5 text-indigo-400" />
                                  {ev.date} • {ev.startTime} - {ev.endTime}
                                </span>
                                {ev.location && (
                                  <span className="flex items-center gap-1 text-slate-300">
                                    <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                                    {ev.location}
                                  </span>
                                )}
                                {ev.relatedPerson && (
                                  <span className="flex items-center gap-1 text-indigo-300">
                                    <User className="w-3.5 h-3.5 text-indigo-400" />
                                    {ev.relatedPerson}
                                  </span>
                                )}
                              </div>

                              {ev.description && (
                                <p className="text-xs text-slate-400 line-clamp-2">
                                  {ev.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* DAY AND WEEK VIEWS: TIMELINE LIST                                 */}
        {/* ---------------------------------------------------------------- */}
        {(viewMode === 'day' || viewMode === 'week') && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-300">
                {viewMode === 'day'
                  ? `Actividades del ${selectedDate}`
                  : 'Actividades de la semana'}
              </h3>
              <span className="text-xs text-slate-500 font-mono">
                {filteredEvents.length} registro(s)
              </span>
            </div>

            {filteredEvents.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl bg-slate-900/30">
                <CalendarIcon className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-400 font-medium">No hay eventos para esta vista</p>
                <p className="text-xs text-slate-500 mt-1">
                  Puedes registrar un evento con el botón superior o dictárselo al asistente.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredEvents.map((ev) => (
                  <div
                    key={ev.id}
                    onClick={() => setSelectedEvent(ev)}
                    className="group bg-slate-900/80 hover:bg-slate-900 border border-slate-800/90 hover:border-indigo-500/50 rounded-2xl p-4 transition shadow-sm cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-white text-base group-hover:text-indigo-300 transition">
                            {ev.title}
                          </span>
                          {getStatusBadge(ev.status)}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 pt-1">
                          <span className="flex items-center gap-1 font-mono text-slate-300">
                            <Clock className="w-3.5 h-3.5 text-indigo-400" />
                            {ev.date} • {ev.startTime} - {ev.endTime}
                          </span>
                          {ev.location && (
                            <span className="flex items-center gap-1 text-slate-300">
                              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                              {ev.location}
                            </span>
                          )}
                          {ev.relatedPerson && (
                            <span className="flex items-center gap-1 text-indigo-300">
                              <User className="w-3.5 h-3.5 text-indigo-400" />
                              {ev.relatedPerson}
                            </span>
                          )}
                        </div>

                        {ev.description && (
                          <p className="text-xs text-slate-400 line-clamp-2 pt-1">
                            {ev.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Event Details Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto text-slate-100">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">{selectedEvent.title}</h3>
                <div className="mt-1">{getStatusBadge(selectedEvent.status)}</div>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-300 bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>
                  <strong>Fecha y hora:</strong> {selectedEvent.date} de {selectedEvent.startTime} a{' '}
                  {selectedEvent.endTime}
                </span>
              </div>
              {selectedEvent.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    <strong>Ubicación:</strong> {selectedEvent.location}
                  </span>
                </div>
              )}
              {selectedEvent.relatedPerson && (
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-purple-400 shrink-0" />
                  <span>
                    <strong>Persona relacionada:</strong> {selectedEvent.relatedPerson}
                  </span>
                </div>
              )}
              {selectedEvent.relatedProject && (
                <div className="text-slate-400">
                  <strong>Proyecto:</strong> {selectedEvent.relatedProject}
                </div>
              )}
              {selectedEvent.description && (
                <div className="pt-2 border-t border-slate-800/80">
                  <strong>Descripción:</strong>
                  <p className="mt-1 text-slate-300 whitespace-pre-wrap">{selectedEvent.description}</p>
                </div>
              )}
            </div>

            {/* Quick Status Change */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400">Cambiar estado del evento:</label>
              <div className="flex flex-wrap gap-1.5">
                {(['confirmado', 'no_confirmado', 'posible', 'completado', 'cancelado'] as EventStatus[]).map(
                  (st) => (
                    <button
                      key={st}
                      onClick={() => handleUpdateStatus(selectedEvent.id, st)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                        selectedEvent.status === st
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                      }`}
                    >
                      {st === 'no_confirmado' ? 'No confirmado' : st}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Actions Footer */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <button
                onClick={() => handleDeleteEvent(selectedEvent.id)}
                className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 px-3 py-2 rounded-lg hover:bg-rose-950/50 transition"
              >
                <Trash2 className="w-4 h-4" />
                <span>Eliminar</span>
              </button>

              <a
                href={FutureGoogleCalendar.getGoogleCalendarWebUrl(selectedEvent)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Exportar a Google Calendar</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Manual New Event Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-indigo-400" />
                Crear Evento en Calendario
              </h3>
              <button onClick={() => setIsNewModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Título del Evento *</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="ej. Reunión con Carlos / Visita al local"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Fecha</label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-slate-100 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Hora Inicio</label>
                  <input
                    type="time"
                    value={newStartTime}
                    onChange={(e) => setNewStartTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-slate-100 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Hora Fin</label>
                  <input
                    type="time"
                    value={newEndTime}
                    onChange={(e) => setNewEndTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-slate-100 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Estado de Confirmación</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as EventStatus)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                >
                  <option value="confirmado">Confirmado (Cita segura)</option>
                  <option value="no_confirmado">No confirmado (Pendiente de confirmación)</option>
                  <option value="posible">Posible actividad (Tentativa)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Ubicación / Dirección</label>
                <input
                  type="text"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  placeholder="ej. Malecón Grau, Chorrillos"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Persona Relacionada</label>
                  <input
                    type="text"
                    value={newPerson}
                    onChange={(e) => setNewPerson(e.target.value)}
                    placeholder="ej. Juan / Pedro"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Proyecto Relacionado</label>
                  <input
                    type="text"
                    value={newProject}
                    onChange={(e) => setNewProject(e.target.value)}
                    placeholder="ej. Local Chorrillos"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Descripción / Qué llevar</label>
                <textarea
                  rows={2}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Detalles sobre lo que se conversará o revisará"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 resize-none"
                />
              </div>

              <div className="pt-3 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                >
                  Guardar Evento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
