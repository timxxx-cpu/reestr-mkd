package uz.reestrmkd.backendjpa.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import jakarta.persistence.Tuple;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import uz.reestrmkd.backendjpa.repo.ApplicationRepository;
import uz.reestrmkd.backendjpa.repo.ProjectRepository;

import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
public class ProjectJpaService {
    private final ProjectRepository projects;
    private final ApplicationRepository applications;
    private final uz.reestrmkd.backendjpa.repo.ApplicationStepRepository applicationSteps;
    private final uz.reestrmkd.backendjpa.repo.ApplicationHistoryRepository applicationHistory;
    private final ObjectMapper objectMapper;
    private final uz.reestrmkd.backendjpa.repo.BuildingRepository buildingsRepo;
    private final uz.reestrmkd.backendjpa.repo.BuildingBlockRepository blocksRepo;
    private final uz.reestrmkd.backendjpa.repo.BlockConstructionRepository blockConstructionRepo;
    private final uz.reestrmkd.backendjpa.repo.BlockEngineeringRepository blockEngineeringRepo;
    private final uz.reestrmkd.backendjpa.repo.BlockFloorMarkerRepository markersRepo;
    private final uz.reestrmkd.backendjpa.repo.FloorRepository floorRepo;
    private final uz.reestrmkd.backendjpa.repo.UnitRepository unitRepo;
    private final uz.reestrmkd.backendjpa.repo.ProjectParticipantRepository participantsRepo;
    private final uz.reestrmkd.backendjpa.repo.ProjectDocumentRepository documentsRepo;
    private final uz.reestrmkd.backendjpa.repo.EntranceRepository entranceRepo;
    private final uz.reestrmkd.backendjpa.repo.EntranceMatrixRepository entranceMatrixRepo;
    private final uz.reestrmkd.backendjpa.repo.CommonAreaRepository commonAreaRepo;
    private final uz.reestrmkd.backendjpa.repo.BlockExtensionRepository blockExtensionRepo;
    private final uz.reestrmkd.backendjpa.repo.RoomRepository roomRepo;
    private final uz.reestrmkd.backendjpa.repo.ProjectGeometryCandidateRepository geometryCandidateRepo;

    @PersistenceContext
    private EntityManager em;

    public Map<String, Object> list(String scope,
                                    String status,
                                    String workflowSubstatus,
                                    String assignee,
                                    String search,
                                    Integer pageRaw,
                                    Integer limitRaw,
                                    String actorUserId,
                                    String actorRole) {
        if (scope == null || scope.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Scope is required");
        }

        int page = pageRaw == null ? 1 : Math.max(1, pageRaw);
        int limit = Math.min(100, Math.max(1, limitRaw == null ? 1000 : limitRaw));

        Set<String> statuses = parseCsvValues(status);
        Set<String> workflowSubstatuses = parseCsvValues(workflowSubstatus);

        List<uz.reestrmkd.backendjpa.domain.ApplicationEntity> appsData = applications.findByScopeId(scope);
        List<uz.reestrmkd.backendjpa.domain.ApplicationEntity> filteredApps = new ArrayList<>();
        for (var app : appsData) {
            if (!statuses.isEmpty() && !statuses.contains(stringVal(app.getStatus()))) continue;
            if (!workflowSubstatuses.isEmpty() && !workflowSubstatuses.contains(stringVal(app.getWorkflowSubstatus()))) continue;

            String assigneeName = stringVal(app.getAssigneeName());
            if (assignee != null && !assignee.isBlank()) {
                if ("mine".equals(assignee)) {
                    if (actorUserId == null || actorUserId.isBlank()) {
                        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Auth context required for assignee=mine");
                    }
                    if (!actorUserId.equals(assigneeName)) continue;
                } else if (!"all".equals(assignee) && !assignee.equals(assigneeName)) {
                    continue;
                }
            }

            if (search != null && !search.isBlank()) {
                String lower = search.toLowerCase(Locale.ROOT);
                if (!(containsIgnoreCase(app.getInternalNumber(), lower)
                    || containsIgnoreCase(app.getExternalId(), lower)
                    || containsIgnoreCase(app.getApplicant(), lower)
                    || containsIgnoreCase(app.getAssigneeName(), lower))) {
                    continue;
                }
            }
            filteredApps.add(app);
        }

        Set<String> projectIds = filteredApps.stream().map(uz.reestrmkd.backendjpa.domain.ApplicationEntity::getProjectId)
            .filter(Objects::nonNull).collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));

        List<uz.reestrmkd.backendjpa.domain.ProjectEntity> scopedProjects = projects.findByScopeIdOrderByIdDesc(scope);
        if (projectIds.isEmpty() && statuses.isEmpty() && workflowSubstatuses.isEmpty() && (assignee == null || assignee.isBlank()) && (search == null || search.isBlank())) {
            projectIds = scopedProjects.stream().map(uz.reestrmkd.backendjpa.domain.ProjectEntity::getId).filter(Objects::nonNull)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
        }

        if (projectIds.isEmpty()) {
            return Map.of("items", List.of(), "page", page, "limit", limit, "total", 0, "totalPages", 0);
        }

        final Set<String> selectedProjectIds = projectIds;
        List<uz.reestrmkd.backendjpa.domain.ProjectEntity> projectRows = scopedProjects.stream()
            .filter(pj -> selectedProjectIds.contains(pj.getId())).toList();

        Map<String, uz.reestrmkd.backendjpa.domain.ApplicationEntity> appByProject = new LinkedHashMap<>();
        for (var app : filteredApps) {
            if (app.getProjectId() != null && !appByProject.containsKey(app.getProjectId())) {
                appByProject.put(app.getProjectId(), app);
            }
        }

        Map<String, Integer> buildingsCountByProject = new LinkedHashMap<>();
        List<uz.reestrmkd.backendjpa.domain.BuildingEntity> buildingRows = buildingsRepo.findByProjectIdIn(new ArrayList<>(selectedProjectIds));
        for (var b : buildingRows) {
            if (b.getProjectId() == null) continue;
            buildingsCountByProject.put(b.getProjectId(), buildingsCountByProject.getOrDefault(b.getProjectId(), 0) + 1);
        }

        List<Map<String, Object>> mapped = new ArrayList<>();
        for (var project : projectRows) {
            var app = appByProject.get(project.getId());
            Map<String, Object> applicationInfo = new LinkedHashMap<>();
            applicationInfo.put("status", app == null ? null : app.getStatus());
            applicationInfo.put("workflowSubstatus", app == null ? "DRAFT" : app.getWorkflowSubstatus());
            applicationInfo.put("internalNumber", app == null ? null : app.getInternalNumber());
            applicationInfo.put("externalSource", app == null ? null : app.getExternalSource());
            applicationInfo.put("externalId", app == null ? null : app.getExternalId());
            applicationInfo.put("applicant", app == null ? null : app.getApplicant());
            applicationInfo.put("submissionDate", app == null ? null : formatApiTimestamp(app.getSubmissionDate()));
            applicationInfo.put("assigneeName", app == null ? null : app.getAssigneeName());
            applicationInfo.put("currentStage", app == null ? null : app.getCurrentStage());
            applicationInfo.put("currentStepIndex", app == null ? null : app.getCurrentStep());
            applicationInfo.put("requestedDeclineReason", app == null ? null : app.getRequestedDeclineReason());
            applicationInfo.put("requestedDeclineStep", app == null ? null : app.getRequestedDeclineStep());
            applicationInfo.put("requestedDeclineBy", app == null ? null : app.getRequestedDeclineBy());
            applicationInfo.put("requestedDeclineAt", app == null ? null : formatApiTimestamp(app.getRequestedDeclineAt()));

            String projectStatus = normalizeProjectStatusFromDb(project.getConstructionStatus());
            String lastModified = app !=null
                ? formatApiTimestamp(app.getUpdatedAt())
                : formatApiTimestamp(project.getUpdatedAt());

            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", project.getId());
            item.put("ujCode", project.getUjCode());
            item.put("cadastre", project.getCadastreNumber());
            item.put("applicationId", app == null ? null : app.getId());
            item.put("name", project.getName() == null ? "Без названия" : project.getName());
            item.put("status", projectStatus);
            item.put("lastModified", lastModified);
            item.put("applicationInfo", applicationInfo);
            Map<String, Object> complexInfo = new LinkedHashMap<>();
            complexInfo.put("name", project.getName());
            complexInfo.put("region", project.getRegion());
            complexInfo.put("street", project.getAddress());
            complexInfo.put("addressId", project.getAddressId());
            item.put("complexInfo", complexInfo);
            item.put("composition", java.util.Collections.nCopies(buildingsCountByProject.getOrDefault(project.getId(), 0), 1));
            item.put("availableActions", buildProjectAvailableActions(actorRole, app, actorUserId));
            mapped.add(item);
        }

        if (search != null && !search.isBlank()) {
            String lower = search.toLowerCase(Locale.ROOT);
            mapped = new ArrayList<>(mapped.stream().filter(pj ->
                containsIgnoreCase(pj.get("name"), lower)
                    || containsIgnoreCase(pj.get("ujCode"), lower)
                    || containsIgnoreCase(((Map<String, Object>) pj.get("applicationInfo")).get("internalNumber"), lower)
                    || containsIgnoreCase(((Map<String, Object>) pj.get("applicationInfo")).get("externalId"), lower)
                    || containsIgnoreCase(((Map<String, Object>) pj.get("complexInfo")).get("street"), lower)
                    || containsIgnoreCase(((Map<String, Object>) pj.get("applicationInfo")).get("assigneeName"), lower)
            ).toList());
        }

        mapped.sort((a, b) -> {
            String aa = stringVal(a.get("lastModified"));
            String bb = stringVal(b.get("lastModified"));
            if (aa == null && bb == null) return 0;
            if (aa == null) return 1;
            if (bb == null) return -1;
            return bb.compareTo(aa);
        });

        int total = mapped.size();
        int from = (page - 1) * limit;
        List<Map<String, Object>> items = from >= total ? List.of() : mapped.subList(from, Math.min(from + limit, total));

        return Map.of(
            "items", items,
            "page", page,
            "limit", limit,
            "total", total,
            "totalPages", total > 0 ? (int) Math.ceil((double) total / limit) : 0
        );
    }

    @Transactional(readOnly = true)
    public Map<String, Object> mapOverview(String scope) {
        if (scope == null || scope.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Scope is required");
        }

        List<uz.reestrmkd.backendjpa.domain.ProjectEntity> projectEntities = projects.findByScopeIdOrderByIdDesc(scope);
        List<String> projectIds = projectEntities.stream().map(uz.reestrmkd.backendjpa.domain.ProjectEntity::getId).filter(Objects::nonNull).toList();

        List<uz.reestrmkd.backendjpa.domain.ApplicationEntity> applicationEntities = applications.findByScopeId(scope);
        Map<String, String> statusByProject = new LinkedHashMap<>();
        for (var app : applicationEntities) {
            if (app.getProjectId() != null && !statusByProject.containsKey(app.getProjectId())) {
                statusByProject.put(app.getProjectId(), app.getStatus());
            }
        }

        List<uz.reestrmkd.backendjpa.domain.BuildingEntity> buildingEntities = projectIds.isEmpty()
            ? List.of()
            : buildingsRepo.findByProjectIdIn(projectIds);
        List<String> buildingIds = buildingEntities.stream().map(uz.reestrmkd.backendjpa.domain.BuildingEntity::getId).filter(Objects::nonNull).toList();

        List<uz.reestrmkd.backendjpa.domain.BuildingBlockEntity> blockEntities = buildingIds.isEmpty()
            ? List.of()
            : blocksRepo.findByBuildingIdIn(buildingIds);
        List<String> blockIds = blockEntities.stream().map(uz.reestrmkd.backendjpa.domain.BuildingBlockEntity::getId).filter(Objects::nonNull).toList();

        List<uz.reestrmkd.backendjpa.domain.FloorEntity> floorEntities = blockIds.isEmpty()
            ? List.of()
            : floorRepo.findByBlockIdIn(blockIds);
        List<String> floorIds = floorEntities.stream().map(uz.reestrmkd.backendjpa.domain.FloorEntity::getId).filter(Objects::nonNull).toList();

        List<uz.reestrmkd.backendjpa.domain.UnitEntity> unitEntities = floorIds.isEmpty()
            ? List.of()
            : unitRepo.findByFloorIdIn(floorIds);

        Map<String, List<uz.reestrmkd.backendjpa.domain.BuildingBlockEntity>> blocksByBuilding = new LinkedHashMap<>();
        for (var b : blockEntities) {
            if (b.getBuildingId() == null) continue;
            blocksByBuilding.computeIfAbsent(b.getBuildingId(), k -> new ArrayList<>()).add(b);
        }

        Map<String, List<uz.reestrmkd.backendjpa.domain.FloorEntity>> floorsByBlock = new LinkedHashMap<>();
        for (var f : floorEntities) {
            if (f.getBlockId() == null) continue;
            floorsByBlock.computeIfAbsent(f.getBlockId(), k -> new ArrayList<>()).add(f);
        }

        Map<String, List<uz.reestrmkd.backendjpa.domain.UnitEntity>> unitsByFloor = new LinkedHashMap<>();
        for (var u : unitEntities) {
            if (u.getFloorId() == null) continue;
            unitsByFloor.computeIfAbsent(u.getFloorId(), k -> new ArrayList<>()).add(u);
        }

        Map<String, List<Map<String, Object>>> buildingsByProject = new LinkedHashMap<>();
        for (var row : buildingEntities) {
            String projectId = row.getProjectId();
            String buildingId = row.getId();
            if (projectId == null || buildingId == null) continue;

            List<uz.reestrmkd.backendjpa.domain.BuildingBlockEntity> blocks = blocksByBuilding.getOrDefault(buildingId, List.of());
            List<uz.reestrmkd.backendjpa.domain.BuildingBlockEntity> regularBlocks = blocks.stream()
                .filter(block -> !Boolean.TRUE.equals(block.getIsBasementBlock()))
                .toList();

            int floorsMax = 0;
            List<uz.reestrmkd.backendjpa.domain.FloorEntity> floors = new ArrayList<>();
            for (var block : regularBlocks) {
                floorsMax = Math.max(floorsMax, toInt(block.getFloorsCount()));
                floors.addAll(floorsByBlock.getOrDefault(block.getId(), List.of()));
            }

            List<uz.reestrmkd.backendjpa.domain.UnitEntity> units = new ArrayList<>();
            for (var floor : floors) {
                units.addAll(unitsByFloor.getOrDefault(floor.getId(), List.of()));
            }

            int apartmentsCount = (int) units.stream()
                .filter(unit -> "apartment".equals(stringVal(unit.getUnitType())))
                .count();

            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", row.getId());
            item.put("label", row.getLabel());
            item.put("buildingCode", row.getBuildingCode());
            item.put("houseNumber", row.getHouseNumber());
            item.put("house_number", row.getHouseNumber());
            item.put("category", row.getCategory());
            item.put("blocksCount", regularBlocks.size());
            item.put("floorsMax", floorsMax > 0 ? floorsMax : null);
            item.put("unitsCount", units.size());
            item.put("apartmentsCount", apartmentsCount);
            item.put("address", row.getHouseNumber() == null ? null : "д. " + row.getHouseNumber());
            item.put("geometry", row.getFootprintGeojson());
            item.put("blocks", regularBlocks.stream().map(block -> {
                Map<String, Object> blockPayload = new LinkedHashMap<>();
                blockPayload.put("id", block.getId());
                blockPayload.put("label", block.getLabel());
                blockPayload.put("floorsCount", toInt(block.getFloorsCount()));
                blockPayload.put("geometry", block.getFootprintGeojson());
                return blockPayload;
            }).toList());

            buildingsByProject.computeIfAbsent(projectId, k -> new ArrayList<>()).add(item);
        }

        List<Map<String, Object>> items = new ArrayList<>();
        for (var row : projectEntities) {
            String projectId = row.getId();
            List<Map<String, Object>> projectBuildings = buildingsByProject.getOrDefault(projectId, List.of());

            Map<String, Integer> categoryStats = new LinkedHashMap<>();
            for (Map<String, Object> building : projectBuildings) {
                String category = stringVal(building.get("category"));
                if (category == null) category = "unknown";
                categoryStats.put(category, categoryStats.getOrDefault(category, 0) + 1);
            }

            List<Map<String, Object>> buildingTypeStats = new ArrayList<>();
            for (Map.Entry<String, Integer> entry : categoryStats.entrySet()) {
                buildingTypeStats.add(Map.of("category", entry.getKey(), "count", entry.getValue()));
            }

            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", row.getId());
            item.put("ujCode", row.getUjCode());
            item.put("name", row.getName());
            item.put("address", row.getAddress());
            item.put("status", statusByProject.getOrDefault(projectId, row.getConstructionStatus()));
            item.put("totalBuildings", projectBuildings.size());
            item.put("buildingTypeStats", buildingTypeStats);
            item.put("landPlotGeometry", row.getLandPlotGeojson());
            item.put("buildings", projectBuildings);
            items.add(item);
        }

        return Map.of("items", items);
    }

    public Map<String, Object> appId(String projectId, String scope) {
        if (scope == null || scope.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "scope is required");
        }
        var row = applications.findFirstByProjectIdAndScopeId(projectId, scope).orElse(null);
        if (row == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Application not found");
        return Map.of("applicationId", row.getId());
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> externalApplications(String scope) {
        if (scope == null || scope.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Scope is required");
        }
        return List.of(Map.of(
            "id", "EXT-10001",
            "source", "EPIGU",
            "externalId", "EP-2026-9912",
            "applicant", "ООО \"Golden House\"",
            "submissionDate", Instant.now().toString(),
            "cadastre", "10:10:10:10:10:0001",
            "address", "г. Ташкент, Шайхантахурский р-н, ул. Навои, 12",
            "status", "NEW",
            "scope", scope
        ));
    }

    @Transactional(readOnly = true)
    public Map<String, Object> summary(String scope) {
        if (scope == null || scope.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "scope is required");
        }

        List<uz.reestrmkd.backendjpa.domain.ApplicationEntity> rows = applications.findByScopeId(scope);

        Set<String> workSubstatuses = Set.of("DRAFT", "REVISION", "RETURNED_BY_MANAGER");
        Map<String, Object> counts = new LinkedHashMap<>();
        counts.put("work", 0);
        counts.put("review", 0);
        counts.put("integration", 0);
        counts.put("pendingDecline", 0);
        counts.put("declined", 0);
        counts.put("registryApplications", 0);
        counts.put("registryComplexes", 0);

        for (var row : rows) {
            String status = stringVal(row.getStatus());
            String sub = stringVal(row.getWorkflowSubstatus());
            if ("IN_PROGRESS".equals(status) && workSubstatuses.contains(sub)) counts.compute("work", (k, v) -> (Integer) v + 1);
            if ("REVIEW".equals(sub)) counts.compute("review", (k, v) -> (Integer) v + 1);
            if ("INTEGRATION".equals(sub)) counts.compute("integration", (k, v) -> (Integer) v + 1);
            if ("PENDING_DECLINE".equals(sub)) counts.compute("pendingDecline", (k, v) -> (Integer) v + 1);
            if ("DECLINED".equals(status)) counts.compute("declined", (k, v) -> (Integer) v + 1);
            if ("COMPLETED".equals(status) || "DECLINED".equals(status)) counts.compute("registryApplications", (k, v) -> (Integer) v + 1);
            if ("COMPLETED".equals(status)) counts.compute("registryComplexes", (k, v) -> (Integer) v + 1);
        }

        return counts;
    }

    @Transactional
    public Map<String, Object> fromApplication(Map<String, Object> body) {
        String scope = stringVal(body == null ? null : body.get("scope"));
        if (scope == null || scope.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "scope is required");
        }

        Map<String, Object> appData = mapFrom(body.get("appData"));
        String applicant = stringVal(appData.get("applicant"));
        String source = stringVal(appData.get("source"));
        String externalId = stringVal(appData.get("externalId"));
        String cadastre = stringVal(appData.get("cadastre"));

        // 1. Создаем проект через JPA
        var project = new uz.reestrmkd.backendjpa.domain.ProjectEntity();
        project.setScopeId(scope);
        project.setName(applicant != null ? "ЖК от " + applicant : "Новый проект");
        project.setConstructionStatus("Проектный");
        project.setCadastreNumber(cadastre);
        project.setUjCode("UJ" + String.format("%06d", System.currentTimeMillis() % 1000000)); // Временная генерация UJ-кода

        project = projects.save(project);

        // 2. Создаем заявку (Workflow)
        var app = new uz.reestrmkd.backendjpa.domain.ApplicationEntity();
        app.setProjectId(project.getId());
        app.setScopeId(scope);
        app.setInternalNumber("INT-" + (System.currentTimeMillis() % 1000000));
        app.setExternalSource(source);
        app.setExternalId(externalId);
        app.setApplicant(applicant);
        app.setSubmissionDate(java.time.Instant.now());
        app.setStatus("IN_PROGRESS");
        app.setWorkflowSubstatus("DRAFT");
        app.setCurrentStep(0);
        app.setCurrentStage(1);

        app = applications.save(app);

        return Map.of(
            "ok", true, 
            "projectId", project.getId(), 
            "applicationId", app.getId(),
            "ujCode", project.getUjCode()
        );
    }
    @Transactional
    public Map<String, Object> integrationStatus(String projectId, Map<String, Object> body) {
        var app = applications.findFirstByProjectId(projectId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Application not found"));

        String field = stringVal(body == null ? null : body.get("field"));
        if (field == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "field is required");
        }
        Object status = body == null ? null : body.get("status");
        if (status == null && body != null) status = body.get("integrationStatus");

        Map<String, Object> data = app.getIntegrationData() == null
            ? new java.util.HashMap<>()
            : new java.util.HashMap<>(app.getIntegrationData());
        data.put(field, status);
        app.setIntegrationData(data);
        applications.save(app);

        return Map.of("ok", true, "integrationData", data);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> geometryCandidates(String projectId) {
        List<Map<String, Object>> payload = new java.util.ArrayList<>();
        for (var row : geometryCandidateRepo.findByProjectIdOrderBySourceIndexAsc(projectId)) {
            Map<String, Object> map = new java.util.LinkedHashMap<>();
            map.put("id", row.getId());
            map.put("sourceIndex", row.getSourceIndex());
            map.put("label", row.getLabel());
            map.put("properties", row.getProperties() == null ? Map.of() : row.getProperties());
            map.put("geometry", row.getGeomGeojson() == null ? Map.of() : row.getGeomGeojson());
            map.put("areaM2", row.getAreaM2());
            map.put("isSelectedLandPlot", Boolean.TRUE.equals(row.getIsSelectedLandPlot()));
            map.put("assignedBuildingId", row.getAssignedBuildingId());
            payload.add(map);
        }
        return payload;
    }

    @Transactional
    public Map<String, Object> importGeometryCandidates(String projectId, List<Map<String, Object>> candidates) {
        if (candidates == null || candidates.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Candidates payload is required");
        }

        int imported = 0;
        for (Map<String, Object> candidate : candidates) {
            if (candidate == null || candidate.get("geometry") == null) continue;

            var entity = new uz.reestrmkd.backendjpa.domain.ProjectGeometryCandidateEntity();
            entity.setId(UUID.randomUUID().toString());
            entity.setProjectId(projectId);
            entity.setSourceIndex(toInt(candidate.get("sourceIndex")));
            entity.setLabel(candidate.get("label") == null ? null : String.valueOf(candidate.get("label")));
            entity.setProperties(mapFrom(candidate.getOrDefault("properties", Map.of())));
            entity.setGeomGeojson(mapFrom(candidate.get("geometry")));
            entity.setAreaM2(parseBigDecimal(candidate.get("areaM2")));
            entity.setAssignedBuildingId(stringVal(candidate.get("assignedBuildingId")));
            entity.setIsSelectedLandPlot(Boolean.TRUE.equals(candidate.get("isSelectedLandPlot")));
            geometryCandidateRepo.save(entity);
            imported += 1;
        }
        return Map.of("ok", true, "imported", imported);
    }

    @Transactional
    public Map<String, Object> selectLandPlot(String projectId, String candidateId) {
        if (candidateId == null || candidateId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "candidateId is required");
        }

        var project = projects.findById(projectId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project not found"));

        var selected = geometryCandidateRepo.findByIdAndProjectId(candidateId, projectId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Candidate not found"));

        geometryCandidateRepo.updateIsSelectedLandPlotByProjectId(projectId, false);
        int affected = geometryCandidateRepo.updateIsSelectedLandPlotByIdAndProjectId(candidateId, projectId, true);
        if (affected == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Candidate not found");
        }
        project.setLandPlotGeojson(selected.getGeomGeojson());
        project.setLandPlotAreaM2(selected.getAreaM2());
        projects.save(project);

        return Map.of("ok", true, "areaM2", selected.getAreaM2());
    }

    @Transactional
    public Map<String, Object> unselectLandPlot(String projectId) {
        var project = projects.findById(projectId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project not found"));

        geometryCandidateRepo.updateIsSelectedLandPlotByProjectId(projectId, false);
        project.setLandPlotGeojson(null);
        project.setLandPlotAreaM2(null);
        projects.save(project);

        return Map.of("ok", true);
    }

    @Transactional
    public Map<String, Object> deleteGeometryCandidate(String projectId, String candidateId) {
        long count = geometryCandidateRepo.deleteByIdAndProjectId(candidateId, projectId);
        if (count == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Candidate not found");
        return Map.of("ok", true);
    }

    @Transactional
    public Map<String, Object> selectBuildingGeometry(String projectId, String buildingId, String candidateId) {
        if (buildingId == null || buildingId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "buildingId is required");
        }
        if (candidateId == null || candidateId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "candidateId is required");
        }

        buildingsRepo.findByIdAndProjectId(buildingId, projectId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Building not found"));

        var candidate = geometryCandidateRepo.findByIdAndProjectId(candidateId, projectId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Candidate not found"));

        geometryCandidateRepo.clearAssignedBuildingByProjectIdAndBuildingId(projectId, buildingId);
        int affected = geometryCandidateRepo.updateAssignedBuildingByIdAndProjectId(candidateId, projectId, buildingId);
        if (affected == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Candidate not found");
        }

        return Map.of("ok", true, "areaM2", candidate.getAreaM2());
    }


    @Transactional(readOnly = true)
    public Map<String, Object> context(String projectId, String scope) {
        // 1. Проверяем проект через JPA
        var project = projects.findById(projectId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Проект не найден"));
            
        if (scope != null && !scope.equals(project.getScopeId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Scope mismatch");
        }

        // 2. Базовая информация (complexInfo)
        Map<String, Object> complexInfo = new java.util.LinkedHashMap<>();
        complexInfo.put("name", project.getName());
        complexInfo.put("status", project.getConstructionStatus());
        complexInfo.put("region", project.getRegion());
        complexInfo.put("district", project.getDistrict());
        complexInfo.put("street", project.getAddress());
        complexInfo.put("addressId", project.getAddressId());
        complexInfo.put("dateStartProject", project.getDateStartProject() != null ? project.getDateStartProject().toString() : null);
        complexInfo.put("dateEndProject", project.getDateEndProject() != null ? project.getDateEndProject().toString() : null);
        complexInfo.put("dateStartFact", project.getDateStartFact() != null ? project.getDateStartFact().toString() : null);
        complexInfo.put("dateEndFact", project.getDateEndFact() != null ? project.getDateEndFact().toString() : null);

        // 3. Информация о заявке, шагах и истории
        var app = applications.findFirstByProjectId(projectId).orElse(null);
        Map<String, Object> applicationInfo = new java.util.LinkedHashMap<>();
        List<Integer> completedSteps = new java.util.ArrayList<>();
        Map<String, Object> stepBlockStatuses = new java.util.LinkedHashMap<>();
        List<Map<String, Object>> history = new java.util.ArrayList<>();

        if (app != null) {
            applicationInfo.put("id", app.getId());
            applicationInfo.put("status", app.getStatus());
            applicationInfo.put("workflowSubstatus", app.getWorkflowSubstatus());
            applicationInfo.put("currentStepIndex", app.getCurrentStep());
            applicationInfo.put("currentStage", app.getCurrentStage());
            applicationInfo.put("requestedDeclineReason", app.getRequestedDeclineReason());
            applicationInfo.put("requestedDeclineStep", app.getRequestedDeclineStep());
            applicationInfo.put("requestedDeclineBy", app.getRequestedDeclineBy());
            applicationInfo.put("requestedDeclineAt", formatApiTimestamp(app.getRequestedDeclineAt()));

            // Шаги
            applicationSteps.findByApplicationIdOrderByStepIndexAsc(app.getId())
                .forEach(step -> {
                    Integer idx = step.getStepIndex();
                    if (Boolean.TRUE.equals(step.getIsCompleted()) && idx != null) completedSteps.add(idx);
                    stepBlockStatuses.put(String.valueOf(idx), step.getBlockStatuses() == null ? Map.of() : step.getBlockStatuses());
                });
            applicationInfo.put("completedSteps", completedSteps);

            // История
            applicationHistory.findByApplicationIdOrderByCreatedAtDesc(app.getId())
                .forEach(entry -> {
                    Map<String, Object> h = new java.util.LinkedHashMap<>();
                    h.put("action", entry.getAction());
                    h.put("prevStatus", entry.getPrevStatus());
                    h.put("nextStatus", entry.getNextStatus());
                    h.put("user", entry.getUserName());
                    h.put("comment", entry.getComment());
                    h.put("date", entry.getCreatedAt() != null ? entry.getCreatedAt().toString() : null);
                    history.add(h);
                });
            applicationInfo.put("history", history);
        }

        // 4. Информация о зданиях и блоках (buildingDetails)
        Map<String, Object> buildingDetails = new java.util.LinkedHashMap<>();
        
        List<uz.reestrmkd.backendjpa.domain.BuildingEntity> projectBuildings = buildingsRepo.findByProjectIdIn(List.of(projectId));
        List<String> buildingIds = projectBuildings.stream().map(uz.reestrmkd.backendjpa.domain.BuildingEntity::getId).filter(Objects::nonNull).toList();
        List<uz.reestrmkd.backendjpa.domain.BuildingBlockEntity> projectBlocks = buildingIds.isEmpty() ? List.of() : blocksRepo.findByBuildingIdIn(buildingIds);

        Map<String, List<uz.reestrmkd.backendjpa.domain.BuildingBlockEntity>> basementBlocksByBuilding = new LinkedHashMap<>();
        List<uz.reestrmkd.backendjpa.domain.BuildingBlockEntity> regularBlocks = new ArrayList<>();
        for (var block : projectBlocks) {
            if (Boolean.TRUE.equals(block.getIsBasementBlock())) {
                basementBlocksByBuilding.computeIfAbsent(block.getBuildingId(), k -> new ArrayList<>()).add(block);
            } else {
                regularBlocks.add(block);
            }
        }

        // Здания
        for (var building : projectBuildings) {
            String bId = building.getId();
            if (bId == null) continue;

            Map<String, Object> bData = new java.util.LinkedHashMap<>();
            bData.put("category", building.getCategory());
            bData.put("stage", building.getStage());
            bData.put("constructionType", building.getConstructionType());
            bData.put("parkingType", building.getParkingType());
            bData.put("hasNonResPart", Boolean.TRUE.equals(building.getHasNonResPart()));
            buildingDetails.put(bId + "_data", bData);

            List<Map<String, Object>> basementsList = new java.util.ArrayList<>();
            for (var basement : basementBlocksByBuilding.getOrDefault(bId, List.of())) {
                Map<String, Object> bMap = new java.util.LinkedHashMap<>();
                bMap.put("id", basement.getId());
                bMap.put("depth", basement.getBasementDepth());
                bMap.put("hasParking", Boolean.TRUE.equals(basement.getBasementHasParking()));
                bMap.put("parkingLevels", basement.getBasementParkingLevels() == null ? Map.of() : basement.getBasementParkingLevels());
                bMap.put("communications", basement.getBasementCommunications() == null ? Map.of() : basement.getBasementCommunications());
                bMap.put("entrancesCount", basement.getEntrancesCount());
                bMap.put("blocks", basement.getLinkedBlockIds() == null ? List.of() : basement.getLinkedBlockIds());
                basementsList.add(bMap);
            }
            buildingDetails.put(bId + "_features", Map.of("basements", basementsList));
        }

        List<String> regularBlockIds = regularBlocks.stream().map(uz.reestrmkd.backendjpa.domain.BuildingBlockEntity::getId).filter(Objects::nonNull).toList();
        Map<String, uz.reestrmkd.backendjpa.domain.BlockConstructionEntity> constructionByBlock = new LinkedHashMap<>();
        for (var c : regularBlockIds.isEmpty() ? List.<uz.reestrmkd.backendjpa.domain.BlockConstructionEntity>of() : blockConstructionRepo.findByBlockIdIn(regularBlockIds)) {
            if (c.getBlockId() != null) constructionByBlock.put(c.getBlockId(), c);
        }

        Map<String, uz.reestrmkd.backendjpa.domain.BlockEngineeringEntity> engineeringByBlock = new LinkedHashMap<>();
        for (var e : regularBlockIds.isEmpty() ? List.<uz.reestrmkd.backendjpa.domain.BlockEngineeringEntity>of() : blockEngineeringRepo.findByBlockIdIn(regularBlockIds)) {
            if (e.getBlockId() != null) engineeringByBlock.put(e.getBlockId(), e);
        }

        Map<String, List<uz.reestrmkd.backendjpa.domain.BlockFloorMarkerEntity>> markersByBlock = new LinkedHashMap<>();
        for (var marker : regularBlockIds.isEmpty() ? List.<uz.reestrmkd.backendjpa.domain.BlockFloorMarkerEntity>of() : markersRepo.findByBlockIdIn(regularBlockIds)) {
            if (marker.getBlockId() == null) continue;
            markersByBlock.computeIfAbsent(marker.getBlockId(), k -> new ArrayList<>()).add(marker);
        }

        // Блоки
        for (var block : regularBlocks) {
            String blockId = block.getId();
            if (blockId == null) continue;

            Map<String, Object> blockData = new java.util.LinkedHashMap<>();
            blockData.put("floorsCount", block.getFloorsCount());
            blockData.put("floorsFrom", block.getFloorsFrom());
            blockData.put("floorsTo", block.getFloorsTo());
            blockData.put("entrances", block.getEntrancesCount());
            blockData.put("elevators", block.getElevatorsCount());
            blockData.put("vehicleEntries", block.getVehicleEntries());
            blockData.put("levelsDepth", block.getLevelsDepth());
            blockData.put("lightStructureType", block.getLightStructureType());
            blockData.put("hasBasementFloor", Boolean.TRUE.equals(block.getHasBasement()));
            blockData.put("hasAttic", Boolean.TRUE.equals(block.getHasAttic()));
            blockData.put("hasLoft", Boolean.TRUE.equals(block.getHasLoft()));
            blockData.put("hasExploitableRoof", Boolean.TRUE.equals(block.getHasRoofExpl()));
            blockData.put("hasCustomAddress", Boolean.TRUE.equals(block.getHasCustomAddress()));
            blockData.put("customHouseNumber", block.getCustomHouseNumber());
            blockData.put("addressId", block.getAddressId());
            blockData.put("parentBlocks", block.getParentBlocks() == null ? List.of() : block.getParentBlocks());
            blockData.put("blockGeometry", block.getFootprintGeojson() == null ? Map.of() : block.getFootprintGeojson());

            // Конструктив
            var c = constructionByBlock.get(blockId);
            if (c != null) {
                blockData.put("foundation", c.getFoundation());
                blockData.put("walls", c.getWalls());
                blockData.put("slabs", c.getSlabs());
                blockData.put("roof", c.getRoof());
                blockData.put("seismicity", c.getSeismicity());
            }

            // Инженерка
            var e = engineeringByBlock.get(blockId);
            if (e != null) {
                Map<String, Object> eng = new java.util.LinkedHashMap<>();
                eng.put("electricity", Boolean.TRUE.equals(e.getHasElectricity()));
                eng.put("hvs", Boolean.TRUE.equals(e.getHasWater()));
                eng.put("gvs", Boolean.TRUE.equals(e.getHasHotWater()));
                eng.put("ventilation", Boolean.TRUE.equals(e.getHasVentilation()));
                eng.put("firefighting", Boolean.TRUE.equals(e.getHasFirefighting()));
                eng.put("lowcurrent", Boolean.TRUE.equals(e.getHasLowcurrent()));
                eng.put("sewerage", Boolean.TRUE.equals(e.getHasSewerage()));
                eng.put("gas", Boolean.TRUE.equals(e.getHasGas()));
                eng.put("heatingLocal", Boolean.TRUE.equals(e.getHasHeatingLocal()));
                eng.put("heatingCentral", Boolean.TRUE.equals(e.getHasHeatingCentral()));
                eng.put("internet", Boolean.TRUE.equals(e.getHasInternet()));
                eng.put("solarPanels", Boolean.TRUE.equals(e.getHasSolarPanels()));
                blockData.put("engineering", eng);
            }

            // Маркеры этажей
            List<String> techFloors = new java.util.ArrayList<>();
            List<String> commFloors = new java.util.ArrayList<>();
            for (var marker : markersByBlock.getOrDefault(blockId, List.of())) {
                String mk = marker.getMarkerKey();
                if (mk == null) continue;
                if (Boolean.TRUE.equals(marker.getIsTechnical())) techFloors.add(mk);
                if (Boolean.TRUE.equals(marker.getIsCommercial())) commFloors.add(mk);
            }
            blockData.put("technicalFloors", techFloors);
            blockData.put("commercialFloors", commFloors);

            buildingDetails.put(blockId, blockData);
        }

        return Map.of(
            "ok", true,
            "projectId", projectId,
            "ujCode", project.getUjCode(),
            "complexInfo", complexInfo,
            "applicationInfo", applicationInfo,
            "buildingDetails", buildingDetails,
            "stepBlockStatuses", stepBlockStatuses
        );
    }

    @Transactional
    public Map<String, Object> validateStep(String projectId, Map<String, Object> body) {
        String scope = stringVal(body == null ? null : body.get("scope"));
        String stepId = stringVal(body == null ? null : body.get("stepId"));
        if (scope == null || scope.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "scope is required");
        if (stepId == null || stepId.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "stepId is required");

        var app = applications.findFirstByProjectIdAndScopeId(projectId, scope).orElse(null);
        if (app == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Application not found");

        return Map.of("ok", true, "stepId", stepId, "errors", List.of());
    }

   @Transactional
    public Map<String, Object> contextBuildingSave(String projectId, Map<String, Object> body) {
        Map<String, Object> details = mapFrom(body == null ? null : body.get("buildingDetails"));

        // Получаем ID зданий и блоков проекта для проверки прав
        List<uz.reestrmkd.backendjpa.domain.BuildingEntity> projectBuildings = buildingsRepo.findByProjectIdIn(List.of(projectId));
        Set<String> projectBuildingIds = projectBuildings.stream()
            .map(uz.reestrmkd.backendjpa.domain.BuildingEntity::getId)
            .filter(Objects::nonNull)
            .collect(java.util.stream.Collectors.toCollection(java.util.LinkedHashSet::new));

        List<uz.reestrmkd.backendjpa.domain.BuildingBlockEntity> projectBlocks = projectBuildingIds.isEmpty()
            ? List.of()
            : blocksRepo.findByBuildingIdIn(new java.util.ArrayList<>(projectBuildingIds));
        Set<String> projectBlockIds = projectBlocks.stream()
            .map(uz.reestrmkd.backendjpa.domain.BuildingBlockEntity::getId)
            .filter(Objects::nonNull)
            .collect(java.util.stream.Collectors.toCollection(java.util.LinkedHashSet::new));

        Map<String, List<uz.reestrmkd.backendjpa.domain.BuildingBlockEntity>> basementBlocksByBuilding = new LinkedHashMap<>();
        for (var block : projectBlocks) {
            if (!Boolean.TRUE.equals(block.getIsBasementBlock()) || block.getBuildingId() == null) continue;
            basementBlocksByBuilding.computeIfAbsent(block.getBuildingId(), k -> new ArrayList<>()).add(block);
        }

        for (Map.Entry<String, Object> entry : details.entrySet()) {
            String key = entry.getKey();
            if (key == null) continue;

            // --- 1. ОБНОВЛЕНИЕ ЗДАНИЯ ---
            if (key.endsWith("_data")) {
                String buildingId = key.substring(0, key.length() - 5);
                Map<String, Object> data = mapFrom(entry.getValue());
                if (buildingId.isBlank() || data.isEmpty() || !projectBuildingIds.contains(buildingId)) continue;

                buildingsRepo.findById(buildingId).ifPresent(b -> {
                    if (data.containsKey("category")) b.setCategory(stringVal(data.get("category")));
                    if (data.containsKey("stage")) b.setStage(stringVal(data.get("stage")));
                    if (data.containsKey("constructionType")) b.setConstructionType(stringVal(data.get("constructionType")));
                    if (data.containsKey("parkingType")) b.setParkingType(stringVal(data.get("parkingType")));
                    if (data.containsKey("hasNonResPart")) b.setHasNonResPart(Boolean.TRUE.equals(data.get("hasNonResPart")));
                    buildingsRepo.save(b);
                });
                continue;
            }

            // --- 2. ОБНОВЛЕНИЕ ПОДВАЛОВ ---
            if (key.contains("_features")) {
                String buildingId = key.replace("_features", "");
                if (!projectBuildingIds.contains(buildingId)) continue;
                Map<String, Object> features = mapFrom(entry.getValue());
                List<Map<String, Object>> basements = toMapList(features.get("basements"));
                Set<String> keepBasementIds = new java.util.LinkedHashSet<>();

                int idx = 0;
                for (Map<String, Object> basement : basements) {
                    String basementId = stringValOr(basement.get("id"), java.util.UUID.randomUUID().toString());
                    Integer depthRaw = nullableInt(basement.get("depth"));
                    if (depthRaw == null) continue;

                    List<String> linkedBlocks = new java.util.ArrayList<>();
                    for (Object idObj : toList(basement.get("blocks"))) {
                        if (idObj != null && String.valueOf(idObj).length() == 36) linkedBlocks.add(String.valueOf(idObj));
                    }
                    String singleBlockId = stringVal(basement.get("blockId"));
                    if (singleBlockId != null && singleBlockId.length() == 36) linkedBlocks.add(singleBlockId);

                    // Создаем или обновляем подвал через JPA
                    var block = blocksRepo.findById(basementId).orElseGet(() -> {
                        var nb = new uz.reestrmkd.backendjpa.domain.BuildingBlockEntity();
                        nb.setId(basementId);
                        return nb;
                    });
                    block.setBuildingId(buildingId);
                    block.setLabel("Подвал " + (++idx));
                    block.setType("BAS");
                    block.setIsBasementBlock(true);
                    block.setLinkedBlockIds(new java.util.ArrayList<>(new java.util.LinkedHashSet<>(linkedBlocks)));
                    block.setBasementDepth(normalizeDepth(depthRaw));
                    block.setBasementHasParking(Boolean.TRUE.equals(basement.get("hasParking")));
                    block.setBasementParkingLevels(objectToMap(basement.get("parkingLevels")));
                    block.setBasementCommunications(objectToMap(basement.get("communications")));
                    block.setEntrancesCount(Math.min(10, Math.max(1, toInt(basement.get("entrancesCount")))));
                    block.setParentBlocks(java.util.List.of());
                    blocksRepo.save(block);

                    keepBasementIds.add(basementId);
                    projectBlockIds.add(basementId);
                }

                // Удаляем удаленные подвалы
                for (var existing : basementBlocksByBuilding.getOrDefault(buildingId, List.of())) {
                    String eId = existing.getId();
                    if (eId != null && !keepBasementIds.contains(eId)) blocksRepo.deleteById(eId);
                }
                continue;
            }

            // --- 3. ОБНОВЛЕНИЕ ОБЫЧНЫХ БЛОКОВ ---
            String[] parts = key.split("_");
            String blockId = parts.length == 0 ? "" : parts[parts.length - 1];
            if (blockId.length() != 36 || !projectBlockIds.contains(blockId)) continue;

            Map<String, Object> blockData = mapFrom(entry.getValue());
            blocksRepo.findById(blockId).ifPresent(block -> {
                Integer floorsToValue = nullableInt(blockData.get("floorsTo"));
                block.setFloorsCount(floorsToValue != null ? floorsToValue : nullableInt(blockData.get("floorsCount")));
                block.setEntrancesCount(nullableInt(blockData.get("entrances")) == null ? nullableInt(blockData.get("inputs")) : nullableInt(blockData.get("entrances")));
                block.setElevatorsCount(nullableInt(blockData.get("elevators")));
                block.setVehicleEntries(nullableInt(blockData.get("vehicleEntries")));
                block.setLevelsDepth(nullableInt(blockData.get("levelsDepth")));
                block.setLightStructureType(stringVal(blockData.get("lightStructureType")));
                block.setFloorsFrom(nullableInt(blockData.get("floorsFrom")));
                block.setFloorsTo(floorsToValue);
                block.setHasBasement(Boolean.TRUE.equals(blockData.get("hasBasementFloor")));
                block.setHasAttic(Boolean.TRUE.equals(blockData.get("hasAttic")));
                block.setHasLoft(Boolean.TRUE.equals(blockData.get("hasLoft")));
                block.setHasRoofExpl(Boolean.TRUE.equals(blockData.get("hasExploitableRoof")));
                block.setHasCustomAddress(Boolean.TRUE.equals(blockData.get("hasCustomAddress")));
                block.setCustomHouseNumber(stringVal(blockData.get("customHouseNumber")));

                String addrId = stringVal(blockData.get("addressId"));
                if (addrId == null && block.getHasCustomAddress()) {
                    var b = buildingsRepo.findById(block.getBuildingId()).orElse(null);
                    if (b != null && b.getAddressId() != null) addrId = deriveBlockAddressId(b.getAddressId(), block.getCustomHouseNumber());
                }
                block.setAddressId(addrId);

                List<String> parentBlocks = new java.util.ArrayList<>();
                for (Object pb : toList(blockData.get("parentBlocks"))) {
                    if (pb != null && String.valueOf(pb).length() == 36 && projectBlockIds.contains(String.valueOf(pb))) parentBlocks.add(String.valueOf(pb));
                }
                block.setParentBlocks(new java.util.ArrayList<>(new java.util.LinkedHashSet<>(parentBlocks)));

                Map<String, Object> blockGeometry = normalizeGeometry(mapFrom(blockData.get("blockGeometry")));
                if (!blockGeometry.isEmpty()) block.setFootprintGeojson(blockGeometry);
                else if (blockData.containsKey("blockGeometry")) block.setFootprintGeojson(null);

                blocksRepo.save(block);

                // --- 4. КОНСТРУКТИВ ---
                if (blockData.get("foundation") != null || blockData.get("walls") != null) {
                    var constr = blockConstructionRepo.findByBlockId(blockId).orElseGet(() -> {
                        var c = new uz.reestrmkd.backendjpa.domain.BlockConstructionEntity();
                        c.setBlockId(blockId); return c;
                    });
                    constr.setFoundation(stringVal(blockData.get("foundation")));
                    constr.setWalls(stringVal(blockData.get("walls")));
                    constr.setSlabs(stringVal(blockData.get("slabs")));
                    constr.setRoof(stringVal(blockData.get("roof")));
                    constr.setSeismicity(nullableInt(blockData.get("seismicity")));
                    blockConstructionRepo.save(constr);
                }

                // --- 5. ИНЖЕНЕРКА ---
                Map<String, Object> eng = mapFrom(blockData.get("engineering"));
                if (!eng.isEmpty()) {
                    var engineering = blockEngineeringRepo.findByBlockId(blockId).orElseGet(() -> {
                        var e = new uz.reestrmkd.backendjpa.domain.BlockEngineeringEntity();
                        e.setBlockId(blockId); return e;
                    });
                    engineering.setHasElectricity(Boolean.TRUE.equals(eng.get("electricity")));
                    engineering.setHasWater(Boolean.TRUE.equals(eng.get("hvs")));
                    engineering.setHasHotWater(Boolean.TRUE.equals(eng.get("gvs")));
                    engineering.setHasVentilation(Boolean.TRUE.equals(eng.get("ventilation")));
                    engineering.setHasFirefighting(Boolean.TRUE.equals(eng.get("firefighting")));
                    engineering.setHasLowcurrent(Boolean.TRUE.equals(eng.get("lowcurrent")));
                    engineering.setHasSewerage(Boolean.TRUE.equals(eng.get("sewerage")));
                    engineering.setHasGas(Boolean.TRUE.equals(eng.get("gas")));
                    engineering.setHasHeatingLocal(Boolean.TRUE.equals(eng.get("heatingLocal")));
                    engineering.setHasHeatingCentral(Boolean.TRUE.equals(eng.get("heatingCentral")));
                    engineering.setHasHeating(engineering.getHasHeatingLocal() || engineering.getHasHeatingCentral());
                    engineering.setHasInternet(Boolean.TRUE.equals(eng.get("internet")));
                    engineering.setHasSolarPanels(Boolean.TRUE.equals(eng.get("solarPanels")));
                    blockEngineeringRepo.save(engineering);
                }

                // --- 6. МАРКЕРЫ ЭТАЖЕЙ ---
                markersRepo.deleteByBlockId(blockId);
                Set<String> technical = toMarkerSet(blockData.get("technicalFloors"), true);
                Set<String> commercial = toMarkerSet(blockData.get("commercialFloors"), false);
                Set<String> markerKeys = new java.util.LinkedHashSet<>();
                markerKeys.addAll(technical); markerKeys.addAll(commercial);

                for (String markerKey : markerKeys) {
                    var marker = new uz.reestrmkd.backendjpa.domain.BlockFloorMarkerEntity();
                    marker.setBlockId(blockId);
                    marker.setMarkerKey(markerKey);
                    marker.setMarkerType(markerKey.startsWith("basement_") ? "basement" : markerKey.contains("-Т") ? "technical" : Set.of("attic", "loft", "roof", "tsokol").contains(markerKey) ? "special" : "floor");
                    marker.setFloorIndex(markerKey.contains("-Т") ? nullableInt(markerKey.replace("-Т", "")) : markerKey.matches("^-?\\d+$") ? nullableInt(markerKey) : null);
                    marker.setParentFloorIndex(markerKey.contains("-Т") ? nullableInt(markerKey.replace("-Т", "")) : null);
                    marker.setIsTechnical(technical.contains(markerKey));
                    marker.setIsCommercial(commercial.contains(markerKey));
                    markersRepo.save(marker);
                }

                List<String> floorIdsForBlock = floorRepo.findByBlockId(blockId).stream()
                    .map(uz.reestrmkd.backendjpa.domain.FloorEntity::getId)
                    .filter(Objects::nonNull)
                    .toList();
                if (floorIdsForBlock.isEmpty()) entranceMatrixRepo.deleteByBlockId(blockId);
                else entranceMatrixRepo.deleteByBlockIdAndFloorIdNotIn(blockId, floorIdsForBlock);
            });
        }

        projects.findById(projectId).ifPresent(p -> projects.save(p)); // Триггерим updated_at
        return Map.of("ok", true, "projectId", projectId);
    }
    

    @Transactional
    public Map<String, Object> contextMetaSave(String projectId, Map<String, Object> body) {
        String scope = stringVal(body == null ? null : body.get("scope"));
        if (scope == null || scope.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "scope is required");

        // 1. Сохраняем информацию о проекте (complexInfo)
        Map<String, Object> complexInfo = mapFrom(body == null ? null : body.get("complexInfo"));
        if (!complexInfo.isEmpty()) {
            var project = projects.findById(projectId).orElse(null);
            if (project != null) {
                if (complexInfo.containsKey("name")) project.setName(stringVal(complexInfo.get("name")));
                if (complexInfo.containsKey("status")) project.setConstructionStatus(stringVal(complexInfo.get("status")));
                if (complexInfo.containsKey("region")) project.setRegion(stringVal(complexInfo.get("region")));
                if (complexInfo.containsKey("district")) project.setDistrict(stringVal(complexInfo.get("district")));
                if (complexInfo.containsKey("street")) project.setAddress(stringVal(complexInfo.get("street")));
                if (complexInfo.containsKey("addressId")) project.setAddressId(stringVal(complexInfo.get("addressId")));

                if (complexInfo.containsKey("dateStartProject")) project.setDateStartProject(parseLocalDate(complexInfo.get("dateStartProject")));
                if (complexInfo.containsKey("dateEndProject")) project.setDateEndProject(parseLocalDate(complexInfo.get("dateEndProject")));
                if (complexInfo.containsKey("dateStartFact")) project.setDateStartFact(parseLocalDate(complexInfo.get("dateStartFact")));
                if (complexInfo.containsKey("dateEndFact")) project.setDateEndFact(parseLocalDate(complexInfo.get("dateEndFact")));

                projects.save(project);
            }
        }

        // 2. Сохраняем информацию о заявке и истории (applicationInfo)
        Map<String, Object> applicationInfo = mapFrom(body == null ? null : body.get("applicationInfo"));
        String applicationId = null;

        if (!applicationInfo.isEmpty()) {
            var app = applications.findFirstByProjectId(projectId).orElse(null);
            if (app != null) {
                if (applicationInfo.containsKey("status")) app.setStatus(stringVal(applicationInfo.get("status")));
                if (applicationInfo.containsKey("workflowSubstatus")) app.setWorkflowSubstatus(stringVal(applicationInfo.get("workflowSubstatus")));
                if (applicationInfo.containsKey("currentStepIndex")) app.setCurrentStep(toInt(applicationInfo.get("currentStepIndex")));
                if (applicationInfo.containsKey("currentStage")) app.setCurrentStage(toInt(applicationInfo.get("currentStage")));
                if (applicationInfo.containsKey("requestedDeclineReason")) app.setRequestedDeclineReason(stringVal(applicationInfo.get("requestedDeclineReason")));
                if (applicationInfo.containsKey("requestedDeclineStep")) app.setRequestedDeclineStep(nullableInt(applicationInfo.get("requestedDeclineStep")));
                if (applicationInfo.containsKey("requestedDeclineBy")) app.setRequestedDeclineBy(stringVal(applicationInfo.get("requestedDeclineBy")));
                if (applicationInfo.containsKey("requestedDeclineAt")) {
                     Object rdAt = applicationInfo.get("requestedDeclineAt");
                     app.setRequestedDeclineAt(rdAt != null ? parseInstant(rdAt) : null);
                }
                app = applications.save(app);
                applicationId = app.getId();

                // 2.1 Сохраняем выполненные шаги
                Object completedStepsObj = applicationInfo.get("completedSteps");
                if (completedStepsObj instanceof java.util.List<?> completedSteps) {
                    for (Object idxObj : completedSteps) {
                        int idx = toInt(idxObj);
                        if (idx < 0) continue;
                        
                        final String finalAppId = applicationId;
                        var step = applicationSteps.findByApplicationIdAndStepIndex(finalAppId, idx)
                                .orElseGet(() -> {
                                    var newStep = new uz.reestrmkd.backendjpa.domain.ApplicationStepEntity();
                                    newStep.setApplicationId(finalAppId);
                                    newStep.setStepIndex(idx);
                                    newStep.setBlockStatuses(Map.of());
                                    return newStep;
                                });
                        step.setIsCompleted(true);
                        applicationSteps.save(step);
                    }
                }

                // 2.2 Сохраняем историю переходов статуса
                Object historyObj = applicationInfo.get("history");
                if (historyObj instanceof java.util.List<?> historyList && !historyList.isEmpty() && historyList.get(0) instanceof Map<?, ?> h0) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> last = (Map<String, Object>) h0;
                    Object dateValue = last.get("date");
                    if (dateValue != null) {
                        java.time.Instant eventTime;
                        try {
                            eventTime = java.time.Instant.parse(String.valueOf(dateValue));
                        } catch (Exception ignored) {
                            eventTime = java.time.Instant.now();
                        }
                        // Защита от дублей: сохраняем только если событие произошло не более 5 секунд назад
                        long ageMs = java.time.Duration.between(eventTime, java.time.Instant.now()).toMillis();
                        if (ageMs >= 0 && ageMs < 5000) {
                            var hist = new uz.reestrmkd.backendjpa.domain.ApplicationHistoryEntity();
                            hist.setApplicationId(applicationId);
                            hist.setAction(stringVal(last.get("action")));
                            hist.setPrevStatus(stringVal(last.get("prevStatus")));
                            hist.setNextStatus(stringValOr(last.get("nextStatus"), stringVal(applicationInfo.get("status"))));
                            hist.setUserName(stringVal(last.get("user")));
                            hist.setComment(stringVal(last.get("comment")));
                            applicationHistory.save(hist);
                        }
                    }
                }
            }
        }

        return Map.of("ok", true, "projectId", projectId, "applicationId", applicationId);
    }
   @Transactional
    public Map<String, Object> stepBlockStatusesSave(String projectId, Map<String, Object> body) {
        String scope = stringVal(body == null ? null : body.get("scope"));
        int stepIndex = toInt(body == null ? null : body.get("stepIndex"));
        if (scope == null || scope.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "scope is required");
        if (stepIndex < 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "stepIndex must be a non-negative number");

        var app = applications.findFirstByProjectIdAndScopeId(projectId, scope)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Application not found"));

        Map<String, Object> statuses = mapFrom(body == null ? null : body.get("statuses"));

        // Ищем существующий шаг или создаем новый через JPA
        var step = applicationSteps.findByApplicationIdAndStepIndex(app.getId(), stepIndex)
            .orElseGet(() -> {
                var newStep = new uz.reestrmkd.backendjpa.domain.ApplicationStepEntity();
                newStep.setApplicationId(app.getId());
                newStep.setStepIndex(stepIndex);
                return newStep;
            });

        step.setBlockStatuses(statuses);
        applicationSteps.save(step);

        return Map.of("applicationId", app.getId(), "stepIndex", stepIndex, "blockStatuses", statuses);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> contextRegistryDetails(String projectId) {
        List<uz.reestrmkd.backendjpa.domain.BuildingEntity> projectBuildings = buildingsRepo.findByProjectIdIn(List.of(projectId));
        List<String> buildingIds = projectBuildings.stream().map(uz.reestrmkd.backendjpa.domain.BuildingEntity::getId).filter(Objects::nonNull).toList();
        List<String> blockIds = buildingIds.isEmpty()
            ? List.of()
            : blocksRepo.findByBuildingIdIn(buildingIds).stream().map(uz.reestrmkd.backendjpa.domain.BuildingBlockEntity::getId).filter(Objects::nonNull).toList();

        if (blockIds.isEmpty()) {
            return Map.of("markerRows", List.of(), "floors", List.of(), "entrances", List.of(), "matrix", List.of(), "units", List.of(), "mops", List.of());
        }

        List<Map<String, Object>> markerRows = new ArrayList<>();
        for (var marker : markersRepo.findByBlockIdIn(blockIds)) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("block_id", marker.getBlockId());
            row.put("marker_key", marker.getMarkerKey());
            row.put("is_technical", marker.getIsTechnical());
            row.put("is_commercial", marker.getIsCommercial());
            markerRows.add(row);
        }

        List<uz.reestrmkd.backendjpa.domain.FloorEntity> floorEntities = floorRepo.findByBlockIdIn(blockIds);
        List<Map<String, Object>> floors = new ArrayList<>();
        for (var floor : floorEntities) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", floor.getId());
            row.put("block_id", floor.getBlockId());
            row.put("floor_key", floor.getFloorKey());
            row.put("label", floor.getLabel());
            row.put("index", floor.getIndex());
            row.put("floor_type", floor.getFloorType());
            row.put("height", floor.getHeight());
            row.put("area_proj", floor.getAreaProj());
            row.put("area_fact", floor.getAreaFact());
            row.put("is_duplex", floor.getIsDuplex());
            row.put("parent_floor_index", floor.getParentFloorIndex());
            row.put("is_commercial", floor.getIsCommercial());
            row.put("is_technical", floor.getIsTechnical());
            row.put("is_stylobate", floor.getIsStylobate());
            row.put("is_basement", floor.getIsBasement());
            row.put("is_attic", floor.getIsAttic());
            row.put("is_loft", floor.getIsLoft());
            row.put("is_roof", floor.getIsRoof());
            row.put("basement_id", floor.getBasementId());
            floors.add(row);
        }

        List<String> floorIds = floorEntities.stream().map(uz.reestrmkd.backendjpa.domain.FloorEntity::getId).filter(Objects::nonNull).toList();

        List<Map<String, Object>> entrances = new ArrayList<>();
        for (var entrance : entranceRepo.findByBlockIdIn(blockIds)) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", entrance.getId());
            row.put("block_id", entrance.getBlockId());
            row.put("number", entrance.getNumber());
            entrances.add(row);
        }

        List<Map<String, Object>> matrix = new ArrayList<>();
        for (var m : entranceMatrixRepo.findByBlockIdIn(blockIds)) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("floor_id", m.getFloorId());
            row.put("entrance_number", m.getEntranceNumber());
            row.put("flats_count", m.getFlatsCount());
            row.put("commercial_count", m.getCommercialCount());
            row.put("mop_count", m.getMopCount());
            matrix.add(row);
        }

        List<Map<String, Object>> units = new ArrayList<>();
        if (!floorIds.isEmpty()) {
            for (var unit : unitRepo.findByFloorIdIn(floorIds)) {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("id", unit.getId());
                row.put("floor_id", unit.getFloorId());
                row.put("entrance_id", unit.getEntranceId());
                row.put("number", unit.getNumber());
                row.put("unit_type", unit.getUnitType());
                row.put("has_mezzanine", unit.getHasMezzanine());
                row.put("mezzanine_type", unit.getMezzanineType());
                row.put("total_area", unit.getTotalArea());
                row.put("living_area", unit.getLivingArea());
                row.put("useful_area", unit.getUsefulArea());
                row.put("rooms_count", unit.getRoomsCount());
                row.put("status", unit.getStatus());
                row.put("cadastre_number", unit.getCadastreNumber());
                units.add(row);
            }
        }

        List<Map<String, Object>> mops = new ArrayList<>();
        if (!floorIds.isEmpty()) {
            for (var area : commonAreaRepo.findByFloorIdIn(floorIds)) {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("id", area.getId());
                row.put("floor_id", area.getFloorId());
                row.put("entrance_id", area.getEntranceId());
                row.put("type", area.getType());
                row.put("area", area.getArea());
                row.put("height", area.getHeight());
                mops.add(row);
            }
        }

        return Map.of("markerRows", markerRows, "floors", floors, "entrances", entrances, "matrix", matrix, "units", units, "mops", mops);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> passport(String projectId) {
        var project = projects.findById(projectId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project not found"));

        Map<String, Object> addr = project.getAddressId() == null ? null : queryOne("""
            select a.district as addr_district,
                   a.street as addr_street,
                   a.mahalla as addr_mahalla,
                   a.building_no as addr_building_no,
                   r.soato as addr_region_soato
            from addresses a
            left join districts d on d.soato = a.district
            left join regions r on r.id = d.region_id
            where a.id = cast(:addressId as uuid)
            """, Map.of("addressId", project.getAddressId()));

        List<uz.reestrmkd.backendjpa.domain.ProjectParticipantEntity> participantEntities = participantsRepo.findByProjectId(projectId);
        List<uz.reestrmkd.backendjpa.domain.ProjectDocumentEntity> documentEntities = documentsRepo.findByProjectIdOrderByDocDateDesc(projectId);

        Map<String, Object> participantsMap = new LinkedHashMap<>();
        for (var part : participantEntities) {
            String role = stringVal(part.getRole());
            if (role == null) continue;
            Map<String, Object> partPayload = new LinkedHashMap<>();
            partPayload.put("id", part.getId());
            partPayload.put("name", part.getName());
            partPayload.put("inn", part.getInn());
            partPayload.put("role", role);
            participantsMap.put(role, partPayload);
        }

        List<Map<String, Object>> documents = new ArrayList<>();
        for (var d : documentEntities) {
            Map<String, Object> docPayload = new LinkedHashMap<>();
            docPayload.put("id", d.getId());
            docPayload.put("name", d.getName());
            docPayload.put("type", d.getDocType());
            docPayload.put("date", d.getDocDate());
            docPayload.put("number", d.getDocNumber());
            docPayload.put("url", d.getFileUrl());
            documents.add(docPayload);
        }

        Map<String, Object> complexInfo = new LinkedHashMap<>();
        complexInfo.put("name", project.getName());
        complexInfo.put("ujCode", project.getUjCode());
        complexInfo.put("status", project.getConstructionStatus());
        complexInfo.put("region", project.getRegion());
        complexInfo.put("district", project.getDistrict());
        complexInfo.put("street", project.getAddress());
        complexInfo.put("addressId", project.getAddressId());
        complexInfo.put("landmark", project.getLandmark());
        complexInfo.put("dateStartProject", project.getDateStartProject());
        complexInfo.put("dateEndProject", project.getDateEndProject());
        complexInfo.put("dateStartFact", project.getDateStartFact());
        complexInfo.put("dateEndFact", project.getDateEndFact());
        
        // Новые поля из таблицы addresses
        complexInfo.put("regionSoato", addr == null ? null : addr.get("addr_region_soato"));
        complexInfo.put("districtSoato", addr == null ? null : addr.get("addr_district"));
        complexInfo.put("streetId", addr == null ? null : addr.get("addr_street"));
        complexInfo.put("mahallaId", addr == null ? null : addr.get("addr_mahalla"));
        complexInfo.put("buildingNo", addr == null ? null : addr.get("addr_building_no"));

        Map<String, Object> cadastre = new LinkedHashMap<>();
        cadastre.put("number", project.getCadastreNumber());
        cadastre.put("area", project.getLandPlotAreaM2());

        Map<String, Object> landPlot = new LinkedHashMap<>();
        landPlot.put("geometry", project.getLandPlotGeojson());
        landPlot.put("areaM2", project.getLandPlotAreaM2());

        return Map.of(
            "complexInfo", complexInfo,
            "cadastre", cadastre,
            "landPlot", landPlot,
            "participants", participantsMap,
            "documents", documents
        );
    }

   @Transactional
    public Map<String, Object> updatePassport(String projectId, Map<String, Object> body) {
        Map<String, Object> info = mapFrom(body == null ? null : body.get("info"));
        Map<String, Object> cadastreData = mapFrom(body == null ? null : body.get("cadastreData"));
        String addressId = stringVal(info.get("addressId"));
        if (addressId != null && addressId.isBlank()) addressId = null;
        boolean hasAddressId = (addressId != null);
        String street = stringVal(info.get("street"));

        // Логика идемпотентного создания/обновления адреса
        if (info.get("districtSoato") != null || info.get("streetId") != null || info.get("mahallaId") != null || info.get("buildingNo") != null) {
            Map<String, String> createdAddress = ensureAddressRecord(
                addressId,
                stringVal(info.get("districtSoato")),
                stringVal(info.get("streetId")),
                stringVal(info.get("mahallaId")),
                stringVal(info.get("buildingNo")),
                null,
                stringVal(info.get("region")),
                stringVal(info.get("district")),
                null, // streetName подтянется из БД
                stringVal(info.get("mahalla"))
            );
            if (createdAddress != null) {
                addressId = createdAddress.get("id");
                hasAddressId = true;
                if (createdAddress.get("full_address") != null) {
                    street = createdAddress.get("full_address");
                }
            }
        }

        var project = projects.findById(projectId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project not found"));

        if (info.containsKey("name")) project.setName(stringVal(info.get("name")));
        if (info.containsKey("status")) project.setConstructionStatus(stringVal(info.get("status")));
        if (info.containsKey("region")) project.setRegion(stringVal(info.get("region")));
        if (info.containsKey("district")) project.setDistrict(stringVal(info.get("district")));
        if (info.containsKey("street") || street != null) project.setAddress(street);
        if (hasAddressId) project.setAddressId(addressId);
        if (info.containsKey("landmark")) project.setLandmark(stringVal(info.get("landmark")));
        if (info.containsKey("dateStartProject")) project.setDateStartProject(parseLocalDate(info.get("dateStartProject")));
        if (info.containsKey("dateEndProject")) project.setDateEndProject(parseLocalDate(info.get("dateEndProject")));
        if (info.containsKey("dateStartFact")) project.setDateStartFact(parseLocalDate(info.get("dateStartFact")));
        if (info.containsKey("dateEndFact")) project.setDateEndFact(parseLocalDate(info.get("dateEndFact")));
        if (cadastreData.containsKey("number")) project.setCadastreNumber(stringVal(cadastreData.get("number")));
        if (cadastreData.containsKey("area")) project.setLandPlotAreaM2(parseBigDecimal(cadastreData.get("area")));

        project = projects.save(project);
        return projectToRow(project);
    }

    @Transactional
    public Map<String, Object> participants(String projectId, String role, Map<String, Object> body) {
        Map<String, Object> data = mapFrom(body == null ? null : body.get("data"));
        String participantId = stringValOr(data.get("id"), UUID.randomUUID().toString());

        var entity = participantsRepo.findById(participantId).orElseGet(uz.reestrmkd.backendjpa.domain.ProjectParticipantEntity::new);
        entity.setId(participantId);
        entity.setProjectId(projectId);
        entity.setRole(role);
        entity.setName(stringValOr(data.get("name"), ""));
        entity.setInn(stringValOr(data.get("inn"), ""));
        var saved = participantsRepo.save(entity);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("id", saved.getId());
        payload.put("project_id", saved.getProjectId());
        payload.put("role", saved.getRole());
        payload.put("name", saved.getName());
        payload.put("inn", saved.getInn());
        payload.put("created_at", saved.getCreatedAt());
        payload.put("updated_at", saved.getUpdatedAt());
        return payload;
    }

    @Transactional
    public Map<String, Object> documents(String projectId, Map<String, Object> body) {
        Map<String, Object> doc = mapFrom(body == null ? null : body.get("doc"));
        String id = stringValOr(doc.get("id"), UUID.randomUUID().toString());

        var entity = documentsRepo.findById(id).orElseGet(uz.reestrmkd.backendjpa.domain.ProjectDocumentEntity::new);
        entity.setId(id);
        entity.setProjectId(projectId);
        entity.setName(stringValOr(doc.get("name"), ""));
        entity.setDocType(stringValOr(doc.get("type"), ""));
        entity.setDocDate(parseLocalDate(doc.get("date")));
        entity.setDocNumber(stringValOr(doc.get("number"), ""));
        entity.setFileUrl(stringVal(doc.get("url")));
        var saved = documentsRepo.save(entity);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("id", saved.getId());
        payload.put("project_id", saved.getProjectId());
        payload.put("name", saved.getName());
        payload.put("doc_type", saved.getDocType());
        payload.put("doc_date", saved.getDocDate());
        payload.put("doc_number", saved.getDocNumber());
        payload.put("file_url", saved.getFileUrl());
        payload.put("created_at", saved.getCreatedAt());
        payload.put("updated_at", saved.getUpdatedAt());
        return payload;
    }

    @Transactional
    public Map<String, Object> deleteDoc(String documentId) {
        if (!documentsRepo.existsById(documentId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Document not found");
        }
        documentsRepo.deleteById(documentId);
        return Map.of("ok", true);
    }

  @Transactional
    public Map<String, Object> deleteProject(String projectId, String scope) {
        if (scope == null || scope.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "scope is required");
        }
        
        var project = projects.findById(projectId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project not found"));
            
        if (!scope.equals(project.getScopeId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Scope mismatch");
        }
        
        // JPA сам сгенерирует безопасный DELETE запрос
        projects.delete(project); 
        return Map.of("ok", true);
    }

  @Transactional(readOnly = true)
    public Map<String, Object> integrationGet(String projectId) {
        var app = applications.findFirstByProjectId(projectId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Application not found"));

        return app.getIntegrationData() != null ? app.getIntegrationData() : Map.of();
    }

    @Transactional(readOnly = true)
    public Map<String, Object> parkingCounts(String projectId) {
        List<String> buildingIds = buildingsRepo.findByProjectId(projectId).stream()
            .map(uz.reestrmkd.backendjpa.domain.BuildingEntity::getId)
            .filter(Objects::nonNull)
            .toList();
        if (buildingIds.isEmpty()) return Map.of("parkingPlaces", 0);

        List<String> blockIds = blocksRepo.findByBuildingIdIn(buildingIds).stream()
            .map(uz.reestrmkd.backendjpa.domain.BuildingBlockEntity::getId)
            .filter(Objects::nonNull)
            .toList();
        if (blockIds.isEmpty()) return Map.of("parkingPlaces", 0);

        List<String> floorIds = floorRepo.findByBlockIdIn(blockIds).stream()
            .map(uz.reestrmkd.backendjpa.domain.FloorEntity::getId)
            .filter(Objects::nonNull)
            .toList();
        if (floorIds.isEmpty()) return Map.of("parkingPlaces", 0);

        int parkingPlaces = 0;
        for (var unit : unitRepo.findByFloorIdIn(floorIds)) {
            if (Set.of("parking", "parking_place").contains(unit.getUnitType())) parkingPlaces++;
        }
        return Map.of("parkingPlaces", parkingPlaces);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> buildingsSummary() {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (var b : buildingsRepo.findAllByOrderByCreatedAtDesc()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", b.getId());
            row.put("project_id", b.getProjectId());
            row.put("building_code", b.getBuildingCode());
            row.put("label", b.getLabel());
            row.put("house_number", b.getHouseNumber());
            row.put("address_id", b.getAddressId());
            row.put("category", b.getCategory());
            row.put("stage", b.getStage());
            row.put("construction_type", b.getConstructionType());
            row.put("parking_type", b.getParkingType());
            row.put("infra_type", b.getInfraType());
            row.put("has_non_res_part", b.getHasNonResPart());
            row.put("cadastre_number", b.getCadastreNumber());
            row.put("footprint_geojson", b.getFootprintGeojson());
            row.put("geometry_candidate_id", b.getGeometryCandidateId());
            row.put("created_at", b.getCreatedAt());
            row.put("updated_at", b.getUpdatedAt());
            rows.add(row);
        }
        return rows;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> basements(String projectId) {
        List<String> buildingIds = buildingsRepo.findByProjectId(projectId).stream()
            .map(uz.reestrmkd.backendjpa.domain.BuildingEntity::getId)
            .filter(Objects::nonNull)
            .toList();

        if (buildingIds.isEmpty()) return List.of();

        List<Map<String, Object>> payload = new ArrayList<>();
        for (var basement : blocksRepo.findByBuildingIdInAndIsBasementBlockTrue(buildingIds)) {
            List<String> linkedBlocks = basement.getLinkedBlockIds() == null ? List.of() : basement.getLinkedBlockIds();
            int depth = normalizeDepth(toInt(basement.getBasementDepth()));
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", basement.getId());
            item.put("buildingId", basement.getBuildingId());
            item.put("blockId", linkedBlocks.isEmpty() ? null : linkedBlocks.get(0));
            item.put("blocks", linkedBlocks);
            item.put("depth", depth);
            item.put("hasParking", Boolean.TRUE.equals(basement.getBasementHasParking()));
            item.put("parkingLevels", basement.getBasementParkingLevels() == null ? Map.of() : basement.getBasementParkingLevels());
            item.put("communications", basement.getBasementCommunications() == null ? Map.of() : basement.getBasementCommunications());
            item.put("entrancesCount", Math.min(10, Math.max(1, toInt(basement.getEntrancesCount()))));
            payload.add(item);
        }
        return payload;
    }

    @Transactional
    public Map<String, Object> updateBasementLevel(String basementId, Integer level, Map<String, Object> body) {
        int parsedLevel = level == null ? 0 : level;
        if (parsedLevel < 1 || parsedLevel > 10) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "level must be integer in range [1..10]");
        }

        var basement = blocksRepo.findById(basementId)
            .filter(block -> Boolean.TRUE.equals(block.getIsBasementBlock()))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Basement block not found"));

        int basementDepth = normalizeDepth(toInt(basement.getBasementDepth()));
        if (parsedLevel > basementDepth) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "level must be <= basement depth (" + basementDepth + ")");
        }

        Map<String, Object> levels = new LinkedHashMap<>(basement.getBasementParkingLevels() == null ? Map.of() : basement.getBasementParkingLevels());
        levels.put(String.valueOf(parsedLevel), Boolean.TRUE.equals(body == null ? null : body.get("isEnabled")));

        basement.setBasementParkingLevels(levels);
        blocksRepo.save(basement);
        return Map.of("ok", true);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> fullRegistry(String projectId) {
        var projectEntity = projects.findById(projectId).orElse(null);
        String projectAddressId = projectEntity == null ? null : projectEntity.getAddressId();

        List<uz.reestrmkd.backendjpa.domain.BuildingEntity> buildingEntities = buildingsRepo.findByProjectId(projectId);
        if (buildingEntities.isEmpty()) {
            return Map.of("buildings", List.of(), "units", List.of());
        }

        List<Map<String, Object>> buildings = new ArrayList<>();
        for (var b : buildingEntities) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", b.getId());
            row.put("project_id", b.getProjectId());
            row.put("building_code", b.getBuildingCode());
            row.put("label", b.getLabel());
            row.put("house_number", b.getHouseNumber());
            row.put("address_id", b.getAddressId());
            row.put("category", b.getCategory());
            row.put("stage", b.getStage());
            row.put("date_start", b.getDateStart());
            row.put("date_end", b.getDateEnd());
            row.put("construction_type", b.getConstructionType());
            row.put("parking_type", b.getParkingType());
            row.put("infra_type", b.getInfraType());
            row.put("has_non_res_part", b.getHasNonResPart());
            row.put("cadastre_number", b.getCadastreNumber());
            row.put("footprint_geojson", b.getFootprintGeojson());
            row.put("address", b.getAddressId());
            buildings.add(row);
        }

        List<String> buildingIds = buildingEntities.stream().map(uz.reestrmkd.backendjpa.domain.BuildingEntity::getId).filter(Objects::nonNull).toList();
        List<uz.reestrmkd.backendjpa.domain.BuildingBlockEntity> blockEntities = blocksRepo.findByBuildingIdIn(buildingIds);
        List<Map<String, Object>> blocks = new ArrayList<>();
        for (var block : blockEntities) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", block.getId());
            row.put("building_id", block.getBuildingId());
            row.put("label", block.getLabel());
            row.put("is_basement_block", block.getIsBasementBlock());
            row.put("linked_block_ids", block.getLinkedBlockIds());
            row.put("address_id", block.getAddressId());
            row.put("floors_count", block.getFloorsCount());
            row.put("footprint_geojson", block.getFootprintGeojson());
            blocks.add(row);
        }

        List<String> blockIds = blockEntities.stream().map(uz.reestrmkd.backendjpa.domain.BuildingBlockEntity::getId).filter(Objects::nonNull).toList();
        List<Map<String, Object>> extensions = new ArrayList<>();
        if (!blockIds.isEmpty()) {
            for (var ext : blockExtensionRepo.findByParentBlockIdInOrderByCreatedAtAsc(blockIds)) {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("id", ext.getId());
                row.put("parent_block_id", ext.getParentBlockId());
                row.put("label", ext.getLabel());
                row.put("extension_type", ext.getExtensionType());
                row.put("floors_count", ext.getFloorsCount());
                row.put("start_floor_index", ext.getStartFloorIndex());
                extensions.add(row);
            }
        }
        Map<String, List<Map<String, Object>>> extensionsByBlockId = new HashMap<>();
        for (Map<String, Object> ext : extensions) {
            String parentBlockId = stringVal(ext.get("parent_block_id"));
            if (parentBlockId == null) continue;
            extensionsByBlockId.computeIfAbsent(parentBlockId, k -> new ArrayList<>()).add(ext);
        }

        List<uz.reestrmkd.backendjpa.domain.FloorEntity> floorEntities = blockIds.isEmpty() ? List.of() : floorRepo.findByBlockIdIn(blockIds);
        List<Map<String, Object>> floors = new ArrayList<>();
        for (var floor : floorEntities) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", floor.getId());
            row.put("block_id", floor.getBlockId());
            row.put("floor_key", floor.getFloorKey());
            row.put("label", floor.getLabel());
            row.put("index", floor.getIndex());
            row.put("floor_type", floor.getFloorType());
            row.put("height", floor.getHeight());
            row.put("area_proj", floor.getAreaProj());
            row.put("area_fact", floor.getAreaFact());
            row.put("is_duplex", floor.getIsDuplex());
            row.put("parent_floor_index", floor.getParentFloorIndex());
            row.put("is_commercial", floor.getIsCommercial());
            row.put("is_technical", floor.getIsTechnical());
            row.put("is_stylobate", floor.getIsStylobate());
            row.put("is_basement", floor.getIsBasement());
            row.put("is_attic", floor.getIsAttic());
            row.put("is_loft", floor.getIsLoft());
            row.put("is_roof", floor.getIsRoof());
            row.put("basement_id", floor.getBasementId());
            floors.add(row);
        }

        List<Map<String, Object>> entrances = new ArrayList<>();
        for (var e : blockIds.isEmpty() ? List.<uz.reestrmkd.backendjpa.domain.EntranceEntity>of() : entranceRepo.findByBlockIdIn(blockIds)) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", e.getId());
            row.put("block_id", e.getBlockId());
            row.put("number", e.getNumber());
            entrances.add(row);
        }

        List<String> floorIds = floorEntities.stream().map(uz.reestrmkd.backendjpa.domain.FloorEntity::getId).filter(Objects::nonNull).toList();
        List<uz.reestrmkd.backendjpa.domain.UnitEntity> unitEntities = floorIds.isEmpty() ? List.of() : unitRepo.findByFloorIdIn(floorIds);
        List<Map<String, Object>> units = new ArrayList<>();
        for (var u : unitEntities) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", u.getId());
            row.put("floor_id", u.getFloorId());
            row.put("entrance_id", u.getEntranceId());
            row.put("unit_code", u.getUnitCode());
            row.put("number", u.getNumber());
            row.put("unit_type", u.getUnitType());
            row.put("has_mezzanine", u.getHasMezzanine());
            row.put("mezzanine_type", u.getMezzanineType());
            row.put("total_area", u.getTotalArea());
            row.put("living_area", u.getLivingArea());
            row.put("useful_area", u.getUsefulArea());
            row.put("rooms_count", u.getRoomsCount());
            row.put("status", u.getStatus());
            row.put("cadastre_number", u.getCadastreNumber());
            row.put("address_id", u.getAddressId());
            units.add(row);
        }

        List<String> unitIds = unitEntities.stream().map(uz.reestrmkd.backendjpa.domain.UnitEntity::getId).filter(Objects::nonNull).toList();
        List<Map<String, Object>> rooms = new ArrayList<>();
        for (var room : unitIds.isEmpty() ? List.<uz.reestrmkd.backendjpa.domain.RoomEntity>of() : roomRepo.findByUnitIdIn(unitIds)) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", room.getId());
            row.put("unit_id", room.getUnitId());
            row.put("room_type", room.getRoomType());
            row.put("name", room.getName());
            row.put("area", room.getArea());
            row.put("room_height", room.getRoomHeight());
            row.put("level", room.getLevel());
            row.put("is_mezzanine", room.getIsMezzanine());
            rooms.add(row);
        }

        Map<String, String> floorToBlock = new HashMap<>();
        for (Map<String, Object> floor : floors) {
            floorToBlock.put(stringVal(floor.get("id")), stringVal(floor.get("block_id")));
        }
        Map<String, String> blockToBuilding = new HashMap<>();
        for (Map<String, Object> block : blocks) {
            blockToBuilding.put(stringVal(block.get("id")), stringVal(block.get("building_id")));
        }
        Map<String, Object> buildingCodeById = new HashMap<>();
        Map<String, String> buildingAddressById = new HashMap<>();
        for (Map<String, Object> b : buildings) {
            String buildingId = stringVal(b.get("id"));
            buildingCodeById.put(buildingId, b.get("building_code"));
            buildingAddressById.put(buildingId, stringVal(b.get("address_id")));
        }
        Map<String, String> blockAddressById = new HashMap<>();
        for (Map<String, Object> block : blocks) {
            blockAddressById.put(stringVal(block.get("id")), stringVal(block.get("address_id")));
        }

        List<Map<String, Object>> payloadBuildings = new ArrayList<>();
        for (Map<String, Object> b : buildings) {
            Map<String, Object> item = new LinkedHashMap<>(b);
            item.put("label", b.get("label"));
            item.put("houseNumber", b.get("house_number"));
            item.put("buildingCode", b.get("building_code"));
            item.put("addressId", b.get("address_id"));
            item.put("effectiveAddressId", b.get("address_id") == null ? projectAddressId : b.get("address_id"));
            payloadBuildings.add(item);
        }

        List<Map<String, Object>> payloadBlocks = new ArrayList<>();
        for (Map<String, Object> block : blocks) {
            Map<String, Object> item = new LinkedHashMap<>(block);
            item.put("tabLabel", block.get("label"));
            item.put("buildingId", block.get("building_id"));
            item.put("isBasementBlock", Boolean.TRUE.equals(block.get("is_basement_block")));
            item.put("linkedBlockIds", block.get("linked_block_ids"));
            item.put("addressId", block.get("address_id"));
            String blockBuildingId = stringVal(block.get("building_id"));
            String blockAddressId = stringVal(block.get("address_id"));
            item.put("effectiveAddressId", blockAddressId != null ? blockAddressId : (buildingAddressById.get(blockBuildingId) != null ? buildingAddressById.get(blockBuildingId) : projectAddressId));
            item.put("extensions", extensionsByBlockId.getOrDefault(stringVal(block.get("id")), List.of()).stream().map(ext -> {
                Map<String, Object> extPayload = new LinkedHashMap<>();
                extPayload.put("id", ext.get("id"));
                extPayload.put("label", ext.get("label"));
                extPayload.put("extensionType", ext.get("extension_type"));
                extPayload.put("floorsCount", ext.get("floors_count"));
                extPayload.put("startFloorIndex", ext.get("start_floor_index"));
                return extPayload;
            }).toList());
            payloadBlocks.add(item);
        }

        List<Map<String, Object>> payloadFloors = new ArrayList<>();
        for (Map<String, Object> floor : floors) {
            Map<String, Object> item = new LinkedHashMap<>(floor);
            item.put("blockId", floor.get("block_id"));
            item.put("areaProj", floor.get("area_proj"));
            item.put("areaFact", floor.get("area_fact"));
            payloadFloors.add(item);
        }

        List<Map<String, Object>> payloadEntrances = new ArrayList<>();
        for (Map<String, Object> e : entrances) {
            payloadEntrances.add(Map.of(
                "id", e.get("id"),
                "blockId", e.get("block_id"),
                "number", e.get("number")
            ));
        }

        Map<String, List<Map<String, Object>>> roomsByUnit = new HashMap<>();
        for (Map<String, Object> room : rooms) {
            String unitId = stringVal(room.get("unit_id"));
            if (unitId == null) continue;
            Map<String, Object> mapped = new LinkedHashMap<>();
            mapped.put("id", room.get("id"));
            mapped.put("type", room.get("room_type"));
            mapped.put("label", room.get("name"));
            mapped.put("area", room.get("area"));
            mapped.put("height", room.get("room_height"));
            mapped.put("level", room.get("level"));
            mapped.put("isMezzanine", Boolean.TRUE.equals(room.get("is_mezzanine")));
            roomsByUnit.computeIfAbsent(unitId, k -> new ArrayList<>()).add(mapped);
        }

        List<Map<String, Object>> payloadUnits = new ArrayList<>();
        for (Map<String, Object> u : units) {
            String unitId = stringVal(u.get("id"));
            String floorId = stringVal(u.get("floor_id"));
            String blockId = floorToBlock.get(floorId);
            String buildingId = blockToBuilding.get(blockId);
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", unitId);
            item.put("uid", unitId);
            item.put("unitCode", u.get("unit_code"));
            item.put("num", u.get("number"));
            item.put("number", u.get("number"));
            item.put("type", u.get("unit_type"));
            item.put("hasMezzanine", Boolean.TRUE.equals(u.get("has_mezzanine")));
            item.put("mezzanineType", u.get("mezzanine_type"));
            item.put("area", u.get("total_area"));
            item.put("livingArea", u.get("living_area"));
            item.put("usefulArea", u.get("useful_area"));
            item.put("rooms", u.get("rooms_count"));
            item.put("floorId", floorId);
            item.put("entranceId", u.get("entrance_id"));
            item.put("buildingId", buildingId);
            item.put("buildingCode", buildingCodeById.get(buildingId));
            item.put("addressId", u.get("address_id"));
            String unitAddressId = stringVal(u.get("address_id"));
            String inheritedBlockAddress = blockId == null ? null : blockAddressById.get(blockId);
            String inheritedBuildingAddress = buildingId == null ? null : buildingAddressById.get(buildingId);
            item.put("effectiveAddressId", unitAddressId != null ? unitAddressId : (inheritedBlockAddress != null ? inheritedBlockAddress : (inheritedBuildingAddress != null ? inheritedBuildingAddress : projectAddressId)));
            item.put("cadastreNumber", u.get("cadastre_number"));
            item.put("explication", roomsByUnit.getOrDefault(unitId, List.of()));
            payloadUnits.add(item);
        }

        return Map.of(
            "buildings", payloadBuildings,
            "blocks", payloadBlocks,
            "floors", payloadFloors,
            "entrances", payloadEntrances,
            "units", payloadUnits
        );
    }

    @Transactional(readOnly = true)
    public Map<String, Object> tepSummary(String projectId) {
        List<uz.reestrmkd.backendjpa.domain.BuildingEntity> buildings = buildingsRepo.findByProjectId(projectId);

        Map<String, Object> living = bucket();
        Map<String, Object> commercial = bucket();
        Map<String, Object> infrastructure = bucket();
        Map<String, Object> parking = bucket();
        Map<String, Object> mop = new LinkedHashMap<>();
        mop.put("area", 0d);

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("totalAreaProj", 0d);
        summary.put("totalAreaFact", 0d);
        summary.put("living", living);
        summary.put("commercial", commercial);
        summary.put("infrastructure", infrastructure);
        summary.put("parking", parking);
        summary.put("mop", mop);
        summary.put("cadastreReadyCount", 0);
        summary.put("totalObjectsCount", 0);
        summary.put("avgProgress", 0d);

        if (buildings.isEmpty()) return summary;

        List<String> buildingIds = buildings.stream().map(uz.reestrmkd.backendjpa.domain.BuildingEntity::getId).filter(Objects::nonNull).toList();
        List<String> blockIds = buildingIds.isEmpty() ? List.of() : blocksRepo.findByBuildingIdIn(buildingIds).stream()
            .map(uz.reestrmkd.backendjpa.domain.BuildingBlockEntity::getId)
            .filter(Objects::nonNull)
            .toList();
        if (blockIds.isEmpty()) return summary;

        List<uz.reestrmkd.backendjpa.domain.FloorEntity> floors = floorRepo.findByBlockIdIn(blockIds);
        List<String> floorIds = floors.stream().map(uz.reestrmkd.backendjpa.domain.FloorEntity::getId).filter(Objects::nonNull).toList();
        List<uz.reestrmkd.backendjpa.domain.UnitEntity> units = floorIds.isEmpty() ? List.of() : unitRepo.findByFloorIdIn(floorIds);

        double totalAreaProj = 0d;
        double totalAreaFact = 0d;
        for (var floor : floors) {
            totalAreaProj += toDouble(floor.getAreaProj());
            totalAreaFact += toDouble(floor.getAreaFact());
        }
        summary.put("totalAreaProj", totalAreaProj);
        summary.put("totalAreaFact", totalAreaFact);

        double progressSum = 0d;
        for (var b : buildings) {
            progressSum += progressPercent(b.getDateStart(), b.getDateEnd());
        }
        summary.put("avgProgress", buildings.isEmpty() ? 0d : progressSum / buildings.size());

        int cadastreReady = 0;
        int totalObjects = 0;
        for (var unit : units) {
            totalObjects += 1;
            if (unit.getCadastreNumber() != null && !String.valueOf(unit.getCadastreNumber()).isBlank()) cadastreReady += 1;
            double area = toDouble(unit.getTotalArea());
            String type = stringVal(unit.getUnitType());
            if (Set.of("flat", "duplex_up", "duplex_down").contains(type)) incBucket(living, area);
            else if (Set.of("office", "office_inventory", "non_res_block").contains(type)) incBucket(commercial, area);
            else if ("infrastructure".equals(type)) incBucket(infrastructure, area);
            else if ("parking_place".equals(type)) incBucket(parking, area);
        }
        summary.put("cadastreReadyCount", cadastreReady);
        summary.put("totalObjectsCount", totalObjects);

        double useful = toDouble(living.get("area")) + toDouble(commercial.get("area")) + toDouble(infrastructure.get("area")) + toDouble(parking.get("area"));
        mop.put("area", Math.max(0d, totalAreaProj - useful));

        return summary;
    }

    private List<Map<String, Object>> queryList(String sql, Map<String, Object> params) {
        Query query = em.createNativeQuery(sql, Tuple.class);
        params.forEach(query::setParameter);
        @SuppressWarnings("unchecked")
        List<Tuple> tuples = query.getResultList();
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Tuple tuple : tuples) rows.add(tupleToMap(tuple));
        return rows;
    }

    private Map<String, Object> queryOne(String sql, Map<String, Object> params) {
        List<Map<String, Object>> rows = queryList(sql, params);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private int execute(String sql, Map<String, Object> params) {
        Query query = em.createNativeQuery(sql);
        params.forEach(query::setParameter);
        return query.executeUpdate();
    }

    private Map<String, Object> tupleToMap(Tuple tuple) {
        Map<String, Object> row = new LinkedHashMap<>();
        tuple.getElements().forEach(e -> row.put(e.getAlias(), tuple.get(e)));
        return row;
    }


    private java.math.BigDecimal parseBigDecimal(Object value) {
        if (value == null || String.valueOf(value).isBlank()) return null;
        if (value instanceof java.math.BigDecimal bd) return bd;
        if (value instanceof Number n) return java.math.BigDecimal.valueOf(n.doubleValue());
        try {
            return new java.math.BigDecimal(String.valueOf(value));
        } catch (Exception e) {
            return null;
        }
    }

    private Map<String, Object> projectToRow(uz.reestrmkd.backendjpa.domain.ProjectEntity project) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", project.getId());
        row.put("scope_id", project.getScopeId());
        row.put("uj_code", project.getUjCode());
        row.put("name", project.getName());
        row.put("region", project.getRegion());
        row.put("district", project.getDistrict());
        row.put("address", project.getAddress());
        row.put("landmark", project.getLandmark());
        row.put("cadastre_number", project.getCadastreNumber());
        row.put("construction_status", project.getConstructionStatus());
        row.put("date_start_project", project.getDateStartProject());
        row.put("date_end_project", project.getDateEndProject());
        row.put("date_start_fact", project.getDateStartFact());
        row.put("date_end_fact", project.getDateEndFact());
        row.put("integration_data", project.getIntegrationData());
        row.put("address_id", project.getAddressId());
        row.put("land_plot_geojson", project.getLandPlotGeojson());
        row.put("land_plot_area_m2", project.getLandPlotAreaM2());
        row.put("created_at", project.getCreatedAt());
        row.put("updated_at", project.getUpdatedAt());
        return row;
    }

    private java.time.LocalDate parseLocalDate(Object value) {
        if (value == null || String.valueOf(value).isBlank()) return null;
        if (value instanceof java.time.LocalDate ld) return ld;
        try {
            // Берем только YYYY-MM-DD
            return java.time.LocalDate.parse(String.valueOf(value).substring(0, 10)); 
        } catch (Exception e) {
            return null;
        }
    }
    private int toInt(Object value) {
        if (value == null) return 0;
        if (value instanceof Number n) return n.intValue();
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (NumberFormatException e) {
            return 0;
        }
    }


    private String formatApiTimestamp(Object value) {
        if (value == null) return null;

        if (value instanceof java.time.Instant instant) {
            return instant.toString().replace("Z", "+00:00");
        }
        if (value instanceof java.time.OffsetDateTime odt) {
            return odt.toInstant().toString().replace("Z", "+00:00");
        }
        if (value instanceof java.time.LocalDateTime ldt) {
            return ldt.atZone(java.time.ZoneId.systemDefault()).toInstant().toString().replace("Z", "+00:00");
        }
        if (value instanceof java.sql.Timestamp ts) {
            return ts.toInstant().toString().replace("Z", "+00:00");
        }

        String s = String.valueOf(value);
        if (s.contains(" ")) s = s.replace(" ", "T");
        if (s.endsWith("Z")) s = s.substring(0, s.length() - 1) + "+00:00";
        return s;
    }
    private String stringVal(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private String stringValOr(Object value, String fallback) {
        String val = stringVal(value);
        return val == null || val.isBlank() ? fallback : val;
    }




    private Set<String> parseCsvValues(String csv) {
        if (csv == null || csv.isBlank()) return Set.of();
        return Arrays.stream(csv.split(",")).map(String::trim).filter(v -> !v.isBlank()).collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
    }

    private boolean containsIgnoreCase(Object value, String lowerNeedle) {
        if (value == null || lowerNeedle == null || lowerNeedle.isBlank()) return false;
        return String.valueOf(value).toLowerCase(Locale.ROOT).contains(lowerNeedle);
    }

    private String normalizeProjectStatusFromDb(String status) {
        if (status == null) return "UNKNOWN";
        return switch (status) {
            case "completed" -> "COMPLETED";
            case "approved", "ready_for_operation" -> "READY_FOR_OPERATION";
            case "in_progress", "new", "draft" -> "IN_PROGRESS";
            default -> status;
        };
    }

    private List<String> buildProjectAvailableActions(String actorRole, uz.reestrmkd.backendjpa.domain.ApplicationEntity app, String actorUserId) {
        List<String> actions = new ArrayList<>();
        actions.add("view");

        String role = actorRole == null ? "" : actorRole.toLowerCase(Locale.ROOT);
        boolean isAdmin = "admin".equals(role);
        boolean isBranchManager = "branch_manager".equals(role);
        boolean isTechnician = "technician".equals(role);
        boolean isController = "controller".equals(role);

        String status = app == null ? null : app.getStatus();
        String substatus = app == null ? "DRAFT" : stringValOr(app.getWorkflowSubstatus(), "DRAFT");
        String assigneeName = app == null ? null : app.getAssigneeName();

        boolean isCompleted = "COMPLETED".equals(status);
        boolean isDeclined = "DECLINED".equals(status);
        boolean isPendingDecline = "PENDING_DECLINE".equals(substatus);
        boolean isAssigned = assigneeName == null || assigneeName.isBlank() || Objects.equals(assigneeName, actorUserId);

        if (!isCompleted && !isDeclined && (isAdmin || isBranchManager)) actions.add("reassign");
        if (isAdmin) actions.add("delete");
        if ((isAdmin || isBranchManager || isController) && !isCompleted) actions.add("decline");
        if (isPendingDecline && (isAdmin || isBranchManager)) actions.add("return_from_decline");

        boolean canTechnicianEdit = isTechnician && isAssigned && Set.of("DRAFT", "REVISION", "RETURNED_BY_MANAGER", "INTEGRATION").contains(substatus);
        boolean canControllerEdit = isController && "REVIEW".equals(substatus);

        if (!isCompleted && !isDeclined && (canTechnicianEdit || canControllerEdit || isAdmin)) {
            actions.add("edit");
        }

        return actions.stream().distinct().toList();
    }

    private Map<String, Object> normalizeGeometry(Map<String, Object> geometry) {
        if (geometry == null || geometry.isEmpty()) return Map.of();
        Object type = geometry.get("type");
        if ("MultiPolygon".equals(type)) return geometry;
        if ("Polygon".equals(type)) {
            Map<String, Object> next = new LinkedHashMap<>();
            next.put("type", "MultiPolygon");
            next.put("coordinates", List.of(geometry.get("coordinates")));
            return next;
        }
        return Map.of();
    }

    private Map<String, String> ensureAddressRecord(String addressId, String districtSoatoRaw, String streetIdRaw, String mahallaIdRaw, 
                                                    String buildingNoRaw, String apartmentNoRaw,
                                                    String regionName, String districtName, 
                                                    String streetName, String mahallaName) {
        
        // Нормализация пустых строк в null
        String districtSoato = districtSoatoRaw != null && !districtSoatoRaw.isBlank() ? districtSoatoRaw : null;
        String streetId = streetIdRaw != null && !streetIdRaw.isBlank() ? streetIdRaw : null;
        String mahallaId = mahallaIdRaw != null && !mahallaIdRaw.isBlank() ? mahallaIdRaw : null;
        String buildingNo = buildingNoRaw != null && !buildingNoRaw.isBlank() ? buildingNoRaw : null;
        String apartmentNo = apartmentNoRaw != null && !apartmentNoRaw.isBlank() ? apartmentNoRaw : null;

        if (districtSoato == null && streetId == null && mahallaId == null && buildingNo == null && apartmentNo == null) {
            return null;
        }

        // Подтягиваем названия для красивого full_address, если они не переданы
        if (streetId != null && streetName == null) {
            Map<String, Object> s = queryOne("select name from streets where id = cast(:id as uuid)", Map.of("id", streetId));
            if (s != null) streetName = stringVal(s.get("name"));
        }
        if (mahallaId != null && mahallaName == null) {
            Map<String, Object> m = queryOne("select name from makhallas where id = cast(:id as uuid)", Map.of("id", mahallaId));
            if (m != null) mahallaName = stringVal(m.get("name"));
        }
        if (districtSoato != null && (districtName == null || regionName == null)) {
            Map<String, Object> d = queryOne("select name_ru, name_uz, region_id from districts where soato = :soato", Map.of("soato", districtSoato));
            if (d != null) {
                if (districtName == null) districtName = stringValOr(d.get("name_ru"), stringVal(d.get("name_uz")));
                if (regionName == null && d.get("region_id") != null) {
                    Map<String, Object> r = queryOne("select name_ru, name_uz from regions where id = cast(:id as uuid)", Map.of("id", stringVal(d.get("region_id"))));
                    if (r != null) regionName = stringValOr(r.get("name_ru"), stringVal(r.get("name_uz")));
                }
            }
        }

        List<String> addressParts = new ArrayList<>();
        if (regionName != null && !regionName.isBlank()) addressParts.add(regionName);
        if (districtName != null && !districtName.isBlank()) addressParts.add(districtName);
        if (mahallaName != null && !mahallaName.isBlank()) addressParts.add(mahallaName);
        if (streetName != null && !streetName.isBlank()) addressParts.add(streetName);
        if (buildingNo != null && !buildingNo.isBlank()) addressParts.add("д. " + buildingNo);
        if (apartmentNo != null && !apartmentNo.isBlank()) addressParts.add("кв. " + apartmentNo);

        String fullAddress = String.join(", ", addressParts);
        if (fullAddress.isBlank()) fullAddress = null;

        Map<String, Object> dbParams = new HashMap<>();
        dbParams.put("district", districtSoato);
        dbParams.put("street", streetId);
        dbParams.put("mahalla", mahallaId);
        dbParams.put("city", regionName);
        dbParams.put("buildingNo", buildingNo);
        dbParams.put("apartmentNo", apartmentNo);
        dbParams.put("fullAddress", fullAddress);

        String targetId = addressId;

        if (targetId != null && !targetId.isBlank()) {
            // Если у проекта уже есть адрес — обновляем его (UPDATE)
            dbParams.put("id", targetId);
            execute("""
                update addresses
                set district = cast(:district as text),
                    street = cast(:street as uuid),
                    mahalla = cast(:mahalla as uuid),
                    city = cast(:city as text),
                    building_no = cast(:buildingNo as text),
                    apartment_no = cast(:apartmentNo as text),
                    full_address = cast(:fullAddress as text)
                where id = cast(:id as uuid)
                """, dbParams);
        } else {
            // Иначе создаем новую запись адреса (INSERT)
            targetId = java.util.UUID.randomUUID().toString();
            dbParams.put("id", targetId);
            execute("""
                insert into addresses(id, dtype, versionrev, district, street, mahalla, city, building_no, apartment_no, full_address)
                values (cast(:id as uuid), 'Address', 0, cast(:district as text), cast(:street as uuid), cast(:mahalla as uuid), cast(:city as text), cast(:buildingNo as text), cast(:apartmentNo as text), cast(:fullAddress as text))
                """, dbParams);
        }

        Map<String, String> res = new HashMap<>();
        res.put("id", targetId);
        res.put("full_address", fullAddress);
        return res;
    }
    
private String deriveBlockAddressId(String parentAddressId, String corpusNoRaw) {
        String corpusNo = corpusNoRaw != null && !corpusNoRaw.isBlank() ? corpusNoRaw : null;
        if (parentAddressId == null || corpusNo == null) return null;
        
        Map<String, Object> parent = queryOne("select district, street, mahalla, city, building_no from addresses where id = cast(:id as uuid)", Map.of("id", parentAddressId));
        if (parent == null) return null;

        String districtSoato = stringVal(parent.get("district"));
        String streetId = stringVal(parent.get("street"));
        String mahallaId = stringVal(parent.get("mahalla"));
        
        // Генерируем детерминированный ID для корпуса
        String key = String.format("%s|%s|%s|%s|%s", districtSoato, streetId, mahallaId, corpusNo, null);
        String id = java.util.UUID.nameUUIDFromBytes(key.getBytes(java.nio.charset.StandardCharsets.UTF_8)).toString();

        Map<String, Object> dbParams = new HashMap<>();
        dbParams.put("id", id);
        dbParams.put("district", districtSoato);
        dbParams.put("street", streetId);
        dbParams.put("mahalla", mahallaId);
        dbParams.put("city", stringVal(parent.get("city")));
        dbParams.put("buildingNo", corpusNo);
        dbParams.put("fullAddress", ((parent.get("city") == null ? "" : String.valueOf(parent.get("city")) + ", ") + "корп. " + corpusNo));

        execute("""
            insert into addresses(id, dtype, versionrev, district, street, mahalla, city, building_no, full_address)
            values (:id, 'Address', 0, cast(:district as text), cast(:street as uuid), cast(:mahalla as uuid), cast(:city as text), cast(:buildingNo as text), cast(:fullAddress as text))
            on conflict (id) do update
            set full_address = excluded.full_address
            """, dbParams);
            
        return id;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> mapFrom(Object value) {
        if (value instanceof Map<?, ?> raw) {
            Map<String, Object> out = new LinkedHashMap<>();
            raw.forEach((k, v) -> out.put(String.valueOf(k), v));
            return out;
        }
        return new LinkedHashMap<>();
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> toMapList(Object value) {
        if (!(value instanceof List<?> list)) return List.of();
        List<Map<String, Object>> out = new ArrayList<>();
        for (Object item : list) {
            if (item instanceof Map<?, ?> map) {
                Map<String, Object> converted = new LinkedHashMap<>();
                map.forEach((k, v) -> converted.put(String.valueOf(k), v));
                out.add(converted);
            }
        }
        return out;
    }

    private List<?> toList(Object value) {
        if (value instanceof List<?> list) return list;
        return List.of();
    }

    private Integer nullableInt(Object value) {
        if (value == null) return null;
        if (value instanceof Number n) return n.intValue();
        try {
            String text = String.valueOf(value).trim();
            if (text.isEmpty()) return null;
            return Integer.parseInt(text);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private int normalizeDepth(Integer depth) {
        if (depth == null) return 0;
        return Math.max(0, depth);
    }

    private double toDouble(Object value) {
        if (value == null) return 0d;
        if (value instanceof Number n) return n.doubleValue();
        try {
            return Double.parseDouble(String.valueOf(value));
        } catch (NumberFormatException ex) {
            return 0d;
        }
    }

    private void incBucket(Map<String, Object> bucket, double areaToAdd) {
        double currentArea = toDouble(bucket.get("area"));
        int currentCount = toInt(bucket.get("count"));
        bucket.put("area", currentArea + areaToAdd);
        bucket.put("count", currentCount + 1);
    }

    private Map<String, Object> objectToMap(Object value) {
        return mapFrom(value);
    }

    private String toPgUuidArrayLiteral(List<?> values) {
        if (values == null || values.isEmpty()) return "{}";
        List<String> parts = new ArrayList<>();
        for (Object value : values) {
            if (value == null) continue;
            String text = String.valueOf(value).trim();
            if (!text.isEmpty()) parts.add(text);
        }
        if (parts.isEmpty()) return "{}";
        return "{" + String.join(",", parts) + "}";
    }

    private Map<String, Object> bucket() {
        Map<String, Object> bucket = new LinkedHashMap<>();
        bucket.put("area", 0d);
        bucket.put("count", 0);
        return bucket;
    }

    private double progressPercent(Object dateStart, Object dateEnd) {
        if (dateStart == null || dateEnd == null) return 0d;
        try {
            Instant start = parseInstant(dateStart);
            Instant end = parseInstant(dateEnd);
            Instant now = Instant.now();
            if (!end.isAfter(start)) return 100d;
            if (now.isBefore(start)) return 0d;
            if (now.isAfter(end)) return 100d;
            double total = end.toEpochMilli() - start.toEpochMilli();
            double done = now.toEpochMilli() - start.toEpochMilli();
            return Math.max(0d, Math.min(100d, (done / total) * 100d));
        } catch (Exception ex) {
            return 0d;
        }
    }

    private Instant parseInstant(Object value) {
        if (value instanceof Instant instant) return instant;
        if (value instanceof java.sql.Timestamp ts) return ts.toInstant();
        if (value instanceof java.util.Date date) return date.toInstant();
        return Instant.parse(String.valueOf(value));
    }

    private Set<String> toMarkerSet(Object value, boolean technical) {
        Set<String> out = new LinkedHashSet<>();
        for (Object item : toList(value)) {
            String marker = String.valueOf(item == null ? "" : item).trim();
            if (marker.isEmpty()) continue;
            if (technical && marker.matches("^-?\\d+$")) {
                out.add(marker + "-Т");
            } else {
                out.add(marker);
            }
        }
        return out;
    }
    // Этот метод берет сырую строку из базы и превращает её в правильный JSON-объект для фронтенда
    private Map<String, Object> parseJsonb(Object obj) {
        if (obj == null) return null;
        try {
            // obj.toString() отлично работает и для обычных строк, и для объектов PGobject от PostgreSQL
            return objectMapper.readValue(obj.toString(), Map.class);
        } catch (Exception e) {
            return new java.util.LinkedHashMap<>();
        }
    }
}
