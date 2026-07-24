export * from './db';
export { storage, ref, uploadBytes, getDownloadURL } from './storage';

export const auth = {};

export const enableOfflinePersistence = async () => {
  console.log('Using REST API backend (MongoDB)');
};

export const setNetworkEnabled = async (_enabled: boolean) => {};

export default {};
