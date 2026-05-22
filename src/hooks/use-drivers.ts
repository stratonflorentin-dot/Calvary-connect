import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { UserProfile } from '@/types/roles';

export function useDrivers() {
  const [drivers, setDrivers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDrivers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .ilike('role', 'driver')
        .order('first_name', { ascending: true });
      if (error) throw error;
      setDrivers(data as UserProfile[]);
    } catch (e: any) {
      setError(e.message || 'Failed to load drivers');
      setDrivers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  return { drivers, loading, error, refresh: fetchDrivers };
}
