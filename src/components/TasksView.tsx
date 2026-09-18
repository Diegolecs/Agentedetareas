import React, { useState, useEffect } from 'react';
import { Task, TaskPriority, TaskStatus, ActionHistoryItem } from '../types';
import { TaskService } from '../services/taskService';
import {
  CheckSquare,
  Square,
  Plus,
  Filter,
  AlertTriangle,
  Clock,
  User,
  Trash2,
  X,
  Archive,
  CheckCircle2,
  Info,
} from 'lucide-react';

interface TasksViewProps {
  tasks: Task[];
  actionHistory?: ActionHistoryItem[];
  onUpdateTasks: (updated: Task[]) => void;
  onArchiveCompletedTasks?: (updatedTasks: Task[], updatedHistory: ActionHistoryItem[]) => void;
  currentDate: string;
}

export const TasksView: React.FC<TasksViewProps> = ({
  tasks,
  actionHistory,
  onUpdateTasks,
  onArchiveCompletedTasks,
  currentDate,
}) => {
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'todas'>('todas');
  const [filterPriority, setFilterPriority] = useState<TaskPriority | 'todas'>('todas');
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // New task form state
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDueDate, setNewDueDate] = useState(currentDate);
  const [newDueTime, setNewDueTime] = useState('14:00');
  const [newPriority, setNewPriority] = useState<TaskPriority>('alta');
  const [newPerson, setNewPerson] = useState('');
  const [newProject, setNewProject] = useState('');

  useEffect(() => {
    setNewDueDate(currentDate);
  }, [currentDate]);

  // 30-day retention rule: auto-archive tasks completed older than 30 days
  useEffect(() => {
    if (onArchiveCompletedTasks && actionHistory) {
      const { updatedTasks, updatedHistory, archivedTasks } = TaskService.archiveCompletedTasks(
        tasks,
        actionHistory,
        currentDate,
        false
      );
      if (archivedTasks.length > 0) {
        onArchiveCompletedTasks(updatedTasks, updatedHistory);
      }
    }
  }, []);

  const filteredTasks = TaskService.getTasks(tasks, {
    status: filterStatus === 'todas' ? undefined : filterStatus,
    priority: filterPriority === 'todas' ? undefined : filterPriority,
    query: searchQuery || undefined,
  });

  const pendingCount = tasks.filter((t) => t.status === 'pendiente').length;
  const overdueCount = tasks.filter(
    (t) => t.status === 'pendiente' && t.dueDate && t.dueDate < currentDate
  ).length;
  const completedCount = tasks.filter((t) => t.status === 'completada').length;

  const handleToggleTask = (id: string) => {
    const { updatedList } = TaskService.toggleComplete(tasks, id);
    onUpdateTasks(updatedList);
  };

  const handleDeleteTask = (id: string) => {
    const { updatedList } = TaskService.deleteTask(tasks, id);
    onUpdateTasks(updatedList);
  };

  const handleCleanCompleted = () => {
    if (completedCount === 0) return;

    if (onArchiveCompletedTasks && actionHistory) {
      const { updatedTasks, updatedHistory, archivedTasks } = TaskService.archiveCompletedTasks(
        tasks,
        actionHistory,
        currentDate,
        true // Force all completed to archive
      );
      onArchiveCompletedTasks(updatedTasks, updatedHistory);
      setNotification(`${archivedTasks.length} tarea(s) completada(s) archivadas en el Historial.`);
      setTimeout(() => {
        setNotification(null);
      }, 4000);
    } else {
      const remaining = tasks.filter((t) => t.status !== 'completada');
      onUpdateTasks(remaining);
      setNotification('Tareas completadas archivadas.');
      setTimeout(() => {
        setNotification(null);
      }, 4000);
    }
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const { updatedList } = TaskService.createTask(tasks, {
      title: newTitle.trim(),
      description: newDesc.trim() || undefined,
      dueDate: newDueDate || undefined,
      dueTime: newDueTime || undefined,
      priority: newPriority,
      status: 'pendiente',
      relatedPerson: newPerson.trim() || undefined,
      relatedProject: newProject.trim() || undefined,
    });

    onUpdateTasks(updatedList);
    setIsNewModalOpen(false);
    setNewTitle('');
    setNewDesc('');
    setNewPerson('');
    setNewProject('');
  };

  const getPriorityBadge = (priority: TaskPriority) => {
    switch (priority) {
      case 'alta':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-950/80 text-rose-300 border border-rose-800/60">
            Alta prioridad
          </span>
        );
      case 'media':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-950/80 text-amber-300 border border-amber-800/60">
            Prioridad media
          </span>
        );
      case 'baja':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
            Baja prioridad
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-y-auto">
      {/* Top Header */}
      <div className="p-4 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-xs sticky top-0 z-10 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-indigo-400" />
              Tareas
            </h2>
            <p className="text-xs text-slate-400">
              Gestión de pendientes, prioridades y registro histórico
            </p>
          </div>
          <button
            onClick={() => setIsNewModalOpen(true)}
            id="btn-add-task"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition shadow-sm active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Tarea</span>
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between">
            <span className="text-xs text-slate-400">Pendientes</span>
            <span className="text-sm font-bold text-indigo-400">{pendingCount}</span>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between">
            <span className="text-xs text-slate-400">Atrasadas</span>
            <span
              className={`text-sm font-bold ${
                overdueCount > 0 ? 'text-rose-400 font-extrabold' : 'text-slate-400'
              }`}
            >
              {overdueCount}
            </span>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between">
            <span className="text-xs text-slate-400">Completadas</span>
            <span className="text-sm font-bold text-emerald-400">{completedCount}</span>
          </div>
        </div>

        {/* Action Toolbar: Archive Completed & Filters */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {/* Status Switcher */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setFilterStatus('todas')}
              className={`px-2.5 py-1 text-xs rounded-lg transition ${
                filterStatus === 'todas' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setFilterStatus('pendiente')}
              className={`px-2.5 py-1 text-xs rounded-lg transition ${
                filterStatus === 'pendiente' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Pendientes
            </button>
            <button
              onClick={() => setFilterStatus('completada')}
              className={`px-2.5 py-1 text-xs rounded-lg transition ${
                filterStatus === 'completada' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Completadas
            </button>
          </div>

          {/* Clean / Archive Completed Button */}
          <button
            onClick={handleCleanCompleted}
            disabled={completedCount === 0}
            id="btn-clean-completed-tasks"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition border border-slate-700/80 bg-slate-900 hover:bg-slate-800 text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
            title="Mover todas las tareas completadas al Historial para mantener la lista despejada"
          >
            <Archive className="w-3.5 h-3.5 text-emerald-400" />
            <span>Limpiar completadas</span>
            {completedCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-950 text-emerald-300 font-bold border border-emerald-800/60">
                {completedCount}
              </span>
            )}
          </button>
        </div>

        {/* Retention Info Note */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800/60">
          <span className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            Las tareas completadas permanecen visibles 30 días antes de archivarse automáticamente en el Historial.
          </span>
          <div className="flex items-center gap-1.5 ml-2">
            <input
              type="text"
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-0.5 text-xs text-slate-200 placeholder-slate-500 focus:ring-1 focus:ring-indigo-500 w-28 sm:w-36"
            />
          </div>
        </div>
      </div>

      {/* Confirmation Notification Toast */}
      {notification && (
        <div className="mx-4 mt-3 p-3 bg-emerald-950/90 border border-emerald-800/80 rounded-2xl flex items-center gap-2 text-xs text-emerald-200 shadow-md animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-medium">{notification}</span>
        </div>
      )}

      {/* Main Task List */}
      <div className="p-4 space-y-2.5">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl bg-slate-900/30">
            <CheckSquare className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-400 font-medium">No hay tareas que coincidan con el filtro</p>
          </div>
        ) : (
          filteredTasks.map((t) => {
            const isCompleted = t.status === 'completada';
            const isOverdue = !isCompleted && t.dueDate && t.dueDate < currentDate;

            return (
              <div
                key={t.id}
                className={`group bg-slate-900/80 hover:bg-slate-900 border rounded-2xl p-3.5 transition flex items-start gap-3 shadow-sm ${
                  isCompleted
                    ? 'border-slate-800/50 opacity-60'
                    : isOverdue
                    ? 'border-rose-900/60 bg-rose-950/10'
                    : 'border-slate-800/90'
                }`}
              >
                {/* Completion Checkbox */}
                <button
                  onClick={() => handleToggleTask(t.id)}
                  id={`task-check-${t.id}`}
                  className="mt-0.5 text-slate-400 hover:text-indigo-400 transition shrink-0"
                >
                  {isCompleted ? (
                    <CheckSquare className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <Square className="w-5 h-5 text-slate-500 group-hover:text-indigo-400" />
                  )}
                </button>

                {/* Content */}
                <div className="flex-1 space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap justify-between">
                    <span
                      className={`text-sm font-semibold ${
                        isCompleted
                          ? 'line-through text-slate-500'
                          : 'text-slate-100 group-hover:text-indigo-200'
                      }`}
                    >
                      {t.title}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {isOverdue && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-950 text-rose-400 border border-rose-800">
                          <AlertTriangle className="w-3 h-3" /> Atrasada
                        </span>
                      )}
                      {getPriorityBadge(t.priority)}
                    </div>
                  </div>

                  {t.description && (
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                      {t.description}
                    </p>
                  )}

                  {/* Metadata Chips */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400 pt-1">
                    {t.dueDate && (
                      <span
                        className={`flex items-center gap-1 font-mono ${
                          isOverdue ? 'text-rose-400 font-semibold' : 'text-slate-300'
                        }`}
                      >
                        <Clock className="w-3 h-3 text-indigo-400" />
                        Plazo: {t.dueDate} {t.dueTime ? `a las ${t.dueTime}` : ''}
                      </span>
                    )}

                    {t.relatedPerson && (
                      <span className="flex items-center gap-1 text-indigo-300">
                        <User className="w-3 h-3 text-indigo-400" />
                        {t.relatedPerson}
                      </span>
                    )}

                    {t.relatedProject && (
                      <span className="text-slate-400">
                        Proyecto: {t.relatedProject}
                      </span>
                    )}
                  </div>
                </div>

                {/* Delete button */}
                <button
                  onClick={() => handleDeleteTask(t.id)}
                  className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 transition p-1"
                  title="Eliminar tarea"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Manual Task Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-indigo-400" />
                Crear Tarea / Recordatorio
              </h3>
              <button onClick={() => setIsNewModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Título de la Tarea *</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="ej. Llamar al propietario a las dos para confirmar"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Fecha Límite</label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Hora Específica</label>
                  <input
                    type="time"
                    value={newDueTime}
                    onChange={(e) => setNewDueTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Nivel de Prioridad</label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                >
                  <option value="alta">Alta prioridad (Urgente / Crítico)</option>
                  <option value="media">Prioridad media (Normal)</option>
                  <option value="baja">Baja prioridad (Cuando haya tiempo)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Persona Involucrada</label>
                  <input
                    type="text"
                    value={newPerson}
                    onChange={(e) => setNewPerson(e.target.value)}
                    placeholder="ej. Juan / Pedro"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Proyecto</label>
                  <input
                    type="text"
                    value={newProject}
                    onChange={(e) => setNewProject(e.target.value)}
                    placeholder="ej. Venta departamento"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Detalles / Descripción</label>
                <textarea
                  rows={2}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Información adicional sobre qué hacer o documentos necesarios"
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
                  Guardar Tarea
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
