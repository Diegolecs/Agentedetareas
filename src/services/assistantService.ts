import { AssistantState, Message } from '../types';
import { getDeviceFullContext } from '../utils/deviceDateTime';

export interface ChatResponse {
  text: string;
  actionsExecuted?: Array<{ type: any; label: string; details: string }>;
  updatedState?: Partial<AssistantState>;
}

export class AssistantService {
  static async sendMessage(
    message: string,
    currentState: AssistantState,
    overrideDate?: string,
    overrideTime?: string
  ): Promise<ChatResponse> {
    const devContext = getDeviceFullContext();
    const currentDate = overrideDate || devContext.currentDate;
    const currentTime = overrideTime || devContext.currentTime;
    const permission = typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default';
    const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

    const payload = {
      message,
      context: {
        currentDate,
        currentTime,
        currentTimeWithSeconds: devContext.currentTimeWithSeconds,
        timezone: devContext.timezone,
        timezoneOffset: devContext.timezoneOffset,
        currentIso: devContext.currentIso,
        weekday: devContext.weekday,
        formattedDate: devContext.formattedDate,
        tomorrowDate: devContext.tomorrowDate,
        yesterdayDate: devContext.yesterdayDate,
        isInIframe,
        notificationPermission: permission,
        events: currentState.events,
        tasks: currentState.tasks,
        reminders: currentState.reminders || [],
        people: currentState.people,
        projects: currentState.projects,
        places: currentState.places,
        memories: currentState.memories,
        relationships: currentState.relationships,
        actionHistory: currentState.actionHistory || [],
        userId: currentState.currentUser?.id || 'usr-diego-default',
        recentMessages: currentState.messages.slice(-6).map((m) => ({
          role: m.role,
          content: m.content,
        })),
      },
    };

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      let errText = errorData.error || `Error del servidor (${res.status})`;
      try {
        if (typeof errText === 'string' && errText.startsWith('{') && errText.includes('"message"')) {
          const parsed = JSON.parse(errText);
          if (parsed?.error?.message) {
            errText = parsed.error.message;
          }
        }
      } catch {}
      throw new Error(errText);
    }

    const data = await res.json();
    return data;
  }

  static async transcribeAudio(base64Data: string, mimeType: string): Promise<string> {
    const res = await fetch('/api/transcribe-audio', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ base64Data, mimeType }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error al procesar el audio con el asistente');
    }

    const data = await res.json();
    return data.transcript || '';
  }
}
