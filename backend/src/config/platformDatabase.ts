import mongoose from 'mongoose';
import { env } from './env.js';
import { mongoPoolOptions } from './mongoOptions.js';

let platformConnection: mongoose.Connection | null = null;

export async function connectPlatformDatabase(): Promise<mongoose.Connection> {
  if (platformConnection?.readyState === 1) {
    return platformConnection;
  }

  const uri =
    process.env.PLATFORM_MONGODB_URI ||
    env.platformMongodbUri;

  platformConnection = await mongoose.createConnection(uri, mongoPoolOptions).asPromise();
  console.log(`✅ Platform DB connected: ${uri}`);
  return platformConnection;
}

export function getPlatformConnection(): mongoose.Connection {
  if (!platformConnection || platformConnection.readyState !== 1) {
    throw new Error('Platform database not connected');
  }
  return platformConnection;
}

export async function disconnectPlatformDatabase(): Promise<void> {
  if (platformConnection) {
    await platformConnection.close();
    platformConnection = null;
  }
}
