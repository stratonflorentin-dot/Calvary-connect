"use client";

import { supabase } from './supabase';
import { toast } from '@/hooks/use-toast';

export interface PendingRequest {
  id: string;
  userId?: string;
  table: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  data: any;
  timestamp: number;
}

class OfflineSyncManager {
  private static PENDING_KEY = 'fleet_pending_sync';

  static isOnline(): boolean {
    return typeof window !== 'undefined' && navigator.onLine;
  }

  static async queueRequest(table: string, action: 'INSERT' | 'UPDATE' | 'DELETE', data: any, force = false, notify = true) {
    if (this.isOnline() && !force) {
      return null; // Should have been handled by direct call
    }

    const pending = this.getPending();
    const { data: { session } } = await supabase.auth.getSession();
    const newRequest: PendingRequest = {
      id: typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      userId: session?.user.id,
      table,
      action,
      data,
      timestamp: Date.now()
    };

    pending.push(newRequest);
    localStorage.setItem(this.PENDING_KEY, JSON.stringify(pending));
    
    if (notify) {
      toast({
        title: "Working Offline",
        description: "Changes saved locally and will sync when you're back online.",
      });
    }

    return newRequest;
  }

  static getPending(): PendingRequest[] {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem(this.PENDING_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  static async sync() {
    if (!this.isOnline()) return;

    const pending = this.getPending();
    if (pending.length === 0) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user.id) return;

    console.log(`[OfflineSync] Syncing ${pending.length} pending requests...`);
    
    const remaining: PendingRequest[] = [];

    for (const request of pending) {
      if (request.userId && request.userId !== session.user.id) {
        remaining.push(request);
        continue;
      }
      try {
        let error;
        if (request.action === 'INSERT') {
          // Offline creates carry a client-generated primary key so retrying
          // after a lost response does not create duplicate business records.
          ({ error } = await supabase.from(request.table).upsert(request.data, {
            onConflict: 'id',
            ignoreDuplicates: true,
          }));
        } else if (request.action === 'UPDATE') {
          ({ error } = await supabase.from(request.table).update(request.data).eq('id', request.data.id));
        } else if (request.action === 'DELETE') {
          ({ error } = await supabase.from(request.table).delete().eq('id', request.data.id));
        }

        if (error) throw error;
      } catch (err) {
        console.error(`[OfflineSync] Failed to sync request ${request.id}:`, err);
        remaining.push(request);
      }
    }

    localStorage.setItem(this.PENDING_KEY, JSON.stringify(remaining));
    window.dispatchEvent(new CustomEvent('fleet:offline-sync-complete', {
      detail: { remaining: remaining.length },
    }));

    if (remaining.length === 0) {
      toast({
        title: "Sync Complete",
        description: "All offline changes have been synchronized.",
      });
    } else {
      toast({
        title: "Sync Partial",
        description: `${remaining.length} changes failed to sync. Will retry later.`,
        variant: "destructive"
      });
    }
  }

  static init() {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.sync();
    });

    // Try sync on init if online
    if (this.isOnline()) {
      this.sync();
    }
  }
}

export const SyncManager = OfflineSyncManager;
