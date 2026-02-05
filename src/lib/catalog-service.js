import { supabase } from './supabase';

export const CATALOG_TABLES = [
  'dict_project_statuses',
  'dict_application_statuses',
  'dict_external_systems',
  'dict_foundations',
  'dict_wall_materials',
  'dict_slab_types',
  'dict_roof_types',
  'dict_light_structure_types',
  'dict_parking_types',
  'dict_parking_construction_types',
  'dict_infra_types',
  'dict_mop_types',
  'dict_unit_types'
];

export const CatalogService = {
  async getCatalog(table) {
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
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order('sort_order', { ascending: true })
      .order('label', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async upsertCatalogItem(table, item) {
    const payload = {
      id: item.id,
      code: item.code,
      label: item.label,
      sort_order: Number(item.sort_order || item.sortOrder || 100),
      is_active: item.is_active ?? item.isActive ?? true
    };

    const { error } = await supabase.from(table).upsert(payload);
    if (error) throw error;
  },

  async setCatalogItemActive(table, id, isActive) {
    const { error } = await supabase.from(table).update({ is_active: isActive }).eq('id', id);
    if (error) throw error;
  }
};
