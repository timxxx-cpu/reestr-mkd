import { useCallback, useEffect, useMemo, useRef } from 'react';
import { APP_STATUS, WORKFLOW_SUBSTATUS } from '../../lib/constants';
import { canEditByRoleAndStatus } from '../../lib/workflow-state-machine';
import { ROLE_IDS, hasRole } from '../../lib/roles';

export const useProjectDataLayer = ({
  serverData,
  projectMeta,
  setProjectMeta,
  buildingsState,
  userProfile,
}) => {
  const validationSnapshotRef = useRef({});

  useEffect(() => {
    if (serverData && Object.keys(serverData).length > 0) {
      setProjectMeta(prev => ({ ...prev, ...serverData }));
    }
  }, [serverData, setProjectMeta]);

  const mergedState = useMemo(() => {
    const meta = /** @type {any} */ (projectMeta);

    const defaultAppInfo = {
      status: APP_STATUS.IN_PROGRESS,
      workflowSubstatus: WORKFLOW_SUBSTATUS.DRAFT,
      currentStage: 1,
      currentStepIndex: 0,
      verifiedSteps: [],
      completedSteps: [],
      rejectionReason: null,
      requestedDeclineReason: null,
      requestedDeclineStep: null,
      requestedDeclineBy: null,
      requestedDeclineAt: null,
      stepBlockStatuses: {},
      history: [],
      ...meta.applicationInfo,
    };

    const combined = {
      complexInfo: meta.complexInfo || {},
      participants: meta.participants || {},
      cadastre: meta.cadastre || {},
      documents: meta.documents || [],
      composition: meta.composition || [],
      applicationInfo: defaultAppInfo,

      buildingDetails: { ...(meta.buildingDetails || {}) },
      floorData: { ...(meta.floorData || {}) },
      entrancesData: { ...(meta.entrancesData || {}) },
      mopData: { ...(meta.mopData || {}) },
      flatMatrix: { ...(meta.flatMatrix || {}) },
      parkingPlaces: { ...(meta.parkingPlaces || {}) },
    };

    Object.values(buildingsState).forEach(b => {
      const build = /** @type {any} */ (b);
      if (build.buildingDetails)
        combined.buildingDetails = { ...build.buildingDetails, ...combined.buildingDetails };
      if (build.floorData) combined.floorData = { ...build.floorData, ...combined.floorData };
      if (build.entrancesData)
        combined.entrancesData = { ...build.entrancesData, ...combined.entrancesData };
      if (build.commonAreasData)
        combined.mopData = { ...build.commonAreasData, ...combined.mopData };
      if (build.apartmentsData)
        combined.flatMatrix = { ...build.apartmentsData, ...combined.flatMatrix };
      if (build.parkingData)
        combined.parkingPlaces = { ...build.parkingData, ...combined.parkingPlaces };
    });

    return combined;
  }, [projectMeta, buildingsState]);

  useEffect(() => {
    validationSnapshotRef.current = { ...mergedState };
  }, [mergedState]);

  const getValidationSnapshot = useCallback(() => validationSnapshotRef.current, []);

  const isReadOnly = useMemo(() => {
    if (!userProfile) return true;
    const substatus = mergedState.applicationInfo.workflowSubstatus || WORKFLOW_SUBSTATUS.DRAFT;
    
    // ИСПРАВЛЕНИЕ: Администратор всегда может редактировать. Техник может редактировать в рабочих статусах.
    // Бригадир и Контроллер при проверке (REVIEW) находятся в режиме СТРОГОГО ПРОСМОТРА.
    if (hasRole(userProfile, ROLE_IDS.ADMIN)) return false;
    if (hasRole(userProfile, ROLE_IDS.TECHNICIAN)) {
      return !['DRAFT', 'REVISION', 'RETURNED_BY_MANAGER', 'INTEGRATION'].includes(substatus);
    }
    
    // Все остальные роли (включая controller и branch_manager) получают режим только для чтения
    return true;
  }, [userProfile, mergedState.applicationInfo]);

  return {
    mergedState,
    isReadOnly,
    getValidationSnapshot,
  };
};
