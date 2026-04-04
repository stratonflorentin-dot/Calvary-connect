"use client";

import { supabase } from './supabase';
import { toast } from '@/hooks/use-toast';

interface PendingRequest {
  id: string;
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

  static async queueRequest(table: string, action: 'INSERT' | 'UPDATE' | 'DELETE', data: any) {
    if (this.isOnline()) {
      return null; // Should have been handled by direct call
    }

    const pending = this.getPending();
    const newRequest: PendingRequest = {
      id: crypto.randomUUID(),
      table,
      action,
      data,
      timestamp: Date.now()
    };

    pending.push(newRequest);
    localStorage.setItem(this.PENDING_KEY, JSON.stringify(pending));
    
    toast({
      title: "Working Offline",
      description: "Changes saved locally and will sync when you're back online.",
    });

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

    console.log(`[OfflineSync] Syncing ${pending.length} pending requests...`);
    
    const remaining: PendingRequest[] = [];

    for (const request of pending) {
      try {
        let error;
        if (request.action === 'INSERT') {
          ({ error } = await supabase.from(request.table).insert(request.data));
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
