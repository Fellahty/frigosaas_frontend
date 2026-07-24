import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where, doc, getDoc } from '@/lib/db';
import { db } from '../firebase';
import { useTenantId } from './useTenantId';
import { safeToDate } from '../dateUtils';

// Types
export type LoanStatus = 'open' | 'returned';
export type CrateType = 'wood' | 'plastic';
export type CrateColor = 'blue' | 'green' | 'red' | 'yellow' | 'white' | 'black' | 'gray' | 'brown';

export interface CrateTypeConfig {
  id: string;
  name: string;
  type: CrateType;
  color: CrateColor;
  customName?: string;
  depositAmount: number;
  quantity: number;
  isActive: boolean;
  createdAt: Date;
}

export interface Truck {
  id: string;
  number: string;
  color?: string;
  photoUrl?: string;
  isActive: boolean;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  licenseNumber: string;
  isActive: boolean;
}

export interface LoanItem {
  id: string;
  ticketId: string;
  clientId: string | null;
  clientName: string;
  crates: number;
  crateTypeId: string;
  crateTypeName: string;
  crateType: CrateType;
  crateColor: CrateColor;
  status: LoanStatus;
  truckId?: string;
  truckNumber?: string;
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  createdAt: Date;
}

export interface ClientOption { 
  id: string; 
  name: string; 
}

export interface ClientStats {
  totalEmptyCratesNeeded: number;
  reservedRooms: string[];
  totalCautionPaid: number;
  totalSortieAmount: number;
  cratesCanTake: number;
}

// Hook for fetching empty crate loans
export const useEmptyCrateLoans = () => {
  const tenantId = useTenantId();

  return useQuery({
    queryKey: ['empty-crate-loans', tenantId],
    queryFn: async (): Promise<LoanItem[]> => {
      if (!tenantId) {
        throw new Error('No tenant ID available');
      }

      const q = query(collection(db, 'empty_crate_loans'), where('tenantId', '==', tenantId));
      const snap = await getDocs(q);
      
      // Get clients data to populate missing client names
      const clientsQuery = query(collection(db, 'clients'), where('tenantId', '==', tenantId));
      const clientsSnap = await getDocs(clientsQuery);
      const clientsMap = new Map();
      clientsSnap.docs.forEach(doc => {
        const clientData = doc.data();
        clientsMap.set(doc.id, clientData.name || 'Client inconnu');
      });
      
      const list = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          ticketId: data.ticketId || '',
          clientId: data.clientId || null,
          clientName: data.clientName || (data.clientId ? clientsMap.get(data.clientId) || 'Client inconnu' : 'N/A'),
          crates: Number(data.crates) || 0,
          crateTypeId: data.crateTypeId || '',
          crateTypeName: data.crateTypeName || '',
          crateType: data.crateType || 'plastic',
          crateColor: data.crateColor || 'blue',
          status: (data.status as LoanStatus) || 'open',
          truckId: data.truckId || null,
          truckNumber: data.truckNumber || '',
          driverId: data.driverId || null,
          driverName: data.driverName || '',
          driverPhone: data.driverPhone || '',
          createdAt: safeToDate(data.createdAt),
        };
      });
      // newest first
      return list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
    enabled: !!tenantId,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 15000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    retry: 3,
    retryDelay: 1000,
  });
};

// Hook for fetching clients
export const useClients = () => {
  const tenantId = useTenantId();

  return useQuery({
    queryKey: ['clients', tenantId, 'for-loans'],
    queryFn: async (): Promise<ClientOption[]> => {
      if (!tenantId) {
        throw new Error('No tenant ID available');
      }

      const q = query(collection(db, 'tenants', tenantId, 'clients'));
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ 
        id: d.id, 
        name: (d.data() as any).name || '—' 
      }));
    },
    enabled: !!tenantId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 3,
    retryDelay: 1000,
  });
};

// Hook for fetching trucks
export const useTrucks = () => {
  const tenantId = useTenantId();

  return useQuery({
    queryKey: ['trucks', tenantId],
    queryFn: async (): Promise<Truck[]> => {
      if (!tenantId) {
        return [];
      }

      try {
        const q = query(
          collection(db, 'trucks'), 
          where('tenantId', '==', tenantId), 
          where('isActive', '==', true)
        );
        const snap = await getDocs(q);
        return snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            number: data.number || '',
            color: data.color || '',
            photoUrl: data.photoUrl || '',
            isActive: data.isActive || false,
          };
        });
      } catch (error) {
        console.error('Error fetching trucks:', error);
        return [];
      }
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 3,
    retryDelay: 1000,
  });
};

// Hook for fetching drivers
export const useDrivers = () => {
  const tenantId = useTenantId();

  return useQuery({
    queryKey: ['drivers', tenantId],
    queryFn: async (): Promise<Driver[]> => {
      if (!tenantId) {
        return [];
      }

      try {
        const q = query(
          collection(db, 'drivers'), 
          where('tenantId', '==', tenantId), 
          where('isActive', '==', true)
        );
        const snap = await getDocs(q);
        return snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            name: data.name || '',
            phone: data.phone || '',
            licenseNumber: data.licenseNumber || '',
            isActive: data.isActive || false,
          };
        });
      } catch (error) {
        console.error('Error fetching drivers:', error);
        return [];
      }
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 3,
    retryDelay: 1000,
  });
};

// Hook for fetching crate types
export const useCrateTypes = () => {
  const tenantId = useTenantId();

  return useQuery({
    queryKey: ['crate-types', tenantId],
    queryFn: async (): Promise<CrateTypeConfig[]> => {
      if (!tenantId) {
        throw new Error('No tenant ID available');
      }

      const q = query(
        collection(db, 'tenants', tenantId, 'crate-types'), 
        where('isActive', '==', true)
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          name: data.name || '',
          type: data.type || 'plastic',
          color: data.color || 'blue',
          customName: data.customName || '',
          depositAmount: Number(data.depositAmount) || 0,
          quantity: Number(data.quantity) || 0,
          isActive: data.isActive || false,
          createdAt: safeToDate(data.createdAt),
        };
      });
    },
    enabled: !!tenantId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 3,
    retryDelay: 1000,
  });
};

// Hook for fetching rooms
export const useRooms = () => {
  const tenantId = useTenantId();

  return useQuery({
    queryKey: ['rooms', tenantId],
    queryFn: async () => {
      if (!tenantId) {
        throw new Error('No tenant ID available');
      }

      const q = query(collection(db, 'tenants', tenantId, 'rooms'));
      const snap = await getDocs(q);
      return snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 3,
    retryDelay: 1000,
  });
};

// Hook for fetching client reservations
export const useClientReservations = (clientId: string | null) => {
  const tenantId = useTenantId();

  return useQuery({
    queryKey: ['client-reservations', tenantId, clientId],
    queryFn: async () => {
      if (!tenantId || !clientId) {
        return null;
      }

      const q = query(
        collection(db, 'tenants', tenantId, 'reservations'),
        where('clientId', '==', clientId)
      );
      const snap = await getDocs(q);
      return snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    },
    enabled: !!tenantId && !!clientId,
    staleTime: 1 * 60 * 1000, // 1 minute
    retry: 3,
    retryDelay: 1000,
  });
};

// Hook for fetching deposit per crate from pricing settings
export const useDepositPerCrate = () => {
  const tenantId = useTenantId();

  return useQuery({
    queryKey: ['deposit-per-crate', tenantId],
    queryFn: async () => {
      if (!tenantId) {
        return 50;
      }

      try {
        const pricingRef = doc(db, 'tenants', tenantId, 'settings', 'pricing');
        const pricingSnap = await getDoc(pricingRef);
        
        if (pricingSnap.exists()) {
          const data = pricingSnap.data();
          return Number(data?.depositPerCrate) || 50;
        }
        
        return 50;
      } catch (error) {
        console.error('Error fetching deposit per crate:', error);
        return 50;
      }
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 3,
    retryDelay: 1000,
  });
};

// Hook for fetching caution records
export const useCautionRecords = (clientId: string | null) => {
  const tenantId = useTenantId();

  return useQuery({
    queryKey: ['caution-records', tenantId, clientId],
    queryFn: async () => {
      if (!tenantId || !clientId) {
        return [];
      }

      const q = query(
        collection(db, 'tenants', tenantId, 'operations'),
        where('clientId', '==', clientId),
        where('type', '==', 'caution')
      );
      const snap = await getDocs(q);
      return snap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          amount: Number(data.amount) || 0,
          type: data.type || 'caution',
          createdAt: safeToDate(data.createdAt),
          ...data
        };
      });
    },
    enabled: !!tenantId && !!clientId,
    staleTime: 1 * 60 * 1000, // 1 minute
    retry: 3,
    retryDelay: 1000,
  });
};

// Hook for fetching site settings
export const useSiteSettings = () => {
  const tenantId = useTenantId();

  return useQuery({
    queryKey: ['site-settings', tenantId],
    queryFn: async (): Promise<{ name: string }> => {
      if (!tenantId) {
        throw new Error('No tenant ID available');
      }

      const docRef = doc(db, 'tenants', tenantId, 'settings', 'site');
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        return { name: data?.name || 'Company' };
      }
      
      return { name: 'Company' };
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 3,
    retryDelay: 1000,
  });
};

// Combined hook for all loans page data
export const useLoansPageData = (clientId: string | null = null) => {
  const loansQuery = useEmptyCrateLoans();
  const clientsQuery = useClients();
  const trucksQuery = useTrucks();
  const driversQuery = useDrivers();
  const crateTypesQuery = useCrateTypes();
  const roomsQuery = useRooms();
  const clientReservationsQuery = useClientReservations(clientId);
  const depositPerCrateQuery = useDepositPerCrate();
  const cautionRecordsQuery = useCautionRecords(clientId);
  const siteSettingsQuery = useSiteSettings();

  return {
    // Individual data (accessing .data property)
    loans: loansQuery.data || [],
    clients: clientsQuery.data || [],
    trucks: trucksQuery.data || [],
    drivers: driversQuery.data || [],
    crateTypes: crateTypesQuery.data || [],
    rooms: roomsQuery.data || [],
    clientReservations: clientReservationsQuery.data || null,
    depositPerCrate: depositPerCrateQuery.data || 50,
    cautionRecords: cautionRecordsQuery.data || [],
    siteSettings: siteSettingsQuery.data || { name: 'Company' },
    
    // Combined loading state
    isLoading: loansQuery.isLoading || clientsQuery.isLoading || trucksQuery.isLoading || 
               driversQuery.isLoading || crateTypesQuery.isLoading || roomsQuery.isLoading ||
               (clientId ? clientReservationsQuery.isLoading : false) ||
               depositPerCrateQuery.isLoading ||
               (clientId ? cautionRecordsQuery.isLoading : false) ||
               siteSettingsQuery.isLoading,
    
    // Combined error state
    hasError: loansQuery.error || clientsQuery.error || trucksQuery.error || 
              driversQuery.error || crateTypesQuery.error || roomsQuery.error ||
              (clientId ? clientReservationsQuery.error : null) ||
              depositPerCrateQuery.error ||
              (clientId ? cautionRecordsQuery.error : null) ||
              siteSettingsQuery.error,
    
    // Refetch all
    refetchAll: () => {
      loansQuery.refetch();
      clientsQuery.refetch();
      trucksQuery.refetch();
      driversQuery.refetch();
      crateTypesQuery.refetch();
      roomsQuery.refetch();
      if (clientId) {
        clientReservationsQuery.refetch();
        cautionRecordsQuery.refetch();
      }
      depositPerCrateQuery.refetch();
      siteSettingsQuery.refetch();
    }
  };
};
