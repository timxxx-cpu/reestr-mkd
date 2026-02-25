import { BffClient } from './bff-client';
import { AuthService } from './auth-service';

const resolveActor = () => {
  const currentUser = AuthService.getCurrentUser?.() || null;

  return {
    userName: currentUser?.name || currentUser?.displayName || currentUser?.email || currentUser?.id || 'unknown',
    userRole: currentUser?.role || 'technician',
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
      userRole: resolvedActor.userRole,
    });
  },
};
