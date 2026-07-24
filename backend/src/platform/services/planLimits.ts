import type { IOrganization } from '../models/Organization.js';
import { getActiveConnection } from '../../middleware/tenantContext.js';
import { User } from '../../models/User.js';
import { Client } from '../../models/Client.js';

type LimitResource = 'rooms' | 'users' | 'clients';

const COLLECTION_MAP: Record<LimitResource, string> = {
  rooms: 'rooms',
  users: 'users',
  clients: 'clients',
};

const MAX_FIELD: Record<LimitResource, keyof IOrganization> = {
  rooms: 'maxRooms',
  users: 'maxUsers',
  clients: 'maxClients',
};

export async function assertWithinPlanLimit(org: IOrganization, resource: LimitResource): Promise<void> {
  const max = org[MAX_FIELD[resource]] as number;
  if (!max || max <= 0) return;

  const conn = getActiveConnection();
  const collection = COLLECTION_MAP[resource];

  let count: number;
  if (resource === 'users') {
    const UserModel = conn.models.User || conn.model('User', User.schema);
    count = await UserModel.countDocuments({ tenantId: org.legacyId, isActive: { $ne: false } });
  } else if (resource === 'clients') {
    const ClientModel = conn.models.Client || conn.model('Client', Client.schema);
    count = await ClientModel.countDocuments({ tenantId: org.legacyId });
  } else {
    count = await conn.db!.collection(collection).countDocuments({ tenantId: org.legacyId });
  }

  if (count >= max) {
    const labels: Record<LimitResource, string> = {
      rooms: 'chambres froid',
      users: 'utilisateurs',
      clients: 'clients finaux',
    };
    throw new Error(
      `Limite du plan ${org.plan} atteinte (${max} ${labels[resource]}). Passez à un plan supérieur.`
    );
  }
}
