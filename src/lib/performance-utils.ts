// Performance optimizations for handling many users
// Add this to your React components for better performance

import { useState, useEffect } from 'react';
import { supabase } from './supabase';

// 1. Debounce function to prevent excessive API calls
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// 2. Throttle function for rate limiting
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// 3. Memoized data fetching with caching
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function fetchWithCache<T>(
  key: string,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  
  const data = await fetcher();
  cache.set(key, { data, timestamp: Date.now() });
  return data;
}

// 4. Virtual scrolling helper for large lists
export function useVirtualList<T>(items: T[], itemHeight: number, containerHeight: number) {
  const [scrollTop, setScrollTop] = useState(0);
  
  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(
    startIndex + Math.ceil(containerHeight / itemHeight) + 1,
    items.length
  );
  
  const visibleItems = items.slice(startIndex, endIndex);
  const totalHeight = items.length * itemHeight;
  const offsetY = startIndex * itemHeight;
  
  return {
    visibleItems,
    totalHeight,
    offsetY,
    startIndex,
    onScroll: (e: React.UIEvent<HTMLDivElement>) => setScrollTop(e.currentTarget.scrollTop),
  };
}

// 5. Optimized Supabase queries with pagination
export const optimizedQueries = {
  // Fetch vehicles with pagination for large datasets
  async getVehiclesPaginated(page: number = 1, pageSize: number = 50) {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    
    const { data, error, count } = await supabase
      .from('vehicles')
      .select('*', { count: 'exact' })
      .range(from, to)
      .order('created_at', { ascending: false });
    
    return { data, error, count, page, pageSize };
  },
  
  // Fetch only required fields for lists (reduces data transfer)
  async getVehiclesListMinimal() {
    const { data, error } = await supabase
      .from('vehicles')
      .select('id, plate_number, make, model, status, type')
      .order('plate_number');
    
    return { data, error };
  },
  
  // Batch fetch for better performance
  async getVehiclesBatch(ids: string[]) {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .in('id', ids);
    
    return { data, error };
  }
};

// 6. Connection pooling configuration
export const supabaseConfig = {
  // Increase connection timeout for slow networks
  db: {
    schema: 'public',
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    headers: {
      'x-application-name': 'fleet-management',
    },
  },
};

// 7. Error handling with retry logic
export async function fetchWithRetry<T>(
  fetcher: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: any;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetcher();
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
  }
  
  throw lastError;
}

// 8. Memory cleanup helper
export function useMemoryCleanup() {
  useEffect(() => {
    return () => {
      // Clear cache on unmount
      cache.clear();
    };
  }, []);
}

// 9. Optimistic updates for better UX
export function useOptimisticUpdate<T>(initialData: T[]) {
  const [data, setData] = useState<T[]>(initialData);
  const [pending, setPending] = useState<T[]>([]);
  
  const optimisticAdd = (item: T) => {
    setData(prev => [...prev, item]);
    setPending(prev => [...prev, item]);
  };
  
  const confirmUpdate = (item: T) => {
    setPending(prev => prev.filter(p => p !== item));
  };
  
  const rollback = (item: T) => {
    setData(prev => prev.filter(d => d !== item));
    setPending(prev => prev.filter(p => p !== item));
  };
  
  return { data, optimisticAdd, confirmUpdate, rollback };
}

// 10. Load balancing helper
export function useLoadBalancing(maxConcurrent: number = 5) {
  const [queue, setQueue] = useState<(() => Promise<any>)[]>([]);
  const [running, setRunning] = useState(0);
  
  useEffect(() => {
    if (queue.length > 0 && running < maxConcurrent) {
      const task = queue[0];
      setQueue(prev => prev.slice(1));
      setRunning(prev => prev + 1);
      
      task().finally(() => {
        setRunning(prev => prev - 1);
      });
    }
  }, [queue, running, maxConcurrent]);
  
  const addTask = (task: () => Promise<any>) => {
    setQueue(prev => [...prev, task]);
  };
  
  return { addTask, queueLength: queue.length, runningTasks: running };
}
