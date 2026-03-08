import { AuthService } from './auth-service';
import { ROLE_IDS, ROLE_KEYS, getRoleId, getRoleKey, normalizeUserRole } from './roles';

export const getCurrentUserProfile = () => normalizeUserRole(AuthService.getCurrentUser?.() || null);

export const resolveActor = (actor = {}) => {
  const currentUser = getCurrentUserProfile();

  return {
    userName:
      actor.userName ||
      actor.name ||
      currentUser?.name ||
      currentUser?.displayName ||
      currentUser?.email ||
      currentUser?.id ||
      'unknown',
    userRoleId:
      getRoleId(actor.userRoleId ?? actor.roleId ?? actor.userRole ?? actor.role ?? currentUser) ||
      ROLE_IDS.TECHNICIAN,
    userRole:
      getRoleKey(actor.userRole ?? actor.role ?? actor.userRoleId ?? actor.roleId ?? currentUser) ||
      ROLE_KEYS.TECHNICIAN,
  };
};

export const getActorFromProfile = profile =>
  resolveActor({
    userName: profile?.name,
    userRoleId: profile?.roleId,
    userRole: profile?.role,
  });

export const getCurrentActor = () => resolveActor();
