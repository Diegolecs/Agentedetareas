import React, { useState } from 'react';
import {
  AssistantState,
  Person,
  Project,
  Place,
  MemoryItem,
  Relationship,
  MemoryCategory,
} from '../types';
import { MemoryService } from '../services/memoryService';
import {
  FolderGit2,
  Users,
  Briefcase,
  MapPin,
  Share2,
  BookOpen,
  Search,
  Plus,
  ArrowRight,
  Clock,
  Phone,
  Tag,
  X,
  Sparkles,
} from 'lucide-react';

interface MemoryViewProps {
  state: AssistantState;
  onUpdateState: (newState: AssistantState) => void;
  currentDate: string;
}

export const MemoryView: React.FC<MemoryViewProps> = ({
  state,
  onUpdateState,
  currentDate,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'personas' | 'proyectos' | 'lugares' | 'relaciones' | 'memorias'>(
    'personas'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states for adding items
  const [personName, setPersonName] = useState('');
  const [personRole, setPersonRole] = useState('');
  const [personContext, setPersonContext] = useState('');
  const [personProject, setPersonProject] = useState('');

  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [projectInfo, setProjectInfo] = useState('');

  const [memTitle, setMemTitle] = useState('');
  const [memContent, setMemContent] = useState('');
  const [memCategory, setMemCategory] = useState<MemoryCategory>('persona');
  const [memPerson, setMemPerson] = useState('');

  const [relFrom, setRelFrom] = useState('');
  const [relRelation, setRelRelation] = useState('interesado en');
  const [relTo, setRelTo] = useState('');
  const [relContext, setRelContext] = useState('');

  const { memories, people, projects, places, relationships } = MemoryService.searchContext(
    searchQuery,
    state.memories,
    state.people,
    state.projects,
    state.places,
    state.relationships
  );

  const handleCreatePerson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!personName.trim()) return;

    const { updatedList } = MemoryService.createOrUpdatePerson(state.people, {
      name: personName.trim(),
      role: personRole.trim() || undefined,
      context: personContext.trim(),
      relatedProject: personProject.trim() || undefined,
      pendingItems: [],
      lastInteraction: currentDate,
    });

    onUpdateState({ ...state, people: updatedList });
    setIsModalOpen(false);
    setPersonName('');
    setPersonRole('');
    setPersonContext('');
  };

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;

    const { updatedList } = MemoryService.createOrUpdateProject(state.projects, {
      name: projectName.trim(),
      description: projectDesc.trim(),
      status: 'activo',
      keyInformation: projectInfo.trim() || undefined,
    });

    onUpdateState({ ...state, projects: updatedList });
    setIsModalOpen(false);
    setProjectName('');
    setProjectDesc('');
    setProjectInfo('');
  };

  const handleCreateMemory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memTitle.trim() || !memContent.trim()) return;

    const { updatedList } = MemoryService.createOrUpdateMemory(state.memories, {
      title: memTitle.trim(),
      content: memContent.trim(),
      category: memCategory,
      relatedPerson: memPerson.trim() || undefined,
    });

    onUpdateState({ ...state, memories: updatedList });
    setIsModalOpen(false);
    setMemTitle('');
    setMemContent('');
  };

  const handleCreateRelationship = (e: React.FormEvent) => {
    e.preventDefault();
    if (!relFrom.trim() || !relTo.trim()) return;

    const { updatedList } = MemoryService.addRelationship(state.relationships, {
      from: relFrom.trim(),
      relation: relRelation.trim(),
      to: relTo.trim(),
      context: relContext.trim() || undefined,
    });

    onUpdateState({ ...state, relationships: updatedList });
    setIsModalOpen(false);
    setRelFrom('');
    setRelTo('');
    setRelContext('');
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-y-auto w-full max-w-full">
      {/* Top Bar */}
      <div className="p-3.5 sm:p-4 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-xs sticky top-0 z-10 space-y-3 w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <FolderGit2 className="w-5 h-5 text-indigo-400 shrink-0" />
              <span className="truncate">Memoria Contextual</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Personas, proyectos, acuerdos y relaciones interconectadas
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            id="btn-add-memory"
            className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition shadow-sm active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Registro</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative w-full">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar personas, compromisos, departamentos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Subtabs Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 max-w-full">
          <button
            onClick={() => setActiveSubTab('personas')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition shrink-0 ${
              activeSubTab === 'personas'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Personas ({people.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('proyectos')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition shrink-0 ${
              activeSubTab === 'proyectos'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Proyectos ({projects.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('relaciones')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition shrink-0 ${
              activeSubTab === 'relaciones'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Grafo / Relaciones ({relationships.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('memorias')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition shrink-0 ${
              activeSubTab === 'memorias'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Notas & Acuerdos ({memories.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('lugares')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition shrink-0 ${
              activeSubTab === 'lugares'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Lugares ({places.length})</span>
          </button>
        </div>
      </div>

      {/* Main SubTab Content */}
      <div className="p-4 space-y-3">
        {/* SUBTAB: PERSONAS */}
        {activeSubTab === 'personas' && (
          <div className="space-y-3">
            {people.map((p) => (
              <div
                key={p.id}
                className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4 space-y-2.5 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-white text-base flex items-center gap-2">
                      <Users className="w-4 h-4 text-indigo-400" />
                      {p.name}
                    </h3>
                    {p.role && <span className="text-xs text-indigo-300 font-medium">{p.role}</span>}
                  </div>
                  {p.lastInteraction && (
                    <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3 text-slate-500" />
                      Última interacción: {p.lastInteraction}
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">{p.context}</p>

                {p.relatedProject && (
                  <div className="text-xs text-slate-400">
                    <strong className="text-slate-300">Proyecto vinculado:</strong> {p.relatedProject}
                  </div>
                )}

                {p.pendingItems && p.pendingItems.length > 0 && (
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
                      Pendientes con {p.name}:
                    </span>
                    <ul className="list-disc list-inside text-xs text-slate-300 space-y-0.5">
                      {p.pendingItems.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {p.phone && (
                  <div className="text-xs text-slate-400 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                    <span>{p.phone}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* SUBTAB: PROYECTOS */}
        {activeSubTab === 'proyectos' && (
          <div className="space-y-3">
            {projects.map((prj) => (
              <div
                key={prj.id}
                className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4 space-y-2 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-white text-base flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-emerald-400" />
                    {prj.name}
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
                    {prj.status}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">{prj.description}</p>

                {prj.keyInformation && (
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-xs text-slate-300">
                    <strong className="text-indigo-400">Detalles clave:</strong> {prj.keyInformation}
                  </div>
                )}

                {prj.keyPeople && prj.keyPeople.length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-slate-400 pt-1">
                    <span>Personas involucradas:</span>
                    <div className="flex gap-1.5 flex-wrap">
                      {prj.keyPeople.map((kp, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-200 text-[11px]"
                        >
                          {kp}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* SUBTAB: GRAFO DE RELACIONES */}
        {activeSubTab === 'relaciones' && (
          <div className="space-y-3">
            <div className="bg-indigo-950/30 border border-indigo-800/40 rounded-2xl p-3.5 text-xs text-indigo-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>
                Grafo semántico activo: El asistente utiliza estas conexiones lógicas para responder preguntas
                complejas y razonar vínculos de negocio.
              </span>
            </div>

            <div className="space-y-2">
              {relationships.map((rel) => (
                <div
                  key={rel.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-sm hover:border-slate-700 transition"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-100 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-xs">
                      {rel.from}
                    </span>

                    <span className="flex items-center gap-1 text-xs font-mono text-indigo-400 font-semibold px-1">
                      <ArrowRight className="w-3.5 h-3.5" />
                      [{rel.relation}]
                    </span>

                    <span className="font-semibold text-slate-100 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-xs">
                      {rel.to}
                    </span>
                  </div>

                  {rel.context && (
                    <span className="text-[11px] text-slate-400 italic bg-slate-950/60 px-2 py-0.5 rounded-md">
                      {rel.context}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SUBTAB: NOTAS Y ACUERDOS */}
        {activeSubTab === 'memorias' && (
          <div className="space-y-2.5">
            {memories.map((mem) => (
              <div
                key={mem.id}
                className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-3.5 space-y-1.5 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white text-sm flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                    {mem.title}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-bold bg-slate-800 text-indigo-300 border border-slate-700">
                    {mem.category}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {mem.content}
                </p>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400 pt-1">
                  {mem.relatedPerson && (
                    <span className="text-indigo-300">Persona: {mem.relatedPerson}</span>
                  )}
                  {mem.relatedProject && (
                    <span className="text-slate-400">Proyecto: {mem.relatedProject}</span>
                  )}
                  {mem.tags && mem.tags.length > 0 && (
                    <div className="flex gap-1">
                      {mem.tags.map((tg, idx) => (
                        <span key={idx} className="text-[10px] text-slate-400">
                          #{tg}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* SUBTAB: LUGARES */}
        {activeSubTab === 'lugares' && (
          <div className="space-y-3">
            {places.map((plc) => (
              <div
                key={plc.id}
                className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-3.5 space-y-1.5 shadow-sm"
              >
                <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-emerald-400" />
                  {plc.name}
                </h3>
                {plc.address && (
                  <p className="text-xs text-slate-300 font-mono">{plc.address}</p>
                )}
                {plc.notes && <p className="text-xs text-slate-400">{plc.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Unified Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-400" />
                Registrar en Memoria
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {activeSubTab === 'personas' && (
              <form onSubmit={handleCreatePerson} className="space-y-3 text-xs">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Nombre de la persona *</label>
                  <input
                    type="text"
                    required
                    value={personName}
                    onChange={(e) => setPersonName(e.target.value)}
                    placeholder="ej. Juan / Carlos / María"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Rol / Ocupación</label>
                  <input
                    type="text"
                    value={personRole}
                    onChange={(e) => setPersonRole(e.target.value)}
                    placeholder="ej. Inversionista / Arquitecto"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Contexto relevante *</label>
                  <textarea
                    rows={3}
                    required
                    value={personContext}
                    onChange={(e) => setPersonContext(e.target.value)}
                    placeholder="ej. Interesado en comprar departamento de 3 habitaciones..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 resize-none"
                  />
                </div>
                <div className="pt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                  >
                    Guardar Persona
                  </button>
                </div>
              </form>
            )}

            {activeSubTab === 'proyectos' && (
              <form onSubmit={handleCreateProject} className="space-y-3 text-xs">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Nombre del Proyecto *</label>
                  <input
                    type="text"
                    required
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="ej. Venta departamento Miraflores"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Descripción del Proyecto *</label>
                  <textarea
                    rows={2}
                    required
                    value={projectDesc}
                    onChange={(e) => setProjectDesc(e.target.value)}
                    placeholder="Resumen del objetivo y estado"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 resize-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Datos Clave</label>
                  <textarea
                    rows={2}
                    value={projectInfo}
                    onChange={(e) => setProjectInfo(e.target.value)}
                    placeholder="Precio, medidas, detalles técnicos..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 resize-none"
                  />
                </div>
                <div className="pt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                  >
                    Guardar Proyecto
                  </button>
                </div>
              </form>
            )}

            {activeSubTab === 'relaciones' && (
              <form onSubmit={handleCreateRelationship} className="space-y-3 text-xs">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Entidad Origen *</label>
                  <input
                    type="text"
                    required
                    value={relFrom}
                    onChange={(e) => setRelFrom(e.target.value)}
                    placeholder="ej. Juan"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Relación / Conexión *</label>
                  <input
                    type="text"
                    required
                    value={relRelation}
                    onChange={(e) => setRelRelation(e.target.value)}
                    placeholder="ej. interesado en / arquitecto de / socio de"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Entidad Destino *</label>
                  <input
                    type="text"
                    required
                    value={relTo}
                    onChange={(e) => setRelTo(e.target.value)}
                    placeholder="ej. Departamento Miraflores"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                  />
                </div>
                <div className="pt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                  >
                    Conectar Entidades
                  </button>
                </div>
              </form>
            )}

            {(activeSubTab === 'memorias' || activeSubTab === 'lugares') && (
              <form onSubmit={handleCreateMemory} className="space-y-3 text-xs">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Título del Recuerdo *</label>
                  <input
                    type="text"
                    required
                    value={memTitle}
                    onChange={(e) => setMemTitle(e.target.value)}
                    placeholder="ej. Qué llevar a la reunión con Pedro"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Categoría</label>
                  <select
                    value={memCategory}
                    onChange={(e) => setMemCategory(e.target.value as MemoryCategory)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                  >
                    <option value="compromiso">Compromiso / Qué llevar</option>
                    <option value="preferencia">Preferencia del usuario o cliente</option>
                    <option value="persona">Detalle de persona</option>
                    <option value="proyecto">Información de proyecto</option>
                    <option value="decision">Decisión acordada</option>
                    <option value="general">General</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Contenido *</label>
                  <textarea
                    rows={3}
                    required
                    value={memContent}
                    onChange={(e) => setMemContent(e.target.value)}
                    placeholder="Detalles que el asistente debe recordar persistentemente..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 resize-none"
                  />
                </div>
                <div className="pt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                  >
                    Guardar Memoria
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
