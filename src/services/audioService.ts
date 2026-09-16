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

  isSpeechSynthesisSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  speakText(
    text: string,
    onStart?: () => void,
    onEnd?: () => void,
    onError?: (err: any) => void
  ): boolean {
    if (!this.isSpeechSynthesisSupported()) {
      if (onError) onError(new Error('SpeechSynthesis no está soportado en este navegador.'));
      return false;
    }

    try {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      // Clean text of markdown or emojis that might sound strange
      const cleanText = text
        .replace(/[*_#`~>]/g, '')
        .replace(/\(https?:\/\/[^\)]+\)/g, '')
        .trim();

      if (!cleanText) return false;

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'es-ES';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      // Select best Spanish voice if available
      const voices = window.speechSynthesis.getVoices();
      const spanishVoice = voices.find(
        (v) => v.lang.toLowerCase().startsWith('es-') || v.lang.toLowerCase() === 'es'
      );
      if (spanishVoice) {
        utterance.voice = spanishVoice;
      }

      if (onStart) utterance.onstart = () => onStart();
      utterance.onend = () => {
        if (onEnd) onEnd();
      };
      utterance.onerror = (e) => {
        // Ignore 'canceled' errors when user stops speech manually
        if (e.error !== 'canceled' && onError) {
          onError(e);
        } else if (onEnd) {
          onEnd();
        }
      };

      window.speechSynthesis.speak(utterance);
      return true;
    } catch (err) {
      console.warn('[AudioService] Error initiating speech synthesis:', err);
      if (onError) onError(err);
      return false;
    }
  }

  stopSpeaking(): void {
    if (this.isSpeechSynthesisSupported()) {
      try {
        window.speechSynthesis.cancel();
      } catch (err) {
        console.warn('Error stopping speech synthesis:', err);
      }
    }
  }

  isSpeaking(): boolean {
    return this.isSpeechSynthesisSupported() && window.speechSynthesis.speaking;
  }
}

export const audioService = new AudioService();


