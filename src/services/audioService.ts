// Audio & Speech recognition service

export interface AudioRecordingResult {
  audioBlob: Blob;
  base64Data: string;
  mimeType: string;
  durationSeconds: number;
}

export type MicErrorType =
  | 'NotAllowedError'
  | 'NotFoundError'
  | 'NotReadableError'
  | 'SecurityError'
  | 'NotSupported'
  | 'Unknown';

export interface AudioStartResult {
  success: boolean;
  mode: 'dual' | 'speech_recognition' | 'media_recorder' | 'none';
  errorType?: MicErrorType;
  errorMessage?: string;
  isInIframe: boolean;
}

export interface MicDiagnostics {
  isSupported: boolean;
  hasMediaDevices: boolean;
  hasSpeechRecognition: boolean;
  hasMediaRecorder: boolean;
  isSecureContext: boolean;
  isInIframe: boolean;
  permissionState?: string;
}

export class AudioService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private recognition: any = null;
  private startTime = 0;
  private isListening = false;
  private manualStop = false;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animFrameId: number | null = null;
  private onVolumeChangeCallback: ((volume: number) => void) | null = null;

  setOnVolumeChange(callback: ((volume: number) => void) | null): void {
    this.onVolumeChangeCallback = callback;
  }

  isRunningInIframe(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  }

  isSpeechRecognitionSupported(): boolean {
    return typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
  }

  isMediaRecorderSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function' &&
      typeof MediaRecorder !== 'undefined'
    );
  }

  async checkDiagnostics(): Promise<MicDiagnostics> {
    const isInIframe = this.isRunningInIframe();
    const isSecureContext = typeof window !== 'undefined' ? !!window.isSecureContext : false;
    const hasSpeechRecognition = this.isSpeechRecognitionSupported();
    const hasMediaDevices =
      typeof navigator !== 'undefined' && !!navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function';
    const hasMediaRecorder = typeof MediaRecorder !== 'undefined';
    const isSupported = hasSpeechRecognition || (hasMediaDevices && hasMediaRecorder);

    let permissionState: string | undefined = undefined;
    if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      try {
        const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        permissionState = status.state;
      } catch {
        // Not all browsers support querying microphone permission
      }
    }

    return {
      isSupported,
      hasMediaDevices,
      hasSpeechRecognition,
      hasMediaRecorder,
      isSecureContext,
      isInIframe,
      permissionState,
    };
  }

  startSpeechRecognition(
    onResult: (text: string, isFinal: boolean) => void,
    onError?: (err: any) => void
  ): boolean {
    if (!this.isSpeechRecognitionSupported()) {
      return false;
    }

    try {
      this.stopSpeechRecognition();

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'es-ES';
      this.recognition.maxAlternatives = 1;
      this.manualStop = false;
      this.isListening = true;

      this.recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = 0; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + ' ';
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const text = (finalTranscript + interimTranscript).trim();
        onResult(text, !!finalTranscript);
      };

      this.recognition.onerror = (event: any) => {
        const error = event.error || 'unknown';
        console.warn('SpeechRecognition error:', error, event);

        // Ignore benign events like temporary silence
        if (error === 'no-speech') {
          return;
        }

        if (onError) {
          onError(event);
        }
      };

      this.recognition.onend = () => {
        // If still supposed to be listening and user didn't stop manually, restart
        if (this.isListening && !this.manualStop) {
          try {
            this.recognition.start();
          } catch {
            this.isListening = false;
          }
        } else {
          this.isListening = false;
        }
      };

      this.recognition.start();
      return true;
    } catch (e) {
      console.error('Failed to start speech recognition:', e);
      this.isListening = false;
      return false;
    }
  }

  stopSpeechRecognition(): void {
    this.manualStop = true;
    this.isListening = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // ignore
      }
      this.recognition = null;
    }
  }

  async startAudioRecording(): Promise<AudioStartResult> {
    const isInIframe = this.isRunningInIframe();
    this.audioChunks = [];

    if (!this.isMediaRecorderSupported()) {
      return {
        success: false,
        mode: 'none',
        errorType: 'NotSupported',
        errorMessage:
          'Tu navegador o dispositivo no tiene soporte completo para captura de audio (MediaRecorder/getUserMedia).',
        isInIframe,
      };
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      let options: MediaRecorderOptions | undefined = undefined;
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          options = { mimeType: 'audio/webm;codecs=opus' };
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          options = { mimeType: 'audio/webm' };
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          options = { mimeType: 'audio/mp4' };
        } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
          options = { mimeType: 'audio/ogg;codecs=opus' };
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          options = { mimeType: 'audio/ogg' };
        } else if (MediaRecorder.isTypeSupported('audio/wav')) {
          options = { mimeType: 'audio/wav' };
        }
      }

      this.mediaRecorder = options ? new MediaRecorder(this.stream, options) : new MediaRecorder(this.stream);
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.audioChunks.push(e.data);
        }
      };

      this.startTime = Date.now();
      this.mediaRecorder.start(200);

      // Start real-time volume detection for UI visual feedback
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          this.audioContext = new AudioCtx();
          if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
          }
          const source = this.audioContext.createMediaStreamSource(this.stream);
          this.analyser = this.audioContext.createAnalyser();
          this.analyser.fftSize = 256;
          source.connect(this.analyser);

          const bufferLength = this.analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);

          const updateVolume = () => {
            if (!this.analyser) return;
            this.analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
              sum += dataArray[i];
            }
            const avg = sum / bufferLength;
            const vol = Math.min(100, Math.round((avg / 64) * 100));
            if (this.onVolumeChangeCallback) {
              this.onVolumeChangeCallback(vol);
            }
            this.animFrameId = requestAnimationFrame(updateVolume);
          };
          updateVolume();
        }
      } catch (audioCtxErr) {
        console.warn('Volume meter could not be started:', audioCtxErr);
      }

      return {
        success: true,
        mode: this.isSpeechRecognitionSupported() ? 'dual' : 'media_recorder',
        isInIframe,
      };
    } catch (e: any) {
      console.error('Error starting audio recording:', e);
      let errorType: MicErrorType = 'Unknown';
      let errorMessage = 'No se pudo acceder al micrófono.';

      const name = e?.name || '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        errorType = 'NotAllowedError';
        errorMessage = isInIframe
          ? 'El navegador o el marco embebido denegó el permiso del micrófono. Si estás en la vista previa, pulsa "Abrir en nueva pestaña" para autorizar el micrófono.'
          : 'Permiso del micrófono denegado. Haz clic en el icono del candado o cámara/micrófono en la barra de direcciones de tu navegador y selecciona "Permitir".';
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        errorType = 'NotFoundError';
        errorMessage = 'No se encontró ningún micrófono conectado en tu equipo o dispositivo.';
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        errorType = 'NotReadableError';
        errorMessage = 'El micrófono está en uso por otra aplicación o bloqueado por la configuración de tu sistema operativo.';
      } else if (name === 'SecurityError') {
        errorType = 'SecurityError';
        errorMessage = isInIframe
          ? 'Acceso al micrófono restringido por la seguridad del marco embebido. Abre la aplicación en una pestaña nueva para otorgar permiso.'
          : 'Acceso restringido por la política de seguridad del navegador.';
      } else if (e?.message) {
        errorMessage = e.message;
      }

      // Cleanup stream if partially created
      if (this.stream) {
        try {
          this.stream.getTracks().forEach((track) => track.stop());
        } catch {}
        this.stream = null;
      }

      return {
        success: false,
        mode: 'none',
        errorType,
        errorMessage,
        isInIframe,
      };
    }
  }

  async stopAudioRecording(): Promise<AudioRecordingResult | null> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        if (this.stream) {
          this.stream.getTracks().forEach((track) => track.stop());
          this.stream = null;
        }
        resolve(null);
        return;
      }

      const recorder = this.mediaRecorder;
      let hasResolved = false;

      const finish = () => {
        if (hasResolved) return;
        hasResolved = true;

        const durationSeconds = Math.max(0.1, (Date.now() - this.startTime) / 1000);
        const rawMime = recorder?.mimeType || 'audio/webm';
        const mimeType = rawMime.split(';')[0].trim().toLowerCase() || 'audio/webm';
        const audioBlob = new Blob(this.audioChunks, { type: mimeType });

        // Stop volume analyzer
        if (this.animFrameId) {
          cancelAnimationFrame(this.animFrameId);
          this.animFrameId = null;
        }
        if (this.onVolumeChangeCallback) {
          this.onVolumeChangeCallback(0);
        }
        if (this.audioContext) {
          try {
            this.audioContext.close();
          } catch {}
          this.audioContext = null;
        }
        this.analyser = null;

        // Clean up tracks
        if (this.stream) {
          try {
            this.stream.getTracks().forEach((track) => track.stop());
          } catch {}
          this.stream = null;
        }
        this.mediaRecorder = null;

        if (audioBlob.size === 0) {
          console.warn('[AudioService] Audio blob is empty (0 bytes)');
          resolve(null);
          return;
        }

        console.log(`[AudioService] Recorded ${audioBlob.size} bytes (${durationSeconds.toFixed(1)}s, ${mimeType})`);

        // Convert to base64
        const reader = new FileReader();
        reader.onloadend = () => {
          const resultStr = typeof reader.result === 'string' ? reader.result : '';
          const base64String = resultStr.split(',')[1] || '';
          resolve({
            audioBlob,
            base64Data: base64String,
            mimeType,
            durationSeconds,
          });
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(audioBlob);
      };

      recorder.onstop = () => {
        finish();
      };

      try {
        if (recorder.state === 'recording' || recorder.state === 'paused') {
          recorder.stop();
        } else {
          finish();
        }
      } catch (err) {
        console.warn('Error stopping mediaRecorder:', err);
        finish();
      }

      // Safeguard timeout so it never hangs
      setTimeout(() => {
        finish();
      }, 2000);
    });
  }

  // ================= Speech Synthesis (TTS) =================

  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private currentAudioUrl: string | null = null;
  private audioCache = new Map<string, { audioBase64: string; mimeType: string }>();

  private cleanupCurrentAudio(): void {
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch {}
      this.currentAudio = null;
    }
    if (this.currentAudioUrl) {
      try {
        URL.revokeObjectURL(this.currentAudioUrl);
      } catch {}
      this.currentAudioUrl = null;
    }
  }

  isSpeechSynthesisSupported(): boolean {
    return typeof window !== 'undefined' && ('Audio' in window || 'speechSynthesis' in window);
  }

  /**
   * Helper to clean markdown formatting, headers, links, lists and emojis
   * ensuring smooth, human conversational phrasing.
   */
  cleanTextForSpeech(text: string): string {
    return text
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      // Remove markdown links but keep text: [Texto](url) -> Texto
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
      // Remove standalone URLs
      .replace(/https?:\/\/\S+/gi, '')
      // Clean markdown headers (#, ##, ###)
      .replace(/^#+\s+/gm, '')
      // Replace list bullets with natural conversational pauses
      .replace(/^[-*•]\s+/gm, '')
      .replace(/^\d+\.\s+/gm, '')
      // Clean bold/italics
      .replace(/[*_~]/g, '')
      // Remove emojis that may produce awkward mechanical descriptions
      .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      // Normalize whitespace and pauses
      .replace(/\n+/g, '. ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Selects the most natural, warm, adult masculine Spanish voice available in the current browser/OS.
   */
  getBestMasculineSpanishVoice(): { voice: SpeechSynthesisVoice | null; isExplicitMale: boolean } {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return { voice: null, isExplicitMale: false };

    let voices: SpeechSynthesisVoice[] = [];
    try {
      voices = window.speechSynthesis.getVoices() || [];
    } catch {
      voices = [];
    }

    if (!voices || voices.length === 0) return { voice: null, isExplicitMale: false };

    // Filter Spanish voices
    const spanishVoices = voices.filter((v) => {
      const lang = (v.lang || '').toLowerCase().replace(/_/g, '-');
      return lang.startsWith('es-') || lang === 'es';
    });

    if (spanishVoices.length === 0) {
      return { voice: null, isExplicitMale: false };
    }

    const femaleIndicators = [
      'female', 'mujer', 'monica', 'mónica', 'paulina', 'helena', 'laura',
      'dalia', 'elvira', 'rosa', 'camila', 'sofi', 'sofia', 'maría', 'maria',
      'lucia', 'lucía', 'carmen', 'conchita', 'victoria', 'mia', 'martina',
      'valentina', 'girl', 'woman', 'sandra', 'elena', 'ana', 'zira', 'sabina',
      'ines', 'inés', 'paloma', 'estrella', 'lola', 'catalina', 'clara', 'beatriz',
      'x-ana', 'female_1', 'female_2'
    ];

    const maleIndicators = [
      'jorge', 'alvaro', 'álvaro', 'pablo', 'raul', 'raúl', 'juan', 'diego',
      'carlos', 'mateo', 'miguel', 'gonzalo', 'emilio', 'javier', 'manuel',
      'enrique', 'david', 'andrés', 'andres', 'antonio', 'pedro', 'luis',
      'fernando', 'mario', 'male', 'hombre', 'varon', 'varón', 'boy', 'guy',
      'eed', 'sfg', 'male_1', 'male_2', 'male_3'
    ];

    // Priority 1: High quality Neural/Natural Spanish Male voice
    const naturalMale = spanishVoices.find((v) => {
      const name = (v.name || '').toLowerCase();
      const isNatural = name.includes('natural') || name.includes('neural') || name.includes('online');
      const isMale = maleIndicators.some((k) => name.includes(k));
      const isFemale = femaleIndicators.some((k) => name.includes(k));
      return isNatural && isMale && !isFemale;
    });
    if (naturalMale) {
      return { voice: naturalMale, isExplicitMale: true };
    }

    // Priority 2: Any explicit Spanish Male voice
    const explicitMale = spanishVoices.find((v) => {
      const name = (v.name || '').toLowerCase();
      const uri = (v.voiceURI || '').toLowerCase();
      const isMale = maleIndicators.some((k) => name.includes(k) || uri.includes(k));
      const isFemale = femaleIndicators.some((k) => name.includes(k) || uri.includes(k));
      return isMale && !isFemale;
    });
    if (explicitMale) {
      return { voice: explicitMale, isExplicitMale: true };
    }

    // Priority 3: Any Spanish voice that does NOT contain female indicators
    const nonFemale = spanishVoices.find((v) => {
      const name = (v.name || '').toLowerCase();
      const uri = (v.voiceURI || '').toLowerCase();
      return !femaleIndicators.some((k) => name.includes(k) || uri.includes(k));
    });
    if (nonFemale) {
      return { voice: nonFemale, isExplicitMale: false };
    }

    return { voice: spanishVoices[0], isExplicitMale: false };
  }

  /**
   * Client-side fallback using Web Speech API with warm adult masculine acoustic tuning
   */
  private speakWithWebSpeech(
    cleanText: string,
    onStart?: () => void,
    onEnd?: () => void,
    onError?: (err: any) => void
  ): boolean {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      if (onError) onError(new Error('SpeechSynthesis no disponible'));
      return false;
    }

    try {
      if (typeof window.speechSynthesis.resume === 'function') {
        window.speechSynthesis.resume();
      }

      const utterance = new SpeechSynthesisUtterance(cleanText);
      const { voice, isExplicitMale } = this.getBestMasculineSpanishVoice();
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang || 'es-ES';
      } else {
        utterance.lang = 'es-ES';
      }

      // Warm adult pitch & natural conversational speed
      utterance.pitch = isExplicitMale ? 0.94 : 0.88;
      utterance.rate = 1.0;
      utterance.volume = 1.0;

      this.currentUtterance = utterance;

      if (onStart) utterance.onstart = () => onStart();

      utterance.onend = () => {
        this.currentUtterance = null;
        if (onEnd) onEnd();
      };

      utterance.onerror = (e) => {
        this.currentUtterance = null;
        if (e.error !== 'canceled' && onError) {
          onError(e);
        } else if (onEnd) {
          onEnd();
        }
      };

      window.speechSynthesis.speak(utterance);
      return true;
    } catch (err) {
      console.warn('[AudioService] Web Speech fallback error:', err);
      this.currentUtterance = null;
      if (onError) onError(err);
      return false;
    }
  }

  /**
   * Plays the assistant's response in a warm, natural adult masculine Spanish voice.
   * Priority:
   * 1. High-fidelity Neural Voice via server /api/tts (Jorge Neural / Fenrir)
   * 2. Browser Web Speech API as fallback
   */
  async speakText(
    text: string,
    onStart?: () => void,
    onEnd?: () => void,
    onError?: (err: any) => void
  ): Promise<boolean> {
    // Cancel any current audio/speech
    this.stopSpeaking();

    const cleanText = this.cleanTextForSpeech(text);
    if (!cleanText) return false;

    // 1. Primary: High-fidelity Neural TTS via Server API
    try {
      let audioData = this.audioCache.get(cleanText);
      if (!audioData) {
        const response = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: cleanText }),
        });

        if (response.ok) {
          const json = await response.json();
          if (json.audioBase64) {
            audioData = {
              audioBase64: json.audioBase64,
              mimeType: json.mimeType || 'audio/mpeg',
            };
            this.audioCache.set(cleanText, audioData);
          }
        }
      }

      if (audioData) {
        const binary = atob(audioData.audioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: audioData.mimeType });
        const url = URL.createObjectURL(blob);
        this.currentAudioUrl = url;

        const audio = new Audio(url);
        this.currentAudio = audio;

        audio.onplay = () => {
          if (onStart) onStart();
        };

        audio.onended = () => {
          this.cleanupCurrentAudio();
          if (onEnd) onEnd();
        };

        audio.onerror = (e) => {
          console.warn('[AudioService] Audio element playback error:', e);
          this.cleanupCurrentAudio();
          // Fallback to Web Speech on audio playback error
          this.speakWithWebSpeech(cleanText, onStart, onEnd, onError);
        };

        await audio.play();
        return true;
      }
    } catch (serverErr) {
      console.warn('[AudioService] Server Neural TTS fetch error, switching to Web Speech fallback:', serverErr);
    }

    // 2. Secondary: Web Speech API fallback
    return this.speakWithWebSpeech(cleanText, onStart, onEnd, onError);
  }

  stopSpeaking(): void {
    this.cleanupCurrentAudio();

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (err) {
        console.warn('Error stopping speech synthesis:', err);
      }
      this.currentUtterance = null;
    }
  }

  isSpeaking(): boolean {
    const isAudioPlaying = this.currentAudio !== null && !this.currentAudio.paused;
    const isSpeechActive = typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.speaking;
    return Boolean(isAudioPlaying || isSpeechActive);
  }
}

export const audioService = new AudioService();


