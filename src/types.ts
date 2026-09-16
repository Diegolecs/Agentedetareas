/**
 * Domain Models and Types for Asistente Personal Inteligente
 */

export type EventStatus = 'posible' | 'no_confirmado' | 'confirmado' | 'cancelado' | 'completado';
export type TaskStatus = 'pendiente' | 'en_progreso' | 'completada' | 'cancelada' | 'en_espera';
export type TaskPriority = 'alta' | 'media' | 'baja';
export type ProjectStatus = 'activo' | 'en_pausa' | 'completado';
export type MemoryCategory = 'persona' | 'proyecto' | 'lugar' | 'compromiso' | 'preferencia' | 'decision' | 'general';

export interface AppUser {
  id: string;
  email: string;
  name: string;
}

export interface CalendarEvent {
  id: string;
  userId?: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  location?: string;
  description?: string;
  relatedPerson?: string;
  relatedProject?: string;
  relatedTasks?: string[];
  status: EventStatus;
  reminders?: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  userId?: string;
  title: string;
  description?: string;
  dueDate?: string; // YYYY-MM-DD or textual
  dueTime?: string; // HH:mm
  priority: TaskPriority;
  status: TaskStatus;
  relatedPerson?: string;
  relatedProject?: string;
  location?: string;
  reminder?: string;
  notes?: string;
  createdAt: string;
  completedAt?: string;
}

export interface Person {
  id: string;
  name: string;
  role?: string;
  context: string;
  relatedProject?: string;
  pendingItems?: string[];
  lastInteraction: string;
  phone?: string;
  email?: string;
  notes?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  keyPeople?: string[];
  keyInformation?: string;
  updatedAt: string;
}

export interface Place {
  id: string;
  name: string;
  address?: string;
  notes?: string;
  relatedPeople?: string[];
  relatedProjects?: string[];
}

export interface MemoryItem {
  id: string;
  category: MemoryCategory;
  title: string;
  content: string;
  relatedPerson?: string;
  relatedProject?: string;
  relatedPlace?: string;
  tags?: string[];
  updatedAt: string;
}

export interface Relationship {
  id: string;
  from: string;
  relation: string;
  to: string;
  context?: string;
}

export interface ActionExecuted {
  type: 'create_event' | 'update_event' | 'delete_event' | 'create_task' | 'update_task' | 'create_memory' | 'create_person' | 'create_project' | 'create_relationship' | 'general';
  label: string;
  details: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  actionsExecuted?: ActionExecuted[];
  voiceTranscript?: boolean;
}

export type ActionEntity =
  | 'task'
  | 'tasks_multiple'
  | 'tasks_all'
  | 'event'
  | 'events_multiple'
  | 'events_all'
  | 'tasks_and_events_all'
  | 'memory'
  | 'person'
  | 'project'
  | 'relationship';

export type ActionType =
  | 'create_task'
  | 'update_task'
  | 'delete_task'
  | 'delete_multiple_tasks'
  | 'delete_all_tasks'
  | 'archive_completed_tasks'
  | 'create_event'
  | 'update_event'
  | 'delete_event'
  | 'delete_multiple_events'
  | 'delete_all_events'
  | 'delete_all_tasks_and_events'
  | 'revert_action'
  | 'create_memory'
  | 'create_person'
  | 'create_project'
  | 'create_relationship';

export type ActionStatus = 'applied' | 'reverted' | 'failed';

export interface ActionHistorySnapshot {
  tasks?: Task[];
  events?: CalendarEvent[];
  memories?: MemoryItem[];
}

export interface ActionHistoryItem {
  id?: string;
  actionId?: string;
  userId: string;
  timestamp: string; // ISO string
  displayTimestamp?: string; // e.g. "15/09/2026 13:42"
  actionType: ActionType;
  entity: ActionEntity;
  entityId?: string;
  origin?: 'assistant_tool' | 'manual';
  readableDescription: string;
  summary?: string;
  details?: string;
  status?: ActionStatus;
  isReversible?: boolean;
  canUndo?: boolean;
  revertedAt?: string;
  revertedSummary?: string;
  // Snapshots for restoring data
  previousState?: ActionHistorySnapshot;
  newState?: ActionHistorySnapshot;
}

export interface AssistantState {
  events: CalendarEvent[];
  tasks: Task[];
  people: Person[];
  projects: Project[];
  places: Place[];
  memories: MemoryItem[];
  relationships: Relationship[];
  messages: Message[];
  voiceNotes?: any[];
  actionHistory?: ActionHistoryItem[];
  currentUser?: AppUser;
}

export interface DailyBriefing {
  date: string;
  eventsToday: CalendarEvent[];
  tasksPending: Task[];
  tasksOverdue: Task[];
  recommendedFocus: string;
  freeSlots: string[];
}
