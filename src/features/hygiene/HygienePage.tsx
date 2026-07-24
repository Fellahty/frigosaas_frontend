import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, Timestamp } from '@/lib/db';
import { ref, uploadBytes, getDownloadURL } from '@/lib/storage';
import { db, storage } from '../../lib/firebase';
import { useTenantId } from '../../lib/hooks/useTenantId';
import { Room } from '../../types/settings';
import { Card } from '../../components/Card';
import { DataTable } from '../../components/DataTable';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { Spinner } from '../../components/Spinner';
import { FormCard } from '../../components/FormCard';
import { PrintButton } from '../../components/PrintButton';

// Types for hygiene records
interface VehicleControlRecord {
  id: string;
  date: string;
  vehicleNumber: string;
  cleanlinessState: 'clean' | 'dirty';
  controller: string;
  supervisor: string;
  notes?: string;
}

interface CleaningControlRecord {
  id: string;
  date: string;
  elementToClean: string;
  operation: 'cleaning' | 'disinfection' | 'maintenance';
  operator: string;
  responsible: string;
  notes?: string;
  photoUrl?: string;
}

interface Truck {
  id: string;
  number: string;
  color?: string;
  photoUrl?: string;
  isActive: boolean;
  lastVisit?: Date;
  visitCount: number;
  createdAt?: Date;
  tenantId?: string;
}

type HygieneRecord = VehicleControlRecord | CleaningControlRecord;

// Mock data
const mockVehicleRecords: VehicleControlRecord[] = [
  {
    id: '1',
    date: '2024-01-15',
    vehicleNumber: '5200-9-36',
    cleanlinessState: 'clean',
    controller: 'Hassane',
    supervisor: 'Samia',
    notes: 'Véhicule en excellent état'
  },
  {
    id: '2',
    date: '2024-01-14',
    vehicleNumber: '2525-B-40',
    cleanlinessState: 'clean',
    controller: 'Hassane',
    supervisor: 'Jum\'a',
    notes: 'Contrôle effectué avec succès'
  },
  {
    id: '3',
    date: '2024-01-13',
    vehicleNumber: '2706-9-17',
    cleanlinessState: 'clean',
    controller: 'Hassane',
    supervisor: 'Samia'
  }
];

const mockCleaningRecords: CleaningControlRecord[] = [
  {
    id: '1',
    date: '2024-01-15',
    elementToClean: 'Salle de triage pommes',
    operation: 'cleaning',
    operator: 'Équipe Frigo',
    responsible: 'Samia',
    notes: 'Nettoyage complet effectué'
  },
  {
    id: '2',
    date: '2024-01-14',
    elementToClean: 'Couloir',
    operation: 'cleaning',
    operator: 'Équipe Frigo',
    responsible: 'Samia'
  },
  {
    id: '3',
    date: '2024-01-13',
    elementToClean: 'Chambre 1',
    operation: 'disinfection',
    operator: 'Équipe Frigo',
    responsible: 'Samia',
    notes: 'Désinfection préventive'
  }
];


export const HygienePage: React.FC = () => {
  const { t } = useTranslation();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'vehicle' | 'cleaning' | 'trucks'>('vehicle');
  // Remove local state - use data directly from useQuery hooks
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);
  const [selectedRecords, setSelectedRecords] = useState<string[]>([]);
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  // Add form states
  const [isAddingVehicle, setIsAddingVehicle] = useState(false);
  const [isAddingCleaning, setIsAddingCleaning] = useState(false);
  const [isAddingTruck, setIsAddingTruck] = useState(false);
  const [isQuickCleaning, setIsQuickCleaning] = useState(false);
  
  // Form data states
  const [vehicleForm, setVehicleForm] = useState({
    date: '',
    vehicleNumber: '',
    cleanlinessState: 'clean' as 'clean' | 'dirty',
    controller: '',
    supervisor: '',
    notes: ''
  });
  
  const [cleaningForm, setCleaningForm] = useState({
    date: '',
    elementToClean: '',
    operation: 'cleaning' as 'cleaning' | 'disinfection' | 'maintenance',
    operator: '',
    responsible: 'Soufiane',
    notes: '',
    photoUrl: ''
  });
  
  const [truckForm, setTruckForm] = useState({
    number: '',
    color: '',
    photoUrl: ''
  });

  // Fetch trucks from Firebase
  const { data: trucks = [], isLoading: trucksLoading, error: trucksError } = useQuery({
    queryKey: ['trucks', tenantId],
    queryFn: async (): Promise<Truck[]> => {
      if (!tenantId) {
        console.warn('No tenant ID available for trucks query');
        return [];
      }
      
      try {
        console.log('Fetching trucks for tenant:', tenantId);
        const q = query(collection(db, 'trucks'), where('tenantId', '==', tenantId), where('isActive', '==', true));
        const snap = await getDocs(q);
        const trucksData = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            number: data.number || '',
            color: data.color || '',
            photoUrl: data.photoUrl || '',
            isActive: data.isActive !== false,
            lastVisit: data.lastVisit?.toDate ? data.lastVisit.toDate() : undefined,
            visitCount: data.visitCount || 0,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : undefined,
            tenantId: data.tenantId
          };
        });
        console.log('Trucks loaded:', trucksData.length, 'trucks');
        return trucksData;
      } catch (error) {
        console.error('Error fetching trucks:', error);
        return [];
      }
    },
    enabled: !!tenantId,
  });

  // Fetch rooms from Firebase
  const { data: rooms = [], isLoading: roomsLoading } = useQuery({
    queryKey: ['rooms', tenantId],
    queryFn: async (): Promise<Room[]> => {
      if (!tenantId) {
        console.warn('No tenant ID available for rooms query');
        return [];
      }
      
      try {
        console.log('Fetching rooms for tenant:', tenantId);
        const q = query(collection(db, 'rooms'), where('tenantId', '==', tenantId), where('active', '==', true));
        const snap = await getDocs(q);
        const roomsData = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            room: data.room || '',
            capacity: data.capacity || 0,
            capacityCrates: data.capacityCrates || 0,
            capacityPallets: data.capacityPallets || 0,
            sensorId: data.sensorId || '',
            active: data.active !== false,
          };
        });
        console.log('Rooms loaded:', roomsData.length, 'rooms');
        return roomsData;
      } catch (error) {
        console.error('Error fetching rooms:', error);
        return [];
      }
    },
    enabled: !!tenantId,
  });

  // Fetch vehicle control records from Firebase
  const { data: vehicleRecordsData = [], isLoading: vehicleLoading } = useQuery({
    queryKey: ['vehicle-control-records', tenantId],
    queryFn: async (): Promise<VehicleControlRecord[]> => {
      if (!tenantId) return [];
      
      try {
        const q = query(collection(db, 'vehicle_control_records'), where('tenantId', '==', tenantId));
        const snap = await getDocs(q);
        return snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          date: doc.data().date || new Date().toISOString().split('T')[0]
        })) as VehicleControlRecord[];
      } catch (error) {
        console.error('Error fetching vehicle control records:', error);
        return mockVehicleRecords; // Fallback to mock data
      }
    },
    enabled: !!tenantId,
  });

  // Fetch cleaning control records from Firebase
  const { data: cleaningRecordsData = [], isLoading: cleaningLoading } = useQuery({
    queryKey: ['cleaning-control-records', tenantId],
    queryFn: async (): Promise<CleaningControlRecord[]> => {
      if (!tenantId) return [];
      
      try {
        const q = query(collection(db, 'cleaning_control_records'), where('tenantId', '==', tenantId));
        const snap = await getDocs(q);
        return snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          date: doc.data().date || new Date().toISOString().split('T')[0]
        })) as CleaningControlRecord[];
      } catch (error) {
        console.error('Error fetching cleaning control records:', error);
        return mockCleaningRecords; // Fallback to mock data
      }
    },
    enabled: !!tenantId,
  });

  // Clear selected records when switching tabs
  useEffect(() => {
    setSelectedRecords([]);
  }, [activeTab]);

  // Form handlers
  // Add vehicle control record mutation
  const addVehicleRecordMutation = useMutation({
    mutationFn: async (payload: typeof vehicleForm) => {
      if (!tenantId) throw new Error('No tenant ID available');
      
      const recordData = {
        tenantId,
        ...payload,
        date: payload.date || new Date().toISOString().split('T')[0],
        createdAt: Timestamp.fromDate(new Date()),
      };
      
      // Add the vehicle control record
      const docRef = await addDoc(collection(db, 'vehicle_control_records'), recordData);
      
      // Update truck visit count and last visit
      const truck = trucks.find(t => t.number === payload.vehicleNumber);
      if (truck) {
        await updateDoc(doc(db, 'trucks', truck.id), {
          lastVisit: Timestamp.fromDate(new Date()),
          visitCount: (truck.visitCount || 0) + 1
        });
      }
      
      return docRef.id;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['vehicle-control-records', tenantId] });
      await queryClient.invalidateQueries({ queryKey: ['trucks', tenantId] });
      setVehicleForm({
        date: '',
        vehicleNumber: '',
        cleanlinessState: 'clean',
        controller: '',
        supervisor: '',
        notes: ''
      });
      setIsAddingVehicle(false);
    },
  });

  const handleVehicleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addVehicleRecordMutation.mutate(vehicleForm);
  };

  // Add cleaning control record mutation
  const addCleaningRecordMutation = useMutation({
    mutationFn: async (payload: typeof cleaningForm & { selectedImage?: File | null }) => {
      if (!tenantId) throw new Error('No tenant ID available');
      
      let photoUrl = payload.photoUrl;
      
      // Upload image if selected
      if (payload.selectedImage) {
        photoUrl = await uploadImageToFirebase(payload.selectedImage);
      }
      
      const recordData = {
        tenantId,
        ...payload,
        photoUrl,
        date: payload.date || new Date().toISOString().split('T')[0],
        createdAt: Timestamp.fromDate(new Date()),
      };
      
      const docRef = await addDoc(collection(db, 'cleaning_control_records'), recordData);
      return docRef.id;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['cleaning-control-records', tenantId] });
      setCleaningForm({
        date: '',
        elementToClean: '',
        operation: 'cleaning',
        operator: '',
        responsible: 'Soufiane',
        notes: '',
        photoUrl: ''
      });
      setSelectedImage(null);
      setImagePreview(null);
      setIsAddingCleaning(false);
    },
  });

  const handleCleaningSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addCleaningRecordMutation.mutate({
      ...cleaningForm,
      selectedImage
    });
  };

  // Add truck mutation
  const addTruckMutation = useMutation({
    mutationFn: async (payload: typeof truckForm) => {
      if (!tenantId) throw new Error('No tenant ID available');
      
      const docRef = await addDoc(collection(db, 'trucks'), {
        tenantId,
        ...payload,
        isActive: true,
        visitCount: 0,
        createdAt: Timestamp.fromDate(new Date()),
      });
      return docRef.id;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['trucks', tenantId] });
      setTruckForm({
        number: '',
        color: '',
        photoUrl: ''
      });
      setIsAddingTruck(false);
    },
  });

  // Delete truck mutation
  const deleteTruckMutation = useMutation({
    mutationFn: async (truckId: string) => {
      await updateDoc(doc(db, 'trucks', truckId), {
        isActive: false
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['trucks', tenantId] });
    },
  });

  // Delete vehicle control record mutation
  const deleteVehicleRecordMutation = useMutation({
    mutationFn: async (recordId: string) => {
      await deleteDoc(doc(db, 'vehicle_control_records', recordId));
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['vehicle-control-records', tenantId] });
    },
  });

  // Delete cleaning control record mutation
  const deleteCleaningRecordMutation = useMutation({
    mutationFn: async (recordId: string) => {
      await deleteDoc(doc(db, 'cleaning_control_records', recordId));
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['cleaning-control-records', tenantId] });
    },
  });

  // Bulk delete mutations
  const bulkDeleteVehicleRecordsMutation = useMutation({
    mutationFn: async (recordIds: string[]) => {
      const promises = recordIds.map(id => deleteDoc(doc(db, 'vehicle_control_records', id)));
      await Promise.all(promises);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['vehicle-control-records', tenantId] });
      setSelectedRecords([]);
    },
  });

  const bulkDeleteCleaningRecordsMutation = useMutation({
    mutationFn: async (recordIds: string[]) => {
      const promises = recordIds.map(id => deleteDoc(doc(db, 'cleaning_control_records', id)));
      await Promise.all(promises);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['cleaning-control-records', tenantId] });
      setSelectedRecords([]);
    },
  });

  const bulkDeleteTrucksMutation = useMutation({
    mutationFn: async (truckIds: string[]) => {
      const promises = truckIds.map(id => updateDoc(doc(db, 'trucks', id), { isActive: false }));
      await Promise.all(promises);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['trucks', tenantId] });
      setSelectedRecords([]);
    },
  });

  const handleTruckSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addTruckMutation.mutate(truckForm);
  };

  // Quick cleaning function - add all cleaning elements for today
  const quickCleaningMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error('No tenant ID available');
      
      const today = new Date().toISOString().split('T')[0];
      
      // Get room names from database
      const roomNames = rooms.map(room => room.room);
      
      // Add common areas + rooms from database and sort alphabetically
      const cleaningElements = [
        'Salle de triage pommes',
        'Couloir 1',
        'Couloir 2',
        'Le Quai',
        'Passage entre les chambres',
        'Toilettes',
        'Vestiaires',
        ...roomNames // Add all rooms from database
      ].sort();
      
      const promises = cleaningElements.map(element => 
        addDoc(collection(db, 'cleaning_control_records'), {
          tenantId,
          date: today,
          elementToClean: element,
          operation: 'cleaning',
          operator: 'Équipe Frigo',
          responsible: 'Soufiane',
          notes: 'Nettoyage quotidien automatique',
          createdAt: Timestamp.fromDate(new Date()),
        })
      );
      
      await Promise.all(promises);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['cleaning-control-records', tenantId] });
      setIsQuickCleaning(false);
    },
  });

  const handleQuickCleaning = () => {
    quickCleaningMutation.mutate();
  };

  const handleDelete = (recordId: string) => {
    setRecordToDelete(recordId);
    setDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (recordToDelete) {
      if (activeTab === 'vehicle') {
        deleteVehicleRecordMutation.mutate(recordToDelete);
      } else if (activeTab === 'cleaning') {
        deleteCleaningRecordMutation.mutate(recordToDelete);
      } else if (activeTab === 'trucks') {
        deleteTruckMutation.mutate(recordToDelete);
      }
    }
    setDeleteModalOpen(false);
    setRecordToDelete(null);
  };

  const handleBulkDelete = () => {
    if (selectedRecords.length === 0) return;
    
    if (activeTab === 'vehicle') {
      bulkDeleteVehicleRecordsMutation.mutate(selectedRecords);
    } else if (activeTab === 'cleaning') {
      bulkDeleteCleaningRecordsMutation.mutate(selectedRecords);
    } else if (activeTab === 'trucks') {
      bulkDeleteTrucksMutation.mutate(selectedRecords);
    }
    setBulkDeleteModalOpen(false);
  };

  const handleSelectRecord = (recordId: string) => {
    setSelectedRecords(prev => 
      prev.includes(recordId) 
        ? prev.filter(id => id !== recordId)
        : [...prev, recordId]
    );
  };

  const handleSelectAll = () => {
    const currentData = activeTab === 'vehicle' ? vehicleRecordsData : 
                       activeTab === 'cleaning' ? cleaningRecordsData : trucks;
    
    if (selectedRecords.length === currentData.length) {
      setSelectedRecords([]);
    } else {
      setSelectedRecords(currentData.map((item: any) => item.id));
    }
  };

  // Image upload functions
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Veuillez sélectionner un fichier image valide');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('La taille du fichier ne doit pas dépasser 5MB');
        return;
      }
      
      setSelectedImage(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImageToFirebase = async (file: File): Promise<string> => {
    if (!tenantId) throw new Error('No tenant ID available');
    
    const timestamp = Date.now();
    const fileName = `cleaning_photos/${tenantId}/${timestamp}_${file.name}`;
    const storageRef = ref(storage, fileName);
    
    setUploadingImage(true);
    try {
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      return downloadURL;
    } finally {
      setUploadingImage(false);
    }
  };

  const removeSelectedImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setCleaningForm(prev => ({ ...prev, photoUrl: '' }));
  };

  const getTruckTableColumns = () => [
    {
      key: 'select',
      label: (
        <input
          type="checkbox"
          checked={selectedRecords.length === trucks.length && trucks.length > 0}
          onChange={handleSelectAll}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
      ),
      render: (truck: Truck) => (
        <input
          type="checkbox"
          checked={selectedRecords.includes(truck.id)}
          onChange={() => handleSelectRecord(truck.id)}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
      )
    },
    {
      key: 'number',
      label: t('hygiene.vehicleNumber'),
      render: (truck: Truck) => (
        <span className="text-sm font-medium text-gray-900">
          {truck.number}
        </span>
      )
    },
    {
      key: 'color',
      label: 'Couleur',
      render: (truck: Truck) => (
        <div className="flex items-center">
          <div 
            className="w-4 h-4 rounded-full mr-2"
            style={{ backgroundColor: truck.color === 'Rouge' ? '#ef4444' : truck.color === 'Bleu' ? '#3b82f6' : truck.color === 'Blanc' ? '#ffffff' : truck.color === 'Vert' ? '#10b981' : '#6b7280' }}
          ></div>
          <span className="text-sm text-gray-900">{truck.color}</span>
        </div>
      )
    },
    {
      key: 'lastVisit',
      label: 'Dernière visite',
      render: (truck: Truck) => (
        <span className="text-sm text-gray-900">
          {truck.lastVisit ? new Date(truck.lastVisit).toLocaleDateString('fr-FR') : 'Jamais'}
        </span>
      )
    },
    {
      key: 'visitCount',
      label: 'Nombre de visites',
      render: (truck: Truck) => (
        <span className="text-sm font-medium text-gray-900">
          {truck.visitCount}
        </span>
      )
    },
    {
      key: 'status',
      label: 'Statut',
      render: (truck: Truck) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          truck.isActive 
            ? 'bg-green-100 text-green-800' 
            : 'bg-gray-100 text-gray-800'
        }`}>
          {truck.isActive ? 'Actif' : 'Inactif'}
        </span>
      )
    },
    {
      key: 'actions',
      label: t('hygiene.actions'),
      render: (truck: Truck) => (
        <div className="flex space-x-2">
          <button
            onClick={() => handleDelete(truck.id)}
            className="text-red-600 hover:text-red-900 text-sm font-medium"
          >
            {t('hygiene.delete')}
          </button>
        </div>
      )
    }
  ];

  const getVehicleTableColumns = () => [
    {
      key: 'select',
      label: (
        <input
          type="checkbox"
          checked={selectedRecords.length === vehicleRecordsData.length && vehicleRecordsData.length > 0}
          onChange={handleSelectAll}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
      ),
      render: (record: VehicleControlRecord) => (
        <input
          type="checkbox"
          checked={selectedRecords.includes(record.id)}
          onChange={() => handleSelectRecord(record.id)}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
      )
    },
    {
      key: 'date',
      label: t('hygiene.date'),
      render: (record: VehicleControlRecord) => (
        <span className="text-sm text-gray-900">
          {new Date(record.date).toLocaleDateString('fr-FR')}
        </span>
      )
    },
    {
      key: 'vehicleNumber',
      label: t('hygiene.vehicleNumber'),
      render: (record: VehicleControlRecord) => (
        <span className="text-sm font-medium text-gray-900">
          {record.vehicleNumber}
        </span>
      )
    },
    {
      key: 'cleanlinessState',
      label: t('hygiene.cleanlinessState'),
      render: (record: VehicleControlRecord) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          record.cleanlinessState === 'clean' 
            ? 'bg-green-100 text-green-800' 
            : 'bg-red-100 text-red-800'
        }`}>
          {t(`hygiene.${record.cleanlinessState}`)}
        </span>
      )
    },
    {
      key: 'controller',
      label: t('hygiene.controller'),
      render: (record: VehicleControlRecord) => (
        <span className="text-sm text-gray-900">{record.controller}</span>
      )
    },
    {
      key: 'supervisor',
      label: t('hygiene.supervisor'),
      render: (record: VehicleControlRecord) => (
        <span className="text-sm text-gray-900">{record.supervisor}</span>
      )
    },
    {
      key: 'actions',
      label: t('hygiene.actions'),
      render: (record: VehicleControlRecord) => (
        <div className="flex space-x-2">
          <button
            onClick={() => handleDelete(record.id)}
            className="text-red-600 hover:text-red-900 text-sm font-medium"
          >
            {t('hygiene.delete')}
          </button>
        </div>
      )
    }
  ];

  const getCleaningTableColumns = () => [
    {
      key: 'select',
      label: (
        <input
          type="checkbox"
          checked={selectedRecords.length === cleaningRecordsData.length && cleaningRecordsData.length > 0}
          onChange={handleSelectAll}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
      ),
      render: (record: CleaningControlRecord) => (
        <input
          type="checkbox"
          checked={selectedRecords.includes(record.id)}
          onChange={() => handleSelectRecord(record.id)}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
      )
    },
    {
      key: 'date',
      label: t('hygiene.date'),
      render: (record: CleaningControlRecord) => (
        <span className="text-sm text-gray-900">
          {new Date(record.date).toLocaleDateString('fr-FR')}
        </span>
      )
    },
    {
      key: 'elementToClean',
      label: t('hygiene.elementToClean'),
      render: (record: CleaningControlRecord) => (
        <span className="text-sm font-medium text-gray-900">
          {record.elementToClean}
        </span>
      )
    },
    {
      key: 'operation',
      label: t('hygiene.operation'),
      render: (record: CleaningControlRecord) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          record.operation === 'cleaning' 
            ? 'bg-blue-100 text-blue-800'
            : record.operation === 'disinfection'
            ? 'bg-purple-100 text-purple-800'
            : 'bg-orange-100 text-orange-800'
        }`}>
          {t(`hygiene.operations.${record.operation}`)}
        </span>
      )
    },
    {
      key: 'operator',
      label: t('hygiene.operator'),
      render: (record: CleaningControlRecord) => (
        <span className="text-sm text-gray-900">{record.operator}</span>
      )
    },
    {
      key: 'responsible',
      label: t('hygiene.responsible'),
      render: (record: CleaningControlRecord) => (
        <span className="text-sm text-gray-900">{record.responsible}</span>
      )
    },
    {
      key: 'photo',
      label: 'Photo',
      render: (record: CleaningControlRecord) => (
        record.photoUrl ? (
          <div className="flex items-center">
            <img
              src={record.photoUrl}
              alt="Photo du nettoyage"
              className="w-12 h-12 object-cover rounded-lg border border-gray-200"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        ) : (
          <span className="text-xs text-gray-400">Aucune photo</span>
        )
      )
    },
    {
      key: 'actions',
      label: t('hygiene.actions'),
      render: (record: CleaningControlRecord) => (
        <div className="flex space-x-2">
          <button
            onClick={() => handleDelete(record.id)}
            className="text-red-600 hover:text-red-900 text-sm font-medium"
          >
            {t('hygiene.delete')}
          </button>
        </div>
      )
    }
  ];

  const isLoading = trucksLoading || vehicleLoading || cleaningLoading || roomsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {t('hygiene.title')}
            </h1>
            <p className="text-gray-600 mt-1">
              {t('hygiene.subtitle')}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('vehicle')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'vehicle'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t('hygiene.vehicleControl')}
            </button>
            <button
              onClick={() => setActiveTab('cleaning')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'cleaning'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t('hygiene.cleaningControl')}
            </button>
            <button
              onClick={() => setActiveTab('trucks')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'trucks'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Liste des camions
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'vehicle' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  {t('hygiene.vehicleControlTitle')}
                </h3>
                <div className="flex space-x-2">
                  <PrintButton
                    data={vehicleRecordsData}
                    columns={getVehicleTableColumns()}
                    title="Procédure de contrôle qualité"
                    subtitle="Fiche de contrôle : Etat de moyen de transport à la réception"
                    type="vehicle"
                    className="mr-2"
                  />
                  {selectedRecords.length > 0 && (
                    <button
                      onClick={() => setBulkDeleteModalOpen(true)}
                      className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700"
                    >
                      Supprimer ({selectedRecords.length})
                    </button>
                  )}
                  <button 
                    onClick={() => setIsAddingVehicle(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
                  >
                    {t('hygiene.addRecord')}
                  </button>
                </div>
              </div>
              
              <DataTable
                data={vehicleRecordsData}
                columns={getVehicleTableColumns()}
                emptyMessage={t('hygiene.noRecords')}
              />
            </div>
          ) : activeTab === 'cleaning' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  {t('hygiene.cleaningControlTitle')}
                </h3>
                <div className="flex space-x-2">
                  <PrintButton
                    data={cleaningRecordsData}
                    columns={getCleaningTableColumns()}
                    title="Procédure de Nettoyage et désinfection"
                    subtitle="Fiche de réalisation des taches de Nettoyage et Désinfection des locaux"
                    type="cleaning"
                    className="mr-2"
                  />
                  {selectedRecords.length > 0 && (
                    <button
                      onClick={() => setBulkDeleteModalOpen(true)}
                      className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700"
                    >
                      Supprimer ({selectedRecords.length})
                    </button>
                  )}
                  <button 
                    onClick={handleQuickCleaning}
                    disabled={quickCleaningMutation.isPending}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                  >
                    {quickCleaningMutation.isPending ? 'Ajout...' : 'Nettoyage rapide aujourd\'hui'}
                  </button>
                  <button 
                    onClick={() => setIsAddingCleaning(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
                  >
                    {t('hygiene.addRecord')}
                  </button>
                </div>
              </div>
              
              <DataTable
                data={cleaningRecordsData}
                columns={getCleaningTableColumns()}
                emptyMessage={t('hygiene.noRecords')}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  Liste des camions et leurs visites
                </h3>
                <div className="flex space-x-2">
                  <PrintButton
                    data={trucks}
                    columns={getTruckTableColumns()}
                    title="Liste des camions"
                    subtitle="Suivi des visites et statut des camions"
                    type="trucks"
                    className="mr-2"
                  />
                  {selectedRecords.length > 0 && (
                    <button
                      onClick={() => setBulkDeleteModalOpen(true)}
                      className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700"
                    >
                      Supprimer ({selectedRecords.length})
                    </button>
                  )}
                  <button 
                    onClick={() => setIsAddingTruck(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
                  >
                    Ajouter un camion
                  </button>
                </div>
              </div>
              
              <DataTable
                data={trucks}
                columns={getTruckTableColumns()}
                emptyMessage="Aucun camion enregistré"
              />
            </div>
          )}
        </div>
      </div>

      {/* Add Vehicle Modal */}
      {isAddingVehicle && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Ajouter un contrôle véhicule</h3>
                <button
                  onClick={() => setIsAddingVehicle(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  ×
                </button>
              </div>
              
              <form onSubmit={handleVehicleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={vehicleForm.date}
                    onChange={(e) => setVehicleForm(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Numéro véhicule</label>
                  <select
                    value={vehicleForm.vehicleNumber}
                    onChange={(e) => setVehicleForm(prev => ({ ...prev, vehicleNumber: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2"
                    required
                  >
                    <option value="">Sélectionner un camion</option>
                    {trucks.map(truck => (
                      <option key={truck.id} value={truck.number}>
                        {truck.number} {truck.color && `(${truck.color})`}
                      </option>
                    ))}
                  </select>
                  <div className="mt-1">
                    <input
                      type="text"
                      value={vehicleForm.vehicleNumber}
                      onChange={(e) => setVehicleForm(prev => ({ ...prev, vehicleNumber: e.target.value }))}
                      className="w-full border rounded-md px-3 py-2 text-sm"
                      placeholder="Ou saisir un nouveau numéro..."
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">État de propreté</label>
                  <select
                    value={vehicleForm.cleanlinessState}
                    onChange={(e) => setVehicleForm(prev => ({ ...prev, cleanlinessState: e.target.value as 'clean' | 'dirty' }))}
                    className="w-full border rounded-md px-3 py-2"
                  >
                    <option value="clean">Propre</option>
                    <option value="dirty">Sale</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contrôleur</label>
                  <input
                    type="text"
                    value={vehicleForm.controller}
                    onChange={(e) => setVehicleForm(prev => ({ ...prev, controller: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2"
                    placeholder="Ex: Hassane"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Superviseur</label>
                  <input
                    type="text"
                    value={vehicleForm.supervisor}
                    onChange={(e) => setVehicleForm(prev => ({ ...prev, supervisor: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2"
                    placeholder="Ex: Samia"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optionnel)</label>
                  <textarea
                    value={vehicleForm.notes}
                    onChange={(e) => setVehicleForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2"
                    rows={3}
                    placeholder="Notes additionnelles..."
                  />
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsAddingVehicle(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Ajouter
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Add Cleaning Modal */}
      {isAddingCleaning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Ajouter un contrôle nettoyage</h3>
                <button
                  onClick={() => setIsAddingCleaning(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  ×
                </button>
              </div>
              
              <form onSubmit={handleCleaningSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={cleaningForm.date}
                    onChange={(e) => setCleaningForm(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Élément à nettoyer</label>
                  <select
                    value={cleaningForm.elementToClean}
                    onChange={(e) => setCleaningForm(prev => ({ ...prev, elementToClean: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2"
                    required
                  >
                    <option value="">Sélectionner un élément</option>
                    {[
                      'Salle de triage pommes',
                      'Couloir 1',
                      'Couloir 2',
                      'Le Quai',
                      'Passage entre les chambres',
                      'Toilettes',
                      'Vestiaires',
                      ...rooms.map(room => room.room)
                    ].sort().map((element, index) => (
                      <option key={index} value={element}>
                        {element}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Opération</label>
                  <select
                    value={cleaningForm.operation}
                    onChange={(e) => setCleaningForm(prev => ({ ...prev, operation: e.target.value as 'cleaning' | 'disinfection' | 'maintenance' }))}
                    className="w-full border rounded-md px-3 py-2"
                  >
                    <option value="cleaning">Nettoyage</option>
                    <option value="disinfection">Désinfection</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Opérateur</label>
                  <input
                    type="text"
                    value={cleaningForm.operator}
                    onChange={(e) => setCleaningForm(prev => ({ ...prev, operator: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2"
                    placeholder="Ex: Équipe Frigo"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Responsable</label>
                  <input
                    type="text"
                    value={cleaningForm.responsible}
                    onChange={(e) => setCleaningForm(prev => ({ ...prev, responsible: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2"
                    placeholder="Ex: Soufiane"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Photo du nettoyage (optionnel)</label>
                  
                  {!selectedImage ? (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageSelect}
                        className="hidden"
                        id="image-upload"
                      />
                      <label
                        htmlFor="image-upload"
                        className="cursor-pointer flex flex-col items-center"
                      >
                        <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        <span className="text-sm text-gray-600">Cliquez pour sélectionner une image</span>
                        <span className="text-xs text-gray-400 mt-1">JPG, PNG, GIF (max 5MB)</span>
                      </label>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="relative">
                        <img
                          src={imagePreview || ''}
                          alt="Aperçu"
                          className="w-full h-48 object-cover rounded-lg border border-gray-200"
                        />
                        <button
                          type="button"
                          onClick={removeSelectedImage}
                          className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <div className="flex items-center justify-between text-sm text-gray-600">
                        <span>{selectedImage.name}</span>
                        <span>{(selectedImage.size / 1024 / 1024).toFixed(2)} MB</span>
                      </div>
                    </div>
                  )}
                  
                  {uploadingImage && (
                    <div className="mt-2 flex items-center text-blue-600">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Upload en cours...
                    </div>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optionnel)</label>
                  <textarea
                    value={cleaningForm.notes}
                    onChange={(e) => setCleaningForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2"
                    rows={3}
                    placeholder="Notes additionnelles..."
                  />
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsAddingCleaning(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={addCleaningRecordMutation.isPending || uploadingImage}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {addCleaningRecordMutation.isPending || uploadingImage ? 'Ajout en cours...' : 'Ajouter'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Add Truck Modal */}
      {isAddingTruck && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Ajouter un camion</h3>
                <button
                  onClick={() => setIsAddingTruck(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  ×
                </button>
              </div>
              
              <form onSubmit={handleTruckSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Numéro du camion</label>
                  <input
                    type="text"
                    value={truckForm.number}
                    onChange={(e) => setTruckForm(prev => ({ ...prev, number: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2"
                    placeholder="Ex: 5200-9-36"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Couleur</label>
                  <select
                    value={truckForm.color}
                    onChange={(e) => setTruckForm(prev => ({ ...prev, color: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2"
                    required
                  >
                    <option value="">Sélectionner une couleur</option>
                    <option value="Rouge">Rouge</option>
                    <option value="Bleu">Bleu</option>
                    <option value="Blanc">Blanc</option>
                    <option value="Vert">Vert</option>
                    <option value="Noir">Noir</option>
                    <option value="Gris">Gris</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">URL Photo (optionnel)</label>
                  <input
                    type="url"
                    value={truckForm.photoUrl}
                    onChange={(e) => setTruckForm(prev => ({ ...prev, photoUrl: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2"
                    placeholder="https://example.com/photo.jpg"
                  />
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsAddingTruck(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Ajouter
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title={t('hygiene.confirmDelete')}
        message="Cette action ne peut pas être annulée."
        confirmText={t('hygiene.delete')}
        cancelText={t('hygiene.cancel')}
        confirmButtonClass="bg-red-600 hover:bg-red-700"
      />

      {/* Bulk Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={bulkDeleteModalOpen}
        onClose={() => setBulkDeleteModalOpen(false)}
        onConfirm={handleBulkDelete}
        title="Confirmer la suppression multiple"
        message={`Êtes-vous sûr de vouloir supprimer ${selectedRecords.length} élément(s) ? Cette action ne peut pas être annulée.`}
        confirmText="Supprimer tout"
        cancelText="Annuler"
        confirmButtonClass="bg-red-600 hover:bg-red-700"
      />
    </div>
  );
};
