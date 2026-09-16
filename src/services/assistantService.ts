import { AssistantState, Message } from '../types';

export interface ChatResponse {
  text: string;
  actionsExecuted?: Array<{ type: any; label: string; details: string }>;
  updatedState?: Partial<AssistantState>;
}

export class AssistantService {
  static async sendMessage(
    message: string,
    currentState: AssistantState,
    currentDate = '2026-09-15',
    currentTime = '11:30'
  ): Promise<ChatResponse> {
    const payload = {
      message,
      context: {
        currentDate,
        currentTime,
        events: currentState.events,
        tasks: currentState.tasks,
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
