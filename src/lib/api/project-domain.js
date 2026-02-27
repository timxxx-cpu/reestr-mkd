export const createProjectDomainApi = ({
  BffClient,
  requireBffEnabled,
  resolveActor,
  createIdempotencyKey,
  mapProjectAggregate,
  mapBuildingFromDB,
  mapBlockDetailsFromDB,
}) => ({
  createProjectFromApplication: async (scope, appData, user) => {
    if (!scope) throw new Error('No scope provided');
    requireBffEnabled('project.createProjectFromApplication');

    const resolvedActor = resolveActor({
      userName: user?.name,
      userRole: user?.role,
    });

    const response = await BffClient.createProjectFromApplication({
      scope,
      appData,
      userName: resolvedActor.userName,
      userRole: resolvedActor.userRole,
      idempotencyKey: createIdempotencyKey('project-init-from-application', [scope, appData?.externalId || appData?.id || appData?.cadastre]),
    });

    return response?.projectId;
  },

  deleteProject: async (scope, projectId, actor = {}) => {
    if (!scope) return;
    requireBffEnabled('project.deleteProject');

    const resolvedActor = resolveActor(actor);
    return BffClient.deleteProject({
      scope,
      projectId,
      userName: resolvedActor.userName,
      userRole: resolvedActor.userRole,
    });
  },

  getProjectFullData: async (scope, projectId) => {
    if (!scope || !projectId) return null;
    requireBffEnabled('project.getProjectFullData');

    const context = await BffClient.getProjectContext({ scope, projectId });
    const app = context.application || null;
    const pRes = { data: context.project, error: null };
    const partsRes = { data: context.participants || [], error: null };
    const docsRes = { data: context.documents || [], error: null };
    const buildingsRes = { data: context.buildings || [], error: null };
    const blockExtensionsByParent = (context.block_extensions || []).reduce((acc, item) => {
      const parentId = item?.parent_block_id;
      if (!parentId) return acc;
      acc[parentId] = acc[parentId] || [];
      acc[parentId].push(item);
      return acc;
    }, {});
    const historyRes = { data: context.history || [], error: null };
    const stepsRes = { data: context.steps || [], error: null };
    const markersRes = { data: context.block_floor_markers || [], error: null }; 

    if (pRes.error) throw pRes.error;

    const fallbackApp = app || {
      id: null,
      updated_at: pRes.data.updated_at,
      internal_number: null,
      external_source: null,
      external_id: null,
      applicant: null,
      submission_date: null,
      status: 'IN_PROGRESS',
      workflow_substatus: 'DRAFT',
      assignee_name: null,
      current_step: 0,
      current_stage: 1,
      requested_decline_reason: null,
      requested_decline_step: null,
      requested_decline_by: null,
      requested_decline_at: null,
    };

    const projectData = mapProjectAggregate(
      pRes.data,
      fallbackApp,
      historyRes.data || [],
      stepsRes.data || [],
      partsRes.data || [],
      docsRes.data || []
    );

    const composition = [];
    const buildingDetails = {};

    (buildingsRes.data || []).forEach(b => {
      const enrichedBlocks = (b.building_blocks || []).map(block => {
        const mergedExtensions = [
          ...(Array.isArray(block.block_extensions) ? block.block_extensions : []),
          ...(blockExtensionsByParent[block.id] || []),
        ];

        const dedupedExtensions = mergedExtensions.reduce((acc, ext) => {
          if (!ext?.id) return acc;
          if (acc.some(item => item.id === ext.id)) return acc;
          acc.push(ext);
          return acc;
        }, []);

        return {
          ...block,
          block_extensions: dedupedExtensions,
        };
      });

      composition.push(mapBuildingFromDB(b, enrichedBlocks));
      
      // Маппим подвалы из basement-блоков building_blocks
      const buildingBasements = enrichedBlocks
        .filter(block => block.is_basement_block)
        .map(block => ({
          id: block.id,
          buildingId: block.building_id,
          blockId: block.linked_block_ids?.[0] || null,
          blocks: block.linked_block_ids || [],
          depth: block.basement_depth || 1,
          hasParking: !!block.basement_has_parking,
          parkingLevels: block.basement_parking_levels && typeof block.basement_parking_levels === 'object'
            ? block.basement_parking_levels
            : {},
          communications: block.basement_communications && typeof block.basement_communications === 'object'
            ? block.basement_communications
            : {},
          entrancesCount: Math.min(10, Math.max(1, Number.parseInt(block.entrances_count, 10) || 1)),
        }));

      if (buildingBasements.length > 0) {
        buildingDetails[`${b.id}_features`] = { basements: buildingBasements };
      }

      enrichedBlocks.filter(block => !block.is_basement_block).forEach(block => {
        const uiKey = `${b.id}_${block.id}`;
        // Передаем маркеры в маппер
        const mapped = mapBlockDetailsFromDB(b, block, markersRes.data);
        buildingDetails[uiKey] = mapped;
      });
    });

    return {
      ...projectData,
      composition,
      buildingDetails,
      floorData: {},
      entrancesData: {},
      flatMatrix: {},
      mopData: {},
      parkingPlaces: {},
    };
  },


  getProjectGeometryCandidates: async projectId => {
    if (!projectId) return [];
    requireBffEnabled('project.getProjectGeometryCandidates');
    return BffClient.getProjectGeometryCandidates({ projectId });
  },

  importProjectGeometryCandidates: async (projectId, candidates = [], actor = {}) => {
    requireBffEnabled('project.importProjectGeometryCandidates');
    const resolvedActor = resolveActor(actor);
    return BffClient.importProjectGeometryCandidates({
      projectId,
      candidates,
      userName: resolvedActor.userName,
      userRole: resolvedActor.userRole,
    });
  },

  selectProjectLandPlot: async (projectId, candidateId, actor = {}) => {
    requireBffEnabled('project.selectProjectLandPlot');
    const resolvedActor = resolveActor(actor);
    return BffClient.selectProjectLandPlot({
      projectId,
      candidateId,
      userName: resolvedActor.userName,
      userRole: resolvedActor.userRole,
    });
  },

  getProjectDetails: async projectId => {
    if (!projectId) return null;
    requireBffEnabled('project.getProjectDetails');
    return BffClient.getProjectPassport({ projectId });
  },

  createProject: async (name, street = '', scope = 'shared_dev_env') => {
    const appData = {
      source: 'MANUAL',
      externalId: null,
      applicant: name,
      address: street,
      cadastre: '',
      submissionDate: new Date(),
    };

    const user = { name: 'System', role: 'admin' };
    return createProjectDomainApi({
      BffClient,
      requireBffEnabled,
      resolveActor,
      createIdempotencyKey,
      mapProjectAggregate,
      mapBuildingFromDB,
      mapBlockDetailsFromDB,
    }).createProjectFromApplication(scope, appData, user);
  },

  updateProjectInfo: async (projectId, info = {}, cadastreData = {}, actor = {}) => {
    if (!projectId) return null;
    requireBffEnabled('project.updateProjectInfo');

    const resolvedActor = resolveActor(actor);
    return BffClient.updateProjectPassport({
      projectId,
      info,
      cadastreData,
      userName: resolvedActor.userName,
      userRole: resolvedActor.userRole,
    });
  },

  upsertParticipant: async (projectId, role, data = {}, actor = {}) => {
    requireBffEnabled('project.upsertParticipant');

    const resolvedActor = resolveActor(actor);
    return BffClient.upsertProjectParticipant({
      projectId,
      role,
      data,
      userName: resolvedActor.userName,
      userRole: resolvedActor.userRole,
    });
  },

  upsertDocument: async (projectId, doc = {}, actor = {}) => {
    requireBffEnabled('project.upsertDocument');

    const resolvedActor = resolveActor(actor);
    return BffClient.upsertProjectDocument({
      projectId,
      doc,
      userName: resolvedActor.userName,
      userRole: resolvedActor.userRole,
    });
  },

  deleteDocument: async (id, actor = {}) => {
    if (!id) return;
    requireBffEnabled('project.deleteDocument');

    const resolvedActor = resolveActor(actor);
    return BffClient.deleteProjectDocument({
      documentId: id,
      userName: resolvedActor.userName,
      userRole: resolvedActor.userRole,
    });
  },

  getProjectFullRegistry: async projectId => {
    requireBffEnabled('project.getProjectFullRegistry');
    return BffClient.getProjectFullRegistry({ projectId });
  },

  getProjectTepSummary: async projectId => {
    requireBffEnabled('project.getProjectTepSummary');
    return BffClient.getProjectTepSummary({ projectId });
  },

  saveData: async (scope, projectId, payload) => {
    requireBffEnabled('project.saveData');
    if (!scope) return;

    const { buildingSpecificData, ...generalData } = payload || {};
    const resolvedActor = resolveActor({});
    let applicationId = null;

    if (generalData.complexInfo || generalData.applicationInfo) {
      const metaResponse = await BffClient.saveProjectContextMeta({
        scope,
        projectId,
        complexInfo: generalData.complexInfo || null,
        applicationInfo: generalData.applicationInfo || null,
        userName: resolvedActor.userName,
        userRole: resolvedActor.userRole,
      });

      applicationId = metaResponse?.applicationId || null;
    }

    if (generalData.buildingDetails) {
      await BffClient.saveProjectBuildingDetails({
        projectId,
        buildingDetails: generalData.buildingDetails,
        userName: resolvedActor.userName,
        userRole: resolvedActor.userRole,
      });
    }

    if (generalData.stepBlockStatuses && generalData.stepIndex !== undefined) {
      await BffClient.saveStepBlockStatuses({
        scope,
        projectId,
        stepIndex: generalData.stepIndex,
        statuses: generalData.stepBlockStatuses,
        userName: resolvedActor.userName,
        userRole: resolvedActor.userRole,
      });
    }

    void buildingSpecificData;

    return { ok: true, applicationId };
  },
});