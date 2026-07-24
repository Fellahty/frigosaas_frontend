import { apiUpload } from './api/client';

export const storage = {};

const urlCache = new Map<string, string>();

export interface StorageRef {
  path: string;
}

export function ref(_storage: unknown, storagePath: string): StorageRef {
  return { path: storagePath };
}

export async function uploadBytes(
  storageRef: StorageRef,
  file: Blob | File
): Promise<{ ref: StorageRef }> {
  const fileObj = file instanceof File ? file : new File([file], 'upload.bin');
  const parts = storageRef.path.split('/');
  parts.pop();
  const dir = parts.join('/') || 'uploads';
  const url = await apiUpload(fileObj, dir);
  urlCache.set(storageRef.path, url);
  return { ref: storageRef };
}

export async function getDownloadURL(storageRef: StorageRef): Promise<string> {
  if (urlCache.has(storageRef.path)) {
    return urlCache.get(storageRef.path)!;
  }
  const base = import.meta.env.VITE_API_URL?.replace('/api', '') || '';
  return urlCache.get(storageRef.path) || `${base}/uploads/${storageRef.path}`;
}
