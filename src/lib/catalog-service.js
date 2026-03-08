import { BffClient } from './bff-client';
import { getCurrentActor } from './actor';

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
    const resolvedActor = getCurrentActor();
    return BffClient.upsertCatalogItem({
      table,
      item,
      userName: resolvedActor.userName,
      userRoleId: resolvedActor.userRoleId,
      userRole: resolvedActor.userRole,
    });
  },

  async setCatalogItemActive(table, id, isActive) {
    const resolvedActor = getCurrentActor();
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
