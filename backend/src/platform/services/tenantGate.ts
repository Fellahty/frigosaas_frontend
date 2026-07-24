import { resolveOrganization } from '../../middleware/tenantDb.js';
import type { IOrganization } from '../models/Organization.js';

export class TenantAccessError extends Error {
  constructor(
    message: string,
    public statusCode: number = 403
  ) {
    super(message);
    this.name = 'TenantAccessError';
  }
}

/** Vérifie qu'un tenant peut se connecter (registry, statut, essai). */
export async function assertTenantCanLogin(tenantIdOrSlug: string): Promise<IOrganization> {
  const org = await resolveOrganization(tenantIdOrSlug);

  if (!org) {
    throw new TenantAccessError('Ce frigo n\'est pas enregistré sur FrigoSmart. Contactez le support.', 403);
  }

  if (org.status === 'suspended') {
    throw new TenantAccessError('Ce frigo est suspendu. Contactez FrigoSmart pour réactiver votre compte.', 403);
  }

  if (org.status === 'cancelled') {
    throw new TenantAccessError('Ce compte frigo a été annulé.', 403);
  }

  if (org.status === 'trial' && org.trialEndsAt && org.trialEndsAt < new Date()) {
    throw new TenantAccessError('Votre période d\'essai est terminée. Contactez FrigoSmart pour souscrire.', 403);
  }

  return org;
}
