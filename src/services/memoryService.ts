import { MemoryItem, Person, Project, Place, Relationship } from '../types';

export class MemoryService {
  /**
   * Search across memories, people, projects, places and relationships
   */
  static searchContext(
    query: string,
    memories: MemoryItem[],
    people: Person[],
    projects: Project[],
    places: Place[],
    relationships: Relationship[]
  ) {
    const q = query.toLowerCase().trim();
    if (!q) {
      return { memories, people, projects, places, relationships };
    }

    const matchedMemories = memories.filter((m) =>
      `${m.title} ${m.content} ${m.relatedPerson || ''} ${m.relatedProject || ''} ${(m.tags || []).join(' ')}`
        .toLowerCase()
        .includes(q)
    );

    const matchedPeople = people.filter((p) =>
      `${p.name} ${p.role || ''} ${p.context} ${p.relatedProject || ''} ${(p.pendingItems || []).join(' ')}`
        .toLowerCase()
        .includes(q)
    );

    const matchedProjects = projects.filter((prj) =>
      `${prj.name} ${prj.description} ${prj.keyInformation || ''} ${(prj.keyPeople || []).join(' ')}`
        .toLowerCase()
        .includes(q)
    );

    const matchedPlaces = places.filter((plc) =>
      `${plc.name} ${plc.address || ''} ${plc.notes || ''}`.toLowerCase().includes(q)
    );

    const matchedRelationships = relationships.filter((r) =>
      `${r.from} ${r.relation} ${r.to} ${r.context || ''}`.toLowerCase().includes(q)
    );

    return {
      memories: matchedMemories,
      people: matchedPeople,
      projects: matchedProjects,
      places: matchedPlaces,
      relationships: matchedRelationships,
    };
  }

  static createOrUpdateMemory(
    memories: MemoryItem[],
    memory: Omit<MemoryItem, 'id' | 'updatedAt'>,
    id?: string
  ): { memory: MemoryItem; updatedList: MemoryItem[] } {
    if (id) {
      let updated: MemoryItem | undefined;
      const list = memories.map((m) => {
        if (m.id === id) {
          updated = { ...m, ...memory, updatedAt: new Date().toISOString() };
          return updated;
        }
        return m;
      });
      if (updated) return { memory: updated, updatedList: list };
    }

    // Check if an existing memory matches by title/person
    const existing = memories.find(
      (m) => m.title.toLowerCase() === memory.title.toLowerCase() && m.relatedPerson === memory.relatedPerson
    );
    if (existing) {
      const updated: MemoryItem = {
        ...existing,
        ...memory,
        updatedAt: new Date().toISOString(),
      };
      return {
        memory: updated,
        updatedList: memories.map((m) => (m.id === existing.id ? updated : m)),
      };
    }

    const newMem: MemoryItem = {
      ...memory,
      id: `mem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      updatedAt: new Date().toISOString(),
    };
    return { memory: newMem, updatedList: [newMem, ...memories] };
  }

  static createOrUpdatePerson(
    people: Person[],
    person: Omit<Person, 'id'>,
    id?: string
  ): { person: Person; updatedList: Person[] } {
    const existing = id
      ? people.find((p) => p.id === id)
      : people.find((p) => p.name.toLowerCase() === person.name.toLowerCase());

    if (existing) {
      const updated: Person = {
        ...existing,
        ...person,
        lastInteraction: new Date().toISOString().split('T')[0],
      };
      return {
        person: updated,
        updatedList: people.map((p) => (p.id === existing.id ? updated : p)),
      };
    }

    const newPerson: Person = {
      ...person,
      id: `per-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      lastInteraction: person.lastInteraction || new Date().toISOString().split('T')[0],
    };
    return { person: newPerson, updatedList: [...people, newPerson] };
  }

  static createOrUpdateProject(
    projects: Project[],
    project: Omit<Project, 'id' | 'updatedAt'>,
    id?: string
  ): { project: Project; updatedList: Project[] } {
    const existing = id
      ? projects.find((p) => p.id === id)
      : projects.find((p) => p.name.toLowerCase() === project.name.toLowerCase());

    if (existing) {
      const updated: Project = {
        ...existing,
        ...project,
        updatedAt: new Date().toISOString(),
      };
      return {
        project: updated,
        updatedList: projects.map((p) => (p.id === existing.id ? updated : p)),
      };
    }

    const newProject: Project = {
      ...project,
      id: `prj-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      updatedAt: new Date().toISOString(),
    };
    return { project: newProject, updatedList: [...projects, newProject] };
  }

  static addRelationship(
    relationships: Relationship[],
    rel: Omit<Relationship, 'id'>
  ): { relationship: Relationship; updatedList: Relationship[] } {
    const exists = relationships.find(
      (r) =>
        r.from.toLowerCase() === rel.from.toLowerCase() &&
        r.relation.toLowerCase() === rel.relation.toLowerCase() &&
        r.to.toLowerCase() === rel.to.toLowerCase()
    );
    if (exists) {
      return { relationship: exists, updatedList: relationships };
    }
    const newRel: Relationship = {
      ...rel,
      id: `rel-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    };
    return { relationship: newRel, updatedList: [...relationships, newRel] };
  }
}
