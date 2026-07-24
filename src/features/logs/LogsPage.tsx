import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, query, orderBy, limit, getDocs } from '@/lib/db';
import { useTranslation } from 'react-i18next';
import { db } from '../../lib/firebase';
import { useTenantId } from '../../lib/hooks/useTenantId';
import { Card } from '../../components/Card';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../../components/Table';
import { Spinner } from '../../components/Spinner';

interface LogEntry {
  id: string;
  userId: string;
  userName: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: string;
  ipAddress?: string;
  userAgent?: string;
  tenantId: string;
  timestamp: any;
}

export const LogsPage: React.FC = () => {
  const { t } = useTranslation();
  const tenantId = useTenantId();

  const { data: logs, isLoading, error } = useQuery({
    queryKey: ['logs', tenantId],
    queryFn: async (): Promise<LogEntry[]> => {
      if (!tenantId) {
        console.warn('No tenant ID available for logs query');
        return [];
      }
      
      try {
        console.log('Fetching logs for tenant:', tenantId);
        
        const logsRef = collection(db, 'logs');
        const q = query(logsRef, orderBy('timestamp', 'desc'), limit(100));
        const querySnapshot = await getDocs(q);
        
        const logsData = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            userId: data.userId || 'unknown',
            userName: data.userName || 'Unknown User',
            action: data.action || 'unknown',
            resource: data.resource || 'unknown',
            resourceId: data.resourceId,
            details: data.details || '',
            ipAddress: data.ipAddress || 'unknown',
            userAgent: data.userAgent || 'unknown',
            tenantId: data.tenantId || 'unknown',
            timestamp: data.timestamp,
          };
        });
        
        console.log(`Logs loaded: ${logsData.length} entries`);
        return logsData;
      } catch (error) {
        console.error('Error fetching logs:', error);
        return [];
      }
    },
    enabled: !!tenantId,
    staleTime: 30 * 1000, // 30 seconds
    cacheTime: 5 * 60 * 1000, // 5 minutes
    retry: 3,
    retryDelay: 1000,
  });

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return '-';
    
    try {
      // Handle Firestore timestamp
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return '-';
    }
  };

  const getActionColor = (action: string) => {
    switch (action.toLowerCase()) {
      case 'create':
        return 'bg-green-100 text-green-800';
      case 'update':
        return 'bg-blue-100 text-blue-800';
      case 'delete':
        return 'bg-red-100 text-red-800';
      case 'login':
        return 'bg-purple-100 text-purple-800';
      case 'logout':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getActionLabel = (action: string) => {
    switch (action.toLowerCase()) {
      case 'create':
        return 'Création';
      case 'update':
        return 'Modification';
      case 'delete':
        return 'Suppression';
      case 'login':
        return 'Connexion';
      case 'logout':
        return 'Déconnexion';
      default:
        return action;
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
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <p className="text-red-600 mb-4">Erreur lors du chargement des logs</p>
          <p className="text-gray-600 text-sm">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-sm md:text-base">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Journal des activités</h1>
        <p className="text-gray-600">Historique des actions effectuées dans le système</p>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHead>
              <TableRow className="bg-gray-50">
                <TableHeader className="px-3 py-2 text-left font-semibold text-gray-700">Date/Heure</TableHeader>
                <TableHeader className="px-3 py-2 text-left font-semibold text-gray-700">Utilisateur</TableHeader>
                <TableHeader className="px-3 py-2 text-left font-semibold text-gray-700">Action</TableHeader>
                <TableHeader className="px-3 py-2 text-left font-semibold text-gray-700">Ressource</TableHeader>
                <TableHeader className="px-3 py-2 text-left font-semibold text-gray-700">Détails</TableHeader>
                <TableHeader className="px-3 py-2 text-left font-semibold text-gray-700">IP</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {logs && logs.length > 0 ? (
                logs.map((log) => (
                  <TableRow key={log.id} className="hover:bg-gray-50 border-b border-gray-200">
                    <TableCell className="px-3 py-2 text-gray-600 text-xs">
                      {formatTimestamp(log.timestamp)}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-gray-900 font-medium">
                      <div>
                        <div className="font-medium">{log.userName}</div>
                        <div className="text-xs text-gray-500">ID: {log.userId}</div>
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>
                        {getActionLabel(log.action)}
                      </span>
                    </TableCell>
                    <TableCell className="px-3 py-2 text-gray-600">
                      <div>
                        <div className="font-medium">{log.resource}</div>
                        {log.resourceId && (
                          <div className="text-xs text-gray-500">ID: {log.resourceId}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-2 text-gray-600 max-w-xs">
                      <div className="truncate" title={log.details}>
                        {log.details || '-'}
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-2 text-gray-500 text-xs">
                      {log.ipAddress || '-'}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500 text-sm">
                    Aucun log trouvé
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
};