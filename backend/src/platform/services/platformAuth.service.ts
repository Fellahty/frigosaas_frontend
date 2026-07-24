import { PlatformUserModel } from '../models/PlatformUser.js';
import { comparePassword } from '../../utils/password.js';
import type { PlatformAuthUser } from '../../middleware/platformAuth.js';

export async function authenticatePlatformUser(
  email: string,
  password: string
): Promise<PlatformAuthUser | null> {
  const PlatformUser = PlatformUserModel();
  const user = await PlatformUser.findOne({ email: email.toLowerCase(), isActive: true }).select(
    '+password'
  );

  if (!user || !(await comparePassword(password, user.password))) {
    return null;
  }

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    scope: 'platform',
  };
}
