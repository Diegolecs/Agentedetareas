import webpush, { PushSubscription } from 'web-push';
import fs from 'fs';
import path from 'path';

export interface StoredSubscription {
  id: string;
  userId: string;
  subscription: PushSubscription;
  userAgent?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduledReminder {
  id: string;
  userId: string;
  title: string;
  body: string;
  scheduledTime: string; // ISO string
  status: 'scheduled' | 'sent' | 'cancelled' | 'failed';
  attempts: number;
  lastAttemptAt?: string;
  error?: string;
  createdAt: string;
}

const DATA_DIR = path.join(process.cwd(), '.data');
const VAPID_FILE = path.join(DATA_DIR, 'vapid-keys.json');
const SUBSCRIPTIONS_FILE = path.join(DATA_DIR, 'push-subscriptions.json');
const REMINDERS_FILE = path.join(DATA_DIR, 'scheduled-reminders.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.error('[PushService] Error creating data directory:', e);
  }
}

class PushService {
  private vapidKeys: { publicKey: string; privateKey: string };
  private subscriptions: StoredSubscription[] = [];
  private scheduledReminders: ScheduledReminder[] = [];
  private schedulerInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.vapidKeys = this.loadOrGenerateVapidKeys();
    this.initWebPush();
    this.loadSubscriptions();
    this.loadReminders();
    this.startScheduler();
  }

  private loadOrGenerateVapidKeys(): { publicKey: string; privateKey: string } {
    try {
      if (fs.existsSync(VAPID_FILE)) {
        const data = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf-8'));
        if (data.publicKey && data.privateKey) {
          console.log('[PushService] Loaded existing VAPID keys.');
          return data;
        }
      }
    } catch (e) {
      console.warn('[PushService] Failed to read VAPID keys file, generating new keys:', e);
    }

    const keys = webpush.generateVAPIDKeys();
    try {
      fs.writeFileSync(VAPID_FILE, JSON.stringify(keys, null, 2), 'utf-8');
      console.log('[PushService] Generated and persisted new VAPID keys.');
    } catch (e) {
      console.error('[PushService] Failed to save VAPID keys to disk:', e);
    }
    return keys;
  }

  private initWebPush() {
    try {
      webpush.setVapidDetails(
        'mailto:diegolecarosu@gmail.com',
        this.vapidKeys.publicKey,
        this.vapidKeys.privateKey
      );
      console.log('[PushService] VAPID details configured successfully.');
    } catch (err) {
      console.error('[PushService] Error setting VAPID details:', err);
    }
  }

  public getPublicKey(): string {
    return this.vapidKeys.publicKey;
  }

  private loadSubscriptions() {
    try {
      if (fs.existsSync(SUBSCRIPTIONS_FILE)) {
        this.subscriptions = JSON.parse(fs.readFileSync(SUBSCRIPTIONS_FILE, 'utf-8'));
        console.log(`[PushService] Loaded ${this.subscriptions.length} push subscriptions.`);
      }
    } catch (e) {
      console.warn('[PushService] Error reading subscriptions file:', e);
      this.subscriptions = [];
    }
  }

  private saveSubscriptions() {
    try {
      fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(this.subscriptions, null, 2), 'utf-8');
    } catch (e) {
      console.error('[PushService] Error saving subscriptions file:', e);
    }
  }

  private loadReminders() {
    try {
      if (fs.existsSync(REMINDERS_FILE)) {
        this.scheduledReminders = JSON.parse(fs.readFileSync(REMINDERS_FILE, 'utf-8'));
        console.log(`[PushService] Loaded ${this.scheduledReminders.length} scheduled reminders.`);
      }
    } catch (e) {
      console.warn('[PushService] Error reading reminders file:', e);
      this.scheduledReminders = [];
    }
  }

  private saveReminders() {
    try {
      fs.writeFileSync(REMINDERS_FILE, JSON.stringify(this.scheduledReminders, null, 2), 'utf-8');
    } catch (e) {
      console.error('[PushService] Error saving reminders file:', e);
    }
  }

  public saveSubscription(sub: PushSubscription, userId: string = 'usr-diego-default', userAgent?: string): StoredSubscription {
    const endpoint = sub.endpoint;
    const existingIdx = this.subscriptions.findIndex((s) => s.subscription.endpoint === endpoint);

    const now = new Date().toISOString();
    if (existingIdx >= 0) {
      this.subscriptions[existingIdx].updatedAt = now;
      this.subscriptions[existingIdx].userId = userId;
      if (userAgent) this.subscriptions[existingIdx].userAgent = userAgent;
      this.saveSubscriptions();
      console.log(`[PushService] Updated subscription for endpoint: ${endpoint.substring(0, 45)}...`);
      return this.subscriptions[existingIdx];
    }

    const newSub: StoredSubscription = {
      id: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      userId,
      subscription: sub,
      userAgent,
      createdAt: now,
      updatedAt: now,
    };

    this.subscriptions.push(newSub);
    this.saveSubscriptions();
    console.log(`[PushService] Saved new push subscription for user ${userId}. Total: ${this.subscriptions.length}`);
    return newSub;
  }

  public removeSubscriptionByEndpoint(endpoint: string): boolean {
    const initialLen = this.subscriptions.length;
    this.subscriptions = this.subscriptions.filter((s) => s.subscription.endpoint !== endpoint);
    if (this.subscriptions.length !== initialLen) {
      this.saveSubscriptions();
      console.log(`[PushService] Removed dead or unsubscribed endpoint.`);
      return true;
    }
    return false;
  }

  public getSubscriptions(userId?: string): StoredSubscription[] {
    if (userId) {
      return this.subscriptions.filter((s) => s.userId === userId);
    }
    return this.subscriptions;
  }

  public scheduleReminder(reminder: {
    id: string;
    userId?: string;
    title: string;
    body?: string;
    scheduledTime: string;
  }): ScheduledReminder {
    const existingIdx = this.scheduledReminders.findIndex((r) => r.id === reminder.id);
    const now = new Date().toISOString();

    const item: ScheduledReminder = {
      id: reminder.id,
      userId: reminder.userId || 'usr-diego-default',
      title: reminder.title,
      body: reminder.body || 'Es hora de atender este recordatorio programado.',
      scheduledTime: reminder.scheduledTime,
      status: 'scheduled',
      attempts: 0,
      createdAt: now,
    };

    if (existingIdx >= 0) {
      this.scheduledReminders[existingIdx] = item;
    } else {
      this.scheduledReminders.push(item);
    }

    this.saveReminders();
    console.log(`[PushService] Scheduled reminder "${item.title}" for ${item.scheduledTime} (ID: ${item.id})`);
    return item;
  }

  public cancelReminder(reminderId: string): boolean {
    const item = this.scheduledReminders.find((r) => r.id === reminderId);
    if (item && item.status === 'scheduled') {
      item.status = 'cancelled';
      this.saveReminders();
      console.log(`[PushService] Cancelled scheduled reminder: ${reminderId}`);
      return true;
    }
    return false;
  }

  public async sendPushToAll(payload: {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    tag?: string;
    data?: any;
  }, userId?: string): Promise<{ successCount: number; failureCount: number; errors: string[] }> {
    const targets = this.getSubscriptions(userId);
    console.log(`[PushService] Sending Push to ${targets.length} subscriber(s)...`);

    if (targets.length === 0) {
      console.warn('[PushService] No active push subscriptions found to dispatch to.');
      return { successCount: 0, failureCount: 0, errors: ['No active push subscriptions registered'] };
    }

    const payloadString = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/pwa-192x192.png',
      badge: payload.badge || '/pwa-192x192.png',
      tag: payload.tag || `rem-${Date.now()}`,
      data: payload.data || { url: '/' },
      actions: [
        { action: 'open', title: 'Ver recordatorio' },
      ],
    });

    let successCount = 0;
    let failureCount = 0;
    const errors: string[] = [];

    for (const subItem of targets) {
      try {
        const response = await webpush.sendNotification(subItem.subscription, payloadString, {
          TTL: 60 * 60 * 24, // 24 hours
          urgency: 'high',
        });
        successCount++;
        console.log(`[PushService] Push delivered successfully to endpoint: ${subItem.subscription.endpoint.substring(0, 45)}... (Status: ${response.statusCode})`);
      } catch (err: any) {
        failureCount++;
        const statusCode = err.statusCode || err.code;
        const msg = `Endpoint failed with status ${statusCode}: ${err.message}`;
        errors.push(msg);
        console.error(`[PushService] Failed sending to endpoint:`, msg);

        // 410 Gone or 404 Not Found indicates expired or revoked subscription
        if (statusCode === 410 || statusCode === 404) {
          console.log(`[PushService] Subscription expired/unregistered (HTTP ${statusCode}). Removing endpoint...`);
          this.removeSubscriptionByEndpoint(subItem.subscription.endpoint);
        }
      }
    }

    return { successCount, failureCount, errors };
  }

  private startScheduler() {
    if (this.schedulerInterval) return;

    console.log('[PushService] Background Push Scheduler started (interval: 5s).');
    this.schedulerInterval = setInterval(async () => {
      await this.checkAndTriggerDueReminders();
    }, 5000);
  }

  private async checkAndTriggerDueReminders() {
    const now = Date.now();
    const pending = this.scheduledReminders.filter((r) => r.status === 'scheduled');

    for (const reminder of pending) {
      const targetTime = new Date(reminder.scheduledTime).getTime();
      if (!isNaN(targetTime) && targetTime <= now) {
        console.log(`[PushService] ⏰ REMINDER DUE: "${reminder.title}" scheduled for ${reminder.scheduledTime}`);
        reminder.status = 'sent';
        reminder.lastAttemptAt = new Date().toISOString();
        reminder.attempts += 1;

        try {
          const result = await this.sendPushToAll(
            {
              title: reminder.title,
              body: reminder.body,
              tag: `rem-${reminder.id}`,
              data: {
                reminderId: reminder.id,
                scheduledTime: reminder.scheduledTime,
                url: '/',
              },
            },
            reminder.userId
          );

          if (result.failureCount > 0 && result.successCount === 0) {
            reminder.status = 'failed';
            reminder.error = result.errors.join('; ');
          }
        } catch (err: any) {
          reminder.status = 'failed';
          reminder.error = err?.message || 'Error sending push';
          console.error(`[PushService] Error dispatching reminder push for ${reminder.id}:`, err);
        }

        this.saveReminders();
      }
    }
  }

  public getStatus() {
    return {
      vapidPublicKeyConfigured: !!this.vapidKeys.publicKey,
      vapidPublicKey: this.vapidKeys.publicKey,
      totalSubscriptions: this.subscriptions.length,
      subscriptions: this.subscriptions.map((s) => ({
        id: s.id,
        userId: s.userId,
        userAgent: s.userAgent,
        createdAt: s.createdAt,
        endpointPrefix: s.subscription.endpoint.substring(0, 50) + '...',
      })),
      totalScheduledReminders: this.scheduledReminders.length,
      pendingReminders: this.scheduledReminders.filter((r) => r.status === 'scheduled').length,
      reminders: this.scheduledReminders.slice(-10), // Last 10
    };
  }
}

export const pushService = new PushService();
