import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const platformTestUri =
  process.env.PLATFORM_MONGODB_TEST_URI ||
  'mongodb://localhost:27017/frigosmart_platform_test';

const testDbUri =
  process.env.MONGODB_TEST_URI ||
  'mongodb://localhost:27017/frigosaas_test';

export async function teardown() {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  } catch {
    // ignore
  }

  try {
    const { disconnectPlatformDatabase } = await import('../src/config/platformDatabase.js');
    await disconnectPlatformDatabase();
  } catch {
    // ignore
  }

  await new Promise((r) => setTimeout(r, 300));

  const platformConn = await mongoose.createConnection(platformTestUri).asPromise();
  try {
    await platformConn.dropDatabase();
  } catch {
    // ignore
  } finally {
    await platformConn.close();
  }
}

export default teardown;
