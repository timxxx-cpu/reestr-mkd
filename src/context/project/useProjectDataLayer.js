import { useCallback, useEffect, useMemo, useRef } from 'react';
import { APP_STATUS } from '../../lib/constants';
import { canEditByRoleAndStatus } from '../../lib/workflow-state-machine';

export const useProjectDataLayer = ({ serverData, projectMeta, setProjectMeta, buildingsState, userProfile }) => {
    const validationSnapshotRef = useRef({});

    useEffect(() => {
        if (serverData && Object.keys(serverData).length > 0) {
            setProjectMeta(prev => ({ ...prev, ...serverData }));
        }
    }, [serverData, setProjectMeta]);

    const mergedState = useMemo(() => {
        const meta = /** @type {any} */ (projectMeta);

        const defaultAppInfo = {
            status: APP_STATUS.DRAFT,
            currentStage: 1,
            currentStepIndex: 0,
            verifiedSteps: [],
            completedSteps: [],
            rejectionReason: null,
            history: [],
            ...meta.applicationInfo
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
            parkingPlaces: { ...(meta.parkingPlaces || {}) }
        };

        Object.values(buildingsState).forEach(b => {
            const build = /** @type {any} */ (b);
            if (build.buildingDetails) combined.buildingDetails = { ...build.buildingDetails, ...combined.buildingDetails };
            if (build.floorData) combined.floorData = { ...build.floorData, ...combined.floorData };
            if (build.entrancesData) combined.entrancesData = { ...build.entrancesData, ...combined.entrancesData };
            if (build.commonAreasData) combined.mopData = { ...build.commonAreasData, ...combined.mopData };
            if (build.apartmentsData) combined.flatMatrix = { ...build.apartmentsData, ...combined.flatMatrix };
            if (build.parkingData) combined.parkingPlaces = { ...build.parkingData, ...combined.parkingPlaces };
        });

        return combined;
    }, [projectMeta, buildingsState]);

    useEffect(() => {
        validationSnapshotRef.current = { ...mergedState };
    }, [mergedState]);

    const getValidationSnapshot = useCallback(() => validationSnapshotRef.current, []);

    const isReadOnly = useMemo(() => {
        if (!userProfile) return true;
        const role = userProfile.role;
        // @ts-ignore
        const status = mergedState.applicationInfo.status;
        return !canEditByRoleAndStatus(role, status);
    }, [userProfile, mergedState.applicationInfo]);

    return {
        mergedState,
        isReadOnly,
        getValidationSnapshot
    };
};
