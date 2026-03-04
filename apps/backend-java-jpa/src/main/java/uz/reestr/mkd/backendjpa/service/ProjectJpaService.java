package uz.reestr.mkd.backendjpa.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.List;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.time.format.DateTimeParseException;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import uz.reestr.mkd.backendjpa.entity.BlockEntity;
import uz.reestr.mkd.backendjpa.entity.BuildingEntity;
import uz.reestr.mkd.backendjpa.entity.CommonAreaEntity;
import uz.reestr.mkd.backendjpa.entity.EntranceEntity;
import uz.reestr.mkd.backendjpa.entity.FloorEntity;
import uz.reestr.mkd.backendjpa.entity.UnitEntity;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import uz.reestr.mkd.backendjpa.dto.ProjectRequestDtos.CreateProjectFromApplicationRequest;
import uz.reestr.mkd.backendjpa.dto.ProjectRequestDtos.ImportProjectGeometryCandidatesRequest;
import uz.reestr.mkd.backendjpa.dto.PaginatedResponseDto;
import uz.reestr.mkd.backendjpa.dto.ProjectResponseDtos.CreateProjectFromApplicationResponse;
import uz.reestr.mkd.backendjpa.dto.ProjectRequestDtos.UpdateProjectPassportRequest;
import uz.reestr.mkd.backendjpa.entity.ProjectGeometryCandidateEntity;
import uz.reestr.mkd.backendjpa.entity.Project;
import uz.reestr.mkd.backendjpa.entity.ProjectDocument;
import uz.reestr.mkd.backendjpa.entity.ProjectParticipant;
import uz.reestr.mkd.backendjpa.entity.ApplicationEntity;
import uz.reestr.mkd.backendjpa.repository.ProjectGeometryCandidateRepository;
import uz.reestr.mkd.backendjpa.repository.ApplicationRepository;
import uz.reestr.mkd.backendjpa.repository.BuildingRepository;
import uz.reestr.mkd.backendjpa.repository.ProjectRepository;
import uz.reestr.mkd.backendjpa.dto.ProjectRequestDtos.CreateBuildingRequest;
import uz.reestr.mkd.backendjpa.dto.ProjectRequestDtos.SaveProjectBuildingDetailsRequest;
import uz.reestr.mkd.backendjpa.dto.ProjectRequestDtos.SaveProjectContextMetaRequest;
import uz.reestr.mkd.backendjpa.dto.ProjectRequestDtos.SaveStepBlockStatusesRequest;
import uz.reestr.mkd.backendjpa.dto.ProjectRequestDtos.SelectBuildingGeometryRequest;
import uz.reestr.mkd.backendjpa.dto.ProjectRequestDtos.SelectProjectLandPlotRequest;
import uz.reestr.mkd.backendjpa.dto.ProjectRequestDtos.UpsertProjectDocumentRequest;
import uz.reestr.mkd.backendjpa.dto.ProjectRequestDtos.UpsertProjectParticipantRequest;
import uz.reestr.mkd.backendjpa.dto.ProjectRequestDtos.ValidateProjectStepRequest;

@Service
public class ProjectJpaService {

  private final ProjectRepository projectRepository;
  private final BuildingRepository buildingRepository;
  private final ApplicationRepository applicationRepository;
  private final ProjectGeometryCandidateRepository projectGeometryCandidateRepository;
  private final VersioningJpaService versioningJpaService;
  private final ObjectMapper objectMapper;

  @PersistenceContext
  private EntityManager entityManager;

  public ProjectJpaService(
      ProjectRepository projectRepository,
      BuildingRepository buildingRepository,
      ApplicationRepository applicationRepository,
      ProjectGeometryCandidateRepository projectGeometryCandidateRepository,
      VersioningJpaService versioningJpaService,
      ObjectMapper objectMapper
  ) {
    this.projectRepository = projectRepository;
    this.buildingRepository = buildingRepository;
    this.applicationRepository = applicationRepository;
    this.projectGeometryCandidateRepository = projectGeometryCandidateRepository;
    this.versioningJpaService = versioningJpaService;
    this.objectMapper = objectMapper;
  }

  @Transactional(readOnly = true)
  public PaginatedResponseDto<JsonNode> getProjectsList(String scope, int page, int size, String actorUserId, String actorRole) {
    String normalizedScope = trim(scope);
    if (normalizedScope == null || normalizedScope.isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "scope is required");
    }

    int resolvedPage = Math.max(0, page);
    int resolvedSize = Math.min(100, Math.max(1, size));
    Pageable pageable = PageRequest.of(resolvedPage, resolvedSize);

    boolean isAdmin = "admin".equalsIgnoreCase(trim(actorRole));
    Page<Project> resultPage;
    if (isAdmin) {
      resultPage = projectRepository.findByScopeIdOrderByUpdatedAtDesc(normalizedScope, pageable);
    } else {
      if (actorUserId == null || actorUserId.isBlank()) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "x-user-id is required for non-admin actors");
      }
      resultPage = projectRepository.findAccessibleByScopeIdOrderByUpdatedAtDesc(normalizedScope, actorUserId, pageable);
    }

    List<JsonNode> items = resultPage.getContent().stream()
        .map(this::toProjectListItem)
        .toList();

    return new PaginatedResponseDto<>(
        items,
        resultPage.getTotalElements(),
        resolvedPage,
        resultPage.getTotalPages()
    );
  }

  @Transactional(readOnly = true)
  public List<JsonNode> getProjectsMapOverview(String scope, String actorUserId, String actorRole) {
    return getProjectsList(scope, 0, 1000, actorUserId, actorRole).data();
  }

  @Transactional(readOnly = true)
  public JsonNode getProjectsSummaryCounts(String scope, String assignee, String actorUserId, String actorRole) {
    String normalizedScope = trim(scope);
    if (normalizedScope == null || normalizedScope.isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "scope is required");
    }

    boolean isAdmin = "admin".equalsIgnoreCase(trim(actorRole));
    if (!isAdmin && (actorUserId == null || actorUserId.isBlank())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "x-user-id is required for non-admin actors");
    }

    String assigneeName = null;
    String normalizedAssignee = trim(assignee);
    if (normalizedAssignee != null && !normalizedAssignee.isBlank() && !"all".equalsIgnoreCase(normalizedAssignee)) {
      assigneeName = "mine".equalsIgnoreCase(normalizedAssignee) ? actorUserId : normalizedAssignee;
    }

    Map<String, Long> statusCounts = new HashMap<>();
    for (ApplicationRepository.StatusCountProjection row : applicationRepository.countDashboardByStatus(
        normalizedScope,
        isAdmin,
        actorUserId,
        assigneeName
    )) {
      statusCounts.put(row.getStatus() == null ? "" : row.getStatus().toUpperCase(), row.getCnt());
    }

    long inProgress = statusCounts.getOrDefault("IN_PROGRESS", 0L);
    long declined = statusCounts.getOrDefault("DECLINED", 0L);
    long completed = statusCounts.getOrDefault("COMPLETED", 0L);

    Map<String, Long> substatusCounts = new HashMap<>();
    @SuppressWarnings("unchecked")
    List<Object[]> substatusRows = entityManager.createNativeQuery("""
        select upper(coalesce(workflow_substatus, '')), count(*)
          from applications a
         where a.scope_id = :scopeId
           and (:assigneeName is null or a.assignee_name = :assigneeName)
         group by upper(coalesce(workflow_substatus, ''))
        """)
        .setParameter("scopeId", normalizedScope)
        .setParameter("assigneeName", assigneeName)
        .getResultList();
    for (Object[] row : substatusRows) {
      String key = row[0] == null ? "" : row[0].toString();
      long value = row[1] instanceof Number n ? n.longValue() : 0L;
      substatusCounts.put(key, value);
    }

    ObjectNode counts = objectMapper.createObjectNode();
    counts.put("work", inProgress);
    counts.put("review", substatusCounts.getOrDefault("REVIEW", 0L));
    counts.put("integration", substatusCounts.getOrDefault("INTEGRATION", 0L));
    counts.put("pendingDecline", substatusCounts.getOrDefault("PENDING_DECLINE", 0L));
    counts.put("declined", declined);
    counts.put("completed", completed);
    counts.put("registryApplications", completed + declined);
    counts.put("registryComplexes", completed);
    return counts;
  }

  @Transactional(readOnly = true)
  public List<JsonNode> getProjectGeometryCandidates(UUID projectId) {
    return projectGeometryCandidateRepository.findByProjectIdOrderBySourceIndexAsc(projectId)
        .stream()
        .map(this::toGeometryCandidateJson)
        .toList();
  }

  @Transactional(readOnly = true)
  public List<JsonNode> getProjectBuildingsHierarchy(UUID projectId) {
    return buildingRepository.findWithGraphByProjectId(projectId)
        .stream()
        .map(this::toBuildingHierarchy)
        .toList();
  }

  @Transactional
  public List<JsonNode> importProjectGeometryCandidates(UUID projectId, ImportProjectGeometryCandidatesRequest request) {
    List<JsonNode> candidates = request == null || request.candidates() == null ? List.of() : request.candidates();
    if (candidates.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Candidates payload is required");
    }

    List<JsonNode> imported = new ArrayList<>();
    for (JsonNode candidate : candidates) {
      JsonNode geometry = candidate == null ? null : candidate.get("geometry");
      if (geometry == null || geometry.isNull()) {
        continue;
      }

      int sourceIndex = candidate.path("sourceIndex").asInt(0);
      ProjectGeometryCandidateEntity entity = projectGeometryCandidateRepository
          .findByProjectIdAndSourceIndex(projectId, sourceIndex)
          .orElseGet(ProjectGeometryCandidateEntity::new);

      entity.setProjectId(projectId);
      entity.setSourceIndex(sourceIndex);
      entity.setLabel(text(candidate, "label"));
      entity.setProperties(candidate.path("properties").isMissingNode() ? objectMapper.createObjectNode() : candidate.path("properties"));
      entity.setGeomGeojson(geometry);
      entity.setAreaM2(toBigDecimal(candidate.get("areaM2")));
      if (entity.getIsSelectedLandPlot() == null) {
        entity.setIsSelectedLandPlot(false);
      }

      ProjectGeometryCandidateEntity saved = projectGeometryCandidateRepository.save(entity);
      imported.add(toGeometryCandidateJson(saved));
    }
    return imported;
  }

  @Transactional
  public JsonNode approveProjectGeometryCandidate(UUID projectId, UUID candidateId, UUID buildingId, boolean selectAsLandPlot) {
    ProjectGeometryCandidateEntity candidate = projectGeometryCandidateRepository.findByIdAndProjectId(candidateId, projectId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Geometry candidate not found"));

    if (selectAsLandPlot) {
      entityManager.createNativeQuery("""
          update project_geometry_candidates
             set is_selected_land_plot = false,
                 updated_at = now()
           where project_id = :projectId
          """)
          .setParameter("projectId", projectId)
          .executeUpdate();

      candidate.setIsSelectedLandPlot(true);
      entityManager.createNativeQuery("""
          update projects
             set land_plot_geojson = cast(:geo as jsonb),
                 land_plot_area_m2 = :area,
                 updated_at = now()
           where id = :projectId
          """)
          .setParameter("geo", toJson(candidate.getGeomGeojson()))
          .setParameter("area", candidate.getAreaM2())
          .setParameter("projectId", projectId)
          .executeUpdate();
    }

    if (buildingId != null) {
      candidate.setAssignedBuildingId(buildingId);
      entityManager.createNativeQuery("""
          update buildings
             set footprint_geojson = cast(:geo as jsonb),
                 building_footprint_area_m2 = :area,
                 geometry_candidate_id = :candidateId,
                 updated_at = now()
           where id = :buildingId
             and project_id = :projectId
          """)
          .setParameter("geo", toJson(candidate.getGeomGeojson()))
          .setParameter("area", candidate.getAreaM2())
          .setParameter("candidateId", candidateId)
          .setParameter("buildingId", buildingId)
          .setParameter("projectId", projectId)
          .executeUpdate();
    }

    candidate.setProperties(withReviewStatus(candidate.getProperties(), "approved", null));
    ProjectGeometryCandidateEntity saved = projectGeometryCandidateRepository.save(candidate);
    return toGeometryCandidateJson(saved);
  }

  @Transactional
  public JsonNode declineProjectGeometryCandidate(UUID projectId, UUID candidateId, String reason) {
    ProjectGeometryCandidateEntity candidate = projectGeometryCandidateRepository.findByIdAndProjectId(candidateId, projectId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Geometry candidate not found"));

    candidate.setProperties(withReviewStatus(candidate.getProperties(), "declined", reason));
    candidate.setAssignedBuildingId(null);
    candidate.setIsSelectedLandPlot(false);

    ProjectGeometryCandidateEntity saved = projectGeometryCandidateRepository.save(candidate);
    return toGeometryCandidateJson(saved);
  }

  @Transactional
  public CreateProjectFromApplicationResponse createProjectFromApplication(CreateProjectFromApplicationRequest request, String actorUserId) {
    String scope = trim(request.scope());
    if (scope == null || scope.isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "scope is required");
    }

    JsonNode appData = request.appData();
    ensureNoActiveReapplication(scope, appData);
    String applicant = text(appData, "applicant");
    String address = text(appData, "address");
    String cadastre = text(appData, "cadastre");
    String source = text(appData, "source");
    String externalId = text(appData, "externalId");
    String submissionDate = text(appData, "submissionDate");

    Project project = Project.builder()
        .scopeId(scope)
        .ujCode(generateNextProjectCode(scope))
        .name(applicant != null && !applicant.isBlank() ? "ЖК от " + applicant : "Новый проект")
        .address(address)
        .cadastreNumber(formatComplexCadastre(cadastre))
        .constructionStatus("Проектный")
        .build();

    Project saved = projectRepository.save(project);

    UUID applicationId = UUID.randomUUID();
    entityManager.createNativeQuery("""
        insert into applications(
          id, project_id, scope_id, internal_number, external_source, external_id,
          applicant, submission_date, assignee_name, status, workflow_substatus,
          current_step, current_stage, created_at, updated_at
        ) values (
          :id, :projectId, :scopeId, :internalNumber, :externalSource, :externalId,
          :applicant, :submissionDate, :assigneeName, 'IN_PROGRESS', 'DRAFT',
          0, 1, now(), now()
        )
        """)
        .setParameter("id", applicationId)
        .setParameter("projectId", saved.getId())
        .setParameter("scopeId", scope)
        .setParameter("internalNumber", "INT-" + String.valueOf(System.currentTimeMillis()).substring(7))
        .setParameter("externalSource", source)
        .setParameter("externalId", externalId)
        .setParameter("applicant", applicant)
        .setParameter("submissionDate", submissionDate == null ? Timestamp.from(Instant.now()) : Timestamp.from(Instant.parse(submissionDate)))
        .setParameter("assigneeName", actorUserId)
        .executeUpdate();

    versioningJpaService.createPendingVersionsForProject(saved.getId(), applicationId, actorUserId);

    return new CreateProjectFromApplicationResponse(saved.getId(), applicationId, saved.getUjCode());
  }

  @Transactional
  public void validateAndUpdatePassport(UUID projectId, UpdateProjectPassportRequest request) {
    validatePassportTep(request);

    JsonNode info = request.info();
    JsonNode cadastreData = request.cadastreData();

    entityManager.createNativeQuery("""
        update projects
           set name = :name,
               construction_status = :status,
               region = :region,
               district = :district,
               address = :address,
               landmark = :landmark,
               date_start_project = :dateStartProject,
               date_end_project = :dateEndProject,
               date_start_fact = :dateStartFact,
               date_end_fact = :dateEndFact,
               cadastre_number = :cadastreNumber,
               land_plot_area_m2 = :area,
               updated_at = now()
         where id = :projectId
        """)
        .setParameter("name", text(info, "name"))
        .setParameter("status", text(info, "status"))
        .setParameter("region", text(info, "region"))
        .setParameter("district", text(info, "district"))
        .setParameter("address", text(info, "street"))
        .setParameter("landmark", text(info, "landmark"))
        .setParameter("dateStartProject", toDate(info, "dateStartProject"))
        .setParameter("dateEndProject", toDate(info, "dateEndProject"))
        .setParameter("dateStartFact", toDate(info, "dateStartFact"))
        .setParameter("dateEndFact", toDate(info, "dateEndFact"))
        .setParameter("cadastreNumber", formatComplexCadastre(text(cadastreData, "number")))
        .setParameter("area", toDouble(cadastreData, "area"))
        .setParameter("projectId", projectId)
        .executeUpdate();
  }

  public void validatePassportTep(UpdateProjectPassportRequest request) {
    JsonNode info = request.info();
    JsonNode cadastreData = request.cadastreData();

    String name = text(info, "name");
    if (name == null || name.trim().length() < 3) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Название должно быть не короче 3 символов");
    }

    String street = text(info, "street");
    if (street == null || street.trim().length() < 5) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Укажите корректный адрес");
    }

    LocalDate dateStartProject = toDate(info, "dateStartProject");
    LocalDate dateEndProject = toDate(info, "dateEndProject");
    if (dateStartProject != null && dateEndProject != null && !dateEndProject.isAfter(dateStartProject)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Дата окончания должна быть позже даты начала");
    }

    Double area = toDouble(cadastreData, "area");
    if (area != null && area < 0) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Площадь не может быть отрицательной");
    }
  }

  @Transactional
  public JsonNode createBuilding(UUID projectId, CreateBuildingRequest request) {
    JsonNode data = request == null ? null : request.buildingData();
    BuildingEntity building = BuildingEntity.builder()
        .projectId(projectId)
        .label(text(data, "label") == null ? "Корпус" : text(data, "label"))
        .buildingCode(text(data, "building_code"))
        .houseNumber(text(data, "house_number"))
        .category(text(data, "category") == null ? "residential" : text(data, "category"))
        .constructionType(text(data, "construction_type"))
        .parkingType(text(data, "parking_type"))
        .hasNonResPart(Boolean.TRUE.equals(data != null && data.path("has_non_res_part").asBoolean(false)))
        .build();
    BuildingEntity saved = buildingRepository.save(building);

    JsonNode blocks = request == null ? null : request.blocksData();
    if (blocks != null && blocks.isArray()) {
      for (JsonNode blockNode : blocks) {
        BlockEntity block = BlockEntity.builder()
            .building(saved)
            .label(text(blockNode, "label") == null ? "Блок" : text(blockNode, "label"))
            .type(text(blockNode, "type") == null ? "residential" : text(blockNode, "type"))
            .floorsCount(blockNode.path("floors_count").isNumber() ? blockNode.path("floors_count").asInt() : null)
            .isBasementBlock(Boolean.TRUE.equals(blockNode.path("is_basement_block").asBoolean(false)))
            .basementHasParking(Boolean.TRUE.equals(blockNode.path("basement_has_parking").asBoolean(false)))
            .basementParkingLevels(new LinkedHashMap<>())
            .basementCommunications(new LinkedHashMap<>())
            .build();
        entityManager.persist(block);
      }
      entityManager.flush();
    }
    return toBuildingHierarchy(buildingRepository.findWithGraphByProjectId(projectId).stream()
        .filter(b -> b.getId().equals(saved.getId()))
        .findFirst()
        .orElse(saved));
  }

  @Transactional(readOnly = true)
  public JsonNode getProjectContext(UUID projectId) {
    Project project = getProject(projectId);
    ObjectNode node = objectMapper.createObjectNode();
    node.put("projectId", project.getId().toString());
    node.put("scope", project.getScopeId());
    node.put("name", project.getName());
    node.put("address", project.getAddress());
    node.put("cadastreNumber", project.getCadastreNumber());
    node.put("constructionStatus", project.getConstructionStatus());
    node.set("buildings", objectMapper.valueToTree(getProjectBuildingsHierarchy(projectId)));
    return node;
  }

  @Transactional(readOnly = true)
  public JsonNode getProjectRegistryDetails(UUID projectId) {
    ObjectNode node = objectMapper.createObjectNode();
    node.set("buildings", objectMapper.valueToTree(getProjectBuildingsHierarchy(projectId)));
    node.set("candidates", objectMapper.valueToTree(getProjectGeometryCandidates(projectId)));
    return node;
  }

  @Transactional(readOnly = true)
  public JsonNode getProjectPassport(UUID projectId) {
    Project p = getProject(projectId);
    ObjectNode info = objectMapper.createObjectNode();
    info.put("name", p.getName());
    info.put("status", p.getConstructionStatus());
    info.put("region", p.getRegion());
    info.put("district", p.getDistrict());
    info.put("street", p.getAddress());
    info.put("landmark", p.getLandmark());
    info.put("dateStartProject", p.getDateStartProject() == null ? null : p.getDateStartProject().toString());
    info.put("dateEndProject", p.getDateEndProject() == null ? null : p.getDateEndProject().toString());

    ObjectNode cadastre = objectMapper.createObjectNode();
    cadastre.put("number", p.getCadastreNumber());
    cadastre.put("area", p.getLandPlotAreaM2() == null ? null : p.getLandPlotAreaM2().doubleValue());

    ObjectNode out = objectMapper.createObjectNode();
    out.set("info", info);
    out.set("cadastreData", cadastre);
    return out;
  }

  @Transactional
  public JsonNode upsertParticipant(UUID projectId, String role, UpsertProjectParticipantRequest request) {
    Project project = getProject(projectId);
    ProjectParticipant entity = entityManager.createQuery(
            "select p from ProjectParticipant p where p.project.id = :projectId and p.role = :role", ProjectParticipant.class)
        .setParameter("projectId", projectId)
        .setParameter("role", role)
        .getResultStream()
        .findFirst()
        .orElseGet(() -> ProjectParticipant.builder().project(project).role(role).build());
    JsonNode data = request == null ? null : request.data();
    entity.setName(text(data, "name"));
    entity.setInn(text(data, "inn"));
    entity = entityManager.merge(entity);

    ObjectNode node = objectMapper.createObjectNode();
    node.put("id", entity.getId().toString());
    node.put("role", entity.getRole());
    node.put("name", entity.getName());
    node.put("inn", entity.getInn());
    return node;
  }

  @Transactional
  public JsonNode upsertDocument(UUID projectId, UpsertProjectDocumentRequest request) {
    Project project = getProject(projectId);
    JsonNode data = request == null ? null : request.doc();
    UUID id = parseUuidOrNull(text(data, "id"));
    ProjectDocument doc = id == null ? null : entityManager.find(ProjectDocument.class, id);
    if (doc == null) {
      doc = ProjectDocument.builder().project(project).build();
    }
    doc.setName(text(data, "name"));
    doc.setDocType(text(data, "docType"));
    doc.setDocNumber(text(data, "docNumber"));
    doc.setFileUrl(text(data, "fileUrl"));
    String date = text(data, "docDate");
    doc.setDocDate(date == null || date.isBlank() ? null : LocalDate.parse(date));
    doc = entityManager.merge(doc);

    ObjectNode node = objectMapper.createObjectNode();
    node.put("id", doc.getId().toString());
    node.put("name", doc.getName());
    node.put("docType", doc.getDocType());
    node.put("docNumber", doc.getDocNumber());
    node.put("fileUrl", doc.getFileUrl());
    node.put("docDate", doc.getDocDate() == null ? null : doc.getDocDate().toString());
    return node;
  }

  @Transactional
  public void deleteProject(UUID projectId) {
    projectRepository.deleteById(projectId);
  }

  @Transactional
  public void deleteProjectGeometryCandidate(UUID projectId, UUID candidateId) {
    projectGeometryCandidateRepository.findByIdAndProjectId(candidateId, projectId)
        .ifPresent(projectGeometryCandidateRepository::delete);
  }

  @Transactional
  public void deleteProjectDocument(UUID documentId) {
    entityManager.createQuery("delete from ProjectDocument d where d.id = :id")
        .setParameter("id", documentId)
        .executeUpdate();
  }

  @Transactional(readOnly = true)
  public JsonNode parkingCounts(UUID projectId) {
    List<BlockEntity> blocks = entityManager.createQuery(
            "select b from BlockEntity b where b.building.projectId = :projectId", BlockEntity.class)
        .setParameter("projectId", projectId)
        .getResultList();
    int total = blocks.stream().mapToInt(b -> b.getVehicleEntries() == null ? 0 : b.getVehicleEntries()).sum();
    ObjectNode node = objectMapper.createObjectNode();
    node.put("total", total);
    return node;
  }

  @Transactional(readOnly = true)
  public UUID resolveApplicationId(UUID projectId) {
    return applicationRepository.findFirstByProjectIdOrderByCreatedAtDesc(projectId)
        .map(ApplicationEntity::getId)
        .orElse(null);
  }

  public boolean validateProjectStep(UUID projectId, ValidateProjectStepRequest request) {
    getProject(projectId);
    String stepId = request == null ? null : trim(request.stepId());
    if (stepId == null || stepId.isBlank()) {
      return false;
    }
    if ("passport".equalsIgnoreCase(stepId)) {
      Project project = getProject(projectId);
      return project.getName() != null && !project.getName().isBlank() && project.getAddress() != null && !project.getAddress().isBlank();
    }
    if ("registry".equalsIgnoreCase(stepId)) {
      return !buildingRepository.findByProjectId(projectId).isEmpty();
    }
    return true;
  }

  @Transactional
  public void saveContextMeta(UUID projectId, SaveProjectContextMetaRequest request) {
    JsonNode info = request == null ? null : request.complexInfo();
    entityManager.createNativeQuery("""
        update projects
           set name = coalesce(:name, name),
               address = coalesce(:address, address),
               region = coalesce(:region, region),
               district = coalesce(:district, district),
               updated_at = now()
         where id = :projectId
        """)
        .setParameter("name", text(info, "name"))
        .setParameter("address", text(info, "address"))
        .setParameter("region", text(info, "region"))
        .setParameter("district", text(info, "district"))
        .setParameter("projectId", projectId)
        .executeUpdate();
  }

  @Transactional
  public void saveStepBlockStatuses(UUID projectId, SaveStepBlockStatusesRequest request) {
    JsonNode statuses = request == null ? null : request.statuses();
    List<BuildingEntity> buildings = buildingRepository.findByProjectId(projectId);
    for (BuildingEntity building : buildings) {
      for (BlockEntity block : building.getBlocks()) {
        JsonNode statusNode = statuses == null ? null : statuses.get(block.getId().toString());
        if (statusNode != null && !statusNode.isNull()) {
          block.setType(statusNode.asText(block.getType()));
        }
      }
    }
  }

  @Transactional
  public void saveBuildingDetails(UUID projectId, SaveProjectBuildingDetailsRequest request) {
    JsonNode details = request == null ? null : request.buildingDetails();
    if (details == null || !details.isArray()) {
      return;
    }
    for (JsonNode item : details) {
      UUID buildingId = parseUuidOrNull(text(item, "id"));
      if (buildingId == null) {
        continue;
      }
      BuildingEntity building = buildingRepository.findById(buildingId).orElse(null);
      if (building == null || !projectId.equals(building.getProjectId())) {
        continue;
      }
      building.setLabel(text(item, "label") == null ? building.getLabel() : text(item, "label"));
      building.setHouseNumber(text(item, "house_number") == null ? building.getHouseNumber() : text(item, "house_number"));
      building.setConstructionType(text(item, "construction_type") == null ? building.getConstructionType() : text(item, "construction_type"));
      building.setParkingType(text(item, "parking_type") == null ? building.getParkingType() : text(item, "parking_type"));
    }
  }

  @Transactional
  public UUID selectBuildingGeometry(UUID projectId, UUID buildingId, SelectBuildingGeometryRequest request) {
    UUID candidateId = parseUuidOrNull(request == null ? null : request.candidateId());
    if (candidateId == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "candidateId is required");
    }
    approveProjectGeometryCandidate(projectId, candidateId, buildingId, false);
    return candidateId;
  }

  @Transactional
  public UUID selectLandPlot(UUID projectId, SelectProjectLandPlotRequest request) {
    UUID candidateId = parseUuidOrNull(request == null ? null : request.candidateId());
    if (candidateId == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "candidateId is required");
    }
    approveProjectGeometryCandidate(projectId, candidateId, null, true);
    return candidateId;
  }

  @Transactional
  public void unselectLandPlot(UUID projectId) {
    entityManager.createNativeQuery("update project_geometry_candidates set is_selected_land_plot = false where project_id = :projectId")
        .setParameter("projectId", projectId)
        .executeUpdate();
    entityManager.createNativeQuery("update projects set land_plot_geojson = null, land_plot_area_m2 = null where id = :projectId")
        .setParameter("projectId", projectId)
        .executeUpdate();
  }

  @Transactional(readOnly = true)
  public JsonNode tepSummary(UUID projectId) {
    ObjectNode node = objectMapper.createObjectNode();
    node.put("projectId", projectId.toString());
    node.put("buildingsCount", buildingRepository.findByProjectId(projectId).size());
    return node;
  }

  @Transactional(readOnly = true)
  public List<JsonNode> basementsByBuildingIds(List<UUID> buildingIds) {
    if (buildingIds == null || buildingIds.isEmpty()) {
      return List.of();
    }
    List<BlockEntity> blocks = entityManager.createQuery(
            "select b from BlockEntity b where b.building.id in :buildingIds and coalesce(b.hasBasement, false) = true", BlockEntity.class)
        .setParameter("buildingIds", buildingIds)
        .getResultList();
    return blocks.stream().map(this::toBasementJson).toList();
  }

  @Transactional
  public JsonNode toggleBasementLevel(UUID basementId, Integer level, Boolean isEnabled) {
    BlockEntity block = entityManager.find(BlockEntity.class, basementId);
    if (block == null) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Basement block not found");
    }
    Map<String, Object> levels = block.getBasementParkingLevels() == null ? new LinkedHashMap<>() : new LinkedHashMap<>(block.getBasementParkingLevels());
    String key = String.valueOf(level == null ? 0 : level);
    if (Boolean.TRUE.equals(isEnabled)) {
      levels.put(key, Boolean.TRUE);
    } else {
      levels.remove(key);
    }
    block.setBasementParkingLevels(levels);
    ObjectNode node = objectMapper.createObjectNode();
    node.put("basementId", basementId.toString());
    node.put("level", level);
    node.put("isEnabled", Boolean.TRUE.equals(isEnabled));
    return node;
  }

  @Transactional
  public JsonNode syncParkingPlaces(UUID floorId, Integer targetCount) {
    int count = targetCount == null ? 0 : Math.max(0, targetCount);
    FloorEntity floor = entityManager.find(FloorEntity.class, floorId);
    if (floor == null) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Floor not found");
    }
    List<UnitEntity> existing = entityManager.createQuery(
            "select u from UnitEntity u where u.floor.id = :floorId and u.unitType = 'parking'", UnitEntity.class)
        .setParameter("floorId", floorId)
        .getResultList();
    if (existing.size() > count) {
      existing.subList(count, existing.size()).forEach(entityManager::remove);
    } else if (existing.size() < count) {
      for (int i = existing.size(); i < count; i++) {
        UnitEntity unit = UnitEntity.builder()
            .floor(floor)
            .block(floor.getBlock())
            .unitType("parking")
            .hasMezzanine(false)
            .number("P" + (i + 1))
            .status("draft")
            .build();
        entityManager.persist(unit);
      }
    }
    ObjectNode out = objectMapper.createObjectNode();
    out.put("floorId", floorId.toString());
    out.put("targetCount", count);
    out.put("actualCount", count);
    return out;
  }

  private JsonNode toBasementJson(BlockEntity b) {
    ObjectNode node = objectMapper.createObjectNode();
    node.put("basementId", b.getId() == null ? null : b.getId().toString());
    node.put("blockId", b.getId() == null ? null : b.getId().toString());
    node.put("buildingId", b.getBuilding() == null || b.getBuilding().getId() == null ? null : b.getBuilding().getId().toString());
    node.put("label", b.getLabel());
    node.put("depth", b.getBasementDepth());
    node.set("parkingLevels", objectMapper.valueToTree(b.getBasementParkingLevels() == null ? Map.of() : b.getBasementParkingLevels()));
    return node;
  }

  @Transactional(readOnly = true)
  public List<JsonNode> basements(UUID projectId) {
    List<BlockEntity> blocks = entityManager.createQuery(
            "select b from BlockEntity b where b.building.projectId = :projectId and coalesce(b.hasBasement, false) = true", BlockEntity.class)
        .setParameter("projectId", projectId)
        .getResultList();
    return blocks.stream().map(this::toBasementJson).toList();
  }

  private Project getProject(UUID projectId) {
    return projectRepository.findById(projectId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project not found"));
  }


  private void ensureNoActiveReapplication(String scope, JsonNode appData) {
    String reapplicationForProjectIdRaw = text(appData, "reapplicationForProjectId");
    String normalizedCadastre = formatComplexCadastre(text(appData, "cadastre"));

    if ((reapplicationForProjectIdRaw == null || reapplicationForProjectIdRaw.isBlank())
        && (normalizedCadastre == null || normalizedCadastre.isBlank())) {
      return;
    }

    UUID reapplicationForProjectId = parseUuidOrNull(reapplicationForProjectIdRaw);

    String sql = """
        select a.id, p.id, p.name
          from applications a
          join projects p on p.id = a.project_id
         where a.scope_id = :scope
           and a.status = 'IN_PROGRESS'
           and (
              (:projectId is not null and a.project_id = :projectId)
              or (:projectId is null and :cadastre is not null and p.cadastre_number = :cadastre)
           )
         limit 1
        """;
    @SuppressWarnings("unchecked")
    List<Object[]> rows = entityManager.createNativeQuery(sql)
        .setParameter("scope", scope)
        .setParameter("projectId", reapplicationForProjectId)
        .setParameter("cadastre", normalizedCadastre)
        .getResultList();

    if (rows.isEmpty()) {
      return;
    }

    Object[] active = rows.get(0);
    UUID activeProjectId = active[1] instanceof UUID id ? id : null;
    String projectName = null;
    if (activeProjectId != null) {
      projectName = projectRepository.findByIdAndScopeId(activeProjectId, scope).map(Project::getName).orElse(null);
    }
    if (projectName == null || projectName.isBlank()) {
      projectName = active[2] == null ? "ЖК" : String.valueOf(active[2]);
    }

    throw new ResponseStatusException(
        HttpStatus.CONFLICT,
        "Отказ в принятии: по " + projectName + " уже есть активное заявление в работе. Повторная подача отклонена."
    );
  }

  private static UUID parseUuidOrNull(String value) {
    if (value == null || value.isBlank()) {
      return null;
    }
    try {
      return UUID.fromString(value);
    } catch (IllegalArgumentException ignored) {
      return null;
    }
  }

  private static String formatComplexCadastre(String value) {
    if (value == null || value.isBlank()) {
      return null;
    }
    String digits = value.replaceAll("\\D", "");
    int[] groups = {2, 2, 2, 2, 2, 4};
    StringBuilder out = new StringBuilder();
    int offset = 0;
    for (int group : groups) {
      if (offset >= digits.length()) {
        break;
      }
      int end = Math.min(digits.length(), offset + group);
      if (out.length() > 0) {
        out.append(':');
      }
      out.append(digits, offset, end);
      offset = end;
    }
    return out.toString();
  }

  private String generateNextProjectCode(String scope) {
    Object raw = entityManager.createNativeQuery("""
        select uj_code
          from projects
         where scope_id = :scope
           and uj_code is not null
         order by uj_code desc
         limit 1
        """)
        .setParameter("scope", scope)
        .getResultStream()
        .findFirst()
        .orElse(null);

    int next = 1;
    if (raw instanceof String code && code.startsWith("UJ")) {
      try {
        next = Integer.parseInt(code.substring(2)) + 1;
      } catch (NumberFormatException ignored) {
        next = 1;
      }
    }
    return "UJ" + String.format("%06d", next);
  }


  private JsonNode toProjectListItem(Project project) {
    ObjectNode node = objectMapper.createObjectNode();
    node.put("id", project.getId() == null ? null : project.getId().toString());
    node.put("name", project.getName());
    node.put("ujCode", project.getUjCode());
    node.put("status", project.getConstructionStatus());
    node.put("region", project.getRegion());
    node.put("address", project.getAddress());
    node.put("updatedAt", project.getUpdatedAt() == null ? null : project.getUpdatedAt().toString());
    return node;
  }


  private static String trim(String value) {
    return value == null ? null : value.trim();
  }

  private static String text(JsonNode node, String field) {
    if (node == null || node.get(field) == null || node.get(field).isNull()) {
      return null;
    }
    return node.get(field).asText();
  }

  private static LocalDate toDate(JsonNode node, String field) {
    String value = text(node, field);
    if (value == null || value.isBlank()) {
      return null;
    }
    try {
      return LocalDate.parse(value);
    } catch (DateTimeParseException ex) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Некорректная дата: " + field);
    }
  }

  private static Double toDouble(JsonNode node, String field) {
    String value = text(node, field);
    if (value == null || value.isBlank()) {
      return null;
    }
    try {
      return Double.parseDouble(value);
    } catch (NumberFormatException ex) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Некорректное число: " + field);
    }
  }

  private JsonNode toGeometryCandidateJson(ProjectGeometryCandidateEntity entity) {
    ObjectNode node = objectMapper.createObjectNode();
    node.put("id", entity.getId() == null ? null : entity.getId().toString());
    node.put("sourceIndex", entity.getSourceIndex());
    node.put("label", entity.getLabel());
    node.set("properties", entity.getProperties() == null ? objectMapper.createObjectNode() : entity.getProperties());
    node.set("geometry", entity.getGeomGeojson() == null ? objectMapper.createObjectNode() : entity.getGeomGeojson());
    if (entity.getAreaM2() == null) {
      node.putNull("areaM2");
    } else {
      node.put("areaM2", entity.getAreaM2());
    }
    node.put("isSelectedLandPlot", Boolean.TRUE.equals(entity.getIsSelectedLandPlot()));
    node.put("assignedBuildingId", entity.getAssignedBuildingId() == null ? null : entity.getAssignedBuildingId().toString());
    return node;
  }

  private JsonNode withReviewStatus(JsonNode properties, String status, String reason) {
    ObjectNode node = properties == null || !properties.isObject()
        ? objectMapper.createObjectNode()
        : properties.deepCopy();
    node.put("reviewStatus", status);
    if (reason == null || reason.isBlank()) {
      node.putNull("declineReason");
    } else {
      node.put("declineReason", reason);
    }
    return node;
  }

  private BigDecimal toBigDecimal(JsonNode value) {
    if (value == null || value.isNull()) {
      return null;
    }
    if (value.isNumber()) {
      return value.decimalValue();
    }
    try {
      return new BigDecimal(value.asText());
    } catch (NumberFormatException ex) {
      return null;
    }
  }

  private String toJson(JsonNode node) {
    try {
      return objectMapper.writeValueAsString(node == null ? objectMapper.createObjectNode() : node);
    } catch (Exception ex) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Failed to serialize geometry json");
    }
  }

  private JsonNode toBuildingHierarchy(BuildingEntity building) {
    ObjectNode b = objectMapper.createObjectNode();
    b.put("id", string(building.getId()));
    b.put("project_id", string(building.getProjectId()));
    b.put("building_code", building.getBuildingCode());
    b.put("label", building.getLabel());
    b.put("house_number", building.getHouseNumber());
    b.put("category", building.getCategory());
    b.put("construction_type", building.getConstructionType());
    b.put("parking_type", building.getParkingType());
    b.set("footprint_geojson", building.getFootprintGeojson() == null
        ? objectMapper.nullNode()
        : objectMapper.valueToTree(building.getFootprintGeojson()));

    ArrayNode blocks = objectMapper.createArrayNode();
    building.getBlocks().stream()
        .sorted(Comparator.comparing(BlockEntity::getLabel, Comparator.nullsLast(String::compareTo)))
        .forEach(block -> blocks.add(toBlockHierarchy(block)));
    b.set("building_blocks", blocks);
    return b;
  }

  private JsonNode toBlockHierarchy(BlockEntity block) {
    ObjectNode bl = objectMapper.createObjectNode();
    bl.put("id", string(block.getId()));
    bl.put("building_id", block.getBuilding() == null ? null : string(block.getBuilding().getId()));
    bl.put("label", block.getLabel());
    bl.put("type", block.getType());

    ObjectNode construction = objectMapper.createObjectNode();
    if (block.getBlockConstruction() != null) {
      construction.put("id", string(block.getBlockConstruction().getId()));
      construction.put("block_id", string(block.getId()));
      construction.put("foundation", block.getBlockConstruction().getFoundation());
      construction.put("walls", block.getBlockConstruction().getWalls());
      construction.put("slabs", block.getBlockConstruction().getSlabs());
      construction.put("roof", block.getBlockConstruction().getRoof());
      construction.put("seismicity", block.getBlockConstruction().getSeismicity());
    }
    bl.set("block_construction", construction);

    ObjectNode engineering = objectMapper.createObjectNode();
    if (block.getBlockEngineering() != null) {
      engineering.put("id", string(block.getBlockEngineering().getId()));
      engineering.put("block_id", string(block.getId()));
      engineering.put("has_electricity", Boolean.TRUE.equals(block.getBlockEngineering().getHasElectricity()));
      engineering.put("has_water", Boolean.TRUE.equals(block.getBlockEngineering().getHasWater()));
      engineering.put("has_hot_water", Boolean.TRUE.equals(block.getBlockEngineering().getHasHotWater()));
      engineering.put("has_sewerage", Boolean.TRUE.equals(block.getBlockEngineering().getHasSewerage()));
      engineering.put("has_gas", Boolean.TRUE.equals(block.getBlockEngineering().getHasGas()));
      engineering.put("has_heating_local", Boolean.TRUE.equals(block.getBlockEngineering().getHasHeatingLocal()));
      engineering.put("has_heating_central", Boolean.TRUE.equals(block.getBlockEngineering().getHasHeatingCentral()));
      engineering.put("has_heating", Boolean.TRUE.equals(block.getBlockEngineering().getHasHeating()));
      engineering.put("has_ventilation", Boolean.TRUE.equals(block.getBlockEngineering().getHasVentilation()));
      engineering.put("has_firefighting", Boolean.TRUE.equals(block.getBlockEngineering().getHasFirefighting()));
      engineering.put("has_lowcurrent", Boolean.TRUE.equals(block.getBlockEngineering().getHasLowcurrent()));
      engineering.put("has_internet", Boolean.TRUE.equals(block.getBlockEngineering().getHasInternet()));
      engineering.put("has_solar_panels", Boolean.TRUE.equals(block.getBlockEngineering().getHasSolarPanels()));
    }
    bl.set("block_engineering", engineering);

    ArrayNode entrances = objectMapper.createArrayNode();
    block.getEntrances().stream()
        .sorted(Comparator.comparing(EntranceEntity::getNumber, Comparator.nullsLast(Integer::compareTo)))
        .forEach(e -> {
          ObjectNode en = objectMapper.createObjectNode();
          en.put("id", string(e.getId()));
          en.put("number", e.getNumber());
          entrances.add(en);
        });
    bl.set("entrances", entrances);

    ArrayNode floors = objectMapper.createArrayNode();
    block.getFloors().stream()
        .sorted(Comparator.comparing(FloorEntity::getFloorIndex, Comparator.nullsLast(Integer::compareTo)))
        .forEach(f -> floors.add(toFloorHierarchy(f)));
    bl.set("floors", floors);
    return bl;
  }

  private JsonNode toFloorHierarchy(FloorEntity floor) {
    ObjectNode f = objectMapper.createObjectNode();
    f.put("id", string(floor.getId()));
    f.put("index", floor.getFloorIndex());
    f.put("floor_key", floor.getFloorKey());
    f.put("label", floor.getLabel());
    f.put("floor_type", floor.getFloorType());
    f.put("area_proj", floor.getAreaProj() == null ? null : floor.getAreaProj().doubleValue());
    f.put("area_fact", floor.getAreaFact() == null ? null : floor.getAreaFact().doubleValue());

    ArrayNode units = objectMapper.createArrayNode();
    floor.getUnits().stream()
        .sorted(Comparator.comparing(UnitEntity::getNumber, Comparator.nullsLast(String::compareTo)))
        .forEach(u -> {
          ObjectNode un = objectMapper.createObjectNode();
          un.put("id", string(u.getId()));
          un.put("number", u.getNumber());
          un.put("unit_type", u.getUnitType());
          un.put("total_area", u.getTotalArea() == null ? null : u.getTotalArea().doubleValue());
          un.put("rooms_count", u.getRoomsCount());
          units.add(un);
        });
    f.set("units", units);

    ArrayNode rooms = objectMapper.createArrayNode();
    floor.getCommonAreas().stream()
        .sorted(Comparator.comparing(CommonAreaEntity::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder())))
        .forEach(ca -> {
          ObjectNode room = objectMapper.createObjectNode();
          room.put("id", string(ca.getId()));
          room.put("entrance_id", ca.getEntrance() == null ? null : string(ca.getEntrance().getId()));
          room.put("type", ca.getType());
          room.put("area", ca.getArea() == null ? null : ca.getArea().doubleValue());
          room.put("height", ca.getHeight() == null ? null : ca.getHeight().doubleValue());
          rooms.add(room);
        });
    f.set("rooms", rooms);

    return f;
  }

  private String string(UUID value) {
    return value == null ? null : value.toString();
  }

}
