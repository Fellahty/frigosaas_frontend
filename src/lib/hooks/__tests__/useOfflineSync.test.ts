import { renderHook, act } from '@testing-library/react';
import { useOfflineSync, useOfflineQuery, useOfflineMutation } from '../useOfflineSync';

// Mock db shim (replaces Firebase)
jest.mock('@/lib/db', () => ({
  db: {},
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(),
  onSnapshot: jest.fn(),
}));

jest.mock('../../firebase', () => ({
  db: {},
}));

describe('useOfflineSync', () => {
  beforeEach(() => {
    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });
  });

  it('should initialize with online status', () => {
    const { result } = renderHook(() => useOfflineSync());
    
    expect(result.current.syncStatus.isOnline).toBe(true);
    expect(result.current.syncStatus.isSyncing).toBe(false);
    expect(result.current.syncStatus.error).toBe(null);
  });

  it('should handle offline status', () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false,
    });

    const { result } = renderHook(() => useOfflineSync());
    
    expect(result.current.syncStatus.isOnline).toBe(false);
  });

  it('should update sync status', () => {
    const { result } = renderHook(() => useOfflineSync());
    
    act(() => {
      result.current.updateSyncStatus({
        isSyncing: true,
        lastSyncTime: new Date(),
      });
    });

    expect(result.current.syncStatus.isSyncing).toBe(true);
    expect(result.current.syncStatus.lastSyncTime).toBeInstanceOf(Date);
  });
});

describe('useOfflineQuery', () => {
  it('should handle query function errors gracefully', async () => {
    const mockQueryFn = jest.fn().mockRejectedValue(new Error('Query failed'));
    
    const { result } = renderHook(() =>
      useOfflineQuery(
        ['test'],
        mockQueryFn,
        undefined,
        { enabled: true }
      )
    );

    // Wait for the query to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.data).toBeUndefined();
  });

  it('should work with disabled queries', () => {
    const mockQueryFn = jest.fn();
    
    const { result } = renderHook(() =>
      useOfflineQuery(
        ['test'],
        mockQueryFn,
        undefined,
        { enabled: false }
      )
    );

    expect(mockQueryFn).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
  });
});

describe('useOfflineMutation', () => {
  it('should queue mutations when offline', async () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false,
    });

    const mockMutationFn = jest.fn();
    
    const { result } = renderHook(() =>
      useOfflineMutation(mockMutationFn, {
        retryOnReconnect: true,
      })
    );

    await act(async () => {
      await result.current.mutate({ test: 'data' });
    });

    expect(mockMutationFn).not.toHaveBeenCalled();
    expect(result.current.pendingMutations).toBe(1);
  });

  it('should execute mutations when online', async () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });

    const mockMutationFn = jest.fn().mockResolvedValue('success');
    
    const { result } = renderHook(() =>
      useOfflineMutation(mockMutationFn)
    );

    await act(async () => {
      await result.current.mutate({ test: 'data' });
    });

    expect(mockMutationFn).toHaveBeenCalledWith({ test: 'data' });
    expect(result.current.pendingMutations).toBe(0);
  });
});

// Test error boundaries and edge cases
describe('Error Handling', () => {
  it('should handle missing window object', () => {
    const originalWindow = global.window;
    // @ts-ignore
    delete global.window;

    const { result } = renderHook(() => useOfflineSync());
    
    expect(result.current.syncStatus.isOnline).toBe(true); // Default to online

    global.window = originalWindow;
  });

  it('should handle missing navigator object', () => {
    const originalNavigator = global.navigator;
    // @ts-ignore
    delete global.navigator;

    const { result } = renderHook(() => useOfflineSync());
    
    expect(result.current.syncStatus.isOnline).toBe(true); // Default to online

    global.navigator = originalNavigator;
  });
});
