import type { PublicUser, UserInstance } from '../../types/models';

/**
 * Strip secrets and map role for JSON responses.
 */
export const toPublicUser = (user: UserInstance): PublicUser => ({
  id: user.id,
  email: user.email,
  first_name: user.first_name,
  last_name: user.last_name,
  role: user.Role ? user.Role.name : undefined,
});
