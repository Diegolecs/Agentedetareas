import { CalendarEvent, EventStatus } from '../types';

export interface CalendarFilter {
  startDate?: string;
  endDate?: string;
  status?: EventStatus;
  query?: string;
  relatedPerson?: string;
  relatedProject?: string;
}

export interface ICalendarProvider {
  getEvents(events: CalendarEvent[], filter?: CalendarFilter): CalendarEvent[];
  createEvent(events: CalendarEvent[], event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>): { newEvent: CalendarEvent; updatedList: CalendarEvent[] };
  updateEvent(events: CalendarEvent[], id: string, updates: Partial<CalendarEvent>): { updatedEvent?: CalendarEvent; updatedList: CalendarEvent[] };
  deleteEvent(events: CalendarEvent[], id: string, userId?: string): { deleted: boolean; deletedEvent?: CalendarEvent; updatedList: CalendarEvent[] };
  deleteMultipleEvents(events: CalendarEvent[], ids: string[], userId?: string): { deletedCount: number; deletedEvents: CalendarEvent[]; updatedList: CalendarEvent[] };
  deleteAllEvents(events: CalendarEvent[], userId?: string): { deletedCount: number; deletedEvents: CalendarEvent[]; updatedList: CalendarEvent[] };
  restoreEvents(events: CalendarEvent[], eventsToRestore: CalendarEvent[], userId?: string): { restoredCount: number; updatedList: CalendarEvent[] };
  getFreeSlots(events: CalendarEvent[], date: string): string[];
}

export class InternalCalendarProvider implements ICalendarProvider {
  getEvents(events: CalendarEvent[], filter?: CalendarFilter): CalendarEvent[] {
    return events.filter((ev) => {
      if (filter?.startDate && ev.date < filter.startDate) return false;
      if (filter?.endDate && ev.date > filter.endDate) return false;
      if (filter?.status && ev.status !== filter.status) return false;
      if (filter?.relatedPerson && !ev.relatedPerson?.toLowerCase().includes(filter.relatedPerson.toLowerCase())) return false;
      if (filter?.relatedProject && !ev.relatedProject?.toLowerCase().includes(filter.relatedProject.toLowerCase())) return false;
      if (filter?.query) {
        const q = filter.query.toLowerCase();
        const text = `${ev.title} ${ev.description || ''} ${ev.location || ''}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.startTime.localeCompare(b.startTime);
    });
  }

  createEvent(
    events: CalendarEvent[],
    event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>
  ): { newEvent: CalendarEvent; updatedList: CalendarEvent[] } {
    const newEvent: CalendarEvent = {
      ...event,
      id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updatedList = [...events, newEvent];
    return { newEvent, updatedList };
  }

  updateEvent(
    events: CalendarEvent[],
    id: string,
    updates: Partial<CalendarEvent>
  ): { updatedEvent?: CalendarEvent; updatedList: CalendarEvent[] } {
    let updatedEvent: CalendarEvent | undefined;
    const updatedList = events.map((ev) => {
      if (ev.id === id) {
        updatedEvent = {
          ...ev,
          ...updates,
          updatedAt: new Date().toISOString(),
        };
        return updatedEvent;
      }
      return ev;
    });
    return { updatedEvent, updatedList };
  }

  deleteEvent(
    events: CalendarEvent[],
    id: string,
    userId?: string
  ): { deleted: boolean; deletedEvent?: CalendarEvent; updatedList: CalendarEvent[] } {
    const eventToDelete = events.find((ev) => ev.id === id);
    if (!eventToDelete) {
      return { deleted: false, updatedList: events };
    }
    // Security check: If userId provided, ensure event belongs to this user
    if (userId && eventToDelete.userId && eventToDelete.userId !== userId) {
      return { deleted: false, updatedList: events };
    }
    const updatedList = events.filter((ev) => ev.id !== id);
    return { deleted: true, deletedEvent: eventToDelete, updatedList };
  }

  deleteMultipleEvents(
    events: CalendarEvent[],
    ids: string[],
    userId?: string
  ): { deletedCount: number; deletedEvents: CalendarEvent[]; updatedList: CalendarEvent[] } {
    const idSet = new Set(ids);
    const deletedEvents: CalendarEvent[] = [];
    const updatedList: CalendarEvent[] = [];

    for (const ev of events) {
      if (idSet.has(ev.id)) {
        if (!userId || !ev.userId || ev.userId === userId) {
          deletedEvents.push(ev);
          continue;
        }
      }
      updatedList.push(ev);
    }

    return {
      deletedCount: deletedEvents.length,
      deletedEvents,
      updatedList,
    };
  }

  deleteAllEvents(
    events: CalendarEvent[],
    userId?: string
  ): { deletedCount: number; deletedEvents: CalendarEvent[]; updatedList: CalendarEvent[] } {
    const deletedEvents: CalendarEvent[] = [];
    const updatedList: CalendarEvent[] = [];

    for (const ev of events) {
      if (!userId || !ev.userId || ev.userId === userId) {
        deletedEvents.push(ev);
      } else {
        updatedList.push(ev);
      }
    }

    return {
      deletedCount: deletedEvents.length,
      deletedEvents,
      updatedList,
    };
  }

  restoreEvents(
    events: CalendarEvent[],
    eventsToRestore: CalendarEvent[],
    userId?: string
  ): { restoredCount: number; updatedList: CalendarEvent[] } {
    const existingIds = new Set(events.map((ev) => ev.id));
    const validRestores = eventsToRestore.filter(
      (ev) => (!userId || !ev.userId || ev.userId === userId) && !existingIds.has(ev.id)
    );

    return {
      restoredCount: validRestores.length,
      updatedList: [...events, ...validRestores],
    };
  }

  getFreeSlots(events: CalendarEvent[], date: string): string[] {
    const dayEvents = events
      .filter((e) => e.date === date && e.status !== 'cancelado')
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    if (dayEvents.length === 0) {
      return ['Día completo disponible (09:00 - 19:00)'];
    }

    const freeSlots: string[] = [];
    const workStart = '09:00';
    const workEnd = '19:00';

    if (dayEvents[0].startTime > workStart) {
      freeSlots.push(`${workStart} - ${dayEvents[0].startTime}`);
    }

    for (let i = 0; i < dayEvents.length - 1; i++) {
      const currentEnd = dayEvents[i].endTime;
      const nextStart = dayEvents[i + 1].startTime;
      if (currentEnd < nextStart) {
        freeSlots.push(`${currentEnd} - ${nextStart}`);
      }
    }

    const lastEnd = dayEvents[dayEvents.length - 1].endTime;
    if (lastEnd < workEnd) {
      freeSlots.push(`${lastEnd} - ${workEnd}`);
    }

    return freeSlots;
  }
}

/**
 * Extensible Google Calendar Provider Stub (Prepared for future OAuth integration)
 */
export class GoogleCalendarProvider implements Partial<ICalendarProvider> {
  // Configured when Google OAuth is connected
  isConfigured(): boolean {
    return false;
  }

  getEvents(): CalendarEvent[] {
    return [];
  }

  getGoogleCalendarWebUrl(event: CalendarEvent): string {
    const startIso = `${event.date.replace(/-/g, '')}T${event.startTime.replace(/:/g, '')}00`;
    const endIso = `${event.date.replace(/-/g, '')}T${event.endTime.replace(/:/g, '')}00`;
    const title = encodeURIComponent(event.title);
    const details = encodeURIComponent(event.description || '');
    const location = encodeURIComponent(event.location || '');
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startIso}/${endIso}&details=${details}&location=${location}`;
  }
}

export const CalendarService = new InternalCalendarProvider();
export const FutureGoogleCalendar = new GoogleCalendarProvider();
