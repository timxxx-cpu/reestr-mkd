package uz.reestrmkd.backendjpa.service;

import com.fasterxml.jackson.core.JsonProcessingException;
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
    private final org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate jdbc;
    private final uz.reestrmkd.backendjpa.repo.BuildingRepository buildingsRepo;
    private final uz.reestrmkd.backendjpa.repo.BuildingBlockRepository blocksRepo;
    private final uz.reestrmkd.backendjpa.repo.BlockConstructionRepository blockConstructionRepo;
    private final uz.reestrmkd.backendjpa.repo.BlockEngineeringRepository blockEngineeringRepo;
    private final uz.reestrmkd.backendjpa.repo.BlockFloorMarkerRepository markersRepo;

    @PersistenceContext
    private EntityManager em;

    public Map<String, Object> list(String scope) {
        if (scope == null || scope.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Scope is required");
        }
        var items = projects.findByScopeIdOrderByIdDesc(scope);
        return Map.of("items", items, "total", items.size());
    }

    @Transactional(readOnly = true)
    public Map<String, Object> mapOverview(String scope) {
        if (scope == null || scope.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Scope is required");
        }

        List<Map<String, Object>> projectRows = queryList(
            "select id, uj_code, name, address, construction_status, land_plot_geojson from projects where scope_id = :scope order by updated_at desc",
            Map.of("scope", scope)
        );

        List<Map<String, Object>> applicationRows = queryList(
            "select project_id, status from applications where scope_id = :scope",
            Map.of("scope", scope)
        );

        List<Map<String, Object>> buildingRows = queryList(
            "select id, project_id, label, house_number, category, building_code, footprint_geojson from buildings where project_id in (select id from projects where scope_id = :scope)",
            Map.of("scope", scope)
        );

        List<Map<String, Object>> blockRows = queryList(
            "select id, building_id, label, floors_count, footprint_geojson, is_basement_block from building_blocks where building_id in (select id from buildings where project_id in (select id from projects where scope_id = :scope))",
            Map.of("scope", scope)
        );

        List<Map<String, Object>> floorRows = queryList(
            "select id, block_id from floors where block_id in (select id from building_blocks where building_id in (select id from buildings where project_id in (select id from projects where scope_id = :scope)))",
            Map.of("scope", scope)
        );

        List<Map<String, Object>> unitRows = queryList(
            "select id, floor_id, unit_type from units where floor_id in (select id from floors where block_id in (select id from building_blocks where building_id in (select id from buildings where project_id in (select id from projects where scope_id = :scope))))",
            Map.of("scope", scope)
        );

        Map<String, String> statusByProject = new LinkedHashMap<>();
        for (Map<String, Object> row : applicationRows) {
            String projectId = stringVal(row.get("project_id"));
            if (projectId != null && !statusByProject.containsKey(projectId)) {
                statusByProject.put(projectId, stringVal(row.get("status")));
            }
        }

        Map<String, List<Map<String, Object>>> blocksByBuilding = new LinkedHashMap<>();
        for (Map<String, Object> row : blockRows) {
            String buildingId = stringVal(row.get("building_id"));
            if (buildingId == null) continue;
            blocksByBuilding.computeIfAbsent(buildingId, k -> new ArrayList<>()).add(row);
        }

        Map<String, List<Map<String, Object>>> floorsByBlock = new LinkedHashMap<>();
        for (Map<String, Object> row : floorRows) {
            String blockId = stringVal(row.get("block_id"));
            if (blockId == null) continue;
            floorsByBlock.computeIfAbsent(blockId, k -> new ArrayList<>()).add(row);
        }

        Map<String, List<Map<String, Object>>> unitsByFloor = new LinkedHashMap<>();
        for (Map<String, Object> row : unitRows) {
            String floorId = stringVal(row.get("floor_id"));
            if (floorId == null) continue;
            unitsByFloor.computeIfAbsent(floorId, k -> new ArrayList<>()).add(row);
        }

        Map<String, List<Map<String, Object>>> buildingsByProject = new LinkedHashMap<>();
        for (Map<String, Object> row : buildingRows) {
            String projectId = stringVal(row.get("project_id"));
            String buildingId = stringVal(row.get("id"));
            if (projectId == null || buildingId == null) continue;

            List<Map<String, Object>> blocks = blocksByBuilding.getOrDefault(buildingId, List.of());
            List<Map<String, Object>> regularBlocks = blocks.stream()
                .filter(block -> !Boolean.TRUE.equals(block.get("is_basement_block")))
                .toList();
            int floorsMax = 0;
            List<Map<String, Object>> floors = new ArrayList<>();
            for (Map<String, Object> block : regularBlocks) {
                floorsMax = Math.max(floorsMax, toInt(block.get("floors_count")));
                floors.addAll(floorsByBlock.getOrDefault(stringVal(block.get("id")), List.of()));
            }

            List<Map<String, Object>> units = new ArrayList<>();
            for (Map<String, Object> floor : floors) {
                units.addAll(unitsByFloor.getOrDefault(stringVal(floor.get("id")), List.of()));
            }

            int apartmentsCount = (int) units.stream()
                .filter(unit -> "apartment".equals(stringVal(unit.get("unit_type"))))
                .count();

            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", row.get("id"));
            item.put("label", row.get("label"));
            item.put("buildingCode", row.get("building_code"));
            item.put("houseNumber", row.get("house_number"));
            item.put("house_number", row.get("house_number"));
            item.put("category", row.get("category"));
            item.put("blocksCount", regularBlocks.size());
            item.put("floorsMax", floorsMax > 0 ? floorsMax : null);
            item.put("unitsCount", units.size());
            item.put("apartmentsCount", apartmentsCount);
            item.put("address", row.get("house_number") == null ? null : "д. " + row.get("house_number"));
            item.put("geometry", row.get("footprint_geojson"));
            item.put("blocks", regularBlocks.stream().map(block -> {
                Map<String, Object> blockPayload = new LinkedHashMap<>();
                blockPayload.put("id", block.get("id"));
                blockPayload.put("label", block.get("label"));
                blockPayload.put("floorsCount", toInt(block.get("floors_count")));
                blockPayload.put("geometry", block.get("footprint_geojson"));
                return blockPayload;
            }).toList());

            buildingsByProject.computeIfAbsent(projectId, k -> new ArrayList<>()).add(item);
        }

        List<Map<String, Object>> items = new ArrayList<>();
        for (Map<String, Object> row : projectRows) {
            String projectId = stringVal(row.get("id"));
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
            item.put("id", row.get("id"));
            item.put("ujCode", row.get("uj_code"));
            item.put("name", row.get("name"));
            item.put("address", row.get("address"));
            item.put("status", statusByProject.getOrDefault(projectId, stringVal(row.get("construction_status"))));
            item.put("totalBuildings", projectBuildings.size());
            item.put("buildingTypeStats", buildingTypeStats);
            item.put("landPlotGeometry", row.get("land_plot_geojson"));
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

        List<Map<String, Object>> rows = queryList(
            "select status, workflow_substatus from applications where scope_id = :scope",
            Map.of("scope", scope)
        );

        Set<String> workSubstatuses = Set.of("DRAFT", "REVISION", "RETURNED_BY_MANAGER");
        Map<String, Object> counts = new LinkedHashMap<>();
        counts.put("work", 0);
        counts.put("review", 0);
        counts.put("integration", 0);
        counts.put("pendingDecline", 0);
        counts.put("declined", 0);
        counts.put("registryApplications", 0);
        counts.put("registryComplexes", 0);

        for (Map<String, Object> row : rows) {
            String status = stringVal(row.get("status"));
            String sub = stringVal(row.get("workflow_substatus"));
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
    public Map<String, Object> integrationStatus(String projectId, String status) {
        // Мы адаптируем метод под Node.js: статус должен парситься как JSON-ключ
        // Фронтенд присылает body: { field: "...", status: "..." }
        // Так как старый контроллер отдавал только status как строку, 
        // нам придется использовать заглушку для поля 'field' или временно оставить так.
        // Чтобы не ломать контроллер, запишем в интеграционные данные целиком:
        var app = applications.findFirstByProjectId(projectId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Application not found"));

        Map<String, Object> data = app.getIntegrationData();
        if (data == null) data = new java.util.HashMap<>();
        else data = new java.util.HashMap<>(data); // Делаем изменяемой
        
        data.put("lastUpdate", status); // В будущем мы починим контроллер, чтобы он принимал field
        app.setIntegrationData(data);
        applications.save(app);
        
        return Map.of("ok", true);
    }

   @Transactional(readOnly = true)
    public List<Map<String, Object>> geometryCandidates(String projectId) {
        var rows = jdbc.queryForList("""
            select id, source_index, label, properties, geom_geojson, area_m2, is_selected_land_plot, assigned_building_id
            from project_geometry_candidates
            where project_id = :projectId
            order by source_index asc
            """, Map.of("projectId", projectId));

        List<Map<String, Object>> payload = new java.util.ArrayList<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> map = new java.util.LinkedHashMap<>();
            map.put("id", row.get("id"));
            map.put("sourceIndex", row.get("source_index"));
            map.put("label", row.get("label"));
            
            // ПРОПУСКАЕМ ЧЕРЕЗ ПАРСЕР:
            map.put("properties", parseJsonb(row.get("properties")));
            map.put("geometry", parseJsonb(row.get("geom_geojson")));
            
            map.put("areaM2", row.get("area_m2"));
            map.put("isSelectedLandPlot", Boolean.TRUE.equals(row.get("is_selected_land_plot")));
            map.put("assignedBuildingId", row.get("assigned_building_id"));
            
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

            Query insert = em.createNativeQuery("""
                insert into project_geometry_candidates (id, project_id, source_index, label, properties, geom_geojson, updated_at)
                values (:id, :projectId, :sourceIndex, :label, cast(:properties as jsonb), cast(:geometry as jsonb), now())
                """);
            insert.setParameter("id", UUID.randomUUID().toString());
            insert.setParameter("projectId", projectId);
            insert.setParameter("sourceIndex", toInt(candidate.get("sourceIndex")));
            insert.setParameter("label", candidate.get("label") == null ? null : String.valueOf(candidate.get("label")));
            insert.setParameter("properties", toJson(candidate.getOrDefault("properties", Map.of())));
            insert.setParameter("geometry", toJson(candidate.get("geometry")));
            imported += insert.executeUpdate();
        }
        return Map.of("ok", true, "imported", imported);
    }

    @Transactional
    public Map<String, Object> selectLandPlot(String projectId, String candidateId) {
        if (candidateId == null || candidateId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "candidateId is required");
        }

        Map<String, Object> row = queryOne("""
            select geom_geojson, area_m2 from project_geometry_candidates
            where id = :candidateId and project_id = :projectId
            """, Map.of("candidateId", candidateId, "projectId", projectId));

        if (row == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Candidate not found");

        execute("""
            update project_geometry_candidates
            set is_selected_land_plot = false, updated_at = now()
            where project_id = :projectId
            """, Map.of("projectId", projectId));

        execute("""
            update project_geometry_candidates
            set is_selected_land_plot = true, updated_at = now()
            where id = :candidateId and project_id = :projectId
            """, Map.of("candidateId", candidateId, "projectId", projectId));

        execute("""
            update projects
            set land_plot_geojson = cast(:geometry as jsonb), land_plot_area_m2 = :area, updated_at = now()
            where id = :projectId
            """, Map.of("geometry", toJson(row.get("geom_geojson")), "area", row.get("area_m2"), "projectId", projectId));

        return Map.of("ok", true, "areaM2", row.get("area_m2"));
    }

    @Transactional
    public Map<String, Object> unselectLandPlot(String projectId) {
        execute("""
            update project_geometry_candidates
            set is_selected_land_plot = false, updated_at = now()
            where project_id = :projectId
            """, Map.of("projectId", projectId));

        execute("""
            update projects
            set land_plot_geojson = null, land_plot_geom = null, land_plot_area_m2 = null, updated_at = now()
            where id = :projectId
            """, Map.of("projectId", projectId));

        return Map.of("ok", true);
    }

    @Transactional
    public Map<String, Object> deleteGeometryCandidate(String projectId, String candidateId) {
        int count = execute("delete from project_geometry_candidates where id = :candidateId and project_id = :projectId",
            Map.of("candidateId", candidateId, "projectId", projectId));
        if (count == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Candidate not found");
        return Map.of("ok", true);
    }

    @Transactional
    public Map<String, Object> selectBuildingGeometry(String projectId, String buildingId, String candidateId) {
        if (candidateId == null || candidateId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "candidateId is required");
        }

        Map<String, Object> row = queryOne("""
            select area_m2 from project_geometry_candidates
            where id = :candidateId and project_id = :projectId
            """, Map.of("candidateId", candidateId, "projectId", projectId));
        if (row == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Candidate not found");

        execute("""
            update project_geometry_candidates
            set assigned_building_id = :buildingId, updated_at = now()
            where id = :candidateId and project_id = :projectId
            """, Map.of("buildingId", buildingId, "candidateId", candidateId, "projectId", projectId));

        return Map.of("ok", true, "areaM2", row.get("area_m2"));
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
            applicationInfo.put("requestedDeclineAt", app.getRequestedDeclineAt() != null ? app.getRequestedDeclineAt().toString() : null);

            // Шаги
            jdbc.queryForList("select step_index, is_completed, block_statuses from application_steps where application_id = :appId", Map.of("appId", app.getId()))
                .forEach(r -> {
                    Integer idx = nullableInt(r.get("step_index"));
                    if (Boolean.TRUE.equals(r.get("is_completed"))) completedSteps.add(idx);
                    stepBlockStatuses.put(String.valueOf(idx), parseJsonb(r.get("block_statuses")));
                });
            applicationInfo.put("completedSteps", completedSteps);

            // История
            jdbc.queryForList("select action, prev_status, next_status, user_name, comment, created_at from application_history where application_id = :appId order by created_at desc", Map.of("appId", app.getId()))
                .forEach(r -> {
                    Map<String, Object> h = new java.util.LinkedHashMap<>();
                    h.put("action", r.get("action"));
                    h.put("prevStatus", r.get("prev_status"));
                    h.put("nextStatus", r.get("next_status"));
                    h.put("user", r.get("user_name"));
                    h.put("comment", r.get("comment"));
                    h.put("date", r.get("created_at") != null ? r.get("created_at").toString() : null);
                    history.add(h);
                });
            applicationInfo.put("history", history);
        }

        // 4. Информация о зданиях и блоках (buildingDetails)
        Map<String, Object> buildingDetails = new java.util.LinkedHashMap<>();
        
        // Здания
        var bRows = jdbc.queryForList("select id, category, stage, construction_type, parking_type, has_non_res_part from buildings where project_id = :pId", Map.of("pId", projectId));
        for (Map<String, Object> bRow : bRows) {
            String bId = String.valueOf(bRow.get("id"));
            Map<String, Object> bData = new java.util.LinkedHashMap<>();
            bData.put("category", bRow.get("category"));
            bData.put("stage", bRow.get("stage"));
            bData.put("constructionType", bRow.get("construction_type"));
            bData.put("parkingType", bRow.get("parking_type"));
            bData.put("hasNonResPart", Boolean.TRUE.equals(bRow.get("has_non_res_part")));
            buildingDetails.put(bId + "_data", bData);

            // Подвалы
            var baseRows = jdbc.queryForList("select id, basement_depth, basement_has_parking, basement_parking_levels, basement_communications, entrances_count, linked_block_ids from building_blocks where building_id = cast(:bId as uuid) and is_basement_block = true", Map.of("bId", bId));
            List<Map<String, Object>> basementsList = new java.util.ArrayList<>();
            for (Map<String, Object> baseRow : baseRows) {
                Map<String, Object> bMap = new java.util.LinkedHashMap<>();
                bMap.put("id", baseRow.get("id"));
                bMap.put("depth", baseRow.get("basement_depth"));
                bMap.put("hasParking", Boolean.TRUE.equals(baseRow.get("basement_has_parking")));
                bMap.put("parkingLevels", parseJsonb(baseRow.get("basement_parking_levels")));
                bMap.put("communications", parseJsonb(baseRow.get("basement_communications")));
                bMap.put("entrancesCount", baseRow.get("entrances_count"));
                bMap.put("blocks", parseJsonb(baseRow.get("linked_block_ids")));
                basementsList.add(bMap);
            }
            buildingDetails.put(bId + "_features", Map.of("basements", basementsList));
        }

        // Блоки
        var blockRows = jdbc.queryForList("select bb.* from building_blocks bb join buildings b on bb.building_id = b.id where b.project_id = :pId and bb.is_basement_block = false", Map.of("pId", projectId));
        for (Map<String, Object> bbRow : blockRows) {
            String blockId = String.valueOf(bbRow.get("id"));
            Map<String, Object> blockData = new java.util.LinkedHashMap<>();
            blockData.put("floorsCount", bbRow.get("floors_count"));
            blockData.put("floorsFrom", bbRow.get("floors_from"));
            blockData.put("floorsTo", bbRow.get("floors_to"));
            blockData.put("entrances", bbRow.get("entrances_count"));
            blockData.put("elevators", bbRow.get("elevators_count"));
            blockData.put("vehicleEntries", bbRow.get("vehicle_entries"));
            blockData.put("levelsDepth", bbRow.get("levels_depth"));
            blockData.put("lightStructureType", bbRow.get("light_structure_type"));
            blockData.put("hasBasementFloor", Boolean.TRUE.equals(bbRow.get("has_basement")));
            blockData.put("hasAttic", Boolean.TRUE.equals(bbRow.get("has_attic")));
            blockData.put("hasLoft", Boolean.TRUE.equals(bbRow.get("has_loft")));
            blockData.put("hasExploitableRoof", Boolean.TRUE.equals(bbRow.get("has_roof_expl")));
            blockData.put("hasCustomAddress", Boolean.TRUE.equals(bbRow.get("has_custom_address")));
            blockData.put("customHouseNumber", bbRow.get("custom_house_number"));
            blockData.put("addressId", bbRow.get("address_id"));
            blockData.put("parentBlocks", parseJsonb(bbRow.get("parent_blocks")));
            blockData.put("blockGeometry", parseJsonb(bbRow.get("footprint_geojson")));

            // Конструктив
            jdbc.queryForList("select * from block_construction where block_id = cast(:blockId as uuid)", Map.of("blockId", blockId)).stream().findFirst().ifPresent(cRow -> {
                blockData.put("foundation", cRow.get("foundation"));
                blockData.put("walls", cRow.get("walls"));
                blockData.put("slabs", cRow.get("slabs"));
                blockData.put("roof", cRow.get("roof"));
                blockData.put("seismicity", cRow.get("seismicity"));
            });

            // Инженерка
            jdbc.queryForList("select * from block_engineering where block_id = cast(:blockId as uuid)", Map.of("blockId", blockId)).stream().findFirst().ifPresent(eRow -> {
                Map<String, Object> eng = new java.util.LinkedHashMap<>();
                eng.put("electricity", Boolean.TRUE.equals(eRow.get("has_electricity")));
                eng.put("hvs", Boolean.TRUE.equals(eRow.get("has_water")));
                eng.put("gvs", Boolean.TRUE.equals(eRow.get("has_hot_water")));
                eng.put("ventilation", Boolean.TRUE.equals(eRow.get("has_ventilation")));
                eng.put("firefighting", Boolean.TRUE.equals(eRow.get("has_firefighting")));
                eng.put("lowcurrent", Boolean.TRUE.equals(eRow.get("has_lowcurrent")));
                eng.put("sewerage", Boolean.TRUE.equals(eRow.get("has_sewerage")));
                eng.put("gas", Boolean.TRUE.equals(eRow.get("has_gas")));
                eng.put("heatingLocal", Boolean.TRUE.equals(eRow.get("has_heating_local")));
                eng.put("heatingCentral", Boolean.TRUE.equals(eRow.get("has_heating_central")));
                eng.put("internet", Boolean.TRUE.equals(eRow.get("has_internet")));
                eng.put("solarPanels", Boolean.TRUE.equals(eRow.get("has_solar_panels")));
                blockData.put("engineering", eng);
            });

            // Маркеры этажей
            List<String> techFloors = new java.util.ArrayList<>();
            List<String> commFloors = new java.util.ArrayList<>();
            jdbc.queryForList("select marker_key, is_technical, is_commercial from block_floor_markers where block_id = cast(:blockId as uuid)", Map.of("blockId", blockId)).forEach(mRow -> {
                String mk = String.valueOf(mRow.get("marker_key"));
                if (Boolean.TRUE.equals(mRow.get("is_technical"))) techFloors.add(mk);
                if (Boolean.TRUE.equals(mRow.get("is_commercial"))) commFloors.add(mk);
            });
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
        Set<String> projectBuildingIds = new java.util.HashSet<>();
        jdbc.queryForList("select id from buildings where project_id = :projectId", Map.of("projectId", projectId))
            .forEach(r -> projectBuildingIds.add(stringVal(r.get("id"))));

        Set<String> projectBlockIds = new java.util.HashSet<>();
        jdbc.queryForList("select bb.id from building_blocks bb join buildings b on b.id = bb.building_id where b.project_id = :projectId", Map.of("projectId", projectId))
            .forEach(r -> projectBlockIds.add(stringVal(r.get("id"))));

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
                jdbc.queryForList("select id from building_blocks where building_id = :bId and is_basement_block = true", Map.of("bId", buildingId))
                    .forEach(row -> {
                        String eId = stringVal(row.get("id"));
                        if (eId != null && !keepBasementIds.contains(eId)) blocksRepo.deleteById(eId);
                    });
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
                jdbc.update("delete from block_floor_markers where block_id = :blockId", Map.of("blockId", blockId));
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

                // Сброс старой матрицы (заглушка для сохранения стабильности генератора)
                jdbc.update("delete from entrance_matrix m where m.block_id = :blockId and not exists (select 1 from floors f where f.id = m.floor_id and f.block_id = :blockId)", Map.of("blockId", blockId));
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
        List<Map<String, Object>> blockRows = queryList(
            "select bb.id from building_blocks bb join buildings b on b.id = bb.building_id where b.project_id = :projectId",
            Map.of("projectId", projectId)
        );
        List<String> blockIds = blockRows.stream().map(r -> stringVal(r.get("id"))).filter(Objects::nonNull).toList();
        if (blockIds.isEmpty()) {
            return Map.of("markerRows", List.of(), "floors", List.of(), "entrances", List.of(), "matrix", List.of(), "units", List.of(), "mops", List.of());
        }

        List<Map<String, Object>> markerRows = queryList("select block_id, marker_key, is_technical, is_commercial from block_floor_markers where block_id in (:blockIds)", Map.of("blockIds", blockIds));
        List<Map<String, Object>> floors = queryList("select id, block_id, floor_key, label, index, floor_type, height, area_proj, area_fact, is_duplex, parent_floor_index, is_commercial, is_technical, is_stylobate, is_basement, is_attic, is_loft, is_roof, basement_id from floors where block_id in (:blockIds)", Map.of("blockIds", blockIds));
        List<String> floorIds = floors.stream().map(r -> stringVal(r.get("id"))).filter(Objects::nonNull).toList();

        List<Map<String, Object>> entrances = queryList("select id, block_id, number from entrances where block_id in (:blockIds)", Map.of("blockIds", blockIds));
        List<Map<String, Object>> matrix = queryList("select floor_id, entrance_number, flats_count, commercial_count, mop_count from entrance_matrix where block_id in (:blockIds)", Map.of("blockIds", blockIds));
        List<Map<String, Object>> units = floorIds.isEmpty() ? List.of() : queryList("select id, floor_id, entrance_id, number, unit_type, has_mezzanine, mezzanine_type, total_area, living_area, useful_area, rooms_count, status, cadastre_number from units where floor_id in (:floorIds)", Map.of("floorIds", floorIds));
        List<Map<String, Object>> mops = floorIds.isEmpty() ? List.of() : queryList("select id, floor_id, entrance_id, type, area, height from common_areas where floor_id in (:floorIds)", Map.of("floorIds", floorIds));

        return Map.of("markerRows", markerRows, "floors", floors, "entrances", entrances, "matrix", matrix, "units", units, "mops", mops);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> passport(String projectId) {
        // Джойним адреса и справочники для получения полных кодов
        Map<String, Object> project = queryOne("""
            select p.*, 
                   a.district as addr_district, 
                   a.street as addr_street, 
                   a.mahalla as addr_mahalla, 
                   a.building_no as addr_building_no,
                   r.soato as addr_region_soato
            from projects p 
            left join addresses a on a.id = p.address_id 
            left join districts d on d.soato = a.district
            left join regions r on r.id = d.region_id
            where p.id = :projectId
            """, Map.of("projectId", projectId));

        if (project == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Project not found");
        var participants = queryList("select * from project_participants where project_id = :projectId", Map.of("projectId", projectId));
        var docs = queryList("select * from project_documents where project_id = :projectId order by doc_date desc", Map.of("projectId", projectId));

        Map<String, Object> participantsMap = new LinkedHashMap<>();
        for (Map<String, Object> part : participants) {
            String role = stringVal(part.get("role"));
            if (role == null) continue;
            participantsMap.put(role, Map.of(
                "id", part.get("id"),
                "name", part.get("name"),
                "inn", part.get("inn"),
                "role", role
            ));
        }

        List<Map<String, Object>> documents = new ArrayList<>();
        for (Map<String, Object> d : docs) {
            documents.add(Map.of(
                "id", d.get("id"),
                "name", d.get("name"),
                "type", d.get("doc_type"),
                "date", d.get("doc_date"),
                "number", d.get("doc_number"),
                "url", d.get("file_url")
            ));
        }

        Map<String, Object> complexInfo = new LinkedHashMap<>();
        complexInfo.put("name", project.get("name"));
        complexInfo.put("ujCode", project.get("uj_code"));
        complexInfo.put("status", project.get("construction_status"));
        complexInfo.put("region", project.get("region"));
        complexInfo.put("district", project.get("district"));
        complexInfo.put("street", project.get("address"));
        complexInfo.put("addressId", project.get("address_id"));
        complexInfo.put("landmark", project.get("landmark"));
        complexInfo.put("dateStartProject", project.get("date_start_project"));
        complexInfo.put("dateEndProject", project.get("date_end_project"));
        complexInfo.put("dateStartFact", project.get("date_start_fact"));
        complexInfo.put("dateEndFact", project.get("date_end_fact"));
        
        // Новые поля из таблицы addresses
        complexInfo.put("regionSoato", project.get("addr_region_soato"));
        complexInfo.put("districtSoato", project.get("addr_district"));
        complexInfo.put("streetId", project.get("addr_street"));
        complexInfo.put("mahallaId", project.get("addr_mahalla"));
        complexInfo.put("buildingNo", project.get("addr_building_no"));

        Map<String, Object> cadastre = new LinkedHashMap<>();
        cadastre.put("number", project.get("cadastre_number"));
        cadastre.put("area", project.get("land_plot_area_m2"));

        Map<String, Object> landPlot = new LinkedHashMap<>();
        landPlot.put("geometry", project.get("land_plot_geojson"));
        landPlot.put("areaM2", project.get("land_plot_area_m2"));

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
        Map<String, Object> params = new HashMap<>();

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

        params.put("name", info.get("name"));
        params.put("status", info.get("status"));
        params.put("region", info.get("region"));
        params.put("district", info.get("district"));
        params.put("street", street);
        params.put("addressId", addressId);
        params.put("hasAddressId", hasAddressId);
        params.put("landmark", info.get("landmark"));
        params.put("dateStartProject", info.get("dateStartProject"));
        params.put("dateEndProject", info.get("dateEndProject"));
        params.put("dateStartFact", info.get("dateStartFact"));
        params.put("dateEndFact", info.get("dateEndFact"));
        params.put("cadastreNumber", cadastreData.get("number"));
        params.put("landPlotArea", cadastreData.get("area"));
        params.put("projectId", projectId);

        execute("""
            update projects
            set name = :name,
                construction_status = :status,
                region = :region,
                district = :district,
                address = :street,
                address_id = case when :hasAddressId then cast(:addressId as uuid) else address_id end,
                landmark = :landmark,
                date_start_project = :dateStartProject,
                date_end_project = :dateEndProject,
                date_start_fact = :dateStartFact,
                date_end_fact = :dateEndFact,
                cadastre_number = :cadastreNumber,
                land_plot_area_m2 = :landPlotArea,
                updated_at = now()
            where id = :projectId
            """, params);
            
        Map<String, Object> row = queryOne("select * from projects where id = :projectId", Map.of("projectId", projectId));
        if (row == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Project not found");
        return row;
    }

    @Transactional
    public Map<String, Object> participants(String projectId, String role, Map<String, Object> body) {
        Map<String, Object> data = mapFrom(body == null ? null : body.get("data"));
        String participantId = stringValOr(data.get("id"), UUID.randomUUID().toString());
        execute("""
            insert into project_participants (id, project_id, role, name, inn, updated_at)
            values (:id, :projectId, :role, :name, :inn, now())
            on conflict (id) do update
            set role = excluded.role, name = excluded.name, inn = excluded.inn, updated_at = now()
            """, Map.of(
            "id", participantId,
            "projectId", projectId,
            "role", role,
            "name", stringValOr(data.get("name"), ""),
            "inn", stringValOr(data.get("inn"), "")
        ));
        Map<String, Object> row = queryOne("select * from project_participants where id = :id", Map.of("id", participantId));
        return row == null ? Map.of("id", participantId) : row;
    }

    @Transactional
    public Map<String, Object> documents(String projectId, Map<String, Object> body) {
        Map<String, Object> doc = mapFrom(body == null ? null : body.get("doc"));
        String id = stringValOr(doc.get("id"), UUID.randomUUID().toString());
        execute("""
            insert into project_documents (id, project_id, name, doc_type, doc_date, doc_number, file_url, updated_at)
            values (:id, :projectId, :name, :docType, :docDate, :docNumber, :fileUrl, now())
            on conflict (id) do update
            set name = excluded.name,
                doc_type = excluded.doc_type,
                doc_date = excluded.doc_date,
                doc_number = excluded.doc_number,
                file_url = excluded.file_url,
                updated_at = now()
            """, Map.of(
            "id", id,
            "projectId", projectId,
            "name", stringValOr(doc.get("name"), ""),
            "docType", stringValOr(doc.get("type"), ""),
            "docDate", doc.get("date"),
            "docNumber", stringValOr(doc.get("number"), ""),
            "fileUrl", stringVal(doc.get("url"))
        ));
        Map<String, Object> row = queryOne("select * from project_documents where id = :id", Map.of("id", id));
        return row == null ? Map.of("id", id) : row;
    }

    @Transactional
    public Map<String, Object> deleteDoc(String documentId) {
        int deleted = execute("delete from project_documents where id = :id", Map.of("id", documentId));
        if (deleted == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Document not found");
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
            
        return Map.of("integrationStatus", app.getIntegrationData() != null ? app.getIntegrationData() : Map.of());
    }

    @Transactional(readOnly = true)
    public Map<String, Object> parkingCounts(String projectId) {
        Map<String, Object> row = queryOne("""
            select count(1) as parking_places
            from units u
            join floors f on f.id = u.floor_id
            join building_blocks b on b.id = f.block_id
            join buildings g on g.id = b.building_id
            where g.project_id = :projectId and u.unit_type = 'parking'
            """, Map.of("projectId", projectId));
        return Map.of("parkingPlaces", row == null ? 0 : toInt(row.get("parking_places")));
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> buildingsSummary() {
        return queryList("select * from buildings order by created_at desc", Map.of());
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> basements(String projectId) {
        List<Map<String, Object>> rows = queryList("""
            select bb.id, bb.building_id, bb.linked_block_ids, bb.basement_depth, bb.basement_has_parking,
                   bb.basement_parking_levels, bb.basement_communications, bb.entrances_count
            from building_blocks bb
            join buildings b on b.id = bb.building_id
            where b.project_id = :projectId and bb.is_basement_block = true
            """, Map.of("projectId", projectId));

        List<Map<String, Object>> payload = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            List<?> linkedBlocks = toList(row.get("linked_block_ids"));
            int depth = normalizeDepth(toInt(row.get("basement_depth")));
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", row.get("id"));
            item.put("buildingId", row.get("building_id"));
            item.put("blockId", linkedBlocks.isEmpty() ? null : linkedBlocks.get(0));
            item.put("blocks", linkedBlocks);
            item.put("depth", depth);
            item.put("hasParking", Boolean.TRUE.equals(row.get("basement_has_parking")));
            item.put("parkingLevels", objectToMap(row.get("basement_parking_levels")));
            item.put("communications", objectToMap(row.get("basement_communications")));
            item.put("entrancesCount", Math.min(10, Math.max(1, toInt(row.get("entrances_count")))));
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

        Map<String, Object> row = queryOne("""
            select basement_depth, basement_parking_levels
            from building_blocks
            where id = :id and is_basement_block = true
            """, Map.of("id", basementId));
        if (row == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Basement block not found");

        int basementDepth = normalizeDepth(toInt(row.get("basement_depth")));
        if (parsedLevel > basementDepth) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "level must be <= basement depth (" + basementDepth + ")");
        }

        Map<String, Object> levels = new LinkedHashMap<>(objectToMap(row.get("basement_parking_levels")));
        levels.put(String.valueOf(parsedLevel), Boolean.TRUE.equals(body == null ? null : body.get("isEnabled")));

        execute("""
            update building_blocks
            set basement_parking_levels = cast(:levels as jsonb), updated_at = now()
            where id = :id and is_basement_block = true
            """, Map.of("levels", toJson(levels), "id", basementId));
        return Map.of("ok", true);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> fullRegistry(String projectId) {
        Map<String, Object> projectRow = queryOne("select address_id from projects where id = :projectId", Map.of("projectId", projectId));
        String projectAddressId = projectRow == null ? null : stringVal(projectRow.get("address_id"));

        List<Map<String, Object>> buildings = queryList("select * from buildings where project_id = :projectId", Map.of("projectId", projectId));
        if (buildings.isEmpty()) {
            return Map.of("buildings", List.of(), "units", List.of());
        }

        List<String> buildingIds = buildings.stream().map(r -> stringVal(r.get("id"))).filter(Objects::nonNull).toList();
        List<Map<String, Object>> blocks = queryList("select * from building_blocks where building_id in (:buildingIds)", Map.of("buildingIds", buildingIds));
        List<String> blockIds = blocks.stream().map(r -> stringVal(r.get("id"))).filter(Objects::nonNull).toList();
        List<Map<String, Object>> extensions = blockIds.isEmpty() ? List.of() : queryList(
            "select * from block_extensions where parent_block_id in (:blockIds) order by created_at asc",
            Map.of("blockIds", blockIds)
        );
        Map<String, List<Map<String, Object>>> extensionsByBlockId = new HashMap<>();
        for (Map<String, Object> ext : extensions) {
            String parentBlockId = stringVal(ext.get("parent_block_id"));
            if (parentBlockId == null) continue;
            extensionsByBlockId.computeIfAbsent(parentBlockId, k -> new ArrayList<>()).add(ext);
        }

        List<Map<String, Object>> floors = blockIds.isEmpty() ? List.of() : queryList("select * from floors where block_id in (:blockIds)", Map.of("blockIds", blockIds));
        List<Map<String, Object>> entrances = blockIds.isEmpty() ? List.of() : queryList("select id, block_id, number from entrances where block_id in (:blockIds)", Map.of("blockIds", blockIds));
        List<String> floorIds = floors.stream().map(r -> stringVal(r.get("id"))).filter(Objects::nonNull).toList();
        List<Map<String, Object>> units = floorIds.isEmpty() ? List.of() : queryList("select * from units where floor_id in (:floorIds) order by id asc", Map.of("floorIds", floorIds));
        List<String> unitIds = units.stream().map(r -> stringVal(r.get("id"))).filter(Objects::nonNull).toList();
        List<Map<String, Object>> rooms = unitIds.isEmpty() ? List.of() : queryList("select * from rooms where unit_id in (:unitIds)", Map.of("unitIds", unitIds));

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
        List<Map<String, Object>> buildings = queryList("select id, date_start, date_end from buildings where project_id = :projectId", Map.of("projectId", projectId));

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

        List<String> buildingIds = buildings.stream().map(r -> stringVal(r.get("id"))).filter(Objects::nonNull).toList();
        List<Map<String, Object>> blocks = queryList("select id from building_blocks where building_id in (:buildingIds)", Map.of("buildingIds", buildingIds));
        List<String> blockIds = blocks.stream().map(r -> stringVal(r.get("id"))).filter(Objects::nonNull).toList();
        if (blockIds.isEmpty()) return summary;

        List<Map<String, Object>> floors = queryList("select id, area_proj, area_fact from floors where block_id in (:blockIds)", Map.of("blockIds", blockIds));
        List<String> floorIds = floors.stream().map(r -> stringVal(r.get("id"))).filter(Objects::nonNull).toList();
        List<Map<String, Object>> units = floorIds.isEmpty() ? List.of() : queryList("select id, unit_type, total_area, cadastre_number from units where floor_id in (:floorIds)", Map.of("floorIds", floorIds));

        double totalAreaProj = 0d;
        double totalAreaFact = 0d;
        for (Map<String, Object> floor : floors) {
            totalAreaProj += toDouble(floor.get("area_proj"));
            totalAreaFact += toDouble(floor.get("area_fact"));
        }
        summary.put("totalAreaProj", totalAreaProj);
        summary.put("totalAreaFact", totalAreaFact);

        double progressSum = 0d;
        for (Map<String, Object> b : buildings) {
            progressSum += progressPercent(b.get("date_start"), b.get("date_end"));
        }
        summary.put("avgProgress", buildings.isEmpty() ? 0d : progressSum / buildings.size());

        int cadastreReady = 0;
        int totalObjects = 0;
        for (Map<String, Object> unit : units) {
            totalObjects += 1;
            if (unit.get("cadastre_number") != null && !String.valueOf(unit.get("cadastre_number")).isBlank()) cadastreReady += 1;
            double area = toDouble(unit.get("total_area"));
            String type = stringVal(unit.get("unit_type"));
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
        return jdbc.queryForList(sql, params);
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

    private String stringVal(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private String stringValOr(Object value, String fallback) {
        String val = stringVal(value);
        return val == null || val.isBlank() ? fallback : val;
    }




    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value == null ? Map.of() : value);
        } catch (JsonProcessingException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid geometry json");
        }
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

    private Object queryScalar(String sql, Map<String, Object> params) {
        Query query = em.createNativeQuery(sql);
        params.forEach(query::setParameter);
        List<?> rows = query.getResultList();
        return rows.isEmpty() ? null : rows.get(0);
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
