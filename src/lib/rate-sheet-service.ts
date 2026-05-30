// Rate Sheet Management - Database queries and types

import { supabase } from './supabase';

export interface RateSheetRoute {
    id?: string;
    route_name: string;
    origin: string;
    destination: string;
    container_20ft: number;
    container_40ft: number;
    loose_cargo: number;
    truck_type: string;
    transit_days: number;
    currency: string;
    is_active: boolean;
    created_at?: string;
    updated_at?: string;
}

/**
 * Fetch all active rate sheet routes
 */
export async function fetchRateSheets() {
    try {
        const { data, error } = await supabase
            .from('rate_sheets')
            .select('*')
            .eq('is_active', true)
            .order('route_name', { ascending: true });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching rate sheets:', error);
        return [];
    }
}

/**
 * Create or update a rate sheet entry
 */
export async function upsertRateSheet(route: RateSheetRoute) {
    try {
        const { data, error } = await supabase
            .from('rate_sheets')
            .upsert({
                ...route,
                updated_at: new Date().toISOString()
            }, { onConflict: 'id' })
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error upserting rate sheet:', error);
        throw error;
    }
}

/**
 * Delete a rate sheet entry (soft delete via is_active)
 */
export async function deleteRateSheet(id: string) {
    try {
        const { data, error } = await supabase
            .from('rate_sheets')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error deleting rate sheet:', error);
        throw error;
    }
}

/**
 * Get formatted rate sheet for contracts
 */
export async function getFormattedRateSheet() {
    try {
        const routes = await fetchRateSheets();
        const formatted: Record<string, any> = {};

        routes.forEach((route) => {
            const key = route.route_name;
            formatted[key] = {
                '20FT': `$${route.container_20ft.toLocaleString()}`,
                '40FT': `$${route.container_40ft.toLocaleString()}`,
                'LOOSE': `$${route.loose_cargo.toLocaleString()}`,
                'TYPE': route.truck_type,
                'DAYS': route.transit_days
            };
        });

        return formatted;
    } catch (error) {
        console.error('Error formatting rate sheet:', error);
        return {};
    }
}

/**
 * Get a specific route's details
 */
export async function getRateByRoute(routeName: string) {
    try {
        const { data, error } = await supabase
            .from('rate_sheets')
            .select('*')
            .eq('route_name', routeName)
            .eq('is_active', true)
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error fetching rate by route:', error);
        return null;
    }
}
