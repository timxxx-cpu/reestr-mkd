import { supabase } from './supabase';
import { BffClient } from './bff-client'; // <-- ДОБАВЛЕНО
import { trackOperationSource } from './operation-source-tracker'; // <-- ДОБАВЛЕНО

// Вспомогательная функция для трекинга
const trackLegacyPath = operation => {
  trackOperationSource({ source: 'legacy', operation });
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
    // <-- ДОБАВЛЕНО: Перехват BFF
    if (BffClient.isCatalogsEnabled?.()) {
      return BffClient.getCatalog({ table });
    }

    trackLegacyPath(`getCatalog:${table}`); // <-- ДОБАВЛЕНО: Трекинг

    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('label', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async getCatalogAll(table) {
    // <-- ДОБАВЛЕНО: Перехват BFF
    if (BffClient.isCatalogsEnabled?.()) {
      return BffClient.getCatalogAll({ table });
    }

    trackLegacyPath(`getCatalogAll:${table}`); // <-- ДОБАВЛЕНО: Трекинг

    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order('sort_order', { ascending: true })
      .order('label', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async upsertCatalogItem(table, item) {
    // Если нужно, мутации справочников тоже можно завернуть в BFF,
    // но обычно это чисто админская адхок-задача (P3), можно оставить пока так.
    trackLegacyPath(`upsertCatalogItem:${table}`);

    const payload = {
      ...item,
      id: item.id,
      code: item.code,
      label: item.label,
      sort_order: Number(item.sort_order || item.sortOrder || 100),
      is_active: item.is_active ?? item.isActive ?? true,
    };

    const { error } = await supabase.from(table).upsert(payload);
    if (error) throw error;
  },

  async setCatalogItemActive(table, id, isActive) {
    trackLegacyPath(`setCatalogItemActive:${table}`);
    const { error } = await supabase.from(table).update({ is_active: isActive }).eq('id', id);
    if (error) throw error;
  },
};