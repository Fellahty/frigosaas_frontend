import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOfflineQuery, useOfflineMutation } from '../lib/hooks/useOfflineSync';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, deleteDoc } from '@/lib/db';
import { db } from '../lib/firebase';
import { useTenantId } from '../lib/hooks/useTenantId';

// Example: Migrating a clients page to use offline features

// ❌ OLD WAY - Standard React Query (no offline support)
export const OldClientsPage: React.FC = () => {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();

  // Standard query - fails when offline
  const { data: clients, isLoading, error } = useQuery({
    queryKey: ['clients', tenantId],
    queryFn: async () => {
      const q = query(collection(db, 'tenants', tenantId, 'clients'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    enabled: !!tenantId,
  });

  // Standard mutation - fails when offline
  const addClientMutation = useMutation({
    mutationFn: async (clientData: any) => {
      const docRef = await addDoc(collection(db, 'tenants', tenantId, 'clients'), clientData);
      return { id: docRef.id, ...clientData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients', tenantId] });
    },
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h1>Clients (Old Way)</h1>
      <button onClick={() => addClientMutation.mutate({ name: 'New Client' })}>
        Add Client
      </button>
      <ul>
        {clients?.map(client => (
          <li key={client.id}>{client.name}</li>
        ))}
      </ul>
    </div>
  );
};

// ✅ NEW WAY - Offline-aware implementation
export const NewClientsPage: React.FC = () => {
  const tenantId = useTenantId();

  // Offline-aware query with real-time updates
  const { 
    data: clients, 
    isLoading, 
    error, 
    isOffline, 
    lastSync, 
    refetch 
  } = useOfflineQuery(
    ['clients', tenantId],
    async () => {
      const q = query(collection(db, 'tenants', tenantId, 'clients'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    {
      collection: `tenants/${tenantId}/clients`,
      transform: (snapshot) => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    },
    {
      enabled: !!tenantId,
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );

  // Offline-aware mutation with retry
  const addClientMutation = useOfflineMutation(
    async (clientData: any) => {
      const docRef = await addDoc(collection(db, 'tenants', tenantId, 'clients'), clientData);
      return { id: docRef.id, ...clientData };
    },
    {
      onSuccess: () => {
        // Data will automatically sync due to real-time listener
        console.log('Client added successfully');
      },
      onError: (error) => {
        console.error('Failed to add client:', error);
      },
      retryOnReconnect: true, // Queue for retry when back online
    }
  );

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1>Clients (Offline-Aware)</h1>
        <div className="flex items-center space-x-2">
          <span className={`text-sm ${isOffline ? 'text-orange-600' : 'text-green-600'}`}>
            {isOffline ? 'Offline' : 'Online'}
          </span>
          {lastSync && (
            <span className="text-xs text-gray-500">
              Last sync: {lastSync.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => refetch()}
            className="px-2 py-1 bg-blue-600 text-white rounded text-sm"
          >
            Refresh
          </button>
        </div>
      </div>
      
      <button 
        onClick={() => addClientMutation.mutate({ name: 'New Client' })}
        disabled={addClientMutation.isLoading}
        className="mb-4 px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-400"
      >
        {addClientMutation.isLoading ? 'Adding...' : 'Add Client'}
        {addClientMutation.pendingMutations > 0 && (
          <span className="ml-2 text-xs">
            ({addClientMutation.pendingMutations} pending)
          </span>
        )}
      </button>
      
      <ul>
        {clients?.map(client => (
          <li key={client.id} className="p-2 border rounded mb-2">
            {client.name}
          </li>
        ))}
      </ul>
    </div>
  );
};

// Example: Advanced offline query with complex filtering
export const AdvancedOfflineQuery: React.FC = () => {
  const tenantId = useTenantId();

  const { data: receptions, isLoading, error, isOffline } = useOfflineQuery(
    ['receptions', tenantId, 'today'],
    async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const q = query(
        collection(db, 'receptions'),
        where('tenantId', '==', tenantId),
        where('createdAt', '>=', today)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    {
      collection: 'receptions',
      constraints: [
        where('tenantId', '==', tenantId),
        where('createdAt', '>=', new Date(new Date().setHours(0, 0, 0, 0)))
      ],
      transform: (snapshot) => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    },
    {
      enabled: !!tenantId,
      staleTime: 2 * 60 * 1000, // 2 minutes for real-time data
    }
  );

  return (
    <div>
      <h2>Today's Receptions</h2>
      <p>Status: {isOffline ? 'Offline' : 'Online'}</p>
      {isLoading && <p>Loading...</p>}
      {error && <p>Error: {error.message}</p>}
      {receptions && (
        <ul>
          {receptions.map(reception => (
            <li key={reception.id}>
              Reception {reception.id} - {reception.createdAt?.toDate?.()?.toLocaleString()}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// Example: Batch operations with offline support
export const BatchOperationsExample: React.FC = () => {
  const tenantId = useTenantId();

  const batchUpdateMutation = useOfflineMutation(
    async (updates: Array<{ id: string; data: any }>) => {
      // Process updates one by one (Firestore doesn't support offline batch writes)
      const results = [];
      for (const update of updates) {
        const docRef = doc(db, 'tenants', tenantId, 'clients', update.id);
        await updateDoc(docRef, update.data);
        results.push({ id: update.id, ...update.data });
      }
      return results;
    },
    {
      onSuccess: (results) => {
        console.log(`Updated ${results.length} clients successfully`);
      },
      retryOnReconnect: true,
    }
  );

  const handleBatchUpdate = () => {
    const updates = [
      { id: 'client1', data: { name: 'Updated Client 1' } },
      { id: 'client2', data: { name: 'Updated Client 2' } },
    ];
    batchUpdateMutation.mutate(updates);
  };

  return (
    <div>
      <h2>Batch Operations</h2>
      <button 
        onClick={handleBatchUpdate}
        disabled={batchUpdateMutation.isLoading}
        className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-400"
      >
        {batchUpdateMutation.isLoading ? 'Updating...' : 'Update Multiple Clients'}
        {batchUpdateMutation.pendingMutations > 0 && (
          <span className="ml-2 text-xs">
            ({batchUpdateMutation.pendingMutations} pending)
          </span>
        )}
      </button>
    </div>
  );
};
