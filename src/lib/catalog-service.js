import { BffClient } from './bff-client';
import { AuthService } from './auth-service';
import { ROLE_IDS, getRoleId, getRoleKey } from './roles';

const resolveActor = () => {
  const currentUser = AuthService.getCurrentUser?.() || null;

  return {
    userName: currentUser?.name || currentUser?.displayName || currentUser?.email || currentUser?.id || 'unknown',
    userRoleId: getRoleId(currentUser?.roleId ?? currentUser?.role) || ROLE_IDS.TECHNICIAN,
    userRole: getRoleKey(currentUser?.role ?? currentUser?.roleId) || 'technician',
  };
};

export const CATALOG_TABLES = [
  'dict_project_statuses',
  'dict_application_statuses',
  'dict_external_systems',
  // ... ваши справочники
  'dict_room_types',
];

export const CatalogService = {
  async getCatalog(table) {
    return BffClient.getCatalog({ table });
  },

  async getCatalogAll(table) {
    return BffClient.getCatalogAll({ table });
  },

  async upsertCatalogItem(table, item) {
    const resolvedActor = resolveActor();
    return BffClient.upsertCatalogItem({
      table,
      item,
      userName: resolvedActor.userName,
      userRoleId: resolvedActor.userRoleId,
      userRole: resolvedActor.userRole,
    });
  },

  async setCatalogItemActive(table, id, isActive) {
    const resolvedActor = resolveActor();
    return BffClient.setCatalogItemActive({
      table,
      id,
      isActive,
      userName: resolvedActor.userName,
      userRoleId: resolvedActor.userRoleId,
      userRole: resolvedActor.userRole,
    });
  },
};
