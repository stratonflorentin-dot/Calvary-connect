'use client';

/**
 * Calvary Connect — usePaginatedCollection
 *
 * Cursor-based pagination hook for Firestore collections.
 * Avoids full-collection reads by using .startAfter() cursors.
 *
 * Usage:
 *   const { items, loadMore, hasMore, loading } = usePaginatedCollection(
 *     query(collection(db, 'trips'), where('status', '==', 'in_transit'), orderBy('createdAt', 'desc')),
 *     { pageSize: 25 }
 *   );
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Query,
  DocumentData,
  QueryDocumentSnapshot,
  getDocs,
  limit,
  startAfter,
  query as firestoreQuery,
} from 'firebase/firestore';

interface UsePaginatedCollectionOptions {
  /** Number of items per page (default: 25) */
  pageSize?: number;
  /** Whether to auto-load the first page (default: true) */
  autoLoad?: boolean;
}

interface UsePaginatedCollectionResult<T> {
  items: T[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: Error | null;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  totalLoaded: number;
}

export function usePaginatedCollection<T = DocumentData>(
  baseQuery: Query<DocumentData>,
  options: UsePaginatedCollectionOptions = {}
): UsePaginatedCollectionResult<T> {
  const { pageSize = 25, autoLoad = true } = options;

  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const lastDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const isMounted = useRef(true);

  const fetchPage = useCallback(
    async (cursor: QueryDocumentSnapshot<DocumentData> | null, append: boolean) => {
      try {
        let q = firestoreQuery(baseQuery, limit(pageSize));
        if (cursor) {
          q = firestoreQuery(baseQuery, startAfter(cursor), limit(pageSize));
        }

        const snapshot = await getDocs(q);
        if (!isMounted.current) return;

        const newItems = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as T[];

        lastDocRef.current = snapshot.docs[snapshot.docs.length - 1] ?? null;
        setHasMore(snapshot.docs.length === pageSize);

        setItems((prev) => (append ? [...prev, ...newItems] : newItems));
        setError(null);
      } catch (err) {
        if (!isMounted.current) return;
        console.error('[usePaginatedCollection] Fetch error:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch'));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pageSize]
  );

  const loadFirst = useCallback(async () => {
    setLoading(true);
    lastDocRef.current = null;
    await fetchPage(null, false);
    setLoading(false);
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || loading) return;
    setLoadingMore(true);
    await fetchPage(lastDocRef.current, true);
    setLoadingMore(false);
  }, [hasMore, loadingMore, loading, fetchPage]);

  const refresh = useCallback(async () => {
    await loadFirst();
  }, [loadFirst]);

  useEffect(() => {
    isMounted.current = true;
    if (autoLoad) loadFirst();
    return () => {
      isMounted.current = false;
    };
  }, [autoLoad, loadFirst]);

  return {
    items,
    loading,
    loadingMore,
    hasMore,
    error,
    loadMore,
    refresh,
    totalLoaded: items.length,
  };
}
