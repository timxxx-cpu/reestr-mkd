import { supabase } from '../supabase';
import { VERSION_STATUS } from '../constants';

const getMaxVersionNumber = async (entityType, entityId) => {
  const { data, error } = await supabase
    .from('object_versions')
    .select('version_number')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.version_number || 0;
};

export const VersionsApi = {
  getVersions: async (entityType, entityId) => {
    const { data, error } = await supabase
      .from('object_versions')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('version_number', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  createVersion: async (entityType, entityId, snapshotData, payload = {}) => {
    const nextVersion = (await getMaxVersionNumber(entityType, entityId)) + 1;

    // Гарантия единственной версии IN_WORK на объект: прошлую переводим в ARCHIVED
    const { error: archiveInWorkError } = await supabase
      .from('object_versions')
      .update({ version_status: VERSION_STATUS.PREVIOUS, updated_at: new Date().toISOString() })
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .eq('version_status', VERSION_STATUS.PENDING);
    if (archiveInWorkError) throw archiveInWorkError;

    const { data, error } = await supabase
      .from('object_versions')
      .insert({
        entity_type: entityType,
        entity_id: entityId,
        version_number: nextVersion,
        version_status: VERSION_STATUS.PENDING,
        snapshot_data: snapshotData || {},
        created_by: payload.createdBy || null,
        application_id: payload.applicationId || null,
      })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  approveVersion: async (versionId, approvedBy = null) => {
    const { data: current, error: currentErr } = await supabase
      .from('object_versions')
      .select('*')
      .eq('id', versionId)
      .single();
    if (currentErr) throw currentErr;

    const { error: archiveErr } = await supabase
      .from('object_versions')
      .update({ version_status: VERSION_STATUS.PREVIOUS, updated_at: new Date().toISOString() })
      .eq('entity_type', current.entity_type)
      .eq('entity_id', current.entity_id)
      .eq('version_status', VERSION_STATUS.CURRENT)
      .neq('id', versionId);
    if (archiveErr) throw archiveErr;

    const { data, error } = await supabase
      .from('object_versions')
      .update({
        version_status: VERSION_STATUS.CURRENT,
        approved_by: approvedBy,
        decline_reason: null,
        declined_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', versionId)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  declineVersion: async (versionId, reason, declinedBy = null) => {
    const { data, error } = await supabase
      .from('object_versions')
      .update({
        version_status: VERSION_STATUS.REJECTED,
        decline_reason: reason || null,
        declined_by: declinedBy,
        updated_at: new Date().toISOString(),
      })
      .eq('id', versionId)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  getVersionSnapshot: async versionId => {
    const { data, error } = await supabase
      .from('object_versions')
      .select('id, snapshot_data')
      .eq('id', versionId)
      .single();
    if (error) throw error;
    return data?.snapshot_data || {};
  },

  restoreVersion: async versionId => {
    const { data: current, error: currentErr } = await supabase
      .from('object_versions')
      .select('id, entity_type, entity_id')
      .eq('id', versionId)
      .single();
    if (currentErr) throw currentErr;

    const { error: archiveInWorkError } = await supabase
      .from('object_versions')
      .update({ version_status: VERSION_STATUS.PREVIOUS, updated_at: new Date().toISOString() })
      .eq('entity_type', current.entity_type)
      .eq('entity_id', current.entity_id)
      .eq('version_status', VERSION_STATUS.PENDING)
      .neq('id', versionId);
    if (archiveInWorkError) throw archiveInWorkError;

    const { data, error } = await supabase
      .from('object_versions')
      .update({ version_status: VERSION_STATUS.PENDING, updated_at: new Date().toISOString() })
      .eq('id', versionId)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },
};
