import React, { useState, useRef, useEffect } from 'react';
import { AssistantState, Message } from '../types';
import { audioService, MicErrorType } from '../services/audioService';
import { AssistantService } from '../services/assistantService';
import {
  Mic,
  MicOff,
  Send,
  Calendar,
  CheckSquare,
  Sparkles,
  User,
  Clock,
  MapPin,
  HelpCircle,
  RefreshCw,
  FolderGit2,
  ChevronRight,
  Loader2,
  AlertTriangle,
  RotateCcw,
  Volume2,
  VolumeX,
  ExternalLink,
  X,
  ShieldAlert,
} from 'lucide-react';

interface ChatViewProps {
  state: AssistantState;
  onUpdateState: (newState: AssistantState) => void;
  onNavigateTab?: (tab: string) => void;
  currentDate: string;
}

export const ChatView: React.FC<ChatViewProps> = ({
  state,
  onUpdateState,
  onNavigateTab,
  currentDate,
}) => {
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [audioVolume, setAudioVolume] = useState(0);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const [isTranscribingAudio, setIsTranscribingAudio] = useState(false);
  const [transcriptionNotice, setTranscriptionNotice] = useState<string | null>(null);
  const [micModal, setMicModal] = useState<{
    isOpen: boolean;
    errorType: MicErrorType | 'Generic';
    message: string;
    isInIframe: boolean;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recordingTimerRef = useRef<any>(null);

  useEffect(() => {
    audioService.setOnVolumeChange((vol) => {
      setAudioVolume(vol);
    });
    return () => {
      audioService.setOnVolumeChange(null);
      audioService.stopSpeaking();
    };
  }, []);

  const handleToggleSpeech = async (msgId: string, content: string) => {
    if (speakingMsgId === msgId) {
      audioService.stopSpeaking();
      setSpeakingMsgId(null);
    } else {
      audioService.stopSpeaking();
      setSpeakingMsgId(msgId);
      const ok = await audioService.speakText(
        content,
        () => setSpeakingMsgId(msgId),
        () => setSpeakingMsgId(null),
        () => setSpeakingMsgId(null)
      );
      if (!ok) {
        setSpeakingMsgId(null);
      }
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [state.messages, isLoading, isRecording, isTranscribingAudio]);

  // Voice recording timer
  useEffect(() => {
    if (isRecording) {
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, [isRecording]);

  const handleSendMessage = async (textToSend?: string, isVoice?: boolean) => {
    const text = (textToSend !== undefined ? textToSend : inputText).trim();
    if (!text || isLoading) return;

    setInputText('');
    setVoiceTranscript('');
    setTranscriptionNotice(null);

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
      voiceTranscript: isVoice,
    };

    const nextMessages = [...state.messages, userMsg];

    const interimState: AssistantState = {
      ...state,
      messages: nextMessages,
    };

    onUpdateState(interimState);
    setIsLoading(true);
    setLastFailedMessage(null);

    try {
      const response = await AssistantService.sendMessage(text, interimState, currentDate);

      const assistantMsg: Message = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: response.text,
        timestamp: new Date().toISOString(),
        actionsExecuted: response.actionsExecuted || [],
      };

      // Merge updated state from server with local state
      const finalState: AssistantState = {
        ...interimState,
        events: response.updatedState?.events || interimState.events,
        tasks: response.updatedState?.tasks || interimState.tasks,
        reminders: response.updatedState?.reminders || interimState.reminders || [],
        people: response.updatedState?.people || interimState.people,
        projects: response.updatedState?.projects || interimState.projects,
        places: response.updatedState?.places || interimState.places,
        memories: response.updatedState?.memories || interimState.memories,
        relationships: response.updatedState?.relationships || interimState.relationships,
        actionHistory: response.updatedState?.actionHistory || interimState.actionHistory || [],
        messages: [...nextMessages, assistantMsg],
      };

      onUpdateState(finalState);
      setLastFailedMessage(null);
    } catch (err: any) {
      console.error('Chat error:', err);
      let rawMsg = err?.message || 'Error de conexión';
      try {
        if (typeof rawMsg === 'string' && rawMsg.startsWith('{') && rawMsg.includes('"message"')) {
          const parsed = JSON.parse(rawMsg);
          if (parsed?.error?.message) {
            rawMsg = parsed.error.message;
          }
        }
      } catch {}

      const lower = rawMsg.toLowerCase();
      const isHighDemand =
        lower.includes('high demand') ||
        lower.includes('demanda') ||
        lower.includes('unavailable') ||
        lower.includes('quota') ||
        lower.includes('rate-limit') ||
        lower.includes('rate limit') ||
        lower.includes('resource has been exhausted') ||
        lower.includes('429') ||
        rawMsg.includes('503');

      const content = isHighDemand
        ? '⚠️ Los servidores del asistente están experimentando alta demanda momentánea o límite de frecuencia en el servicio. Puedes presionar "Reintentar mensaje" para enviar tu consulta.'
        : `⚠️ Ocurrió un error al procesar tu solicitud: ${rawMsg}. Puedes presionar reintentar.`;

      const errorMsg: Message = {
        id: `msg-${Date.now() + 2}`,
        role: 'assistant',
        content,
        timestamp: new Date().toISOString(),
      };

      setLastFailedMessage(text);
      onUpdateState({
        ...interimState,
        messages: [...nextMessages, errorMsg],
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelVoice = () => {
    setIsRecording(false);
    setAudioVolume(0);
    audioService.stopSpeechRecognition();
    audioService.stopAudioRecording();
    setVoiceTranscript('');
    setTranscriptionNotice(null);
  };

  const handleToggleVoice = async () => {
    if (isRecording) {
      // User stopped speaking -> convert speech to text and send to AI
      setIsRecording(false);
      setAudioVolume(0);
      audioService.stopSpeechRecognition();
      setIsTranscribingAudio(true);
      setTranscriptionNotice(null);

      try {
        const audioResult = await audioService.stopAudioRecording();
        console.log('[ChatView] Voice recording finished:', {
          hasData: !!audioResult?.base64Data,
          sizeBytes: audioResult?.audioBlob?.size,
          durationSec: audioResult?.durationSeconds,
          liveTranscript: voiceTranscript,
        });

        // If recording was extremely brief (< 0.5s) without any speech detected
        if (audioResult && audioResult.durationSeconds < 0.5 && !voiceTranscript.trim()) {
          setTranscriptionNotice('Grabación muy breve (menos de un segundo). Mantén activo el micrófono mientras hablas.');
          setTimeout(() => setTranscriptionNotice(null), 5000);
          return;
        }

        // 1. Check if browser speech recognition already captured text
        let transcriptText = voiceTranscript.trim();

        // 2. If browser speech recognition did not return text, use Gemini audio transcription endpoint
        if (!transcriptText && audioResult?.base64Data) {
          try {
            const mimeType = audioResult.mimeType || 'audio/webm';
            transcriptText = await AssistantService.transcribeAudio(
              audioResult.base64Data,
              mimeType
            );
          } catch (e) {
            console.error('Voice transcription error:', e);
          }
        }

        // Clean any resulting text
        transcriptText = (transcriptText || '').trim();

        if (transcriptText) {
          // Send the transcribed text directly to the AI as a normal chat message
          await handleSendMessage(transcriptText, true);
        } else {
          setTranscriptionNotice('No se detectó voz clara en el audio. Asegúrate de hablar hacia el micrófono y de que no esté silenciado, o escribe tu mensaje.');
          setTimeout(() => setTranscriptionNotice(null), 6000);
        }
      } catch (err) {
        console.error('Error transcribing voice to text:', err);
        setTranscriptionNotice('Error al procesar el audio. Puedes escribir tu consulta directamente.');
        setTimeout(() => setTranscriptionNotice(null), 5000);
      } finally {
        setIsTranscribingAudio(false);
      }
    } else {
      // Start voice dictation
      setVoiceTranscript('');
      setTranscriptionNotice(null);

      const startRes = await audioService.startAudioRecording();
      if (startRes.success) {
        setIsRecording(true);
        // Start live speech-to-text recognition
        audioService.startSpeechRecognition(
          (text) => {
            setVoiceTranscript(text);
          },
          (err) => {
            console.warn('Live speech recognition warning:', err);
          }
        );
      } else {
        // Fallback: If mediaRecorder failed, test if SpeechRecognition can run independently
        if (audioService.isSpeechRecognitionSupported()) {
          const speechStarted = audioService.startSpeechRecognition(
            (text) => {
              setVoiceTranscript(text);
            },
            (err) => {
              console.warn('Speech recognition only error:', err);
              setIsRecording(false);
              setMicModal({
                isOpen: true,
                errorType: startRes.errorType || 'Generic',
                message: startRes.errorMessage || 'No se pudo acceder al micrófono.',
                isInIframe: startRes.isInIframe,
              });
            }
          );
          if (speechStarted) {
            setIsRecording(true);
            return;
          }
        }

        setMicModal({
          isOpen: true,
          errorType: startRes.errorType || 'Generic',
          message: startRes.errorMessage || 'No se pudo acceder al micrófono.',
          isInIframe: startRes.isInIframe,
        });
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {state.messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-full`}
            >
              <div
                className={`flex gap-3 max-w-[92%] sm:max-w-[80%] rounded-2xl p-4 shadow-md ${
                  isUser
                    ? 'bg-indigo-600 text-white rounded-br-xs'
                    : 'bg-slate-900 border border-slate-800/90 text-slate-100 rounded-bl-xs'
                }`}
              >
                {!isUser && (
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                )}
                <div className="flex-1 space-y-2 overflow-hidden">
                  <div className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap select-text">
                    {msg.content}
                  </div>

                  {/* Render executed actions badges */}
                  {msg.actionsExecuted && msg.actionsExecuted.length > 0 && (
                    <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                      <div className="text-[11px] uppercase tracking-wider font-semibold text-indigo-400 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Acciones ejecutadas en tu cuenta:
                      </div>
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        {msg.actionsExecuted.map((act, i) => (
                          <div
                            key={i}
                            className="bg-slate-950/60 border border-slate-800 rounded-lg p-2 text-xs"
                          >
                            <div className="font-semibold text-emerald-400 flex items-center gap-1">
                              <span>✓</span> {act.label}
                            </div>
                            <div className="text-slate-400 text-[11px] truncate mt-0.5">
                              {act.details}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div
                    className={`text-[10px] flex items-center justify-end gap-2 pt-1 ${
                      isUser ? 'text-indigo-200' : 'text-slate-500'
                    }`}
                  >
                    {!isUser && (
                      <button
                        type="button"
                        onClick={() => handleToggleSpeech(msg.id, msg.content)}
                        id={`btn-speech-${msg.id}`}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition active:scale-95 ${
                          speakingMsgId === msg.id
                            ? 'bg-indigo-600 text-white animate-pulse shadow-xs'
                            : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/50'
                        }`}
                        title={
                          speakingMsgId === msg.id
                            ? 'Detener lectura en voz alta'
                            : 'Escuchar respuesta en voz alta'
                        }
                      >
                        {speakingMsgId === msg.id ? (
                          <>
                            <VolumeX className="w-3.5 h-3.5" />
                            <span>Detener</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Escuchar</span>
                          </>
                        )}
                      </button>
                    )}
                    {msg.voiceTranscript && (
                      <span className="inline-flex items-center gap-1 bg-indigo-700/60 px-1.5 py-0.5 rounded text-[10px] font-medium text-indigo-100">
                        <Mic className="w-2.5 h-2.5" /> Dictado por voz
                      </span>
                    )}
                    <span>
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {(isLoading || isTranscribingAudio) && (
          <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4 max-w-sm shadow-md">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center shrink-0 animate-pulse">
              {isTranscribingAudio ? (
                <Mic className="w-4 h-4 text-white" />
              ) : (
                <Sparkles className="w-4 h-4 text-white" />
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
              <span>
                {isTranscribingAudio
                  ? 'Convirtiendo tu voz a texto para la IA...'
                  : 'El asistente está procesando tu solicitud...'}
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Notice if transcription had an issue */}
      {transcriptionNotice && (
        <div className="px-4 py-2 bg-amber-950/90 border-t border-amber-800/80 flex items-center justify-between text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{transcriptionNotice}</span>
          </div>
          <button
            onClick={() => setTranscriptionNotice(null)}
            className="text-amber-400 hover:text-amber-200 underline text-xs ml-2"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Recording Overlay if active */}
      {isRecording && (
        <div className="bg-gradient-to-r from-rose-950/80 via-slate-900 to-rose-950/80 border-t border-rose-800/80 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xl animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
            </span>
            <div className="space-y-1">
              <div className="text-xs font-semibold text-rose-300 flex items-center gap-2 flex-wrap">
                <Mic className="w-3.5 h-3.5 animate-pulse text-rose-400" />
                <span>Escuchando ({recordingSeconds}s)... Habla de forma natural</span>
                {/* Visualizer bars */}
                <div
                  className="flex items-center gap-0.5 h-3.5 px-1.5 py-0.5 bg-slate-950/80 rounded border border-slate-800"
                  title={`Nivel de micrófono: ${audioVolume}%`}
                >
                  {[1, 2, 3, 4, 5].map((bar) => {
                    const active = audioVolume >= bar * 12;
                    return (
                      <span
                        key={bar}
                        className={`w-1 rounded-full transition-all duration-75 ${
                          active ? 'bg-emerald-400 h-full' : 'bg-slate-700 h-1'
                        }`}
                      />
                    );
                  })}
                </div>
                {audioVolume > 10 && (
                  <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/60">
                    Audio detectado
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 flex items-center gap-2 flex-wrap">
                <span>Tu voz se transcribirá fielmente a texto al pulsar Terminar</span>
                {recordingSeconds >= 3 && audioVolume < 5 && (
                  <span className="text-amber-400/90 text-[10px] bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-900/40">
                    Sin señal de audio: verifica que el micrófono no esté en silencio
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            {voiceTranscript && (
              <div className="text-xs text-slate-200 italic max-w-[180px] sm:max-w-xs truncate bg-slate-950/90 px-2.5 py-1.5 rounded-lg border border-slate-800 shadow-inner">
                "{voiceTranscript}"
              </div>
            )}
            <button
              onClick={handleCancelVoice}
              id="btn-cancel-voice"
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition border border-slate-700/60 active:scale-95 flex items-center gap-1"
              title="Descartar grabación"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cancelar</span>
            </button>
            <button
              onClick={handleToggleVoice}
              id="btn-finish-voice"
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition shadow-sm active:scale-95 flex items-center gap-1.5"
            >
              <span>Terminar y Enviar</span>
              <Send className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Retry banner if last request failed */}
      {lastFailedMessage && !isLoading && (
        <div className="px-4 py-2 bg-amber-950/80 border-t border-amber-900/70 flex items-center justify-between text-xs text-amber-200">
          <div className="flex items-center gap-2 overflow-hidden mr-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="truncate">Mensaje no enviado por saturación temporal del servicio.</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                const msg = lastFailedMessage;
                setLastFailedMessage(null);
                handleSendMessage(msg);
              }}
              id="btn-retry-chat"
              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg flex items-center gap-1 transition shadow-xs"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reintentar</span>
            </button>
            <button
              onClick={() => setLastFailedMessage(null)}
              className="px-2 py-1 text-slate-400 hover:text-slate-200 transition"
            >
              Descartar
            </button>
          </div>
        </div>
      )}

      {/* Input Bar */}
      <div className="p-3 bg-slate-900 border-t border-slate-800">
        <div className="max-w-4xl mx-auto flex items-end gap-2">
          {/* Microphone button */}
          <button
            onClick={handleToggleVoice}
            disabled={isLoading}
            id="btn-mic"
            className={`p-3 rounded-xl transition flex items-center justify-center shrink-0 active:scale-95 ${
              isRecording
                ? 'bg-rose-600 text-white animate-pulse'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
            }`}
            title={isRecording ? 'Detener y procesar audio' : 'Hablarle al asistente por voz'}
          >
            {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 text-indigo-400" />}
          </button>

          {/* Text input */}
          <div className="flex-1 relative">
            <textarea
              id="input-chat-message"
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Habla o escribe de forma natural (ej. 'Mañana a las 4 ponme una hora para revisar la app')..."
              className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/70 focus:border-transparent resize-none max-h-32 leading-relaxed"
            />
          </div>

          {/* Send button */}
          <button
            onClick={() => handleSendMessage()}
            disabled={!inputText.trim() || isLoading}
            id="btn-send-message"
            className="p-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white transition flex items-center justify-center shrink-0 shadow-sm active:scale-95"
            title="Enviar mensaje"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Microphone Permission / Diagnostic Modal */}
      {micModal?.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                  <MicOff className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-semibold text-slate-100">
                    Acceso al micrófono no disponible
                  </h3>
                  <p className="text-xs text-slate-400">Diagnóstico de permisos de audio</p>
                </div>
              </div>
              <button
                onClick={() => setMicModal(null)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-300 space-y-3 leading-relaxed">
              <p className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-rose-200/90">
                {micModal.message}
              </p>

              {micModal.isInIframe && (
                <div className="bg-indigo-950/40 border border-indigo-800/60 rounded-xl p-3 text-xs text-indigo-200 space-y-2">
                  <div className="font-semibold flex items-center gap-1.5 text-indigo-300">
                    <ShieldAlert className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span>Recomendación para la vista previa:</span>
                  </div>
                  <p className="text-[11px] text-indigo-200/90">
                    Los navegadores (Chrome, Safari, Edge) restringen el acceso al micrófono dentro de marcos embebidos (iframes) por política de seguridad. Al abrir la app en una pestaña nueva, tu navegador te solicitará permiso directamente y el micrófono funcionará con normalidad.
                  </p>
                  <a
                    href={typeof window !== 'undefined' ? window.location.href : '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-xs transition"
                  >
                    <span>Abrir en pestaña nueva</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              <div className="space-y-1 text-slate-400 text-[11px] bg-slate-950/40 p-3 rounded-xl border border-slate-800/80">
                <div className="font-medium text-slate-300 mb-1">Pasos para autorizar el micrófono:</div>
                <div className="flex items-start gap-1.5">
                  <span className="text-indigo-400 font-bold">1.</span>
                  <span>Haz clic en el icono de candado o permisos a la izquierda de la barra de direcciones.</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <span className="text-indigo-400 font-bold">2.</span>
                  <span>En la opción <strong>Micrófono</strong>, selecciona <strong>Permitir</strong>.</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <span className="text-indigo-400 font-bold">3.</span>
                  <span>Presiona <strong>Reintentar</strong> a continuación.</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setMicModal(null)}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs rounded-xl transition border border-slate-700/60 active:scale-95"
              >
                Cerrar
              </button>
              <button
                onClick={() => {
                  setMicModal(null);
                  handleToggleVoice();
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-xl transition shadow-xs active:scale-95"
              >
                Reintentar micrófono
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
