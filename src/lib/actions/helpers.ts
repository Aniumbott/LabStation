import { prisma } from '@/lib/prisma';
import type { RoleName } from '@/types';

export interface VerifiedUser {
  id: string;
  name: string;
  email: string;
  role: RoleName;
  status: string;
}

/**
 * Verifies a caller's identity and role from the database (tamper-proof).
 * Throws if the user doesn't exist, is inactive, or lacks the required role.
 */
export async function verifyUserRole(
  callerUserId: string,
  requiredRoles: RoleName[]
): Promise<VerifiedUser> {
  if (!callerUserId) {
    throw new Error('Authentication required.');
  }

  const user = await prisma.user.findUnique({
    where: { id: callerUserId },
  });

  if (!user) {
    throw new Error('User not found.');
  }

  if (user.status !== 'active') {
    throw new Error('User account is not active.');
  }

  if (!requiredRoles.includes(user.role as RoleName)) {
    throw new Error('Insufficient permissions.');
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as RoleName,
    status: user.status,
  };
}
