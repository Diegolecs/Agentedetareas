import { AssistantState } from '../types';
import {
  getDeviceLocalDate,
  getTomorrowLocalDate,
  getYesterdayLocalDate,
  formatDeviceDisplayDate,
} from '../utils/deviceDateTime';

export function getInitialAssistantState(base = new Date()): AssistantState {
  const today = getDeviceLocalDate(base);
  const tomorrow = getTomorrowLocalDate(base);
  const yesterday = getYesterdayLocalDate(base);

  const d3 = new Date(base);
  d3.setDate(d3.getDate() + 3);
  const in3Days = getDeviceLocalDate(d3);

  const d4 = new Date(base);
  d4.setDate(d4.getDate() - 4);
  const fourDaysAgo = getDeviceLocalDate(d4);

  return {
    events: [
      {
        id: 'evt-1',
        title: 'Reunión de seguimiento',
        date: today,
        startTime: '10:30',
        endTime: '11:30',
        location: 'Oficina Virtual / Meet',
        description: 'Revisión de avance semanal y contratos pendientes',
        relatedPerson: 'Carlos',
        relatedProject: 'Venta departamento Miraflores',
        status: 'confirmado',
        reminders: ['15 minutos antes'],
        createdAt: `${yesterday}T10:00:00.000Z`,
        updatedAt: `${yesterday}T10:00:00.000Z`,
      },
      {
        id: 'evt-2',
        title: 'Visita técnica de inspección',
        date: today,
        startTime: '17:00',
        endTime: '18:00',
        location: 'Av. Larco 450, Miraflores',
        description: 'Inspección de acabados y áreas comunes',
        relatedPerson: 'Carlos',
        relatedProject: 'Venta departamento Miraflores',
        status: 'confirmado',
        reminders: ['30 minutos antes'],
        createdAt: `${yesterday}T11:00:00.000Z`,
        updatedAt: `${yesterday}T11:00:00.000Z`,
      },
      {
        id: 'evt-3',
        title: 'Reunión con Pedro',
        date: in3Days,
        startTime: '11:00',
        endTime: '12:00',
        location: 'Café San Antonio, San Isidro',
        description: 'Reunión para acordar términos de asociación',
        relatedPerson: 'Pedro',
        status: 'posible',
        createdAt: `${yesterday}T16:00:00.000Z`,
        updatedAt: `${yesterday}T16:00:00.000Z`,
      },
    ],
    tasks: [
      {
        id: 'tsk-1',
        title: 'Confirmar visita técnica con propietario',
        description: 'Asegurar acceso y llaves para la inspección de las 17:00',
        dueDate: today,
        dueTime: '14:00',
        priority: 'alta',
        status: 'pendiente',
        relatedPerson: 'Carlos',
        relatedProject: 'Venta departamento Miraflores',
        location: 'Miraflores',
        reminder: '14:00',
        createdAt: `${yesterday}T09:00:00.000Z`,
      },
      {
        id: 'tsk-2',
        title: 'Enviar documentación legal a Pedro',
        description: 'Dossier informativo y borrador de contrato que solicitó',
        dueDate: today,
        priority: 'media',
        status: 'pendiente',
        relatedPerson: 'Pedro',
        createdAt: `${fourDaysAgo}T12:00:00.000Z`,
      },
      {
        id: 'tsk-3',
        title: 'Revisar tasación del departamento de Miraflores',
        description: 'Comparar con los últimos precios de m² en la zona',
        dueDate: tomorrow,
        priority: 'media',
        status: 'pendiente',
        relatedProject: 'Venta departamento Miraflores',
        createdAt: `${yesterday}T15:00:00.000Z`,
      },
      {
        id: 'tsk-4',
        title: 'Enviar reporte mensual de gastos',
        description: 'Reporte contable vencido de la semana anterior',
        dueDate: yesterday, // Overdue
        priority: 'alta',
        status: 'pendiente',
        createdAt: `${fourDaysAgo}T08:00:00.000Z`,
      },
    ],
    people: [
      {
        id: 'per-1',
        name: 'Juan',
        role: 'Comprador potencial',
        context: 'Está muy interesado en comprar un departamento en Miraflores. Busca 3 dormitorios y cochera.',
        relatedProject: 'Venta departamento Miraflores',
        pendingItems: ['Coordinar una visita presencial', 'Enviar lista de especificaciones técnicas'],
        lastInteraction: today,
        phone: '+51 987 654 321',
        notes: 'Prefiere contacto por las tardes después de las 15:00',
      },
      {
        id: 'per-2',
        name: 'Carlos',
        role: 'Arquitecto y socio del proyecto',
        context: 'Encargado del levantamiento de planos y supervisión técnica en Miraflores.',
        relatedProject: 'Venta departamento Miraflores',
        pendingItems: ['Confirmar visita de inspección de hoy a las 17:00'],
        lastInteraction: today,
        phone: '+51 912 345 678',
      },
      {
        id: 'per-3',
        name: 'Pedro',
        role: 'Inversionista / Asociado potencial',
        context: 'Interesado en participar en futuras adquisiciones inmobiliarias.',
        pendingItems: ['Enviar documentación legal pendiente', 'Reunión en Café San Antonio'],
        lastInteraction: yesterday,
        phone: '+51 998 877 665',
      },
    ],
    projects: [
      {
        id: 'proj-1',
        name: 'Venta departamento Miraflores',
        status: 'activo',
        description: 'Comercialización y remodelación ligera de departamento en Av. Larco para venta rápida.',
        keyPeople: ['Carlos', 'Juan'],
        keyInformation: `Inspección técnica hoy ${today}, firma estimada en 3 días.`,
        updatedAt: `${yesterday}T10:00:00.000Z`,
      },
      {
        id: 'proj-2',
        name: 'Asociación estratégica con Pedro',
        status: 'activo',
        description: 'Acuerdo de co-inversión para desarrollo de oficinas boutique.',
        keyPeople: ['Pedro'],
        keyInformation: `Reunión preliminar pactada para ${in3Days}.`,
        updatedAt: `${yesterday}T12:00:00.000Z`,
      },
    ],
    places: [
      {
        id: 'plc-1',
        name: 'Av. Larco 450, Miraflores',
        address: 'Av. Larco 450, Dpto 502, Miraflores',
        notes: 'Departamento 502. El portero tiene la llave maestra.',
        relatedProjects: ['Venta departamento Miraflores'],
      },
      {
        id: 'plc-2',
        name: 'Café San Antonio, San Isidro',
        address: 'Av. Angamos Oeste, San Isidro',
        notes: 'Buen WiFi y ambiente tranquilo para reuniones con clientes.',
      },
    ],
    memories: [
      {
        id: 'mem-1',
        category: 'preferencia',
        title: 'Preferencia de Juan para departamento',
        content: 'Juan busca departamentos exclusivamente en pisos intermedios (pisos 4 al 8) y con vista exterior.',
        tags: ['juan', 'cliente', 'requisitos', 'miraflores'],
        updatedAt: `${yesterday}T12:00:00.000Z`,
      },
      {
        id: 'mem-2',
        category: 'compromiso',
        title: 'Borrador de contrato con Pedro',
        content: 'Pedro solicitó revisar primero el borrador de contrato antes de reunirnos en Café San Antonio.',
        tags: ['pedro', 'legal', 'contrato'],
        updatedAt: `${yesterday}T16:30:00.000Z`,
      },
      {
        id: 'mem-3',
        category: 'general',
        title: 'Requisitos para inspección técnica',
        content: 'Para la inspección técnica en Miraflores es obligatorio llevar el juego de planos visado y cámara para registrar acabados.',
        tags: ['inspeccion', 'carlos', 'miraflores'],
        updatedAt: `${today}T08:00:00.000Z`,
      },
    ],
    relationships: [
      {
        id: 'rel-1',
        from: 'Juan',
        relation: 'interesado en',
        to: 'Venta departamento Miraflores',
        context: 'Presupuesto aprox $220,000',
      },
      {
        id: 'rel-2',
        from: 'Pedro',
        relation: 'socio potencial en',
        to: 'Asociación estratégica con Pedro',
      },
      {
        id: 'rel-3',
        from: 'Juan',
        relation: 'pendiente de',
        to: 'Coordinar visita con Juan',
      },
      {
        id: 'rel-4',
        from: 'Carlos',
        relation: 'arquitecto de',
        to: 'Venta departamento Miraflores',
      },
    ],
    messages: [
      {
        id: 'msg-1',
        role: 'assistant',
        content: `¡Hola! Soy tu asistente personal inteligente. Estoy sincronizado en tiempo real con la fecha y hora de tu celular (${today}).\n\nTengo acceso a tu agenda, tus tareas pendientes y tu memoria contextual.\n\nPuedes hablarme de forma completamente natural. Por ejemplo:\n• *"¿Qué tengo hoy y qué debería priorizar?"*\n• *"¿Qué tengo pendiente con Juan?"*\n• *"Recuérdame en 15 minutos llamar al dueño para confirmar la visita."*\n• *"¿Qué tengo mañana?"*\n\n¿En qué te ayudo hoy?`,
        timestamp: `${today}T09:00:00.000Z`,
      },
    ],
    voiceNotes: [],
    currentUser: {
      id: 'usr-diego-default',
      email: 'diegolecarosu@gmail.com',
      name: 'Diego',
    },
    actionHistory: [
      {
        actionId: 'act-init-1',
        userId: 'usr-diego-default',
        timestamp: `${yesterday}T10:00:00.000Z`,
        displayTimestamp: formatDeviceDisplayDate(`${yesterday}T10:00:00`),
        actionType: 'create_event',
        entity: 'event',
        entityId: 'evt-1',
        origin: 'assistant_tool',
        readableDescription: `Evento agendado: Reunión de seguimiento (${today} 10:30)`,
        status: 'applied',
        isReversible: true,
        previousState: {},
        newState: {
          events: [
            {
              id: 'evt-1',
              userId: 'usr-diego-default',
              title: 'Reunión de seguimiento',
              date: today,
              startTime: '10:30',
              endTime: '11:30',
              status: 'confirmado',
              createdAt: `${yesterday}T10:00:00.000Z`,
              updatedAt: `${yesterday}T10:00:00.000Z`,
            },
          ],
        },
      },
      {
        actionId: 'act-init-2',
        userId: 'usr-diego-default',
        timestamp: `${yesterday}T10:15:00.000Z`,
        displayTimestamp: formatDeviceDisplayDate(`${yesterday}T10:15:00`),
        actionType: 'create_task',
        entity: 'task',
        entityId: 'tsk-1',
        origin: 'assistant_tool',
        readableDescription: `Tarea creada: Confirmar visita técnica con propietario (Prioridad alta)`,
        status: 'applied',
        isReversible: true,
        previousState: {},
        newState: {
          tasks: [
            {
              id: 'tsk-1',
              userId: 'usr-diego-default',
              title: 'Confirmar visita técnica con propietario',
              dueDate: today,
              dueTime: '14:00',
              priority: 'alta',
              status: 'pendiente',
              createdAt: `${yesterday}T10:15:00.000Z`,
            },
          ],
        },
      },
    ],
    reminders: [],
  };
}

export const INITIAL_ASSISTANT_STATE: AssistantState = getInitialAssistantState();
