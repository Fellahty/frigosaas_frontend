import { env } from './config/env.js';
import { connectDatabase } from './config/database.js';
import { connectPlatformDatabase } from './config/platformDatabase.js';
import { createApp } from './app.js';

async function bootstrap() {
  await connectDatabase();
  await connectPlatformDatabase();

  const app = createApp();

  app.listen(env.port, () => {
    console.log(`🚀 Frigo SaaS API running on http://localhost:${env.port}`);
    console.log(`   Health: http://localhost:${env.port}/api/health`);
    console.log(`   Admin:  http://localhost:${env.port}/api/admin`);
  });
}

bootstrap().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
