import { useState, useEffect, useCallback, useMemo } from 'react';
import { onSnapshot, doc, collection, query, where, orderBy, limit, QueryConstraint, Unsubscribe } from '@/lib/db';
import { db } from '../firebase';

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  pendingChanges: number;
  error: string | null;
}

export const useOfflineSync = () => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isSyncing: false,
    lastSyncTime: null,
    pendingChanges: 0,
    error: null,
  });

  // Monitor online/offline status
  useEffect(() => {
    // Safety check for browser environment
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setSyncStatus(prev => ({ ...prev, isOnline: true, error: null }));
    };

    const handleOffline = () => {
      setSyncStatus(prev => ({ ...prev, isOnline: false }));
    };

    try {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    } catch (error) {
      console.warn('Failed to add online/offline event listeners:', error);
    }

    return () => {
      try {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      } catch (error) {
        console.warn('Failed to remove online/offline event listeners:', error);
      }
    };
  }, []);

  const updateSyncStatus = useCallback((updates: Partial<SyncStatus>) => {
    setSyncStatus(prev => ({ ...prev, ...updates }));
  }, []);

  return {
    syncStatus,
    updateSyncStatus,
  };
};

// Hook for real-time data with offline support
export const useOfflineQuery = <T>(
  queryKey: string[],
  queryFn: () => Promise<T>,
  realtimeQuery?: {
    collection: string;
    constraints?: QueryConstraint[];
    transform?: (data: any) => T;
  },
  options: {
    enabled?: boolean;
    staleTime?: number;
    refetchOnWindowFocus?: boolean;
  } = { enabled: true }
) => {
  const [data, setData] = useState<T | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const { syncStatus, updateSyncStatus } = useOfflineSync();

  // Memoize options to prevent unnecessary re-renders
  const stableOptions = useMemo(() => ({
    enabled: options.enabled ?? true,
    staleTime: options.staleTime ?? 300000,
    refetchOnWindowFocus: options.refetchOnWindowFocus ?? false
  }), [options.enabled, options.staleTime, options.refetchOnWindowFocus]);

  // Memoize the query key to prevent unnecessary re-renders
  const stableQueryKey = useMemo(() => queryKey.join(','), [queryKey.join(',')]);

  // Initial data fetch
  useEffect(() => {
    if (!stableOptions.enabled) return;

    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const result = await queryFn();
        setData(result);
        setLastSync(new Date());
        updateSyncStatus({ lastSyncTime: new Date(), error: null });
      } catch (err) {
        const error = err as Error;
        setError(error);
        updateSyncStatus({ error: error.message });
        console.error('Query failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [stableQueryKey, stableOptions.enabled]);

  // Real-time subscription with offline support
  useEffect(() => {
    if (!realtimeQuery || !stableOptions.enabled) return;

    let unsubscribe: Unsubscribe | null = null;

    const setupRealtimeSync = () => {
      try {
        const q = query(
          collection(db, realtimeQuery.collection),
          ...(realtimeQuery.constraints || [])
        );

        unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            try {
              const newData = realtimeQuery.transform 
                ? realtimeQuery.transform(snapshot)
                : snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as T;
              
              setData(newData);
              setLastSync(new Date());
              updateSyncStatus({ 
                lastSyncTime: new Date(), 
                error: null,
                isSyncing: false 
              });
            } catch (err) {
              const error = err as Error;
              setError(error);
              updateSyncStatus({ error: error.message });
            }
          },
          (err) => {
            const error = err as Error;
            setError(error);
            updateSyncStatus({ error: error.message });
            console.error('Realtime query failed:', error);
          }
        );
      } catch (err) {
        const error = err as Error;
        setError(error);
        updateSyncStatus({ error: error.message });
      }
    };

    if (navigator.onLine) {
      setupRealtimeSync();
    }

    // Retry when back online
    const handleOnline = () => {
      setIsOffline(false);
      updateSyncStatus({ isOnline: true, error: null });
      if (realtimeQuery) {
        setupRealtimeSync();
      }
    };

    const handleOffline = () => {
      setIsOffline(true);
      updateSyncStatus({ isOnline: false });
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    };

    // Safety check for browser environment
    if (typeof window !== 'undefined') {
      try {
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
      } catch (error) {
        console.warn('Failed to add online/offline event listeners:', error);
      }
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      if (typeof window !== 'undefined') {
        try {
          window.removeEventListener('online', handleOnline);
          window.removeEventListener('offline', handleOffline);
        } catch (error) {
          console.warn('Failed to remove online/offline event listeners:', error);
        }
      }
    };
  }, [realtimeQuery, stableOptions.enabled]);

  const refetch = useCallback(async () => {
    if (!stableOptions.enabled) return;
    
    try {
      updateSyncStatus({ isSyncing: true });
      const result = await queryFn();
      setData(result);
      setLastSync(new Date());
      updateSyncStatus({ 
        lastSyncTime: new Date(), 
        error: null,
        isSyncing: false 
      });
    } catch (err) {
      const error = err as Error;
      setError(error);
      updateSyncStatus({ error: error.message, isSyncing: false });
    }
  }, [queryFn, stableOptions.enabled]);

  return {
    data,
    isLoading,
    error,
    isOffline,
    lastSync,
    refetch,
    syncStatus,
  };
};

// Hook for offline-aware mutations
export const useOfflineMutation = <TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: {
    onSuccess?: (data: TData) => void;
    onError?: (error: Error) => void;
    retryOnReconnect?: boolean;
  } = {}
) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [pendingMutations, setPendingMutations] = useState<TVariables[]>([]);
  const { syncStatus } = useOfflineSync();

  const mutate = useCallback(async (variables: TVariables) => {
    // Safety check for browser environment
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    
    if (!isOnline) {
      // Queue mutation for when back online
      setPendingMutations(prev => [...prev, variables]);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const result = await mutationFn(variables);
      options.onSuccess?.(result);
      return result;
    } catch (err) {
      const error = err as Error;
      setError(error);
      options.onError?.(error);
      
      if (options.retryOnReconnect) {
        setPendingMutations(prev => [...prev, variables]);
      }
      
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [mutationFn, options]);

  // Process pending mutations when back online
  useEffect(() => {
    if (syncStatus.isOnline && pendingMutations.length > 0) {
      const processPendingMutations = async () => {
        const mutations = [...pendingMutations];
        setPendingMutations([]);
        
        for (const variables of mutations) {
          try {
            await mutationFn(variables);
          } catch (err) {
            console.error('Failed to process pending mutation:', err);
            // Re-queue failed mutations
            setPendingMutations(prev => [...prev, variables]);
          }
        }
      };
      
      processPendingMutations();
    }
  }, [syncStatus.isOnline, pendingMutations, mutationFn]);

  return {
    mutate,
    isLoading,
    error,
    pendingMutations: pendingMutations.length,
  };
};
