import { collection, addDoc, serverTimestamp } from '@/lib/db';
import { db } from './firebase';
import { useTenantId } from './hooks/useTenantId';
import { useCurrentUser } from './hooks/useCurrentUser';

export interface LogEntry {
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

export const logAction = async (
  action: string,
  resource: string,
  resourceId?: string,
  details?: string,
  userId: string = 'system',
  userName: string = 'Système'
) => {
  try {
    const tenantId =
      localStorage.getItem('tenantId') ||
      localStorage.getItem('tenantSlug')?.toUpperCase() ||
      'unknown';
    
    const logEntry: Omit<LogEntry, 'timestamp'> = {
      userId,
      userName,
      action,
      resource,
      resourceId: resourceId || null, // Convert undefined to null for Firestore
      details,
      tenantId,
      ipAddress: '127.0.0.1', // In a real app, this would be extracted from the request
      userAgent: navigator.userAgent,
    };

    await addDoc(collection(db, 'logs'), {
      ...logEntry,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error logging action:', error);
    // Don't throw error to avoid breaking the main functionality
  }
};

// Convenience functions for common actions
export const logCreate = (resource: string, resourceId?: string, details?: string, userId?: string, userName?: string) => {
  return logAction('create', resource, resourceId, details, userId, userName);
};

export const logUpdate = (resource: string, resourceId?: string, details?: string, userId?: string, userName?: string) => {
  return logAction('update', resource, resourceId, details, userId, userName);
};

export const logDelete = (resource: string, resourceId?: string, details?: string, userId?: string, userName?: string) => {
  return logAction('delete', resource, resourceId, details, userId, userName);
};

export const logLogin = (userId: string, userName: string) => {
  return logAction('login', 'user', userId, `User ${userName} logged in`, userId, userName);
};

export const logLogout = (userId: string, userName: string) => {
  return logAction('logout', 'user', userId, `User ${userName} logged out`, userId, userName);
};

// Enhanced logging functions that automatically get current user info
export const logClientAction = async (
  action: 'create' | 'update' | 'delete',
  clientId: string,
  clientName: string,
  additionalDetails?: string
) => {
  try {
    // Get current user info from localStorage or context
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const userId = currentUser.id || 'system';
    const userName = currentUser.name || 'Système';
    
    const details = additionalDetails || `${action === 'create' ? 'Création' : action === 'update' ? 'Modification' : 'Suppression'} du client "${clientName}"`;
    
    await logAction(action, 'client', clientId, details, userId, userName);
  } catch (error) {
    console.error('Error logging client action:', error);
  }
};

// Function to log any action with current user context
export const logWithCurrentUser = async (
  action: string,
  resource: string,
  resourceId?: string,
  details?: string
) => {
  try {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const userId = currentUser.id || 'system';
    const userName = currentUser.name || 'Système';
    
    await logAction(action, resource, resourceId, details, userId, userName);
  } catch (error) {
    console.error('Error logging action:', error);
  }
};
