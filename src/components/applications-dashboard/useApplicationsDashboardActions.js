import { useInboxActions } from './useInboxActions';
import { useProjectModerationActions } from './useProjectModerationActions';

export function useApplicationsDashboardActions(params) {
  const inboxActions = useInboxActions(params);
  const moderationActions = useProjectModerationActions(params);

  return {
    ...inboxActions,
    ...moderationActions,
  };
}
