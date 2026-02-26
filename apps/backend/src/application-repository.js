/**
 * Слой доступа к данным для таблиц applications, application_history, application_steps, application_locks.
 * Изолирует SQL-запросы от HTTP-слоя — маршруты не работают с supabase напрямую.
 */

import { getStageStepRange } from './workflow-transitions.js';

export async function getApplication(supabase, applicationId) {
  const { data: appRow, error } = await supabase
    .from('applications')
    .select('id, status, workflow_substatus, current_step, current_stage')
    .eq('id', applicationId)
    .maybeSingle();

  if (error) return { ok: false, status: 500, code: 'DB_ERROR', message: error.message };
  if (!appRow) return { ok: false, status: 404, code: 'NOT_FOUND', message: 'Application not found' };

  return { ok: true, appRow };
}

export async function updateApplicationState(supabase, applicationId, transition) {
  const { data, error } = await supabase
    .from('applications')
    .update({
      status: transition.nextStatus,
      workflow_substatus: transition.nextSubstatus,
      current_step: transition.nextStepIndex,
      current_stage: transition.nextStage,
      updated_at: new Date().toISOString(),
    })
    .eq('id', applicationId)
    .select('id, status, workflow_substatus, current_step, current_stage')
    .single();

  if (error) return { ok: false, status: 500, code: 'DB_ERROR', message: error.message };
  return { ok: true, updatedApp: data };
}

export async function addHistory(supabase, { applicationId, action, prevStatus, nextStatus, userName, comment }) {
  const { data, error } = await supabase
    .from('application_history')
    .insert({
      application_id: applicationId,
      action,
      prev_status: prevStatus,
      next_status: nextStatus,
      user_name: userName,
      comment,
    })
    .select('id')
    .single();

  if (error) return { ok: false, status: 500, code: 'DB_ERROR', message: error.message };
  return { ok: true, historyEventId: data.id };
}

export async function updateStepCompletion(supabase, { applicationId, stepIndex, isCompleted }) {
  const payload = {
    application_id: applicationId,
    step_index: Number(stepIndex),
    is_completed: Boolean(isCompleted),
  };

  const { error } = await supabase
    .from('application_steps')
    .upsert(payload, { onConflict: 'application_id,step_index' });

  if (error) return { ok: false, status: 500, code: 'DB_ERROR', message: error.message };
  return { ok: true };
}

export async function updateStageVerification(supabase, { applicationId, stage, isVerified }) {
  const range = getStageStepRange(stage);
  if (!range) {
    return { ok: false, status: 400, code: 'INVALID_STAGE', message: `Cannot resolve step range for stage ${stage}` };
  }

  const payload = [];
  for (let stepIdx = range.start; stepIdx <= range.end; stepIdx += 1) {
    payload.push({
      application_id: applicationId,
      step_index: stepIdx,
      is_verified: Boolean(isVerified),
    });
  }

  const { error } = await supabase
    .from('application_steps')
    .upsert(payload, { onConflict: 'application_id,step_index' });

  if (error) return { ok: false, status: 500, code: 'DB_ERROR', message: error.message };
  return { ok: true };
}

export async function ensureActorLock(supabase, applicationId, actorUserId) {
  const { data: lockData, error: lockError } = await supabase
    .from('application_locks')
    .select('owner_user_id, expires_at')
    .eq('application_id', applicationId)
    .maybeSingle();

  if (lockError) return { ok: false, status: 500, code: 'DB_ERROR', message: lockError.message };
  if (!lockData || lockData.owner_user_id !== actorUserId || new Date(lockData.expires_at) <= new Date()) {
    return {
      ok: false,
      status: 423,
      code: 'LOCK_REQUIRED',
      message: 'Active lock owned by current user is required',
    };
  }

  return { ok: true };
}
