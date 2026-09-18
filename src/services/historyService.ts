import {
  ActionEntity,
  ActionHistoryItem,
  ActionType,
  AssistantState,
  CalendarEvent,
  Reminder,
  Task,
} from '../types';
import { TaskService } from './taskService';
import { CalendarService } from './calendarService';
import { notificationService } from './notificationService';

export function formatDisplayDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return isoString;
  }
}

export class HistoryService {
  /**
   * Helper to create a structured history item
   */
  static createItem(params: {
    userId: string;
    actionType: ActionType;
    entity: ActionEntity;
    entityId?: string;
    origin?: 'assistant_tool' | 'manual';
    readableDescription: string;
    isReversible?: boolean;
    previousState?: {
      tasks?: Task[];
      events?: CalendarEvent[];
    };
    newState?: {
      tasks?: Task[];
      events?: CalendarEvent[];
    };
  }): ActionHistoryItem {
    const now = new Date().toISOString();
    return {
      actionId: `act-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      userId: params.userId,
      timestamp: now,
      displayTimestamp: formatDisplayDate(now),
      actionType: params.actionType,
      entity: params.entity,
      entityId: params.entityId,
      origin: params.origin || 'assistant_tool',
      readableDescription: params.readableDescription,
      status: 'applied',
      isReversible: params.isReversible ?? true,
      previousState: params.previousState || {},
      newState: params.newState || {},
    };
  }

  /**
   * Reverts an action securely from the History tab.
   * Can ONLY be triggered on reversible, non-reverted actions belonging to the current user.
   */
  static revertAction(
    currentState: AssistantState,
    actionId: string,
    currentUserId: string
  ): { success: boolean; message: string; updatedState: AssistantState } {
    const history = currentState.actionHistory || [];
    const targetAction = history.find((a) => a.actionId === actionId);

    if (!targetAction) {
      return {
        success: false,
        message: 'No se encontró la acción en el historial.',
        updatedState: currentState,
      };
    }

    // Security check: Verify user owns the action
    if (targetAction.userId && targetAction.userId !== currentUserId) {
      return {
        success: false,
        message: 'No tienes permiso para revertir acciones de otro usuario.',
        updatedState: currentState,
      };
    }

    // Status check: Must not already be reverted
    if (targetAction.status === 'reverted' || !targetAction.isReversible) {
      return {
        success: false,
        message: 'Esta acción ya fue revertida previamente o no es reversible.',
        updatedState: currentState,
      };
    }

    let updatedTasks = [...currentState.tasks];
    let updatedEvents = [...currentState.events];
    let updatedReminders = [...(currentState.reminders || [])];
    let revertSummary = '';

    const prev = targetAction.previousState;
    const nxt = targetAction.newState;

    switch (targetAction.actionType) {
      case 'create_reminder': {
        const createdId = targetAction.entityId || nxt?.reminders?.[0]?.id;
        if (createdId) {
          updatedReminders = updatedReminders.filter((r) => r.id !== createdId);
          notificationService.cancelReminderInBackend(createdId);
          revertSummary = 'Se canceló el recordatorio creado por el asistente.';
        }
        break;
      }

      case 'update_reminder': {
        const prevRem = prev?.reminders?.[0];
        if (prevRem) {
          updatedReminders = updatedReminders.map((r) => (r.id === prevRem.id ? prevRem : r));
          if (prevRem.status === 'scheduled') {
            notificationService.scheduleReminderInBackend(prevRem);
          } else {
            notificationService.cancelReminderInBackend(prevRem.id);
          }
          revertSummary = `Se restauró el recordatorio "${prevRem.title}".`;
        }
        break;
      }

      case 'cancel_reminder': {
        const remToRestore = prev?.reminders?.[0];
        if (remToRestore) {
          const exists = updatedReminders.some((r) => r.id === remToRestore.id);
          if (exists) {
            updatedReminders = updatedReminders.map((r) => (r.id === remToRestore.id ? remToRestore : r));
          } else {
            updatedReminders.push(remToRestore);
          }
          if (remToRestore.status === 'scheduled') {
            notificationService.scheduleReminderInBackend(remToRestore);
          }
          revertSummary = `Se reactivó el recordatorio "${remToRestore.title}".`;
        }
        break;
      }

      case 'delete_task':
      case 'delete_multiple_tasks':
      case 'delete_all_tasks': {
        const tasksToRestore = prev?.tasks || [];
        if (tasksToRestore.length > 0) {
          const res = TaskService.restoreTasks(updatedTasks, tasksToRestore, currentUserId);
          updatedTasks = res.updatedList;
          revertSummary = `Se restauraron ${res.restoredCount} tarea(s) eliminada(s).`;
        } else {
          revertSummary = 'No había tareas previas para restaurar.';
        }
        break;
      }

      case 'create_task': {
        // Rollback creation by removing the created task
        const createdId = targetAction.entityId || nxt?.tasks?.[0]?.id;
        if (createdId) {
          const res = TaskService.deleteTask(updatedTasks, createdId, currentUserId);
          updatedTasks = res.updatedList;
          revertSummary = 'Se eliminó la tarea creada por el asistente.';
        }
        break;
      }

      case 'update_task': {
        // Restore previous task state
        const prevTask = prev?.tasks?.[0];
        if (prevTask) {
          const res = TaskService.updateTask(updatedTasks, prevTask.id, prevTask);
          updatedTasks = res.updatedList;
          revertSummary = `Se restauró el estado anterior de la tarea "${prevTask.title}".`;
        }
        break;
      }

      case 'delete_event':
      case 'delete_multiple_events':
      case 'delete_all_events': {
        const eventsToRestore = prev?.events || [];
        if (eventsToRestore.length > 0) {
          const res = CalendarService.restoreEvents(updatedEvents, eventsToRestore, currentUserId);
          updatedEvents = res.updatedList;
          revertSummary = `Se restauraron ${res.restoredCount} evento(s) del calendario.`;
        } else {
          revertSummary = 'No había eventos previos para restaurar.';
        }
        break;
      }

      case 'create_event': {
        // Rollback creation by removing the created event
        const createdId = targetAction.entityId || nxt?.events?.[0]?.id;
        if (createdId) {
          const res = CalendarService.deleteEvent(updatedEvents, createdId, currentUserId);
          updatedEvents = res.updatedList;
          revertSummary = 'Se eliminó el evento creado por el asistente.';
        }
        break;
      }

      case 'update_event': {
        // Restore previous event state
        const prevEvent = prev?.events?.[0];
        if (prevEvent) {
          const res = CalendarService.updateEvent(updatedEvents, prevEvent.id, prevEvent);
          updatedEvents = res.updatedList;
          revertSummary = `Se restauró el estado anterior del evento "${prevEvent.title}".`;
        }
        break;
      }

      case 'delete_all_tasks_and_events': {
        const tasksToRestore = prev?.tasks || [];
        const eventsToRestore = prev?.events || [];

        let tCount = 0;
        let eCount = 0;

        if (tasksToRestore.length > 0) {
          const resT = TaskService.restoreTasks(updatedTasks, tasksToRestore, currentUserId);
          updatedTasks = resT.updatedList;
          tCount = resT.restoredCount;
        }

        if (eventsToRestore.length > 0) {
          const resE = CalendarService.restoreEvents(updatedEvents, eventsToRestore, currentUserId);
          updatedEvents = resE.updatedList;
          eCount = resE.restoredCount;
        }

        revertSummary = `Se restauraron ${tCount} tarea(s) y ${eCount} evento(s) del calendario.`;
        break;
      }

      default: {
        return {
          success: false,
          message: `El tipo de acción "${targetAction.actionType}" no soporta reversión automática.`,
          updatedState: currentState,
        };
      }
    }

    const revertTime = new Date().toISOString();
    const displayRevertTime = formatDisplayDate(revertTime);

    // Update target action in place to prevent second reversion
    const updatedHistory: ActionHistoryItem[] = history.map((item) => {
      if (item.actionId === actionId) {
        return {
          ...item,
          status: 'reverted' as const,
          isReversible: false,
          revertedAt: revertTime,
          revertedSummary: revertSummary,
        };
      }
      return item;
    });

    // Add companion record in history indicating the reversion completed
    const companionRecord: ActionHistoryItem = {
      actionId: `act-rev-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      userId: currentUserId,
      timestamp: revertTime,
      displayTimestamp: displayRevertTime,
      actionType: 'revert_action',
      entity: targetAction.entity,
      entityId: targetAction.entityId,
      origin: 'manual',
      readableDescription: `Acción revertida. ${revertSummary}`,
      status: 'applied',
      isReversible: false,
      previousState: {},
      newState: {},
    };

    const finalState: AssistantState = {
      ...currentState,
      tasks: updatedTasks,
      events: updatedEvents,
      reminders: updatedReminders,
      actionHistory: [companionRecord, ...updatedHistory],
    };

    return {
      success: true,
      message: `Acción revertida exitosamente. ${revertSummary}`,
      updatedState: finalState,
    };
  }
}
