import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

// --- Types ---

export type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

export interface RealtimeMessage<T = Record<string, unknown>> {
  event: RealtimeEvent;
  schema: string;
  table: string;
  new: T;
  old: Partial<T>;
}

export type RealtimeCallback<T = Record<string, unknown>> = (
  payload: RealtimeMessage<T>
) => void;

export interface PresenceState {
  userId: string;
  location?: { lat: number; lng: number };
  updatedAt: string;
  [key: string]: unknown;
}

export type PresenceCallback = (state: Record<string, PresenceState[]>) => void;

// --- RealtimeProvider Interface ---

export interface RealtimeProvider {
  subscribeToTable<T = Record<string, unknown>>(
    table: string,
    event: RealtimeEvent,
    filter: string | undefined,
    callback: RealtimeCallback<T>
  ): string;

  subscribeToBroadcast(
    channelName: string,
    event: string,
    callback: (payload: Record<string, unknown>) => void
  ): string;

  subscribeToPresence(
    channelName: string,
    onSync: PresenceCallback
  ): string;

  trackPresence(
    channelName: string,
    state: PresenceState
  ): Promise<void>;

  publish(
    channelName: string,
    event: string,
    payload: Record<string, unknown>
  ): Promise<void>;

  unsubscribe(subscriptionId: string): void;

  unsubscribeAll(): void;
}

// --- Supabase Realtime Implementation ---

export class SupabaseRealtimeProvider implements RealtimeProvider {
  private channels: Map<string, RealtimeChannel> = new Map();
  private subscriptionCounter = 0;

  private generateId(prefix: string): string {
    this.subscriptionCounter++;
    return `${prefix}_${this.subscriptionCounter}_${Date.now()}`;
  }

  subscribeToTable<T = Record<string, unknown>>(
    table: string,
    event: RealtimeEvent,
    filter: string | undefined,
    callback: RealtimeCallback<T>
  ): string {
    const id = this.generateId(`table_${table}`);

    const channelConfig: Record<string, string> = {};
    if (filter) {
      channelConfig.filter = filter;
    }

    const channel = supabase
      .channel(id)
      .on<T>(
        'postgres_changes' as never,
        {
          event,
          schema: 'public',
          table,
          ...channelConfig,
        },
        (payload) => {
          callback(payload as unknown as RealtimeMessage<T>);
        }
      )
      .subscribe();

    this.channels.set(id, channel);
    return id;
  }

  subscribeToBroadcast(
    channelName: string,
    event: string,
    callback: (payload: Record<string, unknown>) => void
  ): string {
    const id = this.generateId(`broadcast_${channelName}`);

    // Reuse existing channel for the same channelName if possible
    const existingChannel = this.channels.get(channelName);
    if (existingChannel) {
      existingChannel.on('broadcast', { event }, (payload) => {
        callback(payload.payload as Record<string, unknown>);
      });
      this.channels.set(id, existingChannel);
      return id;
    }

    const channel = supabase
      .channel(channelName)
      .on('broadcast', { event }, (payload) => {
        callback(payload.payload as Record<string, unknown>);
      })
      .subscribe();

    this.channels.set(id, channel);
    this.channels.set(channelName, channel);
    return id;
  }

  subscribeToPresence(
    channelName: string,
    onSync: PresenceCallback
  ): string {
    const id = this.generateId(`presence_${channelName}`);

    const channel = supabase
      .channel(channelName)
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceState>();
        onSync(state as Record<string, PresenceState[]>);
      })
      .subscribe();

    this.channels.set(id, channel);
    return id;
  }

  async trackPresence(
    channelName: string,
    state: PresenceState
  ): Promise<void> {
    // Find existing channel for this name
    const channel = this.channels.get(channelName);
    if (channel) {
      await channel.track(state);
      return;
    }

    // Create new channel and track
    const newChannel = supabase.channel(channelName).subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await newChannel.track(state);
      }
    });

    this.channels.set(channelName, newChannel);
  }

  async publish(
    channelName: string,
    event: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    let channel = this.channels.get(channelName);

    if (!channel) {
      channel = supabase.channel(channelName).subscribe();
      this.channels.set(channelName, channel);
      // Wait briefly for subscription to establish
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    await channel.send({
      type: 'broadcast',
      event,
      payload,
    });
  }

  unsubscribe(subscriptionId: string): void {
    const channel = this.channels.get(subscriptionId);
    if (channel) {
      supabase.removeChannel(channel);
      this.channels.delete(subscriptionId);
    }
  }

  unsubscribeAll(): void {
    for (const [id, channel] of this.channels) {
      supabase.removeChannel(channel);
      this.channels.delete(id);
    }
  }
}

// Singleton instance
export const realtime: RealtimeProvider = new SupabaseRealtimeProvider();
