'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { RealtimeChannel } from '@supabase/supabase-js';

interface MaintenanceRecord {
    id: string;
    record_number: string;
    vehicle_id: string | null;
    trip_id: string | null;
    title: string;
    description: string | null;
    type: string;
    priority: string;
    status: string;
    scheduled_date: string | null;
    completed_date: string | null;
    technician: string | null;
    workshop: string | null;
    estimated_cost: number | null;
    actual_cost: number | null;
    currency: string;
    notes: string | null;
    requested_by: string | null;
    approved_by: string | null;
    created_at: string;
    updated_at: string;
    vehicles?: {
        id: string;
        plate_number: string;
        make: string;
        model: string;
    };
}

interface UseMaintenance {
    records: MaintenanceRecord[];
    loading: boolean;
    error: Error | null;
    stats: {
        total: number;
        requested: number;
        scheduled: number;
        in_progress: number;
        completed: number;
        postponed: number;
        cancelled: number;
        overdue: number;
        totalCompletedCost: number;
    };
    refetch: () => Promise<void>;
}

export function useMaintenance(filters?: {
    status?: string;
    priority?: string;
    vehicle_id?: string;
    type?: string;
    search?: string;
    sort?: 'created_at' | 'scheduled_date' | 'priority';
}): UseMaintenance {
    const [records, setRecords] = useState<MaintenanceRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const supabase = createClientComponentClient();
    let channel: RealtimeChannel | null = null;

    const fetchRecords = async () => {
        try {
            setLoading(true);
            setError(null);

            let query = supabase
                .from('maintenance_records')
                .select(`
          *,
          vehicles:vehicle_id(id, plate_number, make, model)
        `)
                .order(filters?.sort || 'created_at', { ascending: false });

            if (filters?.status) {
                query = query.eq('status', filters.status);
            }
            if (filters?.priority) {
                query = query.eq('priority', filters.priority);
            }
            if (filters?.vehicle_id) {
                query = query.eq('vehicle_id', filters.vehicle_id);
            }
            if (filters?.type) {
                query = query.eq('type', filters.type);
            }
            if (filters?.search) {
                query = query.or(`record_number.ilike.%${filters.search}%,title.ilike.%${filters.search}%,technician.ilike.%${filters.search}%`);
            }

            const { data, error: fetchError } = await query;

            if (fetchError) throw fetchError;
            setRecords(data || []);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to fetch maintenance records'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRecords();

        // Subscribe to realtime updates
        channel = supabase
            .channel('maintenance-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'maintenance_records' },
                () => {
                    fetchRecords();
                }
            )
            .subscribe();

        return () => {
            if (channel) {
                supabase.removeChannel(channel);
            }
        };
    }, [filters?.status, filters?.priority, filters?.vehicle_id, filters?.type, filters?.search]);

    // Calculate stats
    const stats = {
        total: records.length,
        requested: records.filter(r => r.status === 'requested').length,
        scheduled: records.filter(r => r.status === 'scheduled').length,
        in_progress: records.filter(r => r.status === 'in_progress').length,
        completed: records.filter(r => r.status === 'completed').length,
        postponed: records.filter(r => r.status === 'postponed').length,
        cancelled: records.filter(r => r.status === 'cancelled').length,
        overdue: records.filter(r => {
            if (r.status === 'completed' || r.status === 'cancelled') return false;
            return r.scheduled_date && new Date(r.scheduled_date) < new Date();
        }).length,
        totalCompletedCost: records
            .filter(r => r.status === 'completed' && r.actual_cost)
            .reduce((sum, r) => sum + (r.actual_cost || 0), 0),
    };

    return {
        records,
        loading,
        error,
        stats,
        refetch: fetchRecords,
    };
}
