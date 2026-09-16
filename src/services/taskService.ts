import { Task, TaskPriority, TaskStatus, ActionHistoryItem } from '../types';

export const COMPLETED_RETENTION_DAYS = 30;

export interface TaskFilter {
  status?: TaskStatus;
  priority?: TaskPriority;
  relatedPerson?: string;
  relatedProject?: string;
  query?: string;
  dueBefore?: string;
}

export class TaskService {
  static getTasks(tasks: Task[], filter?: TaskFilter): Task[] {
    return tasks.filter((t) => {
      if (filter?.status && t.status !== filter.status) return false;
      if (filter?.priority && t.priority !== filter.priority) return false;
      if (filter?.relatedPerson && !t.relatedPerson?.toLowerCase().includes(filter.relatedPerson.toLowerCase())) return false;
      if (filter?.relatedProject && !t.relatedProject?.toLowerCase().includes(filter.relatedProject.toLowerCase())) return false;
      if (filter?.dueBefore && t.dueDate && t.dueDate > filter.dueBefore) return false;
      if (filter?.query) {
        const q = filter.query.toLowerCase();
        const str = `${t.title} ${t.description || ''} ${t.relatedPerson || ''} ${t.relatedProject || ''}`.toLowerCase();
        if (!str.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => {
      // Prioritize overdue, then high priority, then date
      const priorityWeight: Record<TaskPriority, number> = { alta: 3, media: 2, baja: 1 };
      if (a.status === 'completada' && b.status !== 'completada') return 1;
      if (b.status === 'completada' && a.status !== 'completada') return -1;
      if (priorityWeight[b.priority] !== priorityWeight[a.priority]) {
        return priorityWeight[b.priority] - priorityWeight[a.priority];
      }
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      return 0;
    });
  }

  static createTask(
    tasks: Task[],
    task: Omit<Task, 'id' | 'createdAt'>
  ): { newTask: Task; updatedList: Task[] } {
    const newTask: Task = {
      ...task,
      id: `tsk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    return { newTask, updatedList: [newTask, ...tasks] };
  }

  static updateTask(
    tasks: Task[],
    id: string,
    updates: Partial<Task>
  ): { updatedTask?: Task; updatedList: Task[] } {
    let updatedTask: Task | undefined;
    const updatedList = tasks.map((t) => {
      if (t.id === id) {
        updatedTask = {
          ...t,
          ...updates,
          completedAt: updates.status === 'completada' && t.status !== 'completada' ? new Date().toISOString() : t.completedAt,
        };
        return updatedTask;
      }
      return t;
    });
    return { updatedTask, updatedList };
  }

  static toggleComplete(
    tasks: Task[],
    id: string
  ): { updatedTask?: Task; updatedList: Task[] } {
    const current = tasks.find((t) => t.id === id);
    if (!current) return { updatedList: tasks };
    const nextStatus: TaskStatus = current.status === 'completada' ? 'pendiente' : 'completada';
    return this.updateTask(tasks, id, { status: nextStatus });
  }

  static deleteTask(
    tasks: Task[],
    id: string,
    userId?: string
  ): { deleted: boolean; deletedTask?: Task; updatedList: Task[] } {
    const taskToDelete = tasks.find((t) => t.id === id);
    if (!taskToDelete) {
      return { deleted: false, updatedList: tasks };
    }
    // Security check: If userId provided, ensure task belongs to this user
    if (userId && taskToDelete.userId && taskToDelete.userId !== userId) {
      return { deleted: false, updatedList: tasks };
    }
    const updatedList = tasks.filter((t) => t.id !== id);
    return { deleted: true, deletedTask: taskToDelete, updatedList };
  }

  static deleteMultipleTasks(
    tasks: Task[],
    ids: string[],
    userId?: string
  ): { deletedCount: number; deletedTasks: Task[]; updatedList: Task[] } {
    const idSet = new Set(ids);
    const deletedTasks: Task[] = [];
    const updatedList: Task[] = [];

    for (const t of tasks) {
      if (idSet.has(t.id)) {
        if (!userId || !t.userId || t.userId === userId) {
          deletedTasks.push(t);
          continue;
        }
      }
      updatedList.push(t);
    }

    return {
      deletedCount: deletedTasks.length,
      deletedTasks,
      updatedList,
    };
  }

  static deleteAllTasks(
    tasks: Task[],
    userId?: string
  ): { deletedCount: number; deletedTasks: Task[]; updatedList: Task[] } {
    const deletedTasks: Task[] = [];
    const updatedList: Task[] = [];

    for (const t of tasks) {
      if (!userId || !t.userId || t.userId === userId) {
        deletedTasks.push(t);
      } else {
        updatedList.push(t);
      }
    }

    return {
      deletedCount: deletedTasks.length,
      deletedTasks,
      updatedList,
    };
  }

  static restoreTasks(
    tasks: Task[],
    tasksToRestore: Task[],
    userId?: string
  ): { restoredCount: number; updatedList: Task[] } {
    const existingIds = new Set(tasks.map((t) => t.id));
    const validRestores = tasksToRestore.filter(
      (t) => (!userId || !t.userId || t.userId === userId) && !existingIds.has(t.id)
    );

    return {
      restoredCount: validRestores.length,
      updatedList: [...validRestores, ...tasks],
    };
  }

  /**
   * Checks if a completed task is still within the retention window (e.g. 30 days)
   */
  static isRecentlyCompleted(
    task: Task,
    referenceDate = '2026-09-15',
    retentionDays = COMPLETED_RETENTION_DAYS
  ): boolean {
    if (task.status !== 'completada') return false;
    if (!task.completedAt) return true;

    try {
      const completedTime = new Date(task.completedAt).getTime();
      const refTime = new Date(`${referenceDate}T23:59:59`).getTime();
      const diffDays = (refTime - completedTime) / (1000 * 60 * 60 * 24);
      return diffDays <= retentionDays;
    } catch {
      return true;
    }
  }

  /**
   * Archives completed tasks into action history.
   * If archiveAllCompleted is true (e.g. from "Limpiar completadas"), archives ALL completed tasks.
   * Otherwise, only auto-archives tasks completed more than retentionDays ago.
   */
  static archiveCompletedTasks(
    tasks: Task[],
    actionHistory: ActionHistoryItem[] = [],
    referenceDate = '2026-09-15',
    archiveAllCompleted = false,
    retentionDays = COMPLETED_RETENTION_DAYS
  ): {
    updatedTasks: Task[];
    archivedTasks: Task[];
    updatedHistory: ActionHistoryItem[];
  } {
    const remainingTasks: Task[] = [];
    const archivedTasks: Task[] = [];
    const newHistoryItems: ActionHistoryItem[] = [];

    for (const t of tasks) {
      if (t.status === 'completada') {
        const shouldArchive =
          archiveAllCompleted || !this.isRecentlyCompleted(t, referenceDate, retentionDays);

        if (shouldArchive) {
          archivedTasks.push(t);
          const actionId = `act-arch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
          const historyItem: ActionHistoryItem = {
            actionId,
            id: actionId,
            userId: t.userId || 'usr-diego-default',
            actionType: 'archive_completed_tasks',
            entity: 'task',
            entityId: t.id,
            timestamp: new Date().toISOString(),
            displayTimestamp: new Date().toLocaleString(),
            readableDescription: `Tarea archivada a Historial: "${t.title}" (Completada)`,
            summary: `Tarea archivada: ${t.title}`,
            status: 'applied',
            isReversible: true,
            previousState: { tasks: [t] },
            newState: {},
            canUndo: true,
          };
          newHistoryItems.push(historyItem);
          continue;
        }
      }
      remainingTasks.push(t);
    }

    return {
      updatedTasks: remainingTasks,
      archivedTasks,
      updatedHistory: [...newHistoryItems, ...actionHistory],
    };
  }
}
