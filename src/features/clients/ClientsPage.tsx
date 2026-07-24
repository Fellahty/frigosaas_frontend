import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, Timestamp, query, where } from '@/lib/db';
import { useTenantId } from '../../lib/hooks/useTenantId';
import { useTranslation } from 'react-i18next';
import { db } from '../../lib/firebase';
import { logClientAction, logWithCurrentUser } from '../../lib/logging';
import { useUserContext } from '../../lib/hooks/useUserContext';
import { Card } from '../../components/Card';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../../components/Table';
import { Spinner } from '../../components/Spinner';
import { formatTimestamp } from '../../lib/dateUtils';
// Removed generate-password import due to browser compatibility issues

interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  password?: string;
  createdAt: Timestamp;
  lastVisit?: Timestamp;
  createdBy?: string;
  lastModifiedBy?: string;
  lastModifiedAt?: Timestamp;
}

export const ClientsPage: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  const { userContext } = useUserContext();
  
  // Debug: Log user context (only once)
  React.useEffect(() => {
    if (userContext) {
      console.log('User context in ClientsPage:', userContext);
    }
  }, [userContext?.id]); // Only log when user ID changes
  
  // Function to get current user name
  const getCurrentUserName = () => {
    if (userContext?.name) {
      return userContext.name;
    }
    
    // Try to get from localStorage
    try {
      const storedUser = localStorage.getItem('currentUser');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        return parsed.name || 'Admin';
      }
    } catch (error) {
      console.error('Error parsing stored user:', error);
    }
    
    return 'Admin';
  };

  // Function to generate secure password for clients (browser-compatible)
  const generateClientPassword = () => {
    const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Excluded similar characters
    const lowercase = 'abcdefghijkmnpqrstuvwxyz'; // Excluded similar characters
    const numbers = '23456789'; // Excluded 0, 1
    const allChars = uppercase + lowercase + numbers;
    
    let password = '';
    
    // Ensure at least one character from each category
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    
    // Fill the rest with random characters
    for (let i = 3; i < 8; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  };

  // Function to toggle password visibility
  const togglePasswordVisibility = (clientId: string) => {
    setVisiblePasswords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(clientId)) {
        newSet.delete(clientId);
      } else {
        newSet.add(clientId);
      }
      return newSet;
    });
  };

  // Function to regenerate password for a client
  const regeneratePassword = async (clientId: string) => {
    if (!tenantId) return;
    
    try {
      const newPassword = generateClientPassword();
      const clientRef = doc(db, 'tenants', tenantId, 'clients', clientId);
      await updateDoc(clientRef, {
        password: newPassword,
        lastModifiedBy: getCurrentUserName(),
        lastModifiedAt: Timestamp.fromDate(new Date()),
      });
      
      await queryClient.invalidateQueries({ queryKey: ['clients', tenantId] });
      
      console.log('Password regenerated for client:', clientId);
    } catch (error) {
      console.error('Error regenerating password:', error);
    }
  };

  // Function to print client thermal ticket
  const printClientTicket = (client: Client) => {
    const ticketContent = `
========================================
    ENTREPÔTS FRIGORIFIQUES LYAZAMI
========================================
    Informations du Client
========================================

Nom du Client: ${client.name}
Email: ${client.email}
Téléphone: ${client.phone || 'Non renseigné'}
Entreprise: ${client.company || 'Non renseigné'}

========================================
    Compte de Connexion
========================================

Plateforme: LYAZAMI.FrigoSmart.com
Email: ${client.email}
Mot de passe: ${client.password || 'Non généré'}

========================================
    Informations de Création
========================================

Créé le: ${client.createdAt.toDate().toLocaleDateString('fr-FR')}
Créé par: ${client.createdBy || 'Système'}
Dernière modification: ${client.lastModifiedAt ? client.lastModifiedAt.toDate().toLocaleDateString('fr-FR') : 'Aucune'}

========================================
    Entrepôts Frigorifiques LYAZAMI
    Plateforme de Gestion Frigorifique
========================================
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Ticket Client - ${client.name}</title>
            <style>
              body {
                font-family: 'Courier New', monospace;
                font-size: 11px;
                line-height: 1.3;
                margin: 0;
                padding: 8px;
                background: white;
                color: black;
                max-width: 80mm;
                margin: 0 auto;
              }
              .ticket-header {
                text-align: center;
                font-weight: bold;
                font-size: 13px;
                margin-bottom: 8px;
              }
              .section-title {
                font-weight: bold;
                text-align: center;
                margin: 4px 0;
              }
              .info-line {
                margin: 2px 0;
                padding: 1px 0;
              }
              .separator {
                border-top: 1px dashed #333;
                margin: 4px 0;
              }
              @media print {
                body { 
                  margin: 0; 
                  padding: 4px;
                  font-size: 10px;
                }
                .ticket-header {
                  font-size: 12px;
                }
              }
            </style>
          </head>
          <body>
            <div class="ticket-header">ENTREPÔTS FRIGORIFIQUES YAZAMI</div>
            <div class="separator"></div>
            <div class="section-title">Informations du Client</div>
            <div class="separator"></div>
            <div class="info-line"><strong>Nom du Client:</strong> ${client.name}</div>
            <div class="info-line"><strong>Email:</strong> ${client.email}</div>
            <div class="info-line"><strong>Téléphone:</strong> ${client.phone || 'Non renseigné'}</div>
            <div class="info-line"><strong>Entreprise:</strong> ${client.company || 'Non renseigné'}</div>
            <div class="separator"></div>
            <div class="section-title">Compte de Connexion</div>
            <div class="separator"></div>
            <div class="info-line"><strong>Plateforme:</strong> LYAZAMI.FrigoSmart.com</div>
            <div class="info-line"><strong>Email:</strong> ${client.email}</div>
            <div class="info-line"><strong>Mot de passe:</strong> ${client.password || 'Non généré'}</div>
            <div class="separator"></div>
            <div class="section-title">Informations de Création</div>
            <div class="separator"></div>
            <div class="info-line"><strong>Créé le:</strong> ${client.createdAt.toDate().toLocaleDateString('fr-FR')}</div>
            <div class="info-line"><strong>Créé par:</strong> ${client.createdBy || 'Système'}</div>
            <div class="info-line"><strong>Dernière modification:</strong> ${client.lastModifiedAt ? client.lastModifiedAt.toDate().toLocaleDateString('fr-FR') : 'Aucune'}</div>
            <div class="separator"></div>
            <div class="ticket-header">Entrepôts Frigorifiques YAZAMI</div>
            <div class="section-title">Plateforme de Gestion Frigorifique</div>
            <script>
              window.onload = function() {
                window.print();
                setTimeout(() => window.close(), 1000);
              }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } else {
      // Fallback: print in current window
      const printDiv = document.createElement('div');
      printDiv.innerHTML = `<pre>${ticketContent}</pre>`;
      document.body.appendChild(printDiv);
      window.print();
      document.body.removeChild(printDiv);
    }
  };

  // Function to send client info via WhatsApp
  const sendClientInfoWhatsApp = (client: Client) => {
    const message = `🏢 *ENTREPÔTS FRIGORIFIQUES YAZAMI*

Bonjour ${client.name},

Votre compte client a été créé avec succès sur notre plateforme de gestion frigorifique.

📋 *Informations du Client:*
• Nom: ${client.name}
• Email: ${client.email}
• Téléphone: ${client.phone || 'Non renseigné'}
• Entreprise: ${client.company || 'Non renseigné'}

🔐 *Compte de Connexion:*
• Plateforme: LYAZAMI.FrigoSmart.com
• Email: ${client.email}
• Mot de passe: ${client.password || 'Non généré'}

Vous pouvez maintenant accéder à votre espace client et gérer vos réservations frigorifiques.

Merci de votre confiance,
L'équipe Entrepôts Frigorifiques YAZAMI`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${client.phone?.replace(/[^0-9]/g, '') || ''}?text=${encodedMessage}`;
    
    window.open(whatsappUrl, '_blank');
  };
  
  const [isAdding, setIsAdding] = React.useState(false);
  const [editingClient, setEditingClient] = React.useState<Client | null>(null);
  const [deletingClient, setDeletingClient] = React.useState<Client | null>(null);
  const [visiblePasswords, setVisiblePasswords] = React.useState<Set<string>>(new Set());
  const [showFormPassword, setShowFormPassword] = React.useState(false);
  const [form, setForm] = React.useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    password: '',
  });

  // Mock clients data
  const getMockClients = (): Client[] => [
    {
      id: '1',
      name: 'Ahmed Benali',
      email: 'ahmed.benali@example.com',
      phone: '+212 6 12 34 56 78',
      company: 'Fruits & Légumes SARL',
      password: 'AhB3n4l1',
      createdAt: Timestamp.fromDate(new Date('2024-01-15')),
      lastVisit: Timestamp.fromDate(new Date('2024-01-20')),
      createdBy: 'Admin',
      lastModifiedBy: 'Admin',
      lastModifiedAt: Timestamp.fromDate(new Date('2024-01-20')),
    },
    {
      id: '2',
      name: 'Fatima Zahra',
      email: 'fatima.zahra@example.com',
      phone: '+212 6 23 45 67 89',
      company: 'Marché Central',
      password: 'Fz8h2r4a',
      createdAt: Timestamp.fromDate(new Date('2024-01-10')),
      lastVisit: Timestamp.fromDate(new Date('2024-01-18')),
      createdBy: 'Manager',
      lastModifiedBy: 'Manager',
      lastModifiedAt: Timestamp.fromDate(new Date('2024-01-18')),
    },
    {
      id: '3',
      name: 'Mohammed Alami',
      email: 'mohammed.alami@example.com',
      phone: '+212 6 34 56 78 90',
      company: 'Distributions Alami',
      password: 'Mh5l8m2i',
      createdAt: Timestamp.fromDate(new Date('2024-01-05')),
      lastVisit: Timestamp.fromDate(new Date('2024-01-19')),
      createdBy: 'Admin',
      lastModifiedBy: 'Admin',
      lastModifiedAt: Timestamp.fromDate(new Date('2024-01-19')),
    },
    {
      id: '4',
      name: 'Aicha Mansouri',
      email: 'aicha.mansouri@example.com',
      phone: '+212 6 45 67 89 01',
      company: 'Super Marché Aicha',
      password: 'Ac7m9s3r',
      createdAt: Timestamp.fromDate(new Date('2024-01-12')),
      lastVisit: Timestamp.fromDate(new Date('2024-01-17')),
      createdBy: 'Manager',
      lastModifiedBy: 'Admin',
      lastModifiedAt: Timestamp.fromDate(new Date('2024-01-17')),
    },
    {
      id: '5',
      name: 'Hassan Tazi',
      email: 'hassan.tazi@example.com',
      phone: '+212 6 56 78 90 12',
      company: 'Tazi Distribution',
      password: 'Hs6t4z8i',
      createdAt: Timestamp.fromDate(new Date('2024-01-08')),
      lastVisit: Timestamp.fromDate(new Date('2024-01-16')),
      createdBy: 'Admin',
      lastModifiedBy: 'Manager',
      lastModifiedAt: Timestamp.fromDate(new Date('2024-01-16')),
    },
  ];

  // Fonction pour migrer les clients de la collection globale vers le tenant
  const migrateClientsToTenant = async (globalDocs: any[]) => {
    if (!tenantId) throw new Error('No tenant ID');
    
    const tenantClientsRef = collection(db, 'tenants', tenantId, 'clients');
    
    for (const doc of globalDocs) {
      try {
        const data = doc.data();
        await addDoc(tenantClientsRef, {
          name: data.name || 'Unknown',
          email: data.email || '',
          phone: data.phone || '',
          company: data.company || '',
          password: data.password || generateClientPassword(),
          createdAt: data.createdAt || Timestamp.fromDate(new Date()),
          lastVisit: data.lastVisit || null,
          createdBy: data.createdBy || 'Système',
          lastModifiedBy: data.lastModifiedBy || data.createdBy || 'Système',
          lastModifiedAt: data.lastModifiedAt || data.createdAt || Timestamp.fromDate(new Date()),
          // Ajouter le tenantId pour référence
          originalTenantId: data.tenantId || 'unknown',
          migratedAt: new Date(),
        });
        console.log(`Migrated client: ${data.name || doc.id}`);
      } catch (error) {
        console.error(`Error migrating client ${doc.id}:`, error);
      }
    }
    
    console.log(`Migration completed: ${globalDocs.length} clients migrated to tenant collection`);
  };

  // Fonction pour créer des clients de test dans Firestore
  const createTestClientsInFirestore = async () => {
    if (!tenantId) throw new Error('No tenant ID');
    
    const clientsRef = collection(db, 'tenants', tenantId, 'clients');
    const mockClients = getMockClients();
    
    for (const client of mockClients) {
      try {
        await addDoc(clientsRef, {
          name: client.name,
          email: client.email,
          phone: client.phone,
          company: client.company,
          password: client.password || generateClientPassword(),
          createdAt: client.createdAt,
          lastVisit: client.lastVisit || null,
          createdBy: client.createdBy || 'Système',
          lastModifiedBy: client.lastModifiedBy || client.createdBy || 'Système',
          lastModifiedAt: client.lastModifiedAt || client.createdAt,
        });
        console.log(`Created client in Firestore: ${client.name}`);
      } catch (error) {
        console.error(`Error creating client ${client.name}:`, error);
      }
    }
  };

  const { data: clients, isLoading, error, refetch } = useQuery({
    queryKey: ['clients', tenantId],
    queryFn: async (): Promise<Client[]> => {
      if (!tenantId) {
        console.warn('No tenant ID available for clients query');
        return [];
      }
      
      try {
        console.log('Fetching clients for tenant:', tenantId);
        
        // Use tenant-specific subcollection (recommended for SaaS)
        const q = query(collection(db, 'tenants', tenantId, 'clients'));
        const querySnapshot = await getDocs(q);
        
        const clientsData = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || 'Unknown',
            email: data.email || '',
            phone: data.phone || '',
            company: data.company || '',
            password: data.password,
            createdAt: data.createdAt || Timestamp.fromDate(new Date()),
            lastVisit: data.lastVisit,
            createdBy: data.createdBy || 'Système',
            lastModifiedBy: data.lastModifiedBy,
            lastModifiedAt: data.lastModifiedAt?.toDate(),
          };
        });
        
        console.log('Clients loaded:', clientsData.length, 'clients');
        return clientsData;
      } catch (error) {
        console.error('Error fetching clients:', error);
        // Return empty array instead of mock data to avoid confusion
        return [];
      }
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh longer
    cacheTime: 10 * 60 * 1000, // 10 minutes - keep in cache longer
    retry: 1, // Reduce retries to 1
    retryDelay: 1000, // Reduce delay between retries
    refetchOnWindowFocus: false, // Don't refetch when window gains focus
    refetchOnMount: false, // Don't refetch on component mount if data exists
  });

  const addClientMutation = useMutation({
    mutationFn: async (payload: { name: string; email: string; phone?: string; company?: string; password?: string }) => {
      if (!tenantId) throw new Error('No tenant ID');
      
      const ref = collection(db, 'tenants', tenantId, 'clients');
      const docRef = await addDoc(ref, {
        name: payload.name,
        email: payload.email,
        phone: payload.phone || '',
        company: payload.company || '',
        password: payload.password || generateClientPassword(),
        tenantId,
        createdAt: Timestamp.fromDate(new Date()),
        lastVisit: null,
        createdBy: getCurrentUserName(),
        lastModifiedBy: getCurrentUserName(),
        lastModifiedAt: Timestamp.fromDate(new Date()),
      });
      
      return docRef.id; // Return the created client ID
    },
    onSuccess: async (clientId) => {
      console.log('Client added successfully with ID:', clientId);
      await queryClient.invalidateQueries({ queryKey: ['clients', tenantId] });
      setIsAdding(false);
      setForm({ name: '', email: '', phone: '', company: '', password: '' });
      // Log the action with current user info
      await logWithCurrentUser('create', 'client', clientId, `Client créé: ${form.name} (Email: ${form.email})`);
    },
    onError: (error) => {
      console.error('Error adding client:', error);
      alert('Erreur lors de l\'ajout du client. Veuillez réessayer.');
    },
  });

  const updateClientMutation = useMutation({
    mutationFn: async (payload: { id: string; name: string; email: string; phone?: string; company?: string; password?: string }) => {
      if (!tenantId) throw new Error('No tenant ID');
      
      const clientRef = doc(db, 'tenants', tenantId, 'clients', payload.id);
      await updateDoc(clientRef, {
        name: payload.name,
        email: payload.email,
        phone: payload.phone || '',
        company: payload.company || '',
        password: payload.password || '',
        lastModifiedBy: getCurrentUserName(),
        lastModifiedAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date()),
      });
    },
    onSuccess: async () => {
      console.log('Client updated successfully');
      await queryClient.invalidateQueries({ queryKey: ['clients', tenantId] });
      setEditingClient(null);
      setForm({ name: '', email: '', phone: '', company: '', password: '' });
      // Log the action with current user info
      await logWithCurrentUser('update', 'client', editingClient?.id, `Client modifié: ${form.name} (Email: ${form.email})`);
    },
    onError: (error) => {
      console.error('Error updating client:', error);
      alert('Erreur lors de la modification du client. Veuillez réessayer.');
    },
  });

  const deleteClientMutation = useMutation({
    mutationFn: async (clientId: string) => {
      if (!tenantId) throw new Error('No tenant ID');
      
      const clientRef = doc(db, 'tenants', tenantId, 'clients', clientId);
      await deleteDoc(clientRef);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['clients', tenantId] });
      setDeletingClient(null);
      // Log the action with current user info
      await logWithCurrentUser('delete', 'client', deletingClient?.id, `Client supprimé: ${deletingClient?.name} (Email: ${deletingClient?.email})`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submission:', { form, editingClient, isAdding });
    
    if (form.name && form.email) {
      if (editingClient) {
        console.log('Updating client:', editingClient.id);
        updateClientMutation.mutate({
          id: editingClient.id,
          name: form.name,
          email: form.email,
          phone: form.phone,
          company: form.company,
          password: form.password,
        });
      } else {
        console.log('Adding new client');
        addClientMutation.mutate({
          name: form.name,
          email: form.email,
          phone: form.phone,
          company: form.company,
          password: form.password,
        });
      }
    } else {
      console.warn('Form validation failed:', { name: form.name, email: form.email });
    }
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setShowFormPassword(false);
    setForm({
      name: client.name,
      email: client.email,
      phone: client.phone || '',
      company: client.company || '',
      password: client.password || '',
    });
  };

  const cancelEdit = () => {
    setEditingClient(null);
    setIsAdding(false);
    setShowFormPassword(false);
    setForm({ name: '', email: '', phone: '', company: '', password: '' });
  };

  const handleDelete = (client: Client) => {
    setDeletingClient(client);
  };

  const confirmDelete = () => {
    if (deletingClient) {
      deleteClientMutation.mutate(deletingClient.id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <Spinner size="lg" className="mx-auto mb-4" />
          <p className="text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        <p className="font-medium">Error loading clients:</p>
        <p>{error instanceof Error ? error.message : 'Unknown error'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-sm md:text-base">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">{t('clients.title')}</h1>
        <div className="flex items-center justify-between">
          <p className="text-gray-600">{t('clients.subtitle', 'Manage your client information')}</p>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsAdding((v) => !v)}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M12 4.5a.75.75 0 01.75.75V11h5.75a.75.75 0 010 1.5H12.75v5.75a.75.75 0 01-1.5 0V12.5H5.5a.75.75 0 010-1.5h5.75V5.25A.75.75 0 0112 4.5z" clipRule="evenodd" /></svg>
              {t('clients.addClient', 'Add Client')}
            </button>
          </div>
        </div>
      </div>



      <Card>
        <div className="overflow-x-auto">
          <Table className="min-w-full text-xs">
          <TableHead>
              <TableRow className="bg-gray-50">
                <TableHeader className="px-3 py-2 text-center font-semibold text-gray-700">{t('clients.actions')}</TableHeader>
                <TableHeader className="px-3 py-2 text-left font-semibold text-gray-700">{t('clients.name')}</TableHeader>
                <TableHeader className="px-3 py-2 text-left font-semibold text-gray-700">{t('clients.email', 'Email')}</TableHeader>
                <TableHeader className="px-3 py-2 text-left font-semibold text-gray-700">{t('clients.phone', 'Phone')}</TableHeader>
                <TableHeader className="px-3 py-2 text-left font-semibold text-gray-700">{t('clients.company', 'Company')}</TableHeader>
                <TableHeader className="px-3 py-2 text-center font-semibold text-gray-700">{t('clients.password')}</TableHeader>
                <TableHeader className="px-3 py-2 text-center font-semibold text-gray-700">{t('clients.createdBy')}</TableHeader>
                <TableHeader className="px-3 py-2 text-center font-semibold text-gray-700">{t('clients.modifiedBy')}</TableHeader>
                <TableHeader className="px-3 py-2 text-center font-semibold text-gray-700">{t('clients.created', 'Created')}</TableHeader>
                <TableHeader className="px-3 py-2 text-center font-semibold text-gray-700">{t('clients.lastVisit')}</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {clients && clients.length > 0 ? (
              clients.map((client) => (
                  <TableRow key={client.id} className="hover:bg-gray-50 border-b border-gray-200">
                    <TableCell className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <button
                          onClick={() => handleEdit(client)}
                          className="text-blue-600 hover:text-blue-800 p-1"
                          title={t('clients.edit')}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => printClientTicket(client)}
                          className="text-green-600 hover:text-green-800 p-1"
                          title="Imprimer le ticket thermique"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => sendClientInfoWhatsApp(client)}
                          className={`p-1 ${client.phone ? 'text-green-500 hover:text-green-700' : 'text-gray-400 cursor-not-allowed'}`}
                          title={client.phone ? t('clients.whatsapp') : t('clients.phoneRequired')}
                          disabled={!client.phone}
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(client)}
                          className="text-red-600 hover:text-red-800 p-1"
                          title={t('clients.delete')}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-2 font-medium text-gray-900 truncate max-w-[200px]">
                      <span title={client.name}>{client.name}</span>
                    </TableCell>
                    <TableCell className="px-3 py-2 text-gray-600 text-xs truncate max-w-[150px]">
                      <span title={client.email}>{client.email}</span>
                    </TableCell>
                    <TableCell className="px-3 py-2 text-gray-600 font-mono text-xs">
                      {client.phone || '-'}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-gray-600 truncate max-w-[100px]">
                      <span title={client.company || ''}>{client.company || '-'}</span>
                    </TableCell>
                    <TableCell className="px-3 py-2 text-center text-gray-500 text-xs">
                      <div className="flex items-center justify-center space-x-1">
                        <span 
                          title={client.password || 'Non généré'} 
                          className="font-mono break-all"
                        >
                          {client.password ? (
                            visiblePasswords.has(client.id) ? client.password : '••••••••'
                          ) : '-'}
                        </span>
                        {client.password && (
                          <>
                            <button
                              onClick={() => togglePasswordVisibility(client.id)}
                              className="text-blue-600 hover:text-blue-800 p-1"
                              title={visiblePasswords.has(client.id) ? 'Masquer' : 'Révéler'}
                            >
                              {visiblePasswords.has(client.id) ? '👁️' : '👁️‍🗨️'}
                            </button>
                            <button
                              onClick={() => regeneratePassword(client.id)}
                              className="text-green-600 hover:text-green-800 p-1"
                              title="Régénérer le mot de passe"
                            >
                              🔄
                            </button>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-2 text-center text-gray-500 text-xs">
                      <span title={client.createdBy || 'Système'} className="truncate max-w-[80px] block">
                        {client.createdBy || 'Système'}
                      </span>
                    </TableCell>
                    <TableCell className="px-3 py-2 text-center text-gray-500 text-xs">
                      <span title={client.lastModifiedBy || 'Non modifié'} className="truncate max-w-[80px] block">
                        {client.lastModifiedBy || '-'}
                      </span>
                    </TableCell>
                    <TableCell className="px-3 py-2 text-center text-gray-500 text-xs">
                      {formatTimestamp(client.createdAt)}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-center text-gray-500 text-xs">
                      {formatTimestamp(client.lastVisit)}
                    </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-gray-500 text-sm">
                  {t('clients.noClients')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </div>
      </Card>
      {/* Modal de confirmation de suppression */}
      {deletingClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirmer la suppression</h3>
            <p className="text-gray-600 mb-6">
              Êtes-vous sûr de vouloir supprimer le client <strong>{deletingClient.name}</strong> ?
              Cette action est irréversible.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeletingClient(null)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                {t('clients.cancel')}
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteClientMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {deleteClientMutation.isPending ? t('clients.deleting') : t('clients.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Formulaire d'ajout/édition */}
      {(isAdding || editingClient) && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4"
          onClick={cancelEdit}
        >
          <div 
            className="bg-white rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-md sm:max-w-lg mx-2 sm:mx-4 max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 sm:px-6 py-3 sm:py-4 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm sm:text-lg">👤</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg sm:text-xl font-bold text-white truncate">
                      {editingClient ? t('clients.editClient') : t('clients.newClient')}
                    </h3>
                    <p className="text-blue-100 text-xs sm:text-sm truncate">
                      {editingClient ? t('clients.editClientSubtitle') : t('clients.addNewClientSubtitle')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={cancelEdit}
                  className="w-7 h-7 sm:w-8 sm:h-8 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center text-white transition-colors flex-shrink-0 ml-2"
                  title="Fermer"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Form Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                {/* Nom */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    {t('clients.fullName')} *
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg sm:rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm sm:text-base"
                    placeholder="Entrez le nom complet"
                    required
                  />
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    {t('clients.emailRequired')}
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg sm:rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm sm:text-base"
                    placeholder="client@exemple.com"
                    required
                  />
                </div>

                {/* Téléphone */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    {t('clients.phone')}
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg sm:rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm sm:text-base"
                    placeholder="06 12 34 56 78"
                  />
                </div>

                {/* Entreprise */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    {t('clients.company')}
                  </label>
                  <input
                    type="text"
                    value={form.company}
                    onChange={(e) => setForm(prev => ({ ...prev, company: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg sm:rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm sm:text-base"
                    placeholder="Nom de l'entreprise"
                  />
                </div>

                {/* Mot de passe */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Mot de passe
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <input
                        type={showFormPassword ? "text" : "password"}
                        value={form.password}
                        onChange={(e) => setForm(prev => ({ ...prev, password: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg sm:rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 pr-10 sm:pr-12 font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm sm:text-base"
                        placeholder="Généré automatiquement"
                      />
                      <button
                        type="button"
                        onClick={() => setShowFormPassword(!showFormPassword)}
                        className="absolute right-2 sm:right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                        title={showFormPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                      >
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {showFormPassword ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          )}
                        </svg>
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, password: generateClientPassword() }))}
                      className="px-2 sm:px-3 py-2.5 sm:py-3 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg sm:rounded-xl transition-colors flex-shrink-0"
                      title="Régénérer le mot de passe"
                    >
                      <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">
                    {editingClient 
                      ? t('clients.passwordRegeneration') 
                      : t('clients.passwordGeneration')
                    }
                  </p>
                </div>
              </form>
            </div>

            {/* Footer - Fixed at bottom */}
            <div className="bg-gray-50 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 flex-shrink-0">
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:justify-end">
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="w-full sm:w-auto px-4 sm:px-6 py-2.5 text-gray-600 hover:text-gray-800 font-medium transition-colors rounded-lg sm:rounded-xl border border-gray-300 hover:border-gray-400 sm:border-0"
                >
                  {t('clients.cancel')}
                </button>
                <button
                  type="submit"
                  onClick={handleSubmit}
                  disabled={addClientMutation.isPending || updateClientMutation.isPending}
                  className="w-full sm:w-auto px-4 sm:px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-lg sm:rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
                >
                  {addClientMutation.isPending || updateClientMutation.isPending ? (
                    <div className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Enregistrement...
                    </div>
                  ) : (
                    editingClient ? t('clients.editClientAction') : t('clients.addClientAction')
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
