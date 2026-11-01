export const ROLES = ['STUDENT', 'COUNSELOR', 'TRAINER', 'ADMIN', 'SUPER_ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const STAFF_ROLES: Role[] = ['COUNSELOR', 'TRAINER', 'ADMIN', 'SUPER_ADMIN'];
export const ADMIN_ROLES: Role[] = ['ADMIN', 'SUPER_ADMIN'];

/** Which roles a given role may invite. Public sign-up only ever creates STUDENT. */
export function invitableRoles(role: Role): Role[] {
  if (role === 'SUPER_ADMIN') return ['COUNSELOR', 'TRAINER', 'ADMIN', 'SUPER_ADMIN'];
  if (role === 'ADMIN') return ['COUNSELOR', 'TRAINER'];
  return [];
}

export function homePathForRole(role: Role): string {
  switch (role) {
    case 'STUDENT': return '/dashboard';
    case 'COUNSELOR': return '/counselor';
    case 'TRAINER': return '/trainer';
    default: return '/admin';
  }
}
