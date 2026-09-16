import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Lazy initialization of Gemini client
let genAIClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!genAIClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured in environment variables');
    }
    genAIClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return genAIClient;
}

// Resilient Model Selection & Fallbacks
// gemini-3.1-flash-lite is the primary model due to high speed, reliability and generous free-tier limits.
function getOrderedTextModels(): string[] {
  return ['gemini-3.1-flash-lite', 'gemini-3.8-flash'];
}

function getOrderedAudioModels(): string[] {
  return ['gemini-3.1-flash-lite', 'gemini-3.8-flash'];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Keep track of models that have hit daily quota limits so we don't repeat failing calls
const dailyQuotaExhaustedModels = new Set<string>();

function isRetryableError(error: any): boolean {
  if (!error) return false;
  const status = error.status || error.code || error.statusCode;
  if (status === 503 || status === 429 || status === 500 || status === 502 || status === 504) {
    return true;
  }
  const msg = (error.message || '').toLowerCase();
  return (
    msg.includes('503') ||
    msg.includes('429') ||
    msg.includes('unavailable') ||
    msg.includes('high demand') ||
    msg.includes('spikes in demand') ||
    msg.includes('quota') ||
    msg.includes('resource has been exhausted') ||
    msg.includes('rate limit') ||
    msg.includes('rate-limit') ||
    msg.includes('temporarily') ||
    msg.includes('overloaded') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('fetch failed')
  );
}

async function generateContentWithFallback(
  ai: GoogleGenAI,
  requestParams: any,
  candidateModels?: string[]
): Promise<any> {
  const baseModels = candidateModels && candidateModels.length > 0 ? candidateModels : getOrderedTextModels();
  // Filter out models known to have exhausted daily quota, unless it's the only one left
  const availableModels = baseModels.filter((m) => !dailyQuotaExhaustedModels.has(m));
  const models = availableModels.length > 0 ? availableModels : baseModels;

  let lastError: any = null;

  for (let m = 0; m < models.length; m++) {
    const model = models[m];
    let modelError: any = null;
    const maxAttempts = 2;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await ai.models.generateContent({
          ...requestParams,
          model,
        });

        // A response is valid if it has function calls, non-empty text, or candidate parts
        const hasFunctionCalls = Array.isArray(response.functionCalls) && response.functionCalls.length > 0;
        const hasText = typeof response.text === 'string' && response.text.trim().length > 0;
        const hasValidParts = Array.isArray(response.candidates) &&
          response.candidates.length > 0 &&
          Boolean(response.candidates[0].content?.parts?.length);

        const isValidResponse = hasFunctionCalls || hasText || hasValidParts;

        if (isValidResponse) {
          return response;
        }

        // Only in the rare case of an empty response with no content or calls
        if (m < models.length - 1) {
          console.warn(`[Gemini] Model ${model} returned empty response with no parts or calls. Trying next model.`);
          break; // Break inner retry loop to try next model
        }

        return response;
      } catch (err: any) {
        modelError = err;
        lastError = err;
        const msg = (err?.message || '').toLowerCase();
        const status = err?.status || err?.code || err?.statusCode;

        // Check if this is a daily quota exhaustion for this specific model
        const isDailyQuota =
          msg.includes('perday') ||
          msg.includes('daily') ||
          msg.includes('generaterequestsperday') ||
          (msg.includes('limit: 20') && msg.includes('quota exceeded'));

        if (isDailyQuota) {
          console.warn(`[Gemini] Model ${model} daily quota exhausted (${status}). Flagging to skip.`);
          dailyQuotaExhaustedModels.add(model);
          // Don't retry this model, advance immediately to next model
          break;
        }

        const retryable = isRetryableError(err);
        if (retryable && attempt < maxAttempts) {
          // Extract suggested retry delay if available (e.g., "retry in 3.5s")
          let waitMs = attempt * 850;
          const match = msg.match(/retry in ([0-9.]+)s/);
          if (match && match[1]) {
            const parsedSeconds = parseFloat(match[1]);
            if (parsedSeconds > 0 && parsedSeconds <= 3) {
              waitMs = Math.ceil(parsedSeconds * 1000);
            }
          }
          console.log(`[Gemini] Transient error on ${model} (attempt ${attempt}/${maxAttempts}). Retrying in ${waitMs}ms...`);
          await sleep(waitMs);
          continue;
        }

        break;
      }
    }

    if (modelError && m < models.length - 1) {
      console.log(`[Gemini] Model ${model} failed (${modelError.status || modelError.message}). Transitioning to fallback ${models[m + 1]}...`);
      await sleep(250);
    }
  }

  throw lastError;
}

// Function declarations for Gemini tools
const toolDeclarations: FunctionDeclaration[] = [
  {
    name: 'create_calendar_event',
    description: 'Crea un nuevo evento o actividad en el calendario.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Título del evento o actividad' },
        date: { type: Type.STRING, description: 'Fecha en formato YYYY-MM-DD' },
        startTime: { type: Type.STRING, description: 'Hora de inicio en formato HH:mm (ej. "16:00")' },
        endTime: { type: Type.STRING, description: 'Hora de fin en formato HH:mm (ej. "17:00")' },
        location: { type: Type.STRING, description: 'Lugar o dirección de la actividad' },
        description: { type: Type.STRING, description: 'Descripción o notas detalladas' },
        relatedPerson: { type: Type.STRING, description: 'Persona relacionada (ej. "Juan", "Carlos")' },
        relatedProject: { type: Type.STRING, description: 'Proyecto relacionado (ej. "Venta departamento Miraflores")' },
        status: {
          type: Type.STRING,
          description: 'Estado: "posible", "no_confirmado", "confirmado", "cancelado", "completado". Si el usuario dijo que todavía no está confirmado, usar "no_confirmado" o "posible".',
        },
        notes: { type: Type.STRING, description: 'Notas adicionales o cosas para llevar' },
      },
      required: ['title', 'date', 'startTime', 'status'],
    },
  },
  {
    name: 'update_calendar_event',
    description: 'Actualiza un evento existente (por ejemplo cuando el usuario dice "ya confirmó", cambiar estado a "confirmado", o cambiar fecha/hora). Busca primero por título o ID.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING, description: 'ID del evento si se conoce' },
        titleMatch: { type: Type.STRING, description: 'Palabras clave o título para buscar el evento existente si no se conoce el ID' },
        status: { type: Type.STRING, description: 'Nuevo estado: "confirmado", "no_confirmado", "posible", "cancelado", "completado"' },
        date: { type: Type.STRING, description: 'Nueva fecha YYYY-MM-DD' },
        startTime: { type: Type.STRING, description: 'Nueva hora de inicio HH:mm' },
        endTime: { type: Type.STRING, description: 'Nueva hora de fin HH:mm' },
        location: { type: Type.STRING, description: 'Nueva ubicación' },
        description: { type: Type.STRING, description: 'Nueva descripción' },
        notes: { type: Type.STRING, description: 'Nuevas notas' },
      },
      required: [],
    },
  },
  {
    name: 'delete_calendar_event',
    description: 'Elimina un evento o cita específica del calendario.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING, description: 'ID del evento a eliminar si se conoce' },
        titleMatch: { type: Type.STRING, description: 'Título o palabras clave del evento a eliminar' },
        dateMatch: { type: Type.STRING, description: 'Fecha opcional del evento (YYYY-MM-DD)' },
      },
    },
  },
  {
    name: 'delete_multiple_events',
    description: 'Elimina múltiples eventos del calendario según criterios (ej. todos los de hoy, todos los de mañana, o lista de IDs).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        ids: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Lista de IDs específicos de eventos a eliminar' },
        dateMatch: { type: Type.STRING, description: 'Fecha de los eventos a eliminar (YYYY-MM-DD)' },
        filterCondition: { type: Type.STRING, description: 'Descripción o criterio de filtro (ej. "eventos de hoy", "reuniones de la mañana")' },
      },
    },
  },
  {
    name: 'delete_all_events',
    description: 'Elimina todos los eventos del calendario del usuario. Solo debe ejecutarse si el usuario confirmó explícitamente la acción.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        confirmed: { type: Type.BOOLEAN, description: 'True si el usuario confirmó explícitamente' },
      },
      required: ['confirmed'],
    },
  },
  {
    name: 'create_task',
    description: 'Crea una tarea pendiente o recordatorio en el sistema de tareas.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Título de la tarea (ej. "Llamar al propietario", "Enviar documentos a Pedro")' },
        description: { type: Type.STRING, description: 'Detalle o descripción de la tarea' },
        dueDate: { type: Type.STRING, description: 'Fecha límite en formato YYYY-MM-DD o descripción de plazo (ej. "2026-09-16", "esta semana")' },
        dueTime: { type: Type.STRING, description: 'Hora específica de la tarea o recordatorio (ej. "14:00")' },
        priority: { type: Type.STRING, description: 'Prioridad: "alta", "media", "baja"' },
        status: { type: Type.STRING, description: 'Estado: "pendiente", "en_progreso", "completada", "en_espera"' },
        relatedPerson: { type: Type.STRING, description: 'Persona involucrada' },
        relatedProject: { type: Type.STRING, description: 'Proyecto involucrado' },
        location: { type: Type.STRING, description: 'Lugar' },
        reminder: { type: Type.STRING, description: 'Hora o nota del recordatorio' },
      },
      required: ['title', 'priority'],
    },
  },
  {
    name: 'update_task',
    description: 'Actualiza una tarea existente (completar, cambiar fecha, etc.).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING, description: 'ID de la tarea' },
        titleMatch: { type: Type.STRING, description: 'Título para buscar la tarea' },
        status: { type: Type.STRING, description: 'Nuevo estado ("completada", "pendiente", etc.)' },
        priority: { type: Type.STRING, description: 'Nueva prioridad' },
        dueDate: { type: Type.STRING, description: 'Nueva fecha límite' },
        dueTime: { type: Type.STRING, description: 'Nueva hora' },
      },
    },
  },
  {
    name: 'delete_task',
    description: 'Elimina una tarea específica de la lista de tareas del usuario (ej. "borra la tarea de llamar al propietario", "elimina la tarea de mañana").',
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING, description: 'ID de la tarea si se conoce' },
        titleMatch: { type: Type.STRING, description: 'Título o palabras clave de la tarea a eliminar' },
        dueDateMatch: { type: Type.STRING, description: 'Fecha límite de la tarea para filtrar' },
      },
    },
  },
  {
    name: 'delete_multiple_tasks',
    description: 'Elimina varias tareas del usuario según criterios (ej. tareas de hoy, tareas completadas, tareas de un proyecto, o lista de IDs).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        ids: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Lista de IDs específicos de tareas a eliminar' },
        dateMatch: { type: Type.STRING, description: 'Fecha de las tareas a eliminar (YYYY-MM-DD)' },
        statusMatch: { type: Type.STRING, description: 'Estado de las tareas a eliminar (ej. "completada", "pendiente")' },
        filterCondition: { type: Type.STRING, description: 'Descripción o criterio de filtro' },
      },
    },
  },
  {
    name: 'delete_all_tasks',
    description: 'Elimina todas las tareas de la lista del usuario actual. Solo debe ejecutarse si el usuario confirmó explícitamente la acción.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        confirmed: { type: Type.BOOLEAN, description: 'True si el usuario confirmó explícitamente' },
      },
      required: ['confirmed'],
    },
  },
  {
    name: 'delete_all_tasks_and_events',
    description: 'Elimina simultáneamente todas las tareas y todos los eventos del calendario del usuario para empezar de cero. Genera una única entrada en Historial. Solo debe ejecutarse si el usuario confirmó explícitamente la acción.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        confirmed: { type: Type.BOOLEAN, description: 'True si el usuario confirmó explícitamente' },
      },
      required: ['confirmed'],
    },
  },
  {
    name: 'create_or_update_memory',
    description: 'Guarda o actualiza información importante en la memoria contextual a largo plazo (preferencias, detalles de clientes, decisiones, qué llevar a una reunión, etc.).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Título clave del recuerdo' },
        content: { type: Type.STRING, description: 'Contenido detallado que debe recordarse en el futuro' },
        category: { type: Type.STRING, description: 'Categoría: "persona", "proyecto", "lugar", "compromiso", "preferencia", "decision", "general"' },
        relatedPerson: { type: Type.STRING, description: 'Persona vinculada' },
        relatedProject: { type: Type.STRING, description: 'Proyecto vinculado' },
        relatedPlace: { type: Type.STRING, description: 'Lugar vinculado' },
        tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Etiquetas para búsqueda rápida' },
      },
      required: ['title', 'content', 'category'],
    },
  },
  {
    name: 'create_or_update_person',
    description: 'Registra o actualiza información contextual de una persona o cliente (intereses, pendientes, etc.).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: 'Nombre de la persona' },
        role: { type: Type.STRING, description: 'Rol o descripción (ej. "Comprador potencial", "Arquitecto")' },
        context: { type: Type.STRING, description: 'Contexto relevante acumulado' },
        relatedProject: { type: Type.STRING, description: 'Proyecto con el que se relaciona' },
        pendingItems: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Pendientes con esta persona' },
        phone: { type: Type.STRING, description: 'Teléfono si se menciona' },
      },
      required: ['name', 'context'],
    },
  },
  {
    name: 'create_or_update_project',
    description: 'Registra o actualiza un proyecto.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: 'Nombre del proyecto' },
        description: { type: Type.STRING, description: 'Descripción o estado del proyecto' },
        status: { type: Type.STRING, description: '"activo", "en_pausa", "completado"' },
        keyPeople: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Personas clave' },
        keyInformation: { type: Type.STRING, description: 'Datos importantes' },
      },
      required: ['name', 'description'],
    },
  },
  {
    name: 'create_relationship',
    description: 'Crea una relación entre entidades en el grafo contextual (ej. "Juan" -> "interesado en" -> "Departamento Miraflores").',
    parameters: {
      type: Type.OBJECT,
      properties: {
        from: { type: Type.STRING, description: 'Entidad de origen' },
        relation: { type: Type.STRING, description: 'Tipo de relación (ej. "interesado en", "pertenece al proyecto", "tiene pendiente")' },
        to: { type: Type.STRING, description: 'Entidad de destino' },
        context: { type: Type.STRING, description: 'Detalle opcional' },
      },
      required: ['from', 'relation', 'to'],
    },
  },
];

// Helper to format display timestamp
function formatDisplayDate(isoString: string): string {
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

// Helper to execute tool calls on backend state copy
function executeTool(call: { name: string; args: any }, state: any) {
  const { name, args } = call;
  const actions: Array<{ type: any; label: string; details: string }> = [];
  const currentUserId = state.userId || 'usr-diego-default';

  if (!state.actionHistory) {
    state.actionHistory = [];
  }

  const recordHistory = (item: {
    actionType: any;
    entity: any;
    entityId: string;
    readableDescription: string;
    previousState: any;
    newState: any;
  }) => {
    const nowIso = new Date().toISOString();
    const historyItem = {
      actionId: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      userId: currentUserId,
      timestamp: nowIso,
      displayTimestamp: formatDisplayDate(nowIso),
      actionType: item.actionType,
      entity: item.entity,
      entityId: item.entityId,
      origin: 'assistant_tool',
      readableDescription: item.readableDescription,
      status: 'applied',
      isReversible: true,
      previousState: item.previousState || {},
      newState: item.newState || {},
    };
    state.actionHistory.unshift(historyItem);
    return historyItem;
  };

  switch (name) {
    case 'create_calendar_event': {
      const id = `evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const newEv = {
        id,
        userId: currentUserId,
        title: args.title,
        date: args.date,
        startTime: args.startTime,
        endTime: args.endTime || '17:00',
        location: args.location || '',
        description: args.description || '',
        relatedPerson: args.relatedPerson || '',
        relatedProject: args.relatedProject || '',
        status: args.status || 'confirmado',
        notes: args.notes || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      state.events.push(newEv);
      actions.push({
        type: 'create_event',
        label: `Evento agendado: ${newEv.title}`,
        details: `${newEv.date} a las ${newEv.startTime} (${newEv.status})`,
      });

      recordHistory({
        actionType: 'create_event',
        entity: 'event',
        entityId: id,
        readableDescription: `Evento programado: "${newEv.title}" para ${newEv.date} ${newEv.startTime}`,
        previousState: {},
        newState: { events: [newEv] },
      });

      return { success: true, eventId: id, event: newEv, actions };
    }

    case 'update_calendar_event': {
      let found = false;
      let matchedEv: any = null;
      let prevEv: any = null;
      for (const ev of state.events) {
        if (
          (!ev.userId || ev.userId === currentUserId) &&
          ((args.id && ev.id === args.id) || (args.titleMatch && ev.title.toLowerCase().includes(args.titleMatch.toLowerCase())))
        ) {
          prevEv = JSON.parse(JSON.stringify(ev));
          if (args.status) ev.status = args.status;
          if (args.date) ev.date = args.date;
          if (args.startTime) ev.startTime = args.startTime;
          if (args.endTime) ev.endTime = args.endTime;
          if (args.location) ev.location = args.location;
          if (args.description) ev.description = args.description;
          if (args.notes) ev.notes = args.notes;
          ev.updatedAt = new Date().toISOString();
          found = true;
          matchedEv = ev;
          break;
        }
      }
      if (found) {
        actions.push({
          type: 'update_event',
          label: `Evento actualizado: ${matchedEv.title}`,
          details: `Estado: ${matchedEv.status}, Fecha: ${matchedEv.date} ${matchedEv.startTime}`,
        });

        recordHistory({
          actionType: 'update_event',
          entity: 'event',
          entityId: matchedEv.id,
          readableDescription: `Evento modificado: "${matchedEv.title}" (${matchedEv.status})`,
          previousState: { events: [prevEv] },
          newState: { events: [JSON.parse(JSON.stringify(matchedEv))] },
        });

        return { success: true, event: matchedEv, actions };
      }
      return { success: false, message: 'Evento no encontrado para actualizar', actions };
    }

    case 'delete_calendar_event': {
      const idx = state.events.findIndex(
        (ev: any) =>
          (!ev.userId || ev.userId === currentUserId) &&
          ((args.id && ev.id === args.id) ||
            (args.titleMatch && ev.title.toLowerCase().includes(args.titleMatch.toLowerCase())) ||
            (args.dateMatch && ev.date === args.dateMatch))
      );
      if (idx !== -1) {
        const removed = state.events.splice(idx, 1)[0];
        actions.push({
          type: 'delete_event',
          label: `Evento eliminado: ${removed.title}`,
          details: `${removed.date} ${removed.startTime}`,
        });

        recordHistory({
          actionType: 'delete_event',
          entity: 'event',
          entityId: removed.id,
          readableDescription: `Evento eliminado: "${removed.title}" (${removed.date} ${removed.startTime})`,
          previousState: { events: [removed] },
          newState: {},
        });

        return { success: true, removed, actions };
      }
      return { success: false, message: 'Evento no encontrado para eliminar', actions };
    }

    case 'delete_multiple_events': {
      const matchedEvents: any[] = [];
      const remainingEvents: any[] = [];

      for (const ev of state.events) {
        if (ev.userId && ev.userId !== currentUserId) {
          remainingEvents.push(ev);
          continue;
        }

        let isMatch = false;
        if (Array.isArray(args.ids) && args.ids.includes(ev.id)) {
          isMatch = true;
        } else if (args.dateMatch && ev.date === args.dateMatch) {
          isMatch = true;
        }

        if (isMatch) {
          matchedEvents.push(ev);
        } else {
          remainingEvents.push(ev);
        }
      }

      if (matchedEvents.length === 0) {
        return { success: false, message: 'No se encontraron eventos que coincidan con el criterio', actions };
      }

      state.events = remainingEvents;
      actions.push({
        type: 'delete_multiple_events',
        label: `${matchedEvents.length} eventos eliminados`,
        details: `Criterio: ${args.filterCondition || args.dateMatch || 'Selección múltiple'}`,
      });

      recordHistory({
        actionType: 'delete_multiple_events',
        entity: 'events_multiple',
        entityId: `bulk-evt-${Date.now()}`,
        readableDescription: `Se eliminaron ${matchedEvents.length} eventos del calendario mediante el asistente.`,
        previousState: { events: matchedEvents },
        newState: {},
      });

      return { success: true, count: matchedEvents.length, removedEvents: matchedEvents, actions };
    }

    case 'delete_all_events': {
      const userEvents = state.events.filter((ev: any) => !ev.userId || ev.userId === currentUserId);
      const otherEvents = state.events.filter((ev: any) => ev.userId && ev.userId !== currentUserId);

      if (userEvents.length === 0) {
        return { success: true, count: 0, message: 'No había eventos en el calendario para eliminar.', actions };
      }

      state.events = otherEvents;
      actions.push({
        type: 'delete_all_events',
        label: `Calendario limpiado (${userEvents.length} eventos)`,
        details: 'Se eliminaron todos los eventos del calendario',
      });

      recordHistory({
        actionType: 'delete_all_events',
        entity: 'events_all',
        entityId: `all-evt-${Date.now()}`,
        readableDescription: `Se eliminaron todos los eventos (${userEvents.length}) del calendario mediante el asistente.`,
        previousState: { events: userEvents },
        newState: {},
      });

      return { success: true, count: userEvents.length, removedEvents: userEvents, actions };
    }

    case 'create_task': {
      const id = `tsk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const newTask = {
        id,
        userId: currentUserId,
        title: args.title,
        description: args.description || '',
        dueDate: args.dueDate || '',
        dueTime: args.dueTime || '',
        priority: args.priority || 'media',
        status: args.status || 'pendiente',
        relatedPerson: args.relatedPerson || '',
        relatedProject: args.relatedProject || '',
        location: args.location || '',
        reminder: args.reminder || '',
        createdAt: new Date().toISOString(),
      };
      state.tasks.unshift(newTask);
      actions.push({
        type: 'create_task',
        label: `Tarea creada: ${newTask.title}`,
        details: `Plazo: ${newTask.dueDate || 'Sin fecha'} ${newTask.dueTime || ''} (${newTask.priority})`,
      });

      recordHistory({
        actionType: 'create_task',
        entity: 'task',
        entityId: id,
        readableDescription: `Tarea creada: "${newTask.title}" (Prioridad: ${newTask.priority})`,
        previousState: {},
        newState: { tasks: [newTask] },
      });

      return { success: true, taskId: id, task: newTask, actions };
    }

    case 'update_task': {
      let found = false;
      let matchedTask: any = null;
      let prevTask: any = null;
      for (const t of state.tasks) {
        if (
          (!t.userId || t.userId === currentUserId) &&
          ((args.id && t.id === args.id) || (args.titleMatch && t.title.toLowerCase().includes(args.titleMatch.toLowerCase())))
        ) {
          prevTask = JSON.parse(JSON.stringify(t));
          if (args.status) {
            t.status = args.status;
            if (args.status === 'completada') t.completedAt = new Date().toISOString();
          }
          if (args.priority) t.priority = args.priority;
          if (args.dueDate) t.dueDate = args.dueDate;
          if (args.dueTime) t.dueTime = args.dueTime;
          found = true;
          matchedTask = t;
          break;
        }
      }
      if (found) {
        actions.push({
          type: 'update_task',
          label: `Tarea actualizada: ${matchedTask.title}`,
          details: `Estado: ${matchedTask.status}`,
        });

        recordHistory({
          actionType: 'update_task',
          entity: 'task',
          entityId: matchedTask.id,
          readableDescription: `Tarea modificada: "${matchedTask.title}" (Estado: ${matchedTask.status})`,
          previousState: { tasks: [prevTask] },
          newState: { tasks: [JSON.parse(JSON.stringify(matchedTask))] },
        });

        return { success: true, task: matchedTask, actions };
      }
      return { success: false, message: 'Tarea no encontrada para actualizar', actions };
    }

    case 'delete_task': {
      const idx = state.tasks.findIndex(
        (t: any) =>
          (!t.userId || t.userId === currentUserId) &&
          ((args.id && t.id === args.id) ||
            (args.titleMatch && t.title.toLowerCase().includes(args.titleMatch.toLowerCase())) ||
            (args.dueDateMatch && t.dueDate === args.dueDateMatch))
      );
      if (idx !== -1) {
        const removed = state.tasks.splice(idx, 1)[0];
        actions.push({
          type: 'delete_task',
          label: `Tarea eliminada: ${removed.title}`,
          details: `Prioridad: ${removed.priority}`,
        });

        recordHistory({
          actionType: 'delete_task',
          entity: 'task',
          entityId: removed.id,
          readableDescription: `Tarea eliminada: "${removed.title}"`,
          previousState: { tasks: [removed] },
          newState: {},
        });

        return { success: true, removed, actions };
      }
      return { success: false, message: 'Tarea no encontrada para eliminar', actions };
    }

    case 'delete_multiple_tasks': {
      const matchedTasks: any[] = [];
      const remainingTasks: any[] = [];

      for (const t of state.tasks) {
        if (t.userId && t.userId !== currentUserId) {
          remainingTasks.push(t);
          continue;
        }

        let isMatch = false;
        if (Array.isArray(args.ids) && args.ids.includes(t.id)) {
          isMatch = true;
        } else if (args.dateMatch && t.dueDate === args.dateMatch) {
          isMatch = true;
        } else if (args.statusMatch && t.status === args.statusMatch) {
          isMatch = true;
        }

        if (isMatch) {
          matchedTasks.push(t);
        } else {
          remainingTasks.push(t);
        }
      }

      if (matchedTasks.length === 0) {
        return { success: false, message: 'No se encontraron tareas con el criterio especificado', actions };
      }

      state.tasks = remainingTasks;
      actions.push({
        type: 'delete_multiple_tasks',
        label: `${matchedTasks.length} tareas eliminadas`,
        details: `Criterio: ${args.filterCondition || args.statusMatch || args.dateMatch || 'Selección múltiple'}`,
      });

      recordHistory({
        actionType: 'delete_multiple_tasks',
        entity: 'tasks_multiple',
        entityId: `bulk-tsk-${Date.now()}`,
        readableDescription: `Se eliminaron ${matchedTasks.length} tareas mediante el asistente.`,
        previousState: { tasks: matchedTasks },
        newState: {},
      });

      return { success: true, count: matchedTasks.length, removedTasks: matchedTasks, actions };
    }

    case 'delete_all_tasks': {
      const userTasks = state.tasks.filter((t: any) => !t.userId || t.userId === currentUserId);
      const otherTasks = state.tasks.filter((t: any) => t.userId && t.userId !== currentUserId);

      if (userTasks.length === 0) {
        return { success: true, count: 0, message: 'No había tareas registradas para eliminar.', actions };
      }

      state.tasks = otherTasks;
      actions.push({
        type: 'delete_all_tasks',
        label: `Todas las tareas eliminadas (${userTasks.length})`,
        details: 'Lista de tareas vaciada por el usuario',
      });

      recordHistory({
        actionType: 'delete_all_tasks',
        entity: 'tasks_all',
        entityId: `all-tsk-${Date.now()}`,
        readableDescription: `Se eliminaron ${userTasks.length} tareas mediante el asistente.`,
        previousState: { tasks: userTasks },
        newState: {},
      });

      return { success: true, count: userTasks.length, removedTasks: userTasks, actions };
    }

    case 'delete_all_tasks_and_events': {
      const userTasks = state.tasks.filter((t: any) => !t.userId || t.userId === currentUserId);
      const otherTasks = state.tasks.filter((t: any) => t.userId && t.userId !== currentUserId);
      const userEvents = state.events.filter((ev: any) => !ev.userId || ev.userId === currentUserId);
      const otherEvents = state.events.filter((ev: any) => ev.userId && ev.userId !== currentUserId);

      state.tasks = otherTasks;
      state.events = otherEvents;

      actions.push({
        type: 'delete_all_tasks_and_events',
        label: `Reinicio completo: ${userTasks.length} tareas y ${userEvents.length} eventos eliminados`,
        details: 'Se limpiaron todas las tareas y eventos del calendario',
      });

      recordHistory({
        actionType: 'delete_all_tasks_and_events',
        entity: 'tasks_and_events_all',
        entityId: `reset-all-${Date.now()}`,
        readableDescription: `Se eliminaron ${userTasks.length} tareas y ${userEvents.length} eventos mediante el asistente.`,
        previousState: { tasks: userTasks, events: userEvents },
        newState: {},
      });

      return {
        success: true,
        tasksCount: userTasks.length,
        eventsCount: userEvents.length,
        removedTasks: userTasks,
        removedEvents: userEvents,
        actions,
      };
    }

    case 'create_or_update_memory': {
      const id = `mem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const existingIdx = state.memories.findIndex(
        (m: any) => m.title.toLowerCase() === args.title.toLowerCase() && m.category === args.category
      );
      if (existingIdx !== -1) {
        state.memories[existingIdx] = {
          ...state.memories[existingIdx],
          ...args,
          updatedAt: new Date().toISOString(),
        };
        actions.push({
          type: 'create_memory',
          label: `Memoria actualizada: ${args.title}`,
          details: args.content,
        });
        return { success: true, memory: state.memories[existingIdx], actions };
      }
      const newMem = {
        id,
        title: args.title,
        content: args.content,
        category: args.category || 'general',
        relatedPerson: args.relatedPerson || '',
        relatedProject: args.relatedProject || '',
        relatedPlace: args.relatedPlace || '',
        tags: args.tags || [],
        updatedAt: new Date().toISOString(),
      };
      state.memories.unshift(newMem);
      actions.push({
        type: 'create_memory',
        label: `Memoria guardada: ${newMem.title}`,
        details: newMem.content,
      });
      return { success: true, memory: newMem, actions };
    }

    case 'create_or_update_person': {
      const existing = state.people.find((p: any) => p.name.toLowerCase() === args.name.toLowerCase());
      if (existing) {
        if (args.role) existing.role = args.role;
        if (args.context) existing.context = args.context;
        if (args.relatedProject) existing.relatedProject = args.relatedProject;
        if (args.pendingItems) existing.pendingItems = args.pendingItems;
        if (args.phone) existing.phone = args.phone;
        existing.lastInteraction = new Date().toISOString().split('T')[0];
        actions.push({
          type: 'create_person',
          label: `Perfil actualizado: ${existing.name}`,
          details: existing.context,
        });
        return { success: true, person: existing, actions };
      }
      const newPerson = {
        id: `per-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: args.name,
        role: args.role || '',
        context: args.context,
        relatedProject: args.relatedProject || '',
        pendingItems: args.pendingItems || [],
        phone: args.phone || '',
        lastInteraction: new Date().toISOString().split('T')[0],
      };
      state.people.push(newPerson);
      actions.push({
        type: 'create_person',
        label: `Persona registrada: ${newPerson.name}`,
        details: newPerson.context,
      });
      return { success: true, person: newPerson, actions };
    }

    case 'create_or_update_project': {
      const existing = state.projects.find((prj: any) => prj.name.toLowerCase() === args.name.toLowerCase());
      if (existing) {
        if (args.description) existing.description = args.description;
        if (args.status) existing.status = args.status;
        if (args.keyPeople) existing.keyPeople = args.keyPeople;
        if (args.keyInformation) existing.keyInformation = args.keyInformation;
        existing.updatedAt = new Date().toISOString();
        actions.push({
          type: 'create_project',
          label: `Proyecto actualizado: ${existing.name}`,
          details: existing.description,
        });
        return { success: true, project: existing, actions };
      }
      const newProj = {
        id: `prj-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: args.name,
        description: args.description,
        status: args.status || 'activo',
        keyPeople: args.keyPeople || [],
        keyInformation: args.keyInformation || '',
        updatedAt: new Date().toISOString(),
      };
      state.projects.push(newProj);
      actions.push({
        type: 'create_project',
        label: `Proyecto creado: ${newProj.name}`,
        details: newProj.description,
      });
      return { success: true, project: newProj, actions };
    }

    case 'create_relationship': {
      const newRel = {
        id: `rel-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        from: args.from,
        relation: args.relation,
        to: args.to,
        context: args.context || '',
      };
      state.relationships.push(newRel);
      actions.push({
        type: 'create_relationship',
        label: `Relación conectada: ${newRel.from} ➔ ${newRel.to}`,
        details: `${newRel.relation}${newRel.context ? ` (${newRel.context})` : ''}`,
      });
      return { success: true, relationship: newRel, actions };
    }

    default:
      return { success: false, message: `Herramienta desconocida ${name}`, actions: [] };
  }
}

// POST /api/chat
app.post('/api/chat', async (req, res) => {
  try {
    const { message, context } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'El mensaje es obligatorio' });
    }

    const ai = getGenAI();
    const currentDate = context?.currentDate || '2026-09-15';
    const currentTime = context?.currentTime || '11:30';

    // Clone context state to mutate during tool execution
    const currentUserId = context?.userId || 'usr-diego-default';
    const liveState = {
      userId: currentUserId,
      events: context?.events ? JSON.parse(JSON.stringify(context.events)) : [],
      tasks: context?.tasks ? JSON.parse(JSON.stringify(context.tasks)) : [],
      people: context?.people ? JSON.parse(JSON.stringify(context.people)) : [],
      projects: context?.projects ? JSON.parse(JSON.stringify(context.projects)) : [],
      places: context?.places ? JSON.parse(JSON.stringify(context.places)) : [],
      memories: context?.memories ? JSON.parse(JSON.stringify(context.memories)) : [],
      relationships: context?.relationships ? JSON.parse(JSON.stringify(context.relationships)) : [],
      actionHistory: context?.actionHistory ? JSON.parse(JSON.stringify(context.actionHistory)) : [],
    };

    const systemInstruction = `
Eres el Asistente Personal Inteligente del usuario. Tu función principal es escuchar o leer las palabras del usuario en lenguaje natural cotidiano, comprender todo el contexto implícito y explícito, y organizar su agenda, tareas, recordatorios y memoria persistente.

FECHA ACTUAL DE REFERENCIA: ${currentDate} (Martes, 15 de Septiembre de 2026).
HORA ACTUAL: ${currentTime}.

INFORMACIÓN Y CONTEXTO ACTUAL DEL USUARIO:
- Usuario ID: ${currentUserId}
- Eventos en calendario: ${JSON.stringify(liveState.events)}
- Tareas pendientes/registradas: ${JSON.stringify(liveState.tasks)}
- Personas conocidas y contexto: ${JSON.stringify(liveState.people)}
- Proyectos activos: ${JSON.stringify(liveState.projects)}
- Lugares guardados: ${JSON.stringify(liveState.places)}
- Memoria contextual persistente: ${JSON.stringify(liveState.memories)}
- Red de relaciones entre entidades: ${JSON.stringify(liveState.relationships)}

REGLAS FUNDAMENTALES DE COMPORTAMIENTO:
1. DISTINGUIR INFORMACIÓN RIGUROSAMENTE:
   - Evento: Actividad con horario o bloque de tiempo asignado.
   - Tarea: Algo que el usuario debe hacer, pero que no necesariamente bloquea el calendario (ej: "enviarle documentos a Pedro esta semana").
   - Recordatorio: Alerta asociada a una hora o momento específico.
   - Posible actividad / No confirmada: Si el usuario dice "quiero pasar a ver el local pero no me confirman" o "quizá mañana vea al cliente", DEBE guardarse como evento con estado "no_confirmado" o "posible", NUNCA como "confirmado".
   - Información contextual: Cosas a recordar (ej: qué llevar a una reunión, precio solicitado, preferencias de una persona) -> Guarda en create_or_update_memory.

2. MANEJO DE FRASES COMPLEJAS Y MÚLTIPLES INSTRUCCIONES:
   - Si el usuario dice: "Mañana después de la reunión quiero pasar por Chorrillos a ver el local, pero el dueño todavía no me confirma. Recuérdame llamarlo a las dos para confirmar. Si confirma, entonces pon la visita a las cuatro. También tengo que llevar los documentos y revisar el precio."
     Debes:
     a) Crear evento con estado "no_confirmado" a las 16:00 (Visita a local en Chorrillos).
     b) Crear tarea: "Llamar al propietario del local para confirmar visita" a las 14:00 (dueTime: 14:00).
     c) Guardar en memoria: "Documentos para visita y revisión de precio de local en Chorrillos".
     d) Crear relación si aplica: Propietario -> Local Chorrillos -> Visita.
     e) Responder de forma clara y empática explicando exactamente qué programaste y qué condiciones quedaron establecidas.

3. ACTUALIZACIÓN INTELIGENTE (NO DUPLICAR):
   - Si el usuario luego dice: "Ya confirmó" o "Confirmó la visita":
     Busca el evento correspondiente y actualiza su estado a "confirmado" (NO crees otro evento).
   - Si el usuario pregunta "¿Qué tengo que llevar?":
     Revisa la memoria contextual y responde con precisión (ej: "Los documentos que mencionaste para la visita y revisar el precio solicitado").

4. RESPUESTA A "¿QUÉ DEBERÍA HACER HOY?":
   - Analiza el calendario del día, las tareas pendientes, las prioridades, las tareas atrasadas y los huecos libres.
   - Proporciona una recomendación estructurada, razonada y motivadora de cómo abordar el día.

5. RESPUESTA A "¿QUÉ TENGO MAÑANA?":
   - Revisa el calendario para la fecha de mañana (${currentDate} + 1 día = 2026-09-16) y menciona eventos con sus horarios y tareas clave.

6. RESPUESTA A "¿QUÉ TENGO PENDIENTE CON [PERSONA]?":
   - Cruza tareas, eventos, memorias, proyectos y relaciones asociadas a esa persona y resume claramente.

7. CONFIRMACIÓN HONESTA:
   - Solo di que creaste o modificaste algo si ejecutaste la herramienta correspondiente. Si no requería acción, conversa normalmente.
   - Sé proactivo pero nunca invasivo o artificial. Habla en español natural, profesional y cercano.

8. EJECUCIÓN REAL DE ACCIONES Y ELIMINACIONES MEDIANTE HERRAMIENTAS:
   - Tienes acceso y la obligación de utilizar herramientas reales para ejecutar modificaciones y eliminaciones:
     * delete_task: Elimina una tarea específica (ej: "borra la tarea de llamar al dueño", "elimina la tarea de mañana"). Identifica la tarea por id, titleMatch o dueDateMatch.
     * delete_multiple_tasks: Elimina varias tareas según filtro o fecha (ej: "borra las tareas de hoy", "elimina las tareas completadas").
     * delete_all_tasks: Elimina TODAS las tareas de la lista del usuario actual ("borra todas mis tareas", "elimina mi lista de tareas", "quiero empezar de cero con mis tareas").
     * delete_calendar_event: Elimina un evento puntual del calendario ("borra este evento", "cancela la visita a las 4").
     * delete_multiple_events: Elimina varios eventos ("borra los eventos de hoy", "elimina las citas de la mañana").
     * delete_all_events: Elimina TODOS los eventos del calendario ("limpia mi calendario", "elimina todos mis eventos").
     * delete_all_tasks_and_events: Elimina simultáneamente todas las tareas y eventos ("borra todo, quiero empezar de cero", "borra todas mis tareas y eventos").
   
   - CONFIRMACIÓN OBLIGATORIA PARA ELIMINACIONES MASIVAS:
     Si el usuario solicita una eliminación masiva ("borra todas mis tareas", "limpia mi calendario", "borra todo, quiero empezar de cero"):
     * Si en el turno anterior no se le pidió confirmación y no ha dicho "sí", "confirmo", "hazlo", "procede":
       NO ejecutes la herramienta todavía. Pregunta de forma clara:
       "¿Confirmas que deseas eliminar todas tus tareas / eventos / todo? Podrás revertir esta acción en cualquier momento desde la pestaña Historial."
     * Si el usuario confirma explícitamente en su mensaje ("sí", "confirmo", "elimínalas", "hazlo", "adelante", "dale", "borra todo de una vez"):
       Ejecuta inmediatamente la herramienta correspondiente (delete_all_tasks, delete_all_events, o delete_all_tasks_and_events) con { confirmed: true }.
   
   - ELIMINACIONES PUNTUALES:
     Si el usuario pide borrar una tarea o evento específico ("borra la tarea de llamar a Pedro", "elimina la reunión de las 11"):
     Ejecútalo de inmediato con delete_task o delete_calendar_event, sin confirmaciones innecesarias.

   - FRASES HIPOTÉTICAS O DUDAS:
     Si el usuario dice "Creo que debería borrar mis tareas" o "¿Qué pasaría si borro mis tareas?", NO ejecutes ninguna herramienta. Analiza y aconseja.

   - MENCIÓN DE HISTORIAL:
     Al confirmar la ejecución de cualquier eliminación o cambio, informa al usuario qué se realizó e indícale que la acción ha quedado registrada y puede revertirse en cualquier momento desde la pestaña "Historial".
`;

    // Prepare contents
    const contents: any[] = [];

    // Add recent history if provided
    if (context?.recentMessages && Array.isArray(context.recentMessages)) {
      for (const msg of context.recentMessages.slice(-6)) {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        });
      }
    }

    // Add current user prompt
    contents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    // Call Gemini with tools and dynamic fallback models
    let response = await generateContentWithFallback(ai, {
      contents,
      config: {
        systemInstruction,
        temperature: 0.2,
        tools: [{ functionDeclarations: toolDeclarations }],
      },
    });

    const accumulatedActions: Array<{ type: any; label: string; details: string }> = [];

    // Function call loop (handles multi-step actions)
    let iterations = 0;
    while (response.functionCalls && response.functionCalls.length > 0 && iterations < 5) {
      iterations++;
      const currentCalls = response.functionCalls;
      const toolResponses: any[] = [];

      for (const call of currentCalls) {
        if (!call.name) continue;
        const result = executeTool({ name: call.name, args: call.args || {} }, liveState);
        if (result.actions && result.actions.length > 0) {
          accumulatedActions.push(...result.actions);
        }
        toolResponses.push({
          functionResponse: {
            name: call.name,
            response: { result },
          },
        });
      }

      const modelCandidate = response.candidates?.[0]?.content;
      if (!modelCandidate) break;

      contents.push(modelCandidate);
      contents.push({
        role: 'user',
        parts: toolResponses,
      });

      response = await generateContentWithFallback(ai, {
        contents,
        config: {
          systemInstruction,
          temperature: 0.2,
          tools: [{ functionDeclarations: toolDeclarations }],
        },
      });
    }

    const finalText = response.text || 'Entendido. He actualizado tu información.';

    return res.json({
      text: finalText,
      actionsExecuted: accumulatedActions,
      updatedState: liveState,
    });
  } catch (error: any) {
    console.error('Error in /api/chat:', error);

    let friendlyMessage = 'Error al procesar la solicitud con Gemini.';
    let isHighDemand = false;

    try {
      const raw = typeof error?.message === 'string' ? error.message : '';
      if (raw.startsWith('{') && raw.includes('"message"')) {
        const parsed = JSON.parse(raw);
        if (parsed?.error?.message) {
          friendlyMessage = parsed.error.message;
        }
      } else if (raw) {
        friendlyMessage = raw;
      }
    } catch {
      // fallback to raw
    }

    const lower = friendlyMessage.toLowerCase();
    if (
      lower.includes('high demand') ||
      lower.includes('unavailable') ||
      lower.includes('503') ||
      lower.includes('spikes in demand') ||
      lower.includes('quota') ||
      lower.includes('rate-limit') ||
      lower.includes('rate limit') ||
      lower.includes('resource has been exhausted') ||
      lower.includes('resource_exhausted') ||
      lower.includes('429') ||
      error?.status === 503 ||
      error?.code === 503 ||
      error?.status === 429 ||
      error?.code === 429
    ) {
      isHighDemand = true;
      friendlyMessage =
        'El servicio de Gemini está experimentando alta demanda momentánea o límite de frecuencia en la versión gratuita. Tus datos están intactos; por favor espera unos segundos y presiona Reintentar.';
    }

    return res.status(isHighDemand ? 503 : 500).json({
      error: friendlyMessage,
      isHighDemand,
    });
  }
});

// POST /api/transcribe-audio
// Receives base64 audio and transcribes it using Gemini
app.post('/api/transcribe-audio', async (req, res) => {
  try {
    const { base64Data, mimeType } = req.body;
    if (!base64Data) {
      return res.status(400).json({ error: 'Falta base64Data del audio' });
    }

    const ai = getGenAI();
    const rawMime = typeof mimeType === 'string' ? mimeType : 'audio/webm';
    // Gemini inlineData requires pure MIME type without parameters (e.g. 'audio/webm', not 'audio/webm;codecs=opus')
    const effectiveMime = rawMime.split(';')[0].trim().toLowerCase() || 'audio/webm';

    console.log(`[Audio Transcribe] Processing audio (${base64Data.length} chars, mime: ${effectiveMime})`);

    const response = await generateContentWithFallback(
      ai,
      {
        contents: [
          {
            parts: [
              {
                inlineData: {
                  data: base64Data,
                  mimeType: effectiveMime,
                },
              },
              {
                text: 'Transcribe todo lo que dice el usuario en este audio en español. Si en el audio no se distingue ninguna voz humana o solo hay silencio absoluto o estática, responde exactamente: [SILENCIO]. Devuelve únicamente las palabras habladas transcritas fielmente, sin comillas, etiquetas ni aclaraciones.',
              },
            ],
          },
        ],
      },
      getOrderedAudioModels()
    );

    let transcript = response.text?.trim() || '';
    console.log(`[Audio Transcribe] Raw result: "${transcript}"`);

    if (/^\[?silencio\]?$/i.test(transcript) || transcript.toUpperCase().includes('[SILENCIO]')) {
      transcript = '';
    }
    if (
      (transcript.startsWith('"') && transcript.endsWith('"')) ||
      (transcript.startsWith('«') && transcript.endsWith('»')) ||
      (transcript.startsWith("'") && transcript.endsWith("'"))
    ) {
      transcript = transcript.slice(1, -1).trim();
    }
    transcript = transcript.replace(/^(transcripci[oó]n|texto)\s*:\s*/i, '').trim();

    console.log(`[Audio Transcribe] Clean transcript: "${transcript}"`);
    return res.json({ transcript });
  } catch (error: any) {
    console.error('Error in /api/transcribe-audio:', error);

    let friendlyMessage = 'Error al transcribir audio';
    try {
      const raw = typeof error?.message === 'string' ? error.message : '';
      if (raw.startsWith('{') && raw.includes('"message"')) {
        const parsed = JSON.parse(raw);
        if (parsed?.error?.message) {
          friendlyMessage = parsed.error.message;
        }
      } else if (raw) {
        friendlyMessage = raw;
      }
    } catch {}

    return res.status(500).json({
      error: friendlyMessage,
    });
  }
});

// Health endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Asistente Personal Inteligente API',
    time: new Date().toISOString(),
    geminiConfigured: !!process.env.GEMINI_API_KEY,
  });
});

// Vite middleware integration
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
