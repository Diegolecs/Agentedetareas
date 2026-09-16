import { AssistantState } from '../types';
import { INITIAL_ASSISTANT_STATE } from '../data/seedData';

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
        if (!parsed.currentUser) {
          parsed.currentUser = {
            id: 'usr-diego-default',
            email: 'diegolecarosu@gmail.com',
            name: 'Diego',
          };
        }
        this.state = parsed;
        return parsed;
      }
    } catch (e) {
      console.warn('Error reading from localStorage, using initial state:', e);
    }

    this.state = JSON.parse(JSON.stringify(INITIAL_ASSISTANT_STATE));
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
    this.state = JSON.parse(JSON.stringify(INITIAL_ASSISTANT_STATE));
    this.saveState(this.state!);
    return this.state!;
  }
}
