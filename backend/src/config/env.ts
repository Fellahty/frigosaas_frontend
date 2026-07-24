import dotenv from 'dotenv';

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getPlatformJwtSecret(): string {
  return (
    process.env.PLATFORM_JWT_SECRET ||
    (process.env.JWT_SECRET ? `${process.env.JWT_SECRET}-platform` : 'dev-platform-secret')
  );
}

export const env = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  mongodbUri: required('MONGODB_URI', 'mongodb://localhost:27017/frigosaas'),
  platformMongodbUri: process.env.PLATFORM_MONGODB_URI || 'mongodb://localhost:27017/frigosmart_platform',
  mongodbBaseUri: process.env.MONGODB_BASE_URI || 'mongodb://localhost:27017',
  get jwtSecret() {
    return required('JWT_SECRET', 'dev-secret-change-in-production');
  },
  get platformJwtSecret() {
    return getPlatformJwtSecret();
  },
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  platformJwtExpiresIn: process.env.PLATFORM_JWT_EXPIRES_IN || '8h',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  defaultTenantId: process.env.DEFAULT_TENANT_ID || 'YAZAMI',
  requireTenantRegistry:
    process.env.REQUIRE_TENANT_REGISTRY === 'true' || process.env.NODE_ENV === 'production',
};
