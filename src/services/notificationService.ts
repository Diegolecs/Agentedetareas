import { Reminder } from '../types';

export type DeviceNotificationPermission = NotificationPermission | 'unsupported';

export interface WebPushStatus {
  isSupported: boolean;
  isIframe: boolean;
  isHttps: boolean;
  permission: DeviceNotificationPermission;
  isSubscribed: boolean;
  subscriptionEndpoint: string | null;
  vapidPublicKeyLoaded: boolean;
  serviceWorkerActive: boolean;
  error?: string;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

class NotificationService {
  private vapidPublicKey: string | null = null;
  private currentSubscription: PushSubscription | null = null;
  private swRegistration: ServiceWorkerRegistration | null = null;
  private listeners: Set<(reminderId: string, reminder?: Reminder) => void> = new Set();
  private statusListeners: Set<(status: WebPushStatus) => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      this.initServiceWorkerAndPush();
      this.listenToServiceWorkerMessages();
    }
  }

  /**
   * Listen to clicks or events forwarded by the Service Worker
   */
  private listenToServiceWorkerMessages(): void {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('[NotificationService] Message from Service Worker:', event.data);
        if (event.data && event.data.type === 'PUSH_NOTIFICATION_CLICKED') {
          const reminderId = event.data.data?.reminderId;
          if (reminderId) {
            this.notifyListeners(reminderId);
          }
        }
      });
    }
  }

  public onNotificationFired(callback: (reminderId: string, reminder?: Reminder) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  public onStatusChange(callback: (status: WebPushStatus) => void): () => void {
    this.statusListeners.add(callback);
    callback(this.getStatus());
    return () => {
      this.statusListeners.delete(callback);
    };
  }

  private notifyStatusListeners(): void {
    const status = this.getStatus();
    for (const listener of this.statusListeners) {
      try {
        listener(status);
      } catch (err) {
        console.error('[NotificationService] Status listener error:', err);
      }
    }
  }

  private notifyListeners(reminderId: string, reminder?: Reminder): void {
    for (const listener of this.listeners) {
      try {
        listener(reminderId, reminder);
      } catch (err) {
        console.error('[NotificationService] Listener error:', err);
      }
    }
  }

  public isIframe(): boolean {
    try {
      return typeof window !== 'undefined' && window.self !== window.top;
    } catch {
      return true;
    }
  }

  public isHttps(): boolean {
    if (typeof window === 'undefined') return false;
    return window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  }

  public isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      'serviceWorker' in navigator &&
      'PushManager' in window
    );
  }

  public getPermission(): DeviceNotificationPermission {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission;
  }

  public getStatus(): WebPushStatus {
    const supported = this.isSupported();
    return {
      isSupported: supported,
      isIframe: this.isIframe(),
      isHttps: this.isHttps(),
      permission: this.getPermission(),
      isSubscribed: !!this.currentSubscription,
      subscriptionEndpoint: this.currentSubscription ? this.currentSubscription.endpoint : null,
      vapidPublicKeyLoaded: !!this.vapidPublicKey,
      serviceWorkerActive: !!(this.swRegistration && this.swRegistration.active),
    };
  }

  /**
   * Initializes the Service Worker and retrieves the current push subscription
   */
  public async initServiceWorkerAndPush(): Promise<ServiceWorkerRegistration | null> {
    if (!this.isSupported()) {
      console.warn('[NotificationService] Web Push is not supported in this browser environment.');
      this.notifyStatusListeners();
      return null;
    }

    try {
      // 1. Fetch VAPID public key from backend
      await this.fetchVapidKey();

      // 2. Register or get Service Worker
      let reg: ServiceWorkerRegistration | undefined;
      try {
        // Try getting existing registration first
        const existing = await navigator.serviceWorker.getRegistration();
        if (existing) {
          reg = existing;
        } else {
          // Register sw.js (generated by vite-plugin-pwa with imported sw-push.js)
          reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        }
      } catch (swErr) {
        console.warn('[NotificationService] Could not register /sw.js directly, attempting fallback:', swErr);
        // Fallback registration to direct sw-push if dev mode has custom routing
        try {
          reg = await navigator.serviceWorker.register('/sw-push.js', { scope: '/' });
        } catch (fbErr) {
          console.error('[NotificationService] Service Worker registration failed completely:', fbErr);
        }
      }

      if (reg) {
        this.swRegistration = reg;
        console.log('[NotificationService] Service Worker registered with scope:', reg.scope);

        // 3. Check if already subscribed to PushManager
        if (reg.pushManager) {
          try {
            const sub = await reg.pushManager.getSubscription();
            if (sub) {
              this.currentSubscription = sub;
              console.log('[NotificationService] Existing Push Subscription found:', sub.endpoint.substring(0, 50) + '...');
              // Ensure backend has current subscription synced
              await this.syncSubscriptionWithBackend(sub);
            }
          } catch (subCheckErr) {
            console.warn('[NotificationService] Error checking existing push subscription:', subCheckErr);
          }
        }
      }

      this.notifyStatusListeners();
      return this.swRegistration;
    } catch (err) {
      console.error('[NotificationService] Failed to initialize Service Worker & Push:', err);
      this.notifyStatusListeners();
      return null;
    }
  }

  /**
   * Fetches VAPID public key from backend API
   */
  public async fetchVapidKey(): Promise<string | null> {
    if (this.vapidPublicKey) return this.vapidPublicKey;

    try {
      const res = await fetch('/api/push/vapid-public-key');
      if (res.ok) {
        const data = await res.json();
        if (data.publicKey) {
          this.vapidPublicKey = data.publicKey;
          return this.vapidPublicKey;
        }
      }
    } catch (err) {
      console.error('[NotificationService] Failed to fetch VAPID public key from backend:', err);
    }
    return null;
  }

  /**
   * Requests OS/Browser notification permission and subscribes to Web Push
   */
  public async requestPermissionAndSubscribe(userId: string = 'usr-diego-default'): Promise<{
    success: boolean;
    permission: DeviceNotificationPermission;
    isSubscribed: boolean;
    error?: string;
  }> {
    if (!this.isSupported()) {
      return {
        success: false,
        permission: 'unsupported',
        isSubscribed: false,
        error: 'Tu navegador no soporta la API de Web Push o Service Workers.',
      };
    }

    if (this.isIframe()) {
      return {
        success: false,
        permission: this.getPermission(),
        isSubscribed: false,
        error: 'Estás en la vista previa embebida (Iframe). Los navegadores bloquean permisos de notificación en marcos embebidos. Abre la app en pestaña completa.',
      };
    }

    try {
      // 1. Request Notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        this.notifyStatusListeners();
        return {
          success: false,
          permission,
          isSubscribed: false,
          error: permission === 'denied'
            ? 'El permiso de notificación fue rechazado. Actívalo en el icono de candado del navegador.'
            : 'No se concedió el permiso de notificación.',
        };
      }

      // 2. Ensure Service Worker and VAPID key are ready
      const reg = this.swRegistration || (await this.initServiceWorkerAndPush());
      if (!reg || !reg.pushManager) {
        return {
          success: false,
          permission,
          isSubscribed: false,
          error: 'Service Worker o PushManager no disponibles en este momento.',
        };
      }

      const vapidKey = await this.fetchVapidKey();
      if (!vapidKey) {
        return {
          success: false,
          permission,
          isSubscribed: false,
          error: 'No se pudo obtener la clave pública VAPID del servidor.',
        };
      }

      // 3. Subscribe with PushManager
      const convertedVapidKey = urlBase64ToUint8Array(vapidKey);
      let subscription = await reg.pushManager.getSubscription();

      if (!subscription) {
        console.log('[NotificationService] Subscribing device to PushManager...');
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey,
        });
      }

      this.currentSubscription = subscription;
      console.log('[NotificationService] Successfully obtained PushSubscription from PushManager!');

      // 4. Send subscription to Backend
      await this.syncSubscriptionWithBackend(subscription, userId);
      this.notifyStatusListeners();

      return {
        success: true,
        permission,
        isSubscribed: true,
      };
    } catch (err: any) {
      console.error('[NotificationService] Error in requestPermissionAndSubscribe:', err);
      this.notifyStatusListeners();
      return {
        success: false,
        permission: this.getPermission(),
        isSubscribed: false,
        error: err.message || 'Error desconocido suscribiendo al servicio Push.',
      };
    }
  }

  /**
   * Syncs PushSubscription with backend server
   */
  private async syncSubscriptionWithBackend(subscription: PushSubscription, userId: string = 'usr-diego-default'): Promise<boolean> {
    try {
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription,
          userId,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
        }),
      });
      if (res.ok) {
        console.log('[NotificationService] PushSubscription registered with backend server.');
        return true;
      }
    } catch (err) {
      console.error('[NotificationService] Failed to send push subscription to backend:', err);
    }
    return false;
  }

  /**
   * Program a reminder in the backend Web Push scheduler
   */
  public async scheduleReminderInBackend(reminder: Reminder, userId: string = 'usr-diego-default'): Promise<boolean> {
    try {
      const res = await fetch('/api/push/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: reminder.id,
          userId,
          title: reminder.title,
          body: reminder.notes || 'Es hora de atender este recordatorio programado.',
          scheduledTime: reminder.scheduledTime,
        }),
      });
      if (res.ok) {
        console.log(`[NotificationService] Reminder "${reminder.title}" scheduled in backend push system.`);
        return true;
      }
    } catch (err) {
      console.error('[NotificationService] Failed to schedule reminder in backend push system:', err);
    }
    return false;
  }

  /**
   * Cancel a reminder in backend Web Push scheduler
   */
  public async cancelReminderInBackend(reminderId: string): Promise<boolean> {
    try {
      const res = await fetch('/api/push/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminderId }),
      });
      return res.ok;
    } catch (err) {
      console.error('[NotificationService] Failed to cancel reminder in backend push system:', err);
      return false;
    }
  }

  /**
   * Synchronize active reminders with backend scheduler
   */
  public syncReminders(reminders: Reminder[], userId: string = 'usr-diego-default'): void {
    for (const rem of reminders) {
      if (rem.status === 'scheduled') {
        this.scheduleReminderInBackend(rem, userId);
      } else {
        this.cancelReminderInBackend(rem.id);
      }
    }
  }

  /**
   * Send a test Web Push notification via the backend
   * delaySeconds: 0 for immediate, > 0 for scheduled test
   */
  public async sendBackendTestPush(delaySeconds: number = 0, title?: string, body?: string): Promise<{
    success: boolean;
    mode?: string;
    message?: string;
    error?: string;
  }> {
    try {
      const res = await fetch('/api/push/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          delaySeconds,
          title: title || 'Prueba de Notificación Push',
          body: body || (delaySeconds > 0
            ? `Notificación programada para ${delaySeconds}s recibida correctamente.`
            : 'Notificación real enviada desde el backend de tu Asistente.'),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Error al solicitar prueba' };
      }
      return { success: true, mode: data.mode, message: data.message };
    } catch (err: any) {
      return { success: false, error: err.message || 'Error de conexión' };
    }
  }

  /**
   * Get overall status of the push system from the server
   */
  public async getBackendPushStatus(): Promise<any> {
    try {
      const res = await fetch('/api/push/status');
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.error('[NotificationService] Failed to fetch backend push status:', e);
    }
    return null;
  }

  /**
   * Plays a subtle sound chime
   */
  public playChime(): void {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(739.99, now);
      osc.frequency.exponentialRampToValueAtTime(987.77, now + 0.12);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.65);
    } catch {
      // Audio suppressed
    }
  }
}

export const notificationService = new NotificationService();
