import { AssistantState } from '../types';
import { getInitialAssistantState } from '../data/seedData';
import { getDeviceLocalDate } from '../utils/deviceDateTime';

const STORAGE_KEY = 'aura_assistant_state_v1';

export class StorageService {
  private static state: AssistantState | null = null;

  static getState(): AssistantState {
    if (this.state) {
      return this.state;
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (!parsed.voiceNotes || !Array.isArray(parsed.voiceNotes)) {
          parsed.voiceNotes = [];
        }
        if (!parsed.actionHistory || !Array.isArray(parsed.actionHistory)) {
          parsed.actionHistory = [];
        }
        if (!parsed.reminders || !Array.isArray(parsed.reminders)) {
          parsed.reminders = [];
        }
        if (!parsed.currentUser) {
          parsed.currentUser = {
            id: 'usr-diego-default',
            email: 'diegolecarosu@gmail.com',
            name: 'Diego',
          };
        }

        // Automatic migration of pure seed data:
        // If the stored data is still on the legacy demo date 2026-09-15 and the device date is different,
        // refresh the initial seed data so the calendar and tasks immediately align with the user's phone today!
        const today = getDeviceLocalDate();
        const hasLegacy20260915 = parsed.events?.some((e: any) => e.date === '2026-09-15') ||
          parsed.tasks?.some((t: any) => t.dueDate === '2026-09-15');

        if (hasLegacy20260915 && today !== '2026-09-15') {
          const isPureInitialData = (parsed.events?.length || 0) <= 3 && (parsed.tasks?.length || 0) <= 4;
          if (isPureInitialData) {
            const freshState = getInitialAssistantState();
            this.state = freshState;
            this.saveState(freshState);
            return freshState;
          }
        }

        this.state = parsed;
        return parsed;
      }
    } catch (e) {
      console.warn('Error reading from localStorage, using initial state:', e);
    }

    this.state = getInitialAssistantState();
    this.saveState(this.state!);
    return this.state!;
  }

  static saveState(newState: AssistantState): void {
    this.state = newState;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
    } catch (e) {
      console.error('Error saving state to localStorage:', e);
    }
  }

  static resetToSeed(): AssistantState {
    this.state = getInitialAssistantState();
    this.saveState(this.state!);
    return this.state!;
  }
}
