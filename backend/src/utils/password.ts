import bcrypt from 'bcryptjs';

const BCRYPT_PREFIX = '$2';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(plain: string, stored: string): Promise<boolean> {
  if (stored.startsWith(BCRYPT_PREFIX)) {
    return bcrypt.compare(plain, stored);
  }
  // Support legacy plain-text passwords from Firebase migration
  return plain === stored;
}
