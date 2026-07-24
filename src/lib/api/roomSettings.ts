/**
 * Room Settings API Service
 * 
 * This service provides methods to interact with room settings,
 * including the new chambre and capteur parameters.
 * 
 * Usage: Can be called from external systems or used internally
 * to manage room settings with sensor installation status.
 */

import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc, query, where } from '@/lib/db';
import { db } from '../firebase';

export interface RoomSettings {
  id?: string;
  tenantId: string;
  room: string;
  capacity: number;
  capacityCrates?: number;
  capacityPallets?: number;
  sensorId: string;
  active: boolean;
  capteurInstalled: boolean; // Whether sensor is installed in the room
  createdAt?: Date;
}

export interface RoomSettingsUpdate {
  room?: string;
  capacity?: number;
  capacityCrates?: number;
  capacityPallets?: number;
  sensorId?: string;
  active?: boolean;
  capteurInstalled?: boolean;
}

export class RoomSettingsAPI {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  /**
   * Get all rooms for the tenant
   */
  async getAllRooms(): Promise<RoomSettings[]> {
    try {
      const q = query(collection(db, 'rooms'), where('tenantId', '==', this.tenantId));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          capteurInstalled: data.capteurInstalled || false,
          createdAt: data.createdAt ? data.createdAt.toDate() : new Date()
        } as RoomSettings;
      });
    } catch (error) {
      console.error('Error fetching rooms:', error);
      throw new Error('Failed to fetch rooms');
    }
  }

  /**
   * Get a specific room by ID
   */
  async getRoom(roomId: string): Promise<RoomSettings | null> {
    try {
      const rooms = await this.getAllRooms();
      return rooms.find(room => room.id === roomId) || null;
    } catch (error) {
      console.error('Error fetching room:', error);
      throw new Error('Failed to fetch room');
    }
  }

  /**
   * Create a new room
   */
  async createRoom(roomData: Omit<RoomSettings, 'id' | 'tenantId' | 'createdAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'rooms'), {
        ...roomData,
        tenantId: this.tenantId,
        capteurInstalled: roomData.capteurInstalled || false,
        createdAt: new Date()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating room:', error);
      throw new Error('Failed to create room');
    }
  }

  /**
   * Update an existing room
   */
  async updateRoom(roomId: string, updates: RoomSettingsUpdate): Promise<void> {
    try {
      const roomRef = doc(db, 'rooms', roomId);
      await updateDoc(roomRef, updates);
    } catch (error) {
      console.error('Error updating room:', error);
      throw new Error('Failed to update room');
    }
  }

  /**
   * Delete a room
   */
  async deleteRoom(roomId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'rooms', roomId));
    } catch (error) {
      console.error('Error deleting room:', error);
      throw new Error('Failed to delete room');
    }
  }

  /**
   * Update sensor installation status for a room
   */
  async updateSensorInstallation(roomId: string, capteurInstalled: boolean): Promise<void> {
    await this.updateRoom(roomId, { capteurInstalled });
  }


  /**
   * Get rooms by sensor installation status
   */
  async getRoomsBySensorStatus(capteurInstalled: boolean): Promise<RoomSettings[]> {
    const allRooms = await this.getAllRooms();
    return allRooms.filter(room => room.capteurInstalled === capteurInstalled);
  }

  /**
   * Get rooms with sensors installed
   */
  async getRoomsWithSensors(): Promise<RoomSettings[]> {
    return this.getRoomsBySensorStatus(true);
  }

  /**
   * Get rooms without sensors installed
   */
  async getRoomsWithoutSensors(): Promise<RoomSettings[]> {
    return this.getRoomsBySensorStatus(false);
  }
}

/**
 * Factory function to create a RoomSettingsAPI instance
 */
export function createRoomSettingsAPI(tenantId: string): RoomSettingsAPI {
  return new RoomSettingsAPI(tenantId);
}

/**
 * Example usage for external API calls:
 * 
 * // Initialize the API
 * const roomAPI = createRoomSettingsAPI('your-tenant-id');
 * 
 * // Get all rooms
 * const rooms = await roomAPI.getAllRooms();
 * 
 * // Create a new room with sensor installation status
 * const newRoomId = await roomAPI.createRoom({
 *   room: 'CH1',
 *   capacity: 6000,
 *   capacityCrates: 6000,
 *   sensorId: 'S-CH1',
 *   active: true,
 *   capteurInstalled: true
 * });
 * 
 * // Update sensor installation status
 * await roomAPI.updateSensorInstallation(newRoomId, true);
 * 
 * // Get rooms with sensors installed
 * const roomsWithSensors = await roomAPI.getRoomsWithSensors();
 */
