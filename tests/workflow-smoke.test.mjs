import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dashboardSource = readFileSync('src/components/ApplicationsDashboard.jsx', 'utf8');
const apiServiceSource = readFileSync('src/lib/api-service.js', 'utf8');
const workflowBarSource = readFileSync('src/components/WorkflowBar.jsx', 'utf8');
const workflowCompletionHookSource = readFileSync('src/hooks/useWorkflowCompletion.js', 'utf8');
const workflowActionsHookSource = readFileSync('src/hooks/useWorkflowActions.js', 'utf8');
const workflowGuardsHookSource = readFileSync('src/hooks/useWorkflowGuards.js', 'utf8');
const workflowModalsHookSource = readFileSync('src/hooks/useWorkflowModals.js', 'utf8');
const workflowViewModelHookSource = readFileSync('src/hooks/useWorkflowViewModel.js', 'utf8');
const workflowFeedbackHookSource = readFileSync('src/hooks/useWorkflowFeedback.js', 'utf8');
const taskSwitchBlockerHookSource = readFileSync('src/hooks/useTaskSwitchBlocker.js', 'utf8');
const workflowControllerHookSource = readFileSync('src/hooks/useWorkflowController.js', 'utf8');
const workflowModePanelsSource = readFileSync('src/components/workflow/WorkflowModePanels.jsx', 'utf8');
const workflowDialogsSource = readFileSync('src/components/workflow/WorkflowDialogs.jsx', 'utf8');
const workflowOverlaysSource = readFileSync('src/components/workflow/WorkflowOverlays.jsx', 'utf8');
const workflowActionRegistrySource = readFileSync('src/lib/workflow-action-registry.js', 'utf8');

test('DECLINE action in ApplicationsDashboard is routed through ApiService', () => {
  assert.match(
    dashboardSource,
    /ApiService\.declineApplication\s*\(\{[\s\S]*applicationId:[\s\S]*reason,[\s\S]*\}\)/,
    'DECLINE flow must call ApiService.declineApplication with expected payload'
  );

  assert.doesNotMatch(
    dashboardSource,
    /import\('@lib\/supabase'\)/,
    'ApplicationsDashboard should not dynamically import Supabase for DECLINE flow'
  );

  assert.doesNotMatch(
    dashboardSource,
    /\.from\('application_history'\)\.insert\(/,
    'ApplicationsDashboard should not write application_history directly'
  );
});

test('ApiService decline path remains backend-aware with BFF gate', () => {
  assert.match(
    apiServiceSource,
    /declineApplication:\s*async\s*\([^)]*\)\s*=>\s*\{[\s\S]*requireBffEnabled\('workflow\.declineApplication'\)[\s\S]*BffClient\.declineApplication\(/,
    'ApiService declineApplication should enforce BFF guard and route through BffClient.declineApplication'
  );
});

test('WorkflowBar completion precheck goes through useWorkflowCompletion hook', () => {
  assert.match(
    workflowBarSource,
    /import\s*\{\s*useWorkflowCompletion\s*\}\s*from\s*'@hooks\/useWorkflowCompletion'/,
    'WorkflowBar should use centralized completion precheck hook'
  );

  assert.match(
    workflowBarSource,
    /const\s*\{\s*runCompletionPrecheck\s*\}\s*=\s*useWorkflowCompletion\(/,
    'WorkflowBar should wire runCompletionPrecheck from hook'
  );

  assert.doesNotMatch(
    workflowBarSource,
    /waitForPendingMutations|validateWorkflowStepViaBff/,
    'WorkflowBar should not directly orchestrate save/wait/validate helpers'
  );
});

test('useWorkflowCompletion returns explicit failure reason for backend validation issues', () => {
  assert.match(
    workflowCompletionHookSource,
    /reason:\s*'validation-failed'/,
    'Hook should return typed reason when save\/refetch\/validation throws'
  );

  assert.match(
    workflowCompletionHookSource,
    /validation-errors/,
    'Hook should return typed reason for business validation errors'
  );
});


test('WorkflowBar delegates transition operations through workflow controller/actions hooks', () => {
  assert.match(
    workflowBarSource,
    /useWorkflowActions\(/,
    'WorkflowBar should wire transition action source through useWorkflowActions'
  );

  assert.match(
    workflowBarSource,
    /useWorkflowController\(/,
    'WorkflowBar should delegate handler orchestration to useWorkflowController'
  );
});

test('useWorkflowActions exposes comment action constants and typed action execution', () => {
  assert.match(
    workflowActionsHookSource,
    /@lib\/workflow-action-registry/,
    'Hook should consume shared workflow comment action constants from registry'
  );

  assert.match(
    workflowActionsHookSource,
    /executeCompletion|executeRollback|executeApproveStage|executeCommentAction/,
    'Hook should provide all workflow action executors'
  );
});


test('WorkflowBar uses workflow guards hook for availability logic', () => {
  assert.match(
    workflowBarSource,
    /useWorkflowGuards\(/,
    'WorkflowBar should delegate computed guards to useWorkflowGuards'
  );

  assert.doesNotMatch(
    workflowBarSource,
    /canRequestDecline\(|canReviewDeclineRequest\(|isPendingDecline\(/,
    'WorkflowBar should not compute guard rules inline'
  );
});

test('useWorkflowGuards exposes role and state derived guard flags', () => {
  assert.match(
    workflowGuardsHookSource,
    /shortcutsEnabled|isActionDisabled|canTechRequestDecline|canManagerReviewDecline/,
    'Hook should provide derived availability flags used by WorkflowBar'
  );
});


test('WorkflowBar uses workflow modals hook for modal state orchestration', () => {
  assert.match(
    workflowBarSource,
    /useWorkflowModals\(/,
    'WorkflowBar should use modal orchestration hook'
  );

  assert.doesNotMatch(
    workflowBarSource,
    /Запрос на отказ от заявки|Подтверждение отказа|Вернуть этап на доработку/,
    'WorkflowBar should not define action modal texts inline'
  );
});

test('useWorkflowModals stores centralized modal configs for workflow comment actions', () => {
  assert.match(
    workflowModalsHookSource,
    /getWorkflowActionConfig/,
    'Hook should pull modal config from shared workflow action registry'
  );

  assert.match(
    workflowModalsHookSource,
    /WORKFLOW_COMMENT_ACTIONS/,
    'Hook should keep using workflow comment action constants for modal actions'
  );
});


test('WorkflowBar uses workflow view-model hook for derived step display state', () => {
  assert.match(
    workflowBarSource,
    /useWorkflowViewModel\(/,
    'WorkflowBar should delegate step-derived UI values to useWorkflowViewModel'
  );

  assert.doesNotMatch(
    workflowBarSource,
    /const INTEGRATION_START_IDX = 12|Отправить на проверку|Завершить проект/,
    'WorkflowBar should not define step action labels and stage boundaries inline'
  );
});

test('useWorkflowViewModel computes action labels and boundary flags', () => {
  assert.match(
    workflowViewModelHookSource,
    /isStageBoundary|isLastStepGlobal|isIntegrationStage|actionBtnText|confirmMsg/,
    'View-model hook should expose derived action state for WorkflowBar'
  );
});


test('WorkflowBar uses extracted workflow mode panel components', () => {
  assert.match(
    workflowBarSource,
    /ReviewModePanel|ManagerPendingDeclinePanel|TechnicianPendingDeclinePanel|ActiveTechnicianTaskPanel|ReadOnlyCompletedPanel/,
    'WorkflowBar should render extracted mode panel components'
  );

  assert.doesNotMatch(
    workflowBarSource,
    /bg-indigo-900 border-b border-indigo-800|bg-amber-900 border-b border-amber-800 px-8 py-4 flex items-center justify-between sticky top-0 z-30 shadow-xl/,
    'WorkflowBar should not keep large mode panel markup inline'
  );
});

test('WorkflowModePanels module exports focused presentational mode panels', () => {
  assert.match(
    workflowModePanelsSource,
    /export const ReviewModePanel|export const ManagerPendingDeclinePanel|export const TechnicianPendingDeclinePanel|export const ActiveTechnicianTaskPanel|export const ReadOnlyCompletedPanel/,
    'Workflow mode panel module should export presentational section components'
  );
});


test('WorkflowBar delegates active technician toolbar layout to ActiveTechnicianTaskPanel', () => {
  assert.doesNotMatch(
    workflowBarSource,
    /bg-slate-900 border-b border-slate-800 px-8 py-4 flex items-center justify-between sticky top-0 z-30 shadow-xl shadow-slate-900\/10 animate-in slide-in-from-top-2 text-white/,
    'WorkflowBar should not keep active technician toolbar markup inline'
  );

  assert.match(
    workflowModePanelsSource,
    /export const ActiveTechnicianTaskPanel/,
    'Workflow mode panel module should export active technician toolbar panel'
  );
});


test('WorkflowBar keeps dialog definitions out of component module', () => {
  assert.doesNotMatch(
    workflowBarSource,
    /const ActionCommentModal =|const ValidationErrorsModal =|const ExitConfirmationModal =|const RollbackConfirmationModal =|const ApproveStageModal =|const CompleteTaskModal =|const SaveProgressModal =/,
    'WorkflowBar should not define modal components inline'
  );

  assert.match(
    workflowOverlaysSource,
    /@components\/workflow\/WorkflowDialogs/,
    'WorkflowOverlays should compose dialog components from WorkflowDialogs module'
  );
});

test('WorkflowDialogs module exports workflow modal components', () => {
  assert.match(
    workflowDialogsSource,
    /export const ActionCommentModal|export const ValidationErrorsModal|export const ExitConfirmationModal|export const RollbackConfirmationModal|export const ApproveStageModal|export const CompleteTaskModal|export const SaveProgressModal/,
    'WorkflowDialogs should export all workflow dialog components'
  );
});


test('WorkflowBar uses extracted workflow overlay composition module', () => {
  assert.match(
    workflowBarSource,
    /@components\/workflow\/WorkflowOverlays/,
    'WorkflowBar should import overlay composition from WorkflowOverlays'
  );

  assert.match(
    workflowBarSource,
    /ReviewModeOverlays|ManagerDeclineOverlays|ActiveTaskOverlays/,
    'WorkflowBar should render extracted overlay composition components'
  );
});

test('WorkflowOverlays exports workflow overlay composition components', () => {
  assert.match(
    workflowOverlaysSource,
    /export const ReviewModeOverlays|export const ManagerDeclineOverlays|export const ActiveTaskOverlays/,
    'WorkflowOverlays should export all overlay composition components'
  );
});


test('WorkflowBar uses workflow feedback hook for save notice lifecycle and progress messages', () => {
  assert.match(
    workflowBarSource,
    /useWorkflowFeedback\(/,
    'WorkflowBar should use useWorkflowFeedback for notice orchestration'
  );

  assert.doesNotMatch(
    workflowBarSource,
    /const createClosedSaveNotice|actionProgressMessageMap/,
    'WorkflowBar should not keep inline save notice factory or action progress map'
  );
});

test('useWorkflowFeedback exposes notice helpers and action progress mapping', () => {
  assert.match(
    workflowFeedbackHookSource,
    /openSavingNotice|openErrorNotice|closeSaveNotice|handleSaveNoticeOk|getActionProgressMessage/,
    'useWorkflowFeedback should expose helpers for notice lifecycle and action progress messages'
  );

  assert.match(
    workflowFeedbackHookSource,
    /getWorkflowActionProgressMessage/,
    'useWorkflowFeedback should resolve progress messages via workflow action registry'
  );
});


test('Workflow action registry centralizes action types, modal config and progress labels', () => {
  assert.match(
    workflowActionRegistrySource,
    /export const WORKFLOW_COMMENT_ACTIONS = \{/,
    'Workflow action registry should declare shared workflow action constants'
  );

  assert.match(
    workflowActionRegistrySource,
    /WORKFLOW_ACTION_CONFIGS|getWorkflowActionConfig|getWorkflowActionProgressMessage/,
    'Workflow action registry should expose config and progress accessors'
  );
});


test('WorkflowBar uses task switch blocker hook for transition lock handling', () => {
  assert.match(
    workflowBarSource,
    /useTaskSwitchBlocker\(/,
    'WorkflowBar should delegate task-switch lock lifecycle to useTaskSwitchBlocker'
  );

  assert.doesNotMatch(
    workflowBarSource,
    /setIsTaskSwitchBlocking|setPendingStepTarget|const unlockTimer = setTimeout\(/,
    'WorkflowBar should not inline task-switch lock state/effect plumbing'
  );
});

test('useTaskSwitchBlocker encapsulates lock state and auto-unlock effect', () => {
  assert.match(
    taskSwitchBlockerHookSource,
    /startTaskSwitchBlock|resetTaskSwitchBlock|isTaskSwitchBlocking|pendingStepTarget/,
    'Hook should expose task switch lock controls and state'
  );

  assert.match(
    taskSwitchBlockerHookSource,
    /setTimeout\(|useEffect\(/,
    'Hook should contain delayed unlock side effect logic'
  );
});


test('WorkflowBar passes grouped controller dependencies instead of flat argument list', () => {
  assert.match(
    workflowBarSource,
    /useWorkflowController\(\{[\s\S]*state:\s*\{[\s\S]*operations:\s*\{[\s\S]*ui:\s*\{[\s\S]*navigation:\s*\{/,
    'WorkflowBar should pass grouped dependency objects to useWorkflowController'
  );
});

test('useWorkflowController consumes grouped dependency objects', () => {
  assert.match(
    workflowControllerHookSource,
    /state,\s*operations,\s*ui,\s*navigation,\s*toast/,
    'useWorkflowController should accept grouped dependency domains'
  );
});

test('Workflow overlays reuse shared action/save overlay composition', () => {
  assert.match(
    workflowOverlaysSource,
    /const CommonWorkflowOverlays =/,
    'WorkflowOverlays should define shared save+action overlay composition'
  );

  assert.match(
    workflowOverlaysSource,
    /<CommonWorkflowOverlays/,
    'WorkflowOverlays mode components should reuse common overlay composition'
  );
});


test('useWorkflowController encapsulates workflow bar handler orchestration', () => {
  assert.match(
    workflowControllerHookSource,
    /handleSave|handleSaveAndExit|handleCompleteTaskClick|performCompletion|performRollback|performApproveStage|handleActionConfirm/,
    'useWorkflowController should expose main workflow action handlers'
  );

  assert.match(
    workflowControllerHookSource,
    /executeCompletion|executeRollback|executeApproveStage|executeCommentAction|runCompletionPrecheck/,
    'useWorkflowController should orchestrate action/validation executors'
  );
});
